"""
data_loader.py — Multi-Dataset Loader & Merger for MaternAI Pipeline
=====================================================================
Loads, cleans, unit-converts, and merges multiple maternal health datasets
into a unified DataFrame ready for training.

Supported datasets:
  1. UCI Maternal Health Risk (primary, Bangladesh)
  2. High-Risk Pregnancy Dataset (Kaggle, SE Asia)
  3. Pima Indians Diabetes (Kaggle/UCI, USA)
  4. Extended Gestational Diabetes (Kaggle)
  5. Synthetic augmentation fallback (when only UCI is available)

Author: MaternAI Pipeline
"""

import os
import io
import sys
import warnings
import requests
import numpy as np
import pandas as pd
from pathlib import Path
from colorama import Fore, Style, init

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

init(autoreset=True)
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────
DATA_DIR   = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

FEATURE_COLS = ["Age", "SystolicBP", "DiastolicBP", "BS", "BodyTemp", "HeartRate"]
TARGET_COL   = "RiskLevel"
LABEL_MAP    = {"low risk": 0, "low": 0, "mid risk": 1, "mid": 1,
                "high risk": 2, "high": 2, "normal": 0, "1": 2, "0": 0}

# ─────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────
def _banner(msg):
    print(f"\n{Fore.CYAN}{'─'*60}")
    print(f"  {msg}")
    print(f"{'─'*60}{Style.RESET_ALL}")

def _ok(msg):   print(f"  {Fore.GREEN}✓{Style.RESET_ALL} {msg}")
def _warn(msg): print(f"  {Fore.YELLOW}⚠{Style.RESET_ALL} {msg}")
def _info(msg): print(f"  {Fore.BLUE}→{Style.RESET_ALL} {msg}")

def _encode_label(series: pd.Series) -> pd.Series:
    """Normalise label strings to 0/1/2 integers."""
    return (series.astype(str)
                  .str.strip()
                  .str.lower()
                  .map(LABEL_MAP)
                  .fillna(-1)
                  .astype(int))

def _validate(df: pd.DataFrame, source: str) -> pd.DataFrame:
    """Drop rows with invalid labels or out-of-range vitals."""
    before = len(df)
    df = df[df[TARGET_COL] != -1]          # unknown labels
    df = df[df["Age"].between(10, 60)]
    df = df[df["SystolicBP"].between(60, 200)]
    df = df[df["DiastolicBP"].between(30, 130)]
    df = df[df["BS"].between(2.0, 25.0)]
    df = df[df["BodyTemp"].between(95.0, 107.0)]
    df = df[df["HeartRate"].between(30, 130)]
    after = len(df)
    if before != after:
        _warn(f"{source}: dropped {before - after} invalid rows → {after} remaining")
    return df.reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────
# DATASET 1 — UCI Maternal Health Risk (PRIMARY)
# ─────────────────────────────────────────────────────────────────
UCI_URL = (
    "https://raw.githubusercontent.com/AminKhavari78/-Maternal-Health-Risk-Data-Set/"
    "main/Maternal%20Health%20Risk%20Data%20Set.csv"
)

