/**
 * app.js — Main UI logic, form handling, recommendations, history
 */

import { predict, FEATURE_RANGES, FEATURE_NAMES, FEATURE_UNITS, DATASET_STATS, BASELINE_PROBS } from './model.js';
import { renderGauge, renderShapChart, renderRadar, renderProbBars, renderConfusionMatrix, renderFeatureImportance } from './charts.js';

// ─────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────
let currentResult = null;
let history       = JSON.parse(localStorage.getItem('mhr_history') || '[]');

// ─────────────────────────────────────────────────────────────────
// RECOMMENDATION ENGINE
// ─────────────────────────────────────────────────────────────────
const RECOMMENDATIONS = {
  high: {
    header: '🔴 High Risk — Seek Immediate Medical Attention',
    color:  '#ef4444',
    base: [
      'Contact your OB/GYN or midwife within 24 hours',
      'Go to the emergency room if you experience headache, blurred vision, or swelling',
      'Do not skip any prenatal appointments',
      'Avoid strenuous physical activity until reviewed by a doctor',
    ],
    byFeature: {
      1: ['Monitor blood pressure every 2 hours and log readings', 'Reduce sodium intake below 1,500 mg/day', 'Discuss antihypertensive medication with your doctor'],
      3: ['Monitor blood glucose before and after every meal', 'Eliminate refined sugars and white carbohydrates immediately', 'Request an HbA1c test from your doctor'],
      0: ['Older maternal age increases risk — more frequent check-ups recommended', 'Discuss genetic screening options with your doctor'],
      4: ['Elevated temperature may indicate infection — seek immediate evaluation', 'Stay hydrated and rest in a cool environment'],
      2: ['High diastolic pressure indicates vascular stress — rest and reduce stress', 'Discuss calcium and magnesium supplementation with your doctor'],
      5: ['Abnormal heart rate — request an ECG at your next visit', 'Avoid caffeine and stimulants'],
    },
  },
  mid: {
    header: '🟡 Mid Risk — Increased Monitoring Required',
    color:  '#f59e0b',
    base: [
      'Schedule a follow-up appointment within 1–2 weeks',
      'Monitor your vitals daily and keep a log to share with your doctor',
      'Follow a pregnancy-safe diet rich in vegetables, lean protein, and whole grains',
      'Aim for 30 minutes of light exercise (e.g., walking) daily if cleared by your doctor',
    ],
    byFeature: {
      1: ['Reduce sodium to under 2,000 mg/day', 'Practice stress-reduction techniques like deep breathing'],
      3: ['Follow a low-glycaemic diet — choose complex carbs over simple sugars', 'Consider a glucose tolerance test if not already done'],
      0: ['Track weight gain — stay within recommended pregnancy weight ranges'],
      4: ['Stay well-hydrated; drink 8–10 glasses of water daily', 'Rest in a cool environment'],
      2: ['Limit fluid retention by elevating feet and avoiding prolonged standing'],
      5: ['Reduce caffeine; get 7–9 hours of sleep per night'],
    },
  },
  low: {
    header: '🟢 Low Risk — Continue Healthy Habits',
    color:  '#22c55e',
    base: [
      'Continue attending all scheduled prenatal check-ups',
      'Maintain a balanced diet with adequate folic acid, iron, and calcium',
      'Stay active with pregnancy-safe exercise (walking, swimming, prenatal yoga)',
      'Get 7–9 hours of quality sleep each night',
    ],
    byFeature: {
      1: ['Your blood pressure is healthy — maintain a low-sodium diet to keep it that way'],
      3: ['Your blood sugar is within range — continue avoiding sugary beverages'],
      0: [],
      4: ['Keep body temperature regulated by staying cool in hot weather'],
      2: ['Good diastolic pressure — continue regular check-ups'],
      5: ['Healthy heart rate — regular light cardio supports cardiovascular health'],
    },
  },
};

function generateRecommendations(result) {
  const levelKey = ['low', 'mid', 'high'][result.riskClass];
  const rec      = RECOMMENDATIONS[levelKey];

  // Find top 2 SHAP-positive contributors
  const positiveContribs = result.shapValues
    .map((v, i) => ({ i, v }))
    .filter(x => x.v > 0.01)
    .sort((a, b) => b.v - a.v)
    .slice(0, 2);

  const specificRecs = positiveContribs.flatMap(({ i }) => rec.byFeature[i] || []);
  const allRecs      = [...rec.base, ...specificRecs];

  return { header: rec.header, color: rec.color, items: allRecs };
}

