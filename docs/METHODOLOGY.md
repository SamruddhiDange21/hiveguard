# HIVEGUARD: A Context-Aware and Reliability-Aware Framework for Anomaly Detection in Honeybee Hive Monitoring

**Scientific Methodology and Technical Specification**  
**Document Version:** 1.0.0  
**Date:** October 2026  
**Authors:** HIVEGUARD Research & Engineering Group  
**Code Repository:** `https://github.com/samruddhidange/HIVEGUARD`  

---

## Executive Summary

Precision beekeeping (*Apiculture 4.0*) relies on embedded Internet-of-Things (IoT) sensors to track the internal microclimate and health dynamics of honeybee colonies (*Apis mellifera* and *Apis cerana*). However, existing automated monitoring systems frequently suffer from **excessive false alarm rates (FAR)** and **sensor fault misclassifications**. Traditional systems apply static physiological thresholds (e.g., $32.0^\circ\text{C} \le T \le 36.0^\circ\text{C}$) that fail to account for natural diurnal cycles, seasonal overwintering shifts, and routine apiary management events. Furthermore, low-cost telemetry probes regularly suffer from electronic dropouts, stuck analog-to-digital converters, and transmission impulse spikes—erroneously alerting beekeepers to biological emergencies when the underlying hardware has merely malfunctioned.

This document formalizes the **HIVEGUARD Research Framework**, a unified, context-aware, and reliability-aware algorithmic architecture designed to address these challenges. The framework integrates:
1. **Context-Aware Temporal Baselines** conditioned on hour-of-day diurnal profiles and apiary management logs.
2. **Sensor Reliability and Data-Quality Assessment** outputting a continuous channel-specific reliability score $R_s(t) \in [0.0, 1.0]$.
3. **Persistence-Aware Anomaly Scoring and Multi-Channel Consensus** gating transient electrical noise and isolating genuine, sustained biological anomalies.

The framework is verified using the peer-reviewed **MSPB honeybee research dataset** (*Nature Scientific Data*, 2024; Zenodo DOI: `10.5281/zenodo.8371700`), spanning 1.83 million real physical sensor observations across 53 colonies over an entire annual cycle.

---

## 1. Domain Background and Problem Formulation

### 1.1 Homeostatic Brood Nest Thermoregulation
Social honeybee colonies exhibit sophisticated collective homeostatic behavior. During the active brood-rearing season, worker bees regulate the central brood nest within an exceptionally narrow thermal core ($33.5^\circ\text{C} - 35.5^\circ\text{C}$) and maintain relative humidity between $45\% - 65\%$. Worker bees accomplish this via active metabolic fanning, evaporative cooling with water droplets, and endothermic muscle contractions.

Departures from homeostatic equilibrium reflect critical biological phenomena:
- **Brood Chilling / Hypothermia:** Ambient temperature drops combined with low bee cluster density cause brood temperature to plummet below $32.0^\circ\text{C}$, leading to developmental deformities or brood death.
- **Acute Hyperthermia:** Direct insolation or ventilation failure forcing temperatures above $36.5^\circ\text{C}$, triggering emergency fanning.
- **Swarming Event:** Sudden biomass departure accompanied by rapid thermal and acoustic shifts.
- **Overwintering Cluster Contraction:** During cold winter months, bees cease brood rearing and form a tight winter cluster, allowing peripheral hive temperatures to fluctuate with external weather while maintaining a warm core cluster ($20^\circ\text{C} - 32^\circ\text{C}$).

### 1.2 The Failure Modes of Legacy Approaches
1. **Static Threshold Failure (Method A):** Applying invariant thresholds (e.g., alert if $T < 32^\circ\text{C}$ or $H > 70\%$) generates persistent false alarms during cold mornings, overwintering phases, or brief hive opening inspections.
2. **Isolated Spike Misattribution:** Low-cost I2C/OneWire digital sensors (such as DHT22 or DS18B20) routinely experience bus noise, bit shifts, or electromagnetic interference, producing isolated single-reading spikes (e.g., $+15^\circ\text{C}$ for a single 15-minute timestep). Legacy ML models flag these as catastrophic colony collapses.
3. **Absence of Provenance Transparency:** Many commercial and academic prototypes blur the line between synthetic laboratory data and genuine biological measurements, reporting unrealistic classification accuracies (>99%) trained on artificial Gaussian clusters that fail in real field apiaries.

---

## 2. Mathematical Formulation of the Framework

