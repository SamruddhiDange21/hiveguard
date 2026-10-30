# MSPB Research Dataset: Verified Ingestion & Technical Audit Report

**Audit Date:** 2026-10-29 23:51:33  
**Dataset Identifier:** `MSPB` (Multi-Sensor dataset with Phenotypic trait measurements from honey Bees)  
**Publication Citation:**  
> Zhu, Y., Abdollahi, M., Maucourt, S., Coallier, N., Guimarães, H. R., Giovenazzo, P., & Falk, T. H. (2024).  
> *MSPB: a longitudinal multi-sensor dataset with phenotypic trait measurements from honey bees.*  
> **Scientific Data**, 11(1), 1-13. [DOI: 10.1038/s41597-024-03695-1](https://doi.org/10.1038/s41597-024-03695-1)  

**Official Data Repository:** [Zenodo Record 8371700](https://doi.org/10.5281/zenodo.8371700)  
**Official Code Repository:** [GitHub: MuSAELab/MSPB](https://github.com/MuSAELab/MSPB)  
**License:** Creative Commons Attribution-NonCommercial 4.0 International (`CC-BY-NC-4.0`)  
**Data Integrity Status:** 100% Downloaded from official repository, verified, and preserved in `data/raw/mspb/`.

---

## 1. Raw Files Verified & Preserved

| Raw File | File Size | Description | Records / Rows |
| :--- | :--- | :--- | :--- |
| `D1_sensor_data.csv` | **211.18 MB** | Summer / Active season multi-sensor continuous telemetry (Apr 16, 2020 – Nov 5, 2020) | **960,809 rows** |
| `D2_sensor_data.csv` | **184.14 MB** | Winter / Overwintering season multi-sensor continuous telemetry (Nov 6, 2020 – Apr 14, 2021) | **876,106 rows** |
| `D1_ant.xlsx` | **62.3 KB** | Expert evaluations, colony metadata, apiary visits, and phenotypic traits | 10 Worksheets |
| `D2_ant.xlsx` | **15.4 KB** | Wintering outcomes, mortality causes, spring viability, and feeding consumption | 45 Colonies |
| **Total Telemetry** | **395.32 MB** | Continuous longitudinal recordings across 1 full calendar year | **1,836,915 sensor rows** |

---

## 2. Variables & Sampling Schema

### A. Raw Sensor Telemetry (`D1_sensor_data.csv`, `D2_sensor_data.csv`)
- **Sampling Cadence:** **15-minute nominal sampling intervals** (900 seconds).
- **Core Environmental Sensors:**
  - `temperature`: Internal chamber/brood temperature in °C. Mean: 30.31°C (summer range 0.24°C – 46.45°C; active brood cluster centered around 33.6°C – 34.9°C).
  - `humidity`: Internal relative humidity in %. Mean: 47.31% (range 14.3% – 90.9%).
  - `hive_power`: Sensor supply voltage/power (dBm/V) reflecting telemetry reliability and battery stability.
- **Acoustic Audio Spectral Features (20 features):**
  - `audio_density`: Acoustic energy density inside hive.
  - `audio_density_ratio`: Ratio of active hive band power over total acoustic energy.
  - `density_variation`: Short-term variance in sound energy.
  - 16 discrete frequency band levels (`hz_122` through `hz_579.8`).
- **Identifiers & Geo-location:**
  - `beehub_name`: Apiary base station (`nectar-bh131` at Dubuc yard; `nectar-bh121` at Côté yard).
  - `tag_number`: Unique 6-digit sensor probe identifier (85 active tags).

### B. Phenotypic Traits & Ground-Truth Biological Labels (`D1_ant.xlsx`, `D2_ant.xlsx`)
- **Apiary Visits & Manipulations (`mspb_visits_manipulations.csv`):** 16 documented apiary visit events with timestamps, arrival/departure hours, and notes (e.g. honey harvesting, syrup feeding, queen verification).
- **Varroa Mite Infestation:** Documented periodic mite washes (`Nb varroa / 100 bees`) conducted in June and August 2020.
- **Brood Development:** Number of sealed and open brood cells counted via photographic frame analysis.
- **Colony Population:** Number of frames covered by bees across brood boxes and honey supers over 6 inspection rounds.
- **Total Honey Production:** Kilograms of harvested honey per colony over the season.
- **Overwintering Viability:** 45 colonies evaluated in spring 2021 with explicit survival status, causes of mortality, and syrup consumption.

---

## 3. Compatibility & Support for HIVEGUARD Research Framework

| Proposed Research Module | MSPB Support Status | Implementation Strategy |
| :--- | :--- | :--- |
| **Context-Aware Temporal Baseline** | **EXCELLENT (Supported)** | Continuous 15-minute timestamps over 7+ months allow hour-of-day diurnal conditioning and rolling median calculation. Exact apiary visit timestamps in `mspb_visits_manipulations.csv` allow explicit masking of human-induced microclimate disruptions. |
| **Sensor Reliability Assessment** | **EXCELLENT (Supported)** | Real telemetry contains authentic sensor dropouts, transmission pauses, and battery fluctuations (`hive_power`). Grounded fault-injection can be rigorously evaluated against pristine intervals. |
| **Persistence-Aware Anomaly Scoring** | **EXCELLENT (Supported)** | Multi-month continuous telemetry allows testing persistence windows (e.g., 2 hours vs 6 hours vs 24 hours) without boundary truncation. |
| **Multi-Sensor Channel Agreement** | **EXCELLENT (Supported)** | Internal Temperature, Internal Humidity, and Acoustic Density provide three independent physical channels to test consensus gating. |
| **Gross Hive Weight (Continuous 15-min)** | **PARTIAL (Documented Limitation)** | Continuous scale weight was **not recorded at 15-minute intervals** in MSPB. Hive weight is available only as periodic milestone evaluations (weight before winter, spring weight, and total honey yield). The framework transparently handles datasets without continuous weight. |
| **Outside Ambient Weather** | **DERIVED / CONTROL** | Ambient weather was not recorded inside `D1_sensor_data.csv`. Can be derived using uncolonized control probes or microclimate baselines. |

---

## 4. Standardized Working Copies Generated (`data/processed/mspb/`)

1. `mspb_telemetry_benchmark_50k.csv`: Standardized, continuous multi-hive research dataset (86,453 rows) ready for instant dashboard visualization and algorithm benchmarking.
2. `mspb_hive_metadata.csv`: Standardized mapping between Bee Hub IDs, Colony IDs, and Apiaries (53 colonies).
3. `mspb_sensor_tag_index.csv`: Index of all 85 sensor probes with record counts and date ranges.
4. `mspb_visits_manipulations.csv`: Formatted management events for context-aware filtering.
5. `mspb_phenotypic_evaluations.csv`: Standardized Varroa, brood, and honey production records.
6. `mspb_winter_outcomes.csv`: Ground-truth overwintering mortality labels.

---

## 5. Provenance & Research Ethics Declaration

- **Data Provenance:** Real physical sensor recordings from *Apis mellifera* colonies collected in Québec, Canada by Laval University & INRS researchers.
- **No Fabricated Labels:** The dataset labels are strictly those collected by the original researchers; no synthetic labels or artificial disease diagnoses have been appended.
- **Citation Requirement:** Any published research using this data must cite Zhu et al. (*Scientific Data*, 2024, DOI: 10.1038/s41597-024-03695-1).