// ─────────────────────────────────────────────────────────────────
// CLINICAL SUMMARY (NL explanations)
// ─────────────────────────────────────────────────────────────────
const NORMAL_LABELS = {
  0: ['Young maternal age','Optimal maternal age range','Older maternal age — increased risk factor'],
  1: ['Normal blood pressure','Prehypertension — borderline elevated','Hypertension — clinically significant'],
  2: ['Normal diastolic pressure','Prehypertensive diastolic range','High diastolic pressure'],
  3: ['Optimal blood sugar','Borderline elevated blood sugar','Diabetic-range blood sugar'],
  4: ['Normal body temperature','Slightly elevated temperature','Fever — potential infection'],
  5: ['Normal heart rate','Heart rate at upper boundary','Elevated heart rate'],
};

function featureStatus(val, i) {
  const r = FEATURE_RANGES[i];
  if (val <= r.normalMax && val >= r.normalMin) return 'normal';
  if (val <= r.warnMax   && val >= r.warnMin)   return 'warn';
  return 'critical';
}

function buildClinicalSummary(result) {
  const { input, shapValues } = result;

  return input.map((val, i) => {
    const status = featureStatus(val, i);
    const r      = FEATURE_RANGES[i];
    const pctDev = status !== 'normal'
      ? Math.abs(((val - r.normalMax) / r.normalMax) * 100).toFixed(0)
      : 0;
    const shapDir = shapValues[i] > 0.015  ? '↑ pushing risk higher'
                  : shapValues[i] < -0.015 ? '↓ helping reduce risk'
                  : '→ minimal influence';

    const icons   = { normal: '✅', warn: '⚠️', critical: '🔴' };
    const devText = status !== 'normal' && pctDev > 0
      ? ` (${pctDev}% outside normal range)`
      : '';

    return {
      icon:    icons[status],
      status,
      name:    FEATURE_NAMES[i],
      value:   `${val.toFixed(i===3?1:0)} ${FEATURE_UNITS[i]}`,
      label:   NORMAL_LABELS[i][status === 'normal' ? 0 : status === 'warn' ? 1 : 2],
      devText,
      shapDir,
      shapAbs: Math.abs(shapValues[i]),
    };
  }).sort((a, b) => b.shapAbs - a.shapAbs);  // Sort by impact
}

// ─────────────────────────────────────────────────────────────────
// SLIDER ZONE INDICATORS
// ─────────────────────────────────────────────────────────────────
function updateSliderZone(slider, i) {
  const val    = parseFloat(slider.value);
  const r      = FEATURE_RANGES[i];
  const status = featureStatus(val, i);
  const track  = slider.closest('.input-group')?.querySelector('.slider-zone');
  if (!track) return;
  track.className = `slider-zone zone-${status}`;
  const pct    = ((val - r.min) / (r.max - r.min)) * 100;
  slider.style.setProperty('--thumb-pct', `${pct}%`);
}

// ─────────────────────────────────────────────────────────────────
// FORM INPUTS
// ─────────────────────────────────────────────────────────────────
const FIELD_IDS = ['age','sbp','dbp','bs','temp','hr'];

function getInputValues() {
  return FIELD_IDS.map(id => parseFloat(document.getElementById(id).value));
}

function initInputSync() {
  FIELD_IDS.forEach((id, i) => {
    const slider = document.getElementById(`${id}-slider`);
    const num    = document.getElementById(id);

    slider.addEventListener('input', () => {
      num.value = slider.value;
      updateSliderZone(slider, i);
    });
    num.addEventListener('input', () => {
      slider.value = num.value;
      updateSliderZone(slider, i);
    });

    // Init zone colour
    updateSliderZone(slider, i);
  });
}

// ─────────────────────────────────────────────────────────────────
// CHARTS REFS
// ─────────────────────────────────────────────────────────────────
let gaugeCtx, shapCtx, radarCtx;

