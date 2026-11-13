# MaternAI presentation script

## Two-minute explanation

“Maternal health was the focus of this project: helping people record six routine health measurements and understand what a machine-learning model predicts from them.

The app runs in the browser and now supports a guided assessment, English and Hindi for the core flow, offline access, and comparison with earlier saved measurements. It also explains uncertainty so users can see when two predicted categories are close.

An important part of our work was checking the evidence behind the model. The original repository advertised 93.4 percent accuracy. However, the bundled model metadata recorded 76.39 percent historical cross-validation accuracy. We corrected the display to reflect that stored figure.

We then evaluated the exact JavaScript model against the downloaded UCI reference dataset. It matched the recorded risk labels on 72.98 percent of 1,014 rows, rounded to 73 percent in the interface.

This does not mean our interface changes reduced the model’s accuracy. We verified that its decision trees and prediction code are unchanged. The historical cross-validation figure and the reference replay come from different evaluation procedures, and the original fitted training artifact and training membership are unavailable. We cannot treat the difference as a controlled before-and-after comparison.

The audit also found 562 duplicate rows and 35 groups of identical measurements with different risk labels. These findings need review; identical measurements do not necessarily represent the same person. In the reference replay, 42 of 272 high-risk-labelled rows were assigned another category, including 17 assigned Low Risk.

We have therefore strengthened the evaluation process: no synthetic fallback data, no substitution of unrelated diabetes labels, grouped cross-validation to reduce duplicate leakage, and complete model export. Python and JavaScript execution matched on 1,287 reference and boundary inputs.

Our next step is evaluation with independently collected, representative, clinician-reviewed data. At present, this remains a research prototype. The progress is better accessibility and stronger, reproducible evidence—not a claim of clinical readiness.”

## Short answer: “Why did accuracy decrease?”

“The model itself did not change. We corrected an unsupported advertised score and added a direct measurement of the model actually running in the browser. The older stored cross-validation score is 76.39 percent; the new reference replay is 72.98 percent. Because the methods and evaluation populations differ, these numbers do not demonstrate model degradation.”

## Figures to remember

| Figure | Meaning |
|---|---|
| 93.4% | Original advertised score; not established for the shipped model by the available artifacts |
| 76.39% | Stored historical cross-validation metadata; not newly reproduced |
| 72.98% | Exact browser-model replay accuracy on 1,014 reference rows |
| 74.78% | Replay accuracy after collapsing exact duplicate complete rows, on 452 rows |
| 84.56% | High-risk recall in the full reference replay; not independent clinical validation |
| 42 of 272 | High-risk-labelled reference rows predicted as another category |
| 17 of 272 | High-risk-labelled reference rows predicted Low Risk |
| 1,287 | Execution parity inputs: 1,014 reference rows plus 273 boundary probes |

Do not compare replay scores with historical CV scores as if they used a shared held-out test set. Do not describe rows as unique patients: this dataset lacks patient identifiers.

## Likely questions

**Can we raise accuracy by adding more data?**

“Potentially, if the data are relevant, consistently measured and independently labelled. Duplicating records, generating artificial examples or mapping a different disease’s labels to maternal risk would not establish better real-world performance.”

**Why not retrain immediately and show a higher score?**

“We first need a defensible evaluation protocol. The pipeline now groups identical measurements across folds and preserves the evaluated model during export. A new candidate should be compared with a baseline under the same protocol, with an untouched test cohort where possible. We have not replaced the current deployed prediction model.”

**Does Python/JavaScript agreement prove that the model is accurate?**

“No. It shows that two implementations execute the shipped tree rules consistently. It does not prove that the labels are correct, that the original sklearn artifact was identical, or that the model works for new patients.”

**Is it ready for clinical use?**

“No. We have improved access and evaluation transparency. Independent external evaluation and appropriate clinical assessment in the intended population remain necessary.”

## Demo sequence

1. Open http://127.0.0.1:8080 and show English/Hindi selection.
2. Show the guided assessment and the missing-reading option.
3. Load a clearly identified sample and explain that it is demonstration data.
4. Show the result, uncertainty explanation and visit comparison.
5. Open Model Stats, then Model evidence. Explain the reference-replay label before showing the score.
6. Point out the data-quality findings and errors, then distinguish the historical metadata below.
7. Close with the independent-validation plan rather than an accuracy target.

Source: locally generated `reports/model-evidence.json`, whose model hash matches the current `js/model.js`. Audit dataset: Ahmed (2020), UCI Maternal Health Risk, DOI:10.24432/C5DP5D, CC BY 4.0. No model retraining or independent clinical validation was performed for this report.
