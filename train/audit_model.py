"""Audit a real CSV and replay it through the exact browser model. No training or model changes.

Usage: python train/audit_model.py [--csv path] [--output reports/model-evidence.json]
Requires Python standard library and Node.js only. Replay results are NOT holdout validation.
"""
import argparse
import csv
import hashlib
import json
import math
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEATURES = ['Age','SystolicBP','DiastolicBP','BS','BodyTemp','HeartRate']
LABELS = ['low risk','mid risk','high risk']
LEGACY_BOUNDS = [(10,60),(60,200),(30,130),(2,25),(95,107),(30,130)]

def load_records(path):
    records, issues = [], []
    with Path(path).open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        required = FEATURES + ['RiskLevel']
        if reader.fieldnames != required:
            raise ValueError('Expected exactly these columns in order: '+','.join(required))
        count = 0
        for line, row in enumerate(reader, 2):
            count += 1
            try:
                values = [float(row[key]) for key in FEATURES]
                if not all(math.isfinite(value) for value in values):
                    raise ValueError('non-finite measurement')
                label = LABELS.index(row['RiskLevel'].strip().lower())
                if None in row:
                    raise ValueError('extra columns')
            except (ValueError, TypeError, AttributeError) as error:
                issues.append({'line':line, 'reason':str(error)})
                continue
            records.append({'input':values, 'label':label, 'line':line})
    return records, {'raw_rows':count, 'unusable_rows':len(issues), 'issues':issues}

def audit_records(records, ranges):
    full = Counter(tuple(r['input'])+(r['label'],) for r in records)
    groups = defaultdict(Counter)
    for record in records:
        groups[tuple(record['input'])][record['label']] += 1
    conflicts = [counts for counts in groups.values() if len(counts)>1]
    limits = {name:{'minimum':min(r['input'][i] for r in records),
                    'maximum':max(r['input'][i] for r in records),
                    'outside_browser_range':sum(not ranges[i]['min']<=r['input'][i]<=ranges[i]['max'] for r in records),
                    'outside_legacy_training_bounds':sum(not LEGACY_BOUNDS[i][0]<=r['input'][i]<=LEGACY_BOUNDS[i][1] for r in records)}
              for i,name in enumerate(FEATURES)}
    return {
        'usable_rows':len(records), 'class_counts':{label:sum(r['label']==i for r in records) for i,label in enumerate(LABELS)},
        'unique_complete_rows':len(full), 'duplicate_complete_rows':sum(n-1 for n in full.values()),
        'unique_measurement_vectors':len(groups), 'conflicting_label_groups':len(conflicts),
        'rows_in_conflicting_groups':sum(sum(group.values()) for group in conflicts),
        'systolic_not_above_diastolic':sum(r['input'][1]<=r['input'][2] for r in records),
        'legacy_eligible_rows':sum(all(lo<=x<=hi for x,(lo,hi) in zip(r['input'],LEGACY_BOUNDS)) for r in records),
        'features':limits,
        'identity_limit':'No patient, visit, hospital or collection-time identifiers. Equal measurements do not prove equal patients; independent patient-level splits cannot be established.',
        'label_limit':'The CSV provides risk categories, not longitudinal pregnancy outcomes. Label correctness and outcome benefit cannot be established from this file.',
    }

def run_browser(inputs, include_trees=False):
    result = subprocess.run(['node',str(ROOT/'train/model_runner.mjs')],
        input=json.dumps({'inputs':inputs,'includeTrees':include_trees}),
        text=True, capture_output=True, check=True, timeout=60)
    return json.loads(result.stdout)

def python_predict(trees, values):
    sums = [0.,0.,0.]
    for tree in trees:
        node = tree
        while not node.get('leaf',False):
            node = node['L'] if values[node['f']]<=node['t'] else node['R']
        for i,p in enumerate(node['p']): sums[i] += p
    probs = [p/len(trees) for p in sums]
    total = sum(probs)
    probs = [max(0,min(1,p/total)) for p in probs]
    return {'riskClass':max(range(3),key=lambda i:probs[i]), 'probs':probs}

