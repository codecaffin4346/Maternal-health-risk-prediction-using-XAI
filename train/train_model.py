"""
train_model.py — MaternAI Multi-Dataset Training Pipeline
==========================================================
Full end-to-end pipeline:
  1. Load & merge multiple datasets
  2. Preprocess & validate
  3. Train RandomForest with stratified K-Fold + SMOTE
  4. Evaluate: accuracy, F1, AUC-ROC, confusion matrix, SHAP
  5. Export trained trees → model.js (browser-side inference)
  6. Save all plots to train/output/

Usage:
  python train_model.py                         # auto-downloads UCI + Pima
  python train_model.py --no-pima               # UCI + synthetic only
  python train_model.py --uci path/to/file.csv  # custom UCI path
  python train_model.py --skip-export           # train only, don't patch model.js

Requirements:
  pip install -r requirements.txt
"""

import argparse
import json
import warnings
import sys
from pathlib import Path

# Fix Windows console UTF-8 output
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")   # headless rendering
import matplotlib.pyplot as plt
import seaborn as sns
from colorama import Fore, Style, init

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report,
    ConfusionMatrixDisplay,
)
from sklearn.preprocessing import label_binarize
from imblearn.over_sampling import SMOTE

import shap

from data_loader import load_and_merge, FEATURE_COLS, TARGET_COL
from export_js import patch_model_js, print_tree_summary

init(autoreset=True)
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────────────────────────
# OUTPUT DIRECTORY
# ─────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

CLASSES     = ["Low Risk", "Mid Risk", "High Risk"]
CLASS_COLORS= ["#22c55e", "#f59e0b", "#ef4444"]

def _banner(msg):
    print(f"\n{Fore.MAGENTA}{'═'*60}")
    print(f"  {msg}")
    print(f"{'═'*60}{Style.RESET_ALL}")

def _ok(msg):   print(f"  {Fore.GREEN}✓{Style.RESET_ALL} {msg}")
def _info(msg): print(f"  {Fore.BLUE}→{Style.RESET_ALL} {msg}")
def _warn(msg): print(f"  {Fore.YELLOW}⚠{Style.RESET_ALL} {msg}")


# ─────────────────────────────────────────────────────────────────
# 1. TRAIN WITH STRATIFIED K-FOLD + SMOTE
# ─────────────────────────────────────────────────────────────────
def train_with_cv(
    X: np.ndarray,
    y: np.ndarray,
    n_splits: int = 5,
    n_estimators: int = 100,
    max_depth: int = 8,
    random_state: int = 42,
) -> tuple[RandomForestClassifier, dict]:
    """
    Train RandomForest using stratified K-Fold cross-validation.
    SMOTE is applied INSIDE each training fold only (prevents data leakage).

    Returns:
        final_model : RF trained on full dataset (for export)
        cv_metrics  : dict of averaged CV metrics
    """
    _banner("Training — Stratified K-Fold CV + SMOTE")

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    sm  = SMOTE(k_neighbors=5, random_state=random_state)

    fold_acc, fold_f1, fold_auc = [], [], []
    all_y_true, all_y_pred, all_y_prob = [], [], []

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y), 1):
        X_tr, X_val = X[train_idx], X[val_idx]
        y_tr, y_val = y[train_idx], y[val_idx]

        # SMOTE only on training fold
        X_res, y_res = sm.fit_resample(X_tr, y_tr)

        rf = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            min_samples_leaf=3,
            class_weight="balanced",
            random_state=random_state,
            n_jobs=-1,
        )
        rf.fit(X_res, y_res)

        y_pred = rf.predict(X_val)
        y_prob = rf.predict_proba(X_val)

        acc = accuracy_score(y_val, y_pred)
        f1  = f1_score(y_val, y_pred, average="macro", zero_division=0)

        # AUC-ROC (one-vs-rest)
        y_bin = label_binarize(y_val, classes=[0, 1, 2])
        try:
            auc = roc_auc_score(y_bin, y_prob, multi_class="ovr", average="macro")
        except ValueError:
            auc = 0.0

        fold_acc.append(acc)
        fold_f1.append(f1)
        fold_auc.append(auc)
        all_y_true.extend(y_val.tolist())
        all_y_pred.extend(y_pred.tolist())
        all_y_prob.extend(y_prob.tolist())

        _ok(f"Fold {fold}/{n_splits} — Acc: {acc:.4f}  F1: {f1:.4f}  AUC: {auc:.4f}")

    # ── Aggregate metrics ────────────────────────────────────────
    all_y_true = np.array(all_y_true)
    all_y_pred = np.array(all_y_pred)
    all_y_prob = np.array(all_y_prob)

    overall_acc = accuracy_score(all_y_true, all_y_pred)
    overall_f1  = f1_score(all_y_true, all_y_pred, average="macro", zero_division=0)
    y_bin_all   = label_binarize(all_y_true, classes=[0, 1, 2])
    try:
        overall_auc = roc_auc_score(y_bin_all, all_y_prob, multi_class="ovr", average="macro")
    except ValueError:
        overall_auc = 0.0

    cm   = confusion_matrix(all_y_true, all_y_pred, labels=[0, 1, 2])
    rpt  = classification_report(all_y_true, all_y_pred,
                                 target_names=CLASSES, output_dict=True, zero_division=0)

    _banner("Cross-Validation Results")
    _ok(f"Accuracy:  {overall_acc:.4f}  (±{np.std(fold_acc):.4f})")
    _ok(f"Macro F1:  {overall_f1:.4f}  (±{np.std(fold_f1):.4f})")
    _ok(f"AUC-ROC:   {overall_auc:.4f}  (±{np.std(fold_auc):.4f})")
    print()
    print("  " + classification_report(
        all_y_true, all_y_pred,
        target_names=CLASSES, zero_division=0
    ).replace("\n", "\n  "))

    cv_metrics = {
        "accuracy":    round(overall_acc, 4),
        "macro_f1":    round(overall_f1, 4),
        "auc_roc":     round(overall_auc, 4),
        "cv_folds":    n_splits,
        "per_class": {
            "low":  {k: round(rpt["Low Risk"][k], 4)  for k in ("precision","recall","f1-score")},
            "mid":  {k: round(rpt["Mid Risk"][k], 4)  for k in ("precision","recall","f1-score")},
            "high": {k: round(rpt["High Risk"][k], 4) for k in ("precision","recall","f1-score")},
        },
        "confusion_matrix": cm.tolist(),
    }
    # Rename f1-score → f1
    for cls in cv_metrics["per_class"].values():
        cls["f1"] = cls.pop("f1-score")

    # ── Final model on full dataset ──────────────────────────────
    _banner("Training Final Model on Full Dataset")
    X_final, y_final = sm.fit_resample(X, y)
    final_rf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=random_state,
        n_jobs=-1,
    )
    final_rf.fit(X_final, y_final)
    _ok(f"Final model trained on {len(X_final)} samples (post-SMOTE)")

    cv_metrics["feature_importance"] = final_rf.feature_importances_.round(4).tolist()

    return final_rf, cv_metrics


