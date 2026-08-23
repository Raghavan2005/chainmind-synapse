#!/usr/bin/env python3
"""Commit the hosted overlay preimage from a laptop that holds DEPLOYER_PRIVATE_KEY.

App Runner never gets the writer key (instructions/DEVOPS.html). After hosted
ingest fuses, this reads GET /v1/identity/{subject} and commits those exact
commitId / stateHash / scoreBps / modelVersion bytes so pendingOnChain can
settle against IdentityState.latest().
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request

from eth_utils import to_bytes

from services.chain import connect_live
from services.common.config import load_settings
from services.writer.commit import Writer


def _get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--api",
        default="https://fmngtnpp5e.us-east-1.awsapprunner.com",
        help="API that owns the overlay to commit (usually hosted GET)",
    )
    parser.add_argument("--subject", default="")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    settings = load_settings()
    subject = args.subject or settings.demo_subject
    if not subject:
        print("set DEMO_SUBJECT or pass --subject", file=sys.stderr)
        return 2
    if not settings.deployer_private_key or not settings.identity_state_sepolia:
        print("DEPLOYER_PRIVATE_KEY and IDENTITY_STATE_SEPOLIA required on the writer host", file=sys.stderr)
        return 2
    row = _get(f"{args.api.rstrip('/')}/v1/identity/{subject}")
    commit = row.get("commit") or {}
    needed = ("commitId", "stateHash", "issuedAt")
    if any(not commit.get(k) for k in needed):
        print(f"overlay missing commit fields: {commit}", file=sys.stderr)
        return 2
    print(
        json.dumps(
            {
                "subject": subject,
                "verdict": row.get("verdict"),
                "scoreBps": row.get("scoreBps"),
                "claims": len(row.get("claims") or []),
                "pendingOnChain": row.get("pendingOnChain"),
                "commitId": commit.get("commitId"),
                "stateHash": commit.get("stateHash"),
                "issuedAt": commit.get("issuedAt"),
            },
            indent=2,
        )
    )
    if args.dry_run:
        return 0
    writer = Writer(
        connect_live(settings.sepolia_rpc_url, settings.sepolia_rpc_url_fallback),
        settings.identity_state_sepolia,
        settings.deployer_private_key,
    )
    receipt = writer.commit(
        subject,
        to_bytes(hexstr=commit["commitId"]),
        to_bytes(hexstr=commit["stateHash"]),
        int(row["scoreBps"]),
        to_bytes(hexstr=row["modelVersion"]),
    )
    print(json.dumps(receipt, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
