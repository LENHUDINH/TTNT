"""Offline benchmark: validation selects models; a held-out test evaluates once.

This command creates a candidate, NEVER activates it. See training.artifacts for
an explicit, verified activation and rollback that retain every previous model.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import json
import hashlib
import time

import joblib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.metrics import (mean_absolute_error, mean_squared_error,
                             precision_recall_fscore_support, confusion_matrix,
                             accuracy_score, f1_score)
from sklearn.pipeline import make_pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyClassifier
from xgboost import XGBRegressor
from app.features import (forecast_row, predict_recursive, anomaly_rows,
                          FORECAST_FEATURES, ANOMALY_FEATURES)
from training.dataset import write
from training.classifier_dataset import classification_dataset, split_leakage

ROOT = Path(__file__).resolve().parents[1]
SEED = 20261010
POLICY_VERSION = "financial-ml-v2-phrase-holdout"


def metrics(y, p):
    return {"mae": float(mean_absolute_error(y, p)),
            "rmse": float(np.sqrt(mean_squared_error(y, p)))}


def classification_metrics(actual, predicted, labels):
    return {"accuracy": float(accuracy_score(actual, predicted)),
            "macroF1": float(f1_score(actual, predicted, labels=labels,
                                      average="macro", zero_division=0)),
            "confusionMatrix": confusion_matrix(actual, predicted, labels=labels).tolist()}


def dataset_fingerprint(file_hashes):
    return hashlib.sha256(json.dumps({"files": file_hashes, "policy": POLICY_VERSION,
                                     "seed": SEED}, sort_keys=True).encode()).hexdigest()


def train_classifier(corpus):
    """Selection uses validation only; each phrase occurs in exactly one split."""
    train = corpus[corpus.split == "train"]
    validation = corpus[corpus.split == "validation"]
    test = corpus[corpus.split == "test"]
    labels = sorted(train.category.unique())
    baseline = DummyClassifier(strategy="most_frequent", random_state=SEED).fit(
        np.zeros((len(train), 1)), train.category)
    candidates = {}
    for strength in (1., 4., 12.):
        candidates[f"tfidf_logistic_C{strength:g}"] = make_pipeline(
            TfidfVectorizer(ngram_range=(1, 2), strip_accents=None, lowercase=True),
            LogisticRegression(C=strength, max_iter=1000, random_state=SEED),
        ).fit(train.text, train.category)
    validation_metrics = {
        name: classification_metrics(validation.category, classifier.predict(validation.text), labels)
        for name, classifier in candidates.items()
    }
    validation_baseline = classification_metrics(
        validation.category, baseline.predict(np.zeros((len(validation), 1))), labels)
    # Dict insertion order is a deterministic preference for lower regularization C on ties.
    selected = max(validation_metrics, key=lambda name: validation_metrics[name]["macroF1"])
    classifier = candidates[selected]
    # This is the first and only use of held-out test labels during the training run.
    test_metrics = classification_metrics(test.category, classifier.predict(test.text), labels)
    baseline_metrics = classification_metrics(
        test.category, baseline.predict(np.zeros((len(test), 1))), labels)
    vectorizer = classifier.named_steps["tfidfvectorizer"]
    return classifier, {
        "algorithm": "TF-IDF word/bigram + LogisticRegression",
        "selected": selected,
        "preprocessing": {"lowercase": True, "stripAccents": False,
                          "ngramRange": [1, 2], "vocabularySource": "train only"},
        "labels": labels,
        "splitCounts": {split: int((corpus.split == split).sum())
                        for split in ("train", "validation", "test")},
        "splitMethod": "Independently authored held-out Vietnamese descriptions; no repeated transaction templates",
        "nearDuplicateAudit": {"crossSplitViolations": len(split_leakage(corpus)),
                               "normalization": "casefold, strip accents/punctuation, replace numbers",
                               "tokenJaccardThreshold": .75, "sequenceRatioThreshold": .82,
                               "limitation": "Lexical heuristic; does not prove absence of semantic overlap"},
        "validation": validation_metrics,
        "validationBaseline": {"algorithm": "most-frequent category", **validation_baseline},
        "testBaseline": {"algorithm": "most-frequent category", **baseline_metrics},
        **test_metrics,
        "unknownVocabularyTestPhrases": int((vectorizer.transform(test.text).getnnz(axis=1) == 0).sum()),
        "limitation": "320 authored synthetic phrases, eight categories; held-out phrasing is not an independent real-world language corpus. Ambiguous/custom categories require manual review.",
    }


def train(output_dir=None, dataset_dir=None):
    started = time.time()
    run_time = datetime.now(timezone.utc)
    output = Path(output_dir) if output_dir else ROOT.parent / "runtime" / "ai-training" / "candidates" / run_time.strftime("%Y%m%dT%H%M%S%fZ")
    datasets = Path(dataset_dir) if dataset_dir else ROOT / "datasets"
    output.mkdir(parents=True, exist_ok=False)
    tx, daily = write(datasets)
    corpus = classification_dataset()
    corpus.to_csv(datasets / "classification.csv", index=False)
    dataset_hashes = {name: hashlib.sha256((datasets / name).read_bytes()).hexdigest()
                      for name in ("transactions.csv", "daily.csv", "classification.csv")}
    fingerprint = dataset_fingerprint(dataset_hashes)
    version = "synthetic-v2-" + fingerprint[:12]
    groups = {u: d.assign(date=pd.to_datetime(d.date)).reset_index(drop=True)
              for u, d in daily.groupby("userId")}
    x, y = [], []
    for u in range(12):
        d = groups[u]
        for i in range(30, 255):
            row, scale = forecast_row(d.amount.iloc[:i], d.date.iloc[i], d.recurring.iloc[i])
            x.append(row)
            y.append(d.amount.iloc[i] / scale)
    candidates = {"moving_average": None, "seasonal_naive": None}
    for depth in (5, 10):
        candidates[f"random_forest_depth{depth}"] = RandomForestRegressor(
            n_estimators=100, max_depth=depth, min_samples_leaf=4,
            random_state=SEED, n_jobs=2).fit(x, y)
        candidates[f"xgboost_depth{depth}"] = XGBRegressor(
            n_estimators=120, max_depth=depth, learning_rate=.04, subsample=.85,
            colsample_bytree=.9, random_state=SEED, n_jobs=2).fit(np.asarray(x), np.asarray(y))

    def backtest(model, name, users, origins, horizon):
        actual, predicted = [], []
        for u in users:
            d = groups[u]
            for i in origins:
                dates = d.date.iloc[i:i+horizon]
                recurring = {date.date().isoformat(): float(v)
                             for date, v in zip(dates, d.recurring.iloc[i:i+horizon])}
                predicted.extend(predict_recursive(model, name, d.amount.iloc[:i], dates, recurring))
                actual.extend(d.amount.iloc[i:i+horizon])
        return metrics(actual, predicted), actual, predicted

    validation = {name: backtest(model, name, range(12, 16), [255, 270], 30)[0]
                  for name, model in candidates.items()}
    selected = min(validation, key=lambda name: validation[name]["mae"])
    model = candidates[selected]
    test = {name: backtest(candidate, name, range(16, 20), [310, 335], 30)[0]
            for name, candidate in candidates.items()}
    horizons = {str(h): backtest(model, selected, range(16, 20), [310, 335], h)[0]
                for h in (1, 7, 30)}
    _, actual, predicted = backtest(model, selected, [16], [310], 30)
    fig, ax = plt.subplots(figsize=(9, 3))
    ax.plot(actual, label="Actual synthetic spending")
    ax.plot(predicted, label="Recursive forecast")
    ax.legend()
    ax.set_ylabel("VND")
    fig.tight_layout()
    fig.savefig(output / "forecast-backtest.png", dpi=150)
    plt.close(fig)

    # Separate synthetic accounts: training, threshold calibration, final test.
    splits = []
    for users in (range(12), range(12, 16), range(16, 20)):
        features, labels = [], []
        for u in users:
            d, rows, _ = anomaly_rows(tx[tx.userId == u].to_dict("records"))
            features.extend(rows)
            labels.extend(d.label.to_list())
        splits.append((np.asarray(features), np.asarray(labels)))
    (xa, ya), (xv, yv), (xt, yt) = splits
    detector = IsolationForest(n_estimators=200, contamination="auto", random_state=SEED,
                               n_jobs=2).fit(xa[ya == 0])
    validation_scores = -detector.score_samples(xv)
    normal_training_scores = -detector.score_samples(xa[ya == 0])
    choices = []
    for threshold in np.quantile(normal_training_scores, np.linspace(.95, .9995, 50)):
        flags = validation_scores > threshold
        tn, fp, fn, tp = confusion_matrix(yv, flags, labels=[0, 1]).ravel()
        precision, recall, f1, _ = precision_recall_fscore_support(
            yv, flags, average="binary", zero_division=0)
        choices.append((f1 if fp / max(tn + fp, 1) <= .03 else -1, float(threshold)))
    validation_f1, threshold = max(choices)
    if validation_f1 < 0:
        raise ValueError("No anomaly threshold meets the validation false-positive-rate limit")
    validation_flags = validation_scores > threshold
    vt, vf, vn, vp = confusion_matrix(yv, validation_flags, labels=[0, 1]).ravel()
    test_scores = -detector.score_samples(xt)
    flags = test_scores > threshold
    precision, recall, f1, _ = precision_recall_fscore_support(
        yt, flags, average="binary", zero_division=0)
    cm = confusion_matrix(yt, flags, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    classifier, classification = train_classifier(corpus)
    validation_best_baseline = min(validation[name]["mae"]
                                   for name in ("moving_average", "seasonal_naive"))
    # Eligibility uses validation, not test results. Test remains a report, not a tuning loop.
    checks = {
        "forecastNoWorseThanBestValidationBaseline": validation[selected]["mae"] <= validation_best_baseline,
        "classificationBeatsValidationBaseline": classification["validation"][classification["selected"]]["macroF1"] > classification["validationBaseline"]["macroF1"],
        "classificationValidationMacroF1AtLeastHalf": classification["validation"][classification["selected"]]["macroF1"] >= .5,
        "noCrossSplitNearDuplicatePhrases": classification["nearDuplicateAudit"]["crossSplitViolations"] == 0,
        "anomalyValidationFalsePositiveRateAtMostThreePercent": float(vf / max(vt + vf, 1)) <= .03,
    }
    metadata = {
        "version": version, "seed": SEED, "trainedAt": run_time.isoformat(),
        "trainingPolicyVersion": POLICY_VERSION,
        "dataset": "Synthetic: 20 accounts × 365 days; 320 authored Vietnamese descriptions; no personal/chat data",
        "datasetHash": fingerprint, "datasetFiles": dataset_hashes,
        "forecast": {"selected": selected, "features": FORECAST_FEATURES,
                     "preprocessing": "Normalize by prior 30-day mean; recursive predictions use no future actuals",
                     "trainDays": [30, 254], "validationDays": [255, 299], "testDays": [310, 364],
                     "trainUsers": [0, 11], "validationUsers": [12, 15], "testUsers": [16, 19],
                     "validation": validation, "test": test, "horizons": horizons,
                     "evaluation": "Rolling-origin recursive predictions; test never enters fitting/selection"},
        "anomaly": {"algorithm": "IsolationForest", "features": ANOMALY_FEATURES,
                    "threshold": threshold, "precision": float(precision), "recall": float(recall),
                    "f1": float(f1), "falsePositiveRate": float(fp / max(tn + fp, 1)),
                    "confusionMatrix": cm.tolist(),
                    "validation": {"f1": float(validation_f1),
                                   "falsePositiveRate": float(vf / max(vt + vf, 1))},
                    "splitUsers": {"train": [0, 11], "validation": [12, 15], "test": [16, 19]},
                    "scoreDefinition": "negative score_samples; larger is more unusual, NOT probability",
                    "normalOnlyTraining": "Synthetic labels exclude injected training anomalies; validation labels calibrate threshold"},
        "classification": classification,
        "activationEligibility": {"eligible": all(checks.values()), "checks": checks,
                                  "policy": "Validation eligibility is necessary; deployment still requires explicit activation"},
        "limitations": ["Synthetic benchmark only; cannot claim production accuracy.",
                        "No confidence interval is estimated.",
                        "New category names map to Khác for anomaly inference.",
                        "Known recurring schedules must not be inferred from future test spending.",
                        "Conversation LLM is separately integrated; this pipeline does NOT train or fine-tune an LLM."],
        "trainingSeconds": round(time.time() - started, 2),
    }
    joblib.dump({"model": model, "name": selected, "detector": detector,
                 "threshold": threshold, "classifier": classifier, "metadata": metadata},
                output / "models.joblib")
    (output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    fig, ax = plt.subplots(figsize=(4, 3))
    ax.imshow(cm, cmap="Greens")
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")
    for (i, j), value in np.ndenumerate(cm):
        ax.text(j, i, str(value), ha="center", va="center")
    fig.tight_layout()
    fig.savefig(output / "anomaly-confusion.png", dpi=150)
    plt.close(fig)
    # Hashes detect damaged files; only locally trusted artifacts can be unpickled.
    manifest = {"schemaVersion": 1, "modelVersion": version,
                "files": {name: hashlib.sha256((output / name).read_bytes()).hexdigest()
                          for name in ("models.joblib", "metadata.json", "forecast-backtest.png", "anomaly-confusion.png")}}
    (output / "candidate-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    summary = {"candidateDirectory": str(output), "version": version, "selected": selected,
               "forecastTest": horizons, "anomalyTest": {"precision": float(precision), "recall": float(recall), "f1": float(f1)},
               "classificationTest": {"accuracy": classification["accuracy"], "macroF1": classification["macroF1"]},
               "activationEligible": metadata["activationEligibility"]["eligible"], "activated": False}
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, help="New directory for a candidate; must not already exist")
    parser.add_argument("--dataset-dir", type=Path, help="Generated synthetic CSV output")
    options = parser.parse_args()
    train(options.output_dir, options.dataset_dir)
