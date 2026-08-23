from __future__ import annotations

import math
from collections import Counter

from services.common.topics import SETTLEMENT_CHAIN_ID
from services.fuse.engine import beta_expectation
from services.normalize.schema import NormalizedClaim

FEATURE_NAMES = [
    "issuer_prior",
    "issuer_volume",
    "hours_to_expiry",
    "expired",
    "revoked",
    "claim_age_hours",
    "confirmations_norm",
    "signature_valid",
    "conflict_count",
    "chain_is_settlement",
    "polarity",
    "evidence_len_norm",
]


def issuer_counts(claims: list[NormalizedClaim]) -> Counter[str]:
    return Counter(c.issuer.lower() for c in claims)


def conflict_count(claim: NormalizedClaim, claims: list[NormalizedClaim], now: int) -> int:
    n = 0
    for other in claims:
        if other.claim_id == claim.claim_id:
            continue
        if other.subject.lower() != claim.subject.lower() or other.topic != claim.topic:
            continue
        if other.revoked or now >= other.expires_at:
            continue
        if other.polarity != claim.polarity:
            n += 1
    return n


def vector(
    claim: NormalizedClaim,
    claims: list[NormalizedClaim],
    issuer_rs: dict[str, tuple[float, float]],
    now: int,
) -> list[float]:
    r, s = issuer_rs.get(claim.issuer.lower(), (3.0, 3.0))
    prior = beta_expectation(r, s)
    volume = math.log1p(issuer_counts(claims)[claim.issuer.lower()])
    hours_to_expiry = (claim.expires_at - now) / 3600.0
    expired = 1.0 if now >= claim.expires_at else 0.0
    revoked = 1.0 if claim.revoked else 0.0
    age = (now - claim.posted_at) / 3600.0 if claim.posted_at else 0.0
    conf = min(claim.confirmations, 32) / 32.0
    return [
        prior,
        volume,
        hours_to_expiry,
        expired,
        revoked,
        age,
        conf,
        1.0 if claim.signature_valid else 0.0,
        float(conflict_count(claim, claims, now)),
        1.0 if claim.chain_id == SETTLEMENT_CHAIN_ID else 0.0,
        float(claim.polarity),
        min(len(claim.raw_text), 2000) / 2000.0,
    ]