# ─────────────────────────────────────────────────────────────────
# 2. PLOTS
# ─────────────────────────────────────────────────────────────────
def plot_confusion_matrix(cm: list[list[int]]):
    fig, ax = plt.subplots(figsize=(6, 5))
    cm_arr = np.array(cm)
    sns.heatmap(
        cm_arr, annot=True, fmt="d", cmap="RdYlGn",
        xticklabels=CLASSES, yticklabels=CLASSES,
        linewidths=0.5, ax=ax, cbar=False,
    )
    ax.set_xlabel("Predicted", fontsize=11)
    ax.set_ylabel("Actual",    fontsize=11)
    ax.set_title("Confusion Matrix (5-Fold CV)", fontsize=13, fontweight="bold")
    plt.tight_layout()
    out = OUTPUT_DIR / "confusion_matrix.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    _ok(f"Saved → {out.name}")


def plot_feature_importance(rf: RandomForestClassifier):
    fi   = rf.feature_importances_
    idx  = np.argsort(fi)[::-1]
    fig, ax = plt.subplots(figsize=(8, 4))
    bars = ax.bar(
        [FEATURE_COLS[i] for i in idx],
        [fi[i] for i in idx],
        color=["#8b5cf6","#6366f1","#3b82f6","#06b6d4","#10b981","#f59e0b"],
        edgecolor="none",
    )
    ax.set_title("Feature Importance (Mean Decrease in Impurity)", fontsize=13, fontweight="bold")
    ax.set_ylabel("Importance")
    ax.set_xlabel("Feature")
    for bar in bars:
        ax.text(bar.get_x() + bar.get_width()/2,
                bar.get_height() + 0.002,
                f"{bar.get_height():.3f}",
                ha="center", va="bottom", fontsize=9)
    plt.tight_layout()
    out = OUTPUT_DIR / "feature_importance.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    _ok(f"Saved → {out.name}")


def plot_class_distribution(df: pd.DataFrame):
    counts = df[TARGET_COL].value_counts().sort_index()
    labels = ["Low Risk", "Mid Risk", "High Risk"]
    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(labels, [counts.get(i, 0) for i in range(3)],
                  color=CLASS_COLORS, edgecolor="none")
    ax.set_title("Class Distribution (Merged Dataset)", fontsize=13, fontweight="bold")
    ax.set_ylabel("Sample Count")
    for bar in bars:
        ax.text(bar.get_x() + bar.get_width()/2,
                bar.get_height() + 5,
                str(int(bar.get_height())),
                ha="center", fontsize=10)
    plt.tight_layout()
    out = OUTPUT_DIR / "class_distribution.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    _ok(f"Saved → {out.name}")