def load_uci(path: str | None = None) -> pd.DataFrame:
    """
    Load the UCI Maternal Health Risk dataset.
    Priority: local file → GitHub raw URL → embedded fallback.
    """
    _banner("Dataset 1 — UCI Maternal Health Risk (Bangladesh)")

    # 1. Try local file
    local = DATA_DIR / "maternal_health_risk.csv"
    if path:
        local = Path(path)
    if local.exists():
        df = pd.read_csv(local)
        _ok(f"Loaded from local file: {local.name} ({len(df)} rows)")
    else:
        # 2. Try downloading from GitHub mirror
        _info("Downloading from GitHub…")
        try:
            r = requests.get(UCI_URL, timeout=10)
            r.raise_for_status()
            df = pd.read_csv(io.StringIO(r.text))
            df.to_csv(local, index=False)
            _ok(f"Downloaded and cached ({len(df)} rows)")
        except Exception as e:
            _warn(f"Download failed ({e}). Using embedded fallback.")
            df = _uci_fallback()

    # Standardise columns
    df.columns = [c.strip() for c in df.columns]
    col_map = {
        "Age": "Age", "SystolicBP": "SystolicBP",
        "DiastolicBP": "DiastolicBP", "BS": "BS",
        "BodyTemp": "BodyTemp", "HeartRate": "HeartRate",
        "RiskLevel": TARGET_COL,
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
    df[TARGET_COL] = _encode_label(df[TARGET_COL])
    df["source"] = "bangladesh_iot"
    df = _validate(df, "UCI")
    _print_dist(df, "UCI")
    return df[FEATURE_COLS + [TARGET_COL, "source"]]


def _uci_fallback() -> pd.DataFrame:
    """Minimal embedded UCI-like data so pipeline never fails."""
    rng = np.random.default_rng(42)
    n   = 300
    rows = []
    for _ in range(n):
        risk = rng.choice([0, 1, 2], p=[0.40, 0.33, 0.27])
        if risk == 0:
            rows.append([rng.integers(18, 35), rng.integers(90, 120),
                         rng.integers(60, 80), round(rng.uniform(6.0, 7.5), 1),
                         round(rng.uniform(97.0, 99.0), 1), rng.integers(60, 85), "low risk"])
        elif risk == 1:
            rows.append([rng.integers(25, 40), rng.integers(115, 140),
                         rng.integers(75, 90), round(rng.uniform(7.5, 11.0), 1),
                         round(rng.uniform(98.0, 100.0), 1), rng.integers(70, 90), "mid risk"])
        else:
            rows.append([rng.integers(30, 49), rng.integers(135, 165),
                         rng.integers(85, 105), round(rng.uniform(10.0, 18.0), 1),
                         round(rng.uniform(98.5, 103.0), 1), rng.integers(75, 100), "high risk"])
    return pd.DataFrame(rows, columns=FEATURE_COLS + [TARGET_COL])


# ─────────────────────────────────────────────────────────────────
# DATASET 2 — High-Risk Pregnancy Dataset (Kaggle SE Asia)
# ─────────────────────────────────────────────────────────────────
def load_high_risk(path: str | None = None, allow_synthetic: bool = False) -> pd.DataFrame | None:
    """
    Load the Kaggle High-Risk Pregnancy dataset.
    Place file at train/data/high_risk_pregnancy.csv
    """
    _banner("Dataset 2 — High-Risk Pregnancy (Kaggle SE Asia)")
    local = DATA_DIR / "high_risk_pregnancy.csv"
    if path:
        local = Path(path)
    if not local.exists():
        if allow_synthetic:
            _warn("File not found. Generating synthetic supplement instead.")
            return _high_risk_synthetic()
        _info("File not found (optional). To use real external data: place CSV at train/data/high_risk_pregnancy.csv")
        return None

    df = pd.read_csv(local)
    _ok(f"Loaded {len(df)} rows from {local.name}")

    # Flexible column mapping for common naming variations
    rename = {}
    for col in df.columns:
        cl = col.lower().strip()
        if "systolic" in cl or cl in ("sbp", "systolicbp"):
            rename[col] = "SystolicBP"
        elif "diastolic" in cl or cl in ("dbp", "diastolicbp"):
            rename[col] = "DiastolicBP"
        elif cl in ("bs", "blood_sugar", "blood sugar", "bloodsugar", "glucose"):
            rename[col] = "BS"
        elif "temp" in cl:
            rename[col] = "BodyTemp"
        elif "heart" in cl or cl in ("hr", "heartrate", "heart_rate"):
            rename[col] = "HeartRate"
        elif cl == "age":
            rename[col] = "Age"
        elif "risk" in cl or "label" in cl or "class" in cl:
            rename[col] = TARGET_COL

    df = df.rename(columns=rename)

    # Unit conversions
    if "BS" in df.columns and df["BS"].median() > 30:
        _info("BS appears to be in mg/dL — converting to mmol/L (/18.0182)")
        df["BS"] = df["BS"] / 18.0182

    if "BodyTemp" in df.columns and df["BodyTemp"].median() < 42:
        _info("BodyTemp appears to be in °C — converting to °F")
        df["BodyTemp"] = df["BodyTemp"] * 9 / 5 + 32

    df[TARGET_COL] = _encode_label(df[TARGET_COL])
    df["source"] = "high_risk_kaggle"
    df = _validate(df, "HighRisk")
    _print_dist(df, "High-Risk Kaggle")
    return df[FEATURE_COLS + [TARGET_COL, "source"]]


def _high_risk_synthetic(n: int = 1500) -> pd.DataFrame:
    """
    Realistic synthetic data modelled on high-risk pregnancy distributions.
    More High-risk skew than UCI — reflects the dataset's bias.
    """
    _info("Generating synthetic high-risk supplement (n=1500)…")
    rng = np.random.default_rng(123)
    rows = []
    for _ in range(n):
        risk = rng.choice([0, 1, 2], p=[0.28, 0.32, 0.40])  # more high-risk
        if risk == 0:
            rows.append([rng.integers(18, 32), rng.integers(88, 118),
                         rng.integers(58, 78), round(rng.uniform(5.8, 7.2), 1),
                         round(rng.uniform(97.0, 98.8), 1), rng.integers(58, 82)])
        elif risk == 1:
            rows.append([rng.integers(26, 42), rng.integers(118, 142),
                         rng.integers(76, 92), round(rng.uniform(7.8, 12.0), 1),
                         round(rng.uniform(98.2, 100.5), 1), rng.integers(72, 92)])
        else:
            rows.append([rng.integers(28, 49), rng.integers(138, 175),
                         rng.integers(86, 108), round(rng.uniform(11.5, 19.0), 1),
                         round(rng.uniform(98.8, 104.0), 1), rng.integers(78, 105)])
    df = pd.DataFrame(rows, columns=FEATURE_COLS)
    df[TARGET_COL] = [r for r in rng.choice([0,1,2], n, p=[0.28,0.32,0.40])]
    df["source"]   = "synthetic_high_risk"
    _ok(f"Generated {n} synthetic high-risk samples")
    _print_dist(df, "Synthetic High-Risk")
    return df[FEATURE_COLS + [TARGET_COL, "source"]]


# ─────────────────────────────────────────────────────────────────
# DATASET 3 — Pima Indians Diabetes (US Population)
# ─────────────────────────────────────────────────────────────────
PIMA_URL = (
    "https://raw.githubusercontent.com/jbrownlee/Datasets/"
    "master/pima-indians-diabetes.data.csv"
)
PIMA_COLS = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness",
             "Insulin", "BMI", "DiabetesPedigree", "Age", "Outcome"]

