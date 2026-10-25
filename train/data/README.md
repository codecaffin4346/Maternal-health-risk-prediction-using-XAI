# 🗄️ Dataset Files

Place your downloaded dataset CSV files here. The pipeline will auto-detect them.

## Required

| Filename | Dataset | Where to download |
|---|---|---|
| `maternal_health_risk.csv` | UCI Maternal Health (primary) | Auto-downloaded if missing |

## Optional (improves accuracy)

| Filename | Dataset | Download Link |
|---|---|---|
| `high_risk_pregnancy.csv` | High-Risk Pregnancy (Kaggle) | [Kaggle: Maternal Health and High-Risk Pregnancy](https://www.kaggle.com/datasets) |
| `pima_diabetes.csv` | Pima Indians Diabetes | Auto-downloaded if missing |
| `gestational_diabetes.csv` | Gestational Diabetes Extended | [Kaggle: Gestational Diabetes Dataset](https://www.kaggle.com/datasets) |

## Expected Column Names

The loader does **flexible column mapping** so exact names don't matter, but ideally:

### maternal_health_risk.csv
```
Age, SystolicBP, DiastolicBP, BS, BodyTemp, HeartRate, RiskLevel
```
Labels: `low risk`, `mid risk`, `high risk`

### high_risk_pregnancy.csv
```
Age, SystolicBP, DiastolicBP, BS (or Glucose), BodyTemp, HeartRate, RiskLabel
```
Labels: `normal`, `high risk`  (binary is fine — pipeline maps automatically)

### pima_diabetes.csv
```
Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DiabetesPedigree, Age, Outcome
```
Note: Glucose is in mg/dL — auto-converted to mmol/L

### gestational_diabetes.csv
Any CSV with glucose/BP/age columns and a risk/outcome label column.

## Notes

- All files are **gitignored** by default (see ../.gitignore) to avoid committing patient data
- The pipeline prints exactly what was loaded and how many rows survived validation
- If a file is missing, the pipeline uses a realistic synthetic supplement and continues
