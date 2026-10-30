# METHODOLOGY: Theoretical Foundations, Formulations & Empirical Evaluation

**Project Title:** HIVEGUARD  
**Scientific Document:** Methodology Specification  
**Version:** 2.1.0-Audited  
**Date:** October 30, 2026  

---

## 1. Domain Background & Problem Formulation

Precision apiculture leverages embedded micro-controllers and digital telemetry probes to monitor honeybee (*Apis mellifera* / *Apis cerana*) brood nest microclimates. Active honeybee colonies regulate their central brood nest within a narrow thermal band ($33.5^\circ\text{C} - 35.5^\circ\text{C}$) and relative humidity between $45\% - 65\%$. 

Traditional thresholding systems ($32^\circ\text{C} \le T \le 36^\circ\text{C}$) exhibit two major failure modes:
1. **Severe False Alarm Rates (FAR):** Cold morning ambient coupling, overwintering cluster contractions, and beekeeper inspections cause frequent non-pathological breaches.
2. **Sensor Fault Misclassification:** Digital bus glitches (e.g. DHT22 / DS18B20 single-reading spikes) or stuck analog-to-digital converters are misclassified by naive ML models as biological colony emergencies.

The **HIVEGUARD Framework** resolves these challenges by integrating:
- **Module A: Context-Aware Temporal Baselines**
- **Module B: Sensor Reliability & Data-Quality Subsystem**
- **Module C: Persistence-Aware Scoring & Multi-Channel Consensus**

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

---

## 2. Mathematical Formulations

### 2.1 Module A: Context-Aware Temporal Baseline
Let $x_c(t)$ be the measurement of channel $c$ at timestamp $t$, with hour of day $h = \text{hour}(t) \in \{0, \dots, 23\}$.

#### Diurnal Baseline & Robust Scale
Historical hour-of-day expected baseline $\hat{\mu}_c(h)$ and Median Absolute Deviation $\text{MAD}_c(h)$ are estimated over historical observations:

$$\hat{\mu}_{c}(h) = \text{median}\left(\left\{x_c(\tau) \mid \tau \in \mathcal{T}_{\text{hist}}, \text{hour}(\tau) = h\right\}\right)$$

$$\text{MAD}_c(h) = 1.4826 \cdot \text{median}\left(\left\{\left|x_c(\tau) - \hat{\mu}_c(h)\right| \mid \tau \in \mathcal{T}_{\text{hist}}, \text{hour}(\tau) = h\right\}\right)$$

#### Backward-Looking Rolling Baseline
To capture local trends without lookahead leakage, a backward-looking window of $W = 24$ timesteps (6 hours at 15-minute sampling) is computed:

$$m_c(t) = \text{median}\left(x_c[t - W : t]\right)$$

$$\text{MAD}_{\text{roll}, c}(t) = 1.4826 \cdot \text{median}\left(\left|x_c[t - W : t] - m_c(t)\right|\right)$$

The regularized standardized deviation $Z_c(t)$ is defined as:

$$Z_c(t) = \frac{x_c(t) - m_c(t)}{\max\left(\text{MAD}_{\text{roll}, c}(t), \epsilon_c\right)}$$

where $\epsilon_T = 0.25^\circ\text{C}$ and $\epsilon_H = 1.5\%$ prevent division by zero during hyper-stable periods.

#### Management Event Attenuation
Using documented apiary visit logs $\mathcal{V} = \{[v_k^{\text{start}}, v_k^{\text{end}}]\}$, an attenuation multiplier $M(t)$ suppresses false alarms during known inspections:

$$M(t) = \begin{cases} 
0.35, & \text{if } \exists k \text{ s.t. } t \in [v_k^{\text{start}}, v_k^{\text{end}} + \delta_{\text{recovery}}] \\ 
1.00, & \text{otherwise} 
\end{cases}$$

---

### 2.2 Module B: Sensor Reliability & Data Quality
Sensor hardware failures must never be reported as biological emergencies. Five discrete indicators are computed for each channel $s$:

1. **Packet Dropout / Missingness:** $f_{\text{missing}, s}(t) = \mathbb{I}(x_s(t) \text{ is NaN} \lor \Delta t > 1.5 \Delta t_{\text{nominal}})$
2. **Stuck / Frozen Sensor ($K=6$ steps = 90 min):** $f_{\text{stuck}, s}(t) = \mathbb{I}(\text{Var}(x_s[t-K+1 : t]) < 10^{-4})$
3. **Physical Limits & Step Violations:** $f_{\text{bounds}, s}(t) = \mathbb{I}(x_s(t) < x_s^{\min} \lor x_s(t) > x_s^{\max} \lor |x_s(t) - x_s(t-1)| > \Delta_{\max})$
4. **Impulse Spike Detection:** $f_{\text{spike}, s}(t) = \mathbb{I}(S_{z,s}(t) > 3.0 \land |x_s(t-1) - x_s(t+1)| \le \Delta_{\text{smooth}})$
5. **High-Frequency Variance Ratio:** $f_{\text{noise}, s}(t) = \mathbb{I}(\text{MAD}_{\text{short}}(t) / \text{MAD}_{\text{long}}(t) > \theta_{\text{noise}})$

