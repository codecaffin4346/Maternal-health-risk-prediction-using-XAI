import {initEvidence} from './evidence.js';
import {t, fieldName, riskName, errorMessage, initLanguage} from './i18n.js';
import {initGuided} from './guided.js';
import {initOffline} from './offline.js';
/**
 * app.js — Main UI logic, form handling, recommendations, history
 */

import { validateMeasurements, explainUncertainty, comparisonRows, validHistoryEntry } from './assessment.js';
import { predict, FEATURE_RANGES, FEATURE_NAMES, FEATURE_UNITS, DATASET_STATS, BASELINE_PROBS } from './model.js';
import { renderGauge, renderShapChart, renderRadar, renderProbBars, renderConfusionMatrix, renderFeatureImportance, renderTrendChart } from './charts.js';

// ─────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────
let currentResult = null;
let guided = null;
let activeErrors = [];
let displayedResult = null;
let displayedSimulation = false;
let history = [];
let storageUnavailable = false;
try {
  const saved = JSON.parse(localStorage.getItem('mhr_history') || '[]');
  history = Array.isArray(saved) ? saved.filter(validHistoryEntry).slice(0,20) : [];
} catch { storageUnavailable = true; }
let comparisonVisits = [];
let bsUnit        = 'mmol'; // 'mmol' or 'mgdl'
let tempUnit      = 'f';    // 'f' or 'c'
let selectedTrimester = 2;  // 1, 2, or 3
let trendCtx      = null;

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

// Trimester-adjusted physiological thresholds (Clinical USP)
const TRIMESTER_ADJUSTMENTS = {
  1: { sbpMax: 120, dbpMax: 80, hrMax: 88 },
  2: { sbpMax: 115, dbpMax: 76, hrMax: 92 }, // Normal physiological drop in SBP/DBP in T2
  3: { sbpMax: 125, dbpMax: 82, hrMax: 96 }  // Rises back up in T3
};

function featureStatus(val, i) {
  const r = { ...FEATURE_RANGES[i] };
  const adj = TRIMESTER_ADJUSTMENTS[selectedTrimester];
  if (i === 1 && adj) r.normalMax = adj.sbpMax;
  if (i === 2 && adj) r.normalMax = adj.dbpMax;
  if (i === 5 && adj) r.normalMax = adj.hrMax;

  if (val <= r.normalMax && val >= r.normalMin) return 'normal';
  if (val <= r.warnMax   && val >= r.warnMin)   return 'warn';
  return 'critical';
}