def boundary_probes(trees, ranges):
    thresholds = set()
    def walk(node):
        if node.get('leaf'): return
        thresholds.add((node['f'],node['t']))
        walk(node['L']); walk(node['R'])
    for tree in trees: walk(tree)
    points = []
    anchor = [28,110,72,7,98,76]
    for index, threshold in sorted(thresholds):
        for delta in [-1e-7,0,1e-7]:
            values = anchor.copy(); values[index] = threshold+delta; points.append(values)
    for index, limits in enumerate(ranges):
        for boundary in [limits['min'],limits['max']]:
            for delta in [-1e-7,0,1e-7]:
                values = anchor.copy(); values[index] = boundary+delta; points.append(values)
    return points

def parity(trees, inputs, predictions):
    errors = []
    mismatches = 0
    for values, actual in zip(inputs,predictions):
        expected = python_predict(trees, values)
        error = max(abs(a-b) for a,b in zip(actual['probs'],expected['probs']))
        errors.append(error)
        mismatches += expected['riskClass']!=actual['riskClass'] or error>1e-12
    return {'records_checked':len(inputs), 'mismatches':mismatches,
            'maximum_probability_difference':max(errors,default=0)}

def auc_binary(labels, scores):
    positive = sum(labels); negative = len(labels)-positive
    if not positive or not negative: return None
    pairs = sorted(zip(scores,labels))
    rank_sum, start = 0.,0
    while start<len(pairs):
        end = start+1
        while end<len(pairs) and pairs[end][0]==pairs[start][0]: end+=1
        rank_sum += ((start+1+end)/2)*sum(label for _,label in pairs[start:end])
        start=end
    return (rank_sum-positive*(positive+1)/2)/(positive*negative)

def evaluate(records, predictions):
    if not records: return None
    cm = [[0]*3 for _ in range(3)]
    brier, log_loss = 0.,0.
    bins = [{'count':0,'correct':0,'probability_sum':0.} for _ in range(10)]
    for row, pred in zip(records,predictions):
        actual, predicted = row['label'],pred['riskClass']
        cm[actual][predicted] += 1
        brier += sum((p-int(actual==i))**2 for i,p in enumerate(pred['probs']))
        log_loss -= math.log(max(1e-15,pred['probs'][actual]))
        confidence = max(pred['probs']); bucket = bins[min(9,int(confidence*10))]
        bucket['count']+=1; bucket['correct']+=actual==predicted; bucket['probability_sum']+=confidence
    per_class = {}
    for i,label in enumerate(LABELS):
        tp = cm[i][i]; support=sum(cm[i]); predicted=sum(row[i] for row in cm)
        precision=tp/predicted if predicted else 0
        recall=tp/support if support else 0
        per_class[label]={'support':support,'precision':precision,'recall':recall,
                         'f1':2*precision*recall/(precision+recall) if precision+recall else 0}
    n=len(records)
    calibration = [{'lower_bound':i/10,'upper_bound':(i+1)/10,'count':bucket['count'],
        'observed_accuracy':bucket['correct']/bucket['count'],
        'mean_top_probability':bucket['probability_sum']/bucket['count']}
        for i,bucket in enumerate(bins) if bucket['count']]
    aucs=[auc_binary([int(r['label']==i) for r in records],[p['probs'][i] for p in predictions]) for i in range(3)]
    non_high=sum(sum(cm[i]) for i in [0,1])
    return {
        'rows':n,'accuracy':sum(cm[i][i] for i in range(3))/n,
        'macro_f1':sum(value['f1'] for value in per_class.values())/3,
        'macro_auc_ovr':sum(aucs)/3 if all(value is not None for value in aucs) else None,
        'confusion_matrix':cm,'per_class':per_class,
        'high_risk_missed':cm[2][0]+cm[2][1], 'high_risk_predicted_low':cm[2][0],
        'non_high_flagged_high':cm[0][2]+cm[1][2],
        'high_risk_false_positive_rate':(cm[0][2]+cm[1][2])/non_high if non_high else None,
        'multiclass_brier_sum':brier/n,'log_loss':log_loss/n,
        'top_label_ece_10_bins':sum(row['count']*abs(row['observed_accuracy']-row['mean_top_probability']) for row in calibration)/n,
        'calibration_bins':calibration,
    }

