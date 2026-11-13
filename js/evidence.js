// Read-only evidence view. Replay results never replace historical CV metadata.
const percent = value => (value*100).toFixed(1)+'%';
const add = (parent, tag, text) => { const el=document.createElement(tag); el.textContent=text; parent.append(el); return el; };
export async function initEvidence() {
  const status=document.getElementById('evidence-status');
  try {
    const [reportResponse,modelResponse]=await Promise.all([
      fetch('./reports/model-evidence.json'),fetch('./js/model.js'),
    ]);
    if(!reportResponse.ok || !modelResponse.ok) throw new Error('Evidence file unavailable');
    const report=await reportResponse.json();
    const bytes=await modelResponse.arrayBuffer();
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(hash!==report.model.sha256) {
      status.textContent='This evidence report belongs to a different model version. Regenerate the audit before using its results.';
      status.dataset.state='stale'; return;
    }
    const d=report.dataset, m=report.replay.all_usable_rows;
    const checks=Object.values(report.execution_parity);
    status.textContent='Report matches the loaded model. Reference replay only; not an independent test or clinical validation.';
    status.dataset.state='matched';
    const cards=document.getElementById('evidence-metrics'); cards.replaceChildren();
    for(const [label,value] of [
      ['Reference rows',d.raw_rows],['Exact duplicate rows',d.duplicate_complete_rows],
      ['Conflicting measurement groups',d.conflicting_label_groups],['Reference replay accuracy',percent(m.accuracy)],
    ]) {
      const card=add(cards,'div',''); card.className='evidence-metric';
      add(card,'strong',String(value)); add(card,'span',label);
    }
    const findings=document.getElementById('evidence-findings'); findings.replaceChildren();
    const lines=[
      `${d.unique_complete_rows} distinct complete rows; ${d.unique_measurement_vectors} distinct measurement vectors. Identical measurements do not establish patient identity.`,
      `${m.high_risk_missed} of ${m.per_class['high risk'].support} labelled high-risk rows were assigned another category, including ${m.high_risk_predicted_low} assigned Low Risk. High-risk recall: ${percent(m.per_class['high risk'].recall)}.`,
      `${m.non_high_flagged_high} non-high rows were assigned High Risk.`,
      `${report.replay.browser_supported_rows.rows} reference rows fit current browser input validation; ${d.usable_rows-report.replay.browser_supported_rows.rows} do not. These exclusions require review.`,
      `After collapsing exact duplicate rows, replay accuracy is ${percent(report.replay.unique_complete_rows.accuracy)}. This is still not a holdout result.`,
      `Python/JavaScript execution parity: ${checks.reduce((n,check)=>n+check.records_checked,0)} inputs, ${checks.reduce((n,check)=>n+check.mismatches,0)} mismatches. This checks the shipped trees, not the unavailable original trained model.`,
      d.source_hash_verified ? 'Dataset checksum matches the recorded source download.' : 'Dataset provenance could not be verified from a matching source sidecar.',
      ...report.limitations,
    ];
    lines.forEach(line=>add(findings,'li',line));
    document.getElementById('evidence-model-hash').textContent=hash;
    document.getElementById('evidence-date').textContent=report.generated_at;
    const tbody=document.getElementById('evidence-confusion'); tbody.replaceChildren();
    report.replay.all_usable_rows.confusion_matrix.forEach((row,i)=>{
      const tr=add(tbody,'tr',''); add(tr,'th',['Recorded Low','Recorded Mid','Recorded High'][i]).scope='row';
      row.forEach(value=>add(tr,'td',String(value)));
    });
  } catch {
    status.textContent='Evidence could not be loaded or its model checksum could not be verified. Assessments remain available; do not treat historical scores as a new validation.';
    status.dataset.state='unavailable';
  }
}
