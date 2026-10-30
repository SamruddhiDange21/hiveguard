# 🐝 HIVEGUARD: A Context-Aware and Reliability-Aware Framework for Anomaly Detection in Honeybee Hive Monitoring

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Flask 3.0+](https://img.shields.io/badge/Flask-3.0+-green.svg)](https://flask.palletsprojects.com/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.3+-orange.svg)](https://scikit-learn.org/)
[![Dataset: Nature Sci Data (MSPB)](https://img.shields.io/badge/Dataset-MSPB%20(Nature%202024)-007ec6.svg)](https://doi.org/10.1038/s41597-024-03695-1)
[![Zenodo DOI](https://img.shields.io/badge/Zenodo-10.5281%2Fzenodo.8371700-blue.svg)](https://doi.org/10.5281/zenodo.8371700)
[![License: CC-BY-NC-4.0](https://img.shields.io/badge/License-CC--BY--NC--4.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

> **⚠️ SCIENTIFIC, VETERINARY & HARDWARE DISCLAIMER**  
> **1. Decision Support, Not Veterinary Diagnosis:** HIVEGUARD provides automated precision microclimate anomaly detection and sensor reliability assessment. Anomaly scores and risk indicators are decision-support metrics and do not constitute veterinary medical diagnoses.  
> **2. Provenance Transparency:** The system maintains strict segregation between:  
> - **Recorded Public Research Telemetry** (1.83M rows from the peer-reviewed MSPB dataset).  
> - **Controlled Injected Fault Series** (reproducible mathematical simulations for sensor fault benchmarking).  
> - **Synthetic Prototype Demonstrations** (legacy 5-class Gaussian demonstration models).  
> - **Physical Hardware Telemetry** (ESP32/DHT22 bench prototypes pending seasonal field apiary deployment).

---

## 📋 Table of Contents
1. [Research Overview](#-research-overview)
2. [Verified MSPB Research Dataset](#-verified-mspb-research-dataset)
3. [Proposed Research Framework](#-proposed-research-framework)
4. [Tri-Method Benchmarking & Quantitative Results](#-tri-method-benchmarking--quantitative-results)
5. [Implementation Status & Provenance Matrix](#-implementation-status--provenance-matrix)
6. [System Architecture](#-system-architecture)
7. [REST API Specification](#-rest-api-specification)
8. [Dashboard Sections](#-dashboard-sections)
9. [Installation & Reproduction Guide](#-installation--reproduction-guide)
10. [Unit Test Suite](#-unit-test-suite)
11. [Scientific References](#-scientific-references)

---

## 🔬 Research Overview

Honeybee colonies (*Apis mellifera* / *Apis cerana*) maintain tight homeostatic regulation of their central brood nest ($33.5^\circ\text{C} - 35.5^\circ\text{C}$, $45\% - 65\%$ relative humidity). Disruptions to this thermal microclimate serve as early warnings for colony stress, brood chilling, queen failure, and swarming.

However, traditional IoT monitoring systems face severe operational limitations:
- **High False Alarm Rates (FAR):** Inflexible static thresholds ($32^\circ\text{C} - 36^\circ\text{C}$) trigger continuous false alarms during cold mornings, overwintering phases, or routine apiary inspections.
- **Sensor Glitch Misclassification:** Low-cost digital sensors frequently suffer from bus dropouts, stuck ADC readings, or transmission impulse spikes. Conventional models misclassify these hardware anomalies as biological colony emergencies.
- **Inflated Synthetic Benchmark Claims:** Legacy machine-learning prototypes often report >99% accuracy on artificially separated Gaussian clusters, failing completely when exposed to real-world noisy telemetry.

**HIVEGUARD** solves these challenges by combining:
1. **Context-Aware Temporal Baselines** with hour-of-day diurnal conditioning and inspection window masking.
2. **Sensor Reliability Subsystem** computing a continuous data-quality score $R_s(t) \in [0.0, 1.0]$.
3. **Persistence-Aware Scoring and Multi-Channel Consensus** gating transient electrical noise and isolating genuine biological stress.

---

## 📊 Verified MSPB Research Dataset

The platform directly integrates the peer-reviewed **MSPB dataset**:
- **Citation:** Zhu, Y., Abdollahi, M., Maucourt, S., Coallier, N., Guimarães, H. R., Giovenazzo, P., & Falk, T. H. (2024). *MSPB: a longitudinal multi-sensor dataset with phenotypic trait measurements from honey bees*. **Nature Scientific Data**, 11(1), 1-13. [DOI: 10.1038/s41597-024-03695-1](https://doi.org/10.1038/s41597-024-03695-1).
- **Zenodo Repository:** [Record 8371700](https://doi.org/10.5281/zenodo.8371700) (License: `CC-BY-NC-4.0`).
- **Telemetry Volume:** **1,836,915 physical sensor records** from 53 *Apis mellifera* hives across two apiaries in Québec, Canada over 1 full year.
  - `D1_sensor_data.csv`: 960,809 rows (Active summer season: Apr 16, 2020 – Nov 5, 2020).
  - `D2_sensor_data.csv`: 876,106 rows (Overwintering season: Nov 6, 2020 – Apr 14, 2021).
- **Sampling Cadence:** Uniform 15-minute intervals (900 seconds).
- **Variables Recorded:** Internal temperature (°C), relative humidity (%), sensor battery voltage (`hive_power`), and 20 acoustic frequency features (`audio_density`, `audio_density_ratio`, 16 frequency bands).
- **Ground-Truth Biological Labels:** 16 documented apiary inspection visits (`mspb_visits_manipulations.csv`), Varroa mite washes, brood surface counts, honey yields, and overwintering survival outcomes.
- **Explicit Limitations:** Continuous 15-minute scale weight was **not recorded** in MSPB (only seasonal harvest weigh-ins exist); ambient outside weather was not part of the internal probe stream. HIVEGUARD documents these gaps and never synthesizes fake data for missing channels.

*Full technical audit: [`data/processed/mspb/MSPB_DATASET_AUDIT.md`](data/processed/mspb/MSPB_DATASET_AUDIT.md).*

---

## 🧠 Proposed Research Framework

```
 Telemetry Input X(t)
          │
    ┌─────┴─────────────────────────────────┐
    ▼                                       ▼
[ Context-Aware Baseline ]          [ Sensor Reliability Subsystem ]
• Diurnal hour-of-day conditioning   • Missingness / packet dropout
• Rolling median + robust MAD        • Stuck probe detection (Var=0)
• Apiary inspection masking          • Physical limit bounds breaches
    │                                • Isolated impulse spikes (S_z)
    │                                • High-frequency noise ratio
    ▼                                       │
Robust Deviation Z_c(t)                     ▼
    │                           Reliability Score R_s(t) in [0.0, 1.0]
    │                                       │
    └───────────────────┬───────────────────┘
                        ▼
       [ Composite Anomaly Engine ]
       • Multi-channel agreement A(t)
       • Temporal persistence filter P(t)
       • Management attenuation M(t)
                        │
                        ▼
             Composite Score S(t) in [0, 100]
                        │
                        ▼
       [ Explainable Warning Taxonomy ]
       • NORMAL (S < 25)
       • ENVIRONMENTAL_DEVIATION (25 <= S < 50)
       • PERSISTENT_BIOLOGICAL_ANOMALY (S >= 50, R >= 0.5)
       • SENSOR_RELIABILITY_WARNING (R < 0.5 or HW fault)
       • MANAGEMENT_EVENT_ATTENUATED (Inspection window)
```

### Composite Mathematical Formula

$$S(t) = \left[\min\left(1.0, \frac{\max(|Z_T(t)|, 0.7 \cdot |Z_H(t)|)}{3.5}\right)\right] \times P(t) \times A(t) \times R_{\text{sensor}}(t) \times M(t) \times 100.0$$

Where:
- $Z_c(t) = \frac{x_c(t) - m_c(t)}{\max(\text{MAD}_c(t), \epsilon_c)}$: Robust deviation from diurnal median.
- $R_{\text{sensor}}(t) \in [0.0, 1.0]$: Hardware data-quality score.
- $P(t) = \min\left(1.0, \frac{k_{\text{consecutive}}}{\tau_{\min}}\right)$: Persistence filter suppressing single-timestep transients.
- $A(t) \in [0.10, 1.00]$: Multi-channel cross-sensor agreement factor.
- $M(t) \in [0.35, 1.00]$: Attenuation factor for documented apiary inspection windows.

*Full mathematical proofs and derivations: [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).*

---

## 📈 Tri-Method Benchmarking & Quantitative Results

We benchmark three distinct detection paradigms across identical real MSPB telemetry:
1. **Method A (Fixed Thresholds):** Conventional static band ($32^\circ\text{C} \le T \le 36^\circ\text{C}$).
2. **Method B (Rolling Statistical MAD):** Rolling median and MAD deviation without sensor reliability or persistence filtering.
3. **Method C (HIVEGUARD Proposed Framework):** Context-aware, reliability-aware, and persistence-gated composite scoring.

### Benchmark: Isolated +15°C Sensor Transmission Spike (Hardware Fault)

| Metric | Method A (Fixed) | Method B (Rolling MAD) | Method C (HIVEGUARD) | Advantage |
| :--- | :---: | :---: | :---: | :--- |
| **FAR (False Alarms / 24h)** | **54.72** | **15.12** | **0.96** | **98.25% false alarm reduction** |
| **Monte Carlo FAR (20 runs)** | 58.62 | 15.12 | **0.79** | **98.66% ± 0.15% reduction** |
| **Positive Precision** | 0.0044 | 0.0156 | **0.2000** | Eliminates false biological alarms |
| **Fault Recall** | 1.0000 | 1.0000 | **1.0000** | 100% flags hardware defect |
| **Positive Class $F_1$** | 0.0087 | 0.0308 | **0.3333** | Corrected from old 1.000 |
| **Negative Recall** | 0.4286 | 0.8421 | **0.9900** | Source of old 0.990 value |
| **Macro $F_1$ Score** | **0.3043** | **0.4725** | **0.6641** | Corrected from old 0.990 |
| **Execution Latency** | 0.28 ms | 88.5 ms | 96.3 ms | Real-time edge compatible |

---

## 🔍 Implementation Status & Provenance Matrix

| Subsystem / Feature | Implementation Status | Data Provenance | Verification Method |
| :--- | :--- | :--- | :--- |
| **MSPB Raw Dataset** | **Complete** | Recorded Public Research Data (*Nature 2024*) | Zenodo DOI checksum verification |
| **MSPB Preprocessing Pipeline** | **Complete** | Derived from official files | `src/research/preprocess_mspb.py` |
| **Context-Aware Diurnal Baseline** | **Complete** | Empirical real telemetry | Unit tests & live API |
| **Sensor Reliability Assessment** | **Complete** | Algorithmic ($R_s(t) \in [0, 1]$) | Unit tests & live API |
| **Persistence Gating ($P(t)$)** | **Complete** | Algorithmic | Benchmark experiments |
| **Tri-Method Comparison Engine** | **Complete** | Methods A, B, and C | Unit tests & live API |
| **Controlled Fault Simulation Lab** | **Complete** | Controlled Injected Simulations | Reproducible parameter injection |
| **Experiment Registry & Export** | **Complete** | JSON + CSV artifact persistence | Automated test logging |
| **8 New Research Dashboard Tabs** | **Complete** | HTML5 / CSS3 / Vanilla JS / Chart.js | Browser interactive UI |
| **Legacy 99.9% ML Classifier** | **Audited & Disclaimed** | Synthetic 5-cluster prototype | Labeled as demo in UI & API |
| **ESP32 Physical Hardware** | **Bench Prototype** | Laboratory bench testbed | Pending seasonal apiary deployment |

---

## 🏗️ System Architecture

```text
HIVEGUARD/
├── backend/
│   └── app.py                                # Flask REST API server (ports 5000 / 5001)
│
├── frontend/
│   ├── index.html                            # 8 Research Sections + Operations Dashboard
│   ├── style.css                             # Responsive CSS3 styling & research badges
│   └── script.js                             # Vanilla ES6+ client controller & Chart.js plots
│
├── src/
│   ├── research/                             # Research Subsystems
│   │   ├── dataset_loader.py                 # Ingestion, schema harmonization, missingness
│   │   ├── sensor_reliability.py             # Data quality, stuck probes, spikes, R_s(t)
│   │   ├── context_baseline.py               # Diurnal profiles, rolling MAD, visit masking
│   │   ├── anomaly_framework.py              # Methods A, B, C & composite scoring
│   │   ├── simulation_lab.py                 # Controlled fault and biological simulations
│   │   ├── evaluation.py                     # Precision, Recall, FAR/24h, Latency, Delay
│   │   ├── experiment_registry.py            # JSON/CSV experiment logging & export
│   │   ├── preprocess_mspb.py                # Preprocessing pipeline for Zenodo raw files
│   │   └── routes.py                         # Flask Blueprint for /api/research/...
│   ├── config.py                             # Legacy system constants
│   ├── preprocessing.py                      # Legacy pipeline
│   ├── feature_engineering.py                # Legacy feature extraction
│   ├── anomaly_explanation.py                # Legacy XAI explanations
│   ├── train_model.py                        # Legacy model trainer
│   └── predict.py                            # Legacy inference service
│
├── data/
│   ├── raw/mspb/                             # Preserved Raw Research Files
│   │   ├── D1_sensor_data.csv                # 211 MB (960,809 rows, Summer active season)
│   │   ├── D2_sensor_data.csv                # 184 MB (876,106 rows, Winter overwintering)
│   │   ├── D1_ant.xlsx                       # 10 sheets: Visits, tags, phenotypic traits
│   │   └── D2_ant.xlsx                       # Overwintering outcomes, mortality causes
│   └── processed/mspb/                       # Harmonized Working Artifacts
│       ├── mspb_telemetry_benchmark_50k.csv  # 86,453 continuous multi-sensor records
│       ├── mspb_hive_metadata.csv            # 53 colonies metadata
│       ├── mspb_visits_manipulations.csv     # 16 apiary visits & inspection windows
│       ├── mspb_phenotypic_evaluations.csv   # Varroa washes & brood development
│       └── MSPB_DATASET_AUDIT.md             # Complete technical audit report
│
├── docs/
│   └── METHODOLOGY.md                        # Scientific methodology & mathematical formulas
│
├── experiments/
│   ├── experiments_log.json                  # Reproducible experiment registry
│   └── experiments_log.csv                   # Tabular export for scientific plotting
│
├── tests/
│   └── test_research_framework.py            # Comprehensive unittest suite (7 tests)
│
├── requirements.txt                          # Python dependencies
└── README.md                                 # Technical documentation
```

---

## 🔌 REST API Specification

### Research Endpoints (`research_bp`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/research/datasets` | List available datasets with provenance metadata and sizes |
| `POST` | `/api/research/inspect-dataset` | Analyze schema, missing values, cadences, and hive identifiers |
| `POST` | `/api/research/upload` | Upload and validate external research CSV datasets |
| `POST` | `/api/research/sensor-reliability` | Compute continuous channel reliability and fault flags |
| `POST` | `/api/research/context-anomaly/compare`| Execute Tri-Method comparison (Method A vs B vs C) |
| `POST` | `/api/research/simulation/run` | Run controlled fault injection and evaluation benchmark |
| `GET` | `/api/research/experiments` | Retrieve all registered experiment runs |
| `POST` | `/api/research/experiments/save` | Persist a reproducible experiment configuration |
| `GET` | `/api/research/experiments/export-csv` | Download complete experiment registry as CSV |
| `GET` | `/api/research/audit/mspb` | Retrieve full MSPB audit report in Markdown format |

### Operational Endpoints (Preserved Legacy API)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/hives` | Returns all monitored hive identifiers |
| `GET` | `/api/hive/<hive_id>` | Chronological sensor readings for specified hive |
| `GET` | `/api/latest/<hive_id>` | Most recent sensor readings and ML prediction |
| `POST` | `/api/predict` | Evaluate live manual input against trained model |
| `GET` | `/api/model-insights` | Benchmark model metrics with explicit provenance tags |

---

## 💻 Dashboard Sections

The dashboard is structured into two navigation groups in the left sidebar:

### I. Research & Reliability Subsystems
1. **Research Overview:** Research hypothesis, dataset provenance badges, record counters, and methodology disclosures.
2. **Research Data Explorer:** Interactive CSV uploader, schema inspector, missing-value diagnostic bars, sampling cadence analysis, and time-series viewer.
3. **Sensor Reliability Lab:** Real-time data-quality monitor, continuous reliability scores $R_s(t)$, stuck probe detection, and isolated spike detection.
4. **Context-Aware Anomaly Analysis:** Interactive Tri-Method comparison (Method A, B, C), diurnal baseline profiles, and persistence gating indicators.
5. **Controlled Simulation Laboratory:** Parameterized fault injection (isolated spikes, sensor drift, frozen probes, Gaussian noise) and stress scenarios (brood chilling, hyperthermia).
6. **Model Comparison & Evaluation:** Metric scorecards (FAR/24h, Precision, Recall, Macro F1, Latency) and confusion matrices.
7. **Explainable Warning Center:** Categorized alert taxonomy (`NORMAL`, `ENVIRONMENTAL_DEVIATION`, `PERSISTENT_BIOLOGICAL_ANOMALY`, `SENSOR_RELIABILITY_WARNING`, `MANAGEMENT_EVENT_ATTENUATED`).
8. **Experiment Registry & Export:** Reproducible run logs, configuration inspector modal, and one-click CSV export.

### II. Operations & Demonstration
- Real-time telemetry monitoring, hive comparison view, legacy model insights with audited provenance flags, and manual sensor simulator.

---

## 🚀 Installation & Reproduction Guide

### 1. Prerequisites
- macOS / Linux / Windows
- Python 3.10+ (tested up to Python 3.13)
- `git`, `curl`

### 2. Environment Setup
```bash
# Clone the repository
git clone https://github.com/samruddhidange/HIVEGUARD.git
cd HIVEGUARD

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required dependencies
pip install -r requirements.txt
pip install openpyxl
```

### 3. Verify MSPB Data Ingestion
The raw MSPB dataset has been verified in `data/raw/mspb/`. To re-run the preprocessing pipeline and generate fresh benchmark slices:
```bash
python src/research/preprocess_mspb.py
```

### 4. Run the Unit Test Suite
```bash
PYTHONPATH=. python -m unittest discover -s tests
```
*(All 7 tests pass in < 0.2s).*

### 5. Start the Server
```bash
python backend/app.py
```
*(If port 5000 is occupied by macOS AirPlay Receiver, the server automatically binds to port 5001).*

Open your browser at:
```
http://localhost:5001
```

---

## 🧪 Unit Test Suite

The test suite in [`tests/test_research_framework.py`](tests/test_research_framework.py) provides end-to-end regression validation:
1. `test_schema_harmonization_and_provenance`: Verifies column harmonization and dataset provenance classification.
2. `test_sensor_reliability_assessment`: Tests stuck-value detection, impulse spike isolation, and continuous reliability score $R_s(t) \in [0, 1]$.
3. `test_simulation_lab_fault_injection`: Validates injected spikes, drift, and frozen probe generators.
4. `test_context_aware_temporal_baseline`: Validates diurnal hour-of-day conditioning and robust MAD normalization.
5. `test_tri_method_comparison`: Verifies simultaneous execution of Methods A, B, and C with schema preservation.
6. `test_benchmark_evaluation`: Confirms metric computation (FAR/24h, Precision, Recall, Macro F1, Delay).
7. `test_experiment_registry_persistence`: Validates atomic persistence of experiment runs to disk.

---

## 📚 Scientific References

1. **MSPB Dataset:** Zhu, Y., Abdollahi, M., Maucourt, S., Coallier, N., Guimarães, H. R., Giovenazzo, P., & Falk, T. H. (2024). *MSPB: a longitudinal multi-sensor dataset with phenotypic trait measurements from honey bees*. Nature Scientific Data, 11(1), 1-13. [DOI: 10.1038/s41597-024-03695-1](https://doi.org/10.1038/s41597-024-03695-1).
2. **Thermoregulation in Honeybees:** Seeley, T. D. (1985). *Honeybee Ecology: A Study of Adaptation in Social Life*. Princeton University Press.
3. **Insect Physiology:** Heinrich, B. (1993). *The Hot-Blooded Insects: Strategies and Mechanisms of Thermoregulation*. Harvard University Press.
4. **Robust Statistics:** Rousseeuw, P. J., & Croux, C. (1993). *Alternatives to the Median Absolute Deviation*. Journal of the American Statistical Association, 88(424), 1273-1283.
5. **Precision Apiculture:** Meikle, W. G., & Holst, N. (2015). *Application of continuous monitoring of honeybee colonies*. Apidologie, 46(1), 10-22.

---

**HIVEGUARD Research Group** • *Precision Beekeeping & IoT Sensor Reliability* • October 2026