// ─────────────────────────────────────────────────────────────────
// RUN PREDICTION
// ─────────────────────────────────────────────────────────────────
function runPrediction() {
  const input  = getInputValues();

  // Validate
  for (let i = 0; i < input.length; i++) {
    const r = FEATURE_RANGES[i];
    if (isNaN(input[i]) || input[i] < r.min || input[i] > r.max) {
      showToast(`${FEATURE_NAMES[i]} is out of valid range (${r.min}–${r.max} ${FEATURE_UNITS[i]})`, 'error');
      return;
    }
  }

  const result = predict(input);
  currentResult = result;

  // Store history
  const entry = {
    id:        Date.now(),
    ts:        new Date().toLocaleString(),
    input,
    riskClass: result.riskClass,
    riskLabel: result.riskLabel,
    probs:     result.probs,
  };
  history.unshift(entry);
  if (history.length > 20) history.pop();
  localStorage.setItem('mhr_history', JSON.stringify(history));

  showResults(result);
  renderHistoryList();
}

// ─────────────────────────────────────────────────────────────────
// RENDER RESULTS
// ─────────────────────────────────────────────────────────────────
function showResults(result) {
  // Switch to results section
  document.getElementById('form-section').classList.add('hidden');
  document.getElementById('results-section').classList.remove('hidden');
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });

  // Risk badge
  const ICONS = ['🟢','🟡','🔴'];
  document.getElementById('risk-label').textContent  = result.riskLabel;
  document.getElementById('risk-label').style.color  = result.riskColor;
  document.getElementById('risk-icon').textContent   = ICONS[result.riskClass];
  document.getElementById('confidence-text').textContent = `${(result.confidence * 100).toFixed(1)}% confidence`;

  // Gauge
  renderGauge(gaugeCtx, result.riskClass, result.probs);

  // Prob bars
  renderProbBars(document.getElementById('prob-bars'), result.probs);

  // SHAP
  renderShapChart(shapCtx, result.shapValues, result.input);

  // Radar
  renderRadar(radarCtx, result.input);

  // Clinical summary
  const summary = buildClinicalSummary(result);
  document.getElementById('clinical-summary').innerHTML = summary.map(s => `
    <div class="summary-card status-${s.status}">
      <div class="summary-header">
        <span class="summary-icon">${s.icon}</span>
        <div>
          <span class="summary-name">${s.name}</span>
          <span class="summary-value">${s.value}</span>
        </div>
        <span class="shap-dir">${s.shapDir}</span>
      </div>
      <div class="summary-detail">${s.label}${s.devText}</div>
    </div>
  `).join('');

  // Recommendations
  const recs = generateRecommendations(result);
  document.getElementById('rec-header').textContent    = recs.header;
  document.getElementById('rec-header').style.color    = recs.color;
  document.getElementById('rec-list').innerHTML        = recs.items.map(r => `<li>${r}</li>`).join('');
}

