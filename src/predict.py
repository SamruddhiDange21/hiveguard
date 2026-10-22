"""Inference service for real-time hive anomaly detection and alert generation (Step 12)."""
import sys
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from datetime import datetime

# Ensure src can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.config import (
    BEST_MODEL_PATH,
    ALL_FEATURE_COLS,
    HEALTHY_BASELINES,
)
from src.anomaly_explanation import (
    calculate_anomaly_score,
    map_risk_level,
    explain_anomaly,
)

# Global model cache
_MODEL_PAYLOAD = None


def get_model_payload(model_path=BEST_MODEL_PATH):
    """Load and cache serialized model bundle."""
    global _MODEL_PAYLOAD
    if _MODEL_PAYLOAD is None:
        model_path = Path(model_path)
        if not model_path.exists():
            raise FileNotFoundError(
                f"Trained model not found at {model_path}. Run src/train_model.py first."
            )
        _MODEL_PAYLOAD = joblib.load(model_path)
    return _MODEL_PAYLOAD


def predict_hive_status(
    temperature: float,
    humidity: float,
    weight: float,
    outside_temperature: float,
    previous_weight: float = None,
    previous_temperature: float = None,
    previous_humidity: float = None,
    weight_change_from_start_kg: float = None,
    temperature_rolling_mean: float = None,
    humidity_rolling_mean: float = None,
    weight_rolling_mean: float = None,
    timestamp: datetime = None,
    hive_id: str = "APIS_CERANA_INDIA_01",
) -> dict:
    """Predict colony risk status for an individual hive reading (Step 12).
    
    Parameters:
    - temperature: Current internal hive temperature (°C)
    - humidity: Current internal relative humidity (%)
    - weight: Current gross hive weight (kg)
    - outside_temperature: Current ambient outside temperature (°C)
    - previous_weight: Previous observation's hive weight (kg), or None
    
    Returns:
        {
            "predicted_condition": str,
            "risk_level": str,
            "confidence": float,
            "anomaly_score": float,
            "explanation": str
        }
    """
    payload = get_model_payload()
    model = payload["model"]
    scaler = payload.get("scaler")
    classes = payload["classes"]

    if timestamp is None:
        timestamp = datetime.now()

    # Derived physics parameters
    temp_diff = float(temperature - outside_temperature)

    # If previous weight provided, compute weight change
    if previous_weight is not None:
        weight_change = float(weight - previous_weight)
    else:
        weight_change = 0.0

    if weight_change_from_start_kg is not None:
        wt_from_start = float(weight_change_from_start_kg)
    else:
        # Approximate from step change or normal baseline
        wt_from_start = weight_change if abs(weight_change) > 0.05 else 0.14

    # Temperature change handling
    if previous_temperature is not None:
        temp_change = float(temperature - previous_temperature)
    else:
        # If extreme spike > 40°C, imply sensor jump from normal ~34.5°C
        temp_change = float(temperature - 34.4) if temperature > 40.0 else 0.02

    # Humidity change handling
    if previous_humidity is not None:
        hum_change = float(humidity - previous_humidity)
    else:
        hum_change = 0.0

    # Rolling estimates
    if temperature_rolling_mean is not None:
        t_roll_mean = float(temperature_rolling_mean)
    else:
        # For sensor anomalies with spike, rolling mean reflects prior stable baseline
        t_roll_mean = 34.6 if temperature > 40.0 else temperature

    t_roll_std = max(0.1, abs(temp_change) * 0.4)

    if humidity_rolling_mean is not None:
        h_roll_mean = float(humidity_rolling_mean)
    else:
        h_roll_mean = humidity

    h_roll_std = max(0.2, abs(hum_change) * 0.4)

    if weight_rolling_mean is not None:
        w_roll_mean = float(weight_rolling_mean)
    else:
        w_roll_mean = weight

    w_roll_std = max(0.05, abs(weight_change) * 0.4)

    # Temporal components
    hour = timestamp.hour
    day_of_week = timestamp.weekday()
    month = timestamp.month

    # Assemble feature vector matching ALL_FEATURE_COLS
    feature_dict = {
        "temperature_C": temperature,
        "humidity_percent": humidity,
        "weight_kg": weight,
        "outside_temperature_C": outside_temperature,
        "temp_minus_outside_C": temp_diff,
        "weight_change_from_start_kg": wt_from_start,
        "temperature_change": temp_change,
        "humidity_change": hum_change,
        "weight_change": weight_change,
        "temperature_rolling_mean": t_roll_mean,
        "temperature_rolling_std": t_roll_std,
        "humidity_rolling_mean": h_roll_mean,
        "humidity_rolling_std": h_roll_std,
        "weight_rolling_mean": w_roll_mean,
        "weight_rolling_std": w_roll_std,
        "hour": hour,
        "day_of_week": day_of_week,
        "month": month,
    }

    feature_df = pd.DataFrame([feature_dict])[ALL_FEATURE_COLS]

    # Apply scaling if needed
    if scaler is not None:
        X_eval = scaler.transform(feature_df)
    else:
        X_eval = feature_df

    # Predict probabilities and top class
    if hasattr(model, "predict_proba"):
        probs_arr = model.predict_proba(X_eval)[0]
        if hasattr(model, "classes_"):
            cls_labels = model.classes_
            probs = {cls_labels[i]: float(probs_arr[i]) for i in range(len(cls_labels))}
        else:
            probs = {classes[i]: float(probs_arr[i]) for i in range(len(classes))}
        predicted_condition = max(probs, key=probs.get)
        confidence = float(probs[predicted_condition])
    else:
        pred_label = model.predict(X_eval)[0]
        predicted_condition = str(pred_label)
        confidence = 1.0
        probs = {c: (1.0 if c == predicted_condition else 0.0) for c in classes}

    # Physical sensor dict for explanation and scoring
    sensors_info = {
        "temperature_C": temperature,
        "humidity_percent": humidity,
        "weight_kg": weight,
        "outside_temperature_C": outside_temperature,
        "temp_minus_outside_C": temp_diff,
        "weight_change_from_start_kg": wt_from_start,
    }

    # Calculate calibrated anomaly score (0-100)
    anomaly_score = calculate_anomaly_score(probs, sensors_info)

    # Determine beekeeper risk level
    risk_level = map_risk_level(predicted_condition, confidence, anomaly_score)

    # Synthesize plain-language explanation
    explanation = explain_anomaly(
        predicted_condition=predicted_condition,
        risk_level=risk_level,
        sensors=sensors_info,
        confidence=confidence,
        anomaly_score=anomaly_score,
    )

    return {
        "predicted_condition": predicted_condition,
        "risk_level": risk_level,
        "confidence": round(confidence, 4),
        "anomaly_score": round(anomaly_score, 1),
        "explanation": explanation,
    }


