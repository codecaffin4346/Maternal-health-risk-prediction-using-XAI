# Training data

Use real records only. The default loader downloads the official UCI Maternal Health Risk CSV and records source URL, retrieval time and SHA256 hashes in `maternal_health_risk.source.json`.

```sh
python train/download_uci.py
python train/audit_model.py
```

The downloaded CSV is ignored by Git. Its source sidecar and the aggregate audit report can be reviewed separately. Dataset: Ahmed, M. (2020), Maternal Health Risk, UCI, DOI:10.24432/C5DP5D, CC BY 4.0. Original source: https://archive.ics.uci.edu/dataset/863/maternal+health+risk

Expected columns, in order:

```text
Age,SystolicBP,DiastolicBP,BS,BodyTemp,HeartRate,RiskLevel
```

Units are years, mmHg, mmHg, mmol/L, Fahrenheit and bpm. Labels must be `low risk`, `mid risk`, or `high risk`. Units are not inferred from medians. A custom real CSV may be passed explicitly via `--uci`; that does not verify its provenance or clinical suitability. Do not place identifiable patient data in Git.

The legacy training bounds retain 1,004 of 1,014 rows in the downloaded file: eight age exclusions and two heart-rate exclusions. These are inherited processing bounds, not validated clinical cutoffs. The audit separately reports every numeric/labelled row, unique complete rows, and the subset accepted by browser validation. It flags duplicates and conflicting labels without silently selecting a preferred label.

Pima diabetes, gestational diabetes and synthetic supplements are disabled in this pipeline. A diabetes outcome is not a maternal-risk label. Additional sources need explicit provenance, compatible label definitions, known units and a reviewed inclusion policy before integration.

Identical measurement vectors are grouped together during cross-validation. No patient identifiers are available in this public dataset, so this does not establish patient-independent validation.