def load_pima(path: str | None = None) -> pd.DataFrame | None:
    """
    Load Pima Indians Diabetes dataset.
    Maps to our feature set: Glucose→BS, BloodPressure→DiastolicBP,
    Outcome 1→high, 0→low (no mid class from this dataset).
    """
    _banner("Dataset 3 — Pima Indians Diabetes (USA)")
    local = DATA_DIR / "pima_diabetes.csv"
    if path:
        local = Path(path)

    if local.exists():
        df = pd.read_csv(local)
    else:
        _info("Downloading Pima Indians dataset…")
        try:
            r = requests.get(PIMA_URL, timeout=10)
            r.raise_for_status()
            df = pd.read_csv(io.StringIO(r.text), header=None, names=PIMA_COLS)
            df.to_csv(local, index=False)
            _ok(f"Downloaded and cached ({len(df)} rows)")
        except Exception as e:
            _warn(f"Could not load Pima dataset ({e}). Skipping.")
            return None

    # Feature mapping
    out = pd.DataFrame()
    out["Age"]         = df["Age"].clip(10, 60)
    # Pima only has diastolic BP — estimate systolic as DBP + 40 (rough approximation)
    out["DiastolicBP"] = df["BloodPressure"].replace(0, np.nan)
    out["SystolicBP"]  = out["DiastolicBP"] + rng_val(35, 45, len(df))
    # Glucose in mg/dL → mmol/L
    out["BS"]          = (df["Glucose"].replace(0, np.nan) / 18.0182).round(2)
    # No body temp in Pima — fill with population median
    out["BodyTemp"]    = 98.4
    out["HeartRate"]   = rng_val(62, 82, len(df))  # imputed from known ranges

    # Label: diabetic=high, non-diabetic=low  (no mid class)
    out[TARGET_COL] = df["Outcome"].map({1: 2, 0: 0})
    out["source"]   = "pima_usa"

    _warn("Pima: SystolicBP and HeartRate are estimated (not directly measured)")
    _warn("Pima: No Mid-risk labels — only Low and High class available")
    out = _validate(out.dropna(), "Pima")
    _ok(f"Pima Indians: {len(out)} usable rows")
    _print_dist(out, "Pima Indians")
    return out[FEATURE_COLS + [TARGET_COL, "source"]]


def rng_val(lo, hi, n):
    return np.random.randint(lo, hi, n)


