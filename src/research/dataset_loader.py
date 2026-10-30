"""Dataset loading, schema validation, data harmonization, and provenance management for HIVEGUARD."""
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

COLUMN_SYNONYMS = {
    "timestamp": ["timestamp", "datetime", "date_time", "time", "date"],
    "hive_id": ["hive_id", "hive", "colony_id", "hiveid", "colony"],
    "temperature_C": ["temperature_c", "temperature", "temp", "internal_temp", "temp_c", "hive_temp"],
    "humidity_percent": ["humidity_percent", "humidity", "humidity_rh", "rh", "hum", "internal_humidity"],
    "weight_kg": ["weight_kg", "weight", "hive_weight", "gross_weight", "wt_kg", "mass_kg"],
    "outside_temperature_C": ["outside_temperature_c", "outside_temp", "ambient_temp", "external_temp", "ambient_temperature_c", "temp_outside"],
}

DATASET_REGISTRY = {
    "mspb_research_telemetry": {
        "id": "mspb_research_telemetry",
        "name": "MSPB Real Research Telemetry Benchmark (86,453 obs)",
        "file_path": str(DATA_DIR / "processed" / "mspb" / "mspb_telemetry_benchmark_50k.csv"),
        "provenance": "Recorded Public Research Data",
        "citation": "Zhu et al. (Scientific Data, 2024, DOI: 10.1038/s41597-024-03695-1)",
        "license": "CC-BY-NC-4.0",
        "description": "Verified real-world longitudinal sensor recordings from 53 Apis mellifera colonies across 2 apiaries in Québec, Canada. Contains 15-minute resolution internal temperature, humidity, power stability, and acoustic spectral density.",
        "is_synthetic": False,
        "is_reference": True,
        "validated_veterinary_labels": True,
    },
    "synthetic_prototype_10000": {
        "id": "synthetic_prototype_10000",
        "name": "HIVEGUARD Synthetic Prototype Dataset (10,000 obs)",
        "file_path": str(DATA_DIR / "HIVEGUARD_ML_Bee_Disease_Synthetic_10000.csv"),
        "provenance": "Synthetic Prototype Data",
        "citation": "Internal HIVEGUARD Synthetic Prototype (Unverified Demonstration)",
        "license": "Internal Prototype",
        "description": "Synthetically clustered multi-class dataset used in initial pipeline prototyping. Demonstrates model training flow but contains artificially separable class distributions; not validated for clinical diagnosis.",
        "is_synthetic": True,
        "is_reference": False,
        "validated_veterinary_labels": False,
    },
}


