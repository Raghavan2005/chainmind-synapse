from __future__ import annotations

import threading
import time

from eth_account import Account
from web3 import Web3

from services.chain import identity_abi
from services.common.log import emit


class Writer:
    def __init__(self, w3: Web3, address: str, private_key: str):
        self.w3 = w3
        self.address = Web3.to_checksum_address(address)
        self.key = private_key
        self.account = Account.from_key(private_key)
        self.contract = w3.eth.contract(address=self.address, abi=identity_abi())
        self._locks: dict[str, threading.Lock] = {}
        self._global = threading.Lock()

    def _subject_lock(self, subject: str) -> threading.Lock:
        with self._global:
            return self._locks.setdefault(subject.lower(), threading.Lock())

    def commit(self, subject: str, commit_id: bytes, state_hash: bytes, score_bps: int, model_version: bytes) -> dict:
        lock = self._subject_lock(subject)
        with lock:
            started = time.time()
            latest = self.contract.functions.latest(Web3.to_checksum_address(subject)).call()
            if latest[0] == commit_id:
                emit("commit.duplicate", commitId="0x" + commit_id.hex())
                return {
                    "txHash": None,
                    "duplicate": True,
                    "blockNumber": int(latest[5]),
                    "issuedAt": int(latest[4]),
                }
            fn = self.contract.functions.commit(
                Web3.to_checksum_address(subject),
                commit_id,
                state_hash,
                score_bps,
                model_version,
            )
            try:
                tx = fn.build_transaction(
                    {
                        "from": self.account.address,
                        "nonce": self.w3.eth.get_transaction_count(self.account.address),
                        "chainId": 11155111,
                        "gas": 250_000,
                        "maxFeePerGas": self.w3.eth.gas_price * 2,
                        "maxPriorityFeePerGas": self.w3.to_wei(1, "gwei"),
                    }
                )
                signed = self.account.sign_transaction(tx)
                raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
                tx_hash = self.w3.eth.send_raw_transaction(raw)
                emit("commit.sent", commitId="0x" + commit_id.hex(), txHash=tx_hash.hex())
                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                emit(
                    "commit.mined",
                    commitId="0x" + commit_id.hex(),
                    txHash=receipt.transactionHash.hex(),
                    latencyMs=int((time.time() - started) * 1000),
                )
                return {
                    "txHash": receipt.transactionHash.hex(),
                    "duplicate": False,
                    "blockNumber": receipt.blockNumber,
                    "issuedAt": int(time.time()),
                }
            except Exception as exc:
                message = str(exc)
                if "DuplicateCommit" in message or "already" in message.lower():
                    latest = self.contract.functions.latest(Web3.to_checksum_address(subject)).call()
                    if latest[0] == commit_id:
                        emit("commit.duplicate", commitId="0x" + commit_id.hex())
                        return {"txHash": None, "duplicate": True, "blockNumber": int(latest[5]), "issuedAt": int(latest[4])}
                raise
