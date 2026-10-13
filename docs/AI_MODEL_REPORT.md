# AI Model Report — measured offline synthetic benchmark v2

Model version: **`synthetic-v2-f630a4ccb782`**. Training started at `2026-10-10T17:03:43.640884+00:00` (2026-10-11 in Vietnam), seed `20261010`, measured training time `21.26` seconds. The local candidate was verified and explicitly activated at `2026-10-10T17:07:52.159022+00:00`. Full measured output: [ml-training-v2.json](test-results/ml-training-v2.json).

This report concerns three trained financial ML components. **It does not claim that the conversation LLM was trained or fine-tuned.** Chat integrates a separate local inference engine. No financial database records, private chat messages, feedback, passwords or other user data were read by this training pipeline.

## Dataset and version fingerprint

Financial data remains the reproducible synthetic benchmark: 20 accounts × 365 days, generated transactions, recurring expenses, weekend effects and injected labeled anomalies. Demo accounts use a separate seed. Classification now uses **320 independently authored Vietnamese expense descriptions** instead of repeating 24 descriptions across transaction/account splits.

The combined fingerprint includes all three CSV inputs, seed and preprocessing/training policy version `financial-ml-v2-phrase-holdout`. It changes if the classifier corpus changes, even when the financial time series stays unchanged.

| File | SHA256 |
|---|---|
| transactions.csv | `1745bd2703805301177751bea0dda96c01fb218a931bc094f97f58828f9dbbee` |
| daily.csv | `268a6749f96dc022eb8090bc4a25ed3feb10a80c07660010f20318cc119b7347` |
| classification.csv | `1eb3719f51d365950398105c89dbe5c6920063b7e632501e2463200667807feb` |

Combined dataset/policy SHA256: `f630a4ccb7821177d8117d4cafed017498ea313e95cdbe8f5a14dd9e35fbdf8f`. Dependencies: Python 3.12, scikit-learn 1.7.2, XGBoost 3.0.5; exact versions in `ai-service/requirements.lock`.

## Forecast

Features use only previous daily spending: lags 1/7/14/30, rolling 7/30 mean, weekday/month/weekend, and known recurring expenses. Normalize by the prior 30-day mean. Recursive forecasts append predicted amounts, never actual future spending. Recurring dates must be provided as known schedules, never discovered from future test values.

Train: accounts 0–11, days 30–254. Validation: accounts 12–15, rolling origins 255 and 270 with 30-day horizons. Test: accounts 16–19, origins 310 and 335, horizons 1/7/30. Random Forest and XGBoost depth 5/10 compete with moving-average and seasonal-naive baselines. Selection uses only validation MAE; all held-out test results are reported after selection. The financial dataset and evaluation protocol were deliberately preserved from v1.

Selected: **random_forest_depth5**. Held-out 30-day recursive evaluation, VND per daily prediction:

| Model | MAE | RMSE |
|---|---:|---:|
| moving_average | 275,038.86 | 563,501.77 |
| seasonal_naive | 322,455.25 | 658,508.56 |
| random_forest_depth5 | 146,242.47 | 351,948.99 |
| xgboost_depth5 | 159,906.23 | 352,552.41 |
| random_forest_depth10 | 148,376.25 | 353,031.10 |
| xgboost_depth10 | 176,515.64 | 363,995.82 |

| Selected-model horizon | MAE (VND) | RMSE (VND) |
|---|---:|---:|
| 1 day | 191,233.65 | 401,171.26 |
| 7 days | 204,592.68 | 490,548.08 |
| 30 days | 146,242.47 | 351,948.99 |

No confidence interval is estimated. These are daily-spending errors, not total-horizon errors or accuracy percentages. Cold start requires at least 60 daily history observations and 30 expenses. Month-end is complete only if the requested forecast covers the remaining days of that month. Synthetic patterns are simpler than real-world spending.

## Anomalies

IsolationForest has 200 trees. Features: log amount, hour, weekday, semantic category, earlier transactions that day, prior category mean, amount ratio and deviation. Per-account/category history excludes the candidate and all later transactions. Database category IDs are not model features; unknown categories map to Khác.

Train accounts 0–11 use synthetic rows labeled normal. Labels clean training data; this is an unsupervised estimator, not a claim that no labels were accessed. Validation accounts 12–15 calibrate a threshold over 50 normal-training-score quantiles, maximizing F1 subject to validation false-positive rate ≤3%. Test accounts 16–19 remain held out.

Threshold: `0.685724345274142`. Score is negative `score_samples`; larger means more unusual and **is not a probability**.

| Held-out metric | Value |
|---|---:|
| Precision | 0.5000 |
| Recall | 0.6042 |
| F1 | 0.5472 |
| False-positive rate | 0.0065 |

Confusion matrix, rows actual normal/anomaly and columns predicted normal/anomaly: `[[4421, 29], [19, 29]]`.

Half of flagged test records are false positives. Alerts require user review and are never proof of fraud. Inference also requires five previous observations of the same category before emitting an alert; reported benchmark metrics measure the raw model/threshold and do not separately evaluate that suppression rule.

## Vietnamese description classification

