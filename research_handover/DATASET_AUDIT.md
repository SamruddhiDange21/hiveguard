# DATASET AUDIT: Verified Ingestion, Provenance & Preprocessing of the MSPB Research Dataset

**Dataset Name:** MSPB (Multi-Sensor dataset with Phenotypic trait measurements from honey Bees)  
**Audit Date:** October 30, 2026  
**Primary Citation:**  
> Zhu, Y., Abdollahi, M., Maucourt, S., Coallier, N., Guimarães, H. R., Giovenazzo, P., & Falk, T. H. (2024).  
> *MSPB: a longitudinal multi-sensor dataset with phenotypic trait measurements from honey bees.*  
> **Scientific Data**, 11(1), 1-13. [DOI: 10.1038/s41597-024-03695-1](https://doi.org/10.1038/s41597-024-03695-1)  

**Official Repository:** [Zenodo Record 8371700](https://doi.org/10.5281/zenodo.8371700)  
**Official Codebase:** [GitHub: MuSAELab/MSPB](https://github.com/MuSAELab/MSPB)  
**License:** Creative Commons Attribution-NonCommercial 4.0 International (`CC-BY-NC-4.0`)  
**Data Integrity Status:** 100% Downloaded from official repository, checksums verified, and preserved in `data/raw/mspb/`.

---

## 1. Raw Files Verified & Preserved

| Raw File Path | Size on Disk | Records / Rows | Description |
| :--- | :---: | :---: | :--- |
| `data/raw/mspb/D1_sensor_data.csv` | **211.18 MB** | **960,809 rows** | Summer / Active season telemetry (Apr 16, 2020 – Nov 5, 2020) |
| `data/raw/mspb/D2_sensor_data.csv` | **184.14 MB** | **876,106 rows** | Winter / Overwintering season telemetry (Nov 6, 2020 – Apr 14, 2021) |
| `data/raw/mspb/D1_ant.xlsx` | **62.3 KB** | 10 Worksheets | Apiary visits, sensor tag mappings, Varroa counts, brood areas |
| `data/raw/mspb/D2_ant.xlsx` | **15.4 KB** | 45 Colonies | Wintering mortality causes, spring survival status, syrup consumption |
| **Total Telemetry** | **395.32 MB** | **1,836,915 rows** | Continuous 1-year longitudinal dataset across 53 colonies |

Raw files are preserved in `data/raw/mspb/` with read-only permissions and are strictly excluded from git tracking (`.gitignore`) to comply with GitHub file size constraints (< 100 MB).

---

## 2. Variables & Sampling Schema

### A. Raw Sensor Telemetry (`D1_sensor_data.csv`, `D2_sensor_data.csv`)
- **Sampling Interval:** Nominal **15 minutes** (900 seconds).
- **Core Environmental Probes:**
  - `temperature`: Internal chamber/brood temperature in °C. Mean: 30.31°C (summer range 0.24°C – 46.45°C; active brood cluster centered around 33.6°C – 34.9°C).
  - `humidity`: Internal relative humidity in %. Mean: 47.31% (range 14.3% – 90.9%).
  - `hive_power`: Battery/supply voltage (dBm / V) reflecting probe power integrity.
- **Acoustic Features (20 variables):**
  - `audio_density`: Acoustic energy density.
  - `audio_density_ratio`: Ratio of active hive band power over total acoustic energy.
  - `density_variation`: Variance in sound energy.
  - 16 discrete frequency bands (`hz_122` through `hz_579.8`).
- **Colony Identifiers & Geography:**
  - 53 *Apis mellifera* colonies located at two experimental apiaries in Québec, Canada:
    - **Dubuc yard:** `nectar-bh131` base station in Saint-Marc-des-Carrières (46°40' N, 72°02' W).
    - **Côté yard:** `nectar-bh121` base station in Deschambault (46°39' N, 71°55' W).
  - Sensor tag index: 85 unique active probes.

### B. Biological Labels & Phenotypic Ground Truth (`D1_ant.xlsx`, `D2_ant.xlsx`)
- **Apiary Visits & Manipulations (`mspb_visits_manipulations.csv`):** 16 documented apiary visit events with timestamps, arrival/departure hours, and notes (e.g. honey harvesting, syrup feeding, queen verification).
- **Varroa Mite Infestation:** Documented periodic mite washes (`Nb varroa / 100 bees`) conducted in June and August 2020.
- **Brood Development:** Number of sealed and open brood cells counted via photographic frame analysis.
- **Colony Population:** Number of frames covered by bees across brood boxes and honey supers over 6 inspection rounds.
- **Total Honey Production:** Kilograms of harvested honey per colony over the season.
- **Overwintering Viability:** 45 colonies evaluated in spring 2021 with explicit survival status, causes of mortality, and syrup consumption.

---

## 3. Preprocessing Pipeline & Working Artifacts

The preprocessing script [`src/research/preprocess_mspb.py`](file:///Users/samruddhidange/.gemini/antigravity/scratch/HIVEGUARD/src/research/preprocess_mspb.py) generates lightweight, harmonized artifacts in `data/processed/mspb/`:

| Processed Artifact | Size | Records | Contents |
| :--- | :---: | :---: | :--- |
| `mspb_telemetry_benchmark_50k.csv` | **7.3 MB** | **86,453 rows** | Continuous summer telemetry across 8 representative colonies (`MSPB_HIVE_2046` through `2116`) |
| `mspb_hive_metadata.csv` | 4.8 KB | 53 rows | Hive ID, yard location, treatment group, queen genotype |
| `mspb_visits_manipulations.csv` | 2.1 KB | 16 rows | Date, arrival hour, departure hour, visit notes, manipulation type |
| `mspb_phenotypic_evaluations.csv` | 18.2 KB | 280 rows | Varroa wash counts, sealed brood cell counts, frame populations |
| `mspb_sensor_tag_index.csv` | 3.5 KB | 85 rows | Hardware tag to hive ID association table |
| `mspb_winter_outcomes.csv` | 3.1 KB | 45 rows | Overwintering survival status (Survived / Dead), mortality causes |

---

## 4. Declaration of Missing Channels & Scientific Boundaries

To uphold research integrity, the following data limitations are explicitly declared:

1. **Continuous Scale Weight:**
   - Continuous 15-minute scale weight was **not recorded** in the MSPB dataset. Weight was only measured at milestone harvest and seasonal weigh-ins.
   - The HIVEGUARD MSPB loader explicitly marks `weight_kg` as unrecorded in MSPB telemetry and does not synthesize fake numbers.
2. **Ambient Weather Station Data:**
   - External ambient weather was recorded at regional meteorological stations but was not included in the internal telemetry CSV. Ambient temperature is marked as unrecorded for MSPB internal streams.
3. **Biological Disease Diagnoses:**
   - The MSPB dataset records phenotypic colony traits (Varroa counts, brood area, survival), but does not provide continuous, minute-by-minute veterinary disease labels.
   - Any multi-class disease predictions (e.g. American Foulbrood, Chalkbrood) from the legacy Random Forest model are based entirely on synthetic prototype data (`HIVEGUARD_ML_Bee_Disease_Synthetic_10000.csv`) and are disclaimed as demonstration artifacts.
