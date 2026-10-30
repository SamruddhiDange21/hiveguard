"""Flask REST API Blueprint for HIVEGUARD Research & Anomaly Detection Framework."""
import os
import json
from pathlib import Path
from flask import Blueprint, jsonify, request, send_file
import pandas as pd
import numpy as np

from src.research.dataset_loader import (
    list_available_datasets,
    load_dataset_by_id,
    inspect_dataset,
    harmonize_columns,
    UPLOADS_DIR,
)
from src.research.sensor_reliability import evaluate_dataset_reliability
from src.research.context_baseline import compute_contextual_baselines
from src.research.anomaly_framework import compare_all_methods
from src.research.simulation_lab import (
    inject_sensor_fault,
    inject_hypothetical_environmental_stress,
)
from src.research.evaluation import benchmark_methods_on_simulation
from src.research.experiment_registry import (
    load_experiments,
    save_experiment,
    LOG_CSV_PATH,
    export_experiment_as_json,
)

research_bp = Blueprint("research_bp", __name__)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
AUDIT_MD_PATH = PROJECT_ROOT / "data" / "processed" / "mspb" / "MSPB_DATASET_AUDIT.md"


@research_bp.route("/api/research/datasets", methods=["GET"])
def get_datasets():
    """List all available datasets (recorded research benchmarks, synthetic prototypes, uploads)."""
    try:
        datasets = list_available_datasets()
        return jsonify({"datasets": datasets})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@research_bp.route("/api/research/inspect-dataset", methods=["POST"])
def inspect_dataset_endpoint():
    """Inspect schema, missing values, duplicates, and cadence for a dataset."""
    try:
        data = request.get_json(force=True) or {}
        dataset_id = data.get("dataset_id", "mspb_research_telemetry")
        df, info = load_dataset_by_id(dataset_id)
        return jsonify({"status": "success", "inspection": info})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@research_bp.route("/api/research/upload", methods=["POST"])
