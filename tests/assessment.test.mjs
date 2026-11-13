import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const load = name => import('data:text/javascript;base64,' + Buffer.from(read(name)).toString('base64'));
const {validateMeasurements, explainUncertainty, comparisonRows, validHistoryEntry} = await load('js/assessment.js');
const {FEATURE_RANGES, FEATURE_NAMES, predict} = await load('js/model.js');
const valid = [32,132,84,7,98.8,80];
const validate = input => validateMeasurements(input, FEATURE_RANGES, FEATURE_NAMES);
test('missing, infinite and out-of-range readings are rejected', () => {
  assert.equal(validate(valid).length,0);
  for (const value of [NaN,Infinity,0,200]) {
    const input=[...valid]; input[1]=value; assert.ok(validate(input).some(e=>e.index===1));
  }
});
test('blood pressure readings must be in the right order', () => {
  assert.ok(validate([32,80,84,7,98.8,80]).some(e=>e.message.includes('top blood pressure')));
  assert.ok(validate([32,84,84,7,98.8,80]).length);
});
test('uncertainty describes close probabilities without treating them as clinical certainty', () => {
  assert.equal(explainUncertainty([0.2,0.39,0.41]).close,true);
  assert.equal(explainUncertainty([0.8,0.1,0.1]).close,false);
  assert.match(explainUncertainty([0.8,0.1,0.1]).text,/does not rule out/);
});
test('visit changes preserve direction and do not mutate measurements', () => {
  const previous=[25,140,90,8,98,72];
  const rows=comparisonRows(valid,previous);
  assert.equal(rows[1].change,-8); assert.equal(rows[5].change,8);
  assert.deepEqual(previous,[25,140,90,8,98,72]);
});
test('malformed saved history is rejected', () => {
  assert.equal(validHistoryEntry({id:1,ts:'visit',riskClass:1,input:valid,probs:[0.2,0.6,0.2]}),true);
  assert.ok(!validHistoryEntry({id:1,input:valid}));
});
test('all presets match their labels and stay within supported ranges', () => {
  const app=read('js/app.js');
  const presets=Function('return ('+app.match(/const PRESETS = (\{[\s\S]*?\});/)[1]+')')();
  for (const [key,category] of [['low',0],['mid',1],['high',2]]) {
    assert.equal(validate(presets[key]).length,0);
    assert.equal(predict(presets[key]).riskClass,category);
  }
});
test('unit display conversions round-trip including model boundaries', () => {
  const app=read('js/app.js');
  const source=app.slice(app.indexOf('function toDisplayValue'),app.indexOf('function renderUncertainty'));
  for (const bsUnit of ['mmol','mgdl']) for (const tempUnit of ['f','c']) {
    const display=Function('bsUnit','tempUnit',source+'; return toDisplayValue;')(bsUnit,tempUnit);
    for (const side of ['min','max']) {
      const input=FEATURE_RANGES.map((r,i)=>display(r[side],i));
      if(bsUnit==='mgdl') input[3]/=18.0182;
      if(tempUnit==='c') input[4]=input[4]*9/5+32;
      for (let i=0;i<6;i++) assert.ok(Math.abs(input[i]-FEATURE_RANGES[i][side])<0.00001);
    }
  }
});
