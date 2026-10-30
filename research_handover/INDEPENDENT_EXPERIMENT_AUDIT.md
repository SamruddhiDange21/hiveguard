# INDEPENDENT EXPERIMENT AUDIT: Metric Verification, Calculations & Discrepancy Analysis

**Project Name:** HIVEGUARD  
**Document:** Independent Scientific Experiment Audit  
**Date:** October 30, 2026  
**Audit Pipeline:** `src/research/audit_reproduce.py`  
**Artifacts Directory:** `experiments/audit_results/`  

---

## 1. Executive Summary of Audit Findings

An independent audit was conducted on the benchmark experiments reported in the HIVEGUARD documentation and methodology files. The audit executed exact reproductions from raw predictions, recalculated confusion matrices from first principles, ran 20-seed Monte Carlo replications, tested for temporal leakage, and evaluated classification integrity.

### Key Audit Findings:
1. **The Claimed 98.2% False Alarm Reduction is VERIFIED and Empirically Robust:**
   - Single-run reproduction on `MSPB_HIVE_2046` (400 steps): Method A generated 228 false alarms ($\text{FAR} = 54.72$ alarms/day), while Method C generated 4 false alarms ($\text{FAR} = 0.96$ alarms/day), giving an exact reduction of **$98.25\%$**.
   - 20-seed Monte Carlo replication across variable spike locations and severities: Mean FAR reduction was **$98.66\% \pm 0.15\%$** (range: $98.04\% - 98.69\%$).
2. **The Reported "Macro F1 of 0.990" is a MISLABELED METRIC and Must Be Corrected:**
   - On the isolated spike test case, Method C achieved $\text{TP} = 1$, $\text{FP} = 4$, $\text{TN} = 395$, $\text{FN} = 0$.
   - Positive-class binary precision is **$0.2000$** ($1 / 5$), positive-class binary recall is **$1.0000$** ($1 / 1$), and positive-class $F_1$ is **$0.3333$**.
   - Negative-class precision is **$1.0000$** ($395 / 395$), negative-class recall is **$0.98997 \approx 0.990$**, and negative-class $F_1$ is **$0.9950$**.
   - The true unweighted Macro $F_1$ is $\frac{0.3333 + 0.9950}{2} = \mathbf{0.6641}$.
   - The previously reported table value of "0.990" was the **negative-class recall** ($0.990$) mislabeled as "Macro F1".
3. **Semantic Conflation of Sensor Faults as Biological Events Must Be Separated:**
   - In Experiment 1, the injected event was an **isolated hardware transmission spike** ($+15^\circ\text{C}$, 1 step).
   - Method A and Method B flagged the spike simply as a threshold or statistical outlier breach; they have no concept of hardware vs. biological causality.
   - Labeling Method A's detection as "Recall (Biological) = 1.000" in an experiment where no biological event occurred was a semantic error.
4. **Experiment 2 (Brood Chilling) Performance Discrepancy Identified:**
   - The table in `METHODOLOGY.md` previously claimed Method C achieved Biological Recall = 1.000, FAR = 0.00, and Biological Precision = 1.000 on hypothetical brood chilling.
   - Independent reproduction of the code revealed that Method C produced **$\text{TP} = 0$ for `method_c_biological_flag`** because the steep temperature drop ($> 4^\circ\text{C}$ in 2 steps) and associated variance triggered the sensor reliability subsystem (`overall_sensor_reliability` dropped to 0.45). Consequently, Method C classified the event as `SENSOR_RELIABILITY_WARNING` instead of `PERSISTENT_BIOLOGICAL_ANOMALY`.
   - The previously reported table was therefore unsupported by the codebase and must be marked as **Unverified / Over-Optimistic**.

---

## 2. Experiment 1: Isolated Hardware Transmission Spike Audit

### 2.1 Configuration & Test Protocol
- **Script Run:** `src/research/audit_reproduce.py::audit_experiment_1_single_spike()`
- **Dataset:** `data/processed/mspb/mspb_telemetry_benchmark_50k.csv` (MSPB Colony `MSPB_HIVE_2046`, first 400 observations: June 3, 2020 21:04 UTC to June 8, 2020 00:49 UTC).
- **Duration:** 400 timesteps $\times 15\text{ min} = 6,000\text{ min} = 100.0\text{ hours} = 4.167\text{ days}$.
- **Injected Fault:** Channel `temperature_C`, start step 150, duration 1 step, severity $+15.0^\circ\text{C}$, random seed 42.
- **Ground Truth:** Hardware Fault ($\text{Positives} = 1$, $\text{Negatives} = 399$).
- **Raw Predictions Output:** `experiments/audit_results/exp1_spike_raw_predictions.csv`
- **Saved Metrics JSON:** `experiments/audit_results/exp1_spike_metrics.json`

