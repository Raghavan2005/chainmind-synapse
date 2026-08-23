from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Any

from services.common.hashing import commit_id, state_hash, to_hex
from services.common.llm import LLMOverride, runtime_from
from services.common.log import emit
from services.explain.engine import Explainer, llm_explanation, template_explanation
from services.fuse.engine import beta_expectation, fuse_subject
from services.normalize.extract import extract_claim
from services.normalize.schema import Explanation, NormalizedClaim
from services.score.features import vector
from services.score.predict import Scorer
from services.store import atomic_write, read_json


class Brain:
    def __init__(self, settings, scorer: Scorer):
        self.settings = settings
        self.scorer = scorer
        self.explainer = Explainer(scorer)
        self._lock = threading.Lock()
        self.claims: dict[str, NormalizedClaim] = {}
        self.issuer_rs: dict[str, tuple[float, float]] = {}
        self.overlay: dict[str, Any] = read_json(settings.overlay_path, {"subjects": {}})
        self.heads: dict[int, int] = {11155111: 0, 1301: 0}
        self.rpc_errors: dict[int, str] = {}

    def seed_issuer(self, issuer: str, klass: str) -> None:
        seeds = {"honest": (8.0, 1.0), "noisy": (3.0, 3.0), "hostile": (1.0, 8.0)}
        self.issuer_rs[issuer.lower()] = seeds.get(klass, (3.0, 3.0))

    def ingest_event(self, event: dict[str, Any]) -> NormalizedClaim:
        head = self.heads.get(int(event["chainId"]), int(event["blockNumber"]))
        claim, engine = extract_claim(event, head, self.settings)
        if engine == "rules" and runtime_from(self.settings).enabled:
            emit("normalize.fallback", claimId=claim.claim_id, reason="instructor_failed")
        with self._lock:
            self.claims[claim.claim_id] = claim
            if claim.issuer.lower() not in self.issuer_rs:
                self.issuer_rs[claim.issuer.lower()] = (3.0, 3.0)
        emit("score.ok", claimId=claim.claim_id, engine=engine)
        return claim

    def apply_revoke(self, claim_id: str, revoked_at: int) -> None:
        with self._lock:
            claim = self.claims.get(claim_id)
            if claim is None:
                return
            self.claims[claim_id] = claim.model_copy(update={"revoked": True, "revoked_at": revoked_at})

    def subject_claims(self, subject: str) -> list[NormalizedClaim]:
        return [c for c in self.claims.values() if c.subject.lower() == subject.lower()]

    def fuse(self, subject: str) -> dict[str, Any]:
        now = int(time.time())
        claims = self.subject_claims(subject)
        if not claims:
            return {
                "subject": subject,
                "subjectDid": f"did:ethr:sepolia:{subject.lower()}",
                "verdict": "insufficient",
                "confidence": 0.0,
                "scoreBps": 0,
                "modelVersion": self.scorer.version_hex,
                "pendingOnChain": False,
                "degradedChains": self._degraded(),
                "commit": None,
                "topics": [],
                "claims": [],
                "conflicts": [],
            }
        vectors = [vector(c, claims, self.issuer_rs, now) for c in claims]
        probs = self.scorer.predict_proba(vectors)
        p_by_id = {c.claim_id: p for c, p in zip(claims, probs)}
        fused = fuse_subject(claims, p_by_id, self.issuer_rs, now)
        issued_at = now
        ids = [c.claim_id for c in claims]
        cid = commit_id(subject, ids, fused["scoreBps"], self.scorer.version)
        shash = state_hash(subject, ids, fused["scoreBps"], self.scorer.version, issued_at)
        if fused.get("conflicts"):
            emit("fuse.conflict", subject=subject, K=max((t["conflictK"] for t in fused["topics"]), default=0))
        body = {
            "subject": subject,
            "subjectDid": f"did:ethr:sepolia:{subject.lower()}",
            "verdict": fused["verdict"],
            "confidence": fused["confidence"],
            "scoreBps": fused["scoreBps"],
            "modelVersion": self.scorer.version_hex,
            "pendingOnChain": True,
            "degradedChains": self._degraded(),
            "commit": {
                "commitId": to_hex(cid),
                "stateHash": to_hex(shash),
                "txHash": None,
                "chainId": 11155111,
                "issuedAt": issued_at,
                "blockNumber": None,
            },
            "preimage": {
                "subject": subject,
                "claimIdsSorted": sorted(i.lower() for i in ids),
                "scoreBps": fused["scoreBps"],
                "modelVersion": self.scorer.version_hex,
                "issuedAt": issued_at,
            },
            "topics": fused["topics"],
            "claims": fused["claims"],
            "conflicts": fused["conflicts"],
            "vectors": {c.claim_id: vec for c, vec in zip(claims, vectors)},
        }
        return body

    def persist_overlay(self, subject: str, body: dict[str, Any]) -> None:
        with self._lock:
            subjects = self.overlay.setdefault("subjects", {})
            subjects[subject.lower()] = body
            atomic_write(self.settings.overlay_path, self.overlay)

    def explain(
        self, subject: str, body: dict[str, Any], override: LLMOverride | None = None
    ) -> Explanation:
        vectors = body.get("vectors") or {}
        first = next(iter(vectors.values()), [0.0] * 12)
        top = self.explainer.shap_top(first)
        commit_id_hex = body["commit"]["commitId"]
        explained = llm_explanation(body, top, self.settings, override=override) or template_explanation(
            body, top, commit_id_hex
        )
        if explained.commit_id is None:
            explained = explained.model_copy(update={"commit_id": commit_id_hex})
        path = self.settings.explanations_dir / f"{commit_id_hex[2:]}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(explained.model_dump_json(by_alias=True, indent=2), encoding="utf-8")
        return explained

    def _degraded(self) -> list[int]:
        return [cid for cid, err in self.rpc_errors.items() if err]
