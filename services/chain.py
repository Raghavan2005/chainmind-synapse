from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from web3 import Web3

from services.common.config import ROOT, Settings


def _load_abi(name: str) -> list:
    built = ROOT / "contracts" / "out" / f"{name}.sol" / f"{name}.json"
    fallback = ROOT / "services" / "abi" / f"{name}.json"
    if built.exists():
        return json.loads(built.read_text(encoding="utf-8"))["abi"]
    if fallback.exists():
        return json.loads(fallback.read_text(encoding="utf-8"))
    raise FileNotFoundError(f"ABI missing for {name}. Run forge build.")


def claim_abi() -> list:
    return _load_abi("ClaimSource")


def identity_abi() -> list:
    return _load_abi("IdentityState")


@lru_cache(maxsize=8)
def connect(url: str) -> Web3:
    return Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 20}))


def connect_live(url: str, fallback: str = "") -> Web3:
    """Return the first RPC that answers eth_blockNumber."""
    errors: list[str] = []
    for candidate in (url, fallback):
        if not candidate:
            continue
        w3 = connect(candidate)
        try:
            _ = w3.eth.block_number
            return w3
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
    raise ConnectionError("; ".join(errors) or f"RPC failed: {url}")


def web3s(settings: Settings) -> dict[int, Web3]:
    return {
        11155111: connect_live(settings.sepolia_rpc_url, settings.sepolia_rpc_url_fallback),
        1301: connect_live(settings.unichain_sepolia_rpc_url, settings.unichain_sepolia_rpc_url_fallback),
    }


def dump_abis() -> None:
    dest = ROOT / "services" / "abi"
    dest.mkdir(parents=True, exist_ok=True)
    for name in ("ClaimSource", "IdentityState"):
        src = ROOT / "contracts" / "out" / f"{name}.sol" / f"{name}.json"
        if src.exists():
            abi = json.loads(src.read_text(encoding="utf-8"))["abi"]
            (dest / f"{name}.json").write_text(json.dumps(abi, indent=2), encoding="utf-8")
