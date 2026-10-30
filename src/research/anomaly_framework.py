"""Core Anomaly Detection Framework for HIVEGUARD.

Implements and benchmarks:
Method A: Fixed-Threshold Baseline
Method B: Standard Statistical Rolling Anomaly Detection (MAD / Robust Z)
Method C: Proposed HIVEGUARD Context-Aware, Reliability-Aware, and Persistence-Aware Framework
"""
from dataclasses import dataclass
import numpy as np
import pandas as pd

from src.research.sensor_reliability import evaluate_dataset_reliability
from src.research.context_baseline import compute_contextual_baselines


@dataclass
class AnomalyDetectionResult:
    method_name: str
    anomaly_flags: np.ndarray
    anomaly_scores: np.ndarray  # 0 to 100
    detected_intervals: list[dict]
    reliability_scores: np.ndarray
    explanations: list[str]
    parameters: dict


def run_method_a_fixed_thresholds(
    df: pd.DataFrame,
    temp_min: float = 32.0,
    temp_max: float = 36.0,
    hum_min: float = 45.0,
    hum_max: float = 70.0,
) -> pd.DataFrame:
    """Method A: Fixed static threshold baseline."""
    df_out = df.copy()
    n = len(df_out)

    has_temp = "temperature_C" in df_out.columns
    has_hum = "humidity_percent" in df_out.columns

    temp_breach = np.zeros(n, dtype=bool)
    hum_breach = np.zeros(n, dtype=bool)

    if has_temp:
        temp_vals = df_out["temperature_C"].fillna(34.4).values
        temp_breach = (temp_vals < temp_min) | (temp_vals > temp_max)

    if has_hum:
        hum_vals = df_out["humidity_percent"].fillna(58.0).values
        hum_breach = (hum_vals < hum_min) | (hum_vals > hum_max)

    flags = temp_breach | hum_breach
    # Score 0 or 80 on breach
    scores = np.where(flags, 80.0, 5.0)

    df_out["method_a_flag"] = flags
    df_out["method_a_score"] = scores
    return df_out


def run_method_b_statistical_rolling(
    df: pd.DataFrame,
    z_threshold: float = 2.5,
    rolling_window: int = 24,
) -> pd.DataFrame:
    """Method B: Statistical anomaly detection using rolling robust z-score (MAD)."""
    df_out = compute_contextual_baselines(df, rolling_window=rolling_window)
    n = len(df_out)

    z_temp = np.zeros(n, dtype=float)
    z_hum = np.zeros(n, dtype=float)

    if "temperature_C_robust_zscore" in df_out.columns:
        z_temp = df_out["temperature_C_robust_zscore"].fillna(0.0).values
    if "humidity_percent_robust_zscore" in df_out.columns:
        z_hum = df_out["humidity_percent_robust_zscore"].fillna(0.0).values

    max_z = np.maximum(np.abs(z_temp), np.abs(z_hum))
    flags = max_z > z_threshold

    # Normalize max_z into 0-100 score
    scores = np.clip((max_z / 4.0) * 100.0, 0.0, 100.0)

    df_out["method_b_flag"] = flags
    df_out["method_b_score"] = np.round(scores, 1)
    return df_out