// ─────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────
function renderHistoryList() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = '<p class="empty-state">No assessments yet. Complete the form to get started.</p>';
    return;
  }

  const COLORS = ['#22c55e','#f59e0b','#ef4444'];
  const BADGES = ['LOW','MID','HIGH'];

  container.innerHTML = history.map(h => `
    <div class="history-item" data-id="${h.id}">
      <div class="history-meta">
        <span class="history-badge" style="background:${COLORS[h.riskClass]}20;color:${COLORS[h.riskClass]};border-color:${COLORS[h.riskClass]}40">
          ${BADGES[h.riskClass]} RISK
        </span>
        <span class="history-time">${h.ts}</span>
      </div>
      <div class="history-vitals">
        Age ${h.input[0]}y · SBP ${h.input[1]} · DBP ${h.input[2]} · BS ${h.input[3].toFixed(1)} · ${h.input[4]}°F · HR ${h.input[5]}
      </div>
      <div class="history-probs">
        <span style="color:#22c55e">Low ${(h.probs[0]*100).toFixed(0)}%</span>
        <span style="color:#f59e0b">Mid ${(h.probs[1]*100).toFixed(0)}%</span>
        <span style="color:#ef4444">High ${(h.probs[2]*100).toFixed(0)}%</span>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────────────────────────
function exportCSV() {
  if (history.length === 0) { showToast('No records to export', 'warn'); return; }

  const header = ['Timestamp','Age','SystolicBP','DiastolicBP','BS','BodyTemp','HeartRate','RiskClass','RiskLabel','P_Low','P_Mid','P_High'];
  const rows   = history.map(h => [
    h.ts, ...h.input, h.riskClass, h.riskLabel,
    h.probs[0].toFixed(4), h.probs[1].toFixed(4), h.probs[2].toFixed(4)
  ]);

  const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'maternal_health_assessments.csv' });
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully!', 'success');
}

// ─────────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const ICONS = { success:'✅', error:'❌', warn:'⚠️', info:'ℹ️' };
  toast.textContent = `${ICONS[type]} ${msg}`;
  toast.className   = `toast toast-${type} toast-show`;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

// ─────────────────────────────────────────────────────────────────
// MODEL STATS PAGE
// ─────────────────────────────────────────────────────────────────
function renderModelStats() {
  const s = DATASET_STATS;

  // Accuracy cards
  ['accuracy','macro_f1','auc_roc'].forEach(key => {
    const el = document.getElementById(`stat-${key}`);
    if (el) el.textContent = (s[key] * 100).toFixed(1) + '%';
  });

  // Per-class table
  const tbl = document.getElementById('per-class-table');
  if (tbl) {
    const rows = [
      { cls:'Low Risk',  ...s.per_class.low  },
      { cls:'Mid Risk',  ...s.per_class.mid  },
      { cls:'High Risk', ...s.per_class.high },
    ];
    tbl.innerHTML = rows.map(r => `
      <tr>
        <td>${r.cls}</td>
        <td>${(r.precision*100).toFixed(1)}%</td>
        <td>${(r.recall*100).toFixed(1)}%</td>
        <td>${(r.f1*100).toFixed(1)}%</td>
      </tr>
    `).join('');
  }

  // Charts
  const cmCtx  = document.getElementById('confusion-matrix')?.getContext('2d');
  const fiCtx  = document.getElementById('feature-importance-chart')?.getContext('2d');
  if (cmCtx) renderConfusionMatrix(cmCtx);
  if (fiCtx) renderFeatureImportance(fiCtx);
}

// ─────────────────────────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(target).classList.remove('hidden');

      if (target === 'tab-stats') renderModelStats();
      if (target === 'tab-history') renderHistoryList();
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// SAMPLE DATA PRESETS
// ─────────────────────────────────────────────────────────────────
const PRESETS = {
  low:  [25, 100, 70, 6.5,  98.0, 72],
  mid:  [32, 132, 84, 9.2,  98.8, 80],
  high: [42, 152, 94, 13.5, 99.5, 88],
};

function applyPreset(key) {
  const vals = PRESETS[key];
  FIELD_IDS.forEach((id, i) => {
    document.getElementById(id).value        = vals[i];
    document.getElementById(`${id}-slider`).value = vals[i];
    updateSliderZone(document.getElementById(`${id}-slider`), i);
  });
  showToast(`Loaded ${key}-risk sample data`, 'info');
}

// ─────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Chart canvases
  gaugeCtx = document.getElementById('gauge-chart')?.getContext('2d');
  shapCtx  = document.getElementById('shap-chart')?.getContext('2d');
  radarCtx = document.getElementById('radar-chart')?.getContext('2d');

  initInputSync();
  initTabs();
  renderHistoryList();

  // Predict button
  document.getElementById('predict-btn').addEventListener('click', runPrediction);

  // Back button
  document.getElementById('back-btn')?.addEventListener('click', () => {
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('form-section').classList.remove('hidden');
  });

  // New assessment
  document.getElementById('new-assessment-btn')?.addEventListener('click', () => {
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('form-section').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Export
  document.getElementById('export-btn')?.addEventListener('click', exportCSV);

  // Presets
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });

  // Animated number counter for stats on hero
  animateCounters();

  // Smooth reveal on scroll
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
});

function animateCounters() {
  document.querySelectorAll('[data-counter]').forEach(el => {
    const target = parseFloat(el.dataset.counter);
    const suffix = el.dataset.suffix || '';
    const dur    = 1800;
    const start  = performance.now();
    const isFloat = target % 1 !== 0;

    function step(now) {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = (isFloat ? (target * ease).toFixed(1) : Math.round(target * ease)) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}
