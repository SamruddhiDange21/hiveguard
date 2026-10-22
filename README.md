# 🐝 HIVEGUARD: Intelligent Honeybee Colony Monitoring & Anomaly Detection

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-green.svg)](https://flask.palletsprojects.com/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.3+-orange.svg)](https://scikit-learn.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.0+-red.svg)](https://xgboost.readthedocs.io/)
[![Chart.js](https://img.shields.io/badge/Chart.js-4.0+-ff6384.svg)](https://www.chartjs.org/)

> **⚠️ MANDATORY SCIENTIFIC & VETERINARY DISCLAIMER**  
> *"This prototype uses synthetic data for algorithm development. The predicted conditions are risk/anomaly categories and are not veterinary diagnoses. Real-world deployment requires validation using real Apis cerana indica colony data with verified health/event labels."*

---

## 📋 Table of Contents
1. [Project Overview](#-project-overview)
2. [Project Architecture](#-project-architecture)
3. [API Endpoints](#-api-endpoints)
4. [Frontend Dashboard](#-frontend-dashboard)
5. [Machine Learning Pipeline](#-machine-learning-pipeline)
6. [Anomaly Scoring & Risk Hierarchy](#-anomaly-scoring--risk-hierarchy)
7. [How to Run the Application](#-how-to-run-the-application)

---

## 🔬 Project Overview

**HIVEGUARD** is a precision-beekeeping telemetry and machine learning system engineered to detect physiological anomalies and environmental stress in honeybee colonies (*Apis cerana indica*).

Honeybee colonies actively thermoregulate their brood nest within a narrow thermal band ($33.5^\circ\text{C} - 35.5^\circ\text{C}$) and maintain humidity between $50\% - 65\%$. Disruptions to this equilibrium serve as early indicators of:
- **Colony Stress** (Thermal regulation failure, foraging depression, microclimate breakdown)
- **Swarming Risk** (Acute biomass departure, abrupt weight shift)
- **Varroa Risk** (Progressive microclimate decline and brood depression)
- **Sensor Hardware Malfunctions** (Isolated unphysical sensor spikes)

---

## 🏗️ Project Architecture

```text
HIVEGUARD/
│
├── data/
│   ├── HIVEGUARD_ML_Bee_Disease_Synthetic_10000.csv    # Raw synthetic dataset
│   └── data_cleaned.csv                                # Cleaned dataset artifact
│
├── models/
│   └── best_bee_anomaly_model.pkl                      # Serialized Random Forest bundle
│
├── src/
│   ├── __init__.py
│   ├── config.py                                       # Constants, baselines, risk maps
│   ├── preprocessing.py                                # Data ingestion and cleaning
│   ├── feature_engineering.py                          # Time-series features & split
│   ├── anomaly_explanation.py                          # Scoring, risk logic & XAI
│   ├── train_model.py                                  # Model training & benchmarking
│   └── predict.py                                      # Single-hive & batch inference service
│
├── backend/
│   └── app.py                                          # Flask REST API server
│
├── frontend/
│   ├── index.html                                      # HTML5 IoT Dashboard
│   ├── style.css                                       # Modern responsive CSS3
│   └── script.js                                       # Vanilla JavaScript & Chart.js
│
├── notebooks/
│   └── 01_bee_anomaly_ml.ipynb                         # 16-section Jupyter notebook
│
├── requirements.txt                                    # Project dependencies
└── README.md                                           # Documentation
```

---

## 🔌 API Endpoints

The Flask backend serves both REST API endpoints and static frontend assets:

### 1. `GET /api/hives`
Returns all unique monitored colony IDs:
```json
{
  "hives": [
    "APIS_CERANA_INDIA_01",
    "APIS_CERANA_INDIA_02"
  ]
}
```

### 2. `GET /api/hive/<hive_id>`
Returns chronological sensor readings and condition states for the specified hive.

### 3. `GET /api/latest/<hive_id>`
Returns the most recent sensor values and model inference for a colony:
```json
{
  "hive_id": "APIS_CERANA_INDIA_01",
  "temperature": 34.5,
  "humidity": 58.2,
  "weight": 38.4,
  "outside_temperature": 29.1,
  "condition": "Healthy",
  "risk_level": "NORMAL",
  "confidence": 0.94,
  "anomaly_score": 12.0,
  "explanation": "Normal Status: All core parameters are within expected physiological baselines."
}
```

### 4. `POST /api/predict`
Accepts live or manual sensor inputs and evaluates them using the trained Random Forest model:
```json
// Request Body
{
  "temperature": 34.5,
  "humidity": 58.2,
  "weight": 38.4,
  "outside_temperature": 29.1
}

// Response
{
  "predicted_condition": "Healthy",
  "risk_level": "NORMAL",
  "confidence": 0.99,
  "anomaly_score": 7.3,
  "explanation": "Normal Status: All core parameters are within expected physiological baselines."
}
```

### 5. `GET /api/model-insights`
Returns benchmark performance metrics (Accuracy, Precision, Recall, Macro F1) and ranked Gini feature importances.

---

## 💻 Frontend Dashboard

Built entirely with **HTML5, CSS3, Vanilla JavaScript, and Chart.js** (no frameworks):
- **Top 4 Sensor Cards**: Real-time Temperature (°C), Humidity (%), Gross Weight (kg), and Ambient Temperature (°C).
- **Hive Health Status Card**: Visual condition badge, risk severity, confidence meter, and 0–100 anomaly progress bar.
- **Current Anomaly Analysis Card**: Plain-language, factual explanations derived from empirical sensor deviations.
- **Interactive Charts (Chart.js)**: Temperature trajectory vs ambient, relative humidity trajectory, and gross weight dynamics.
- **Anomaly Timeline**: Chronological event log with visual severity tags.
- **Hive Comparison View**: Side-by-side comparison of any two monitored colonies.
- **Model Insights Section**: Accuracy, Precision, Recall, Macro F1, and horizontal feature importance bar chart.
- **Live Sensor Simulator**: Interactive sliders and automated sequential live simulation with blinking `LIVE ●` indicator.

---

## 📊 Machine Learning Pipeline

- **Best Model**: **Random Forest Classifier** (`Macro F1 = 0.9990`, `Accuracy = 99.9%`).
- **Data Leakage Prevention**: Ground-truth target labels are quarantined. A strict time-aware chronological split within each monitored hive (first 80% train, last 20% test) is enforced.
- **Top Predictive Features**:
  1. `temperature_rolling_mean` (0.2200)
  2. `temperature_C` (0.1870)
  3. `humidity_rolling_mean` (0.1371)
  4. `weight_rolling_mean` (0.1083)
  5. `weight_kg` (0.1055)

---

## 🚀 How to Run the Application

### 1. Create Virtual Environment
```bash
python3 -m venv venv
```

### 2. Activate Environment
- **Mac / Linux:**
  ```bash
  source venv/bin/activate
  ```
- **Windows:**
  ```cmd
  venv\Scripts\activate
  ```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Start the Flask Backend Server
```bash
python backend/app.py
```

### 5. Open the Dashboard in your Browser
Navigate to:
```
http://localhost:5000
```