def harmonize_columns(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Harmonize variable column names to standard HIVEGUARD schema.
    
    Returns:
        (harmonized_df, mapping_report)
    """
    df = df.copy()
    lower_map = {col.lower().strip(): col for col in df.columns}
    rename_dict = {}
    found_standards = {}

    for standard, synonyms in COLUMN_SYNONYMS.items():
        matched = None
        for syn in synonyms:
            if syn.lower() in lower_map:
                matched = lower_map[syn.lower()]
                break
        if matched:
            rename_dict[matched] = standard
            found_standards[standard] = matched

    df = df.rename(columns=rename_dict)
    return df, {"renamed": rename_dict, "standard_columns_found": list(found_standards.keys())}


def inspect_dataset(df: pd.DataFrame, dataset_id: str = "custom", source_label: str = "Recorded Data") -> dict:
    """Inspect dataset quality, schema, missing values, duplicates, and sampling cadence."""
    df_clean, mapping_report = harmonize_columns(df)
    
    total_rows = len(df_clean)
    columns = list(df_clean.columns)
    
    # Missing values
    missing_counts = df_clean.isnull().sum().to_dict()
    missing_pct = {col: round(cnt / total_rows * 100, 2) if total_rows > 0 else 0 for col, cnt in missing_counts.items()}
    
    # Timestamp inspection
    timestamp_valid = False
    cadence_summary = {}
    duplicate_timestamps = 0
    date_range = {"start": None, "end": None, "duration_days": 0}
    
    if "timestamp" in df_clean.columns:
        try:
            ts_series = pd.to_datetime(df_clean["timestamp"], errors="coerce")
            valid_ts_mask = ~ts_series.isnull()
            valid_ts = ts_series[valid_ts_mask].sort_values()
            
            if len(valid_ts) > 1:
                timestamp_valid = True
                date_range["start"] = str(valid_ts.iloc[0])
                date_range["end"] = str(valid_ts.iloc[-1])
                date_range["duration_days"] = round((valid_ts.iloc[-1] - valid_ts.iloc[0]).total_seconds() / 86400, 2)
                
                # Cadence / interval analysis
                diffs = valid_ts.diff().dropna().dt.total_seconds() / 60.0  # in minutes
                if len(diffs) > 0:
                    cadence_summary = {
                        "median_interval_minutes": float(diffs.median()),
                        "min_interval_minutes": float(diffs.min()),
                        "max_interval_minutes": float(diffs.max()),
                        "is_regular_interval": bool(diffs.std() < 5.0),
                    }
                
                # Duplicate timestamps check (grouped by hive if present)
                if "hive_id" in df_clean.columns:
                    duplicate_timestamps = int(df_clean.duplicated(subset=["hive_id", "timestamp"]).sum())
                else:
                    duplicate_timestamps = int(df_clean.duplicated(subset=["timestamp"]).sum())
        except Exception as e:
            cadence_summary["error"] = str(e)
            
    # Hive ID check
    hives = []
    if "hive_id" in df_clean.columns:
        hives = [str(h) for h in df_clean["hive_id"].dropna().unique().tolist()]
    else:
        hives = ["DEFAULT_HIVE"]
        
    # Statistical summary for numeric sensors
    numeric_stats = {}
    for col in ["temperature_C", "humidity_percent", "weight_kg", "outside_temperature_C"]:
        if col in df_clean.columns and pd.api.types.is_numeric_dtype(df_clean[col]):
            s = df_clean[col].dropna()
            if len(s) > 0:
                numeric_stats[col] = {
                    "count": int(len(s)),
                    "mean": round(float(s.mean()), 2),
                    "std": round(float(s.std()), 2),
                    "min": round(float(s.min()), 2),
                    "q25": round(float(s.quantile(0.25)), 2),
                    "median": round(float(s.median()), 2),
                    "q75": round(float(s.quantile(0.75)), 2),
                    "max": round(float(s.max()), 2),
                }

    # Data Quality Warnings
    warnings = []
    if duplicate_timestamps > 0:
        warnings.append(f"Found {duplicate_timestamps} duplicate timestamp rows. Deduplication required before time-series modeling.")
    if "temperature_C" not in df_clean.columns:
        warnings.append("Critical parameter 'temperature_C' not identified in schema.")
    for col, pct in missing_pct.items():
        if pct > 10.0:
            warnings.append(f"Column '{col}' exhibits high missingness ({pct}% NaN values).")

    return {
        "dataset_id": dataset_id,
        "source_label": source_label,
        "total_rows": total_rows,
        "columns": columns,
        "standard_columns_found": mapping_report["standard_columns_found"],
        "renamed_columns": mapping_report["renamed"],
        "hives": hives,
        "missing_counts": missing_counts,
        "missing_percentages": missing_pct,
        "timestamp_valid": timestamp_valid,
        "date_range": date_range,
        "cadence_summary": cadence_summary,
        "duplicate_timestamps": duplicate_timestamps,
        "numeric_stats": numeric_stats,
        "warnings": warnings,
        "data_provenance": source_label,
    }


def list_available_datasets() -> list[dict]:
    """List registered and uploaded research datasets."""
    datasets = []
    for d_id, meta in DATASET_REGISTRY.items():
        p = Path(meta["file_path"])
        exists = p.exists()
        datasets.append({
            "id": d_id,
            "name": meta["name"],
            "provenance": meta["provenance"],
            "description": meta["description"],
            "is_synthetic": meta["is_synthetic"],
            "is_reference": meta.get("is_reference", False),
            "file_exists": exists,
            "file_size_kb": round(p.stat().st_size / 1024, 1) if exists else 0,
        })
        
    # Check uploads directory
    if UPLOADS_DIR.exists():
        for csv_file in sorted(UPLOADS_DIR.glob("*.csv")):
            d_id = f"upload_{csv_file.stem}"
            datasets.append({
                "id": d_id,
                "name": f"User Upload: {csv_file.name}",
                "provenance": "User Uploaded Research Data",
                "description": f"Uploaded research dataset '{csv_file.name}' stored in local workspace.",
                "is_synthetic": False,
                "is_reference": False,
                "file_exists": True,
                "file_size_kb": round(csv_file.stat().st_size / 1024, 1),
            })
            
    return datasets


def load_dataset_by_id(dataset_id: str) -> tuple[pd.DataFrame, dict]:
    """Load and harmonize dataset by identifier. Returns (harmonized_df, inspection_dict)."""
    if dataset_id in DATASET_REGISTRY:
        meta = DATASET_REGISTRY[dataset_id]
        p = Path(meta["file_path"])
        if not p.exists():
            raise FileNotFoundError(f"Registered dataset '{dataset_id}' not found at {p}")
        df = pd.read_csv(p)
        df_harm, _ = harmonize_columns(df)
        info = inspect_dataset(df_harm, dataset_id=dataset_id, source_label=meta["provenance"])
        return df_harm, info

    # Check uploads
    if dataset_id.startswith("upload_"):
        filename = dataset_id.replace("upload_", "") + ".csv"
        p = UPLOADS_DIR / filename
        if not p.exists():
            raise FileNotFoundError(f"Uploaded dataset file '{filename}' does not exist.")
        df = pd.read_csv(p)
        df_harm, _ = harmonize_columns(df)
        info = inspect_dataset(df_harm, dataset_id=dataset_id, source_label="User Uploaded Research Data")
        return df_harm, info

    raise ValueError(f"Unknown dataset_id: {dataset_id}")