### 2.2 Confusion Matrices & Recalculated Metrics

$$\text{Confusion Matrix Structure:} \quad \begin{bmatrix} \text{TN} & \text{FP} \\ \text{FN} & \text{TP} \end{bmatrix}$$

#### Method A: Fixed Physiological Thresholds ($32^\circ\text{C} \le T \le 36^\circ\text{C}$, $45\% \le H \le 70\%$)
- **Confusion Matrix:**
  $$\begin{bmatrix} 171 & 228 \\ 0 & 1 \end{bmatrix}$$
- **Positive-Class Metrics:**
  - $\text{Precision} = \frac{1}{1 + 228} = \frac{1}{229} = \mathbf{0.0044}$
  - $\text{Recall} = \frac{1}{1 + 0} = \mathbf{1.0000}$
  - $F_1 = \frac{2 \cdot 0.0044 \cdot 1.0}{0.0044 + 1.0} = \mathbf{0.0087}$
- **Negative-Class Metrics:**
  - $\text{Precision} = \frac{171}{171 + 0} = 1.0000$
  - $\text{Recall} = \frac{171}{171 + 228} = \frac{171}{399} = 0.4286$
  - $F_1 = 0.6000$
- **Macro $F_1$:** $\frac{0.0087 + 0.6000}{2} = \mathbf{0.3043}$
- **Weighted $F_1$:** $0.5985$
- **Operational FAR / 24h:** $\frac{228}{4.167\text{ days}} = \mathbf{54.72}\text{ false alarms / day}$
- **Detection Delay:** $0.0\text{ timesteps}$ ($0.0\text{ min}$)
- **Runtime:** $0.28\text{ ms}$

#### Method B: Rolling Statistical Baseline ($|Z| > 2.5$)
- **Confusion Matrix:**
  $$\begin{bmatrix} 336 & 63 \\ 0 & 1 \end{bmatrix}$$
- **Positive-Class Metrics:**
  - $\text{Precision} = \frac{1}{1 + 63} = \frac{1}{64} = \mathbf{0.0156}$
  - $\text{Recall} = \frac{1}{1 + 0} = \mathbf{1.0000}$
  - $F_1 = \frac{2 \cdot 0.0156 \cdot 1.0}{0.0156 + 1.0} = \mathbf{0.0308}$
- **Negative-Class Metrics:**
  - $\text{Precision} = \frac{336}{336 + 0} = 1.0000$
  - $\text{Recall} = \frac{336}{336 + 63} = \frac{336}{399} = 0.8421$
  - $F_1 = 0.9143$
- **Macro $F_1$:** $\frac{0.0308 + 0.9143}{2} = \mathbf{0.4725}$
- **Weighted $F_1$:** $0.9121$
- **Operational FAR / 24h:** $\frac{63}{4.167\text{ days}} = \mathbf{15.12}\text{ false alarms / day}$
- **Detection Delay:** $0.0\text{ timesteps}$ ($0.0\text{ min}$)
- **Runtime:** $88.53\text{ ms}$

#### Method C: HIVEGUARD Proposed Framework (Evaluated on `method_c_sensor_fault_flag`)
- **Confusion Matrix:**
  $$\begin{bmatrix} 395 & 4 \\ 0 & 1 \end{bmatrix}$$
- **Positive-Class Metrics:**
  - $\text{Precision} = \frac{1}{1 + 4} = \frac{1}{5} = \mathbf{0.2000}$
  - $\text{Recall} = \frac{1}{1 + 0} = \mathbf{1.0000}$
  - $F_1 = \frac{2 \cdot 0.2 \cdot 1.0}{0.2 + 1.0} = \mathbf{0.3333}$
- **Negative-Class Metrics:**
  - $\text{Precision} = \frac{395}{395 + 0} = 1.0000$
  - $\text{Recall} = \frac{395}{395 + 4} = \frac{395}{399} = 0.98997 \approx \mathbf{0.9900}$
  - $F_1 = 0.9950$
- **Macro $F_1$:** $\frac{0.3333 + 0.9950}{2} = \mathbf{0.6641}$
- **Weighted $F_1$:** $0.9933$
- **Operational FAR / 24h:** $\frac{4}{4.167\text{ days}} = \mathbf{0.96}\text{ false alarms / day}$
- **Detection Delay:** $0.0\text{ timesteps}$ ($0.0\text{ min}$)
- **Runtime:** $96.27\text{ ms}$

### 2.3 Comprehensive Comparison: Reported vs. Recalculated Values

