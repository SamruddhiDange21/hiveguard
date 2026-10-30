# EVIDENCE INVENTORY: Claim-by-Claim Verification & Provenance Mapping

**Project:** HIVEGUARD  
**Document:** Scientific Evidence Inventory & Claim Audit  
**Date:** October 30, 2026  

---

## 1. Scientific & Performance Claims Audit Matrix

| # | Claim Made in Project | Source Location | Evidence Type | Audit Status | Detailed Audit Finding & Scientific Explanation |
| :-: | :--- | :--- | :--- | :-: | :--- |
| **1** | *"MSPB dataset contains 1.83M real physical telemetry rows from 53 colonies in Québec"* | `MSPB_DATASET_AUDIT.md`, `preprocess_mspb.py` | Recorded Public Research Telemetry (*Nature 2024*) | **VERIFIED & SUPPORTED** | Exact row count: 960,809 (D1) + 876,106 (D2) = 1,836,915 rows. Verified from official Zenodo Record 8371700 checksums. |
| **2** | *"Method C achieves 98.2% false alarm rate reduction compared to fixed thresholds on isolated spikes"* | `README.md`, `METHODOLOGY.md` | Algorithmic Benchmark on Real Telemetry with Injected Fault | **VERIFIED & SUPPORTED** | Single run on `MSPB_HIVE_2046`: Method A had 228 FP (54.72 alarms/day); Method C had 4 FP (0.96 alarms/day). Reduction = (228 - 4)/228 = **98.25%**. 20-run Monte Carlo replication: **98.66% ± 0.15%**. |
| **3** | *"Method C achieves Macro F1 of 0.990 on isolated transmission spike detection"* | `README.md` (Table 1), `METHODOLOGY.md` | Algorithmic Evaluation Metric | **REFUTED & CORRECTED** | **Mislabeled Metric.** In the confusion matrix (`TN=395, FP=4, FN=0, TP=1`), positive binary F1 is **0.3333**; negative class recall is **0.9900**; true unweighted Macro F1 is **0.6641**. The value 0.990 was the negative-class recall mislabeled as Macro F1. |
| **4** | *"Positive Precision of Method C on spike detection is 1.000"* | `README.md` (Table 1), `METHODOLOGY.md` | Algorithmic Evaluation Metric | **REFUTED & CORRECTED** | Method C had 1 TP and 4 FP on non-spike timesteps. True positive precision is $1 / (1 + 4) = \mathbf{0.2000}$. Negative precision is 1.000. |
| **5** | *"Method C detects brood chilling with Biological Recall = 1.000 and FAR = 0.00"* | `METHODOLOGY.md` (Table 2) | Hypothetical Environmental Stress Simulation | **REFUTED & CORRECTED** | **Unverified / Fabricated in old table.** When running the code on 8-step brood chilling, Method C produced **0 TP for `method_c_biological_flag`** because the rapid $-6.5^\circ\text{C}$ drop depressed the sensor reliability score to 0.45, categorizing the event as a hardware warning. Composite alarm recall was 0.625 (5/8). |
| **6** | *"Continuous scale weight is monitored at 15-minute intervals for all MSPB colonies"* | Legacy system assumption | Telemetry Schema | **REFUTED & DISCLAIMED** | Continuous 15-minute scale weight was **not recorded** in the MSPB dataset; only milestone weigh-ins exist. System properly documents weight as missing in MSPB. |
| **7** | *"Random Forest achieves 99.9% accuracy and 0.9990 Macro F1 on bee disease classification"* | `models/best_bee_anomaly_model.pkl`, `/api/model-insights` | Synthetic Clustered Prototype Data | **AUDITED & DISCLAIMED** | Audited as trained on `HIVEGUARD_ML_Bee_Disease_Synthetic_10000.csv`, which had 5 artificially separated Gaussian clusters ($\sigma \approx 0.4^\circ\text{C}$). Correctly tagged in UI and API as *"Legacy Prototype Demonstration on Synthetic Data"*. |
| **8** | *"Apiary management inspection windows are automatically masked to prevent false alarms"* | `context_baseline.py`, `mspb_visits_manipulations.csv` | Empirical Biological Metadata | **VERIFIED & SUPPORTED** | 16 apiary visits from MSPB are loaded. Timestamps during visits receive attenuation factor $M(t) = 0.35$, preventing inspection-induced alerts. |
| **9** | *"Detection delay for isolated transmission spikes is 0.0 timesteps"* | `evaluation.py`, `METHODOLOGY.md` | Algorithmic Evaluation Metric | **QUALIFIED AS BUFFERED** | The code triggers at the spike timestep ($t = 150$). However, the spike detection algorithm in `sensor_reliability.py` checks $x(t+1)$, representing a 1-step (15-minute) edge confirmation buffer. |
| **10** | *"Physical ESP32 hardware prototype has validated colony health on live Apis cerana indica colonies"* | Hardware project narrative | Embedded System Bench Prototype | **REFUTED & PENDING** | **No live colony validation has been conducted.** Hardware testing was performed strictly on the laboratory bench with hairdryer/breath stimulation. Physical colony deployment is pending the upcoming active season. |

---

## 2. Data Provenance Classification Rules

To prevent any contamination between real empirical observations and experimental simulations, HIVEGUARD enforces five mutually exclusive provenance categories:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      DATA PROVENANCE HIERARCHY                         │
├────────────────────────────────┬───────────────────────────────────────┤
│ 1. Recorded Public Research    │ Real physical sensor data from MSPB   │
│    Data (MSPB)                 │ (1,836,915 rows, Nature 2024, Zenodo) │
├────────────────────────────────┼───────────────────────────────────────┤
│ 2. Controlled Injected Fault   │ Real MSPB baseline with mathematically│
│    Simulations                 │ injected spikes, drift, or stuck ADC  │
├────────────────────────────────┼───────────────────────────────────────┤
│ 3. Hypothetical Environmental  │ Real MSPB baseline with simulated     │
│    Stress Scenarios            │ multi-step hypothermia/hyperthermia   │
├────────────────────────────────┼───────────────────────────────────────┤
│ 4. Synthetic Demonstration     │ Legacy 10,000-row prototype data with │
│    Data                        │ artificial Gaussian clusters          │
├────────────────────────────────┼───────────────────────────────────────┤
│ 5. Physical Hardware           │ ESP32 bench measurements (laboratory  │
│    Measurements                │ breadboard only; no colony data)      │
└────────────────────────────────┴───────────────────────────────────────┘
```

Every response from the REST API, export from the experiment registry, and section of the scientific dashboard explicitly declares the provenance of the underlying data.
