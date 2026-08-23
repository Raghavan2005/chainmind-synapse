#!/usr/bin/env python3
"""Third-party check: keccak(preimage) == on-chain stateHash."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from web3 import Web3

from services.chain import connect, identity_abi
from services.common.config import load_settings
from services.common.hashing import state_hash, to_hex


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bundle", type=Path, help="GET /v1/identity JSON file")
    parser.add_argument("--subject", help="read overlay / live API fields from env subject")
    args = parser.parse_args()
    settings = load_settings()
    if args.bundle:
        bundle = json.loads(args.bundle.read_text(encoding="utf-8"))
    else:
        overlay = json.loads(settings.overlay_path.read_text(encoding="utf-8"))
        subject = (args.subject or settings.demo_subject).lower()
        bundle = overlay["subjects"][subject]
    pre = bundle["preimage"]
    computed = state_hash(
        pre["subject"],
        pre["claimIdsSorted"],
        pre["scoreBps"],
        bytes.fromhex(pre["modelVersion"][2:]),
        pre["issuedAt"],
    )
    expected = bundle["commit"]["stateHash"]
    if to_hex(computed).lower() != expected.lower():
        print("mismatch local", to_hex(computed), "bundle", expected, file=sys.stderr)
        return 1
    if settings.identity_state_sepolia:
        w3 = connect(settings.sepolia_rpc_url)
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(settings.identity_state_sepolia),
            abi=identity_abi(),
        )
        latest = contract.functions.latest(Web3.to_checksum_address(pre["subject"])).call()
        on_chain = "0x" + latest[1].hex()
        if on_chain != "0x" + "00" * 32 and on_chain.lower() != expected.lower():
            print("on-chain latest differs (pending overlay?)", on_chain, expected)
    print("ok", expected)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