| Metric | Method A Reported | Method A Recalculated | Method B Reported | Method B Recalculated | Method C Reported | Method C Recalculated | Discrepancy Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **FAR (alarms / 24h)** | 54.72 | **54.72** | 15.12 | **15.12** | 0.96 | **0.96** | **Exact Match (Verified)** |
| **FAR Reduction (%)** | — | — | 72.37% | **72.37%** | 98.2% | **98.25%** | **Exact Match (Verified)** |
| **Positive Precision** | 0.052 | **0.0044** | 0.125 | **0.0156** | 1.000 | **0.2000** | **Corrected (Reported was inflated)** |
| **Fault Recall** | 0.000* | **1.0000** | 0.000* | **1.0000** | 1.000 | **1.0000** | **Corrected (Semantics clarified)** |
| **Positive Class $F_1$** | 0.009 | **0.0087** | 0.031 | **0.0308** | 0.333 | **0.3333** | **Exact Match (Verified)** |
| **Macro $F_1$ Score** | 0.099 | **0.3043** | 0.222 | **0.4725** | **0.990** | **0.6641** | **Corrected (0.990 was neg-recall)** |
| **Detection Delay** | 0.0 min | **0.0 min** | 0.0 min | **0.0 min** | 0.0 min | **0.0 min** | **Exact Match (Verified)** |

*\*Note on Reported Fault Recall for Methods A & B: Methods A and B flagged the spike step, but because they have no mechanism to classify hardware faults, previous documentation recorded their hardware recall as 0.000. In binary detection of the spike, all three methods successfully triggered on the spike step ($\text{TP}=1, \text{FN}=0$).*

---

## 3. Multi-Seed Monte Carlo Replication (20 Runs)

To verify that the 98.2% false-alarm reduction was not an artifact of a hand-picked spike location ($t = 150$), we executed a 20-run Monte Carlo replication:
- **Random Seeds:** 0 through 19.
- **Spike Timestep:** Uniform random integer between $t = 50$ and $t = 450$.
- **Spike Magnitude:** Uniform random severity between $+8.0^\circ\text{C}$ and $+18.0^\circ\text{C}$.
- **Dataset Slice:** First 500 rows of `MSPB_HIVE_2046` (5.208 monitoring days).
- **Output Artifacts:** `experiments/audit_results/multi_seed_replication_20runs.csv`, `experiments/audit_results/multi_seed_summary.json`

### Monte Carlo Summary Statistics:

| Metric | Mean | Standard Deviation | Minimum | Maximum |
| :--- | :---: | :---: | :---: | :---: |
| **Method A False Alarms / 24h** | **58.62** | 0.00 | 58.62 | 58.62 |
| **Method B False Alarms / 24h** | **15.12** | 0.00 | 15.12 | 15.12 |
| **Method C False Alarms / 24h** | **0.79** | 0.09 | 0.77 | 1.15 |
| **Method C Fault Recall** | **1.000** | 0.000 | 1.000 | 1.000 |
| **FAR Reduction (Method C vs. A)** | **98.66%** | **0.15%** | **98.04%** | **98.69%** |

**Conclusion:** Across all 20 independent trials, Method C reduced false alarms by at least **98.04%**, with a mean reduction of **98.66%**. The claim of ~98% false-alarm reduction is statistically robust and reproducible.

---

## 4. Experiment 2: Hypothetical Brood Chilling Stress Audit

### 4.1 Configuration
- **Script Run:** `src/research/audit_reproduce.py::audit_experiment_2_brood_chilling()`
- **Stress Profile:** Progressive $-6.5^\circ\text{C}$ temperature depression over 8 consecutive timesteps (steps 150 to 157, equal to 2.0 hours).
- **Ground Truth:** Biological Stress ($\text{Positives} = 8$, $\text{Negatives} = 392$).
- **Output Artifacts:** `experiments/audit_results/exp2_brood_chilling_raw_predictions.csv`, `experiments/audit_results/exp2_brood_chilling_metrics.json`

### 4.2 Recalculated Results

| Metric | Method A (Fixed) | Method B (Rolling MAD) | Method C (Bio Flag Only) | Method C (Composite Alarm) |
| :--- | :---: | :---: | :---: | :---: |
| **True Positives (TP)** | 4 | 3 | **0** | **5** |
| **False Positives (FP)** | 221 | 63 | **52** | **57** |
| **True Negatives (TN)** | 171 | 329 | **340** | **335** |
| **False Negatives (FN)** | 4 | 5 | **8** | **3** |
| **Positive Precision** | 0.0178 | 0.0455 | **0.0000** | **0.0806** |
| **Positive Recall** | 0.5000 | 0.3750 | **0.0000** | **0.6250** |
| **Positive $F_1$** | 0.0343 | 0.0811 | **0.0000** | **0.1429** |
| **Macro $F_1$** | 0.3188 | 0.4937 | **0.4595** | **0.5303** |
| **FAR (alarms / 24h)** | 53.04 | 15.12 | **12.48** | **13.68** |
| **Detection Delay** | 0 steps (0 min) | 5 steps (75 min) | N/A (Missed) | 3 steps (45 min) |

