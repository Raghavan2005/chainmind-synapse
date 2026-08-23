"""Topic identifiers. bytes32 on-chain = keccak256(ascii) of the dotted name."""

from __future__ import annotations

from eth_utils import keccak

from services.common.chains import (
    ALLOWED_CHAIN_IDS,
    SETTLEMENT_CHAIN_ID,
    UNICHAIN_SEPOLIA_CHAIN_ID,
    did_ethr,
)

TOPIC_NAMES = ("kyc.adult", "kyc.active", "residency.eu")

__all__ = [
    "ALLOWED_CHAIN_IDS",
    "SETTLEMENT_CHAIN_ID",
    "TOPIC_NAMES",
    "UNICHAIN_SEPOLIA_CHAIN_ID",
    "did_ethr",
    "name_from_hash",
    "topic_hash",
    "topic_hex",
]


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
