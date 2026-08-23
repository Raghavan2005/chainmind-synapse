from __future__ import annotations

import json
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from web3 import Web3

from services.chain import connect, identity_abi
from services.common.config import load_settings
from services.score.predict import Scorer
from services.store import read_json

settings = load_settings()
scorer: Scorer | None = None
metrics: dict[str, Any] = {}
rpc_cache: dict[str, Any] = {"at": 0, "sepolia": None, "amoy": None, "errors": {}}


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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _heads() -> tuple[int | None, int | None, dict[int, str]]:
    now = time.time()
    if now - rpc_cache["at"] < 8:
        return rpc_cache["sepolia"], rpc_cache["amoy"], rpc_cache["errors"]
    errors: dict[int, str] = {}
    sepolia = amoy = None
    try:
        sepolia = connect(settings.sepolia_rpc_url).eth.block_number
    except Exception as exc:
        errors[11155111] = str(exc)
    try:
        amoy = connect(settings.amoy_rpc_url).eth.block_number
    except Exception as exc:
        errors[80002] = str(exc)
    rpc_cache.update({"at": now, "sepolia": sepolia, "amoy": amoy, "errors": errors})
    return sepolia, amoy, errors


@app.get("/v1/health")
def health() -> dict[str, Any]:
    sepolia, amoy, errors = _heads()
    degraded = bool(errors) or scorer is None
    return {
        "ok": not degraded and scorer is not None,
        "modelLoaded": scorer is not None,
        "modelAccuracy": metrics.get("accuracy"),
        "modelF1": metrics.get("f1"),
        "brier": metrics.get("brier"),
        "sepoliaHead": sepolia,
        "amoyHead": amoy,
        "operator": settings.operator_address or None,
        "contracts": {
            "claimSourceSepolia": settings.claim_source_sepolia or None,
            "claimSourceAmoy": settings.claim_source_amoy or None,
            "identityState": settings.identity_state_sepolia or None,
        },
        "degraded": degraded,
        "rpcErrors": {str(k): v for k, v in errors.items()},
    }


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
    w3 = connect(settings.sepolia_rpc_url)
    contract = w3.eth.contract(address=Web3.to_checksum_address(settings.identity_state_sepolia), abi=identity_abi())
    count = contract.functions.historyCount(Web3.to_checksum_address(subject)).call()
    ids = [contract.functions.historyAt(Web3.to_checksum_address(subject), i).call() for i in range(count)]
    latest = contract.functions.latest(Web3.to_checksum_address(subject)).call()
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
        writer = Writer(connect(settings.sepolia_rpc_url), settings.identity_state_sepolia, settings.deployer_private_key)
    run_once(brain, writer, settings)
    row = _overlay(subject)
    if row is None:
        raise HTTPException(404, "no claims after replay")
    return row