function checkCriticalThresholds(input) {
  const [age, sbp, dbp, bs, temp, hr] = input;
  const criticals = [];
  if (sbp >= 160 || dbp >= 110) criticals.push(`Severe Hypertensive Crisis (${sbp}/${dbp} mmHg)`);
  if (bs >= 15.0) criticals.push(`Severe Hyperglycaemia (${bs.toFixed(1)} mmol/L)`);
  if (temp >= 101.5) criticals.push(`High Maternal Fever (${temp.toFixed(1)}°F)`);
  if (hr >= 115) criticals.push(`Tachycardia (${hr} bpm)`);

  const banner = document.getElementById('critical-alert-banner');
  const msgEl  = document.getElementById('critical-alert-msg');
  if (banner && msgEl) {
    if (criticals.length > 0) {
      msgEl.innerHTML = `<strong>Immediate intervention advised:</strong> Detected ${criticals.join(' · ')}. Please seek acute obstetric triage.`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
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

    // Unit display label
    let displayVal = `${val.toFixed(i===3?1:0)} ${FEATURE_UNITS[i]}`;
    if (i === 3 && bsUnit === 'mgdl') {
      displayVal = `${(val * 18.0182).toFixed(0)} mg/dL`;
    } else if (i === 4 && tempUnit === 'c') {
      displayVal = `${((val - 32) * 5 / 9).toFixed(1)} °C`;
    }

    return {
      icon:    icons[status],
      status,
      name:    FEATURE_NAMES[i],
      value:   displayVal,
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
  let val = parseFloat(slider.value);
  if (i === 3 && bsUnit === 'mgdl') val /= 18.0182;
  if (i === 4 && tempUnit === 'c') val = val * 9 / 5 + 32;
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


function toDisplayValue(value, index) {
  if (index === 3 && bsUnit === 'mgdl') return value * 18.0182;
  if (index === 4 && tempUnit === 'c') return (value - 32) * 5 / 9;
  return value;
}
function renderUncertainty(result, simulated = false) {
  displayedResult = result; displayedSimulation = simulated;
  const explanation = explainUncertainty(result.probs);
  const ranked = result.probs.map((p,i)=>({p,i})).sort((a,b)=>b.p-a.p);
  document.getElementById('risk-label').textContent = (simulated ? t('simulated') : '') + riskName(result.riskClass);
  document.getElementById('confidence-text').textContent = t('probability',{value:(result.confidence*100).toFixed(1)});
  document.getElementById('gauge-pct-text').textContent = (result.confidence*100).toFixed(1)+'%';
  document.getElementById('uncertainty-title').textContent = (simulated ? t('simulated') : '') + t(explanation.close ? 'uncertain' : 'explain');
  document.getElementById('uncertainty-text').textContent = (explanation.close ? t('close') : '') + t('uncertainty', {
    first:riskName(ranked[0].i),second:riskName(ranked[1].i),p1:(ranked[0].p*100).toFixed(1),p2:(ranked[1].p*100).toFixed(1),
  });
  document.getElementById('uncertainty-card').classList.toggle('uncertain', explanation.close);
}
function prepareComparison(result) {
  const select = document.getElementById('compare-visit');
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = ''; empty.textContent = t('chooseVisit'); select.append(empty);
  comparisonVisits.forEach((visit, index) => {
    const option = document.createElement('option');
    option.value = String(index); option.textContent = `${visit.ts} — ${riskName(visit.riskClass)}`;
    select.append(option);
  });
  select.disabled = comparisonVisits.length === 0;
  const render = () => {
    const visit = select.value === '' ? null : comparisonVisits[Number(select.value)];
    document.getElementById('comparison-summary').textContent = visit
      ? t('compareSummary',{previous:riskName(visit.riskClass), current:riskName(result.riskClass)})
      : t('compareEmpty');
    document.getElementById('comparison-rows').replaceChildren();
    document.getElementById('comparison-table').classList.toggle('hidden', !visit);
    if (!visit) return;
    comparisonRows(result.input, visit.input).forEach((row,i) => {
      const tr = document.createElement('tr');
      const precision = i === 3 || i === 4 ? 1 : 0;
      [fieldName(i) + ' (' + FEATURE_UNITS[i] + ')', row.previous.toFixed(precision), row.current.toFixed(precision),
        (row.change > 0 ? '+' : '') + row.change.toFixed(precision)].forEach(value => {
        const td = document.createElement('td'); td.textContent = value; tr.append(td);
      });
      document.getElementById('comparison-rows').append(tr);
    });
  };
  select.onchange = render;
  if (comparisonVisits.length) select.value = '0';
  render();
}

function getInputValues() {
  const rawValues = FIELD_IDS.map(id => parseFloat(document.getElementById(id).value));
  // Convert units to internal canonical representation (mmol/L and °F) if necessary
  if (bsUnit === 'mgdl') {
    rawValues[3] = rawValues[3] / 18.0182;
  }
  if (tempUnit === 'c') {
    rawValues[4] = (rawValues[4] * 9 / 5) + 32;
  }
  return rawValues;
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
function displayInputErrors(errors, focus = true) {
  activeErrors = errors;
  const errorBox = document.getElementById('input-errors');
  FIELD_IDS.forEach(id => document.getElementById(id).removeAttribute('aria-invalid'));
  errorBox.replaceChildren();
  errors.forEach(error => {
    const item = document.createElement('p'); item.textContent = errorMessage(error); errorBox.append(item);
    document.getElementById(FIELD_IDS[error.index]).setAttribute('aria-invalid','true');
  });
  errorBox.classList.toggle('hidden', !errors.length);
  if (errors.length && focus) {
    guided?.showField(errors[0].index);
    document.getElementById(FIELD_IDS[errors[0].index]).focus();
  }
}
function runPrediction() {
  const input  = getInputValues();

  const errors = validateMeasurements(input, FEATURE_RANGES, FEATURE_NAMES);
  displayInputErrors(errors);
  if (errors.length) return;
  comparisonVisits = [...history];

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
  try { localStorage.setItem('mhr_history', JSON.stringify(history)); }
  catch { storageUnavailable = true; showToast('This assessment could not be saved. History is available only for this session.', 'warn'); }
  document.getElementById('storage-notice').classList.toggle('hidden', !storageUnavailable);

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
  document.getElementById('confidence-text').textContent = `${(result.confidence * 100).toFixed(1)}% model probability`;

  renderUncertainty(result);
  prepareComparison(result);

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

  // Check critical alarms
  checkCriticalThresholds(result.input);

  // Recommendations
  const recs = generateRecommendations(result);
  document.getElementById('rec-header').textContent    = recs.header;
  document.getElementById('rec-header').style.color    = recs.color;
  document.getElementById('rec-list').innerHTML        = recs.items.map(r => `<li>${r}</li>`).join('');

  // Initialise Doctor Consultation Prep Questions (USP)
  renderDoctorQuestions(result);

  // Initialise Live What-If Counterfactual Simulator
  initWhatIfSimulator(result);
}

// ─────────────────────────────────────────────────────────────────
// DOCTOR CONSULTATION QUESTIONS PREPARATION (USP)
// ─────────────────────────────────────────────────────────────────
const CLINICAL_QUESTIONS_MAP = {
  1: [
    'My systolic BP is currently running at elevated levels. Would you recommend initiating home ambulatory blood pressure monitoring?',
    'Should we schedule a 24-hour urine protein or spot protein-to-creatinine test to screen for preeclampsia?'
  ],
  2: [
    'My diastolic pressure is above the second-trimester benchmark. Are there position-related resting changes or magnesium supplements I should consider?'
  ],
  3: [
    'Given my glucose readings, would you recommend early oral glucose tolerance testing (OGTT) or an HbA1c screening?',
    'Should I consult with a maternal nutrition specialist for personalized gestational carbohydrate management?'
  ],
  0: [
    'Does my maternal age indicate any supplementary fetal growth velocity scans or maternal Doppler ultrasound evaluations?'
  ],
  4: [
    'With an elevated temperature, should we run a full blood count (FBC) or urine culture to check for asymptomatic urinary tract infections?'
  ],
  5: [
    'My resting heart rate is notably high. Is this normal physiological pregnancy hemodilution, or should we evaluate thyroid or iron levels?'
  ]
};

function renderDoctorQuestions(result) {
  const container = document.getElementById('doctor-questions-list');
  if (!container) return;

  const questions = [
    'Overall, based on my combined vital profile today, how often should we schedule my antenatal appointments?'
  ];

  // Pick top 2 risk drivers from SHAP
  const topDrivers = result.shapValues
    .map((v, i) => ({ i, v }))
    .sort((a, b) => b.v - a.v)
    .filter(x => x.v > 0);

  topDrivers.slice(0, 2).forEach(({ i }) => {
    if (CLINICAL_QUESTIONS_MAP[i]) {
      questions.push(...CLINICAL_QUESTIONS_MAP[i]);
    }
  });

  if (questions.length < 3) {
    questions.push('What specific signs or symptoms (such as sudden edema or epigastric pain) should prompt me to go directly to labor triage?');
  }

  container.innerHTML = questions.map((q, idx) => `
    <div class="doctor-question-item">
      <span class="q-number">Q${idx + 1}</span>
      <p class="q-text">${q}</p>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────
// WHATSAPP SHARE GENERATOR (VIRAL USP)
// ─────────────────────────────────────────────────────────────────
function shareToWhatsApp() {
  if (!currentResult) {
    showToast('Please run an assessment first', 'warn');
    return;
  }
  const r = currentResult;
  const input = r.input;
  const topDriver = r.shapValues
    .map((v, i) => ({ name: FEATURE_NAMES[i], v }))
    .sort((a, b) => b.v - a.v)[0];

  const shareText = `*MaternAI Maternal Health Clinical Summary*%0A` +
    `Risk Category: *${r.riskLabel.toUpperCase()}* (${(r.confidence * 100).toFixed(0)}% model probability)%0A%0A` +
    `*Recorded Vitals:*%0A` +
    `• Blood Pressure: ${input[1]}/${input[2]} mmHg%0A` +
    `• Blood Glucose: ${input[3].toFixed(1)} mmol/L (${(input[3]*18.0182).toFixed(0)} mg/dL)%0A` +
    `• Heart Rate: ${input[5]} bpm%0A` +
    `• Body Temp: ${input[4]} °F%0A` +
    `• Maternal Age: ${input[0]} years%0A%0A` +
    `*Primary Driver (XAI):* ${topDriver.name} is the leading contributor to this assessment.%0A%0A` +
    `Assessed via MaternAI Decision Support (UCI Benchmark).`;

  window.open(`https://api.whatsapp.com/send?text=${shareText}`, '_blank');
}

// ─────────────────────────────────────────────────────────────────
// DOCTOR EXPLAINER MODAL / TOGGLE (USP)
// ─────────────────────────────────────────────────────────────────
function toggleDoctorExplainerMode() {
  const btn = document.getElementById('doctor-summary-btn');
  const summaryCards = document.querySelectorAll('.summary-card');
  const isDoctorMode = btn.classList.toggle('active-mode');

  if (isDoctorMode) {
    btn.textContent = '👤 Patient Mode View';
    btn.style.background = 'var(--purple)';
    btn.style.color = '#fff';
    showToast('Doctor Clinical Explainer Mode enabled: technical physiological notes highlighted', 'info');
    document.querySelectorAll('.summary-detail').forEach(el => {
      el.style.fontWeight = '600';
      el.style.color = '#c4b5fd';
    });
  } else {
    btn.textContent = '🩺 Doctor Explainer Mode';
    btn.style.background = '';
    btn.style.color = '';
    document.querySelectorAll('.summary-detail').forEach(el => {
      el.style.fontWeight = 'normal';
      el.style.color = 'var(--text-muted)';
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// LIVE WHAT-IF COUNTERFACTUAL SIMULATOR (USP)
// ─────────────────────────────────────────────────────────────────
function initWhatIfSimulator(baseResult) {
  const container = document.getElementById('what-if-controls');
  if (!container) return;

  const simInput = [...baseResult.input];
  container.innerHTML = FEATURE_NAMES.map((name, i) => {
    const r = FEATURE_RANGES[i];
    const val = simInput[i];
    const step = i === 3 || i === 4 ? 0.1 : 1;
    return `
      <div class="what-if-item">
        <div class="what-if-label">
          <span>${name}</span>
          <span id="sim-val-${i}" class="sim-val-num">${val.toFixed(i===3?1:0)} ${FEATURE_UNITS[i]}</span>
        </div>
        <input type="range" class="range-slider sim-slider" data-idx="${i}" 
               min="${r.min}" max="${r.max}" step="${step}" value="${val}" />
      </div>
    `;
  }).join('');

  const updateSim = () => {
    const simResult = predict(simInput);
    renderGauge(gaugeCtx, simResult.riskClass, simResult.probs);
    renderShapChart(shapCtx, simResult.shapValues, simResult.input);
    renderRadar(radarCtx, simResult.input);
    renderProbBars(document.getElementById('prob-bars'), simResult.probs);

    // Update risk badges
    document.getElementById('risk-label').textContent = `${simResult.riskLabel} (Simulated)`;
    document.getElementById('risk-label').style.color = simResult.riskColor;
    document.getElementById('confidence-text').textContent = `${(simResult.confidence * 100).toFixed(1)}% model probability`;

    renderUncertainty(simResult, true);

    // Calculate score delta
    const baseScore = baseResult.probs[1] + 2 * baseResult.probs[2];
    const newScore  = simResult.probs[1] + 2 * simResult.probs[2];
    const delta     = newScore - baseScore;

    const deltaBadge = document.getElementById('sim-delta-badge');
    const guidance   = document.getElementById('sim-guidance-text');

    if (Math.abs(delta) < 0.05) {
      deltaBadge.textContent = 'Baseline Parity';
      deltaBadge.style.background = 'rgba(255,255,255,0.08)';
      deltaBadge.style.color = 'var(--text-muted)';
      guidance.textContent = 'Slide SBP or Blood Sugar to evaluate therapeutic target effect';
    } else if (delta < 0) {
      deltaBadge.textContent = `Risk Reduction: ${(Math.abs(delta)*50).toFixed(0)}% lower`;
      deltaBadge.style.background = 'rgba(34,197,94,0.18)';
      deltaBadge.style.color = '#4ade80';
      guidance.textContent = `Intervention shows positive transition toward ${simResult.riskLabel}`;
    } else {
      deltaBadge.textContent = `Risk Escalation: +${(delta*50).toFixed(0)}% higher`;
      deltaBadge.style.background = 'rgba(239,68,68,0.18)';
      deltaBadge.style.color = '#f87171';
      guidance.textContent = 'Simulated vital shifts worsen secondary clinical risk markers';
    }
  };

  container.querySelectorAll('.sim-slider').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      const val = parseFloat(e.target.value);
      simInput[idx] = val;
      document.getElementById(`sim-val-${idx}`).textContent = `${val.toFixed(idx===3?1:0)} ${FEATURE_UNITS[idx]}`;
      updateSim();
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// PDF CLINICAL REPORT GENERATION (USP)
// ─────────────────────────────────────────────────────────────────
function generateClinicalPDF() {
  if (!currentResult) {
    showToast('Please perform an assessment first', 'warn');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const res = currentResult;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('MaternAI — Clinical Decision Support Report', 14, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleString()} | ID: #MHR-${res.riskClass}-${Date.now().toString().slice(-6)}`, 14, 28);
  doc.text('Machine Learning Model: Explainable Random Forest with TreeSHAP Attributions', 14, 34);

  // Risk Classification Box
  let riskColorRGB = [34, 197, 94];
  if (res.riskClass === 1) riskColorRGB = [245, 158, 11];
  if (res.riskClass === 2) riskColorRGB = [239, 68, 68];

  doc.setFillColor(riskColorRGB[0], riskColorRGB[1], riskColorRGB[2]);
  doc.roundedRect(14, 48, 182, 24, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`ASSESSED RISK: ${res.riskLabel.toUpperCase()}`, 20, 60);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Model probability: ${(res.confidence * 100).toFixed(1)}% | Low: ${(res.probs[0]*100).toFixed(0)}% · Mid: ${(res.probs[1]*100).toFixed(0)}% · High: ${(res.probs[2]*100).toFixed(0)}%`, 20, 67);

  // Patient Clinical Vitals Table
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Patient Recorded Vitals & Threshold Comparison', 14, 86);

  let yPos = 94;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(241, 245, 249);
  doc.rect(14, yPos - 5, 182, 8, 'F');
  doc.text('Parameter', 18, yPos);
  doc.text('Patient Value', 65, yPos);
  doc.text('Normal Reference Range', 110, yPos);
  doc.text('SHAP Impact Vector', 158, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  res.input.forEach((val, i) => {
    const r = FEATURE_RANGES[i];
    const shap = res.shapValues[i];
    const shapTxt = shap > 0.01 ? `+${shap.toFixed(3)} (↑ Risk)` : shap < -0.01 ? `${shap.toFixed(3)} (↓ Risk)` : '0.000 (Neutral)';

    doc.text(FEATURE_NAMES[i], 18, yPos);
    doc.text(`${val.toFixed(i===3?1:0)} ${FEATURE_UNITS[i]}`, 65, yPos);
    doc.text(`${r.normalMin} - ${r.normalMax} ${FEATURE_UNITS[i]}`, 110, yPos);
    doc.text(shapTxt, 158, yPos);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, yPos + 2, 196, yPos + 2);
    yPos += 8;
  });

  // Clinical Recommendations Section
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Actionable Clinical Recommendations (SHAP Prioritized)', 14, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const recs = generateRecommendations(res);
  recs.items.slice(0, 5).forEach((item) => {
    doc.text(`• ${item}`, 18, yPos);
    yPos += 6;
  });

  // Disclaimer Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Notice: Research prototype decision support only. Not approved as an autonomous clinical diagnostic tool.', 14, 280);

  doc.save(`MaternAI_Report_${Date.now()}.pdf`);
  showToast('Clinical PDF report exported successfully!', 'success');
}

// ─────────────────────────────────────────────────────────────────
// SHAREABLE LINK ENCODING (USP)
// ─────────────────────────────────────────────────────────────────
function shareAssessmentLink() {
  if (!currentResult) {
    showToast('Run an assessment first to generate share link', 'warn');
    return;
  }
  const encoded = btoa(JSON.stringify(currentResult.input));
  const shareUrl = `${window.location.origin}${window.location.pathname}#assessment=${encoded}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast('Shareable link copied to clipboard!', 'success');
  }).catch(() => {
    prompt('Copy your assessment link:', shareUrl);
  });
}

function checkUrlSharedAssessment() {
  const hash = window.location.hash;
  if (hash.includes('assessment=')) {
    try {
      const dataStr = atob(hash.split('assessment=')[1]);
      const inputs = JSON.parse(dataStr);
      if (Array.isArray(inputs) && inputs.length === 6) {
        inputs.forEach((val, i) => {
          const numEl = document.getElementById(FIELD_IDS[i]);
          const sliderEl = document.getElementById(`${FIELD_IDS[i]}-slider`);
          if (numEl) numEl.value = val;
          if (sliderEl) sliderEl.value = val;
          updateSliderZone(sliderEl, i);
        });
        showToast('Loaded shared assessment data from link', 'info');
        runPrediction();
      }
    } catch (e) {
      console.error('Failed to parse shared link data', e);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
}
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
        <span class="history-time">${escapeText(h.ts)}</span>
      </div>
      <div class="history-vitals">
        Age ${h.input[0]}y · SBP ${h.input[1]} · DBP ${h.input[2]} · BS ${h.input[3].toFixed(1)} · ${h.input[4]}°F · HR ${h.input[5]}
      </div>
        <span style="color:#22c55e">Low ${(h.probs[0]*100).toFixed(0)}%</span>
        <span style="color:#f59e0b">Mid ${(h.probs[1]*100).toFixed(0)}%</span>
        <span style="color:#ef4444">High ${(h.probs[2]*100).toFixed(0)}%</span>
      </div>
    </div>
  `).join('');

  // Render longitudinal chart alongside list
  if (trendCtx) {
    renderTrendChart(trendCtx, history);
  }
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
  mid:  [32, 132, 84, 7.0,  98.8, 80],
  high: [42, 152, 94, 13.5, 99.5, 88],
};

function applyPreset(key) {
  const vals = PRESETS[key].map((value, i) => toDisplayValue(value, i));
  FIELD_IDS.forEach((id, i) => {
    document.getElementById(id).value        = vals[i];
    document.getElementById(`${id}-slider`).value = vals[i];
    updateSliderZone(document.getElementById(`${id}-slider`), i);
  });
  showToast(t('savedSample'), 'info');
}

// ─────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Chart canvases
  gaugeCtx = document.getElementById('gauge-chart')?.getContext('2d');
  shapCtx  = document.getElementById('shap-chart')?.getContext('2d');
  radarCtx = document.getElementById('radar-chart')?.getContext('2d');
  trendCtx = document.getElementById('trend-line-chart')?.getContext('2d');

  FIELD_IDS.forEach((id,i) => {
    const number = document.getElementById(id);
    number.setAttribute('aria-label', FEATURE_NAMES[i]);
    number.setAttribute('aria-describedby', 'measurement-help input-errors');
    number.setAttribute('inputmode', i === 3 || i === 4 ? 'decimal' : 'numeric');
    document.getElementById(`${id}-slider`).setAttribute('aria-label', `${FEATURE_NAMES[i]} slider`);
  });
  document.getElementById('storage-notice').classList.toggle('hidden', !storageUnavailable);
  initInputSync();
  initTabs();
  renderHistoryList();
  checkUrlSharedAssessment();

  // Capture canonical values before changing units; repeat clicks are harmless.
  document.querySelectorAll('[data-unit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const values = getInputValues();
      const unit = btn.dataset.unit;
      if (unit === 'mmol' || unit === 'mgdl') bsUnit = unit;
      else tempUnit = unit;
      btn.closest('.unit-toggle-group').querySelectorAll('[data-unit]').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      [3,4].forEach(i => {
        const num = document.getElementById(FIELD_IDS[i]);
        const slider = document.getElementById(`${FIELD_IDS[i]}-slider`);
        const range = FEATURE_RANGES[i];
        [num, slider].forEach(el => {
          el.min = toDisplayValue(range.min, i);
          el.max = toDisplayValue(range.max, i);
          el.step = 'any';
        });
        slider.step = '0.01';
        num.value = Number.isFinite(values[i]) ? toDisplayValue(values[i], i) : '';
        slider.value = num.value;
        num.closest('.input-group').querySelector('.input-unit').textContent = i === 3
          ? (bsUnit === 'mgdl' ? 'mg/dL' : 'mmol/L') : (tempUnit === 'c' ? '°C' : '°F');
        updateSliderZone(slider, i);
      });
    });
  });

  // Gestational Trimester Select
  document.getElementById('gestational-trimester')?.addEventListener('change', (e) => {
    selectedTrimester = parseInt(e.target.value);
    FIELD_IDS.forEach((id, i) => {
      const slider = document.getElementById(`${id}-slider`);
      if (slider) updateSliderZone(slider, i);
    });
    showToast(`Adjusted physiological thresholds for Trimester ${selectedTrimester}`, 'info');
  });

  // Clinical PDF Export Button
  document.getElementById('download-pdf-btn')?.addEventListener('click', generateClinicalPDF);

  // WhatsApp Clinical Summary Share Button
  document.getElementById('whatsapp-share-btn')?.addEventListener('click', shareToWhatsApp);

  // Doctor Explainer Mode Toggle Button
  document.getElementById('doctor-summary-btn')?.addEventListener('click', toggleDoctorExplainerMode);

  // Share Result Link Button
  document.getElementById('share-result-btn')?.addEventListener('click', shareAssessmentLink);

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

  guided = initGuided({
    validate: () => validateMeasurements(getInputValues(), FEATURE_RANGES, FEATURE_NAMES),
    onErrors: displayInputErrors,
    onSubmit: runPrediction,
  });
  document.addEventListener('languagechange', () => {
    if (displayedResult) renderUncertainty(displayedResult, displayedSimulation);
    if (currentResult) prepareComparison(currentResult);
    displayInputErrors(activeErrors, false);
  });
  initLanguage();
  initOffline();
  initEvidence();

  // Keep performance claims and hero counters aligned with exported model metadata.
  document.querySelectorAll('[data-model-accuracy]').forEach(el => {
    el.textContent = (DATASET_STATS.accuracy * 100).toFixed(1) + '%';
  });
  document.querySelectorAll('[data-model-stat]').forEach(el => {
    const key = el.dataset.modelStat;
    el.dataset.counter = key === 'accuracy'
      ? (DATASET_STATS.accuracy * 100).toFixed(1)
      : String(DATASET_STATS[key]);
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
