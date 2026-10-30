"""Evaluation and Benchmarking Engine for HIVEGUARD Research Framework.

Computes:
- Precision, Recall, Macro F1
- False Positives, False Negatives
- False Alarm Rate per 24-hour observation period (FAR/24h)
- Detection Delay (timesteps from event onset to first alarm)
- Confusion Matrix
- Runtime execution latency (ms)
"""
import time
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix

from src.research.anomaly_framework import (
    run_method_a_fixed_thresholds,
    run_method_b_statistical_rolling,
    run_method_c_proposed_framework,
)


def compute_detection_delay(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Calculate average timesteps from ground-truth event onset to first positive detection."""
    delays = []
    in_event = False
    event_start = None

    for i in range(len(y_true)):
        if y_true[i] and not in_event:
            # Onset of ground-truth event
            in_event = True
            event_start = i
            # Look ahead for first detection
            detected_at = None
            for j in range(event_start, len(y_true)):
                if not y_true[j]:
                    break
                if y_pred[j]:
                    detected_at = j
                    break
            if detected_at is not None:
                delays.append(detected_at - event_start)
            else:
                # Missed entirely
                pass
        elif not y_true[i] and in_event:
            in_event = False

    return float(np.mean(delays)) if len(delays) > 0 else 0.0


def evaluate_binary_detections(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    observation_interval_minutes: float = 15.0,
    runtime_ms: float = 0.0,
) -> dict:
    """Compute rigorous classification and operational alarm metrics."""
    y_true_bool = y_true.astype(bool)
    y_pred_bool = y_pred.astype(bool)

    # Check if ground truth has positive cases
    if y_true_bool.sum() == 0:
        return {
            "available": False,
            "message": "Not available — ground truth required.",
            "total_samples": len(y_true),
            "predicted_positive_count": int(y_pred_bool.sum()),
        }

    prec = float(precision_score(y_true_bool, y_pred_bool, zero_division=0))
    rec = float(recall_score(y_true_bool, y_pred_bool, zero_division=0))
    f1 = float(f1_score(y_true_bool, y_pred_bool, zero_division=0))

    cm = confusion_matrix(y_true_bool, y_pred_bool, labels=[False, True])
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

    # False alarm rate per 24 hours: (FP / total_non_event_days)
    total_hours = (len(y_true) * observation_interval_minutes) / 60.0
    total_days = max(total_hours / 24.0, 0.1)
    far_per_24h = float(round(fp / total_days, 2))

    delay_steps = compute_detection_delay(y_true_bool, y_pred_bool)
    delay_minutes = round(delay_steps * observation_interval_minutes, 1)

    return {
        "available": True,
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
        "confusion_matrix": [[tn, fp], [fn, tp]],
        "far_per_24h": far_per_24h,
        "detection_delay_steps": round(delay_steps, 2),
        "detection_delay_minutes": delay_minutes,
        "runtime_ms": round(runtime_ms, 2),
    }


def benchmark_methods_on_simulation(
    sim_df: pd.DataFrame,
    ground_truth_col: str = "injected_ground_truth_fault",
    interval_minutes: float = 15.0,
) -> dict:
    """Benchmark Method A, Method B, and Method C on an identical simulated test series."""
    if ground_truth_col not in sim_df.columns:
        raise ValueError(f"Ground truth column '{ground_truth_col}' not found in simulation dataframe.")

    y_true = sim_df[ground_truth_col].values

    # Method A
    t0 = time.perf_counter()
    df_a = run_method_a_fixed_thresholds(sim_df)
    t1 = time.perf_counter()
    metrics_a = evaluate_binary_detections(y_true, df_a["method_a_flag"].values, interval_minutes, (t1 - t0) * 1000)

    # Method B
    t0 = time.perf_counter()
    df_b = run_method_b_statistical_rolling(sim_df)
    t1 = time.perf_counter()
    metrics_b = evaluate_binary_detections(y_true, df_b["method_b_flag"].values, interval_minutes, (t1 - t0) * 1000)

    # Method C
    t0 = time.perf_counter()
    df_c = run_method_c_proposed_framework(sim_df)
    t1 = time.perf_counter()
    
    if ground_truth_col == "injected_ground_truth_fault" and "method_c_sensor_fault_flag" in df_c.columns:
        pred_c = df_c["method_c_sensor_fault_flag"].values
    elif ground_truth_col == "injected_ground_truth_stress" and "method_c_biological_flag" in df_c.columns:
        pred_c = df_c["method_c_biological_flag"].values
    else:
        pred_c = df_c["method_c_flag"].values

    metrics_c = evaluate_binary_detections(y_true, pred_c, interval_minutes, (t1 - t0) * 1000)

    return {
        "total_test_samples": len(sim_df),
        "ground_truth_positives": int(y_true.sum()),
        "methods": {
            "Method A (Fixed Thresholds)": metrics_a,
            "Method B (Rolling Robust Z / MAD)": metrics_b,
            "Method C (Proposed Framework)": metrics_c,
        }
    }