Continuous channel reliability:

$$R_s(t) = \max\left(0.0, 1.0 - \sum_k w_k f_{k,s}(t)\right)$$

Composite hive sensor reliability:

$$R_{\text{hive}}(t) = \frac{1}{|S_{\text{env}}|} \sum_{s \in S_{\text{env}}} R_s(t)$$

Categorization:
- **`RELIABLE`:** $R_{\text{hive}}(t) \ge 0.85$
- **`DEGRADED`:** $0.50 \le R_{\text{hive}}(t) < 0.85$
- **`FAULTY`:** $R_{\text{hive}}(t) < 0.50$

---

### 2.3 Module C: Persistence-Aware Scoring & Multi-Channel Consensus

#### Multi-Channel Agreement Factor $A(t)$
$$A(t) = \begin{cases}
1.00, & \text{if } |Z_T(t)| > 2.2 \land |Z_H(t)| > 1.8 \\
0.85, & \text{if } |Z_T(t)| > 2.2 \land |Z_H(t)| \le 1.8 \\
0.50, & \text{if } |Z_T(t)| \le 2.2 \land |Z_H(t)| > 2.2 \\
0.10, & \text{otherwise}
\end{cases}$$

#### Temporal Persistence Filter $P(t)$
With minimum duration parameter $\tau_{\min} = 4$ steps (1.0 hour):

$$P(t) = \min\left(1.0, \frac{k_{\text{consecutive}}(t)}{\tau_{\min}}\right)$$

#### Composite Anomaly Score Formulation
$$S(t) = \left[\min\left(1.0, \frac{\max(|Z_T(t)|, 0.7 |Z_H(t)|)}{3.5}\right)\right] \times P(t) \times A(t) \times R_{\text{hive}}(t) \times M(t) \times 100.0$$

#### Warning Taxonomy Decision Logic
```
IF (has_hardware_fault OR R_hive(t) < 0.50):
    CATEGORY = "SENSOR_RELIABILITY_WARNING" [Alert=True, Bio=False, HW=True]
ELSE IF (is_management_event AND candidate_anomaly):
    CATEGORY = "MANAGEMENT_EVENT_ATTENUATED" [Alert=False, Bio=False, HW=False]
ELSE IF (S(t) >= 50.0):
    CATEGORY = "PERSISTENT_BIOLOGICAL_ANOMALY" [Alert=True, Bio=True, HW=False]
ELSE IF (S(t) >= 25.0):
    CATEGORY = "ENVIRONMENTAL_DEVIATION" [Alert=False, Bio=False, HW=False]
ELSE:
    CATEGORY = "NORMAL" [Alert=False, Bio=False, HW=False]
```

---

## 3. Audited Benchmarking Results

### Experiment 1: Isolated Hardware Transmission Spike (+15°C, 1 timestep)
Evaluated on real telemetry from colony `MSPB_HIVE_2046` (400 steps, 4.167 days).

| Metric | Method A (Fixed) | Method B (Rolling MAD) | Method C (HIVEGUARD) | Verification Status |
| :--- | :---: | :---: | :---: | :--- |
| **Confusion Matrix** | `[[171, 228], [0, 1]]` | `[[336, 63], [0, 1]]` | `[[395, 4], [0, 1]]` | Verified |
| **FAR (alarms / 24h)** | **54.72** | **15.12** | **0.96** | **98.25% Reduction (Verified)** |
| **FAR Reduction (20 runs)** | — | — | **98.66% ± 0.15%** | **Statistically Verified** |
| **Positive Precision** | 0.0044 | 0.0156 | **0.2000** | Corrected from old 1.000 |
| **Positive Recall** | 1.0000 | 1.0000 | **1.0000** | Verified |
| **Positive Class $F_1$** | 0.0087 | 0.0308 | **0.3333** | Verified |
| **Negative Precision** | 1.0000 | 1.0000 | **1.0000** | Verified |
| **Negative Recall** | 0.4286 | 0.8421 | **0.9900** | Source of the "0.990" value |
| **Macro $F_1$ Score** | **0.3043** | **0.4725** | **0.6641** | Corrected from old 0.990 |
| **Detection Delay** | 0.0 min | 0.0 min | 0.0 min | 15-min edge buffer declared |
| **Runtime Latency** | 0.28 ms | 88.5 ms | 96.3 ms | Real-time edge compatible |

---

## 4. Methodological Scope & Ethical Declaration

1. **Non-Invasive Decision Support:** The system detects physiological and data-quality disequilibrium; it does not replace professional apiary veterinary diagnosis.
2. **Provenance Segregation:** The platform strictly isolates real physical research telemetry (MSPB) from controlled simulated faults and legacy synthetic demonstration models.
3. **Physical Deployment Status:** Bench-tested with ESP32 micro-controllers; physical in-hive validation on *Apis cerana indica* colonies is planned for the upcoming active season.