def build_report(path):
    records, parsing = load_records(path)
    if not records: raise ValueError('No usable real records; evaluation stopped')
    inputs = [row['input'] for row in records]
    browser = run_browser(inputs,True)
    probes = boundary_probes(browser['trees'],browser['ranges'])
    probe_predictions = run_browser(probes)['predictions']
    quality = audit_records(records,browser['ranges'])
    all_indices = list(range(len(records)))
    seen = set(); unique=[]
    for i,row in enumerate(records):
        key=tuple(row['input'])+(row['label'],)
        if key not in seen: seen.add(key); unique.append(i)
    supported = [i for i,row in enumerate(records) if all(r['min']<=value<=r['max'] for value,r in zip(row['input'],browser['ranges'])) and row['input'][1]>row['input'][2]]
    def subset(indices): return evaluate([records[i] for i in indices],[browser['predictions'][i] for i in indices])
    data_hash=hashlib.sha256(Path(path).read_bytes()).hexdigest()
    source_path=Path(path).with_suffix('.source.json')
    source=json.loads(source_path.read_text(encoding='utf-8')) if source_path.exists() else None
    verified=bool(source and source.get('csv_sha256')==data_hash)
    model_path=ROOT/'js/model.js'
    report={
        'schema_version':1,'generated_at':datetime.now(timezone.utc).isoformat(),
        'status':'research_only_not_clinically_validated',
        'evaluation_type':'reference_replay_not_holdout',
        'limitations':[
            'Training membership of the existing model is unknown. This replay may include training records; these scores do not measure unseen-patient performance.',
            'No external validation, prospective study, clinical outcome assessment or calibration on an independent cohort was performed.',
            'Do not substitute these replay scores for the historical cross-validation metrics in DATASET_STATS.',
            'Independent Python/JavaScript parity verifies execution of the shipped trees, not equivalence to an unavailable original sklearn model or model correctness.',
        ],
        'dataset':{'filename':Path(path).name,'sha256':data_hash,'source':source,'source_hash_verified':verified,**parsing,**quality},
        'model':{'file':'js/model.js','sha256':hashlib.sha256(model_path.read_bytes()).hexdigest(),
                 'tree_count':len(browser['trees']),'historical_training_metadata':browser['stats']},
        'execution_parity':{'reference_rows':parity(browser['trees'],inputs,browser['predictions']),
                            'boundary_probes':parity(browser['trees'],probes,probe_predictions)},
        'replay':{'all_usable_rows':subset(all_indices), 'unique_complete_rows':subset(unique),
                  'browser_supported_rows':subset(supported)},
        'age_subgroups':{},
    }
    for label,predicate in [('under_20',lambda age:age<20),('20_to_34',lambda age:20<=age<35),('35_and_over',lambda age:age>=35)]:
        indices=[i for i,row in enumerate(records) if predicate(row['input'][0])]
        report['age_subgroups'][label]=subset(indices)
    return report