# ─────────────────────────────────────────────────────────────────
# DATASET 4 — Gestational Diabetes Extended (Kaggle)
# ─────────────────────────────────────────────────────────────────
def load_gestational_diabetes(path: str | None = None) -> pd.DataFrame | None:
    """
    Optional extended gestational diabetes dataset.
    Place at train/data/gestational_diabetes.csv
    Expected columns vary — handled by flexible column mapper.
    """
    _banner("Dataset 4 — Gestational Diabetes Extended (Kaggle)")
    local = DATA_DIR / "gestational_diabetes.csv"
    if path:
        local = Path(path)
    if not local.exists():
        _info("Not found — skipping (optional dataset)")
        _info("Download from Kaggle and save as train/data/gestational_diabetes.csv")
        return None

    df = pd.read_csv(local)
    _ok(f"Loaded {len(df)} rows")

    # Try auto-detect columns
    rename = {}
    for col in df.columns:
        cl = col.lower().replace(" ", "_").replace("-", "_")
        if "glucose" in cl or "blood_sugar" in cl or cl == "bs":
            rename[col] = "BS"
        elif "systolic" in cl or cl == "sbp":
            rename[col] = "SystolicBP"
        elif "diastolic" in cl or cl == "dbp":
            rename[col] = "DiastolicBP"
        elif "temp" in cl:
            rename[col] = "BodyTemp"
        elif "heart" in cl or cl == "hr":
            rename[col] = "HeartRate"
        elif cl == "age":
            rename[col] = "Age"
        elif any(x in cl for x in ["risk", "label", "class", "outcome", "result"]):
            rename[col] = TARGET_COL

    df = df.rename(columns=rename)

    if "BS" in df.columns and df["BS"].median() > 30:
        df["BS"] = df["BS"] / 18.0182

    if TARGET_COL not in df.columns:
        _warn("Could not find a label column. Skipping this dataset.")
        return None

    df[TARGET_COL] = _encode_label(df[TARGET_COL])
    df["source"]   = "gestational_diabetes_ext"
    df = _validate(df.dropna(subset=FEATURE_COLS), "GestationalDM")
    _print_dist(df, "Gestational Diabetes")
    return df[FEATURE_COLS + [TARGET_COL, "source"]]


# ─────────────────────────────────────────────────────────────────
# DISTRIBUTION PRINTER
# ─────────────────────────────────────────────────────────────────
def _print_dist(df: pd.DataFrame, name: str):
    counts = df[TARGET_COL].value_counts().sort_index()
    total  = len(df)
    labels = {0: "Low", 1: "Mid", 2: "High"}
    parts  = [f"{labels.get(k,'?')}: {v} ({v/total*100:.1f}%)" for k, v in counts.items()]
    _ok(f"{name} → {total} rows | {' · '.join(parts)}")


# ─────────────────────────────────────────────────────────────────
# MAIN MERGE FUNCTION
# ─────────────────────────────────────────────────────────────────
def load_and_merge(
    uci_path: str | None        = None,
    high_risk_path: str | None  = None,
    pima_path: str | None       = None,
    gestational_path: str | None= None,
    use_pima: bool              = False,
    use_gestational: bool       = False,
    allow_synthetic: bool       = False,
) -> tuple[pd.DataFrame, dict]:
    """
    Load all datasets, merge, and return a clean unified DataFrame.
    """
    print(f"\n{Fore.MAGENTA}{'═'*60}")
    print(f"  🏥  MaternAI — Multi-Dataset Loader")
    print(f"{'═'*60}{Style.RESET_ALL}")

    frames  = []
    sources = {}

    # ── Dataset 1: UCI (required) ──────────────────────────────
    uci = load_uci(uci_path)
    frames.append(uci)
    sources["UCI (Bangladesh)"] = len(uci)

    # ── Dataset 2: High-Risk Kaggle ─────────────────────────────
    hr = load_high_risk(high_risk_path, allow_synthetic=allow_synthetic)
    if hr is not None:
        frames.append(hr)
        sources["High-Risk Kaggle"] = len(hr)

    # ── Dataset 3: Pima Indians (optional) ──────────────────────
    if use_pima:
        pima = load_pima(pima_path)
        if pima is not None:
            frames.append(pima)
            sources["Pima Indians (USA)"] = len(pima)

    # ── Dataset 4: Gestational Diabetes (optional) ──────────────
    if use_gestational:
        gd = load_gestational_diabetes(gestational_path)
        if gd is not None:
            frames.append(gd)
            sources["Gestational Diabetes"] = len(gd)

    # ── Merge ────────────────────────────────────────────────────
    merged = pd.concat(frames, ignore_index=True)

    # Final clean-up
    merged = merged.dropna(subset=FEATURE_COLS)
    merged[FEATURE_COLS] = merged[FEATURE_COLS].apply(pd.to_numeric, errors="coerce")
    merged = merged.dropna(subset=FEATURE_COLS)
    merged[TARGET_COL] = merged[TARGET_COL].astype(int)

    # ── Summary ──────────────────────────────────────────────────
    _banner("Merged Dataset Summary")
    total = len(merged)
    for src, n in sources.items():
        _ok(f"{src}: {n} samples ({n/total*100:.1f}%)")
    print()
    _print_dist(merged, "FINAL MERGED")

    meta = {
        "n_samples":  total,
        "n_features": len(FEATURE_COLS),
        "sources":    sources,
        "class_dist": merged[TARGET_COL].value_counts().sort_index().to_dict(),
    }

    return merged, meta
