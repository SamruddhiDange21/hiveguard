"""Context-Aware Temporal Baseline Subsystem for HIVEGUARD.

Computes:
1. Diurnal (hour-of-day) expectations and median baseline
2. Rolling median & Median Absolute Deviation (MAD) robust deviation scores
3. Management event masking (apiary visits, inspections, honey supers)
4. Thermal coupling with ambient outside weather (where available)
"""
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
VISITS_CSV = PROJECT_ROOT / "data" / "processed" / "mspb" / "mspb_visits_manipulations.csv"


def load_management_events() -> pd.DataFrame:
    """Load documented apiary visits and management event timestamps."""
    if VISITS_CSV.exists():
        try:
            df = pd.read_csv(VISITS_CSV)
            df["visit_date"] = pd.to_datetime(df["visit_date"]).dt.date
            return df
        except Exception:
            return pd.DataFrame()
    return pd.DataFrame()


def compute_diurnal_profiles(
    df: pd.DataFrame,
    channel: str = "temperature_C",
    hive_col: str = "hive_id",
) -> dict:
    """Compute hourly historical median and MAD expectations per hive."""
    df_calc = df.copy()
    if "timestamp" in df_calc.columns:
        df_calc["timestamp"] = pd.to_datetime(df_calc["timestamp"])
        df_calc["hour"] = df_calc["timestamp"].dt.hour
    else:
        df_calc["hour"] = 12

    profiles = {}
    hives = df_calc[hive_col].unique() if hive_col in df_calc.columns else ["ALL"]

    for h in hives:
        h_sub = df_calc[df_calc[hive_col] == h] if hive_col in df_calc.columns else df_calc
        hourly_stats = {}
        for hr in range(24):
            hr_vals = h_sub[h_sub["hour"] == hr][channel].dropna()
            if len(hr_vals) >= 3:
                med = float(hr_vals.median())
                mad = float((hr_vals - med).abs().median())
                hourly_stats[hr] = {
                    "median": round(med, 2),
                    "mad": round(max(mad, 0.15), 2),
                    "count": len(hr_vals),
                }
            else:
                # Fallback to overall channel stats
                overall_med = float(h_sub[channel].median()) if len(h_sub[channel].dropna()) > 0 else 34.4
                hourly_stats[hr] = {"median": round(overall_med, 2), "mad": 0.5, "count": len(hr_vals)}
        profiles[str(h)] = hourly_stats

    return profiles


def compute_contextual_baselines(
    df: pd.DataFrame,
    channels: list[str] = None,
    rolling_window: int = 24,  # e.g., 24 steps @ 15 min = 6 hours
) -> pd.DataFrame:
    """Compute context-aware expected baselines, robust residuals, and visit event flags.
    
    Generates for each channel:
    - {ch}_expected_baseline: Hour-conditioned expected median
    - {ch}_rolling_median: Rolling median (backward-looking)
    - {ch}_robust_zscore: Normalized deviation via MAD
    - is_management_event: Boolean indicating if within an inspection/manipulation window
    """
    df_out = df.copy()
    if "timestamp" in df_out.columns:
        df_out["timestamp"] = pd.to_datetime(df_out["timestamp"])
        df_out = df_out.sort_values(by=["hive_id", "timestamp"] if "hive_id" in df_out.columns else ["timestamp"]).reset_index(drop=True)
        df_out["hour"] = df_out["timestamp"].dt.hour
        df_out["date"] = df_out["timestamp"].dt.date
    else:
        df_out["hour"] = 12
        df_out["date"] = None

    if channels is None:
        channels = [c for c in ["temperature_C", "humidity_percent", "hive_power", "audio_density", "weight_kg"] if c in df_out.columns]

    # 1. Management event matching
    visits_df = load_management_events()
    if not visits_df.empty and "date" in df_out.columns:
        visit_dates = set(visits_df["visit_date"].tolist())
        df_out["is_management_event"] = df_out["date"].isin(visit_dates)
    else:
        df_out["is_management_event"] = False

    # 2. For each channel, compute rolling & diurnal contextual metrics
    for ch in channels:
        if ch not in df_out.columns:
            continue

        profiles = compute_diurnal_profiles(df_out, channel=ch, hive_col="hive_id")
        
        expected_diurnal = []
        for _, row in df_out.iterrows():
            h_id = str(row.get("hive_id", "ALL"))
            hr = int(row.get("hour", 12))
            prof = profiles.get(h_id, profiles.get("ALL", {}))
            med_val = prof.get(hr, {}).get("median", float(df_out[ch].median()))
            expected_diurnal.append(med_val)

        df_out[f"{ch}_expected_diurnal"] = expected_diurnal

        # Rolling median & MAD strictly within each hive
        if "hive_id" in df_out.columns:
            roll_med = df_out.groupby("hive_id")[ch].rolling(window=rolling_window, min_periods=3).median().values
        else:
            roll_med = df_out[ch].rolling(window=rolling_window, min_periods=3).median().values

        df_out[f"{ch}_rolling_median"] = pd.Series(roll_med).fillna(df_out[f"{ch}_expected_diurnal"]).values

        # Contextual Residual: difference from diurnal expected baseline
        df_out[f"{ch}_context_residual"] = np.round(df_out[ch] - df_out[f"{ch}_expected_diurnal"], 2)

        # Robust Z-Score: (x - rolling_median) / (1.4826 * rolling_mad)
        abs_diff = (df_out[ch] - df_out[f"{ch}_rolling_median"]).abs()
        if "hive_id" in df_out.columns:
            roll_mad = abs_diff.groupby(df_out["hive_id"]).rolling(window=rolling_window, min_periods=3).median().values
        else:
            roll_mad = abs_diff.rolling(window=rolling_window, min_periods=3).median().values

        roll_mad = np.maximum(pd.Series(roll_mad).fillna(0.3).values, 0.15)
        robust_z = (df_out[ch] - df_out[f"{ch}_rolling_median"]) / (1.4826 * roll_mad)
        df_out[f"{ch}_robust_zscore"] = np.round(robust_z.fillna(0.0), 2)

    # 3. Ambient Thermal Coupling (if outside_temperature_C is present)
    if "temperature_C" in df_out.columns and "outside_temperature_C" in df_out.columns:
        df_out["thermal_delta_C"] = np.round(df_out["temperature_C"] - df_out["outside_temperature_C"], 2)

    return df_out