def plot_shap(rf: RandomForestClassifier, X: np.ndarray, sample_size: int = 300):
    """
    Compute SHAP values and save summary plot + beeswarm.
    Uses a subsample for speed (SHAP can be slow on large datasets).
    """
    _info("Computing SHAP values (this may take ~1 minute)…")
    idx     = np.random.choice(len(X), min(sample_size, len(X)), replace=False)
    X_samp  = X[idx]

    explainer = shap.TreeExplainer(rf)
    shap_vals = explainer.shap_values(X_samp)

    # In modern SHAP versions, shap_values can be:
    # 1. 3D array: (n_samples, n_features, n_classes)
    # 2. list of 2D arrays: [ (n_samples, n_features), ... ]
    if isinstance(shap_vals, np.ndarray) and shap_vals.ndim == 3:
        # shape: (n_samples, n_features, n_classes)
        shap_abs = np.abs(shap_vals).mean(axis=(0, 2))
        shap_high = shap_vals[:, :, 2]
    elif isinstance(shap_vals, list):
        shap_abs = np.abs(np.array(shap_vals)).mean(axis=(0, 1))
        shap_high = shap_vals[2]
    else:
        shap_abs = np.abs(shap_vals).mean(axis=0)
        shap_high = shap_vals

    # ── Bar summary (mean |SHAP| per feature, averaged across classes) ──
    fig, ax = plt.subplots(figsize=(8, 4))
    idx_sort = np.argsort(shap_abs)[::-1]
    ax.barh(
        [FEATURE_COLS[i] for i in idx_sort],
        [shap_abs[i] for i in idx_sort],
        color="#8b5cf6",
    )
    ax.set_xlabel("Mean |SHAP Value|")
    ax.set_title("Global SHAP Feature Importance", fontsize=13, fontweight="bold")
    ax.invert_yaxis()
    plt.tight_layout()
    out = OUTPUT_DIR / "shap_importance.png"
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    _ok(f"Saved → {out.name}")

    # ── Beeswarm for High Risk class ────────────────────────────
    try:
        fig = plt.figure(figsize=(10, 5))
        shap.summary_plot(
            shap_high, X_samp,
            feature_names=FEATURE_COLS,
            plot_type="dot",
            show=False,
            color_bar=True,
        )
        plt.title("SHAP Beeswarm — High Risk Class", fontsize=12, fontweight="bold")
        plt.tight_layout()
        out2 = OUTPUT_DIR / "shap_beeswarm_high_risk.png"
        plt.savefig(out2, dpi=150, bbox_inches="tight")
        plt.close()
        _ok(f"Saved → {out2.name}")
    except Exception as e:
        _warn(f"SHAP beeswarm plot skipped: {e}")

    # Return mean SHAP importances for logging
    return shap_abs.round(4).tolist()


# ─────────────────────────────────────────────────────────────────
# 3. SAVE METRICS JSON
# ─────────────────────────────────────────────────────────────────
def save_metrics(metrics: dict, meta: dict):
    out = OUTPUT_DIR / "metrics.json"
    payload = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "metrics":      metrics,
        "dataset_meta": meta,
    }
    out.write_text(json.dumps(payload, indent=2))
    _ok(f"Metrics saved → {out.name}")


