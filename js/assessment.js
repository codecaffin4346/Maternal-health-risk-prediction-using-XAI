/** Pure assessment helpers. All stored measurements use mmol/L and Fahrenheit. */
export function validateMeasurements(input, ranges, names) {
  const errors = [];
  input.forEach((value, i) => {
    if (!Number.isFinite(value)) errors.push({index:i, code:'missing', message:`Enter ${names[i]}.`});
    else if (value < ranges[i].min - 0.00001 || value > ranges[i].max + 0.00001)
      errors.push({index:i, code:'unsupported', message:`${names[i]} is outside this model’s supported range. Check the value and unit shown beside the field. If correct, discuss it with your care team; do not change it to fit the app.`});
  });
  if (Number.isFinite(input[1]) && Number.isFinite(input[2]) && input[1] <= input[2])
    errors.push({index:1, code:'reversed', message:'The top blood pressure number (systolic) must be higher than the bottom number (diastolic). Check both readings.'});
  return errors;
}
export function explainUncertainty(probs) {
  const ranked = probs.map((p,i)=>({p,i})).sort((a,b)=>b.p-a.p);
  const labels = ['Low Risk','Mid Risk','High Risk'];
  const gap = (ranked[0].p-ranked[1].p)*100;
  // Display heuristic only: this is not a calibrated confidence interval.
  const close = gap < 15;
  return {
    title: close ? 'The model is uncertain between two categories' : 'How to read this prediction',
    text: `${labels[ranked[0].i]} received ${(ranked[0].p*100).toFixed(1)}% of the model probability and ${labels[ranked[1].i]} received ${(ranked[1].p*100).toFixed(1)}%. ${close ? 'These results are close, so avoid relying on the category alone. ' : ''}These percentages describe the model output, not your chance of a healthy or unhealthy pregnancy. Share your measurements with your care team. A Low Risk result does not rule out a problem.`,
    close,
  };
}
export function comparisonRows(current, previous) {
  return current.map((value,i)=>({current:value, previous:previous[i], change:value-previous[i]}));
}
export function validHistoryEntry(entry) {
  return entry && Number.isFinite(entry.id) && typeof entry.ts === 'string' &&
    [0,1,2].includes(entry.riskClass) && Array.isArray(entry.input) && entry.input.length === 6 &&
    entry.input.every(Number.isFinite) && Array.isArray(entry.probs) && entry.probs.length === 3 &&
    entry.probs.every(p=>Number.isFinite(p) && p>=0 && p<=1);
}
