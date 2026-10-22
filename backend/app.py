"""Flask Backend API for HIVEGUARD."""
import sys
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.config import (
    CLEANED_DATA_PATH,
    RAW_DATA_PATH,
    BEST_MODEL_PATH,
    ALL_FEATURE_COLS,
    HEALTHY_BASELINES,
)
from src.preprocessing import clean_data, load_data
from src.feature_engineering import compute_hive_features
from src.predict import get_model_payload, predict_hive_status, predict_dataframe

FRONTEND_DIR = PROJECT_ROOT / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app)

# Global dataset & predictions cache
_DF_CACHE = None
_DF_FEAT_CACHE = None
_MODEL_PAYLOAD = None


def get_data():
    """Load cleaned dataset with engineered features."""
    global _DF_CACHE, _DF_FEAT_CACHE
    if _DF_FEAT_CACHE is None:
        if not CLEANED_DATA_PATH.exists():
            print("[BACKEND] Cleaned data missing. Running preprocessing...")
            raw_df = load_data(RAW_DATA_PATH)
            clean_df = clean_data(raw_df, CLEANED_DATA_PATH)
        else:
            clean_df = pd.read_csv(CLEANED_DATA_PATH)

        clean_df["timestamp"] = pd.to_datetime(clean_df["timestamp"])
        clean_df = clean_df.sort_values(by=["hive_id", "timestamp"]).reset_index(drop=True)
        _DF_CACHE = clean_df
        _DF_FEAT_CACHE = compute_hive_features(clean_df)

        # Precompute batch predictions for all rows so historical API responses are instant
        preds = predict_dataframe(_DF_FEAT_CACHE)
        for col in ["predicted_condition", "risk_level", "confidence", "anomaly_score", "explanation"]:
            _DF_FEAT_CACHE[col] = preds[col].values

    return _DF_FEAT_CACHE


def get_model():
    """Retrieve cached model bundle."""
    global _MODEL_PAYLOAD
    if _MODEL_PAYLOAD is None:
        _MODEL_PAYLOAD = get_model_payload(BEST_MODEL_PATH)
    return _MODEL_PAYLOAD


# ==============================================================================
# STATIC FRONTEND ROUTES
# ==============================================================================

@app.route("/")
def serve_index():
    """Serve frontend index.html."""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    """Serve frontend static assets (style.css, script.js, etc.)."""
    return send_from_directory(app.static_folder, path)


# ==============================================================================
# API ENDPOINTS
# ==============================================================================

@app.route("/api/hives", methods=["GET"])
def get_hives():
    """Return all unique monitored hive IDs."""
    try:
        df = get_data()
        unique_hives = sorted(df["hive_id"].unique().tolist())
        return jsonify({"hives": unique_hives})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/hive/<hive_id>", methods=["GET"])
