# REPRODUCIBILITY: Step-by-Step Reproduction Guide & Artifact Inventory

**Project:** HIVEGUARD  
**Document:** Experimental Reproducibility Guide  
**Date:** October 30, 2026  
**Target Environment:** macOS / Linux / Windows (Python 3.10+)  

---

## 1. Prerequisites & Environment Setup

### 1.1 System Requirements
- Python 3.10, 3.11, 3.12, 3.13, or 3.14
- Operating System: macOS (Apple Silicon / Intel), Ubuntu / Debian Linux, or Windows 10/11
- Disk Space: At least 1.0 GB free (for processed datasets, virtual environment, and audit artifacts)

### 1.2 Virtual Environment Setup
From the project root directory:

```bash
# Navigate to project repository
cd /Users/samruddhidange/.gemini/antigravity/scratch/HIVEGUARD

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate       # macOS / Linux
# venv\Scripts\activate        # Windows Command Prompt

# Install all dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 2. Step-by-Step Experiment Reproduction

### Step 2.1: Run the Unit Test Suite
Verify that all 11 unit tests pass:
```bash
PYTHONPATH=. venv/bin/python -m unittest discover -s tests
```
*Expected Result:*
```text
...........
----------------------------------------------------------------------
Ran 11 tests in 0.590s

OK
```
*Tests cover column harmonization, sensor reliability, fault injection, diurnal baseline calculations, tri-method execution, benchmark metrics, experiment persistence, metric calculation correctness, temporal leakage detection, seed reproducibility, and label integrity.*

---

### Step 2.2: Re-run the Independent Experiment Audit
Execute the automated audit pipeline:
```bash
PYTHONPATH=. venv/bin/python src/research/audit_reproduce.py
```
*Console Output Produced:*
```text
Executing HIVEGUARD Independent Scientific Audit...

--- Auditing Experiment 1: Single Transmission Spike (+15°C, 1 timestep) ---
Method A: FP=228, FAR=54.72, Prec=0.0044, F1_pos=0.0087, Macro_F1=0.3043
Method B: FP=63, FAR=15.12, Prec=0.0156, F1_pos=0.0308, Macro_F1=0.4725
Method C: FP=4, FAR=0.96, Prec=0.2, F1_pos=0.3333, Macro_F1=0.6641
Method C Biological False Alarms: 52

--- Running Multi-Seed Replication (20 runs) for FAR Reduction ---
Replication Summary over 20 trials:
  Method A Mean FAR/24h: 58.62
  Method C Mean FAR/24h: 0.79
  Mean FAR Reduction: 98.66% ± 0.15% (range: 98.04% - 98.69%)

--- Auditing Experiment 2: Brood Chilling Stress (-6.5°C over 8 steps) ---
Method A: TP=4, FP=221, Recall=0.5, Prec=0.0178, FAR=53.04
Method B: TP=3, FP=63, Recall=0.375, Prec=0.0455, FAR=15.12
Method C (Bio flag): TP=0, FP=52, Recall=0.0, Prec=0.0, FAR=12.48
Method C (Any alert): TP=5, FP=57, Recall=0.625, Prec=0.0806, FAR=13.68
Categories during event: ['NORMAL', 'NORMAL', 'NORMAL', 'SENSOR_RELIABILITY_WARNING', 'SENSOR_RELIABILITY_WARNING', 'SENSOR_RELIABILITY_WARNING', 'SENSOR_RELIABILITY_WARNING', 'SENSOR_RELIABILITY_WARNING']

Audit experiments completed successfully. Results saved in experiments/audit_results/.
```

---

### Step 2.3: Generate Publication-Ready Audit Figures
Generate the publication figures illustrating FAR distributions and anomaly classifications:
```bash
PYTHONPATH=. venv/bin/python src/research/generate_audit_figures.py
```
*Output Images Created in `experiments/audit_results/`:*
1. `figure_audit_far_reduction_distribution.png`: Bar chart of operational False Alarm Rate and histogram of percentage reduction across 20 Monte Carlo seeds.
2. `figure_audit_exp1_spike_comparison.png`: Time-series showing raw MSPB telemetry, injected transmission spike, Method A threshold breaches, and Method C selective hardware flag.
3. `figure_audit_exp2_brood_chilling_diagnostic.png`: Time-series and composite anomaly score trajectory showing why Method C suppressed biological alarm in favor of sensor reliability warning.

---

### Step 2.4: Reproducing Dataset Preprocessing (Optional)
If you wish to re-generate the working slices in `data/processed/mspb/` from the raw Zenodo files in `data/raw/mspb/`:
```bash
PYTHONPATH=. venv/bin/python src/research/preprocess_mspb.py
```
*Generates fresh benchmark files in `data/processed/mspb/` and prints record counts.*

---

## 3. Inventory of Generated Audit Artifacts

All reproduced results, raw timestep predictions, and metrics are saved in `experiments/audit_results/`:

| Artifact File | Size | Description |
| :--- | :---: | :--- |
| `exp1_spike_metrics.json` | 2.5 KB | Full confusion matrices, precision, recall, positive $F_1$, negative $F_1$, macro $F_1$, weighted $F_1$, FAR/24h, and runtime for Experiment 1 |
| `exp1_spike_raw_predictions.csv` | 32.9 KB | Timestep-by-timestep predictions, raw temperatures, corrupted values, and category classifications across all 400 steps of Exp 1 |
| `exp2_brood_chilling_metrics.json` | 3.3 KB | Complete metrics and confusion matrices for hypothetical brood chilling stress |
| `exp2_brood_chilling_raw_predictions.csv` | 35.3 KB | Timestep-by-timestep predictions, composite scores, and category classifications across all 400 steps of Exp 2 |
| `multi_seed_replication_20runs.csv` | 1.1 KB | Table of 20 Monte Carlo runs logging spike index, severity, FP counts, FAR/24h, and reduction percentage |
| `multi_seed_summary.json` | 211 B | Mean, std, min, and max statistics across the 20 Monte Carlo replication trials |
| `figure_audit_far_reduction_distribution.png` | 134 KB | Publication-quality figure showing FAR reduction distribution |
| `figure_audit_exp1_spike_comparison.png` | 155 KB | Publication-quality figure of transmission spike detection |
| `figure_audit_exp2_brood_chilling_diagnostic.png` | 148 KB | Publication-quality figure of brood chilling diagnostic |
