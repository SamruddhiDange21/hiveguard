"""Data ingestion, validation, and cleaning pipeline for HIVEGUARD."""
import sys
from pathlib import Path
import pandas as pd
import numpy as np

# Ensure src can be imported when running script directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.config import (
    RAW_DATA_PATH,
    CLEANED_DATA_PATH,
    SENSOR_BOUNDS,
    TARGET_COL,
)


def load_data(filepath=RAW_DATA_PATH):
    """Load raw dataset and output exploratory inspection report."""
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"Dataset not found at {filepath}")

    df = pd.read_csv(filepath)
    return df


def generate_preprocessing_report(df):
    """Generate detailed textual and dictionary inspection report (Step 1)."""
    n_rows, n_cols = df.shape
    columns = list(df.columns)
    dtypes = df.dtypes.to_dict()
    missing_counts = df.isnull().sum().to_dict()
    dup_count = int(df.duplicated().sum())
    unique_hives = sorted(df["hive_id"].unique()) if "hive_id" in df else []
    unique_conditions = df[TARGET_COL].value_counts().to_dict() if TARGET_COL in df else {}

    report_lines = [
        "=" * 70,
        "HIVEGUARD DATA PREPROCESSING & INSPECTION REPORT",
        "=" * 70,
        f"Dataset Shape: {n_rows} rows x {n_cols} columns",
        f"Total Duplicated Rows: {dup_count}",
        "-" * 70,
        "Columns & Data Types:",
    ]
    for col, dt in dtypes.items():
        missing = missing_counts.get(col, 0)
        report_lines.append(f"  - {col:<30}: {str(dt):<10} | Missing: {missing}")

    report_lines.extend([
        "-" * 70,
        f"Unique Monitored Hives ({len(unique_hives)}):",
        f"  {', '.join(unique_hives[:5])} ... {', '.join(unique_hives[-3:])}",
        "-" * 70,
        f"Condition Label Distribution ({TARGET_COL}):",
    ])
    for cond, count in unique_conditions.items():
        pct = (count / n_rows) * 100
        report_lines.append(f"  - {cond:<20}: {count} rows ({pct:.1f}%)")

    report_lines.extend([
        "=" * 70,
        "First 10 Rows Sample:",
        "-" * 70,
        df.head(10).to_string(),
        "=" * 70,
    ])

    report_text = "\n".join(report_lines)
    summary_dict = {
        "shape": (n_rows, n_cols),
        "columns": columns,
        "dtypes": dtypes,
        "missing_counts": missing_counts,
        "duplicate_count": dup_count,
        "unique_hives": unique_hives,
        "class_distribution": unique_conditions,
    }
    return report_text, summary_dict


def clean_data(df, output_path=CLEANED_DATA_PATH):
    """Clean data adhering to precision-beekeeping sensor constraints (Step 2).
    
    Steps:
    1. Duplicate removal (without silent loss).
    2. Missing value handling (retaining ground-truth context).
    3. Type casting for numerical and timestamp fields.
    4. Chronological sorting by hive_id and timestamp.
    5. Sensor physical boundary validation (flags anomalies without deletion).
    6. Export data_cleaned.csv.
    """
    df_clean = df.copy()

    # 1. Duplicates
    initial_count = len(df_clean)
    dups = df_clean.duplicated().sum()
    if dups > 0:
        df_clean = df_clean.drop_duplicates()
        print(f"[CLEANING] Removed {dups} duplicate rows.")
    else:
        print("[CLEANING] Checked duplicates: 0 duplicates found.")

    # 2. Missing value handling
    # In synthetic dataset, 'disease_or_event' is NaN for Healthy colonies
    if "disease_or_event" in df_clean.columns:
        df_clean["disease_or_event"] = df_clean["disease_or_event"].fillna("None")

    # 3. Timestamp conversion
    if "timestamp" in df_clean.columns:
        df_clean["timestamp"] = pd.to_datetime(df_clean["timestamp"])

    # 4. Numerical conversions
    numeric_cols = [
        "temperature_C",
        "humidity_percent",
        "weight_kg",
        "outside_temperature_C",
        "temp_minus_outside_C",
        "weight_change_from_start_kg",
    ]
    for col in numeric_cols:
        if col in df_clean.columns:
            df_clean[col] = pd.to_numeric(df_clean[col], errors="coerce")

    # 5. Chronological sorting
    if "hive_id" in df_clean.columns and "timestamp" in df_clean.columns:
        df_clean = df_clean.sort_values(by=["hive_id", "timestamp"]).reset_index(drop=True)
        print("[CLEANING] Successfully sorted dataset chronologically by hive_id and timestamp.")

    # 6. Physical sensor boundary validation
    # Flags out-of-range records without deleting them
    temp_invalid = (df_clean["temperature_C"] < SENSOR_BOUNDS["temperature_C"]["min"]) | (
        df_clean["temperature_C"] > SENSOR_BOUNDS["temperature_C"]["max"]
    )
    hum_invalid = (df_clean["humidity_percent"] < SENSOR_BOUNDS["humidity_percent"]["min"]) | (
        df_clean["humidity_percent"] > SENSOR_BOUNDS["humidity_percent"]["max"]
    )
    weight_invalid = df_clean["weight_kg"] <= 0.0

    df_clean["sensor_range_violation"] = (temp_invalid | hum_invalid | weight_invalid).astype(int)

    violations_count = int(df_clean["sensor_range_violation"].sum())
    print(f"[CLEANING] Sensor boundary check complete. Impossible sensor readings flagged: {violations_count}")
    print(f"  - Temperature (<0 or >60 °C): {int(temp_invalid.sum())}")
    print(f"  - Humidity (<0 or >100 %): {int(hum_invalid.sum())}")
    print(f"  - Weight (<= 0 kg): {int(weight_invalid.sum())}")

    # 7. Save cleaned data
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_clean.to_csv(output_path, index=False)
    print(f"[CLEANING] Cleaned data saved successfully to: {output_path}")

    return df_clean


if __name__ == "__main__":
    raw_df = load_data()
    rep_text, rep_dict = generate_preprocessing_report(raw_df)
    print(rep_text)
    clean_df = clean_data(raw_df)
    print(f"Cleaned DataFrame Shape: {clean_df.shape}")
