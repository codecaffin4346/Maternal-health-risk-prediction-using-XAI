> **Pipeline update:** The data-audit and training-hardening section in README.md describes current behaviour. The older design notes below include historical assumptions. Current training accepts real UCI-schema records only, rejects synthetic/diabetes mixing, groups identical measurements across folds, and exports the complete evaluated forest. Historical CV metadata is separate from the exact-model reference replay in reports/model-evidence.md.

# 🔄 MaternAI — Complete ML & XAI Pipeline Documentation

This document provides a technical deep-dive into every stage of the prediction pipeline — from raw input to explainable output.

---

## Table of Contents

1. [Data Flow Overview](#1-data-flow-overview)
2. [Stage 1 — Input Validation & Zone Detection](#2-stage-1--input-validation--zone-detection)
3. [Stage 2 — Random Forest Inference](#3-stage-2--random-forest-inference)
4. [Stage 3 — Ensemble Aggregation](#4-stage-3--ensemble-aggregation)
5. [Stage 4 — TreeSHAP Computation (XAI Core)](#5-stage-4--treeshap-computation-xai-core)
6. [Stage 5 — Clinical Summary Generation](#6-stage-5--clinical-summary-generation)
7. [Stage 6 — Recommendation Engine](#7-stage-6--recommendation-engine)
8. [Stage 7 — Visualisation Layer](#8-stage-7--visualisation-layer)
9. [Dataset Statistics & Training Details](#9-dataset-statistics--training-details)
10. [Decision Tree Specifications](#10-decision-tree-specifications)

---

## 1. Data Flow Overview

```
User Input (6 vitals)
        │
        ▼
┌───────────────────────┐
│  Stage 1: Validation  │  ← Range check, zone colour, UI feedback
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Stage 2: RF Trees    │  ← 10 trees independently process input
│  (model.js: TREES)    │     Each outputs leaf probabilities [p0,p1,p2]
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Stage 3: Aggregation │  ← Average probabilities → argmax = class
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Stage 4: TreeSHAP    │  ← Path-based contribution per feature, per tree
│  (XAI Core)           │     Averaged across trees → SHAP values [φ₀..φ₅]
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Stage 5: NL Summary  │  ← Per-vital deviation text + SHAP direction
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Stage 6: Recs Engine │  ← SHAP-ranked recommendations by risk class
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Stage 7: Charts      │  ← Gauge, waterfall, radar, prob bars
└───────────────────────┘
        │
        ▼
   Results Dashboard
```

---

## 2. Stage 1 — Input Validation & Zone Detection

**File:** `js/app.js` → `featureStatus()`, `updateSliderZone()`

Each of the 6 features has three defined ranges:

| Feature | Normal (Green) | Warning (Amber) | Critical (Red) |
|---|---|---|---|
| Age | 18 – 40 yrs | 15 – 45 yrs | < 15 or > 45 |
| Systolic BP | 90 – 120 mmHg | 80 – 140 mmHg | < 80 or > 140 |
| Diastolic BP | 60 – 80 mmHg | 55 – 90 mmHg | < 55 or > 90 |
| Blood Sugar | 3.5 – 7.5 mmol/L | 3.5 – 11 mmol/L | > 11 |
| Body Temp | 97 – 99°F | 97 – 100°F | > 100 |
| Heart Rate | 60 – 90 bpm | 55 – 95 bpm | < 55 or > 95 |

The slider track colour updates in real-time as the user drags, giving immediate visual clinical feedback before the model is even run.

---

## 3. Stage 2 — Random Forest Inference

**File:** `js/model.js` → `TREES`, `traverseToLeaf()`

### Tree Structure Schema

Each tree is a recursive JSON object:

```javascript
{
  f: 1,          // Feature index (0=Age, 1=SBP, 2=DBP, 3=BS, 4=Temp, 5=HR)
  t: 120,        // Split threshold
  v: 0.87,       // Expected risk score for this subtree (weighted avg)
  L: { ... },    // Left branch: input[f] <= t
  R: { ... }     // Right branch: input[f] > t
}

// Leaf node:
{
  leaf: true,
  v: 0.12,       // Expected value (0*p_low + 1*p_mid + 2*p_high)
  p: [0.90, 0.08, 0.02]  // [P(Low), P(Mid), P(High)]
}
```

### Tree Traversal

```javascript
function traverseToLeaf(node, input) {
  if (node.leaf) return node;
  return input[node.f] <= node.t
    ? traverseToLeaf(node.L, input)  // go left if feature <= threshold
    : traverseToLeaf(node.R, input); // go right if feature > threshold
}
```

### 10 Trees — Primary Split Features

| Tree | Primary Split | Secondary | Tertiary | Focus |
|---|---|---|---|---|
| 1 | Systolic BP | Blood Sugar | Age | Hypertension |
| 2 | Blood Sugar | Systolic BP | Diastolic BP | Diabetes |
| 3 | Systolic BP | Diastolic BP | Blood Sugar | BP combined |
| 4 | Age | Systolic BP | Blood Sugar | Age-risk |
| 5 | Diastolic BP | Systolic BP | Blood Sugar | DBP-focus |
| 6 | Blood Sugar | Systolic BP | Age | BS-focus |
| 7 | Systolic BP | Age | Diastolic BP | Age+BP |
| 8 | Body Temp | Systolic BP | Blood Sugar | Temp/infection |
| 9 | Systolic BP | Heart Rate | Blood Sugar | HR-aware |
| 10 | Age | Systolic BP | Blood Sugar | Older-age focus |

---

## 4. Stage 3 — Ensemble Aggregation

**File:** `js/model.js` → `predict()`

```javascript
// Accumulate probabilities across all trees
const probSum = [0, 0, 0];
TREES.forEach(tree => {
  const leaf = traverseToLeaf(tree, input);
  leaf.p.forEach((p, i) => { probSum[i] += p; });
});

// Average
const probs = probSum.map(p => p / nTrees);

// Argmax → predicted class
const riskClass = probs.indexOf(Math.max(...probs));
```

The confidence = `probs[riskClass]` (the max probability).

---

## 5. Stage 4 — TreeSHAP Computation (XAI Core)

**File:** `js/model.js` → `shapOneTree()`, computed in `predict()`

### Mathematical Foundation

For a prediction `f(x)` from a tree model, the SHAP value for feature $i$ is:

$$\phi_i = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F|-|S|-1)!}{|F|!} \left[ f_{S \cup \{i\}}(x) - f_S(x) \right]$$

This is computationally expensive. **TreeSHAP** provides an exact polynomial-time algorithm for tree ensembles. We use the **path-based approximation**:

### Path-Based SHAP Approximation

For each tree, as we traverse the path from root to leaf:

```
At each internal node that splits on feature f:
  contribution[f] += child_node_value − parent_node_value
```

Where `node_value` (v) is the **expected risk score** for that subtree — computed as:

```
v = 0 × P(Low) + 1 × P(Mid) + 2 × P(High) = P(Mid) + 2×P(High)
```

**Example trace for a High-Risk input** (SBP=155, BS=14, Age=40):

```
Tree 1:
  Root: v=0.870  (baseline)
  ──→ SBP > 120  → Right child: v=1.040
       SHAP(SBP) += 1.040 − 0.870 = +0.170
  ──→ SBP > 140  → Right child: v=1.720
       SHAP(SBP) += 1.720 − 1.040 = +0.680  (total SBP: +0.850)
  ──→ BS > 10.0  → Right child: v=1.860
       SHAP(BS)  += 1.860 − 1.720 = +0.140
  ──→ Age > 35   → Leaf: v=1.900, p=[0.01, 0.08, 0.91]
       SHAP(Age) += 1.900 − 1.860 = +0.040
```

After averaging across all 10 trees:
```
SHAP values: [SBP: +0.42, BS: +0.29, Age: +0.12, DBP: -0.04, Temp: -0.02, HR: -0.01]
```

### SHAP Value Interpretation

```
Baseline score:  0.87  (average across training set)
+ SBP:          +0.42  → Patient's high SBP pushes risk up
+ BS:           +0.29  → Patient's high BS pushes risk up
+ Age:          +0.12  → Patient's age (40) pushes risk up
- DBP:          -0.04  → Patient's DBP is slightly helpful
- Temp:         -0.02  → Normal temperature reduces risk slightly
- HR:           -0.01  → Heart rate has minimal effect
──────────────────────
Final score:     1.63  → Maps to HIGH RISK class
```

---

## 6. Stage 5 — Clinical Summary Generation

**File:** `js/app.js` → `buildClinicalSummary()`

For each feature:
1. Compare value against normal/warn/critical thresholds → assign status
2. Calculate % deviation from normal range upper bound
3. Look up SHAP direction (positive → ↑ risk, negative → ↓ risk, near-zero → minimal)
4. Generate human-readable text card

```javascript
// Example output for SBP = 155:
{
  icon: '🔴',
  status: 'critical',
  name: 'Systolic BP',
  value: '155 mmHg',
  label: 'Hypertension — clinically significant',
  devText: '(29% outside normal range)',
  shapDir: '↑ pushing risk higher',
  shapAbs: 0.42
}
```

Cards are **sorted by SHAP magnitude** so the most impactful feature appears first.

---

## 7. Stage 6 — Recommendation Engine

**File:** `js/app.js` → `generateRecommendations()`

The engine works in two passes:

**Pass 1 — Base recommendations** (always shown, risk-class specific):

```
High Risk → "Contact OB/GYN within 24 hours", "Avoid strenuous activity", ...
Mid Risk  → "Schedule follow-up within 1-2 weeks", "Monitor vitals daily", ...
Low Risk  → "Continue prenatal check-ups", "Maintain balanced diet", ...
```

**Pass 2 — SHAP-targeted recommendations** (top 2 positive contributors):

```javascript
// Find top 2 risk-increasing features
const topDrivers = shapValues
  .map((v, i) => ({ i, v }))
  .filter(x => x.v > 0.01)
  .sort((a, b) => b.v - a.v)
  .slice(0, 2);

// Add feature-specific advice for each driver
topDrivers.forEach(({ i }) => recs.push(...RECOMMENDATIONS[level].byFeature[i]));
```

This means a high-risk patient driven by **blood sugar** gets glucose management tips, while one driven by **blood pressure** gets hypertension-specific advice — even at the same overall risk level.

---

## 8. Stage 7 — Visualisation Layer

**File:** `js/charts.js`

### Risk Gauge (Doughnut)
- Converts class probabilities to a 0–1 risk score: `score = P(Mid) + 2×P(High)`
- Renders as a 270° doughnut arc coloured by risk class
- Smooth 900ms `easeOutQuart` animation on each prediction

### SHAP Waterfall (Horizontal Bar)
- Features sorted by |SHAP| descending
- Red fill for positive SHAP (risk-increasing), green for negative
- Labels include actual feature value and unit
- Tooltip shows exact SHAP value and direction

### Radar Chart
- All 6 feature values normalised to 0–1 within their full min-max range
- Patient values plotted in purple
- Healthy reference range midpoints plotted in green dashes
- Visual gap between datasets = degree of deviation from health

### Probability Bars
- CSS width transition from 0 to target (`transition: width 0.9s cubic-bezier(...)`)
- Each bar coloured by class (green/amber/red)

### Confusion Matrix (Bubble chart)
- 3×3 bubble grid; bubble radius ∝ cell count
- Diagonal bubbles (correct predictions) in purple
- Off-diagonal (misclassifications) in red

### Feature Importance Chart
- Pre-computed MDI values from training
- Sorted descending, rainbow-coloured bars

---

## 9. Dataset Statistics & Training Details

### UCI Maternal Health Risk Dataset

| Property | Value |
|---|---|
| Source | IoT sensors in Bangladesh (Ahmed et al., 2020) |
| Total samples | 1,014 |
| Features | 6 continuous numerical |
| Target | 3-class ordinal (Low/Mid/High) |
| Low Risk | 406 (40.1%) |
| Mid Risk | 336 (33.1%) |
| High Risk | 272 (26.8%) |

### Training Methodology

```
Original Dataset (1,014 samples)
        │
        ▼ Stratified K-Fold Split (k=5)
┌─── Fold 1 (Train: 811 / Test: 203)
│    ├── Apply SMOTE to training fold only
│    │   (avoids data leakage from test set)
│    ├── Train Random Forest
│    └── Evaluate on test fold
│
├─── Fold 2... (repeat)
│
└─── Fold 5... → Average metrics across folds
```

**SMOTE Configuration:**
- k-neighbors: 5
- Sampling strategy: auto (targets minority classes)
- Applied **inside** each CV fold to prevent leakage

**Random Forest Configuration:**
- n_estimators: 10 (encoded in JS)
- max_depth: 3–4
- Split criterion: Gini impurity
- Feature selection per split: √(n_features) = √6 ≈ 2

---

## 10. Decision Tree Specifications

Below are the key decision boundaries derived from the UCI dataset:

### Critical Thresholds (from published research)

| Feature | Low→Mid boundary | Mid→High boundary |
|---|---|---|
| Systolic BP | 120 mmHg | 140 mmHg |
| Diastolic BP | 80 mmHg | 90 mmHg |
| Blood Sugar | 7.5 mmol/L | 11.0 mmol/L |
| Age | 25 years | 35 years |
| Body Temp | 99°F | 100°F |
| Heart Rate | 85 bpm | 95 bpm |

### Leaf Probability Calibration

Leaf probabilities are calibrated to match the class-conditional distributions observed in the UCI dataset. For example:

```
SBP ≤ 120, BS ≤ 7.5, Age ≤ 35  →  [P(Low)=0.90, P(Mid)=0.08, P(High)=0.02]
SBP > 140, BS > 10              →  [P(Low)=0.01, P(Mid)=0.08, P(High)=0.91]
```

These reflect the real class distributions conditioned on those feature ranges in the UCI dataset, producing realistic and clinically plausible predictions.

---

*For questions, open an issue or contact the repository owner.*
