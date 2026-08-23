from __future__ import annotations

import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
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
overlay_cache: dict[str, Any] = {"mtime": None, "data": {"subjects": {}}}
history_cache: dict[str, Any] = {}


def _load_metrics() -> dict[str, Any]:
    if settings.metrics_path.exists():
        return json.loads(settings.metrics_path.read_text(encoding="utf-8"))
    return {}


def _hosted_ingest_loop() -> None:
    from services.ingest.watch import run_once
    from services.pipeline import Brain

    assert scorer is not None
    # App Runner health is /v1/health with a 5s timeout. Do not start the
    # seven-chain backfill until the service has answered a few probes.
    time.sleep(30)
    brain = Brain(settings, scorer)
    first = True
    while True:
        try:
            run_once(brain, None, settings, force_backfill=first)
            first = False
        except Exception as exc:
            from services.common.log import emit

            emit("ingest.error", chainId=0, err=str(exc), backoffMs=4000)
        time.sleep(12)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global scorer, metrics
    scorer = Scorer(settings.model_path)
    metrics = _load_metrics()
    if settings.hosted_ingest:
        threading.Thread(target=_hosted_ingest_loop, name="hosted-ingest", daemon=True).start()
    yield


app = FastAPI(
    title="ChainMind Synapse",
    version="0.1.0",
    summary="Cross-chain identity-claim reconciler",
    description=(
        "Ingests ClaimPosted / ClaimRevoked from Sepolia and Superchain L2s, "
        "scores each claim with a frozen sklearn model, fuses conflicts with "
        "Jøsang subjective logic, and serves the last hash-only IdentityState "
        "commit. GET never calls an LLM. Overlay JSON is a cache; replay rebuilds from logs."
    ),
    contact={"name": "ChainMind Synapse", "url": "https://github.com/Raghavan2005/chainmind-synapse"},
    license_info={"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
    openapi_tags=[
        {"name": "health", "description": "Readiness, model metrics, chain heads, contracts."},
        {"name": "identity", "description": "Fused state, on-chain history, and explanations."},
        {"name": "llm", "description": "Public LiteLLM status. Never returns apiKey."},
        {"name": "ops", "description": "Replay from public logs. Requires REPLAY_BEARER."},
    ],
    lifespan=lifespan,
)
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
    if now - rpc_cache["at"] < 15 and rpc_cache.get("heads"):
        return rpc_cache["heads"], rpc_cache["errors"], bool(rpc_cache.get("emergency"))
    heads: dict[int, int | None] = {}
    errors: dict[int, str] = {}
    emergency = False

    def _probe(spec):
        last_err = "no rpc"
        for candidate in (
            getattr(settings, spec.rpc_attr, "") or "",
            getattr(settings, spec.rpc_fallback_attr, "") or "",
        ):
            if not candidate:
                continue
            try:
                w3 = Web3(Web3.HTTPProvider(candidate, request_kwargs={"timeout": 2.5}))
                return spec.chain_id, w3.eth.block_number, None
            except Exception as exc:
                last_err = str(exc)
        return spec.chain_id, None, last_err

    with ThreadPoolExecutor(max_workers=len(CHAINS)) as pool:
        for cid, head, err in pool.map(_probe, CHAINS.values()):
            heads[cid] = head
            if err:
                errors[cid] = err
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


@app.get("/v1/health", tags=["health"])
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


@app.get("/v1/llm", tags=["llm"])
def llm_status() -> dict[str, Any]:
    return llm_public_status(settings)


@app.post("/v1/llm/test", tags=["llm"])
def llm_test(body: LLMByokIn | None = None) -> dict[str, Any]:
    payload = body or LLMByokIn()
    runtime = runtime_from(settings, payload.as_override())
    return ping(runtime)


def _overlay(subject: str) -> dict[str, Any] | None:
    path = settings.overlay_path
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError:
        return None
    if overlay_cache["mtime"] != mtime:
        overlay_cache["data"] = read_json(path, {"subjects": {}})
        overlay_cache["mtime"] = mtime
    return overlay_cache["data"].get("subjects", {}).get(subject.lower())


@app.get("/v1/identity/{subject}", tags=["identity"])
def identity(subject: str, pending: bool = True) -> dict[str, Any]:
    if scorer is None:
        raise HTTPException(503, "model not loaded")
    row = _overlay(subject)
    if row is None:
        raise HTTPException(404, "no claims for this subject on watched chains")
    row = dict(row)
    if not pending:
        row["pendingOnChain"] = False
    row.pop("vectors", None)
    return row


@app.get("/v1/identity/{subject}/history", tags=["identity"])
def history(subject: str) -> dict[str, Any]:
    if not settings.identity_state_sepolia:
        raise HTTPException(503, "identity contract not configured")
    key = subject.lower()
    now = time.time()
    hit = history_cache.get(key)
    if hit and now - hit["at"] < 15:
        return hit["body"]
    w3 = connect_live(settings.sepolia_rpc_url, settings.sepolia_rpc_url_fallback)
    contract = w3.eth.contract(address=Web3.to_checksum_address(settings.identity_state_sepolia), abi=identity_abi())
    checksum_subject = Web3.to_checksum_address(subject)
    count = contract.functions.historyCount(checksum_subject).call()
    with w3.batch_requests() as batch:
        for i in range(count):
            batch.add(contract.functions.historyAt(checksum_subject, i))
        batch.add(contract.functions.latest(checksum_subject))
        *ids, latest = batch.execute()
    body = {
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
    history_cache[key] = {"at": now, "body": body}
    return body


@app.get("/v1/identity/{subject}/explanation", tags=["identity"])
def explanation(subject: str) -> dict[str, Any]:
    row = _overlay(subject)
    if row is None or not row.get("commit"):
        raise HTTPException(404, "explanation not ready")
    commit_id = row["commit"]["commitId"]
    path = settings.explanations_dir / f"{commit_id[2:]}.json"
    if not path.exists():
        raise HTTPException(404, "explanation not ready")
    return json.loads(path.read_text(encoding="utf-8"))


@app.post("/v1/identity/{subject}/explain", tags=["identity"])
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


@app.post("/v1/replay/{subject}", tags=["ops"])
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
