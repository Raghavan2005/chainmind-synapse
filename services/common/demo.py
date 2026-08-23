"""Canonical demo fight. Overlay is a cache; these txs are the SoT story."""

DEMO_SUBJECT = "0x5cCBd2Ef7DBC744AbFF179F5C5B8180B182B1221"

# IdentityState.commit mined 2026-08-23 — scoreBps 0, both claims in the preimage.
DEMO_COMMIT_ID = "0x815db98f00448421fd6eea71ebff671448e7e9a1a74466b87f49d8fe49e0c338"
DEMO_STATE_HASH = "0xdb2acacfa434d7e66ab913b57d1f9fd58c7810b52274c57cc291b59642cc8789"
DEMO_COMMIT_TX = "0x654ddce8b47cba6b06fe9508ece0ffaf7b9aeb67d59f046bf2fcedad7bee4135"
DEMO_COMMIT_BLOCK = 11548231
# Laptop commit of the hosted two-claim overlay after the 2026-08-23 backfill fix.
LIVE_COMMIT_ID = "0xcca0aa6024fb170823886bbf17e57d6dbf81dfc23a9409262afeffb9fe291ac0"
LIVE_COMMIT_TX = "0x0cc62febe3c876084c89b51aedf281e2b81c52c6041ee3c7266a1a35922e3c86"

KNOWN_COMMIT_TX = {
    DEMO_COMMIT_ID.lower(): DEMO_COMMIT_TX,
    LIVE_COMMIT_ID.lower(): LIVE_COMMIT_TX,
}


def reuse_commit_clock(
    prev: dict,
    claim_ids: list[str],
    score_bps: int,
    model_hex: str,
    now: int,
) -> tuple[int, bool, str | None, int | None]:
    """Keep issuedAt stable when the claim set + score + model have not changed."""
    prev = prev or {}
    prev_pre = prev.get("preimage") or {}
    prev_commit = prev.get("commit") or {}
    sorted_ids = sorted(i.lower() for i in claim_ids)
    prior_ids = [str(x).lower() for x in (prev_pre.get("claimIdsSorted") or [])]
    same = (
        prior_ids == sorted_ids
        and prev_pre.get("scoreBps") == score_bps
        and (prev_pre.get("modelVersion") or prev.get("modelVersion")) == model_hex
        and prev_commit.get("issuedAt") is not None
    )
    if not same:
        return now, True, None, None
    block = prev_commit.get("blockNumber")
    return (
        int(prev_commit["issuedAt"]),
        bool(prev.get("pendingOnChain", True)),
        prev_commit.get("txHash"),
        int(block) if block is not None else None,
    )


def align_overlay_to_latest(body: dict, latest) -> bool:
    """Writer-less host: if Sepolia already stores this commit, drop pendingOnChain."""
    if not latest or int(latest[5]) <= 0:
        return False
    commit = body.setdefault("commit", {})
    on_id = "0x" + latest[0].hex()
    on_hash = "0x" + latest[1].hex()
    want_id = str(commit.get("commitId") or "").lower()
    want_hash = str(commit.get("stateHash") or "").lower()
    if on_hash.lower() != want_hash and on_id.lower() != want_id:
        return False
    # IdentityState stores block.timestamp as issuedAt, not the overlay clock.
    # Do not rewrite preimage issuedAt or the hash we already committed.
    commit["commitId"] = on_id
    commit["stateHash"] = on_hash
    commit["blockNumber"] = int(latest[5])
    known = KNOWN_COMMIT_TX.get(on_id.lower())
    if known and not commit.get("txHash"):
        commit["txHash"] = known
    body["pendingOnChain"] = False
    return True
