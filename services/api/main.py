from __future__ import annotations

import json
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from web3 import Web3

from services.chain import connect_live, identity_abi
from services.common.chains import CHAINS, SETTLEMENT_CHAIN_ID, UNICHAIN_SEPOLIA_CHAIN_ID
from services.common.config import load_settings
from services.common.llm import LLMByokIn, llm_public_status, ping, runtime_from
from services.score.predict import Scorer
from services.store import read_json

settings = load_settings()
scorer: Scorer | None = None
metrics: dict[str, Any] = {}
rpc_cache: dict[str, Any] = {"at": 0, "heads": {}, "errors": {}, "emergency": False}


def _load_metrics() -> dict[str, Any]:
    if settings.metrics_path.exists():
        return json.loads(settings.metrics_path.read_text(encoding="utf-8"))
    return {}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global scorer, metrics
    scorer = Scorer(settings.model_path)
    metrics = _load_metrics()
    yield


app = FastAPI(title="ChainMind Synapse", version="0.1.0", lifespan=lifespan)
_cors = settings.cors_origins.strip()
_cors_origins = ["*"] if _cors == "*" else [o.strip() for o in _cors.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _heads() -> tuple[dict[int, int | None], dict[int, str], bool]:
    now = time.time()
    if now - rpc_cache["at"] < 8 and rpc_cache.get("heads"):
        return rpc_cache["heads"], rpc_cache["errors"], bool(rpc_cache.get("emergency"))
    heads: dict[int, int | None] = {}
    errors: dict[int, str] = {}
    emergency = False
    for spec in CHAINS.values():
        url = getattr(settings, spec.rpc_attr, "") or ""
        fallback = getattr(settings, spec.rpc_fallback_attr, "") or ""
        try:
            heads[spec.chain_id] = connect_live(url, fallback).eth.block_number
        except Exception as exc:
            heads[spec.chain_id] = None
            errors[spec.chain_id] = str(exc)
    if heads.get(UNICHAIN_SEPOLIA_CHAIN_ID) is None and settings.anvil_emergency_rpc_url and settings.claim_source_anvil_emergency:
        try:
            heads[UNICHAIN_SEPOLIA_CHAIN_ID] = connect_live(settings.anvil_emergency_rpc_url).eth.block_number
            errors.pop(UNICHAIN_SEPOLIA_CHAIN_ID, None)
            emergency = True
        except Exception as anvil_exc:
            prior = errors.get(UNICHAIN_SEPOLIA_CHAIN_ID, "unreachable")
            errors[UNICHAIN_SEPOLIA_CHAIN_ID] = f"unichain: {prior}; anvil emergency: {anvil_exc}"
    rpc_cache.update({"at": now, "heads": heads, "errors": errors, "emergency": emergency})
    return heads, errors, emergency


def _watched_chain_ids() -> set[int]:
    watched = {SETTLEMENT_CHAIN_ID, UNICHAIN_SEPOLIA_CHAIN_ID}
    for spec in CHAINS.values():
        if getattr(settings, spec.claim_source_attr, ""):
            watched.add(spec.chain_id)
    return watched


@app.get("/v1/health")
def health() -> dict[str, Any]:
    heads, errors, emergency = _heads()
    watched = _watched_chain_ids()
    degraded = scorer is None or any(cid in errors for cid in watched)
    return {
        "ok": not degraded and scorer is not None,
        "modelLoaded": scorer is not None,
        "modelAccuracy": metrics.get("accuracy"),
        "modelF1": metrics.get("f1"),
        "brier": metrics.get("brier"),
        "sepoliaHead": heads.get(SETTLEMENT_CHAIN_ID),
        "unichainSepoliaHead": heads.get(UNICHAIN_SEPOLIA_CHAIN_ID),
        "heads": {str(cid): heads.get(cid) for cid in CHAINS},
        "operator": settings.operator_address or None,
        "contracts": {
            "claimSourceSepolia": settings.claim_source_sepolia or None,
            "claimSourceUnichainSepolia": settings.claim_source_unichain_sepolia or None,
            "claimSourceBaseSepolia": settings.claim_source_base_sepolia or None,
            "claimSourceOpSepolia": settings.claim_source_op_sepolia or None,
            "claimSourceInkSepolia": settings.claim_source_ink_sepolia or None,
            "claimSourceModeSepolia": settings.claim_source_mode_sepolia or None,
            "claimSourceSoneiumMinato": settings.claim_source_soneium_minato or None,
            "identityState": settings.identity_state_sepolia or None,
        },
        "degraded": degraded,
        "rpcErrors": {str(k): v for k, v in errors.items()},
        "llm": llm_public_status(settings),
        "emergencySource": {"1301": "anvil-local"} if emergency else None,
    }


@app.get("/v1/llm")
def llm_status() -> dict[str, Any]:
    return llm_public_status(settings)


@app.post("/v1/llm/test")
def llm_test(body: LLMByokIn | None = None) -> dict[str, Any]:
    payload = body or LLMByokIn()
    runtime = runtime_from(settings, payload.as_override())
    return ping(runtime)


def _overlay(subject: str) -> dict[str, Any] | None:
    data = read_json(settings.overlay_path, {"subjects": {}})
    return data.get("subjects", {}).get(subject.lower())


@app.get("/v1/identity/{subject}")
def identity(subject: str, pending: bool = True) -> dict[str, Any]:
    if scorer is None:
        raise HTTPException(503, "model not loaded")
    row = _overlay(subject)
    if row is None:
        raise HTTPException(404, "no claims for this subject on watched chains")
    if not pending:
        row = dict(row)
        row["pendingOnChain"] = False
    row.pop("vectors", None)
    return row


@app.get("/v1/identity/{subject}/history")
def history(subject: str) -> dict[str, Any]:
    if not settings.identity_state_sepolia:
        raise HTTPException(503, "identity contract not configured")
    w3 = connect_live(settings.sepolia_rpc_url, settings.sepolia_rpc_url_fallback)
    contract = w3.eth.contract(address=Web3.to_checksum_address(settings.identity_state_sepolia), abi=identity_abi())
    checksum_subject = Web3.to_checksum_address(subject)
    count = contract.functions.historyCount(checksum_subject).call()
    with w3.batch_requests() as batch:
        for i in range(count):
            batch.add(contract.functions.historyAt(checksum_subject, i))
        batch.add(contract.functions.latest(checksum_subject))
        *ids, latest = batch.execute()
    return {
        "subject": subject,
        "count": count,
        "commitIds": ["0x" + i.hex() for i in ids],
        "latest": {
            "commitId": "0x" + latest[0].hex(),
            "stateHash": "0x" + latest[1].hex(),
            "scoreBps": latest[2],
            "modelVersion": "0x" + latest[3].hex(),
            "issuedAt": latest[4],
            "blockNumber": latest[5],
        },
    }


@app.get("/v1/identity/{subject}/explanation")
def explanation(subject: str) -> dict[str, Any]:
    row = _overlay(subject)
    if row is None or not row.get("commit"):
        raise HTTPException(404, "explanation not ready")
    commit_id = row["commit"]["commitId"]
    path = settings.explanations_dir / f"{commit_id[2:]}.json"
    if not path.exists():
        raise HTTPException(404, "explanation not ready")
    return json.loads(path.read_text(encoding="utf-8"))


@app.post("/v1/identity/{subject}/explain")
def regenerate_explanation(subject: str, body: LLMByokIn | None = None) -> dict[str, Any]:
    if scorer is None:
        raise HTTPException(503, "model not loaded")
    row = _overlay(subject)
    if row is None or not row.get("commit"):
        raise HTTPException(404, "no overlay/commit")
    from services.pipeline import Brain

    payload = body or LLMByokIn()
    override = payload.as_override() if payload.api_key.strip() else None
    explained = Brain(settings, scorer).explain(subject, row, override=override)
    return json.loads(explained.model_dump_json(by_alias=True))


@app.post("/v1/replay/{subject}")
def replay(subject: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not settings.replay_bearer or authorization != f"Bearer {settings.replay_bearer}":
        raise HTTPException(401, "replay forbidden")
    from services.ingest.watch import run_once
    from services.pipeline import Brain
    from services.writer.commit import Writer

    brain = Brain(settings, scorer)
    writer = None
    if settings.identity_state_sepolia and settings.deployer_private_key:
        writer = Writer(
            connect_live(settings.sepolia_rpc_url, settings.sepolia_rpc_url_fallback),
            settings.identity_state_sepolia,
            settings.deployer_private_key,
        )
    run_once(brain, writer, settings, force_backfill=True)
    row = _overlay(subject)
    if row is None:
        raise HTTPException(404, "no claims after replay")
    return row
