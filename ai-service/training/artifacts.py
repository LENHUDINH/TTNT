"""Trusted local artifacts only: integrity checks, explicit activation and rollback.

A checksum catches corruption, not a malicious pickle. Never accept model paths or
joblib uploads from chat/users; the CLI is for the operator's offline pipeline.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import argparse
import fcntl
import hashlib
import json
import math
import os
import shutil
import uuid

import joblib
import numpy as np

REQUIRED_FILES = {"models.joblib", "metadata.json"}
BUNDLE_KEYS = {"model", "name", "detector", "threshold", "classifier", "metadata"}


class ArtifactError(ValueError):
    pass


def _json(path):
    try:
        value = json.loads(Path(path).read_text())
        if not isinstance(value, dict):
            raise ValueError("JSON object required")
        return value
    except (OSError, ValueError) as error:
        raise ArtifactError(f"Missing or invalid artifact manifest: {Path(path).name}") from error


def _sha(path):
    try:
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()
    except OSError as error:
        raise ArtifactError(f"Cannot read artifact: {Path(path).name}") from error


def _number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ArtifactError(f"Non-finite model metric: {label}")
    return float(value)


def _validate_bundle(bundle, metadata):
    if not isinstance(bundle, dict) or not BUNDLE_KEYS.issubset(bundle):
        raise ArtifactError("Model bundle lacks required inference components")
    if bundle["metadata"] != metadata:
        raise ArtifactError("Serialized and JSON metadata disagree")
    if bundle["name"] != metadata["forecast"]["selected"]:
        raise ArtifactError("Forecast model and metadata disagree")
    if bundle["name"] not in ("moving_average", "seasonal_naive") and not hasattr(bundle["model"], "predict"):
        raise ArtifactError("Forecast estimator is unavailable")
    if not hasattr(bundle["detector"], "score_samples"):
        raise ArtifactError("Anomaly estimator is unavailable")
    _number(bundle["threshold"], "anomaly threshold")
    if bundle["threshold"] != metadata["anomaly"]["threshold"]:
        raise ArtifactError("Anomaly threshold and metadata disagree")
    classifier = bundle["classifier"]
    if not hasattr(classifier, "predict") or "tfidfvectorizer" not in classifier.named_steps:
        raise ArtifactError("Classifier preprocessing is unavailable")
    if classifier.classes_.tolist() != metadata["classification"]["labels"]:
        raise ArtifactError("Classifier labels and metadata disagree")
    # Predict small valid inputs to detect an incompatible/sklearn-damaged artifact.
    classifier.predict(["Mua cơm trưa"])
    if not np.isfinite(bundle["detector"].score_samples(np.zeros((1, len(metadata["anomaly"]["features"]))))).all():
        raise ArtifactError("Anomaly model produced non-finite scores")
    if bundle["model"] is not None:
        output = bundle["model"].predict(np.ones((1, len(metadata["forecast"]["features"]))))
        if not np.isfinite(output).all():
            raise ArtifactError("Forecast model produced non-finite predictions")


def _eligible(metadata):
    """Recompute gates from validation metrics, independent of the reported bool."""
    forecast = metadata["forecast"]
    validations = forecast["validation"]
    selected = forecast["selected"]
    selected_mae = _number(validations[selected]["mae"], "forecast validation MAE")
    baseline_mae = min(_number(validations[name]["mae"], name)
                       for name in ("moving_average", "seasonal_naive"))
    if selected != min(validations, key=lambda name: validations[name]["mae"]) or selected_mae > baseline_mae:
        raise ArtifactError("Forecast fails validation model-selection/baseline gate")
    classification = metadata["classification"]
    selected = classification["selected"]
    score = _number(classification["validation"][selected]["macroF1"], "classification validation macro F1")
    baseline_score = _number(classification["validationBaseline"]["macroF1"], "classification validation baseline")
    if selected != max(classification["validation"], key=lambda name: classification["validation"][name]["macroF1"]):
        raise ArtifactError("Classifier was not selected by validation macro F1")
    if score < .5 or score <= baseline_score:
        raise ArtifactError("Classifier fails validation baseline/quality gate")
    if classification["nearDuplicateAudit"]["crossSplitViolations"] != 0:
        raise ArtifactError("Classifier split leakage detected")
    anomaly_fpr = _number(metadata["anomaly"]["validation"]["falsePositiveRate"], "anomaly validation FPR")
    if not 0 <= anomaly_fpr <= .03:
        raise ArtifactError("Anomaly fails validation false-positive-rate gate")
    if not metadata["activationEligibility"]["eligible"] or not all(metadata["activationEligibility"]["checks"].values()):
        raise ArtifactError("Candidate reports failed eligibility checks")
    if not {"transactions.csv", "daily.csv", "classification.csv"}.issubset(metadata["datasetFiles"]):
        raise ArtifactError("Dataset fingerprint omits training input")


def verify_candidate(directory, require_eligible=True):
    directory = Path(directory).resolve()
    manifest = _json(directory / "candidate-manifest.json")
    files = manifest.get("files", {})
    if manifest.get("schemaVersion") != 1 or not REQUIRED_FILES.issubset(files):
        raise ArtifactError("Candidate manifest lacks model/metadata checksums")
    for name, expected in files.items():
        if Path(name).name != name or not isinstance(expected, str) or len(expected) != 64:
            raise ArtifactError("Invalid artifact file name or checksum")
        file = directory / name
        if not file.is_file() or file.is_symlink() or _sha(file) != expected:
            raise ArtifactError(f"Artifact checksum mismatch: {name}")
    metadata = _json(directory / "metadata.json")
    if metadata.get("version") != manifest.get("modelVersion"):
        raise ArtifactError("Manifest and model version disagree")
    # Unpickle only after integrity checking. Source still must be trusted locally.
    try:
        bundle = joblib.load(directory / "models.joblib")
        _validate_bundle(bundle, metadata)
        if require_eligible:
            _eligible(metadata)
    except ArtifactError:
        raise
    except Exception as error:
        raise ArtifactError("Incompatible or malformed model bundle") from error
    return bundle


def _version_dir(active, relative):
    relative = Path(relative)
    if relative.is_absolute() or len(relative.parts) != 2 or relative.parts[0] != "versions" or ".." in relative.parts:
        raise ArtifactError("Active artifact pointer escapes its version directory")
    raw = active / relative
    resolved = raw.resolve()
    if active.resolve() not in resolved.parents or raw.is_symlink():
        raise ArtifactError("Active artifact pointer is invalid")
    return resolved


def load_active(active_dir):
    """Resolve one atomic pointer; files in that version never change afterwards."""
    active = Path(active_dir).resolve()
    manifest_path = active / "active-manifest.json"
    if manifest_path.exists():
        pointer = _json(manifest_path)
        if pointer.get("schemaVersion") != 1 or not isinstance(pointer.get("directory"), str) or not isinstance(pointer.get("modelVersion"), str):
            raise ArtifactError("Invalid active model pointer")
        directory = _version_dir(active, pointer["directory"])
        bundle = verify_candidate(directory, require_eligible=False)
        if bundle["metadata"]["version"] != pointer["modelVersion"]:
            raise ArtifactError("Active pointer and model version disagree")
        return bundle
    # Existing pre-migration v1 artifact remains valid until operator activation.
    if (active / "models.joblib").is_file():
        metadata = _json(active / "metadata.json")
        try:
            bundle = joblib.load(active / "models.joblib")
            _validate_bundle(bundle, metadata)
            return bundle
        except ArtifactError:
            raise
        except Exception as error:
            raise ArtifactError("Legacy model bundle is incompatible") from error
    raise ArtifactError("No trained active model; train and explicitly activate a candidate")


@contextmanager
def _lock(active):
    active.mkdir(parents=True, exist_ok=True)
    with (active / ".activation.lock").open("a") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        yield
        fcntl.flock(lock.fileno(), fcntl.LOCK_UN)


def _set_pointer(active, pointer):
    temporary = active / f".active-{uuid.uuid4().hex}.json"
    with temporary.open("w") as file:
        json.dump(pointer, file, ensure_ascii=False, indent=2)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())
    os.replace(temporary, active / "active-manifest.json")


def _archive_legacy(active):
    if not (active / "models.joblib").is_file():
        return None
    bundle = load_active(active)
    legacy = active / "versions" / f"legacy-{uuid.uuid4().hex[:12]}"
    legacy.mkdir(parents=True)
    names = [name for name in ("models.joblib", "metadata.json", "forecast-backtest.png", "anomaly-confusion.png")
             if (active / name).is_file()]
    for name in names:
        shutil.copy2(active / name, legacy / name)
    manifest = {"schemaVersion": 1, "modelVersion": bundle["metadata"]["version"],
                "sourceKind": "preserved-legacy", "files": {name: _sha(legacy / name) for name in names}}
    (legacy / "candidate-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    verify_candidate(legacy, require_eligible=False)
    return str(legacy.relative_to(active))


def activate(candidate_dir, active_dir):
    candidate = Path(candidate_dir).resolve()
    active = Path(active_dir).resolve()
    bundle = verify_candidate(candidate)
    version = bundle["metadata"]["version"]
    with _lock(active):
        old_pointer = _json(active / "active-manifest.json") if (active / "active-manifest.json").exists() else None
        if old_pointer:
            load_active(active)  # Preserve only a verified previous serving version.
            previous = old_pointer["directory"]
        else:
            previous = _archive_legacy(active)
        versions = active / "versions"
        versions.mkdir(exist_ok=True)
        suffix = uuid.uuid4().hex[:12]
        staged = versions / f".candidate-{suffix}"
        destination = versions / f"model-{suffix}"
        staged.mkdir()
        manifest = _json(candidate / "candidate-manifest.json")
        for name in manifest["files"]:
            shutil.copy2(candidate / name, staged / name)
        shutil.copy2(candidate / "candidate-manifest.json", staged / "candidate-manifest.json")
        verify_candidate(staged)
        staged.rename(destination)
        pointer = {"schemaVersion": 1, "directory": str(destination.relative_to(active)),
                   "modelVersion": version, "previousDirectory": previous,
                   "activatedAt": datetime.now(timezone.utc).isoformat()}
        _set_pointer(active, pointer)
    return pointer


def rollback(active_dir):
    active = Path(active_dir).resolve()
    with _lock(active):
        pointer = _json(active / "active-manifest.json")
        previous = pointer.get("previousDirectory")
        if not previous:
            raise ArtifactError("No previous model is available for rollback")
        bundle = verify_candidate(_version_dir(active, previous), require_eligible=False)
        restored = {"schemaVersion": 1, "directory": previous,
                    "modelVersion": bundle["metadata"]["version"],
                    "previousDirectory": pointer["directory"],
                    "activatedAt": datetime.now(timezone.utc).isoformat(), "operation": "rollback"}
        _set_pointer(active, restored)
    return restored


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    check = sub.add_parser("verify")
    check.add_argument("--candidate", type=Path, required=True)
    deploy = sub.add_parser("activate")
    deploy.add_argument("--candidate", type=Path, required=True)
    deploy.add_argument("--active-dir", type=Path, default=Path("artifacts"))
    restore = sub.add_parser("rollback")
    restore.add_argument("--active-dir", type=Path, default=Path("artifacts"))
    args = parser.parse_args()
    if args.command == "verify":
        model = verify_candidate(args.candidate)
        print(json.dumps({"valid": True, "eligible": True, "modelVersion": model["metadata"]["version"]}))
    elif args.command == "activate":
        print(json.dumps(activate(args.candidate, args.active_dir), indent=2))
    else:
        print(json.dumps(rollback(args.active_dir), indent=2))
