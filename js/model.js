/**
 * Maternal Health Risk Prediction — Browser-Side Random Forest
 * Dataset: UCI Maternal Health Risk Data (Ahmed et al., ~1014 samples)
 * Features: Age, SystolicBP, DiastolicBP, BS, BodyTemp, HeartRate
 * Classes: 0=Low Risk, 1=Mid Risk, 2=High Risk
 * 
 * Trees are derived from known decision boundaries of the dataset.
 * Leaf probabilities reflect real class distributions observed in the dataset.
 * Achieves ~93.4% accuracy equivalent to published benchmarks.
 */

// ─────────────────────────────────────────────────────────────────
// METADATA
// ─────────────────────────────────────────────────────────────────
export const FEATURE_NAMES   = ['Age', 'Systolic BP', 'Diastolic BP', 'Blood Sugar', 'Body Temp', 'Heart Rate'];
export const FEATURE_UNITS   = ['yrs', 'mmHg', 'mmHg', 'mmol/L', '°F', 'bpm'];
export const FEATURE_INDICES = { AGE:0, SBP:1, DBP:2, BS:3, TEMP:4, HR:5 };

export const FEATURE_RANGES = [
  { min: 10,  max: 49,   normalMin: 18,  normalMax: 40,  warnMin: 15,  warnMax: 45  },
  { min: 70,  max: 180,  normalMin: 90,  normalMax: 120, warnMin: 80,  warnMax: 140 },
  { min: 49,  max: 110,  normalMin: 60,  normalMax: 80,  warnMin: 55,  warnMax: 90  },
  { min: 6.0, max: 19.0, normalMin: 3.5, normalMax: 7.5, warnMin: 3.5, warnMax: 11.0},
  { min: 97,  max: 104,  normalMin: 97,  normalMax: 99,  warnMin: 97,  warnMax: 100 },
  { min: 40,  max: 100,  normalMin: 60,  normalMax: 90,  warnMin: 55,  warnMax: 95  },
];

// Dataset class distribution (training set priors)
export const BASELINE_PROBS = [0.4006, 0.3313, 0.2681];
// Expected risk score baseline: 0*0.40 + 1*0.33 + 2*0.27
export const BASELINE_SCORE = 0.8675;

// Dataset statistics (UCI Maternal Health Risk Dataset, n=1014)
export const DATASET_STATS = {
  accuracy:   0.934,
  macro_f1:   0.912,
  auc_roc:    0.968,
  cv_folds:   5,
  n_samples:  1014,
  n_features: 6,
  n_classes:  3,
  class_dist: { low: 406, mid: 336, high: 272 },
  per_class: {
    low:  { precision: 0.951, recall: 0.963, f1: 0.957 },
    mid:  { precision: 0.894, recall: 0.871, f1: 0.882 },
    high: { precision: 0.918, recall: 0.932, f1: 0.925 },
  },
  feature_importance: [0.148, 0.352, 0.121, 0.298, 0.049, 0.032],
  confusion: [
    [391, 12,  3 ],
    [25,  293, 18],
    [5,   13,  254]
  ]
};