def predict_dataframe(df_with_features):
    """Batch predict conditions, anomaly scores, and risk levels on a pre-engineered DataFrame."""
    payload = get_model_payload()
    model = payload["model"]
    scaler = payload.get("scaler")
    classes = payload["classes"]

    X = df_with_features[ALL_FEATURE_COLS]
    if scaler is not None:
        X = scaler.transform(X)

    if hasattr(model, "predict_proba"):
        probs_arr = model.predict_proba(X)
        model_classes = model.classes_ if hasattr(model, "classes_") else classes
    else:
        probs_arr = np.zeros((len(df_with_features), len(classes)))
        model_classes = classes

    results = []
    for i, (_, row) in enumerate(df_with_features.iterrows()):
        p_dict = {model_classes[j]: float(probs_arr[i, j]) for j in range(len(model_classes))}
        best_cond = max(p_dict, key=p_dict.get)
        conf = p_dict[best_cond]

        sensors = {
            "temperature_C": row["temperature_C"],
            "humidity_percent": row["humidity_percent"],
            "weight_kg": row["weight_kg"],
            "outside_temperature_C": row.get("outside_temperature_C", 25.0),
            "temp_minus_outside_C": row.get("temp_minus_outside_C", 9.0),
            "weight_change_from_start_kg": row.get("weight_change_from_start_kg", 0.0),
        }
        score = calculate_anomaly_score(p_dict, sensors)
        risk = map_risk_level(best_cond, conf, score)
        exp = explain_anomaly(best_cond, risk, sensors, conf, score)

        results.append({
            "predicted_condition": best_cond,
            "risk_level": risk,
            "confidence": round(conf, 4),
            "anomaly_score": round(score, 1),
            "explanation": exp,
        })

    return pd.DataFrame(results)


if __name__ == "__main__":
    print("Testing individual prediction examples (Step 12):")
    # Example 1: Healthy Reading
    ex1 = predict_hive_status(
        temperature=34.33,
        humidity=60.15,
        weight=34.59,
        outside_temperature=26.36,
        previous_weight=34.69,
        weight_change_from_start_kg=0.02,
        temperature_rolling_mean=34.46,
        humidity_rolling_mean=60.13,
        weight_rolling_mean=34.60,
        timestamp=pd.to_datetime("2026-01-09 08:00:00"),
    )
    print("\n--- Example 1 (Healthy Normal) ---")
    for k, v in ex1.items():
        print(f"  {k}: {v}")

    # Example 2: Sensor Anomaly (Spike)
    ex2 = predict_hive_status(
        temperature=42.5,
        humidity=58.2,
        weight=36.0,
        outside_temperature=24.0,
        previous_temperature=34.6,
        previous_weight=36.0,
        weight_change_from_start_kg=0.10,
        timestamp=pd.to_datetime("2026-01-15 12:00:00"),
    )
    print("\n--- Example 2 (Sensor Anomaly) ---")
    for k, v in ex2.items():
        print(f"  {k}: {v}")

    # Example 3: Colony Stress
    ex3 = predict_hive_status(
        temperature=32.2,
        humidity=69.5,
        weight=34.5,
        outside_temperature=28.0,
        previous_weight=35.8,
        weight_change_from_start_kg=-1.30,
        temperature_rolling_mean=32.4,
        humidity_rolling_mean=69.0,
        timestamp=pd.to_datetime("2026-01-15 12:00:00"),
    )
    print("\n--- Example 3 (Colony Stress) ---")
    for k, v in ex3.items():
        print(f"  {k}: {v}")

    # Example 4: Varroa Risk
    ex4 = predict_hive_status(
        temperature=33.3,
        humidity=65.2,
        weight=37.5,
        outside_temperature=26.0,
        previous_weight=37.6,
        weight_change_from_start_kg=-0.82,
        temperature_rolling_mean=33.4,
        humidity_rolling_mean=65.0,
        timestamp=pd.to_datetime("2026-01-15 12:00:00"),
    )
    print("\n--- Example 4 (Varroa Risk) ---")
    for k, v in ex4.items():
        print(f"  {k}: {v}")

    # Example 5: Swarming Risk
    ex5 = predict_hive_status(
        temperature=36.2,
        humidity=58.5,
        weight=37.0,
        outside_temperature=27.0,
        previous_weight=37.8,
        weight_change_from_start_kg=-0.50,
        temperature_rolling_mean=36.0,
        timestamp=pd.to_datetime("2026-01-15 12:00:00"),
    )
    print("\n--- Example 5 (Swarming Risk) ---")
    for k, v in ex5.items():
        print(f"  {k}: {v}")

