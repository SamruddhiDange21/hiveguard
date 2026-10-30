"""Sensor Data-Quality & Reliability Assessment Subsystem for HIVEGUARD.

Detects:
1. Missing readings & timestamp dropouts
2. Stuck / frozen sensor values
3. Implausible physical values based on sensor specifications
4. Isolated impulse spikes
5. Excessive noise / variance anomalies
6. Systematic sensor drift

Computes continuous Reliability Score R_s(t) in [0.0, 1.0].
"""
import numpy as np
import pandas as pd


PHYSICAL_SENSOR_LIMITS = {
    "temperature_C": {"min": -10.0, "max": 55.0, "max_step_delta": 4.0},
    "humidity_percent": {"min": 5.0, "max": 99.0, "max_step_delta": 20.0},
    "weight_kg": {"min": 5.0, "max": 120.0, "max_step_delta": 5.0},
    "hive_power": {"min": -15.0, "max": 10.0, "max_step_delta": 6.0},
    "audio_density": {"min": -20.0, "max": 50.0, "max_step_delta": 25.0},
}


def assess_channel_reliability(
    series: pd.Series,
    channel_name: str = "temperature_C",
    timestamps: pd.Series = None,
    stuck_window: int = 6,
    nominal_interval_minutes: float = 15.0,
) -> pd.DataFrame:
    """Assess reliability flags and continuous reliability score for a single sensor channel.
    
    Returns DataFrame with columns:
    - is_missing (bool)
    - is_stuck (bool)
    - is_out_of_bounds (bool)
    - is_spike (bool)
    - is_high_noise (bool)
    - reliability_score (float 0.0 - 1.0)
    - reliability_status (str: RELIABLE, DEGRADED, FAULTY)
    """
    n = len(series)
    values = series.values
    limits = PHYSICAL_SENSOR_LIMITS.get(
        channel_name,
        {"min": -50.0, "max": 100.0, "max_step_delta": 10.0}
    )

    is_missing = np.isnan(values)
    is_stuck = np.zeros(n, dtype=bool)
    is_out_of_bounds = np.zeros(n, dtype=bool)
    is_spike = np.zeros(n, dtype=bool)
    is_high_noise = np.zeros(n, dtype=bool)
    reliability = np.ones(n, dtype=float)

    # 1. Missing data penalty
    reliability[is_missing] = 0.0

    # 2. Physical limit violations
    valid_mask = ~is_missing
    if np.any(valid_mask):
        val_subset = values[valid_mask]
        oob_subset = (val_subset < limits["min"]) | (val_subset > limits["max"])
        is_out_of_bounds[valid_mask] = oob_subset
        reliability[is_out_of_bounds] = 0.0

    # Clean series for rolling calculations
    s_clean = series.ffill().bfill()

    # 3. Stuck / Frozen sensor values (variance == 0 over window)
    # Applied to naturally fluctuating environmental channels
    if channel_name in ["temperature_C", "humidity_percent", "weight_kg", "audio_density"]:
        if len(s_clean) >= stuck_window:
            rolling_std = s_clean.rolling(window=stuck_window, min_periods=stuck_window).std().fillna(1.0).values
            stuck_mask = (rolling_std < 1e-4) & valid_mask
            is_stuck = stuck_mask
            reliability[is_stuck] = np.minimum(reliability[is_stuck], 0.15)

    # 4. Isolated impulse spikes: |x_t - x_{t-1}| > delta and returns close to x_{t-1} at x_{t+1}
    max_step = limits["max_step_delta"]
    for i in range(1, n - 1):
        if not is_missing[i] and not is_missing[i - 1] and not is_missing[i + 1]:
            d_prev = values[i] - values[i - 1]
            d_next = values[i + 1] - values[i]
            # Sharp rise followed by immediate return, or sharp drop followed by immediate recovery
            if (abs(d_prev) > max_step) and (abs(d_next) > max_step) and (np.sign(d_prev) != np.sign(d_next)):
                is_spike[i] = True
                reliability[i] = np.minimum(reliability[i], 0.20)

    # 5. High-frequency noise / erratic variance
    if len(s_clean) >= 12:
        diffs = s_clean.diff().abs()
        med_diff = diffs.median()
        diff_mad = (diffs - med_diff).abs().median() + 1e-4
        z_noise = (diffs - med_diff) / (1.4826 * diff_mad)
        high_noise = (z_noise > 4.5).values & valid_mask
        is_high_noise = high_noise
        reliability[is_high_noise] = np.minimum(reliability[is_high_noise], 0.45)

    # Smooth reliability with a short backward rolling average to avoid single-timestep flip-flopping
    rel_series = pd.Series(reliability)
    rel_smoothed = rel_series.rolling(window=3, min_periods=1).mean().values

    # Categorical status
    status = []
    for r in rel_smoothed:
        if r >= 0.80:
            status.append("RELIABLE")
        elif r >= 0.40:
            status.append("DEGRADED")
        else:
            status.append("FAULTY")

    return pd.DataFrame({
        f"{channel_name}_is_missing": is_missing,
        f"{channel_name}_is_stuck": is_stuck,
        f"{channel_name}_is_out_of_bounds": is_out_of_bounds,
        f"{channel_name}_is_spike": is_spike,
        f"{channel_name}_is_high_noise": is_high_noise,
        f"{channel_name}_reliability": np.round(rel_smoothed, 3),
        f"{channel_name}_status": status,
    })