The HIVEGUARD framework operates as a modular, transparent inference pipeline processing discrete multi-sensor time-series $\mathbf{X} = \{x_c(t)\}_{c=1}^C$ where $c$ denotes the sensor channel (temperature, humidity, acoustic density, hive power).

```
 Raw Telemetry X(t)
       │
       ├────────────────────────────────────────┐
       ▼                                        ▼
[ Module A: Context Baseline ]    [ Module B: Sensor Reliability ]
 - Diurnal Profile conditioning     - Stuck Probe Detection (Var=0)
 - Rolling Median + Robust MAD      - Impulse Spike Flagging (S_z)
 - Apiary Management Masking        - Physical Limits Boundary Check
       │                                        │
       ▼                                        ▼
Robust Deviation: Z_c(t)          Reliability Score: R_s(t) in [0, 1]
       │                                        │
       └───────────────────┬────────────────────┘
                           ▼
             [ Module C: Composite Scoring ]
              - Multi-Channel Consensus A(t)
              - Temporal Persistence P(t)
              - Management Attenuation M(t)
                           │
                           ▼
               Composite Score S(t) in [0, 100]
                           │
                           ▼
          [ Explainable Warning Taxonomy ]
           - NORMAL
           - ENVIRONMENTAL_DEVIATION
           - PERSISTENT_BIOLOGICAL_ANOMALY
           - SENSOR_RELIABILITY_WARNING
           - MANAGEMENT_EVENT_ATTENUATED
```

### 2.1 Module A: Context-Aware Temporal Baseline

Let $x_c(t)$ be the measurement of channel $c$ at timestamp $t$, with hour of day $h = \text{hour}(t) \in \{0, 1, \dots, 23\}$.

#### Diurnal Profile Conditioning
Rather than comparing against an invariant mean, we compute an empirical hour-of-day diurnal expectation over a historical baseline window $\mathcal{T}_{\text{base}}$:

$$\hat{\mu}_{c}(h) = \text{median}\left(\left\{x_c(\tau) \mid \tau \in \mathcal{T}_{\text{base}}, \text{hour}(\tau) = h\right\}\right)$$

To provide robustness against non-Gaussian outliers, scale is estimated via the Median Absolute Deviation (MAD):

$$\text{MAD}_c(h) = 1.4826 \cdot \text{median}\left(\left\{\left|x_c(\tau) - \hat{\mu}_c(h)\right| \mid \tau \in \mathcal{T}_{\text{base}}, \text{hour}(\tau) = h\right\}\right)$$

where the factor $1.4826$ ensures asymptotic consistency with the standard deviation for normally distributed variables.

#### Rolling Adaptive Window Baseline
To capture multi-day weather trends or seasonal transitions, a rolling window of length $W$ (default $W = 96$ timesteps, corresponding to 24 hours at 15-minute intervals) is computed:

$$m_c(t) = \text{median}\left(x_c[t - W : t]\right)$$

$$\text{MAD}_{roll, c}(t) = 1.4826 \cdot \text{median}\left(\left|x_c[t - W : t] - m_c(t)\right|\right)$$

The context-aware robust standardized deviation $Z_c(t)$ is defined as:

$$Z_c(t) = \frac{x_c(t) - m_c(t)}{\max\left(\text{MAD}_{roll, c}(t), \epsilon_c\right)}$$

where $\epsilon_c > 0$ is a strictly positive regularizer preventing numerical divergence during hyper-stable thermal plateaus (default $\epsilon_T = 0.25^\circ\text{C}$, $\epsilon_H = 1.5\%$).

#### Management Event Attenuation
Apiary inspection visits cause unavoidable transient microclimate disruptions due to roof removal and frame manipulation. Using documented apiary visit logs $\mathcal{V} = \{[v_k^{\text{start}}, v_k^{\text{end}}]\}$, an attenuation multiplier $M(t)$ is computed:

$$M(t) = \begin{cases} 
0.35, & \text{if } \exists k \text{ s.t. } t \in [v_k^{\text{start}}, v_k^{\text{end}} + \delta_{\text{recovery}}] \\ 
1.00, & \text{otherwise} 
\end{cases}$$

where $\delta_{\text{recovery}} = 2.0\text{ hours}$ accounts for post-inspection thermal re-equilibration by the colony.

---

### 2.2 Module B: Sensor Reliability & Data-Quality Subsystem

Sensor hardware faults must never be reported as biological colony disease. Module B evaluates five discrete fault indicators on each sensor stream $s \in \{1, \dots, C\}$:

