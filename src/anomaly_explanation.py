"""Anomaly definition reference, risk mapping, anomaly scoring, and explainable AI module."""
import sys
from pathlib import Path
import numpy as np

# Ensure src can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.config import (
    HEALTHY_BASELINES,
    RISK_LEVEL_MAPPING,
    CONDITION_SEVERITY_WEIGHTS,
    ANOMALY_SCORE_BANDS,
    MANDATORY_DISCLAIMER,
)

# Reference definitions for Hive Condition Interpretation (Step 11)
HIVE_ANOMALY_DEFINITIONS = {
    "Healthy": {
        "title": "Healthy / Thermoregulating Colony",
        "typical_pattern": (
            "Stable brood-nest temperature (typically 33.5°C - 35.5°C), "
            "stable internal relative humidity (52% - 62%), "
            "gradual seasonal weight trajectory, and steady diurnal cycles."
        ),
        "interpretation": "Colony exhibits normal autonomous thermoregulation and stable biomass.",
        "action_recommendation": "Routine monitoring; no intervention required.",
    },
    "Colony_Stress": {
        "title": "Colony Stress (Environmental / Thermal Deviation)",
        "typical_pattern": (
            "Internal temperature deviates below or above learned baseline, "
            "humidity becomes persistently elevated (>65%), weight gradually declines, "
            "and multiple environmental parameters deviate synchronously."
        ),
        "interpretation": "Possible colony/environmental stress indicating reduced thermoregulatory capacity or food scarcity.",
        "action_recommendation": "Perform physical hive inspection; verify ventilation, food reserves, and queen status.",
    },
    "Swarming_Risk": {
        "title": "Swarming Risk (Rapid Biomass Loss Pattern)",
        "typical_pattern": (
            "Rapid step decrease in hive weight over short observation periods, "
            "accompanied by temporary temperature fluctuations or ventilation disruption."
        ),
        "interpretation": "Possible swarming-related anomaly or preparation for colony division.",
        "action_recommendation": "Inspect brood chamber for swarm cells; assess congestion and provide space or split hive.",
    },
    "Varroa_Risk": {
        "title": "Varroa Risk (Gradual Health Decline Pattern)",
        "typical_pattern": (
            "Persistent moderate depression in brood temperature, elevated humidity, "
            "and progressive weight decline spanning multiple observation cycles."
        ),
        "interpretation": "Possible health-risk pattern requiring inspection. (Note: sensor trends suggest colony weakening, not microscopic confirmation).",
        "action_recommendation": "Conduct sticky-board mite wash or alcohol count to verify infestation level before any treatment.",
    },
    "Sensor_Anomaly": {
        "title": "Sensor Anomaly / Hardware Fault",
        "typical_pattern": (
            "Sudden impossible or extreme jump in a single parameter (e.g. temperature > 40°C) "
            "while other sensor parameters remain completely stable."
        ),
        "interpretation": "Possible sensor malfunction, wire disruption, or measurement error.",
        "action_recommendation": "Inspect sensor probe placement, wiring, battery voltage, and recalibrate hardware.",
    },
}


def calculate_anomaly_score(
    prediction_probs: dict,
    current_sensors: dict,
    baselines: dict = HEALTHY_BASELINES,
) -> float:
    """Calculate normalized composite anomaly score from 0 to 100 (Step 13).
    
    Formula components:
    1. Model Probability Risk (P_risk):
       Sum of predicted class probabilities multiplied by condition severity weights.
       Healthy weight is ~0.05, while severe stress/anomaly weights are 0.85 - 0.95.
    
    2. Physical Sensor Deviation (Z_dev):
       Standardized z-score deviations of current measurements relative to healthy learned baselines:
       Z_T = |T - mu_T| / sigma_T
       Z_H = |H - mu_H| / sigma_H
       Z_W = |delta_W - mu_dW| / sigma_dW
       Averaged and normalized into a 0-100 range.
       
    3. Composite Score:
       Anomaly Score = 0.70 * (P_risk * 100) + 0.30 * (Z_dev_norm)
       Hard bounds: extreme temperature (>41°C) or sensor failure forces score >= 85.
    """
    # 1. Probability component
    p_risk = 0.0
    for cond, prob in prediction_probs.items():
        weight = CONDITION_SEVERITY_WEIGHTS.get(cond, 0.5)
        p_risk += prob * weight

    # 2. Sensor deviation component
    temp = current_sensors.get("temperature_C", baselines["temperature_C"]["mean"])
    hum = current_sensors.get("humidity_percent", baselines["humidity_percent"]["mean"])
    wt_chg = current_sensors.get("weight_change_from_start_kg", baselines["weight_change_from_start_kg"]["mean"])

    z_temp = abs(temp - baselines["temperature_C"]["mean"]) / max(0.1, baselines["temperature_C"]["std"])
    z_hum = abs(hum - baselines["humidity_percent"]["mean"]) / max(0.1, baselines["humidity_percent"]["std"])
    z_wt = abs(wt_chg - baselines["weight_change_from_start_kg"]["mean"]) / max(0.05, baselines["weight_change_from_start_kg"]["std"])

    # Cap individual z-scores at 4.0 for normalization
    z_avg = (min(4.0, z_temp) + min(4.0, z_hum) + min(4.0, z_wt)) / 3.0
    z_dev_norm = (z_avg / 4.0) * 100.0

    # Composite blend
    raw_score = 0.70 * (p_risk * 100.0) + 0.30 * z_dev_norm

    # If predicted healthy with high confidence, ensure score stays strictly in normal band (0-20)
    if prediction_probs.get("Healthy", 0.0) > 0.85 and temp <= 36.0 and temp >= 33.0:
        raw_score = min(20.0, raw_score)

    # If temperature is physically extreme (>40°C), ensure score reaches critical band
    if temp >= 40.0:
        raw_score = max(85.0, raw_score)

    return float(np.clip(round(raw_score, 1), 0.0, 100.0))