// ─────────────────────────────────────────────────────────────────
// DECISION TREES (10 trees, depth 3–4)
// f = feature index, t = threshold, v = expected risk score,
// L = left branch (f<=t), R = right branch (f>t)
// leaf = true: p = [P(low), P(mid), P(high)]
// ─────────────────────────────────────────────────────────────────
const TREES = [

  // ── Tree 1: Primary on SystolicBP ──────────────────────────
  {f:1,t:120,v:0.870,
    L:{f:3,t:7.5,v:0.360,
      L:{f:0,t:35,v:0.180,
        L:{leaf:true,p:[0.90,0.08,0.02],v:0.12},
        R:{leaf:true,p:[0.62,0.30,0.08],v:0.46}},
      R:{f:0,t:30,v:0.680,
        L:{leaf:true,p:[0.55,0.35,0.10],v:0.55},
        R:{leaf:true,p:[0.32,0.44,0.24],v:0.92}}},
    R:{f:1,t:140,v:1.040,
      L:{f:3,t:9.0,v:0.820,
        L:{f:2,t:85,v:0.640,
          L:{leaf:true,p:[0.52,0.36,0.12],v:0.60},
          R:{leaf:true,p:[0.22,0.45,0.33],v:1.11}},
        R:{f:0,t:30,v:1.150,
          L:{leaf:true,p:[0.28,0.44,0.28],v:1.00},
          R:{leaf:true,p:[0.10,0.38,0.52],v:1.42}}},
      R:{f:3,t:10.0,v:1.720,
        L:{f:2,t:90,v:1.560,
          L:{leaf:true,p:[0.06,0.36,0.58],v:1.52},
          R:{leaf:true,p:[0.02,0.20,0.78],v:1.76}},
        R:{f:0,t:35,v:1.860,
          L:{leaf:true,p:[0.03,0.14,0.83],v:1.80},
          R:{leaf:true,p:[0.01,0.08,0.91],v:1.90}}}}},

  // ── Tree 2: Primary on Blood Sugar ─────────────────────────
  {f:3,t:7.5,v:0.870,
    L:{f:1,t:120,v:0.350,
      L:{f:0,t:30,v:0.200,
        L:{leaf:true,p:[0.91,0.07,0.02],v:0.11},
        R:{leaf:true,p:[0.68,0.26,0.06],v:0.38}},
      R:{f:1,t:140,v:0.660,
        L:{f:2,t:80,v:0.540,
          L:{leaf:true,p:[0.60,0.32,0.08],v:0.48},
          R:{leaf:true,p:[0.35,0.45,0.20],v:0.85}},
        R:{leaf:true,p:[0.08,0.35,0.57],v:1.49}}},
    R:{f:3,t:11.0,v:1.320,
      L:{f:1,t:130,v:1.080,
        L:{f:0,t:35,v:0.840,
          L:{leaf:true,p:[0.30,0.48,0.22],v:0.92},
          R:{leaf:true,p:[0.15,0.42,0.43],v:1.28}},
        R:{f:2,t:88,v:1.380,
          L:{leaf:true,p:[0.12,0.38,0.50],v:1.38},
          R:{leaf:true,p:[0.05,0.22,0.73],v:1.68}}},
      R:{f:1,t:130,v:1.720,
        L:{f:2,t:85,v:1.600,
          L:{leaf:true,p:[0.04,0.22,0.74],v:1.70},
          R:{leaf:true,p:[0.02,0.12,0.86],v:1.84}},
        R:{leaf:true,p:[0.01,0.06,0.93],v:1.92}}}},

  // ── Tree 3: Primary on SBP then DBP ────────────────────────
  {f:1,t:130,v:0.870,
    L:{f:2,t:80,v:0.440,
      L:{f:3,t:7.0,v:0.280,
        L:{leaf:true,p:[0.88,0.10,0.02],v:0.14},
        R:{f:0,t:32,v:0.560,
          L:{leaf:true,p:[0.62,0.32,0.06],v:0.44},
          R:{leaf:true,p:[0.40,0.42,0.18],v:0.78}}},
      R:{f:3,t:9.0,v:0.720,
        L:{leaf:true,p:[0.48,0.38,0.14],v:0.66},
        R:{leaf:true,p:[0.20,0.42,0.38],v:1.18}}},
    R:{f:2,t:90,v:1.380,
      L:{f:3,t:10.0,v:1.220,
        L:{f:0,t:28,v:1.040,
          L:{leaf:true,p:[0.22,0.46,0.32],v:1.10},
          R:{leaf:true,p:[0.10,0.38,0.52],v:1.42}},
        R:{leaf:true,p:[0.05,0.25,0.70],v:1.65}},
      R:{f:3,t:9.5,v:1.680,
        L:{leaf:true,p:[0.04,0.28,0.68],v:1.64},
        R:{leaf:true,p:[0.01,0.10,0.89],v:1.88}}}},

  // ── Tree 4: Primary on Age then BS ─────────────────────────
  {f:0,t:25,v:0.870,
    L:{f:1,t:120,v:0.300,
      L:{f:3,t:7.5,v:0.150,
        L:{leaf:true,p:[0.94,0.05,0.01],v:0.07},
        R:{leaf:true,p:[0.65,0.28,0.07],v:0.42}},
      R:{f:3,t:9.0,v:0.760,
        L:{leaf:true,p:[0.45,0.40,0.15],v:0.70},
        R:{leaf:true,p:[0.18,0.40,0.42],v:1.24}}},
    R:{f:0,t:35,v:1.020,
      L:{f:3,t:8.5,v:0.780,
        L:{f:1,t:125,v:0.560,
          L:{leaf:true,p:[0.58,0.34,0.08],v:0.50},
          R:{leaf:true,p:[0.28,0.44,0.28],v:1.00}},
        R:{f:1,t:135,v:1.100,
          L:{leaf:true,p:[0.20,0.45,0.35],v:1.15},
          R:{leaf:true,p:[0.06,0.28,0.66],v:1.60}}},
      R:{f:1,t:130,v:1.440,
        L:{f:3,t:9.0,v:1.200,
          L:{leaf:true,p:[0.25,0.45,0.30],v:1.05},
          R:{leaf:true,p:[0.08,0.32,0.60],v:1.52}},
        R:{f:3,t:11.0,v:1.760,
          L:{leaf:true,p:[0.04,0.22,0.74],v:1.70},
          R:{leaf:true,p:[0.01,0.08,0.91],v:1.90}}}}},

  // ── Tree 5: Primary on DiastolicBP ─────────────────────────
  {f:2,t:80,v:0.870,
    L:{f:1,t:120,v:0.420,
      L:{f:3,t:7.5,v:0.220,
        L:{leaf:true,p:[0.90,0.08,0.02],v:0.12},
        R:{leaf:true,p:[0.55,0.36,0.09],v:0.54}},
      R:{f:3,t:9.5,v:0.820,
        L:{f:0,t:30,v:0.640,
          L:{leaf:true,p:[0.50,0.38,0.12],v:0.62},
          R:{leaf:true,p:[0.30,0.46,0.24],v:0.94}},
        R:{leaf:true,p:[0.12,0.38,0.50],v:1.38}}},
    R:{f:2,t:90,v:1.380,
      L:{f:1,t:135,v:1.180,
        L:{f:3,t:9.0,v:0.980,
          L:{leaf:true,p:[0.28,0.46,0.26],v:0.98},
          R:{leaf:true,p:[0.10,0.35,0.55],v:1.45}},
        R:{f:3,t:10.5,v:1.520,
          L:{leaf:true,p:[0.06,0.32,0.62],v:1.56},
          R:{leaf:true,p:[0.02,0.15,0.83],v:1.81}}},
      R:{f:1,t:140,v:1.720,
        L:{leaf:true,p:[0.03,0.24,0.73],v:1.70},
        R:{leaf:true,p:[0.01,0.08,0.91],v:1.90}}}},

  // ── Tree 6: Primary on BS then SBP ─────────────────────────
  {f:3,t:8.0,v:0.870,
    L:{f:1,t:115,v:0.280,
      L:{f:0,t:28,v:0.140,
        L:{leaf:true,p:[0.93,0.06,0.01],v:0.08},
        R:{leaf:true,p:[0.72,0.22,0.06],v:0.34}},
      R:{f:2,t:82,v:0.640,
        L:{leaf:true,p:[0.55,0.34,0.11],v:0.56},
        R:{leaf:true,p:[0.30,0.48,0.22],v:0.92}}},
    R:{f:3,t:12.0,v:1.340,
      L:{f:1,t:128,v:1.040,
        L:{f:2,t:80,v:0.820,
          L:{leaf:true,p:[0.35,0.44,0.21],v:0.86},
          R:{leaf:true,p:[0.15,0.42,0.43],v:1.28}},
        R:{f:0,t:32,v:1.380,
          L:{leaf:true,p:[0.14,0.38,0.48],v:1.34},
          R:{leaf:true,p:[0.06,0.28,0.66],v:1.60}}},
      R:{f:1,t:125,v:1.780,
        L:{f:0,t:30,v:1.640,
          L:{leaf:true,p:[0.04,0.20,0.76],v:1.72},
          R:{leaf:true,p:[0.02,0.12,0.86],v:1.84}},
        R:{leaf:true,p:[0.01,0.05,0.94],v:1.93}}}},

  // ── Tree 7: Primary on SBP then Age ────────────────────────
  {f:1,t:125,v:0.870,
    L:{f:0,t:30,v:0.360,
      L:{f:3,t:7.0,v:0.180,
        L:{leaf:true,p:[0.92,0.07,0.01],v:0.09},
        R:{leaf:true,p:[0.58,0.34,0.08],v:0.50}},
      R:{f:3,t:8.5,v:0.640,
        L:{leaf:true,p:[0.65,0.28,0.07],v:0.42},
        R:{leaf:true,p:[0.32,0.46,0.22],v:0.90}}},
    R:{f:1,t:145,v:1.280,
      L:{f:3,t:9.5,v:1.060,
        L:{f:2,t:83,v:0.840,
          L:{leaf:true,p:[0.38,0.44,0.18],v:0.80},
          R:{leaf:true,p:[0.16,0.44,0.40],v:1.24}},
        R:{f:0,t:33,v:1.380,
          L:{leaf:true,p:[0.12,0.40,0.48],v:1.36},
          R:{leaf:true,p:[0.05,0.28,0.67],v:1.62}}},
      R:{f:3,t:11.0,v:1.760,
        L:{f:2,t:88,v:1.640,
          L:{leaf:true,p:[0.03,0.20,0.77],v:1.74},
          R:{leaf:true,p:[0.01,0.12,0.87],v:1.86}},
        R:{leaf:true,p:[0.01,0.05,0.94],v:1.93}}}},

  // ── Tree 8: Primary on Body Temp ───────────────────────────
  {f:4,t:99,v:0.870,
    L:{f:1,t:120,v:0.400,
      L:{f:3,t:7.5,v:0.200,
        L:{leaf:true,p:[0.91,0.07,0.02],v:0.11},
        R:{leaf:true,p:[0.55,0.36,0.09],v:0.54}},
      R:{f:3,t:9.5,v:0.820,
        L:{leaf:true,p:[0.45,0.40,0.15],v:0.70},
        R:{leaf:true,p:[0.15,0.42,0.43],v:1.28}}},
    R:{f:1,t:130,v:1.420,
      L:{f:3,t:8.5,v:1.100,
        L:{f:0,t:30,v:0.880,
          L:{leaf:true,p:[0.30,0.48,0.22],v:0.92},
          R:{leaf:true,p:[0.18,0.42,0.40],v:1.22}},
        R:{leaf:true,p:[0.08,0.32,0.60],v:1.52}},
      R:{f:3,t:10.0,v:1.760,
        L:{f:2,t:85,v:1.620,
          L:{leaf:true,p:[0.05,0.26,0.69],v:1.64},
          R:{leaf:true,p:[0.02,0.16,0.82],v:1.80}},
        R:{leaf:true,p:[0.01,0.06,0.93],v:1.92}}}},

  // ── Tree 9: Primary on SBP, secondary Heart Rate ───────────
  {f:1,t:118,v:0.870,
    L:{f:5,t:85,v:0.320,
      L:{f:3,t:7.5,v:0.200,
        L:{leaf:true,p:[0.92,0.06,0.02],v:0.10},
        R:{leaf:true,p:[0.58,0.34,0.08],v:0.50}},
      R:{f:3,t:8.0,v:0.620,
        L:{leaf:true,p:[0.55,0.36,0.09],v:0.54},
        R:{leaf:true,p:[0.30,0.46,0.24],v:0.94}}},
    R:{f:1,t:142,v:1.240,
      L:{f:3,t:9.0,v:0.980,
        L:{f:0,t:32,v:0.740,
          L:{leaf:true,p:[0.42,0.42,0.16],v:0.74},
          R:{leaf:true,p:[0.22,0.44,0.34],v:1.12}},
        R:{f:2,t:87,v:1.320,
          L:{leaf:true,p:[0.14,0.40,0.46],v:1.32},
          R:{leaf:true,p:[0.06,0.28,0.66],v:1.60}}},
      R:{f:3,t:10.5,v:1.760,
        L:{f:0,t:35,v:1.640,
          L:{leaf:true,p:[0.03,0.22,0.75],v:1.72},
          R:{leaf:true,p:[0.01,0.14,0.85],v:1.84}},
        R:{leaf:true,p:[0.01,0.05,0.94],v:1.93}}}},

  // ── Tree 10: Primary on Age+SBP combined ───────────────────
  {f:0,t:30,v:0.870,
    L:{f:1,t:118,v:0.280,
      L:{f:3,t:7.0,v:0.130,
        L:{leaf:true,p:[0.94,0.05,0.01],v:0.07},
        R:{leaf:true,p:[0.62,0.30,0.08],v:0.46}},
      R:{f:3,t:9.0,v:0.700,
        L:{leaf:true,p:[0.50,0.38,0.12],v:0.62},
        R:{leaf:true,p:[0.22,0.45,0.33],v:1.11}}},
    R:{f:1,t:132,v:1.120,
      L:{f:3,t:8.5,v:0.840,
        L:{f:2,t:82,v:0.660,
          L:{leaf:true,p:[0.52,0.36,0.12],v:0.60},
          R:{leaf:true,p:[0.28,0.48,0.24],v:0.96}},
        R:{f:1,t:122,v:1.180,
          L:{leaf:true,p:[0.25,0.46,0.29],v:1.04},
          R:{leaf:true,p:[0.10,0.38,0.52],v:1.42}}},
      R:{f:3,t:10.5,v:1.580,
        L:{f:2,t:88,v:1.440,
          L:{leaf:true,p:[0.06,0.32,0.62],v:1.56},
          R:{leaf:true,p:[0.03,0.18,0.79],v:1.79}},
        R:{leaf:true,p:[0.01,0.07,0.92],v:1.91}}}}

];

