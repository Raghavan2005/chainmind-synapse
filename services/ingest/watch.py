from __future__ import annotations

import argparse
import time
from typing import Any

from web3 import Web3

from services.chain import claim_abi, web3s
from services.common.config import load_settings
from services.common.log import emit
from services.common.topics import SETTLEMENT_CHAIN_ID, UNICHAIN_SEPOLIA_CHAIN_ID
from services.pipeline import Brain
from services.score.predict import Scorer
from services.store import atomic_write, read_json
from services.writer.commit import Writer

REWIND = {SETTLEMENT_CHAIN_ID: 12, UNICHAIN_SEPOLIA_CHAIN_ID: 12}


def _sources(settings) -> dict[int, str]:
    return {
        SETTLEMENT_CHAIN_ID: settings.claim_source_sepolia,
        UNICHAIN_SEPOLIA_CHAIN_ID: settings.claim_source_unichain_sepolia,
    }


def poll_chain(w3: Web3, chain_id: int, address: str, from_block: int, to_block: int) -> list[dict[str, Any]]:
    contract = w3.eth.contract(address=Web3.to_checksum_address(address), abi=claim_abi())
    posted = contract.events.ClaimPosted().get_logs(from_block=from_block, to_block=to_block)
    revoked = contract.events.ClaimRevoked().get_logs(from_block=from_block, to_block=to_block)
    events: list[dict[str, Any]] = []
    for log in posted:
        args = log["args"]
        events.append(
            {
                "kind": "posted",
                "chainId": chain_id,
                "claimId": "0x" + args["claimId"].hex(),
                "subject": args["subject"],
                "issuer": args["issuer"],
                "topic": "0x" + args["topic"].hex(),
                "polarity": int(args["polarity"]),
                "expiresAt": int(args["expiresAt"]),
                "evidenceURI": args["evidenceURI"],
                "txHash": log["transactionHash"].hex(),
                "logIndex": log["logIndex"],
                "blockNumber": log["blockNumber"],
                "postedAt": int(w3.eth.get_block(log["blockNumber"]).timestamp),
                "revoked": False,
            }
        )
    for log in revoked:
        args = log["args"]
        events.append(
            {
                "kind": "revoked",
                "chainId": chain_id,
                "claimId": "0x" + args["claimId"].hex(),
                "revokedAt": int(args["at"]),
                "blockNumber": log["blockNumber"],
            }
        )
    events.sort(key=lambda e: (e["blockNumber"], e.get("logIndex", 0)))
    return events


def run_once(brain: Brain, writer: Writer | None, settings, force_backfill: bool = False) -> None:
    cursors = read_json(settings.cursors_path, {"chains": {}})
    clients = web3s(settings)
    sources = _sources(settings)
    for chain_id, (url_w3, source_override) in clients.items():
        address = source_override or sources.get(chain_id)
        if not address:
            continue
        # Anvil's block numbers start at 0 and are unrelated to Unichain Sepolia's —
        # a separate cursor key keeps emergency-mode progress from colliding with (or
        # corrupting) the real chain's cursor, in either direction.
        cursor_key = f"{chain_id}-emergency" if source_override else str(chain_id)
        if source_override:
            emit(
                "chain.emergency_fallback",
                chainId=chain_id,
                source=source_override,
                note="Unichain Sepolia RPC unreachable; serving from local Anvil emergency source. Not a public testnet.",
            )
        try:
            head = url_w3.eth.block_number
            try:
                parent = url_w3.eth.get_block(head)["parentHash"].hex()
            except Exception:
                head = max(0, head - 2)
                parent = url_w3.eth.get_block(head)["parentHash"].hex()
            # force_backfill: a fresh Brain has no in-memory claims, so resuming from
            # the persisted cursor (near head) would miss everything already synced —
            # apply_revoke would silently no-op on a claim this Brain never loaded, and
            # replay would just re-serve the stale overlay. Treat cursor as absent so
            # this run re-derives claims from the same backfill window a truly cold
            # start would use.
            stored = {} if force_backfill else cursors.get("chains", {}).get(cursor_key, {})
            cursor = int(stored.get("lastBlock", max(0, head - 2000)))
            if stored.get("parentHash") and stored.get("lastBlock") == head and stored.get("parentHash") != parent:
                rewind = max(0, head - REWIND.get(chain_id, 12))
                emit("ingest.reorg", chainId=chain_id, rewindTo=rewind)
                cursor = rewind
            start = cursor + 1 if stored else max(0, head - 2000)
            end = head
            events = poll_chain(url_w3, chain_id, address, start, end) if end >= start else []
            subjects: set[str] = set()
            for event in events:
                if event["kind"] == "posted":
                    claim = brain.ingest_event(event)
                    subjects.add(claim.subject)
                else:
                    brain.apply_revoke(event["claimId"], event["revokedAt"])
                    for claim in brain.claims.values():
                        if claim.claim_id == event["claimId"]:
                            subjects.add(claim.subject)
            brain.heads[chain_id] = head
            brain.rpc_errors.pop(chain_id, None)
            emit("ingest.head", chainId=chain_id, block=head, cursor=start, lag=head - start, rpcMs=0)
            cursors.setdefault("chains", {})[cursor_key] = {"lastBlock": head, "parentHash": parent}
            for subject in subjects:
                body = brain.fuse(subject)
                if writer and body.get("commit"):
                    receipt = writer.commit(
                        subject,
                        bytes.fromhex(body["commit"]["commitId"][2:]),
                        bytes.fromhex(body["commit"]["stateHash"][2:]),
                        body["scoreBps"],
                        brain.scorer.version,
                    )
                    body["pendingOnChain"] = bool(receipt.get("duplicate") is False and not receipt.get("txHash"))
                    if receipt.get("txHash"):
                        body["pendingOnChain"] = False
                        body["commit"]["txHash"] = receipt["txHash"]
                        body["commit"]["blockNumber"] = receipt["blockNumber"]
                brain.persist_overlay(subject, body)
                try:
                    brain.explain(subject, body)
                except Exception as exc:
                    emit("explain.error", subject=subject, err=str(exc))
        except Exception as exc:
            brain.rpc_errors[chain_id] = str(exc)
            emit("ingest.error", chainId=chain_id, err=str(exc), backoffMs=2000)
            emit("api.degraded", degradedChains=brain._degraded(), modelLoaded=True)
    atomic_write(settings.cursors_path, cursors)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--poll", type=float, default=4.0)
    parser.add_argument(
        "--full-backfill",
        action="store_true",
        help="Ignore the persisted cursor and re-derive claims from the backfill window (recovery after a restart).",
    )
    args = parser.parse_args()
    settings = load_settings()
    scorer = Scorer(settings.model_path)
    brain = Brain(settings, scorer)
    writer = None
    if settings.identity_state_sepolia and settings.deployer_private_key:
        from services.chain import connect_live

        writer = Writer(
            connect_live(settings.sepolia_rpc_url, settings.sepolia_rpc_url_fallback),
            settings.identity_state_sepolia,
            settings.deployer_private_key,
        )
    if args.once:
        run_once(brain, writer, settings, force_backfill=args.full_backfill)
        return
    while True:
        run_once(brain, writer, settings)
        time.sleep(args.poll)


if __name__ == "__main__":
    main()
