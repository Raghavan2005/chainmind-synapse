from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from web3 import Web3

from services.common.chains import CHAINS, UNICHAIN_SEPOLIA_CHAIN_ID
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


@lru_cache(maxsize=32)
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


def web3s(settings: Settings) -> dict[int, tuple[Web3, str | None]]:
    """chainId -> (client, source_address_override).

    Override is set only when Unichain Sepolia is fully unreachable and an
    operator has stood up scripts/emergency_anvil_source.sh. Never automatic,
    never a silent swap — watch.py logs chain.emergency_fallback.
    Extra Superchain L2s that fail to connect are skipped, not fatal.
    """
    out: dict[int, tuple[Web3, str | None]] = {}
    for spec in CHAINS.values():
        url = getattr(settings, spec.rpc_attr, "") or ""
        fallback = getattr(settings, spec.rpc_fallback_attr, "") or ""
        if not url:
            continue
        try:
            out[spec.chain_id] = (connect_live(url, fallback), None)
        except Exception:
            continue
    if UNICHAIN_SEPOLIA_CHAIN_ID not in out and settings.anvil_emergency_rpc_url and settings.claim_source_anvil_emergency:
        out[UNICHAIN_SEPOLIA_CHAIN_ID] = (
            connect_live(settings.anvil_emergency_rpc_url),
            settings.claim_source_anvil_emergency,
        )
    return out


def dump_abis() -> None:
    dest = ROOT / "services" / "abi"
    dest.mkdir(parents=True, exist_ok=True)
    for name in ("ClaimSource", "IdentityState"):
        src = ROOT / "contracts" / "out" / f"{name}.sol" / f"{name}.json"
        if src.exists():
            abi = json.loads(src.read_text(encoding="utf-8"))["abi"]
            (dest / f"{name}.json").write_text(json.dumps(abi, indent=2), encoding="utf-8")