Corpus source: `training/classifier_dataset.py`; no repeated template expansion by account, dates, prices or transaction IDs. Train/validation/test contain **192/64/64 distinct descriptions**, respectively: 24/8/8 per category. Each split was authored separately before training. Case, accents, punctuation and numeric substitutions are normalized for an audit that rejects duplicate or near-duplicate phrases across splits. A pair is rejected at token Jaccard ≥0.75 or normalized sequence ratio ≥0.82. The audit found **zero violations**. This lexical heuristic does not establish absence of semantic overlap or guarantee generalization to natural language.

TF-IDF word/bigram vocabulary is fitted on train only; lowercase is enabled and accents are retained. LogisticRegression C values 1/4/12 are selected by validation macro-F1. All tie on validation macro-F1 `0.8898425716440422`; deterministic tie-breaking selects **C=1**. The most-frequent-category baseline achieves validation/test macro-F1 `0.0277777777777778` and accuracy `0.125`; it is a weak sanity baseline.

| Held-out phrase metric | Value |
|---|---:|
| Accuracy | 0.890625 |
| Macro-F1 | 0.8934173669467786 |
| Total test phrases | 64 |
| Test phrases with no trained vocabulary | 0 |

Label order: `Giải trí`, `Hóa đơn`, `Học tập`, `Mua sắm`, `Nhà ở`, `Sức khỏe`, `Ăn uống`, `Đi lại`. Test confusion matrix, rows actual and columns predicted in that order:

```text
[[8,0,0,0,0,0,0,0],
 [0,8,0,0,0,0,0,0],
 [0,0,8,0,0,0,0,0],
 [0,0,0,7,1,0,0,0],
 [0,2,0,0,6,0,0,0],
 [0,0,0,1,0,7,0,0],
 [0,1,0,1,0,0,6,0],
 [0,1,0,0,0,0,0,7]]
```

This replaces v1's template-repeated 1.0000 score; the old score remains a historical result and cannot establish unseen-phrase accuracy. There are only eight test phrases per class, so one error changes that class's recall by 12.5 percentage points. The new corpus remains authored synthetic data, not an independently collected representative Vietnamese corpus. Income, custom categories and ambiguous descriptions need manual review. `Mua cơm trưa` retains category Ăn uống. Input with no learned vocabulary returns UNKNOWN; vocabulary overlap alone does not guarantee a correct prediction.

## Offline candidate evaluation and explicit activation

Training never writes into the serving artifact directory and never runs inside a chat request. A fresh output directory is required, preventing an accidental overwrite:

```sh
cd ai-service
.venv/bin/python -m training.train --output-dir ../runtime/ai-training/my-candidate
.venv/bin/python -m training.artifacts verify --candidate ../runtime/ai-training/my-candidate
# Inspect candidate metadata/metrics before explicitly selecting it to serve:
.venv/bin/python -m training.artifacts activate --candidate ../runtime/ai-training/my-candidate --active-dir artifacts
```

The activation verifier recalculates validation gates: forecast selection must beat or tie the best baseline, classification macro-F1 must exceed its baseline and reach 0.5, phrase leakage must be zero, and anomaly validation FPR must be ≤3%. Final test scores are reported honestly and do not determine model selection or these eligibility gates. Eligible does not mean automatically deployed.

Each candidate stores `models.joblib`, `metadata.json`, plots and a checksum manifest. Checksums are verified before deserializing; JSON and serialized metadata must agree, preprocessing/classes must exist, and estimators must pass small finite-output inference checks. **Only trusted operator-created artifacts are allowed**; checksums detect corruption and do not make an untrusted pickle safe.

Explicit activation copies an immutable version directory and atomically replaces `artifacts/active-manifest.json`; it keeps the previous pointer and preserves the original v1 files. FastAPI resolves and verifies the active version at startup. Restart the AI service after activation to load that version. Roll back with:

```sh
.venv/bin/python -m training.artifacts rollback --active-dir artifacts
# Restart the AI service to load the restored artifact.
```

Local active pointer: `artifacts/versions/model-d76481fea9c7`. Original v1 backup: `artifacts/versions/legacy-80ec4c6c71da`; original root v1 files also remain unchanged. Candidate: `runtime/ai-training/candidates/20261010T170343640884Z`. Charts belong to each immutable version. A newly built Docker image trains, verifies and explicitly activates its candidate during image build, never during inference; local previous artifacts and prior deployment images must be retained for deployment rollback.

## Verification

`tests/test_pipeline.py`: **17 tests passed** on the actual local pipeline and model bundle. They cover deterministic datasets, temporal/candidate exclusion, finite forecast inference, existing classification behavior, lexical split leakage, unchanged model fitting/selection when only test labels change, classifier-inclusive fingerprints, corruption rejected before unpickling, failed quality gates, previous-model preservation/rollback, failed atomic-pointer updates and pointer traversal rejection.

Run with `cd ai-service && .venv/bin/python -m pytest tests/test_pipeline.py -q` after activating a v2 artifact. Before activation, set `AI_TEST_CANDIDATE_DIR` to the candidate to exercise candidate-specific tests. The financial pipeline does not automatically consume chat feedback or real data for retraining.
