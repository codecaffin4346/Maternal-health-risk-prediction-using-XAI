"""Regression tests for evidence calculations, honest loading and lossless export."""
import copy
import importlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, log_loss

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'train'))
import audit_model as audit
import data_loader
import export_js

class EvidenceTests(unittest.TestCase):
    def test_duplicates_and_conflicts_are_distinguished(self):
        a=[25,110,70,7,98,72]; b=[35,140,90,12,99,80]
        rows=[{'input':a,'label':0},{'input':a,'label':0},{'input':a,'label':1},{'input':b,'label':2}]
        ranges=[{'min':0,'max':200}]*6
        result=audit.audit_records(rows,ranges)
        self.assertEqual(result['duplicate_complete_rows'],1)
        self.assertEqual(result['unique_measurement_vectors'],2)
        self.assertEqual(result['conflicting_label_groups'],1)
        self.assertEqual(result['rows_in_conflicting_groups'],3)

    def test_metrics_agree_with_sklearn_including_ties(self):
        labels=[0,0,1,1,2,2]
        probs=np.array([[.7,.2,.1],[.2,.5,.3],[.1,.8,.1],[.5,.3,.2],[.1,.1,.8],[.4,.4,.2]])
        predictions=[{'riskClass':int(p.argmax()),'probs':p.tolist()} for p in probs]
        result=audit.evaluate([{'label':value} for value in labels],predictions)
        self.assertAlmostEqual(result['accuracy'],accuracy_score(labels,probs.argmax(axis=1)))
        self.assertAlmostEqual(result['macro_f1'],f1_score(labels,probs.argmax(axis=1),average='macro'))
        self.assertAlmostEqual(result['macro_auc_ovr'],roc_auc_score(labels,probs,multi_class='ovr',average='macro'))
        self.assertAlmostEqual(result['log_loss'],log_loss(labels,probs))
        self.assertEqual(result['high_risk_missed'],1)
        self.assertEqual(result['high_risk_predicted_low'],1)

    def test_csv_missing_and_non_finite_values_are_not_imputed(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            path=Path(folder)/'sample.csv'
            path.write_text(','.join(audit.FEATURES+['RiskLevel'])+'\n25,110,70,7,98,72,low risk\n25,110,70,,98,72,low risk\n25,110,70,NaN,98,72,low risk\n',encoding='utf-8')
            rows,summary=audit.load_records(path)
            self.assertEqual(len(rows),1); self.assertEqual(summary['unusable_rows'],2)

    def test_loader_never_substitutes_data(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            missing=Path(folder)/'missing.csv'
            with self.assertRaises(FileNotFoundError): data_loader.load_uci(missing)
            with patch.object(data_loader,'DEFAULT_PATH',missing),patch.object(data_loader,'download',side_effect=OSError('offline')):
                with self.assertRaisesRegex(RuntimeError,'no substitute'): data_loader.load_uci()
        for options in [{'allow_synthetic':True},{'use_pima':True},{'use_gestational':True},{'high_risk_path':'other.csv'}]:
            with self.assertRaisesRegex(ValueError,'disabled'): data_loader.load_and_merge(**options)

    def test_default_source_checksum_must_match(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            path=Path(folder)/'cached.csv'
            path.write_text('modified source',encoding='utf-8')
            path.with_suffix('.source.json').write_text('{"csv_sha256":"wrong"}',encoding='utf-8')
            with patch.object(data_loader,'DEFAULT_PATH',path):
                with self.assertRaisesRegex(ValueError,'provenance'): data_loader.load_uci()

    def test_grouped_training_cannot_split_identical_measurements(self):
        import train_model
        captured=[]
        original=train_model.StratifiedGroupKFold
        class CheckedSplitter:
            def __init__(self,**kwargs): self.splitter=original(**kwargs)
            def split(self,X,y,groups):
                for train,validation in self.splitter.split(X,y,groups):
                    self_outer.assertTrue(set(groups[train]).isdisjoint(set(groups[validation])))
                    captured.append((train,validation))
                    yield train,validation
        self_outer=self
        rng=np.random.default_rng(12)
        X=np.vstack([rng.normal(loc=i*3,size=(30,6)) for i in range(3)])
        y=np.repeat([0,1,2],30)
        X=np.repeat(X,2,axis=0); y=np.repeat(y,2)
        with patch.object(train_model,'StratifiedGroupKFold',CheckedSplitter):
            _,metrics=train_model.train_with_cv(X,y,n_splits=3,n_estimators=3,max_depth=2)
        self.assertEqual(len(captured),3)
        self.assertEqual(metrics['unique_measurement_groups'],90)

    def test_export_preserves_complete_evaluated_forest(self):
        rng=np.random.default_rng(7)
        X=rng.normal(size=(120,6)).astype(np.float32)
        y=np.tile([0,1,2],40)
        rf=RandomForestClassifier(n_estimators=7,max_depth=5,random_state=4).fit(X,y)
        metrics={'per_class':{name:{'precision':0,'recall':0,'f1':0} for name in ['low','mid','high']}}
        with tempfile.TemporaryDirectory(dir=ROOT) as folder:
            candidate=Path(folder)/'candidate.js'
            candidate.write_bytes((ROOT/'js/model.js').read_bytes())
            with patch.object(export_js,'MODEL_JS',candidate),patch.object(export_js,'BACKUP_DIR',Path(folder)/'backups'):
                before=candidate.read_bytes()
                with self.assertRaisesRegex(ValueError,'pruning'): export_js.patch_model_js(rf,metrics,{},max_depth=1)
                with self.assertRaisesRegex(ValueError,'selection'): export_js.patch_model_js(rf,metrics,{},n_trees=3)
                self.assertEqual(candidate.read_bytes(),before)
                export_js.patch_model_js(rf,metrics,{})
                evaluated=subprocess.run(['node',str(ROOT/'train/model_runner.mjs'),str(candidate)],
                    input=json.dumps({'inputs':X.tolist(),'includeTrees':True}),text=True,capture_output=True,check=True)
                js=json.loads(evaluated.stdout)
                self.assertEqual(len(js['trees']),7)
                np.testing.assert_allclose([p['probs'] for p in js['predictions']],rf.predict_proba(X),rtol=0,atol=1e-12)
                self.assertEqual([p['riskClass'] for p in js['predictions']],rf.predict(X).tolist())

    def test_evidence_hash_matches_current_model(self):
        import hashlib
        report=json.loads((ROOT/'reports/model-evidence.json').read_text(encoding='utf-8'))
        self.assertEqual(report['model']['sha256'],hashlib.sha256((ROOT/'js/model.js').read_bytes()).hexdigest())
        self.assertEqual(report['evaluation_type'],'reference_replay_not_holdout')
        for check in report['execution_parity'].values(): self.assertEqual(check['mismatches'],0)

if __name__=='__main__': unittest.main()
