from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
import shap

from services.common.llm import LLMOverride, LLMRuntime, complete_structured, runtime_from
from services.normalize.schema import Explanation, Reason
from services.score.features import FEATURE_NAMES
from services.score.predict import Scorer

PROMPT_PATH = Path(__file__).with_name("prompts") / "p2_explain.txt"


def prompt_version() -> str:
    return hashlib.sha256(PROMPT_PATH.read_bytes()).hexdigest()[:16]


class Explainer:
    def __init__(self, scorer: Scorer):
        self.scorer = scorer
        self.tree = shap.TreeExplainer(scorer.model)

    def shap_top(self, vector: list[float], k: int = 5) -> list[tuple[str, float]]:
        values = self.tree.shap_values(np.asarray([vector], dtype=float))
        if isinstance(values, list):
            values = values[1]
        row = np.asarray(values).reshape(-1)
        ranked = sorted(zip(FEATURE_NAMES, row.tolist()), key=lambda item: abs(item[1]), reverse=True)
        return ranked[:k]


def template_explanation(fused: dict[str, Any], shap_top5: list[tuple[str, float]], commit_id: str) -> Explanation:
    conflicts = fused.get("conflicts") or []
    conflict_type = conflicts[0]["type"] if conflicts else "none"
    reasons = [
        Reason(feature=name, shap=float(val), text=f"{name} contributed {val:+.3f}.")
        for name, val in shap_top5
    ]
    return Explanation(
        commitId=commit_id,
        summary=(
            f"{fused['verdict']} on {len(fused.get('claims', []))} claims. "
            f"confidence={fused['confidence']:.2f}."
        ),
        reasons=reasons,
        caveats=[
            "Templated explanation; LLM unavailable.",
            "Score from sklearn+subjective-logic.",
            "Operator key committed the hash.",
        ],
        engine="shap+template",
        conflictType=conflict_type,  # type: ignore[arg-type]
        promptVersion=prompt_version(),
    )


def llm_explanation(
    fused: dict[str, Any],
    shap_top5: list[tuple[str, float]],
    settings: Any,
    override: LLMOverride | None = None,
    runtime: LLMRuntime | None = None,
) -> Explanation | None:
    rt = runtime or runtime_from(settings, override)
    if not rt.enabled:
        return None
    try:
        user = (
            f"subject: {fused.get('subjectDid')}\n"
            f"verdict: {fused['verdict']}\n"
            f"confidence: {fused['confidence']}\n"
            f"scoreBps: {fused['scoreBps']}\n"
            f"topics: {json.dumps(fused.get('topics'))}\n"
            f"conflicts: {json.dumps(fused.get('conflicts'))}\n"
            f"per_claim: {json.dumps(fused.get('claims'))}\n"
            f"shap_top5: {json.dumps([{'feature': n, 'shap': v} for n, v in shap_top5])}\n"
            f"fusion_note: cumulative ⊕ then conflict penalty\n"
        )
        extracted = complete_structured(
            runtime=rt,
            response_model=Explanation,
            temperature=0.2,
            max_tokens=500,
            timeout=10.0,
            messages=[
                {"role": "system", "content": PROMPT_PATH.read_text(encoding="utf-8")},
                {"role": "user", "content": user},
            ],
        )
        commit_hex = (fused.get("commit") or {}).get("commitId")
        return extracted.model_copy(
            update={
                "commit_id": commit_hex or extracted.commit_id,
                "engine": "shap+litellm",
                "prompt_version": prompt_version(),
            }
        )
    except Exception:
        return None
