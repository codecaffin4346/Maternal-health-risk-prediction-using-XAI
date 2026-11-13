# Browser model and dataset audit

**Reference-data replay only. These are not holdout results or evidence of clinical readiness.**

Generated: 2026-11-13T20:52:07.936474+00:00
Dataset SHA256: `a1f7025719f84715096e0d1f95ae2e56b57809b9b15449e1836c96a7d976ae9b`
Model SHA256: `29eb0ed5e5c5148c422ab801a70106a55446d2cd651d746dcafbeb235658896d`

## Data quality

- CSV records: 1014; usable numeric/label records: 1014; unusable: 0.
- Exact duplicate rows beyond first occurrence: 562.
- Distinct measurement vectors: 416.
- Identical measurement vectors with different labels: 35 groups (215 rows). This is a label-review flag, not proof that either label is wrong.
- Legacy training-bound eligible rows: 1004.
- Rows accepted by current browser input validation: 874.

## Exact shipped model replay

| Population | Rows | Accuracy | Macro F1 | High-risk recall |
|---|---:|---:|---:|---:|
| all_usable_rows | 1014 | 73.0% | 72.0% | 84.6% |
| unique_complete_rows | 452 | 74.8% | 69.7% | 75.9% |
| browser_supported_rows | 874 | 73.1% | 72.7% | 81.2% |

In the full reference replay, 42 labelled high-risk rows were assigned another category, including 17 assigned Low Risk. 44 non-high rows were assigned High Risk.

Confusion matrix: rows = recorded Low/Mid/High labels; columns = predicted Low/Mid/High.

| Recorded label | Low | Mid | High |
|---|---:|---:|---:|
| low risk | 361 | 41 | 4 |
| mid risk | 147 | 149 | 40 |
| high risk | 17 | 25 | 230 |

Multiclass Brier score (sum over three classes): 0.3894; log loss: 0.6393; top-label ECE (10 fixed bins): 0.1136. These are descriptive replay values, not independent evidence of calibration.

## Execution parity

- reference_rows: 1014 inputs, 0 mismatches; maximum probability difference 2.22e-16.
- boundary_probes: 273 inputs, 0 mismatches; maximum probability difference 1.11e-16.

## Limits and next steps

- Training membership of the existing model is unknown. This replay may include training records; these scores do not measure unseen-patient performance.
- No external validation, prospective study, clinical outcome assessment or calibration on an independent cohort was performed.
- Do not substitute these replay scores for the historical cross-validation metrics in DATASET_STATS.
- Independent Python/JavaScript parity verifies execution of the shipped trees, not equivalence to an unavailable original sklearn model or model correctness.
- No patient, visit, hospital or collection-time identifiers. Equal measurements do not prove equal patients; independent patient-level splits cannot be established.
- The CSV provides risk categories, not longitudinal pregnancy outcomes. Label correctness and outcome benefit cannot be established from this file.
- Before retraining: review units and exclusions, keep identical measurement vectors together across folds, and retain conflicting labels for review rather than silently choosing a label.
- Before clinical use: obtain appropriately governed representative patient/visit-level data with clinician-defined outcomes and evaluate externally.

Source: [UCI Maternal Health Risk](https://archive.ics.uci.edu/dataset/863/maternal+health+risk), Ahmed (2020), DOI:10.24432/C5DP5D, CC BY 4.0. Source provenance is hash-verified only when matching sidecar metadata is present.