def get_hive_history(hive_id):
    """Return historical sensor data for the selected hive."""
    try:
        df = get_data()
        hive_data = df[df["hive_id"] == hive_id].sort_values("timestamp")
        if hive_data.empty:
            return jsonify({"error": f"Hive '{hive_id}' not found."}), 404

        records = []
        for _, row in hive_data.iterrows():
            records.append({
                "timestamp": row["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
                "temperature_C": round(float(row["temperature_C"]), 2),
                "humidity_percent": round(float(row["humidity_percent"]), 2),
                "weight_kg": round(float(row["weight_kg"]), 2),
                "outside_temperature_C": round(float(row["outside_temperature_C"]), 2),
                "condition_label": str(row["condition_label"]),
                "anomaly": int(row.get("anomaly", 0)),
                "predicted_condition": str(row.get("predicted_condition", row["condition_label"])),
                "risk_level": str(row.get("risk_level", "NORMAL")),
                "anomaly_score": float(row.get("anomaly_score", 0.0)),
                "confidence": float(row.get("confidence", 1.0)),
            })

        return jsonify({
            "hive_id": hive_id,
            "total_records": len(records),
            "data": records
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/latest/<hive_id>", methods=["GET"])
def get_latest_hive_status(hive_id):
    """Return the latest sensor values and ML inference for the selected hive."""
    try:
        df = get_data()
        hive_data = df[df["hive_id"] == hive_id].sort_values("timestamp")
        if hive_data.empty:
            return jsonify({"error": f"Hive '{hive_id}' not found."}), 404

        latest_row = hive_data.iloc[-1]
        prev_row = hive_data.iloc[-2] if len(hive_data) > 1 else latest_row

        return jsonify({
            "hive_id": hive_id,
            "timestamp": latest_row["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
            "temperature": round(float(latest_row["temperature_C"]), 2),
            "humidity": round(float(latest_row["humidity_percent"]), 2),
            "weight": round(float(latest_row["weight_kg"]), 2),
            "outside_temperature": round(float(latest_row["outside_temperature_C"]), 2),
            "condition": str(latest_row.get("predicted_condition", latest_row["condition_label"])),
            "risk_level": str(latest_row.get("risk_level", "NORMAL")),
            "anomaly_score": round(float(latest_row.get("anomaly_score", 0.0)), 1),
            "confidence": round(float(latest_row.get("confidence", 0.95)), 4),
            "explanation": str(latest_row.get("explanation", "Normal colony behavior observed.")),
            "temp_change": round(float(latest_row["temperature_C"] - prev_row["temperature_C"]), 2),
            "humidity_change": round(float(latest_row["humidity_percent"] - prev_row["humidity_percent"]), 2),
            "weight_change": round(float(latest_row["weight_kg"] - prev_row["weight_kg"]), 2),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/predict", methods=["POST"])
def run_predict():
    """Run trained ML model on incoming sensor parameters."""
    try:
        data = request.get_json(force=True)
        if not data:
            return jsonify({"error": "No JSON payload provided."}), 400

        temperature = float(data.get("temperature", 34.4))
        humidity = float(data.get("humidity", 58.0))
        weight = float(data.get("weight", 36.0))
        outside_temperature = float(data.get("outside_temperature", 25.0))
        previous_weight = data.get("previous_weight")
        if previous_weight is not None:
            previous_weight = float(previous_weight)

        previous_temperature = data.get("previous_temperature")
        if previous_temperature is not None:
            previous_temperature = float(previous_temperature)

        weight_change_from_start = data.get("weight_change_from_start_kg")
        if weight_change_from_start is not None:
            weight_change_from_start = float(weight_change_from_start)

        t_roll = data.get("temperature_rolling_mean")
        if t_roll is not None:
            t_roll = float(t_roll)

        h_roll = data.get("humidity_rolling_mean")
        if h_roll is not None:
            h_roll = float(h_roll)

        w_roll = data.get("weight_rolling_mean")
        if w_roll is not None:
            w_roll = float(w_roll)

        ts_str = data.get("timestamp")
        ts = pd.to_datetime(ts_str) if ts_str else datetime(2026, 1, 15, 12, 0)

        # Run model inference
        res = predict_hive_status(
            temperature=temperature,
            humidity=humidity,
            weight=weight,
            outside_temperature=outside_temperature,
            previous_weight=previous_weight,
            previous_temperature=previous_temperature,
            weight_change_from_start_kg=weight_change_from_start,
            temperature_rolling_mean=t_roll,
            humidity_rolling_mean=h_roll,
            weight_rolling_mean=w_roll,
            timestamp=ts,
        )

        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/model-insights", methods=["GET"])
def get_model_insights():
    """Return trained model performance metrics and feature importance ranking."""
    try:
        payload = get_model()
        model_name = payload["model_name"]
        comp_table = payload["comparison_table"]
        rf_model = payload["model"]

        best_row = comp_table[comp_table["Model"] == model_name].iloc[0]

        importances = rf_model.feature_importances_
        fi_list = []
        for feat, imp in zip(ALL_FEATURE_COLS, importances):
            fi_list.append({"feature": feat, "importance": round(float(imp), 4)})
        fi_list.sort(key=lambda x: x["importance"], reverse=True)

        return jsonify({
            "model_name": model_name,
            "accuracy": round(float(best_row["Accuracy"]), 4),
            "precision": round(float(best_row["Precision"]), 4),
            "recall": round(float(best_row["Recall"]), 4),
            "macro_f1": round(float(best_row["Macro F1"]), 4),
            "feature_importance": fi_list,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


import os
import socket

def get_free_port(preferred=5000):
    env_port = os.environ.get("PORT")
    if env_port:
        return int(env_port)
    for p in [preferred, 5001, 5002, 5050, 8080]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                if p != preferred:
                    print(f"[HIVEGUARD BACKEND] Port {preferred} occupied (e.g. macOS AirPlay). Bound to http://localhost:{p}")
                return p
    return 5001


if __name__ == "__main__":
    port = get_free_port(5000)
    print(f"[HIVEGUARD BACKEND] Starting Flask server on http://localhost:{port}")
    # Preload data on startup
    get_data()
    app.run(host="0.0.0.0", port=port, debug=False)

