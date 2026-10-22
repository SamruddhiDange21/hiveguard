"""Configuration parameters and domain reference settings for HIVEGUARD."""
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
FIGURES_DIR = BASE_DIR / "figures"
NOTEBOOKS_DIR = BASE_DIR / "notebooks"

RAW_DATA_PATH = DATA_DIR / "HIVEGUARD_ML_Bee_Disease_Synthetic_10000.csv"
CLEANED_DATA_PATH = DATA_DIR / "data_cleaned.csv"
BEST_MODEL_PATH = MODELS_DIR / "best_bee_anomaly_model.pkl"

# Physical sensor validation boundaries
SENSOR_BOUNDS = {
    "temperature_C": {"min": 0.0, "max": 60.0},
    "humidity_percent": {"min": 0.0, "max": 100.0},
    "weight_kg": {"min": 0.001, "max": 150.0},
    "outside_temperature_C": {"min": -20.0, "max": 60.0},
}

# Learned baseline parameters for healthy Apis cerana indica colony
HEALTHY_BASELINES = {
    "temperature_C": {"mean": 34.39, "std": 0.62, "ideal_min": 33.0, "ideal_max": 36.0},
    "humidity_percent": {"mean": 58.27, "std": 2.95, "ideal_min": 50.0, "ideal_max": 65.0},
    "weight_change_from_start_kg": {"mean": 0.14, "std": 0.15, "min_expected": -0.5, "max_expected": 0.6},
    "temp_minus_outside_C": {"mean": 8.0, "std": 4.5},
}

# Feature definitions
RAW_FEATURE_COLS = [
    "temperature_C",
    "humidity_percent",
    "weight_kg",
    "outside_temperature_C",
    "temp_minus_outside_C",
    "weight_change_from_start_kg",
]

ENGINEERED_FEATURE_COLS = [
    "temperature_change",
    "humidity_change",
    "weight_change",
    "temperature_rolling_mean",
    "temperature_rolling_std",
    "humidity_rolling_mean",
    "humidity_rolling_std",
    "weight_rolling_mean",
    "weight_rolling_std",
    "hour",
    "day_of_week",
    "month",
]

ALL_FEATURE_COLS = RAW_FEATURE_COLS + ENGINEERED_FEATURE_COLS

# Ground-truth columns that must NEVER be used as model inputs
TARGET_COL = "condition_label"
GROUND_TRUTH_COLS = ["condition_label", "disease_or_event", "anomaly"]

# Target condition classes
CONDITION_CLASSES = [
    "Healthy",
    "Varroa_Risk",
    "Colony_Stress",
    "Swarming_Risk",
    "Sensor_Anomaly",
]

# Configurable Risk Mapping Logic (Step 9)
RISK_LEVEL_MAPPING = {
    "Healthy": "NORMAL",
    "Swarming_Risk": "MEDIUM RISK",
    "Varroa_Risk": "HIGH RISK",
    "Colony_Stress": "HIGH RISK",
    "Sensor_Anomaly": "CRITICAL",
}

# Severity weights used for calculating composite Anomaly Score (0-100)
CONDITION_SEVERITY_WEIGHTS = {
    "Healthy": 0.05,
    "Swarming_Risk": 0.65,
    "Varroa_Risk": 0.85,
    "Colony_Stress": 0.85,
    "Sensor_Anomaly": 0.95,
}

# Anomaly Score Interpretation Bands (Step 13)
ANOMALY_SCORE_BANDS = [
    {"range": (0, 20), "label": "Normal", "color": "#28a745"},
    {"range": (21, 40), "label": "Low", "color": "#17a2b8"},
    {"range": (41, 60), "label": "Moderate", "color": "#ffc107"},
    {"range": (61, 80), "label": "High", "color": "#fd7e14"},
    {"range": (81, 100), "label": "Critical", "color": "#dc3545"},
]

# Mandatory Scientific and Medical/Veterinary Disclaimer
MANDATORY_DISCLAIMER = (
    "This prototype uses synthetic data for algorithm development. "
    "The predicted conditions are risk/anomaly categories and are not "
    "veterinary diagnoses. Real-world deployment requires validation using "
    "real Apis cerana indica colony data with verified health/event labels."
)
