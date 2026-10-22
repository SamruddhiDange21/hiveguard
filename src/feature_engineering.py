"""Feature engineering and temporal train/test split pipeline for HIVEGUARD."""
import sys
from pathlib import Path
import pandas as pd
import numpy as np

# Ensure src can be imported when running script directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.config import (
    CLEANED_DATA_PATH,
    RAW_FEATURE_COLS,
    ENGINEERED_FEATURE_COLS,
    ALL_FEATURE_COLS,
    TARGET_COL,
    GROUND_TRUTH_COLS,
)


def compute_hive_features(df, rolling_window=12):
    """Compute rolling statistics and rate-of-change metrics strictly within each hive.
    
    Adheres strictly to zero future lookahead (backward-looking rolling windows only).
    """
    df_feat = df.copy()

    # Ensure timestamp is datetime and sorted
    if "timestamp" in df_feat.columns:
        df_feat["timestamp"] = pd.to_datetime(df_feat["timestamp"])
    if "hive_id" in df_feat.columns:
        df_feat = df_feat.sort_values(by=["hive_id", "timestamp"]).reset_index(drop=True)

    # 1. Delta features (step-to-step changes within hive)
    df_feat["temperature_change"] = (
        df_feat.groupby("hive_id")["temperature_C"].diff().fillna(0.0)
    )
    df_feat["humidity_change"] = (
        df_feat.groupby("hive_id")["humidity_percent"].diff().fillna(0.0)
    )
    df_feat["weight_change"] = (
        df_feat.groupby("hive_id")["weight_kg"].diff().fillna(0.0)
    )

    # 2. Rolling statistics (backward-looking, min_periods=1 prevents NaN)
    # rolling_window=12 with 30-min sampling corresponds to a 6-hour moving window
    df_feat["temperature_rolling_mean"] = (
        df_feat.groupby("hive_id")["temperature_C"]
        .rolling(window=rolling_window, min_periods=1)
        .mean()
        .values
    )
    df_feat["temperature_rolling_std"] = (
        df_feat.groupby("hive_id")["temperature_C"]
        .rolling(window=rolling_window, min_periods=1)
        .std()
        .fillna(0.0)
        .values
    )

    df_feat["humidity_rolling_mean"] = (
        df_feat.groupby("hive_id")["humidity_percent"]
        .rolling(window=rolling_window, min_periods=1)
        .mean()
        .values
    )
    df_feat["humidity_rolling_std"] = (
        df_feat.groupby("hive_id")["humidity_percent"]
        .rolling(window=rolling_window, min_periods=1)
        .std()
        .fillna(0.0)
        .values
    )

    df_feat["weight_rolling_mean"] = (
        df_feat.groupby("hive_id")["weight_kg"]
        .rolling(window=rolling_window, min_periods=1)
        .mean()
        .values
    )
    df_feat["weight_rolling_std"] = (
        df_feat.groupby("hive_id")["weight_kg"]
        .rolling(window=rolling_window, min_periods=1)
        .std()
        .fillna(0.0)
        .values
    )

    # 3. Cyclical / Calendar temporal features
    df_feat["hour"] = df_feat["timestamp"].dt.hour
    df_feat["day_of_week"] = df_feat["timestamp"].dt.dayofweek
    df_feat["month"] = df_feat["timestamp"].dt.month

    # Recompute temp_minus_outside_C if absent
    if "temp_minus_outside_C" not in df_feat.columns:
        df_feat["temp_minus_outside_C"] = (
            df_feat["temperature_C"] - df_feat["outside_temperature_C"]
        )

    # Recompute weight_change_from_start_kg if absent
    if "weight_change_from_start_kg" not in df_feat.columns:
        first_weights = df_feat.groupby("hive_id")["weight_kg"].transform("first")
        df_feat["weight_change_from_start_kg"] = df_feat["weight_kg"] - first_weights

    return df_feat


def prepare_features_and_target(df):
    """Separate input feature matrix X from ground-truth target y.
    
    Guarantees strict prevention of data leakage:
    - Target columns ('condition_label', 'disease_or_event', 'anomaly') are excluded from X.
    """
    for col in GROUND_TRUTH_COLS:
        if col in ALL_FEATURE_COLS:
            raise ValueError(f"CRITICAL LEAKAGE ERROR: Ground truth column '{col}' found in feature list!")

    X = df[ALL_FEATURE_COLS].copy()
    y = df[TARGET_COL].copy()
    return X, y


def split_data(df, feature_cols=ALL_FEATURE_COLS, target_col=TARGET_COL, split_ratio=0.8):
    """Create a time-aware train/test split within each monitored hive.
    
    Methodology:
    - Sort each hive's observations chronologically.
    - Allocate the first 80% of timestamps to the training set.
    - Allocate the final 20% of timestamps to the evaluation/test set.
    - This reflects true operational precision beekeeping: historical data trains the system,
      and future timepoints are evaluated for anomaly detection.
    """
    train_indices = []
    test_indices = []

    for _, grp in df.groupby("hive_id"):
        grp_sorted = grp.sort_values(by="timestamp")
        n_obs = len(grp_sorted)
        split_idx = int(n_obs * split_ratio)
        train_indices.extend(grp_sorted.index[:split_idx])
        test_indices.extend(grp_sorted.index[split_idx:])

    train_df = df.loc[train_indices].reset_index(drop=True)
    test_df = df.loc[test_indices].reset_index(drop=True)

    X_train = train_df[feature_cols].copy()
    y_train = train_df[target_col].copy()
    X_test = test_df[feature_cols].copy()
    y_test = test_df[target_col].copy()

    split_summary = {
        "total_samples": len(df),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "train_classes": y_train.value_counts().to_dict(),
        "test_classes": y_test.value_counts().to_dict(),
        "features": list(feature_cols),
    }

    return X_train, X_test, y_train, y_test, split_summary


if __name__ == "__main__":
    df = pd.read_csv(CLEANED_DATA_PATH)
    df_feat = compute_hive_features(df)
    X_train, X_test, y_train, y_test, summary = split_data(df_feat)
    print("=== FEATURE ENGINEERING & SPLIT SUMMARY ===")
    print(f"Features Engineered ({len(summary['features'])}): {summary['features']}")
    print(f"Train Shape: {X_train.shape}, Test Shape: {X_test.shape}")
    print(f"Train Class Distribution: {summary['train_classes']}")
    print(f"Test Class Distribution: {summary['test_classes']}")
