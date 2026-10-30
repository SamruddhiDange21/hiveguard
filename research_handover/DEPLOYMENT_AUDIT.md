# DEPLOYMENT AUDIT: Production Architecture & Publishing Specification

**Project:** HIVEGUARD  
**Live Application URL:** [https://hiveguard.onrender.com/](https://hiveguard.onrender.com/)  
**Audit Date:** October 30, 2026  
**Hosting Provider:** Render (Cloud Application Platform)  
**Connected Repository:** `https://github.com/SamruddhiDange21/hiveguard.git`  
**Deployment Branch:** `main`  

---

## 1. Production Architecture Overview

The deployed application at `https://hiveguard.onrender.com/` runs as a unified full-stack Python service:

```
                  GitHub (main branch)
                          │ (Webhook Auto-Deploy)
                          ▼
                 Render Web Service
        ┌──────────────────────────────────┐
        │  Gunicorn WSGI Server            │
        │  Python 3.10.12 Runtime          │
        │                                  │
        │  backend/app.py                  │
        │  ├── Flask REST API (/api/...)   │
        │  └── Static File Server          │
        │       ├── index.html             │
        │       ├── style.css              │
        │       └── script.js              │
        └──────────────────────────────────┘
```

- **Frontend & Backend Coupling:** Frontend and backend are **deployed together**. The Flask app serves static files from `frontend/` (`index.html`, `style.css`, `script.js`) at `/` and serves the REST API endpoints at `/api/...`.
- **Deployment Automation:** Render is configured with a GitHub webhook. Any push to `refs/heads/main` automatically initiates a clean build and zero-downtime redeployment.
- **Build Specification (`render.yaml`):**
  - **Build Command:** `pip install -r requirements.txt`
  - **Start Command:** `gunicorn backend.app:app`
  - **Environment Variables:** `PYTHON_VERSION: 3.10.12`
  - **Procfile:** `web: gunicorn backend.app:app`

---

## 2. Production Prerequisites & Safety Checks

### 2.1 Large File Safeguards (`.gitignore`)
- **Critical Finding:** `data/raw/mspb/` contains raw dataset files totaling **416 MB** (`D1_sensor_data.csv` is 211 MB; `D2_sensor_data.csv` is 184 MB).
- **GitHub Constraint:** GitHub hard-rejects any single file exceeding **100 MB**.
- **Audit Action Taken:** `.gitignore` was updated to explicitly ignore `data/raw/` and `data/uploads/`.
- **Processed Artifact Size:** `data/processed/mspb/` is **7.4 MB** (`mspb_telemetry_benchmark_50k.csv` is 7.3 MB). This file contains 86,453 real multi-sensor records and easily fits under GitHub's 100 MB limit, ensuring Render receives all necessary benchmark data without repository bloat.

### 2.2 Dependency Verification (`requirements.txt`)
- `requirements.txt` was verified to include all required production packages:
  - `flask>=3.0.0`, `flask-cors>=4.0.0`
  - `gunicorn>=21.2.0`
  - `pandas>=2.0.0`, `numpy>=1.24.0`, `scikit-learn>=1.3.0`
  - `openpyxl>=3.1.0` (required for Excel evaluation parsing)
  - `matplotlib>=3.7.0`

---

## 3. Exact Step-by-Step Publishing Instructions

To publish the completed research-grade dashboard to the live URL `https://hiveguard.onrender.com/`, follow these exact steps from your terminal:

### Step 1: Open Terminal in the Project Directory
```bash
cd /Users/samruddhidange/.gemini/antigravity/scratch/HIVEGUARD
```

### Step 2: Check Git Status
```bash
git status
```
*Expected output: You will see modified files (`.gitignore`, `README.md`, `requirements.txt`, `backend/app.py`, `frontend/index.html`, `frontend/script.js`, `frontend/style.css`) and untracked directories (`data/processed/`, `docs/`, `experiments/`, `research_handover/`, `src/research/`, `tests/`).*  
*(Note: `data/raw/` must NOT appear in git status because it is safely ignored).*

### Step 3: Run the Test Suite Before Staging
Ensure all tests pass cleanly before committing:
```bash
PYTHONPATH=. venv/bin/python -m unittest discover -s tests
```
*Expected output: `Ran 11 tests in ...s — OK`.*

### Step 4: Stage Files for Git
```bash
git add .gitignore README.md requirements.txt backend/ frontend/ data/processed/ docs/ experiments/ research_handover/ src/research/ tests/
```

### Step 5: Commit the Upgrades
```bash
git commit -m "feat: upgrade to research-grade platform with verified MSPB dataset and audit"
```

### Step 6: Push to GitHub (Triggers Live Render Deployment)
```bash
git push origin main
```

### Step 7: Monitor Render Deployment
1. Log into your Render dashboard at [https://dashboard.render.com](https://dashboard.render.com).
2. Select the `hiveguard` web service.
3. Observe the build log:
   - Render pulls the commit.
   - Executes `pip install -r requirements.txt`.
   - Starts Gunicorn: `gunicorn backend.app:app`.
   - Status changes to `Live`.
4. Refresh [https://hiveguard.onrender.com/](https://hiveguard.onrender.com/) in your browser to view the updated scientific dashboard.