def run_method_c_proposed_framework(
    df: pd.DataFrame,
    z_threshold: float = 2.2,
    persistence_steps: int = 4,  # e.g., 4 steps * 15 min = 1 hour minimum persistence
    rolling_window: int = 24,
) -> pd.DataFrame:
    """Method C: Proposed HIVEGUARD Context-Aware, Reliability-Aware & Persistence-Aware Framework.
    
    Formula:
    Score(t) = D_context(t) * Persistence(t) * Agreement(t) * Reliability(t)
    """
    # 1. Reliability Assessment
    df_rel, rel_info = evaluate_dataset_reliability(df)

    # 2. Context-Aware Baseline computation
    df_ctx = compute_contextual_baselines(df_rel, rolling_window=rolling_window)
    n = len(df_ctx)

    # 3. Contextual Deviations
    z_t = df_ctx.get("temperature_C_robust_zscore", pd.Series(np.zeros(n))).fillna(0.0).values
    z_h = df_ctx.get("humidity_percent_robust_zscore", pd.Series(np.zeros(n))).fillna(0.0).values
    rel = df_ctx.get("overall_sensor_reliability", pd.Series(np.ones(n))).fillna(1.0).values
    is_mgmt = df_ctx.get("is_management_event", pd.Series(np.zeros(n, dtype=bool))).values

    # Sensor channel agreement
    abs_zt = np.abs(z_t)
    abs_zh = np.abs(z_h)
    
    # Agreement: 1.0 if both deviate, 0.75 if temperature deviates strongly, 0.50 if only humidity
    agreement = np.where(
        (abs_zt > z_threshold) & (abs_zh > 1.8), 1.0,
        np.where(abs_zt > z_threshold, 0.85,
                 np.where(abs_zh > z_threshold, 0.50, 0.10))
    )

    # Raw anomaly candidate
    candidate_anomaly = (abs_zt > z_threshold) | (abs_zh > (z_threshold + 0.5))

    # 4. Persistence tracking (consecutive anomalous steps)
    persistence = np.zeros(n, dtype=float)
    consecutive = 0
    for i in range(n):
        if candidate_anomaly[i]:
            consecutive += 1
            persistence[i] = min(1.0, consecutive / float(persistence_steps))
        else:
            consecutive = max(0, consecutive - 1)
            persistence[i] = min(1.0, consecutive / float(persistence_steps))

    # 5. Composite Anomaly Score (0 - 100)
    # Scaled deviation
    max_dev = np.maximum(abs_zt, abs_zh * 0.7)
    base_severity = np.clip(max_dev / 3.5, 0.0, 1.0)

    # Attenuate if management event
    mgmt_attenuation = np.where(is_mgmt, 0.35, 1.0)

    raw_score = base_severity * persistence * agreement * rel * mgmt_attenuation * 100.0

    # Any hardware fault detected by reliability subsystem
    has_hw_fault = np.zeros(n, dtype=bool)
    for col in df_ctx.columns:
        if col.endswith("_is_spike") or col.endswith("_is_stuck") or col.endswith("_is_out_of_bounds") or col.endswith("_is_missing"):
            has_hw_fault = has_hw_fault | df_ctx[col].values

    # Categorization
    categories = []
    alert_flags = []
    bio_flags = []
    fault_flags = []
    explanations = []

    for i in range(n):
        r_val = rel[i]
        sc = raw_score[i]
        is_m = is_mgmt[i]
        hw_fault = has_hw_fault[i]

        if hw_fault or r_val < 0.50:
            categories.append("SENSOR_RELIABILITY_WARNING")
            alert_flags.append(True)
            bio_flags.append(False)
            fault_flags.append(True)
            explanations.append(f"Sensor probe data quality fault detected (reliability {int(r_val*100)}%). Hardware check required.")
        elif is_m and candidate_anomaly[i]:
            categories.append("MANAGEMENT_EVENT_ATTENUATED")
            alert_flags.append(False)
            bio_flags.append(False)
            fault_flags.append(False)
            explanations.append("Microclimate variation coincides with documented apiary management/inspection window.")
        elif sc >= 50.0:
            categories.append("PERSISTENT_BIOLOGICAL_ANOMALY")
            alert_flags.append(True)
            bio_flags.append(True)
            fault_flags.append(False)
            explanations.append(f"Persistent microclimate deviation ({persistence[i]*100:.0f}% persistence, Z_T={z_t[i]:.1f}, Z_H={z_h[i]:.1f}). Inspection recommended.")
        elif sc >= 25.0:
            categories.append("ENVIRONMENTAL_DEVIATION")
            alert_flags.append(False)
            bio_flags.append(False)
            fault_flags.append(False)
            explanations.append(f"Mild transient deviation (Z_T={z_t[i]:.1f}); colony maintains baseline homeostatic bounds.")
        else:
            categories.append("NORMAL")
            alert_flags.append(False)
            bio_flags.append(False)
            fault_flags.append(False)
            explanations.append("Sensor telemetry within learned homeostatic diurnal baseline.")

    df_ctx["method_c_flag"] = alert_flags
    df_ctx["method_c_biological_flag"] = bio_flags
    df_ctx["method_c_sensor_fault_flag"] = fault_flags
    df_ctx["method_c_score"] = np.round(raw_score, 1)
    df_ctx["method_c_category"] = categories
    df_ctx["method_c_persistence"] = np.round(persistence, 2)
    df_ctx["method_c_agreement"] = np.round(agreement, 2)
    df_ctx["method_c_explanation"] = explanations

    return df_ctx


def compare_all_methods(
    df: pd.DataFrame,
    hive_id: str = None,
    limit: int = 1500,
) -> tuple[pd.DataFrame, dict]:
    """Execute all 3 methods on dataset or specific hive and compute comparison metrics."""
    df_eval = df.copy()
    if hive_id and "hive_id" in df_eval.columns:
        df_eval = df_eval[df_eval["hive_id"] == hive_id]

    if "timestamp" in df_eval.columns:
        df_eval["timestamp"] = pd.to_datetime(df_eval["timestamp"])
        df_eval = df_eval.sort_values("timestamp")

    if limit and len(df_eval) > limit:
        df_eval = df_eval.iloc[:limit].copy()

    df_a = run_method_a_fixed_thresholds(df_eval)
    df_b = run_method_b_statistical_rolling(df_a)
    df_c = run_method_c_proposed_framework(df_b)

    total = len(df_c)
    summary = {
        "total_timesteps": total,
        "method_a": {
            "name": "Method A: Fixed-Threshold Baseline",
            "anomaly_count": int(df_c["method_a_flag"].sum()),
            "anomaly_rate_pct": round(float(df_c["method_a_flag"].mean() * 100), 2),
            "mean_score": round(float(df_c["method_a_score"].mean()), 1),
        },
        "method_b": {
            "name": "Method B: Rolling Robust Z / MAD",
            "anomaly_count": int(df_c["method_b_flag"].sum()),
            "anomaly_rate_pct": round(float(df_c["method_b_flag"].mean() * 100), 2),
            "mean_score": round(float(df_c["method_b_score"].mean()), 1),
        },
        "method_c": {
            "name": "Method C: Proposed HIVEGUARD Framework",
            "anomaly_count": int(df_c["method_c_flag"].sum()),
            "anomaly_rate_pct": round(float(df_c["method_c_flag"].mean() * 100), 2),
            "mean_score": round(float(df_c["method_c_score"].mean()), 1),
            "categories": df_c["method_c_category"].value_counts().to_dict(),
        },
    }

    return df_c, summary
