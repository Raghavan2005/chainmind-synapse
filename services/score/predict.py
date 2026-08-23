from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np

from services.common.hashing import model_version_bytes, to_hex
from services.score.features import FEATURE_NAMES


class Scorer:
    def __init__(self, path: Path):
        if not path.exists():
            raise FileNotFoundError(f"model missing: {path}. Run python -m services.score.train")
        payload = joblib.load(path)
        self.model = payload["model"]
        self.features = payload.get("features", FEATURE_NAMES)
        self.version = model_version_bytes(path.read_bytes())
        self.version_hex = to_hex(self.version)
        self.path = path

    def predict_proba(self, vectors: list[list[float]]) -> list[float]:
        arr = np.asarray(vectors, dtype=float)
        return self.model.predict_proba(arr)[:, 1].astype(float).tolist()