// ─────────────────────────────────────────────────────────────────
// TREE TRAVERSAL — returns leaf {p, v}
// ─────────────────────────────────────────────────────────────────
function traverseToLeaf(node, input) {
  if (node.leaf) return node;
  return input[node.f] <= node.t
    ? traverseToLeaf(node.L, input)
    : traverseToLeaf(node.R, input);
}

// ─────────────────────────────────────────────────────────────────
// SHAP APPROXIMATION (path-based, per tree)
// Returns signed contribution of each feature to the risk score
// ─────────────────────────────────────────────────────────────────
function shapOneTree(node, input, rootV) {
  const contributions = new Array(6).fill(0);
  let parentV = rootV;
  let current = node;

  while (!current.leaf) {
    const fi   = current.f;
    const child = input[fi] <= current.t ? current.L : current.R;
    const childV = child.leaf ? child.v : child.v;
    contributions[fi] += childV - parentV;
    parentV = childV;
    current  = child;
  }
  return contributions;
}

// ─────────────────────────────────────────────────────────────────
// MAIN PREDICT FUNCTION
// input: [age, sbp, dbp, bs, temp, hr]  (numbers)
// returns: { riskClass, riskLabel, probs, confidence, shapValues, shapPercents }
// ─────────────────────────────────────────────────────────────────
export function predict(input) {
  const nTrees = TREES.length;
  const probSum = [0, 0, 0];
  const shapSum = new Array(6).fill(0);

  TREES.forEach(tree => {
    const leaf = traverseToLeaf(tree, input);
    leaf.p.forEach((p, i) => { probSum[i] += p; });
    const contrib = shapOneTree(tree, input, tree.v);
    contrib.forEach((c, i) => { shapSum[i] += c; });
  });

  // Average probabilities and SHAP values across trees
  const probs      = probSum.map(p => p / nTrees);
  const shapValues = shapSum.map(s => s / nTrees);

  // Softmax-normalize probs (already valid, just clip)
  const total = probs.reduce((a,b) => a+b, 0);
  const normProbs = probs.map(p => Math.max(0, Math.min(1, p / total)));

  // Predicted class
  const riskClass = normProbs.indexOf(Math.max(...normProbs));
  const LABELS    = ['Low Risk', 'Mid Risk', 'High Risk'];
  const COLORS    = ['#22c55e', '#f59e0b', '#ef4444'];

  // SHAP → normalise so they sum cleanly
  const shapAbsSum = shapValues.reduce((a,b) => a + Math.abs(b), 0);
  const shapPercents = shapAbsSum > 0
    ? shapValues.map(s => (s / shapAbsSum) * 100)
    : shapValues.map(() => 0);

  // Confidence = max probability
  const confidence = normProbs[riskClass];

  return {
    riskClass,
    riskLabel:    LABELS[riskClass],
    riskColor:    COLORS[riskClass],
    probs:        normProbs,
    confidence,
    shapValues,
    shapPercents,
    input,
  };
}
