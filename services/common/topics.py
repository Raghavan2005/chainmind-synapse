"""Topic identifiers. bytes32 on-chain = keccak256(ascii) of the dotted name."""

from __future__ import annotations

from eth_utils import keccak

TOPIC_NAMES = ("kyc.adult", "kyc.active", "residency.eu")
SETTLEMENT_CHAIN_ID = 11155111
AMOY_CHAIN_ID = 80002
ALLOWED_CHAIN_IDS = frozenset({SETTLEMENT_CHAIN_ID, AMOY_CHAIN_ID})


def topic_hash(name: str) -> bytes:
    return keccak(text=name)


def topic_hex(name: str) -> str:
    return "0x" + topic_hash(name).hex()


def name_from_hash(value: bytes | str) -> str | None:
    raw = bytes.fromhex(value[2:]) if isinstance(value, str) else value
    for name in TOPIC_NAMES:
        if topic_hash(name) == raw:
            return name
    return None


def did_ethr(chain_id: int, addr: str) -> str:
    addr = addr.lower()
    if chain_id == SETTLEMENT_CHAIN_ID:
        return f"did:ethr:sepolia:{addr}"
    if chain_id == AMOY_CHAIN_ID:
        return f"did:ethr:eip155:80002:{addr}"
    raise ValueError(f"unsupported chain {chain_id}")