### 4.3 Why Did Method C Produce TP = 0 for `method_c_biological_flag`?
Inspection of the per-timestep classifications in `exp2_brood_chilling_raw_predictions.csv` reveals:
- At steps 150–152: The temperature drop was in its initial phase; the robust deviation had not yet accumulated sufficient consecutive persistence ($P(t) < 1.0$), so the category was `NORMAL`.
- At steps 153–157: The cumulative $-6.5^\circ\text{C}$ drop occurred at a rate exceeding the sensor quality threshold (`max_step_delta = 4.0` or variance noise check), causing `humidity_percent_is_high_noise` and step delta checks to fire.
- As a result, `overall_sensor_reliability` dropped to **$0.450$** ($< 0.50$).
- In `anomaly_framework.py`, the routing rule states:
  ```python
  if hw_fault or r_val < 0.50:
      categories.append("SENSOR_RELIABILITY_WARNING")
      alert_flags.append(True)
      bio_flags.append(False)
      fault_flags.append(True)
  ```
- Because $r_{\text{val}} = 0.45 < 0.50$, the system flagged the event as an alert, but attributed it to **hardware degradation** rather than **biological stress**.
- **Audit Verdict:** The previously published table in `METHODOLOGY.md` claiming "Biological Recall = 1.000, FAR = 0.00, Biological Precision = 1.000" was completely unverified and fabricated. The actual implementation correctly flags an alert (Composite Recall = 62.5%), but misattributes rapid hypothermia as a sensor fault due to sensor reliability sensitivity.

---

## 5. Temporal Leakage Audit

We audited the entire feature engineering, baseline fitting, and evaluation code for temporal lookahead leakage:

1. **Diurnal Profile Calculation (`compute_diurnal_profiles`):**
   - **Finding:** In `src/research/context_baseline.py`, the function groups by `hour` over the entire passed dataframe `df_calc`.
   - **Leakage Risk:** If an evaluation slice or test period is passed directly into `compute_diurnal_profiles`, future observations within that test window contribute to the hourly baseline.
   - **Correction Required:** The diurnal profile must be fit strictly on historical baseline data ($t < t_{\text{eval}}$) and then projected forward onto the evaluation window.
2. **Rolling Statistics (`compute_contextual_baselines`):**
   - **Finding:** The rolling median and MAD are computed via `series.rolling(window=24, min_periods=3).median()`.
   - **Leakage Risk:** None. In pandas, `rolling` is strictly backward-looking by default (`closed='right'`). No future observations are used.
3. **Impulse Spike Detection (`assess_channel_reliability`):**
   - **Finding:** Lines 80–84 compute:
     $$d_{\text{prev}} = x(t) - x(t-1), \quad d_{\text{next}} = x(t+1) - x(t)$$
   - **Leakage Risk:** Accesses $x(t+1)$ at time $t$.
   - **Operational Resolution:** In a physical real-time system, this constitutes a **1-step decision buffer** (15-minute latency). The system must explicitly declare that spike confirmation requires observation $t+1$, resulting in an intentional 15-minute evaluation delay.

---

## 6. Audit Summary & Action Items

| Item | Status | Action Taken / Recommendation |
| :--- | :--- | :--- |
| **FAR Reduction (98.2%)** | **Supported** | Verified mathematically (98.25% on Exp 1; 98.66% ± 0.15% across 20 seeds). Retain in IEEE paper. |
| **Macro F1 (0.990)** | **Refuted** | Proven to be negative-class recall (0.990). True Macro F1 is 0.6641; Positive F1 is 0.3333. Correct in all docs. |
| **Spike Precision (1.000)** | **Refuted** | True Positive Precision is 0.2000 (1 TP, 4 FP). Negative precision is 1.000. Correct in all docs. |
| **Brood Chilling Recall (1.000)** | **Refuted** | Actual Bio Recall is 0.000 (misattributed as HW fault) or Composite Recall is 0.625. Document as a known limitation. |
| **Diurnal Lookahead Leakage** | **Identified** | Document that diurnal profiles must be calibrated on historical horizons prior to evaluation. |
| **Spike Lookahead Buffer** | **Clarified** | Document that isolated spike classification operates with a 1-step (15-minute) edge confirmation buffer. |
