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


def commit_id(subject: str, claim_ids: list[str], score_bps: int, model_version: bytes) -> bytes:
    # score_bps is part of the preimage so a revocation-only re-fuse (same claim set,
    # different score) gets a distinct commitId instead of deduping against the old
    # on-chain latest() and silently never emitting a new commit.
    return keccak(
        encode(
            ["address", "bytes32", "uint16", "bytes32"],
            [subject, claims_root(claim_ids), score_bps, model_version],
        )
    )


def model_version_bytes(blob: bytes) -> bytes:
    return keccak(blob)


def to_hex(value: bytes) -> str:
    return "0x" + value.hex()