1. **Missing Data / Dropout:**
   $$f_{\text{missing}, s}(t) = \mathbb{I}\left(x_s(t) \text{ is NaN or } \Delta t > 1.5 \cdot \Delta t_{\text{nominal}}\right)$$

2. **Stuck / Frozen Sensor Detection:**
   Physical environmental channels naturally fluctuate due to thermal diffusion and atmospheric turbulence. If a sensor reports identical numerical values for $K$ consecutive timesteps ($K = 6$, corresponding to 90 minutes):
   $$f_{\text{stuck}, s}(t) = \mathbb{I}\left(\text{Var}\left(x_s[t - K + 1 : t]\right) < \sigma^2_{\min}\right)$$
   *(Note: Applied strictly to dynamic environmental variables $T$ and $H$; DC battery voltage `hive_power` is exempted).*

3. **Physical Bound Breaches:**
   Based on physical sensor data-sheets and biological limits:
   $$f_{\text{bounds}, s}(t) = \mathbb{I}\left(x_s(t) < x_{s}^{\min} \lor x_s(t) > x_{s}^{\max} \lor |x_s(t) - x_s(t-1)| > \Delta_{\max}\right)$$
   Standard physical bounds:
   - Temperature: $T \in [-10.0^\circ\text{C}, 55.0^\circ\text{C}]$, $\Delta_{\max} = 4.0^\circ\text{C}$ / 15 min.
   - Humidity: $H \in [5.0\%, 99.0\%]$, $\Delta_{\max} = 20.0\%$ / 15 min.
   - Weight: $W \in [5.0\text{ kg}, 120.0\text{ kg}]$, $\Delta_{\max} = 5.0\text{ kg}$ / 15 min.

4. **Isolated Impulse Spike Detection:**
   Isolated transmission glitches deviate sharply from both preceding and succeeding values:
   $$\bar{x}_{\text{local}, s}(t) = \frac{x_s(t-1) + x_s(t+1)}{2}$$
   $$S_{z, s}(t) = \frac{\left|x_s(t) - \bar{x}_{\text{local}, s}(t)\right|}{\max\left(\text{MAD}_{roll, s}(t), \epsilon_s\right)}$$
   $$f_{\text{spike}, s}(t) = \mathbb{I}\left(S_{z, s}(t) > \theta_{\text{spike}} \land |x_s(t-1) - x_s(t+1)| \le \Delta_{\text{smooth}}\right)$$

5. **High-Frequency Variance / Electrical Noise:**
   $$f_{\text{noise}, s}(t) = \mathbb{I}\left(\frac{\text{MAD}_{\text{short}, s}(t)}{\text{MAD}_{\text{long}, s}(t)} > \theta_{\text{noise}}\right)$$

#### Continuous Channel Reliability Score
The discrete fault flags are integrated into a continuous channel reliability score $R_s(t) \in [0.0, 1.0]$:

$$R_s(t) = \max\left(0.0, 1.0 - \sum_{k} w_k \cdot f_{k, s}(t)\right)$$

where weights $w_{\text{missing}} = 1.0$, $w_{\text{out\_of\_bounds}} = 0.9$, $w_{\text{stuck}} = 0.7$, $w_{\text{spike}} = 0.75$, and $w_{\text{noise}} = 0.4$.

The composite sensor reliability of the monitoring node is:

$$R_{\text{hive}}(t) = \frac{1}{|S_{\text{env}}|} \sum_{s \in S_{\text{env}}} R_s(t)$$

Categorical classification:
- **`RELIABLE`:** $R_{\text{hive}}(t) \ge 0.85$
- **`DEGRADED`:** $0.50 \le R_{\text{hive}}(t) < 0.85$
- **`FAULTY`:** $R_{\text{hive}}(t) < 0.50$

---

### 2.3 Module C: Persistence-Aware Anomaly Scoring and Multi-Channel Consensus

#### Multi-Channel Agreement Factor $A(t)$
True biological disturbances affect multiple coupled state variables simultaneously. For instance, thermal breakdown during brood chilling correlates with moisture condensation and altered fanning acoustics. The agreement factor $A(t)$ scales confidence:

$$A(t) = \begin{cases}
1.00, & \text{if } |Z_T(t)| > \theta_z \land |Z_H(t)| > \theta_z \quad (\text{Cross-sensor corroboration}) \\
0.85, & \text{if } |Z_T(t)| > \theta_z \land |Z_H(t)| \le \theta_z \quad (\text{Primary thermal excursion}) \\
0.50, & \text{if } |Z_T(t)| \le \theta_z \land |Z_H(t)| > \theta_z \quad (\text{Secondary humidity excursion}) \\
0.10, & \text{otherwise}
\end{cases}$$