# ─────────────────────────────────────────────────────────────────
# 4. MAIN PIPELINE
# ─────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="MaternAI Training Pipeline")
    parser.add_argument("--uci",          type=str,  default=None,  help="Path to UCI CSV")
    parser.add_argument("--high-risk",    type=str,  default=None,  help="Path to High-Risk Kaggle CSV")
    parser.add_argument("--pima",         type=str,  default=None,  help="Path to Pima Indians CSV")
    parser.add_argument("--gestational",  type=str,  default=None,  help="Path to Gestational Diabetes CSV")
    parser.add_argument("--use-pima",     action="store_true",       help="Include Pima Indians dataset")
    parser.add_argument("--use-gestational", action="store_true",    help="Include Gestational Diabetes dataset")
    parser.add_argument("--allow-synthetic", action="store_true",    help="Allow synthetic augmentation when high-risk CSV is missing")
    parser.add_argument("--skip-export",  action="store_true",       help="Don't update model.js")
    parser.add_argument("--skip-shap",    action="store_true",       help="Skip SHAP computation (faster)")
    parser.add_argument("--n-estimators", type=int,  default=100,   help="RF trees for training (default 100)")
    parser.add_argument("--max-depth",    type=int,  default=8,     help="RF max depth (default 8)")
    parser.add_argument("--export-depth", type=int,  default=4,     help="Max depth to export to JS (default 4)")
    parser.add_argument("--export-trees", type=int,  default=10,    help="Number of trees to export to JS (default 10)")
    parser.add_argument("--cv-folds",     type=int,  default=5,     help="K-fold count (default 5)")
    parser.add_argument("--seed",         type=int,  default=42,    help="Random seed")
    args = parser.parse_args()

    print(f"""
{Fore.MAGENTA}+==========================================================+
|   MaternAI -- Multi-Dataset Training Pipeline v1.0       |
|   Maternal Health Risk Prediction with Explainable AI    |
+==========================================================+{Style.RESET_ALL}
""")

    # ── Step 1: Load & merge datasets ───────────────────────────
    df, meta = load_and_merge(
        uci_path         = args.uci,
        high_risk_path   = args.high_risk,
        pima_path        = args.pima,
        gestational_path = args.gestational,
        use_pima         = args.use_pima,
        use_gestational  = args.use_gestational,
        allow_synthetic  = args.allow_synthetic,
    )

    X = df[FEATURE_COLS].values.astype(np.float32)
    y = df[TARGET_COL].values.astype(int)

    # ── Step 2: Class distribution plot ─────────────────────────
    _banner("Generating Plots")
    plot_class_distribution(df)

    # ── Step 3: Train with CV + SMOTE ───────────────────────────
    rf, metrics = train_with_cv(
        X, y,
        n_splits     = args.cv_folds,
        n_estimators = args.n_estimators,
        max_depth    = args.max_depth,
        random_state = args.seed,
    )

    # ── Step 4: Plots ────────────────────────────────────────────
    _banner("Generating Evaluation Plots")
    plot_confusion_matrix(metrics["confusion_matrix"])
    plot_feature_importance(rf)

    # ── Step 5: SHAP ─────────────────────────────────────────────
    if not args.skip_shap:
        _banner("SHAP Explainability Analysis")
        shap_imp = plot_shap(rf, X)
        metrics["shap_importance"] = shap_imp
        _ok("SHAP importance: " + ", ".join(
            f"{FEATURE_COLS[i]}={v:.4f}" for i, v in enumerate(shap_imp)
        ))
    else:
        _warn("SHAP skipped (--skip-shap flag)")

    # ── Step 6: Save metrics JSON ────────────────────────────────
    _banner("Saving Metrics")
    save_metrics(metrics, meta)

    # ── Step 7: Print tree sample ────────────────────────────────
    _banner("Sample Tree Structure (Tree 1, depth ≤ 3)")
    print_tree_summary(rf, n=1)

    # ── Step 8: Export to model.js ───────────────────────────────
    if not args.skip_export:
        _banner("Exporting to model.js")
        try:
            patch_model_js(
                rf         = rf,
                metrics    = metrics,
                meta       = meta,
                max_depth  = args.export_depth,
                n_trees    = args.export_trees,
            )
        except FileNotFoundError as e:
            _warn(f"Could not update model.js: {e}")
            _warn("Run from inside the repo root, or use --skip-export")
    else:
        _warn("model.js export skipped (--skip-export flag)")

    # ── Final summary ────────────────────────────────────────────
    _banner("✅  Pipeline Complete!")
    print(f"""
  {Fore.GREEN}Results:{Style.RESET_ALL}
    Accuracy  : {Fore.GREEN}{metrics['accuracy']*100:.2f}%{Style.RESET_ALL}
    Macro F1  : {Fore.GREEN}{metrics['macro_f1']*100:.2f}%{Style.RESET_ALL}
    AUC-ROC   : {Fore.GREEN}{metrics['auc_roc']*100:.2f}%{Style.RESET_ALL}
    Samples   : {meta['n_samples']} (from {len(meta['sources'])} source(s))

  {Fore.CYAN}Output files:{Style.RESET_ALL}
    train/output/confusion_matrix.png
    train/output/feature_importance.png
    train/output/shap_importance.png
    train/output/shap_beeswarm_high_risk.png
    train/output/metrics.json
    {'js/model.js  ← UPDATED' if not args.skip_export else 'model.js not updated (--skip-export)'}

  {Fore.YELLOW}Next steps:{Style.RESET_ALL}
    1. Review output plots in train/output/
    2. Check js/model.js was updated correctly
    3. Open http://localhost:8080 and test predictions
    4. git add -A && git commit -m "retrain: multi-dataset model"
    5. git push origin main  → GitHub Pages auto-deploys
""")


if __name__ == "__main__":
    main()