def get_anomaly_score_band(score: float) -> dict:
    """Map numeric 0-100 anomaly score to qualitative interpretation band."""
    for band in ANOMALY_SCORE_BANDS:
        low, high = band["range"]
        if low <= score <= high:
            return band
    return ANOMALY_SCORE_BANDS[-1]


def map_risk_level(predicted_condition: str, confidence: float, anomaly_score: float) -> str:
    """Convert model prediction into beekeeper-friendly risk level (Step 9)."""
    base_risk = RISK_LEVEL_MAPPING.get(predicted_condition, "LOW RISK")

    # If swarming risk has very high confidence and high anomaly score, escalate to HIGH RISK
    if predicted_condition == "Swarming_Risk" and (confidence > 0.80 or anomaly_score > 60):
        return "HIGH RISK"

    # Extreme score escalation
    if anomaly_score >= 85.0 and base_risk not in ["CRITICAL", "HIGH RISK"]:
        return "HIGH RISK"

    return base_risk


def explain_anomaly(
    predicted_condition: str,
    risk_level: str,
    sensors: dict,
    confidence: float,
    anomaly_score: float,
) -> str:
    """Generate human-readable, domain-grounded explanations for beekeepers (Step 10).
    
    Synthesizes sensor physical deviations without making unverified biological claims.
    """
    temp = sensors.get("temperature_C", 34.4)
    hum = sensors.get("humidity_percent", 58.0)
    wt = sensors.get("weight_kg", 36.0)
    wt_chg = sensors.get("weight_change_from_start_kg", 0.0)
    temp_diff = sensors.get("temp_minus_outside_C", 10.0)

    # Sensor flags
    temp_extreme_high = temp >= 40.0
    temp_high = temp > 36.0 and not temp_extreme_high
    temp_low = temp < 33.0
    hum_high = hum > 64.0
    hum_low = hum < 50.0
    wt_rapid_drop = wt_chg <= -0.5
    wt_severe_drop = wt_chg <= -1.2
    temp_diff_low = temp_diff < 3.0

    if predicted_condition == "Healthy":
        return (
            f"Normal Status (Confidence {confidence*100:.1f}%, Score {anomaly_score}): "
            f"All core hive parameters are within expected physiological baselines. "
            f"Internal temperature ({temp:.1f}°C) is well-regulated, humidity ({hum:.1f}%) is stable, "
            f"and hive weight ({wt:.1f} kg) shows normal gradual dynamics."
        )

    if predicted_condition == "Sensor_Anomaly":
        if temp_extreme_high:
            return (
                f"Critical Sensor Alert (Score {anomaly_score}): Temperature spiked sharply to {temp:.1f}°C "
                f"while hive weight ({wt:.1f} kg) and humidity ({hum:.1f}%) remained stable. "
                f"This single-sensor spike indicates a probable hardware probe malfunction or wiring fault."
            )
        return (
            f"Possible Sensor Anomaly (Score {anomaly_score}): One measurement parameter showed an isolated, "
            f"abrupt transition without corresponding biological responses across adjacent sensors. "
            f"Hardware verification recommended."
        )

    if predicted_condition == "Swarming_Risk":
        drop_desc = f"rapid weight change of {wt_chg:+.2f} kg" if abs(wt_chg) > 0.05 else "acute biomass shift"
        return (
            f"{risk_level}: Hive exhibits a {drop_desc} combined with active thermal modulation "
            f"(temp {temp:.1f}°C, humidity {hum:.1f}%). "
            f"Pattern aligns with sudden colony departure or swarming activity."
        )

    if predicted_condition == "Colony_Stress":
        reasons = []
        if temp_low:
            reasons.append(f"internal temperature is below learned baseline ({temp:.1f}°C vs 34.4°C normal)")
        elif temp_high:
            reasons.append(f"internal temperature is elevated ({temp:.1f}°C)")
        if hum_high:
            reasons.append(f"humidity is elevated ({hum:.1f}%)")
        if wt_severe_drop:
            reasons.append(f"hive weight has significantly declined ({wt_chg:+.2f} kg)")
        if temp_diff_low:
            reasons.append(f"hive-to-ambient thermal differential has collapsed ({temp_diff:+.1f}°C)")

        detail_str = "; ".join(reasons) if reasons else "multiple parameters deviating jointly"
        return (
            f"High Risk: Multiple colony parameters are deviating simultaneously — {detail_str}. "
            f"Indicates reduced autonomous thermoregulation and environmental colony stress."
        )

    if predicted_condition == "Varroa_Risk":
        reasons = []
        if temp_low:
            reasons.append(f"sub-optimal brood thermoregulation ({temp:.1f}°C)")
        if hum_high:
            reasons.append(f"elevated humidity ({hum:.1f}%)")
        if wt_rapid_drop or wt_severe_drop:
            reasons.append(f"steady weight attrition ({wt_chg:+.2f} kg)")

        detail_str = "; ".join(reasons) if reasons else "brood-nest microclimate depression"
        return (
            f"High Risk: Persistent chronic deviation observed — {detail_str}. "
            f"This gradual multi-sensor decline matches the prototype pattern for colony health vulnerability "
            f"(Varroa risk). Physical sticky board count recommended."
        )

    return f"{risk_level}: Parameter anomaly detected (score {anomaly_score}). Inspection suggested."