def markdown(report):
    d=report['dataset']; m=report['replay']['all_usable_rows']; u=report['replay']['unique_complete_rows']
    lines=['# Browser model and dataset audit','',
        '**Reference-data replay only. These are not holdout results or evidence of clinical readiness.**','',
        f"Generated: {report['generated_at']}",f"Dataset SHA256: `{d['sha256']}`",f"Model SHA256: `{report['model']['sha256']}`",'',
        '## Data quality','',f"- CSV records: {d['raw_rows']}; usable numeric/label records: {d['usable_rows']}; unusable: {d['unusable_rows']}.",
        f"- Exact duplicate rows beyond first occurrence: {d['duplicate_complete_rows']}.",
        f"- Distinct measurement vectors: {d['unique_measurement_vectors']}.",
        f"- Identical measurement vectors with different labels: {d['conflicting_label_groups']} groups ({d['rows_in_conflicting_groups']} rows). This is a label-review flag, not proof that either label is wrong.",
        f"- Legacy training-bound eligible rows: {d['legacy_eligible_rows']}.",f"- Rows accepted by current browser input validation: {(report['replay']['browser_supported_rows'] or {}).get('rows',0)}.",'',
        '## Exact shipped model replay','',
        '| Population | Rows | Accuracy | Macro F1 | High-risk recall |',
        '|---|---:|---:|---:|---:|']
    for name,result in report['replay'].items():
        if result: lines.append(f"| {name} | {result['rows']} | {result['accuracy']:.1%} | {result['macro_f1']:.1%} | {result['per_class']['high risk']['recall']:.1%} |")
    lines += ['',f"In the full reference replay, {m['high_risk_missed']} labelled high-risk rows were assigned another category, including {m['high_risk_predicted_low']} assigned Low Risk. {m['non_high_flagged_high']} non-high rows were assigned High Risk.",
        '', 'Confusion matrix: rows = recorded Low/Mid/High labels; columns = predicted Low/Mid/High.', '',
        '| Recorded label | Low | Mid | High |','|---|---:|---:|---:|']
    for label,row in zip(LABELS,m['confusion_matrix']): lines.append('| '+label+' | '+' | '.join(map(str,row))+' |')
    lines += ['',f"Multiclass Brier score (sum over three classes): {m['multiclass_brier_sum']:.4f}; log loss: {m['log_loss']:.4f}; top-label ECE (10 fixed bins): {m['top_label_ece_10_bins']:.4f}. These are descriptive replay values, not independent evidence of calibration.",'','## Execution parity','']
    for label,result in report['execution_parity'].items(): lines.append(f"- {label}: {result['records_checked']} inputs, {result['mismatches']} mismatches; maximum probability difference {result['maximum_probability_difference']:.3g}.")
    lines += ['','## Limits and next steps','']+['- '+text for text in report['limitations']]
    lines += ['- '+d['identity_limit'],'- '+d['label_limit'],
        '- Before retraining: review units and exclusions, keep identical measurement vectors together across folds, and retain conflicting labels for review rather than silently choosing a label.',
        '- Before clinical use: obtain appropriately governed representative patient/visit-level data with clinician-defined outcomes and evaluate externally.','',
        'Source: [UCI Maternal Health Risk](https://archive.ics.uci.edu/dataset/863/maternal+health+risk), Ahmed (2020), DOI:10.24432/C5DP5D, CC BY 4.0. Source provenance is hash-verified only when matching sidecar metadata is present.','']
    return '\n'.join(lines)

def main():
    if sys.platform=='win32': sys.stdout.reconfigure(encoding='utf-8')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv',type=Path,default=ROOT/'train/data/maternal_health_risk.csv')
    parser.add_argument('--output',type=Path,default=ROOT/'reports/model-evidence.json')
    args=parser.parse_args()
    report=build_report(args.csv)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    args.output.with_suffix('.md').write_text(markdown(report),encoding='utf-8')
    print(json.dumps({'data_rows':report['dataset']['raw_rows'],'duplicates':report['dataset']['duplicate_complete_rows'],
        'conflicting_groups':report['dataset']['conflicting_label_groups'],
        'replay_accuracy':report['replay']['all_usable_rows']['accuracy'],
        'high_risk_missed':report['replay']['all_usable_rows']['high_risk_missed'],
        'parity':report['execution_parity']},indent=2))
    if any(check['mismatches'] for check in report['execution_parity'].values()): raise SystemExit('Parity failed')

if __name__=='__main__': main()
