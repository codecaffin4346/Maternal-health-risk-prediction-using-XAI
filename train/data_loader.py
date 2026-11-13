"""Strict real-data loader. No synthetic fallback, label substitution, or dataset mixing.

The default is the official UCI CSV. Explicit --uci files must use its six-feature
schema and Low/Mid/High risk labels; this does not validate their clinical origin.
"""
import json
import hashlib
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from download_uci import download, DEFAULT_PATH

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DATA_DIR = Path(__file__).parent / 'data'
FEATURE_COLS = ['Age','SystolicBP','DiastolicBP','BS','BodyTemp','HeartRate']
TARGET_COL = 'RiskLevel'
LABEL_MAP = {'low risk':0, 'mid risk':1, 'high risk':2}
# Existing training bounds retained for comparability, not as clinical cutoffs.
BOUNDS = [(10,60),(60,200),(30,130),(2,25),(95,107),(30,130)]

def load_uci(path=None):
    explicit = path is not None
    local = Path(path) if explicit else DEFAULT_PATH
    if not local.exists():
        if explicit:
            raise FileNotFoundError(f'Requested real dataset does not exist: {local}')
        try:
            download(local)
        except Exception as error:
            raise RuntimeError('Official UCI download failed. Training stopped; no substitute records were generated. Run python train/download_uci.py online, or pass --uci with a real CSV.') from error
    if not explicit:
        provenance = local.with_suffix('.source.json')
        if not provenance.exists() or json.loads(provenance.read_text(encoding='utf-8')).get('csv_sha256') != hashlib.sha256(local.read_bytes()).hexdigest():
            raise ValueError('Default UCI cache lacks matching source provenance. Run python train/download_uci.py to refresh the official source.')
    df = pd.read_csv(local, encoding='utf-8-sig')
    if list(df.columns) != FEATURE_COLS + [TARGET_COL]:
        raise ValueError('Expected the six UCI features followed by RiskLevel; units must be years, mmHg, mmol/L, Fahrenheit and bpm. Units are not guessed.')
    original_count = len(df)
    labels = df[TARGET_COL].astype(str).str.strip().str.lower().map(LABEL_MAP)
    numeric = df[FEATURE_COLS].apply(pd.to_numeric, errors='coerce')
    good_labels = labels.notna()
    finite = np.isfinite(numeric).all(axis=1)
    bounds = pd.Series(True,index=df.index)
    exclusions = {}
    for col,(lo,hi) in zip(FEATURE_COLS,BOUNDS):
        valid = numeric[col].between(lo,hi)
        exclusions[col] = int((~valid).sum())
        bounds &= valid
    valid = good_labels & finite & bounds
    clean = numeric.loc[valid].copy()
    clean[TARGET_COL] = labels.loc[valid].astype(int)
    clean['source'] = 'explicit_real_csv' if explicit else 'official_uci'
    if clean.empty:
        raise ValueError('No usable real rows after validation; training stopped')
    clean.attrs['quality'] = {'raw_rows':original_count,'retained_rows':len(clean),
        'excluded_rows':int((~valid).sum()),'invalid_labels':int((~good_labels).sum()),
        'non_finite_rows':int((~finite).sum()),'bounds_flags_by_feature':exclusions,
        'duplicates_retained_for_grouped_splitting':int(clean.duplicated(FEATURE_COLS+[TARGET_COL]).sum())}
    print('Real-data validation: '+json.dumps(clean.attrs['quality']))
    return clean.reset_index(drop=True)

def load_and_merge(uci_path=None, high_risk_path=None, pima_path=None, gestational_path=None,
                   use_pima=False, use_gestational=False, allow_synthetic=False):
    if any([high_risk_path,pima_path,gestational_path,use_pima,use_gestational,allow_synthetic]):
        raise ValueError('Synthetic augmentation and cross-dataset mixing are disabled. Diabetes outcomes cannot be substituted for maternal-risk labels. External datasets require a separate reviewed schema, provenance, units and label definition before inclusion.')
    df = load_uci(uci_path)
    meta = {'n_samples':len(df),'n_features':len(FEATURE_COLS),
        'sources':{'explicit real CSV' if uci_path else 'official UCI (Bangladesh)':len(df)},
        'class_dist':df[TARGET_COL].value_counts().sort_index().to_dict(),
        'data_quality':df.attrs.get('quality',{})}
    return df,meta
