"""
export_js.py — Export sklearn RandomForest → model.js
======================================================
Converts a trained sklearn RandomForestClassifier into the
JavaScript tree format used by the MaternAI browser-side inference engine.

Also updates DATASET_STATS in model.js with live accuracy metrics.
"""

import re
import json
import textwrap
import numpy as np
from pathlib import Path
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier

# ─────────────────────────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────────────────────────
REPO_ROOT  = Path(__file__).parent.parent
MODEL_JS   = REPO_ROOT / "js" / "model.js"
BACKUP_DIR = REPO_ROOT / "js" / "backups"

FEATURE_NAMES = ["Age", "Systolic BP", "Diastolic BP", "Blood Sugar", "Body Temp", "Heart Rate"]
FEATURE_UNITS = ["yrs", "mmHg", "mmHg", "mmol/L", "°F", "bpm"]

# ─────────────────────────────────────────────────────────────────
# SKLEARN TREE → JS OBJECT
# ─────────────────────────────────────────────────────────────────
def _node_expected_value(tree_, node_id: int) -> float:
    """
    Compute the expected risk score at a node:
      v = 0*P(low) + 1*P(mid) + 2*P(high)
    based on the sample counts at that node.
    """
    counts = tree_.value[node_id][0]
    total  = counts.sum()
    if total == 0:
        return 1.0  # fallback baseline
    probs = counts / total
    return float(probs[1] + 2.0 * probs[2])


def _export_node(tree_, node_id: int, max_depth: int | None, depth: int = 0) -> dict:
    """
    Recursively convert an sklearn tree node to our JS schema:
      Internal: { f, t, v, L, R }
      Leaf:     { leaf:true, v, p:[p_low, p_mid, p_high] }
    """
    is_leaf = (
        tree_.feature[node_id] == -2   # sklearn marks leaves with -2
        or (max_depth is not None and depth >= max_depth)
    )

    counts = tree_.value[node_id][0]
    total  = counts.sum()
    probs  = (counts / total).tolist() if total > 0 else [1/3, 1/3, 1/3]
    # Ensure exactly 3 classes (in case some splits create single-class leaves)
    while len(probs) < 3:
        probs.append(0.0)
    probs  = [float(p) for p in probs[:3]]
    v_node = round(probs[1] + 2.0 * probs[2], 4)

    if is_leaf:
        return {"leaf": True, "v": v_node, "p": probs}

    left_id  = int(tree_.children_left[node_id])
    right_id = int(tree_.children_right[node_id])
    feat_idx = int(tree_.feature[node_id])
    threshold = float(tree_.threshold[node_id])

    return {
        "f": feat_idx,
        "t": threshold,
        "v": v_node,
        "L": _export_node(tree_, left_id,  max_depth, depth + 1),
        "R": _export_node(tree_, right_id, max_depth, depth + 1),
    }


def rf_to_js_trees(rf: RandomForestClassifier, max_depth: int | None = None) -> list[dict]:
    """
    Export all trees from a trained RandomForestClassifier.
    Returns a list of tree dicts in the MaternAI JS format.
    """
    trees = []
    for estimator in rf.estimators_:
        tree_ = estimator.tree_
        node  = _export_node(tree_, 0, max_depth)
        trees.append(node)
    return trees


# ─────────────────────────────────────────────────────────────────
# SERIALISE TREES TO JS STRING (compact, no JSON.stringify overhead)
# ─────────────────────────────────────────────────────────────────
def _node_to_js(node: dict, indent: int = 0) -> str:
    """Recursively render a node dict as a JS object literal."""
    pad  = "  " * indent
    pad2 = "  " * (indent + 1)

    if node.get("leaf"):
        p = node["p"]
        return f"{{leaf:true,v:{node['v']},p:[{p[0]},{p[1]},{p[2]}]}}"

    L_str = _node_to_js(node["L"], indent + 1)
    R_str = _node_to_js(node["R"], indent + 1)

    return (
        f"{{\n"
        f"{pad2}f:{node['f']},t:{node['t']},v:{node['v']},\n"
        f"{pad2}L:{L_str},\n"
        f"{pad2}R:{R_str}}}"
    )


def trees_to_js_array(trees: list[dict]) -> str:
    """Render the TREES array as a JS const string."""
    parts = []
    for i, tree in enumerate(trees):
        comment = f"  // ── Tree {i+1} ──────────────────────────────────────────"
        body    = _node_to_js(tree, indent=1)
        parts.append(f"{comment}\n  {body}")
    inner = ",\n\n".join(parts)
    return f"const TREES = [\n\n{inner}\n\n];"


