from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from services.fuse.opinions import Opinion, average, cumulative, from_sklearn, pairwise_k
from services.normalize.schema import NormalizedClaim

THETA = 0.45


def evidence_mass(confirmations: int, issuer_volume: float) -> float:
    return min(8.0, 0.5 + confirmations / 16.0 + issuer_volume / 4.0)


def beta_expectation(r: float, s: float) -> float:
    return (r + 1.0) / (r + s + 2.0)


def fuse_subject(
    claims: list[NormalizedClaim],
    p_by_id: dict[str, float],
    issuer_rs: dict[str, tuple[float, float]],
    now: int,
) -> dict[str, Any]:
    live = list(claims)
    by_topic: dict[str, list[NormalizedClaim]] = defaultdict(list)
    for claim in live:
        by_topic[claim.topic].append(claim)

    topics_out: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    claim_rows: list[dict[str, Any]] = []
    k_values: list[float] = []

    for topic, group in sorted(by_topic.items()):
        group = sorted(group, key=lambda c: c.claim_id.lower())
        opinions: list[tuple[NormalizedClaim, Opinion, float]] = []
        for claim in group:
            r, s = issuer_rs.get(claim.issuer.lower(), (3.0, 3.0))
            prior = beta_expectation(r, s)
            expired = now >= claim.expires_at
            p_i = p_by_id[claim.claim_id]
            mass = evidence_mass(claim.confirmations, math.log1p(r + s))
            omega = from_sklearn(p_i, mass, claim.polarity, claim.revoked, expired)
            opinions.append((claim, omega, prior))
            claim_rows.append(
                {
                    "claimId": claim.claim_id,
                    "chainId": claim.chain_id,
                    "issuer": claim.issuer,
                    "topic": claim.topic,
                    "polarity": claim.polarity,
                    "pCredible": p_i,
                    "opinion": omega.as_dict(),
                    "txHash": claim.tx_hash,
                    "revoked": claim.revoked,
                }
            )

        max_k = 0.0
        revised = False
        for i in range(len(opinions)):
            for j in range(i + 1, len(opinions)):
                k = pairwise_k(opinions[i][1], opinions[j][1])
                max_k = max(max_k, k)
                same_issuer = opinions[i][0].issuer.lower() == opinions[j][0].issuer.lower()
                opposite = opinions[i][0].polarity != opinions[j][0].polarity
                if opposite:
                    ctype = "self-contradiction" if same_issuer else "multi-source"
                    conflicts.append(
                        {
                            "topic": topic,
                            "claimIds": [opinions[i][0].claim_id, opinions[j][0].claim_id],
                            "type": ctype,
                            "note": "Opposite polarity, two issuers"
                            if ctype == "multi-source"
                            else "Same issuer, opposite polarity, no revoke",
                        }
                    )
                if k > THETA:
                    weaker = i if opinions[i][2] <= opinions[j][2] else j
                    claim, omega, prior = opinions[weaker]
                    shrunk = from_sklearn(
                        p_by_id[claim.claim_id],
                        evidence_mass(claim.confirmations, math.log1p(sum(issuer_rs.get(claim.issuer.lower(), (3.0, 3.0)))))
                        * 0.5,
                        claim.polarity,
                        claim.revoked,
                        now >= claim.expires_at,
                    )
                    opinions[weaker] = (claim, shrunk, prior)
                    revised = True

        # Duplicates (same issuer + topic + evidence hash) average; else cumulative.
        buckets: dict[str, list[Opinion]] = defaultdict(list)
        leftover: list[Opinion] = []
        seen_dup: dict[str, int] = defaultdict(int)
        for claim, omega, _ in opinions:
            key = f"{claim.issuer.lower()}:{claim.topic}:{claim.evidence_hash}"
            seen_dup[key] += 1
            buckets[key].append(omega)
        fused: Opinion | None = None
        for key, omegas in buckets.items():
            local = omegas[0]
            if len(omegas) > 1:
                for extra in omegas[1:]:
                    local = average(local, extra)
            leftover.append(local)
        leftover_sorted = leftover
        for omega in leftover_sorted:
            fused = omega if fused is None else cumulative(fused, omega)
        assert fused is not None
        p = fused.p()
        if max_k > 0.15 or any(c["topic"] == topic for c in conflicts):
            verdict = "unresolved"
        elif p >= 0.6:
            verdict = "true"
        elif p <= 0.4:
            verdict = "false"
        else:
            verdict = "unknown"
        k_values.append(max_k)
        topics_out.append(
            {
                "topic": topic,
                "opinion": fused.as_dict(),
                "conflictK": max_k,
                "verdict": verdict,
                "revised": revised,
            }
        )

    if not topics_out:
        confidence = 0.0
        verdict = "insufficient"
        p_mean = 0.5
    else:
        u_mean = sum(t["opinion"]["u"] for t in topics_out) / len(topics_out)
        k_bar = sum(k_values) / len(k_values) if k_values else 0.0
        p_mean = sum(t["opinion"]["p"] for t in topics_out) / len(topics_out)
        tilt = min(max(2.0 * abs(p_mean - 0.5), 0.0), 1.0) ** 0.5
        confidence = (1.0 - u_mean) * (1.0 - k_bar) * tilt
        if any(c["type"] == "multi-source" for c in conflicts):
            verdict = "conflict"
        elif all(t["verdict"] == "true" for t in topics_out):
            verdict = "supported"
        elif all(t["verdict"] == "false" for t in topics_out):
            verdict = "rejected"
        elif not claims:
            verdict = "insufficient"
        else:
            verdict = "insufficient"

    score_bps = int(round(10000 * confidence))
    return {
        "verdict": verdict,
        "confidence": confidence,
        "scoreBps": score_bps,
        "topics": topics_out,
        "claims": claim_rows,
        "conflicts": conflicts,
    }
