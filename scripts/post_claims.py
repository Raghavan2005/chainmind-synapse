#!/usr/bin/env python3
"""Post the required A/B conflict fixture to Sepolia + Amoy."""

from __future__ import annotations

import argparse
import json
import time

from eth_account import Account
from web3 import Web3

from services.chain import claim_abi, connect_live
from services.common.config import load_settings
from services.common.topics import AMOY_CHAIN_ID, SETTLEMENT_CHAIN_ID, topic_hash


def _send(w3: Web3, key: str, address: str, subject: str, polarity: int, uri: str) -> str:
    account = Account.from_key(key)
    contract = w3.eth.contract(address=Web3.to_checksum_address(address), abi=claim_abi())
    expires = int(time.time()) + 30 * 24 * 3600
    fn = contract.functions.postClaim(
        Web3.to_checksum_address(subject),
        topic_hash("kyc.adult"),
        polarity,
        expires,
        uri,
    )
    tx = fn.build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "chainId": w3.eth.chain_id,
            "gas": 200_000,
            "maxFeePerGas": w3.eth.gas_price * 2,
            "maxPriorityFeePerGas": w3.to_wei(1, "gwei"),
        }
    )
    signed = account.sign_transaction(tx)
    raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    return receipt.transactionHash.hex()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--revoke-c", action="store_true")
    args = parser.parse_args()
    settings = load_settings()
    if not (settings.issuer_a_private_key and settings.issuer_b_private_key and settings.demo_subject):
        raise SystemExit("set ISSUER_A_PRIVATE_KEY, ISSUER_B_PRIVATE_KEY, DEMO_SUBJECT")
    sepolia = connect_live(settings.sepolia_rpc_url, settings.sepolia_rpc_url_fallback)
    amoy = connect_live(settings.amoy_rpc_url, settings.amoy_rpc_url_fallback)
    uri_a = 'data:application/json,{"topic":"kyc.adult","polarity":1,"note":"government-like eligibility record"}'
    uri_b = 'data:application/json,{"topic":"kyc.adult","polarity":-1,"note":"issuer disputes adulthood attestation"}'
    tx_a = _send(sepolia, settings.issuer_a_private_key, settings.claim_source_sepolia, settings.demo_subject, 1, uri_a)
    tx_b = _send(amoy, settings.issuer_b_private_key, settings.claim_source_amoy, settings.demo_subject, -1, uri_b)
    print(json.dumps({"sepoliaClaim": tx_a, "amoyClaim": tx_b}, indent=2))
    if args.revoke_c:
        print("revoke path uses the last Sepolia claim via cast/revoke in demo_flow")


if __name__ == "__main__":
    main()
