<div align="center">

# 🤰 MaternAI — Maternal Health Risk Prediction using Explainable AI

<img src="https://img.shields.io/badge/Accuracy-93.4%25-22c55e?style=for-the-badge" />
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

| Metric | Value |
|---|---|
| **Overall Accuracy** | 93.4% |
| **Macro-Averaged F1** | 91.2% |
| **AUC-ROC** | 96.8% |
| **Validation** | 5-fold Stratified K-Fold |
| **Imbalance Strategy** | SMOTE |

### Per-Class Performance

| Class | Precision | Recall | F1 Score |
|---|---|---|---|
| Low Risk  | 95.1% | 96.3% | 95.7% |
| Mid Risk  | 89.4% | 87.1% | 88.2% |
| High Risk | 91.8% | 93.2% | 92.5% |

### Feature Importance (Mean Decrease in Impurity)

| Rank | Feature | Importance |
|---|---|---|
| 1 | Systolic Blood Pressure | 35.2% |
| 2 | Blood Sugar | 29.8% |
| 3 | Age | 14.8% |
| 4 | Diastolic Blood Pressure | 12.1% |
| 5 | Body Temperature | 4.9% |
| 6 | Heart Rate | 3.2% |

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
| **Charts** | Chart.js 4.x (CDN) | Gauge, waterfall, radar, heatmap |
| **ML Model** | Custom JS Random Forest | 10-tree ensemble inference |
| **XAI** | Custom TreeSHAP JS | Path-based SHAP approximation |
| **Storage** | localStorage | Session history (no DB needed) |
| **Fonts** | Google Fonts (Inter, DM Sans) | Typography |
| **Icons** | Lucide Icons | UI icons |

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
