"""On-chain commitment hashes. Must match Solidity abi.encode / encodePacked."""

from __future__ import annotations

from eth_abi import encode
from eth_utils import keccak


def claims_root(claim_ids: list[str]) -> bytes:
    ordered = sorted(cid.lower() for cid in claim_ids)
    packed = b"".join(bytes.fromhex(cid[2:]) for cid in ordered)
    return keccak(packed)


def state_hash(
    subject: str,
    claim_ids: list[str],
    score_bps: int,
    model_version: bytes,
    issued_at: int,
) -> bytes:
    return keccak(
        encode(
            ["address", "bytes32", "uint16", "bytes32", "uint64"],
            [
                subject,
                claims_root(claim_ids),
                score_bps,
                model_version,
                issued_at,
            ],
        )
    )


def commit_id(subject: str, claim_ids: list[str], model_version: bytes) -> bytes:
    return keccak(encode(["address", "bytes32", "bytes32"], [subject, claims_root(claim_ids), model_version]))


def model_version_bytes(blob: bytes) -> bytes:
    return keccak(blob)


def to_hex(value: bytes) -> str:
    return "0x" + value.hex()