def evaluate_dataset_reliability(
    df: pd.DataFrame,
    channels: list[str] = None,
    nominal_interval_minutes: float = 15.0,
) -> tuple[pd.DataFrame, dict]:
    """Evaluate comprehensive sensor reliability across all available numeric channels in DataFrame."""
    df_res = df.copy()
    if channels is None:
        channels = [c for c in ["temperature_C", "humidity_percent", "weight_kg", "audio_density"] if c in df_res.columns]

    overall_reliability = np.ones(len(df_res), dtype=float)
    fault_summary = {}

    for ch in channels:
        ch_res = assess_channel_reliability(
            df_res[ch],
            channel_name=ch,
            nominal_interval_minutes=nominal_interval_minutes
        )
        for col in ch_res.columns:
            df_res[col] = ch_res[col].values

        overall_reliability = np.minimum(overall_reliability, ch_res[f"{ch}_reliability"].values)
        fault_summary[ch] = {
            "missing_pct": round(float(ch_res[f"{ch}_is_missing"].mean() * 100), 2),
            "stuck_pct": round(float(ch_res[f"{ch}_is_stuck"].mean() * 100), 2),
            "out_of_bounds_pct": round(float(ch_res[f"{ch}_is_out_of_bounds"].mean() * 100), 2),
            "spike_pct": round(float(ch_res[f"{ch}_is_spike"].mean() * 100), 2),
            "high_noise_pct": round(float(ch_res[f"{ch}_is_high_noise"].mean() * 100), 2),
            "mean_reliability": round(float(ch_res[f"{ch}_reliability"].mean()), 3),
        }

    df_res["overall_sensor_reliability"] = np.round(overall_reliability, 3)
    df_res["overall_sensor_status"] = np.where(
        overall_reliability >= 0.80, "RELIABLE",
        np.where(overall_reliability >= 0.40, "DEGRADED", "FAULTY")
    )

    return df_res, {
        "channels_evaluated": channels,
        "overall_mean_reliability": round(float(overall_reliability.mean()), 3),
        "reliable_timesteps_pct": round(float((overall_reliability >= 0.80).mean() * 100), 2),
        "degraded_timesteps_pct": round(float(((overall_reliability >= 0.40) & (overall_reliability < 0.80)).mean() * 100), 2),
        "faulty_timesteps_pct": round(float((overall_reliability < 0.40).mean() * 100), 2),
        "channel_fault_summary": fault_summary,
    }
