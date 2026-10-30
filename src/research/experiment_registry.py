"""Experiment Registry and Reproducible Results Export for HIVEGUARD."""
import json
from pathlib import Path
from datetime import datetime
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
EXP_DIR = PROJECT_ROOT / "experiments"
EXP_DIR.mkdir(parents=True, exist_ok=True)
LOG_JSON_PATH = EXP_DIR / "experiments_log.json"
LOG_CSV_PATH = EXP_DIR / "experiments_log.csv"


def load_experiments() -> list[dict]:
    """Load all registered experiments from JSON storage."""
    if LOG_JSON_PATH.exists():
        try:
            with open(LOG_JSON_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_experiment(
    dataset_id: str,
    algorithm_name: str,
    parameters: dict,
    metrics: dict,
    scenario_details: dict = None,
    dataset_provenance: str = "Recorded Public Research Data",
    notes: str = "",
) -> dict:
    """Register a completed experiment run with configuration and metrics."""
    now = datetime.now()
    exp_id = f"EXP_{now.strftime('%Y%m%d_%H%M%S')}_{np_rand_id()}"

    record = {
        "experiment_id": exp_id,
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
        "dataset_id": dataset_id,
        "dataset_provenance": dataset_provenance,
        "algorithm_name": algorithm_name,
        "parameters": parameters,
        "metrics": metrics,
        "scenario_details": scenario_details or {},
        "notes": notes,
        "software_version": "2.0.0-research",
    }

    exps = load_experiments()
    exps.append(record)

    with open(LOG_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(exps, f, indent=2)

    # Update flat CSV table
    update_csv_log(exps)

    return record


def np_rand_id() -> str:
    import random
    return f"{random.randint(100, 999)}"


def update_csv_log(exps: list[dict]):
    """Update tabular CSV export of all experiments."""
    flat_rows = []
    for e in exps:
        m = e.get("metrics", {})
        flat_rows.append({
            "experiment_id": e.get("experiment_id"),
            "timestamp": e.get("timestamp"),
            "dataset_id": e.get("dataset_id"),
            "dataset_provenance": e.get("dataset_provenance"),
            "algorithm_name": e.get("algorithm_name"),
            "precision": m.get("precision", "N/A"),
            "recall": m.get("recall", "N/A"),
            "f1_score": m.get("f1_score", "N/A"),
            "far_per_24h": m.get("far_per_24h", "N/A"),
            "detection_delay_minutes": m.get("detection_delay_minutes", "N/A"),
            "runtime_ms": m.get("runtime_ms", "N/A"),
            "parameters": json.dumps(e.get("parameters", {})),
            "software_version": e.get("software_version"),
        })
    df = pd.DataFrame(flat_rows)
    df.to_csv(LOG_CSV_PATH, index=False)


def export_experiment_as_json(experiment_id: str) -> dict:
    """Retrieve full configuration and results for a single experiment."""
    exps = load_experiments()
    for e in exps:
        if e.get("experiment_id") == experiment_id:
            return e
    return None