#### Temporal Persistence Tracking $P(t)$
Isolated single-interval anomalies have high likelihood of being non-biological transients. Biological colony phenomena evolve over multiple hours. A persistence counter tracks consecutive abnormal intervals:

$$k_{\text{active}}(t) = \begin{cases}
k_{\text{active}}(t-1) + 1, & \text{if } \max(|Z_T(t)|, |Z_H(t)|) > \theta_z \\
\max(0, k_{\text{active}}(t-1) - 1), & \text{otherwise}
\end{cases}$$

The persistence multiplier $P(t) \in [0.0, 1.0]$ is defined with minimum duration parameter $\tau_{\min}$ (default $\tau_{\min} = 3$ timesteps, equal to 45 minutes):

$$P(t) = \min\left(1.0, \frac{k_{\text{active}}(t)}{\tau_{\min}}\right)$$

#### Composite Anomaly Score Formulation
The composite continuous anomaly score $S(t) \in [0.0, 100.0]$ is computed as:

$$S(t) = \left[\min\left(1.0, \frac{\max(|Z_T(t)|, 0.7 \cdot |Z_H(t)|)}{3.5}\right)\right] \times P(t) \times A(t) \times R_{\text{hive}}(t) \times M(t) \times 100.0$$

#### Decision Logic and Warning Categorization
Each timestep is classified into one of five mutually exclusive operational states:

```
IF (has_hardware_fault OR R_hive(t) < 0.50):
    CATEGORY = "SENSOR_RELIABILITY_WARNING"
    ALERT_TRIGGER = TRUE, BIOLOGICAL_ALARM = FALSE, HARDWARE_FAULT = TRUE
ELSE IF (is_management_event AND candidate_anomaly):
    CATEGORY = "MANAGEMENT_EVENT_ATTENUATED"
    ALERT_TRIGGER = FALSE, BIOLOGICAL_ALARM = FALSE, HARDWARE_FAULT = FALSE
ELSE IF (S(t) >= 50.0):
    CATEGORY = "PERSISTENT_BIOLOGICAL_ANOMALY"
    ALERT_TRIGGER = TRUE, BIOLOGICAL_ALARM = TRUE, HARDWARE_FAULT = FALSE
ELSE IF (S(t) >= 25.0):
    CATEGORY = "ENVIRONMENTAL_DEVIATION"
    ALERT_TRIGGER = FALSE, BIOLOGICAL_ALARM = FALSE, HARDWARE_FAULT = FALSE
ELSE:
    CATEGORY = "NORMAL"
    ALERT_TRIGGER = FALSE, BIOLOGICAL_ALARM = FALSE, HARDWARE_FAULT = FALSE
```

---

## 3. The MSPB Honeybee Research Dataset Alignment

