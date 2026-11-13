<div align="center">

# 🤰 MaternAI — Maternal Health Risk Prediction using Explainable AI

<img src="https://img.shields.io/badge/Accuracy-76.4%25-22c55e?style=for-the-badge" />
<img src="https://img.shields.io/badge/Model-Random%20Forest-8b5cf6?style=for-the-badge" />
<img src="https://img.shields.io/badge/XAI-TreeSHAP-6366f1?style=for-the-badge" />
<img src="https://img.shields.io/badge/Dataset-UCI%20Maternal%20Health-06b6d4?style=for-the-badge" />
<img src="https://img.shields.io/badge/Deployed-GitHub%20Pages-ef4444?style=for-the-badge" />
<img src="https://img.shields.io/badge/No%20Backend-Pure%20JS-f59e0b?style=for-the-badge" />

**A fully client-side, production-quality web application for maternal health risk prediction with multi-layer Explainable AI (XAI) — runs entirely in the browser, zero backend required.**

[🌐 Live Demo](https://codecaffin4346.github.io/Maternal-health-risk-prediction-using-XAI/) · [📊 Model Stats](#-model-performance) · [🔬 XAI Explanation](#-xai-layer--shap-values) · [🚀 Deploy](#-deployment)

</div>

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Dataset](#-dataset)
- [Inputs & Outputs](#-inputs--outputs)
- [ML Pipeline](#-ml-pipeline)
- [XAI Layer — SHAP Values](#-xai-layer--shap-values)
- [Model Performance](#-model-performance)
- [Project Structure](#-project-structure)
- [Run Locally](#-run-locally)
- [Deployment](#-deployment)
- [Tech Stack](#-tech-stack)
- [Limitations](#%EF%B8%8F-limitations--disclaimer)
- [References](#-references)

---

## 🧬 Overview

Maternal mortality remains one of the most urgent global health challenges. This project implements an **AI-powered decision support system** that classifies maternal health risk into three levels — **Low**, **Mid**, or **High** — based on six routine clinical measurements.

What makes this system **advanced** is the **Explainable AI (XAI) layer**: instead of returning a black-box label, the app shows *exactly which vital measurement drove the prediction* using **TreeSHAP**, a game-theory-based explanation method. This bridges the critical gap between AI accuracy and clinical trust.

### Key Advancement over Existing Work

| Aspect | Traditional Projects | This Project |
|---|---|---|
| **Backend** | Python Flask / FastAPI required | 100% browser-side — zero server |
| **Explanations** | Static SHAP image from Python | Live interactive SHAP waterfall chart |
| **UI** | Basic Bootstrap form | Premium dark glassmorphism design |
| **History** | None | Last 20 assessments, CSV export |
| **Output layers** | Risk label only | 5-layer output (see below) |
| **Clinical context** | None | Natural language summary per vital |
| **Recommendations** | None | SHAP-driven personalised action plan |
| **Education** | None | Full XAI explainer tab |

---

## ✨ Features

- **🔍 Live SHAP Waterfall Chart** — real-time feature contribution bars, coloured red (risk-increasing) or green (risk-decreasing)
- **🎯 Animated Risk Gauge** — circular speedometer with smooth animation
- **📊 Confidence Probability Bars** — P(Low), P(Mid), P(High) displayed as animated bars
- **📡 Radar Chart** — patient values overlaid on healthy reference range for all 6 features
- **📋 Clinical Summary** — per-vital status with deviation percentage and SHAP direction
- **💊 Personalised Recommendations** — SHAP-driven action items targeting the top risk drivers
- **📁 Session History** — localStorage-based history of last 20 assessments
- **⬇ CSV Export** — one-click export of all history records
- **🧪 Sample Presets** — Low / Mid / High risk example inputs for demonstration
- **📊 Model Stats Tab** — accuracy, F1, confusion matrix heatmap, feature importance chart
- **🔬 XAI Education Tab** — full pipeline explanation, SHAP concept, clinical impact table
- **📱 Fully Responsive** — works on mobile, tablet, and desktop

---

## 📦 Dataset

| Property | Value |
|---|---|
| **Name** | UCI Maternal Health Risk Data Set |
| **Source** | [Kaggle](https://www.kaggle.com/datasets/csafrit2/maternal-health-risk-data) / [UCI Repository](https://archive.ics.uci.edu/dataset/863/maternal+health+risk) |
| **Original Study** | Ahmed et al. (Bangladesh) |
| **Collection Method** | IoT-based risk monitoring system |
| **Sample Size** | 1,014 pregnant women |
| **Geographic Region** | Rural and urban Bangladesh |
| **Class Distribution** | Low: 406 (40.1%) · Mid: 336 (33.1%) · High: 272 (26.8%) |
| **Imbalance Handling** | SMOTE (Synthetic Minority Oversampling) |
| **Validation** | 5-fold Stratified K-Fold Cross-Validation |

---

## 📥 Inputs & Outputs

### Inputs — 6 Clinical Vitals

| # | Feature | Unit | Normal Range | Clinical Significance |
|---|---|---|---|---|
| 1 | **Age** | years | 18 – 40 | Older maternal age increases gestational risk |
| 2 | **Systolic Blood Pressure (SBP)** | mmHg | 90 – 120 | Key indicator of hypertension / preeclampsia |
| 3 | **Diastolic Blood Pressure (DBP)** | mmHg | 60 – 80 | Vascular resistance; elevated DBP = high risk |
| 4 | **Blood Sugar (BS)** | mmol/L | 3.5 – 7.5 | Gestational diabetes indicator |
| 5 | **Body Temperature** | °F | 97 – 99 | Infection / fever indicator |
| 6 | **Heart Rate** | bpm | 60 – 90 | Cardiovascular stress indicator |

Each slider shows a **live colour zone**: 🟢 Normal · 🟡 Warning · 🔴 Critical

### Outputs — 5 Layers

```
Layer 1:  Risk Classification ────── LOW / MID / HIGH  (animated gauge)
Layer 2:  Confidence Probabilities ─ P(Low), P(Mid), P(High) with animated bars
Layer 3:  SHAP Waterfall Chart ───── Signed feature contributions (XAI core)
Layer 4:  Clinical Summary ────────── Per-vital NL explanation with deviation %
Layer 5:  Recommendations ─────────── SHAP-ranked personalised action plan
```

---

## 🔄 ML Pipeline

> See [`PIPELINE.md`](PIPELINE.md) for the full technical deep-dive.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MATERNAI ML PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  INPUT LAYER                                                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  [Age] [SBP] [DBP] [BS] [BodyTemp] [HeartRate]                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  RANDOM FOREST (10 Trees)                                               │
│  ┌────────┐ ┌────────┐ ┌────────┐   ...   ┌────────┐                  │
│  │ Tree 1 │ │ Tree 2 │ │ Tree 3 │         │Tree 10 │                  │
│  │SBP→BS  │ │BS→SBP  │ │SBP→DBP │         │Age→SBP │                  │
│  │  →Age  │ │ →DBP   │ │  →BS   │         │ →DBP   │                  │
│  └────────┘ └────────┘ └────────┘         └────────┘                  │
│       │          │          │                   │                       │
│       └──────────┴──────────┴─────────┬─────────┘                     │
│                                        ▼                                │
│  ENSEMBLE AGGREGATION                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Average class probabilities across all 10 trees                 │  │
│  │  → P(Low), P(Mid), P(High)   →  argmax = predicted class        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  XAI LAYER — TreeSHAP Approximation                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  For each tree, track path:                                      │  │
│  │    φ(feature_i) = Σ [child_node_value − parent_node_value]      │  │
│  │  Average φ across all trees → SHAP value per feature            │  │
│  │                                                                  │  │
│  │  [SBP: +0.42] [BS: +0.28] [Age: +0.11]                         │  │
│  │  [HR: -0.08]  [DBP: -0.19] [Temp: -0.05]                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  OUTPUT LAYER                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Risk Gauge · Prob Bars · SHAP Chart · Clinical Summary · Recs  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 XAI Layer — SHAP Values

### What is SHAP?

**SHAP (SHapley Additive exPlanations)** uses cooperative game theory to fairly attribute the model's prediction to each input feature.

For a prediction output `f(x)`, SHAP decomposes it as:

$$f(x) = \phi_0 + \sum_{i=1}^{6} \phi_i$$

Where:
- $\phi_0$ = baseline (average prediction across all training samples = **0.87**)
- $\phi_i$ = SHAP value for feature $i$ (its signed contribution to the deviation from baseline)

### TreeSHAP — Path-Based Approximation

For each decision tree, we track the path taken for a given input:

```
Root node (v₀ = 0.87)
  └── Split on SBP ≤ 140  →  child node (v₁ = 1.56)
        SHAP(SBP) += v₁ − v₀ = +0.69
        └── Split on BS ≤ 10   →  child node (v₂ = 1.72)
              SHAP(BS)  += v₂ − v₁ = +0.16
              └── LEAF: P = [0.04, 0.22, 0.74]
```

This is averaged across all 10 trees to get the final SHAP values.

### What SHAP Values Mean in Context

| SHAP Value | Interpretation |
|---|---|
| `SBP = +0.42` | Systolic BP is the **primary risk driver** — pushes prediction 42% toward higher risk |
| `DBP = -0.19` | Diastolic BP is actually **reducing** predicted risk (within normal range) |
| `BS = +0.28` | Blood sugar is the **second biggest driver** of elevated risk |

### Why XAI Matters Clinically

```
WITHOUT XAI:   Vitals → "HIGH RISK"
               (Doctor: Why? What to treat first?)

WITH XAI:      Vitals → "HIGH RISK"
                       ↓
               "Blood Sugar (+42%) is PRIMARY driver"
               "Systolic BP (+28%) is SECONDARY"
                       ↓
               "Prioritise glucose management before BP intervention"
```

---

## 📊 Model Performance

These figures are the stored cross-validation results in `DATASET_STATS` in `js/model.js`, exported on 2026-10-25 for 1,004 processed UCI samples. They have not been independently re-evaluated during local setup. The original dataset contains 1,014 records. After retraining, update these tables from the newly exported metadata; the app reads its performance figures directly from that metadata.

| Metric | Value |
|---|---|
| **Overall Accuracy** | 76.4% |
| **Macro-Averaged F1** | 76.8% |
| **AUC-ROC** | 90.8% |
| **Validation** | 5-fold Stratified K-Fold |
| **Imbalance Strategy** | SMOTE |

### Per-Class Performance

| Class | Precision | Recall | F1 Score |
|---|---|---|---|
| Low Risk  | 76.1% | 80.5% | 78.2% |
| Mid Risk  | 68.3% | 64.3% | 66.3% |
| High Risk | 86.5% | 85.5% | 85.9% |

### Feature Importance (Mean Decrease in Impurity)

| Rank | Feature | Importance |
|---|---|---|
| 1 | Blood Sugar | 39.9% |
| 2 | Systolic Blood Pressure | 22.7% |
| 3 | Diastolic Blood Pressure | 12.4% |
| 4 | Age | 11.4% |
| 5 | Heart Rate | 6.8% |
| 6 | Body Temperature | 6.8% |

---

## 📁 Project Structure

```
Maternal-health-risk-prediction-using-XAI/
│
├── index.html              ← Main SPA: hero, tabs, form, results
│
├── css/
│   └── style.css           ← Full design system
│                             (glassmorphism, animations, responsive)
│
├── js/
│   ├── model.js            ← Random Forest (10 trees JSON) + TreeSHAP engine
│   ├── charts.js           ← All Chart.js wrappers
│   │                         (gauge, waterfall, radar, confusion matrix, FI)
│   └── app.js              ← UI orchestration, recommendations,
│                             history, CSV export, presets
│
├── assets/                 ← (Images if any)
│
├── README.md               ← This file
└── PIPELINE.md             ← Technical ML pipeline deep-dive
```

---

## 🖥️ Run Locally

### Method 1 — Python HTTP Server (Recommended)

```bash
# Clone the repo
git clone https://github.com/codecaffin4346/Maternal-health-risk-prediction-using-XAI.git
cd Maternal-health-risk-prediction-using-XAI

# Start server (Python 3)
python -m http.server 8080

# Open in browser
# → http://localhost:8080
```

### Method 2 — VS Code Live Server

1. Install the **Live Server** extension in VS Code
2. Open the project folder
3. Right-click `index.html` → **Open with Live Server**

### Method 3 — Node.js serve

```bash
npx serve .
# → http://localhost:3000
```

> **Why a server?** The app uses ES Modules (`import`/`export`) which browsers block over `file://` due to CORS. Any HTTP server works.

---

## 🚀 Deployment

### Option 1 — GitHub Pages (FREE, Recommended, 1-click)

**This is the easiest deployment — your repo is already set up for it.**

1. Go to your repo: `https://github.com/codecaffin4346/Maternal-health-risk-prediction-using-XAI`
2. Click **Settings** → **Pages** (left sidebar)
3. Under **"Source"**, select:
   - Branch: `main`
   - Folder: `/ (root)`
4. Click **Save**
5. Wait ~60 seconds → Your app is live at:

```
https://codecaffin4346.github.io/Maternal-health-risk-prediction-using-XAI/
```

**That's it!** No build step, no configuration needed. Every `git push` auto-deploys.

---

### Option 2 — Netlify (FREE, Instant drag-and-drop)

1. Go to [netlify.com](https://netlify.com) → Sign up free
2. Drag and drop the **entire project folder** onto the Netlify dashboard
3. Netlify gives you a URL instantly, e.g.: `https://maternai-abc123.netlify.app`

Or connect your GitHub repo for automatic deploys on every push.

---

### Option 3 — Vercel (FREE, Auto-deploy from GitHub)

```bash
# Install Vercel CLI
npm install -g vercel

# In the project directory
vercel

# Follow prompts → deploys instantly
# → https://your-project.vercel.app
```

Or go to [vercel.com](https://vercel.com) → Import GitHub repo → Deploy.

---

### Option 4 — Cloudflare Pages (FREE, Fastest CDN)

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect GitHub → Select your repo
3. Build settings: leave blank (static site)
4. Deploy → CDN-distributed globally

---

### Deployment Comparison

| Platform | Cost | Custom Domain | Auto-deploy | Speed |
|---|---|---|---|---|
| **GitHub Pages** | Free | ✅ | ✅ | Good |
| **Netlify** | Free | ✅ | ✅ | Excellent |
| **Vercel** | Free | ✅ | ✅ | Excellent |
| **Cloudflare Pages** | Free | ✅ | ✅ | Best (global CDN) |

> **Recommendation:** GitHub Pages for simplicity, Netlify/Vercel for better performance.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Structure** | HTML5 (Semantic) | Page layout & accessibility |
| **Styling** | Vanilla CSS | Glassmorphism, animations, responsive |
| **Logic** | Vanilla ES6+ JS (Modules) | All UI and ML logic |
| **Charts** | Chart.js 4.4.0 (bundled locally) | Gauge, waterfall, radar, heatmap |
| **ML Model** | Custom JS Random Forest | 10-tree ensemble inference |
| **XAI** | Custom TreeSHAP JS | Path-based SHAP approximation |
| **Storage** | localStorage | Session history (no DB needed) |
| **Fonts** | System fonts with local Hindi fallbacks | Offline typography |
| **Icons** | Unicode and local app icons | Offline UI icons |

---

## ⚠️ Limitations & Disclaimer

> **⚠️ This is a research prototype and NOT a clinical diagnostic tool.**

Known limitations:

- **Dataset size**: n=1,014 is small for clinical deployment; larger prospective datasets needed
- **Geographic bias**: Data collected in Bangladesh only — may not generalise to other populations
- **Feature set**: Only 6 features; many clinically relevant factors are absent (BMI, haemoglobin, obstetric history, gestational age)
- **No temporal tracking**: Single time-point; does not capture progression over pregnancy
- **Model validation**: Not prospectively validated in a clinical setting
- **SHAP approximation**: Uses path-based TreeSHAP approximation, not exact SHAP values

**All predictions must be reviewed and verified by qualified healthcare professionals before any clinical action.**

---

## 📚 References

1. Ahmed, M., et al. (2020). "IoT Based Risk Level Prediction Model For Maternal Health Care In The Context Of Bangladesh." *IEEE*. [DOI](https://doi.org/10.1109/ICCIT51783.2020.9392686)
2. Lundberg, S. M., & Lee, S. I. (2017). "A Unified Approach to Interpreting Model Predictions." *NeurIPS*.
3. Lundberg, S. M., et al. (2020). "From local explanations to global understanding with explainable AI for trees." *Nature Machine Intelligence*.
4. UCI Machine Learning Repository — [Maternal Health Risk Data Set](https://archive.ics.uci.edu/dataset/863/maternal+health+risk)
5. Breiman, L. (2001). "Random Forests." *Machine Learning*, 45(1), 5–32.

---

<div align="center">

Made with ❤️ for maternal healthcare · Powered by Explainable AI

⭐ Star this repo if you found it helpful!

</div>


## Assessment usability updates

- Field-level validation rejects missing readings, unsupported values, and reversed blood pressure numbers, with an accessible error summary.
- Unit switching preserves measurements; presets follow the selected units.
- Results explain model probabilities and flag a gap below 15 percentage points between the leading categories as a display heuristic, not a clinical confidence interval.
- Compare any of the last 20 saved assessments with the current assessment, including per-measurement differences. Use history for the same person only; it stays in this browser and does not sync.
- Malformed or unavailable browser storage no longer prevents assessments.
- Keyboard focus styles, input labels, larger mobile controls, and reduced-motion support improve access.

Run regression checks with `node --test tests/assessment.test.mjs`.

For wider community access, remaining work includes reviewed translations, offline packaging of external chart/PDF dependencies, and clinical and accessibility evaluation. These changes do not establish clinical validation of the prediction model.


## English/Hindi guided assessment and offline installation

Choose **English** or **हिंदी** in the top navigation. The choice is saved on this device when browser storage is available. Hindi covers measurement labels and guidance, validation errors, guided controls, risk and uncertainty explanations, and visit comparison. Detailed charts, recommendations, technical pages, history exports, and clinical PDFs remain English. The in-app language note identifies this scope. Hindi wording needs native-speaker and clinical review before public deployment.

Choose **Guide me step by step** to enter one measurement at a time. Untouched demonstration defaults are cleared on first entry to guided mode; explicitly entered readings and selected examples are preserved. **I don’t know this reading** leaves it empty and explains that all six measurements are needed. No missing values are imputed. Switch to **Show full form** at any time. Readings and units are shared between both views.

### Use without internet

1. Open the app once online over HTTPS or on localhost.
2. Wait for **Ready for offline use on this device**. This confirms the entire required app shell is cached, including the model, charts, PDF library, icons and translations.
3. Use **Install app** if your browser offers installation, or use its **Add to Home Screen** menu. Installation is optional for offline use.
4. After readiness, reload or revisit the same address without internet. Predictions, local visit comparison, and English PDF export work offline.

External website links and WhatsApp sending still require internet. Browser settings can remove cached assets and local history; neither is a cloud backup. Private browsing, unsupported browsers or storage restrictions may prevent offline setup or installation. Do not close the first online visit until readiness is confirmed. The app reports preparation failures instead of claiming it is ready.

The service worker caches an explicit list of local app files only. Assessment records are not placed in the service-worker cache; existing history remains in localStorage. The manifest and service worker use relative paths and support subdirectory hosting such as GitHub Pages. To ship an update, increment `RELEASE` in `sw.js` whenever a shell file changes. The next online visit checks for an updated worker; old app caches are removed after a complete new cache installs.

### Development checks

No npm install or build step is needed to run the app: `python -m http.server 8080 --bind 127.0.0.1` is sufficient.

For optional automated development checks:

```sh
npm ci
npm test
npm run test:browser
```

The browser checks use installed Microsoft Edge on Windows. On other platforms install Playwright Chromium (`npx playwright install chromium`), or set `BROWSER_CHANNEL` to a supported installed channel. Checks cover English/Hindi switching, incomplete guided input, unit conversion, visit comparison, offline reload and assessment, offline PDF generation, nested hosting, blocked localStorage, failed caching, and phone widths down to 320 pixels. Browser screenshots are written to ignored `test-results/`.

The app remains a research prototype. Offline availability and translation do not add clinical validation. Additional languages, native-speaker review, and field usability testing are still needed for broader access.


## Reproducible data and exact browser-model evidence

Run these from the repository root:

```sh
python train/download_uci.py
python train/audit_model.py
```

The downloader uses the official UCI archive and records the download URL, retrieval time, archive hash and CSV hash. It never substitutes generated data. The audit requires only Python's standard library and Node.js; training dependencies are not required. Use `--csv` and `--output` for explicit alternative input and report locations.

Results are saved to [reports/model-evidence.md](reports/model-evidence.md) and [reports/model-evidence.json](reports/model-evidence.json), and shown under **Model Stats → Model evidence**. The view verifies the loaded model's SHA256 before displaying its replay metrics. It works offline after the updated app shell is cached; an evidence report for a different model is marked stale.

The official CSV contains 1,014 records in the retrieved file. The audit found **562 duplicate complete rows**, **416 distinct measurement vectors**, and **35 identical-measurement groups with conflicting labels**. A conflict is a review flag: identical readings may belong to different people, and the data do not establish which label is correct. Original UCI webpage metadata and CSV row counts may differ; the report records the measured file count and checksum.

The shipped 10-tree model achieved **73.0% accuracy in a reference-data replay**, with **42 of 272 recorded high-risk rows assigned another class**, including **17 assigned Low Risk**. These are **not held-out performance estimates**: training membership is unknown. The report also includes unique-row and browser-supported subsets, confusion matrices, high-risk errors, age-group summaries and descriptive probability-quality measures. Age groups are not evidence of fairness or population generalizability. No model was retrained or replaced by this audit.

An independent Python traversal of the shipped trees matched the JavaScript engine on **1,014 reference records and 273 boundary probes**, with zero class/probability mismatches at a 1e-12 probability tolerance. This verifies rule execution, not clinical correctness or equivalence to the unavailable original sklearn artifact. Export regression tests separately compare a temporary fitted sklearn model against its complete JavaScript export.

The existing `DATASET_STATS` values remain labelled historical training metadata, separate from replay results. They must not be replaced with replay scores. For any future model change, rerun the audit and increment `RELEASE` in `sw.js` before shipping the updated evidence and model together.

### Training hardening

- Failed or missing official downloads stop training. Explicit missing files never trigger a fallback. The default cache must have matching provenance metadata.
- Synthetic augmentation and unrelated diabetes-to-risk label mappings are disabled, including legacy CLI switches.
- Invalid labels, non-finite readings and inherited range exclusions are counted. Units are explicit rather than guessed.
- Stratified grouped folds keep identical measurement vectors together, including conflicting-label groups. SMOTE remains inside training folds only.
- Exports retain every evaluated tree and its full depth and numeric thresholds/probabilities. Requests to prune trees or export a subset are rejected; choose the architecture before evaluation.

To exercise these changes with the existing training dependencies:

```sh
python -m unittest discover -s tests -p test_model_audit.py
```

The Python suite tests malformed data, duplicate/conflict accounting, metric agreement with sklearn, blocked fallbacks and dataset mixing, grouped fold separation, and lossless model export. The npm browser suite also checks the evidence view online/offline and rejects a deliberately stale model checksum.

Before broader clinical use, the next data requirement is appropriately governed, representative patient/visit-level records with clinician-defined labels or outcomes and a separate external evaluation cohort. Repeating a public-data replay or tuning until its score rises cannot establish clinical readiness.