def upload_dataset():
    """Upload and validate an external research CSV dataset."""
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file attached to upload request."}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Empty filename."}), 400
        if not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Only CSV files are supported."}), 400

        # Safe filename
        safe_name = "".join(c for c in file.filename if c.isalnum() or c in (".", "_", "-"))
        save_path = UPLOADS_DIR / safe_name
        file.save(save_path)

        # Read and inspect
        df = pd.read_csv(save_path)
        df_clean, mapping = harmonize_columns(df)
        info = inspect_dataset(df_clean, dataset_id=f"upload_{save_path.stem}", source_label="User Uploaded Research Data")

        return jsonify({
            "status": "success",
            "message": f"Successfully uploaded and verified '{safe_name}' ({len(df):,} rows).",
            "dataset_id": f"upload_{save_path.stem}",
            "inspection": info,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@research_bp.route("/api/research/sensor-reliability", methods=["POST"])
def assess_reliability_endpoint():
    """Evaluate sensor reliability on selected dataset and hive."""
    try:
        data = request.get_json(force=True) or {}
        dataset_id = data.get("dataset_id", "mspb_research_telemetry")
        hive_id = data.get("hive_id")
        limit = int(data.get("limit", 600))

        df, info = load_dataset_by_id(dataset_id)
        if hive_id and "hive_id" in df.columns:
            df = df[df["hive_id"] == hive_id]

        if len(df) > limit:
            df = df.iloc[-limit:].copy()

        df_rel, rel_summary = evaluate_dataset_reliability(df)

        # Build timeline for UI charts
        timeline = []
        for _, row in df_rel.iterrows():
            rec = {
                "timestamp": str(row.get("timestamp", "")),
                "temperature_C": float(row["temperature_C"]) if "temperature_C" in row and pd.notna(row["temperature_C"]) else None,
                "humidity_percent": float(row["humidity_percent"]) if "humidity_percent" in row and pd.notna(row["humidity_percent"]) else None,
                "overall_reliability": float(row.get("overall_sensor_reliability", 1.0)),
                "status": str(row.get("overall_sensor_status", "RELIABLE")),
            }
            timeline.append(rec)

        return jsonify({
            "status": "success",
            "dataset_id": dataset_id,
            "hive_id": hive_id,
            "summary": rel_summary,
            "timeline": timeline,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@research_bp.route("/api/research/context-anomaly/compare", methods=["POST"])
def compare_anomaly_methods_endpoint():
    """Execute side-by-side comparison of Method A, Method B, and Method C."""
    try:
        data = request.get_json(force=True) or {}
        dataset_id = data.get("dataset_id", "mspb_research_telemetry")
        hive_id = data.get("hive_id")
        limit = int(data.get("limit", 600))

        df, info = load_dataset_by_id(dataset_id)
        df_comp, summary = compare_all_methods(df, hive_id=hive_id, limit=limit)

        # Build records for visualization
        records = []
        for _, row in df_comp.iterrows():
            records.append({
                "timestamp": str(row.get("timestamp", "")),
                "temperature_C": float(row["temperature_C"]) if "temperature_C" in row and pd.notna(row["temperature_C"]) else None,
                "expected_diurnal": float(row.get("temperature_C_expected_diurnal", 34.4)),
                "rolling_median": float(row.get("temperature_C_rolling_median", 34.4)),
                "robust_zscore": float(row.get("temperature_C_robust_zscore", 0.0)),
                "method_a_flag": bool(row.get("method_a_flag", False)),
                "method_a_score": float(row.get("method_a_score", 0.0)),
                "method_b_flag": bool(row.get("method_b_flag", False)),
                "method_b_score": float(row.get("method_b_score", 0.0)),
                "method_c_flag": bool(row.get("method_c_flag", False)),
                "method_c_score": float(row.get("method_c_score", 0.0)),
                "method_c_category": str(row.get("method_c_category", "NORMAL")),
                "method_c_explanation": str(row.get("method_c_explanation", "")),
                "is_management_event": bool(row.get("is_management_event", False)),
                "sensor_reliability": float(row.get("overall_sensor_reliability", 1.0)),
            })

        return jsonify({
            "status": "success",
            "dataset_id": dataset_id,
            "hive_id": hive_id,
            "summary": summary,
            "timeline": records,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@research_bp.route("/api/research/simulation/run", methods=["POST"])
def run_simulation_endpoint():
    """Inject controlled fault or hypothetical stress, and benchmark detection."""
    try:
        data = request.get_json(force=True) or {}
        dataset_id = data.get("dataset_id", "mspb_research_telemetry")
        hive_id = data.get("hive_id")
        scenario_category = data.get("scenario_category", "sensor_fault")
        scenario_type = data.get("scenario_type", "isolated_spike")
        channel = data.get("channel", "temperature_C")
        start_index = int(data.get("start_index", 150))
        duration = int(data.get("duration", 1))
        severity = float(data.get("severity", 12.0))
        seed = int(data.get("seed", 42))

        df, _ = load_dataset_by_id(dataset_id)
        if hive_id and "hive_id" in df.columns:
            df = df[df["hive_id"] == hive_id]

        slice_df = df.iloc[:500].copy()

        if scenario_category == "sensor_fault":
            sim_df, cfg = inject_sensor_fault(
                slice_df,
                channel=channel,
                fault_type=scenario_type,
                start_index=start_index,
                duration=duration,
                severity=severity,
                seed=seed,
            )
            gt_col = "injected_ground_truth_fault"
        else:
            sim_df, cfg = inject_hypothetical_environmental_stress(
                slice_df,
                stress_type=scenario_type,
                start_index=start_index,
                duration=duration,
                severity=severity,
                seed=seed,
            )
            gt_col = "injected_ground_truth_stress"

        # Benchmark methods
        bench_res = benchmark_methods_on_simulation(sim_df, ground_truth_col=gt_col)

        # Run comparison to extract timeline
        df_comp, _ = compare_all_methods(sim_df, limit=len(sim_df))

        timeline = []
        for _, row in df_comp.iterrows():
            timeline.append({
                "timestamp": str(row.get("timestamp", "")),
                "original_val": float(row.get(f"{channel}_original", row.get(channel, 34.4))),
                "corrupted_val": float(row.get(channel, 34.4)),
                "is_ground_truth": bool(row.get(gt_col, False)),
                "method_a_flag": bool(row.get("method_a_flag", False)),
                "method_b_flag": bool(row.get("method_b_flag", False)),
                "method_c_flag": bool(row.get("method_c_flag", False)),
                "method_c_score": float(row.get("method_c_score", 0.0)),
                "method_c_category": str(row.get("method_c_category", "NORMAL")),
            })

        return jsonify({
            "status": "success",
            "scenario_config": cfg,
            "benchmark_results": bench_res,
            "timeline": timeline,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@research_bp.route("/api/research/experiments", methods=["GET"])
def get_experiments():
    """Retrieve all logged experiments."""
    try:
        exps = load_experiments()
        return jsonify({"experiments": exps})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@research_bp.route("/api/research/experiments/save", methods=["POST"])
def register_experiment():
    """Register an experiment run."""
    try:
        data = request.get_json(force=True) or {}
        rec = save_experiment(
            dataset_id=data.get("dataset_id", "mspb_research_telemetry"),
            algorithm_name=data.get("algorithm_name", "Method C"),
            parameters=data.get("parameters", {}),
            metrics=data.get("metrics", {}),
            scenario_details=data.get("scenario_details", {}),
            dataset_provenance=data.get("dataset_provenance", "Recorded Public Research Data"),
            notes=data.get("notes", ""),
        )
        return jsonify({"status": "success", "experiment": rec})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@research_bp.route("/api/research/experiments/export-csv", methods=["GET"])
def export_csv():
    """Download experiments log CSV."""
    if LOG_CSV_PATH.exists():
        return send_file(LOG_CSV_PATH, mimetype="text/csv", as_attachment=True, download_name="hiveguard_experiments.csv")
    return jsonify({"error": "No experiments logged yet."}), 404


@research_bp.route("/api/research/audit/mspb", methods=["GET"])
def get_mspb_audit():
    """Read the verified MSPB Dataset Audit Report markdown."""
    try:
        if AUDIT_MD_PATH.exists():
            with open(AUDIT_MD_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            return jsonify({"status": "success", "markdown": content})
        return jsonify({"error": "Audit report not found."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500