### 3.1 Provenance and Metadata
The empirical foundation of the HIVEGUARD research platform is the open-access **MSPB dataset**:
- **Title:** Multi-Sensor dataset with Phenotypic trait measurements from honey Bees (MSPB)
- **Reference:** Zhu, Y., Abdollahi, M., Maucourt, S., Coallier, N., Guimarães, H. R., Giovenazzo, P., & Falk, T. H. (2024). *Scientific Data*, 11(1), 1-13. [DOI: 10.1038/s41597-024-03695-1](https://doi.org/10.1038/s41597-024-03695-1)
- **Repository:** Zenodo Record 8371700 (`https://doi.org/10.5281/zenodo.8371700`)
- **License:** Creative Commons Attribution-NonCommercial 4.0 International (`CC-BY-NC-4.0`)
- **Geography:** 53 *Apis mellifera* colonies situated at two experimental apiaries in Québec, Canada (Saint-Marc-des-Carrières and Deschambault).
- **Time Span:** One complete calendar year (April 16, 2020 to April 14, 2021).
- **Volume:** **1,836,915 raw multi-sensor telemetry rows** across two distinct seasons:
  - Season D1 (Active Summer): 960,809 records (April 16 – November 5, 2020)
  - Season D2 (Overwintering): 876,106 records (November 6, 2020 – April 14, 2021)

### 3.2 Telemetry Variables and Cadence
- **Cadence:** Uniform 15-minute sampling interval (900 seconds).
- **Recorded Physical Variables:**
  - `temperature`: Internal hive brood chamber temperature ($^\circ\text{C}$).
  - `humidity`: Internal hive relative humidity ($\%$).
  - `hive_power`: Telemetry node battery and supply power (dBm / V).
  - `audio_density`, `audio_density_ratio`, `density_variation`: Continuous acoustic spectral features.
  - 16 audio frequency bands (`hz_122` through `hz_579.8`).
- **Ground-Truth Phenotypic Records:**
  - 16 documented apiary inspection visits (`D1_ant.xlsx`).
  - Standardized *Varroa destructor* mite washes (mites / 100 bees).
  - Photographic brood surface area evaluations (capped vs. open cells).
  - Total honey yield harvested (kg).
  - Overwintering survival status and winter feed consumption (`D2_ant.xlsx`).

### 3.3 Explicit Accounting of Missing Channels
In adherence to scientific integrity principles:
1. **Continuous Scale Weight:** Scale weight was **not recorded continuously** at 15-minute intervals in the MSPB dataset; only discrete milestone weigh-ins (harvested honey weight, pre-winter weight, post-winter weight) exist in the field logs. The HIVEGUARD MSPB loader explicitly documents this absence and does not fabricate synthetic 15-minute weights.
2. **External Weather Station Data:** External ambient temperature was recorded at regional meteorological stations but not included within the internal hive probe stream `D1_sensor_data.csv`. The framework operates strictly on internal sensors when evaluating MSPB.

---

## 4. Tri-Method Benchmarking and Quantitative Results

To validate the framework, we benchmark three distinct paradigms on identical real telemetry streams subjected to controlled, reproducible test scenarios:

### 4.1 Benchmarked Methods
- **Method A (Fixed Thresholds):** Standard static industry thresholding ($T < 32^\circ\text{C}$ or $T > 36^\circ\text{C}$; $H < 45\%$ or $H > 70\%$).
- **Method B (Rolling Statistical Baseline):** Unconditioned rolling median and MAD standard deviation. Alerts on statistical outliers without sensor reliability assessment or persistence gating.
- **Method C (HIVEGUARD Proposed Framework):** Diurnal profile baseline, continuous reliability weighting $R_s(t)$, multi-channel consensus $A(t)$, and persistence filter $P(t)$.

### 4.2 Benchmark Scenarios and Audited Results

#### Experiment 1: Isolated Hardware Transmission Spike (+15°C Glitch, 1 Timestep)
- **Objective:** Evaluate resilience against false alarms caused by electrical/I2C transmission glitches.
- **Injected Fault:** Single-timestep $+15.0^\circ\text{C}$ pulse on `temperature_C` at $t = 150$. Ground-truth: Hardware Fault (Positives = 1, Negatives = 399).
- **Dataset Slice:** `MSPB_HIVE_2046` (first 400 observations = 4.167 days).

| Metric | Method A (Fixed) | Method B (Rolling MAD) | Method C (HIVEGUARD) | Verification Status |
| :--- | :---: | :---: | :---: | :--- |
| **Confusion Matrix** | `[[171, 228], [0, 1]]` | `[[336, 63], [0, 1]]` | `[[395, 4], [0, 1]]` | **Exact Recalculation** |
| **FAR (alarms / 24h)** | **54.72** | **15.12** | **0.96** | **98.25% Reduction (Verified)** |
| **FAR Reduction (20 runs)** | — | — | **98.66% ± 0.15%** | **Statistically Verified** |
| **Positive Precision** | 0.0044 | 0.0156 | **0.2000** | Corrected from old 1.000 |
| **Positive Recall** | 1.0000 | 1.0000 | **1.0000** | Verified |
| **Positive Class $F_1$** | 0.0087 | 0.0308 | **0.3333** | Verified |
| **Negative Precision** | 1.0000 | 1.0000 | **1.0000** | Verified |
| **Negative Recall** | 0.4286 | 0.8421 | **0.9900** | Source of old 0.990 value |
| **Macro $F_1$ Score** | **0.3043** | **0.4725** | **0.6641** | Corrected from old 0.990 |
| **Detection Delay** | 0.0 min | 0.0 min | 0.0 min | 15-min edge buffer declared |
| **Runtime Latency** | 0.28 ms | 88.5 ms | 96.3 ms | Real-time edge compatible |

#### Experiment 2: Sustained Brood Chilling Stress (-6.5°C over 8 steps)
- **Objective:** Evaluate detection sensitivity and latency for genuine biological emergencies.
- **Simulated Stress:** Progressive $-6.5^\circ\text{C}$ depression over 8 consecutive timesteps (2.0 hours). Ground-truth: Biological Stress (Positives = 8, Negatives = 392).

| Metric | Method A (Fixed) | Method B (Rolling MAD) | Method C (Bio Flag Only) | Method C (Composite Alarm) |
| :--- | :---: | :---: | :---: | :---: |
| **True Positives (TP)** | 4 | 3 | **0** | **5** |
| **False Positives (FP)** | 221 | 63 | **52** | **57** |
| **Positive Precision** | 0.0178 | 0.0455 | **0.0000** | **0.0806** |
| **Positive Recall** | 0.5000 | 0.3750 | **0.0000** | **0.6250** |
| **FAR (alarms / 24h)** | 53.04 | 15.12 | **12.48** | **13.68** |
| **Detection Delay** | 0.0 min | 75.0 min | N/A (Missed) | 45.0 min (3 steps) |

**Diagnostic Discussion:** During severe and rapid hypothermia, the large negative step delta ($|\Delta T| > 4.0^\circ\text{C}$ across 2 steps) triggers the sensor data-quality subsystem (`overall_sensor_reliability` drops to 0.450). Consequently, Method C routes the alert to `SENSOR_RELIABILITY_WARNING` rather than `PERSISTENT_BIOLOGICAL_ANOMALY`. While the system alerts the beekeeper (Composite Recall = 62.5%), it misattributes rapid hypothermia as hardware degradation due to probe sensitivity. This finding highlights a key scientific trade-off documented for future multi-sensor spatial decoupling.

---

## 5. Data Leakage Prevention and Evaluation Protocol

1. **Chronological Forward Splitting:** In all baseline fittings, historical statistics are computed strictly on historical data $t' < t$. Future data points are never accessed during rolling median or MAD calculations.
2. **Quarantined Ground Truth:** Target event labels are completely isolated from feature extraction and baseline calculation pipelines.
3. **Audit of Legacy Claims:** The repository previously displayed a $99.9\%$ accuracy claim. Our audit revealed this was generated by training a Random Forest on `HIVEGUARD_ML_Bee_Disease_Synthetic_10000.csv`, which contained artificially separated Gaussian clusters ($\sigma \approx 0.4^\circ\text{C}$). The codebase and dashboard have been explicitly updated to designate this metric as *"Legacy Prototype Demonstration on Synthetic Clustered Data"*, replacing it with empirical benchmarks evaluated on verified MSPB research data.

---

## 6. Scientific Limitations and Scope

1. **Non-Invasive Decision Support:** HIVEGUARD is an IoT anomaly detection and telemetry reliability platform. It is **not** an automated veterinary diagnostic device. Anomaly alerts indicate microclimatic and physical disequilibrium requiring physical inspection by qualified beekeepers.
2. **Current Hardware Prototype Status:** The physical hardware prototype (ESP32 micro-controller, DHT22 temperature/humidity sensor, HX711 load cell amplifier) has been validated in laboratory bench simulations. Due to seasonal constraints, physical live-colony deployment on *Apis cerana indica* is scheduled for the upcoming active season.
3. **Sensor Coupling Limitations:** Single-point sensor placement inside the hive measures local microclimate. Central brood frames exhibit significantly tighter homeostatic regulation than peripheral honey frames. Multi-sensor spatial mapping is recommended where hardware budgets permit.

---

## References

1. Zhu, Y., Abdollahi, M., Maucourt, S., Coallier, N., Guimarães, H. R., Giovenazzo, P., & Falk, T. H. (2024). *MSPB: a longitudinal multi-sensor dataset with phenotypic trait measurements from honey bees*. Nature Scientific Data, 11(1), 1-13. [DOI: 10.1038/s41597-024-03695-1](https://doi.org/10.1038/s41597-024-03695-1)
2. Seeley, T. D. (1985). *Honeybee Ecology: A Study of Adaptation in Social Life*. Princeton University Press.
3. Heinrich, B. (1993). *The Hot-Blooded Insects: Strategies and Mechanisms of Thermoregulation*. Harvard University Press.
4. Rousseeuw, P. J., & Croux, C. (1993). *Alternatives to the Median Absolute Deviation*. Journal of the American Statistical Association, 88(424), 1273-1283.
5. Meikle, W. G., & Holst, N. (2015). *Application of continuous monitoring of honeybee colonies*. Apidologie, 46(1), 10-22.
