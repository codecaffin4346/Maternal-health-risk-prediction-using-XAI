/**
 * charts.js — Chart.js wrappers for all visualisations
 * Gauge, Probability Bars, SHAP Waterfall, Radar, Confusion Matrix
 */

import { FEATURE_NAMES, FEATURE_UNITS, FEATURE_RANGES, DATASET_STATS } from './model.js';

// ─────────────────────────────────────────────────────────────────
// ANIMATED RISK GAUGE (doughnut-style)
// ─────────────────────────────────────────────────────────────────
export function renderGauge(ctx, riskClass, probs) {
  if (ctx._chartInstance) ctx._chartInstance.destroy();

  const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];
  const score  = probs[1] * 1 + probs[2] * 2; // 0–2 scale
  const pct    = score / 2;                     // 0–1 scale

  ctx._chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, 1 - pct],
        backgroundColor: [COLORS[riskClass], 'rgba(255,255,255,0.04)'],
        borderWidth: 0,
        circumference: 270,
        rotation: 225,
      }],
    },
    options: {
      cutout: '75%',
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      responsive: true,
      maintainAspectRatio: true,
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// SHAP WATERFALL CHART (horizontal bar)
// ─────────────────────────────────────────────────────────────────
export function renderShapChart(ctx, shapValues, featureValues) {
  if (ctx._chartInstance) ctx._chartInstance.destroy();

  // Sort by absolute value descending
  const indices = [...shapValues.keys()].sort(
    (a, b) => Math.abs(shapValues[b]) - Math.abs(shapValues[a])
  );

  const labels    = indices.map(i => `${FEATURE_NAMES[i]} (${featureValues[i].toFixed(1)} ${FEATURE_UNITS[i]})`);
  const values    = indices.map(i => shapValues[i]);
  const colors    = values.map(v => v >= 0
    ? 'rgba(239,68,68,0.8)'    // red = pushes toward HIGH risk
    : 'rgba(34,197,94,0.8)');  // green = pushes toward LOW risk

  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: colors,
        borderColor:     colors.map(c => c.replace('0.8','1')),
        borderWidth:     1,
        borderRadius:    4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const v = ctx.raw;
              return v >= 0
                ? `+${v.toFixed(3)} → increases risk`
                : `${v.toFixed(3)} → decreases risk`;
            },
          },
        },
      },
      scales: {
        x: {
          grid:   { color: 'rgba(255,255,255,0.06)' },
          ticks:  { color: 'rgba(255,255,255,0.55)', font: { size: 11 } },
          title:  { display: true, text: 'SHAP Value (contribution to risk score)', color: '#94a3b8', font: { size: 11 } },
        },
        y: {
          grid:  { display: false },
          ticks: { color: 'rgba(255,255,255,0.75)', font: { size: 11 } },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// RADAR CHART — Patient vs. Normal Ranges
// ─────────────────────────────────────────────────────────────────
export function renderRadar(ctx, inputValues) {
  if (ctx._chartInstance) ctx._chartInstance.destroy();

  // Normalise each feature to 0–1 within full range
  const normalize = (v, i) => {
    const r = FEATURE_RANGES[i];
    return (v - r.min) / (r.max - r.min);
  };
  const normalNorm = i => {
    const r = FEATURE_RANGES[i];
    return [(r.normalMin - r.min) / (r.max - r.min),
            (r.normalMax - r.min) / (r.max - r.min)];
  };

  const patientData = inputValues.map((v, i) => normalize(v, i));
  const normalData  = [0,1,2,3,4,5].map(i => {
    const [lo, hi] = normalNorm(i);
    return (lo + hi) / 2;
  });

  ctx._chartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Age', 'Systolic BP', 'Diastolic BP', 'Blood Sugar', 'Body Temp', 'Heart Rate'],
      datasets: [
        {
          label: 'Your Values',
          data: patientData,
          backgroundColor: 'rgba(139,92,246,0.25)',
          borderColor:     '#8b5cf6',
          pointBackgroundColor: '#8b5cf6',
          pointRadius: 4,
          borderWidth: 2,
        },
        {
          label: 'Healthy Reference',
          data: normalData,
          backgroundColor: 'rgba(34,197,94,0.10)',
          borderColor:     'rgba(34,197,94,0.6)',
          pointBackgroundColor: 'rgba(34,197,94,0.6)',
          pointRadius: 3,
          borderDash: [5, 4],
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 700 },
      scales: {
        r: {
          min: 0, max: 1,
          ticks: { display: false },
          grid:  { color: 'rgba(255,255,255,0.08)' },
          pointLabels: { color: 'rgba(255,255,255,0.70)', font: { size: 11 } },
          angleLines: { color: 'rgba(255,255,255,0.08)' },
        },
      },
      plugins: {
        legend: {
          labels: { color: 'rgba(255,255,255,0.70)', boxWidth: 12, font: { size: 11 } },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// PROBABILITY BARS (animates via CSS + JS)
// ─────────────────────────────────────────────────────────────────
export function renderProbBars(container, probs) {
  const labels = ['Low Risk', 'Mid Risk', 'High Risk'];
  const colors = ['#22c55e', '#f59e0b', '#ef4444'];

  container.innerHTML = probs.map((p, i) => `
    <div class="prob-row">
      <span class="prob-label" style="color:${colors[i]}">${labels[i]}</span>
      <div class="prob-bar-track">
        <div class="prob-bar-fill"
             style="--target-width:${(p*100).toFixed(1)}%; background:${colors[i]}">
        </div>
      </div>
      <span class="prob-value">${(p*100).toFixed(1)}%</span>
    </div>
  `).join('');

  // Trigger animation on next frame
  requestAnimationFrame(() => {
    container.querySelectorAll('.prob-bar-fill').forEach(el => {
      el.style.width = el.style.getPropertyValue('--target-width');
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// CONFUSION MATRIX HEATMAP
// ─────────────────────────────────────────────────────────────────
export function renderConfusionMatrix(ctx) {
  if (ctx._chartInstance) ctx._chartInstance.destroy();

  const matrix = DATASET_STATS.confusion;
  const labels  = ['Low', 'Mid', 'High'];
  const flat    = matrix.flat();
  const maxVal  = Math.max(...flat);

  // Build bubble/scatter data
  const data = [];
  matrix.forEach((row, i) => {
    row.forEach((val, j) => {
      data.push({ x: j, y: i, v: val, r: (val / maxVal) * 28 + 4 });
    });
  });

  ctx._chartInstance = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: [{
        data,
        backgroundColor: data.map(d => {
          const alpha = 0.25 + (d.v / maxVal) * 0.65;
          return d.x === d.y
            ? `rgba(139,92,246,${alpha})`
            : `rgba(239,68,68,${alpha})`;
        }),
        borderColor: data.map(d =>
          d.x === d.y ? 'rgba(139,92,246,0.9)' : 'rgba(239,68,68,0.5)'
        ),
        borderWidth: 1.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 900 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = ctx.raw;
              return `Actual: ${labels[d.y]} → Predicted: ${labels[d.x]}  (n=${d.v})`;
            },
          },
        },
      },
      scales: {
        x: {
          min: -0.5, max: 2.5,
          ticks: {
            callback: v => labels[v] ?? '',
            color: 'rgba(255,255,255,0.65)',
            font: { size: 12 },
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: { display: true, text: 'Predicted Label', color: '#94a3b8' },
        },
        y: {
          min: -0.5, max: 2.5,
          reverse: true,
          ticks: {
            callback: v => labels[v] ?? '',
            color: 'rgba(255,255,255,0.65)',
            font: { size: 12 },
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
          title: { display: true, text: 'Actual Label', color: '#94a3b8' },
        },
      },
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// FEATURE IMPORTANCE BAR CHART
// ─────────────────────────────────────────────────────────────────
export function renderFeatureImportance(ctx) {
  if (ctx._chartInstance) ctx._chartInstance.destroy();

  const importance = DATASET_STATS.feature_importance;
  const sorted     = [...importance.keys()].sort((a, b) => importance[b] - importance[a]);

  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels:   sorted.map(i => FEATURE_NAMES[i]),
      datasets: [{
        data:            sorted.map(i => importance[i]),
        backgroundColor: ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b'],
        borderRadius: 6,
        borderWidth:  0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid:  { display: false },
          ticks: { color: 'rgba(255,255,255,0.70)', font: { size: 12 } },
        },
        y: {
          grid:  { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: 'rgba(255,255,255,0.55)', font: { size: 11 } },
          title: { display: true, text: 'Importance Score', color: '#94a3b8', font: { size: 11 } },
        },
      },
    },
  });
}