# ─────────────────────────────────────────────────────────────────
# BUILD UPDATED DATASET_STATS BLOCK
# ─────────────────────────────────────────────────────────────────
def build_stats_block(metrics: dict, meta: dict) -> str:
    """
    Generate the DATASET_STATS JS export block from live training metrics.
    """
    cd = meta.get("class_dist", {0: 0, 1: 0, 2: 0})
    cm = metrics.get("confusion_matrix", [[0,0,0],[0,0,0],[0,0,0]])
    fi = metrics.get("feature_importance", [0]*6)

    pc = metrics.get("per_class", {
        "low":  {"precision": 0, "recall": 0, "f1": 0},
        "mid":  {"precision": 0, "recall": 0, "f1": 0},
        "high": {"precision": 0, "recall": 0, "f1": 0},
    })

    def fmt(v): return round(float(v), 4)

    sources_comment = ", ".join(
        f"{k} ({v})" for k, v in meta.get("sources", {}).items()
    )

    block = f"""export const DATASET_STATS = {{
  // Auto-generated by export_js.py on {datetime.now().strftime('%Y-%m-%d %H:%M')}
  // Sources: {sources_comment}
  accuracy:   {fmt(metrics.get('accuracy', 0))},
  macro_f1:   {fmt(metrics.get('macro_f1', 0))},
  auc_roc:    {fmt(metrics.get('auc_roc', 0))},
  cv_folds:   {metrics.get('cv_folds', 5)},
  split_strategy: {json.dumps(metrics.get('split_strategy', 'unspecified'))},
  tree_count: {meta.get('tree_count', 0)},
  n_samples:  {meta.get('n_samples', 0)},
  n_features: {meta.get('n_features', 6)},
  n_classes:  3,
  class_dist: {{ low: {cd.get(0,0)}, mid: {cd.get(1,0)}, high: {cd.get(2,0)} }},
  per_class: {{
    low:  {{ precision: {fmt(pc['low']['precision'])},  recall: {fmt(pc['low']['recall'])},  f1: {fmt(pc['low']['f1'])}  }},
    mid:  {{ precision: {fmt(pc['mid']['precision'])},  recall: {fmt(pc['mid']['recall'])},  f1: {fmt(pc['mid']['f1'])}  }},
    high: {{ precision: {fmt(pc['high']['precision'])}, recall: {fmt(pc['high']['recall'])}, f1: {fmt(pc['high']['f1'])} }},
  }},
  feature_importance: {json.dumps([fmt(x) for x in fi])},
  confusion: {json.dumps([[int(c) for c in row] for row in cm])},
}};"""
    return block


# ─────────────────────────────────────────────────────────────────
# PATCH model.js IN-PLACE
# ─────────────────────────────────────────────────────────────────
def patch_model_js(
    rf: RandomForestClassifier,
    metrics: dict,
    meta: dict,
    max_depth: int | None = None,
    n_trees: int | None = None,
) -> None:
    """
    Rewrite the TREES array and DATASET_STATS block inside model.js.
    Makes a timestamped backup first.
    """
    if not MODEL_JS.exists():
        raise FileNotFoundError(f"model.js not found at {MODEL_JS}")

    # Reject transformations that would make displayed CV metrics describe a
    # different architecture. Export the entire evaluated forest at full depth.
    if max_depth is not None and max_depth < max(est.get_depth() for est in rf.estimators_):
        raise ValueError('Export pruning is disabled; evaluate the desired depth before exporting')
    if n_trees is not None and n_trees != len(rf.estimators_):
        raise ValueError('Tree selection is disabled; evaluate the desired tree count before exporting')
    if list(rf.classes_) != [0,1,2]:
        raise ValueError('Expected Low/Mid/High class mapping [0,1,2]')
    js_trees = rf_to_js_trees(rf, max_depth=None)

    BACKUP_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    backup = BACKUP_DIR / f'model_{ts}.js.bak'
    backup.write_text(MODEL_JS.read_text(encoding='utf-8'), encoding='utf-8')

    trees_str = trees_to_js_array(js_trees)
    stats_str = build_stats_block(metrics, {**meta, 'tree_count':len(js_trees)})

    # ── Read & patch ─────────────────────────────────────────────
    original = MODEL_JS.read_text(encoding="utf-8")

    # Replace TREES block
    trees_pattern = re.compile(
        r"const TREES\s*=\s*\[.*?\];",
        re.DOTALL
    )
    if trees_pattern.search(original):
        patched = trees_pattern.sub(trees_str, original)
    else:
        # Append if not found (shouldn't happen with our file)
        patched = original + "\n\n" + trees_str

    # Replace DATASET_STATS block
    stats_pattern = re.compile(
        r"export const DATASET_STATS\s*=\s*\{.*?\};",
        re.DOTALL
    )
    if stats_pattern.search(patched):
        patched = stats_pattern.sub(stats_str, patched)
    else:
        patched = patched + "\n\n" + stats_str

    MODEL_JS.write_text(patched, encoding="utf-8")
    print(f"  ✓ model.js updated with {len(js_trees)} trees (max_depth={max_depth})")
    print(f"  ✓ DATASET_STATS updated with live metrics")


# ─────────────────────────────────────────────────────────────────
# STANDALONE — print tree summary
# ─────────────────────────────────────────────────────────────────
def print_tree_summary(rf: RandomForestClassifier, n: int = 3):
    """Print the first n trees in human-readable format."""
    for i, est in enumerate(rf.estimators_[:n]):
        t = est.tree_
        print(f"\n  Tree {i+1}: {t.node_count} nodes, max_depth={est.get_depth()}")

        def walk(node_id, depth=0):
            if t.feature[node_id] == -2:
                counts = t.value[node_id][0]
                total  = counts.sum()
                probs  = counts / total
                cls    = np.argmax(probs)
                labels = ["Low", "Mid", "High"]
                print("  " + "  " * depth + f"→ LEAF: {labels[cls]} "
                      f"[{probs[0]:.2f}, {probs[1]:.2f}, {probs[2]:.2f}]")
            else:
                fn  = FEATURE_NAMES[t.feature[node_id]]
                thr = t.threshold[node_id]
                print("  " + "  " * depth + f"if {fn} ≤ {thr:.2f}:")
                walk(t.children_left[node_id],  depth + 1)
                print("  " + "  " * depth + f"else ({fn} > {thr:.2f}):")
                walk(t.children_right[node_id], depth + 1)

        walk(0)
