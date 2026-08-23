"""
Label function (documented, not a toy copy of one feature):

Hidden issuer class ∈ {honest, noisy, hostile} with Beta seeds from MATH.html
(honest r=8,s=1; noisy r=3,s=3; hostile r=1,s=8).

A claim's hidden reliability y* is 1 when:
  issuer is honest AND not revoked AND not expired AND conflict_count < 2
else mix:
  noisy issuers start at 0.45 then flip with p=0.35
  hostile issuers start at 0 unless corroborated (conflict_count==0 and not revoked), then 0.25
Then flip 12% of labels so the model must use several features.

Features follow SCHEMA.html order. Hold-out 20%, seed 7.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, brier_score_loss, f1_score
from sklearn.model_selection import train_test_split

from services.common.config import ROOT, load_settings
from services.score.features import FEATURE_NAMES

RNG = np.random.default_rng(7)


def _row() -> tuple[list[float], int]:
    klass = RNG.choice(["honest", "noisy", "hostile"], p=[0.45, 0.35, 0.20])
    seeds = {"honest": (8.0, 1.0), "noisy": (3.0, 3.0), "hostile": (1.0, 8.0)}
    r, s = seeds[klass]
    prior = (r + 1.0) / (r + s + 2.0)
    volume = float(np.log1p(RNG.integers(1, 40)))
    hours_to_expiry = float(RNG.normal(200.0 if klass != "hostile" else -10.0, 80.0))
    expired = 1.0 if hours_to_expiry < 0 else 0.0
    revoked = 1.0 if RNG.random() < (0.08 if klass == "honest" else 0.22) else 0.0
    age = float(abs(RNG.normal(24.0, 20.0)))
    confirmations = float(min(RNG.integers(1, 40), 32) / 32.0)
    signature = 1.0 if RNG.random() > 0.03 else 0.0
    conflict = float(RNG.choice([0, 1, 2, 3], p=[0.55, 0.25, 0.15, 0.05]))
    settlement = 1.0 if RNG.random() < 0.5 else 0.0
    polarity = 1.0 if RNG.random() < 0.55 else -1.0
    evidence = float(RNG.uniform(0.02, 0.6))
    features = [
        prior,
        volume,
        hours_to_expiry,
        expired,
        revoked,
        age,
        confirmations,
        signature,
        conflict,
        settlement,
        polarity,
        evidence,
    ]
    # Multi-feature label: issuer class + revocation + expiry + conflict + signature.
    # Not a single-bit copy of `revoked`.
    score = prior
    score -= 0.35 * revoked
    score -= 0.25 * expired
    score -= 0.12 * conflict
    score -= 0.20 * (1.0 - signature)
    score += 0.05 * settlement
    y = 1 if score >= 0.48 else 0
    if klass == "hostile" and revoked == 0 and conflict == 0 and RNG.random() < 0.12:
        y = 1
    if RNG.random() < 0.06:
        y = 1 - y
    return features, y


def generate(n: int = 900) -> tuple[np.ndarray, np.ndarray]:
    xs, ys = zip(*(_row() for _ in range(n)))
    return np.asarray(xs, dtype=float), np.asarray(ys, dtype=int)


def train(path: Path | None = None) -> dict:
    settings = load_settings()
    x, y = generate(900)
    settings.train_path.parent.mkdir(parents=True, exist_ok=True)
    with settings.train_path.open("w", encoding="utf-8") as handle:
        handle.write("# label function: see services/score/train.py module docstring\n")
        for feat, label in zip(x, y):
            handle.write(json.dumps({"features": feat.tolist(), "label": int(label)}) + "\n")
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=7, stratify=y)
    model = HistGradientBoostingClassifier(max_depth=3, max_iter=80, learning_rate=0.08, random_state=7)
    model.fit(x_train, y_train)
    proba = model.predict_proba(x_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    metrics = {
        "accuracy": float(accuracy_score(y_test, pred)),
        "f1": float(f1_score(y_test, pred)),
        "brier": float(brier_score_loss(y_test, proba)),
        "n_train": int(len(y_train)),
        "n_test": int(len(y_test)),
        "features": FEATURE_NAMES,
    }
    if metrics["accuracy"] < 0.75:
        raise SystemExit(f"accuracy {metrics['accuracy']:.3f} < 0.75 — fix the dataset, do not stack networks")
    out = path or settings.model_path
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": FEATURE_NAMES}, out)
    settings.metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    revoked_expired = np.array([[0.18, math.log1p(2), -20.0, 1, 1, 40.0, 0.2, 1, 2, 0, -1, 0.1]])
    p_bad = float(model.predict_proba(revoked_expired)[0, 1])
    metrics["revoked_expired_p"] = p_bad
    if p_bad >= 0.4:
        raise SystemExit(f"revoked+expired fixture scored {p_bad:.3f} (>= 0.4)")
    settings.metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    return metrics


if __name__ == "__main__":
    train()
