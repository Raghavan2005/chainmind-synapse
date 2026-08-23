from services.common.demo import (
    DEMO_COMMIT_ID,
    DEMO_COMMIT_TX,
    align_overlay_to_latest,
    reuse_commit_clock,
)


def test_reuse_clock_remints_when_claim_set_changes():
    prev = {
        "pendingOnChain": False,
        "modelVersion": "0xaa",
        "preimage": {"claimIdsSorted": ["0x11"], "scoreBps": 0, "modelVersion": "0xaa"},
        "commit": {"issuedAt": 100, "txHash": "0xold", "blockNumber": 9},
    }
    issued, pending, tx, block = reuse_commit_clock(prev, ["0x11", "0x22"], 0, "0xaa", now=200)
    assert issued == 200
    assert pending is True
    assert tx is None
    assert block is None


def test_reuse_clock_keeps_issued_at_when_preimage_matches():
    prev = {
        "pendingOnChain": False,
        "modelVersion": "0xaa",
        "preimage": {"claimIdsSorted": ["0x11", "0x22"], "scoreBps": 0, "modelVersion": "0xaa"},
        "commit": {"issuedAt": 100, "txHash": "0xold", "blockNumber": 9},
    }
    issued, pending, tx, block = reuse_commit_clock(prev, ["0x22", "0x11"], 0, "0xaa", now=200)
    assert issued == 100
    assert pending is False
    assert tx == "0xold"
    assert block == 9


def test_align_overlay_matches_commit_id_and_fills_known_tx():
    body = {
        "pendingOnChain": True,
        "commit": {
            "commitId": DEMO_COMMIT_ID,
            "stateHash": "0x" + "ab" * 32,
            "issuedAt": 1,
        },
        "preimage": {"issuedAt": 1, "scoreBps": 12},
    }
    latest = (
        bytes.fromhex(DEMO_COMMIT_ID[2:]),
        bytes.fromhex("cd" * 32),
        0,
        bytes.fromhex("ee" * 32),
        1787466048,
        11548231,
    )
    assert align_overlay_to_latest(body, latest) is True
    assert body["pendingOnChain"] is False
    assert body["commit"]["stateHash"] == "0x" + "cd" * 32
    assert body["commit"]["issuedAt"] == 1
    assert body["commit"]["blockNumber"] == 11548231
    assert body["commit"]["txHash"] == DEMO_COMMIT_TX
    assert body["preimage"]["issuedAt"] == 1


def test_align_overlay_ignores_unrelated_latest():
    body = {
        "pendingOnChain": True,
        "commit": {"commitId": "0x" + "11" * 32, "stateHash": "0x" + "22" * 32},
    }
    latest = (
        bytes.fromhex("33" * 32),
        bytes.fromhex("44" * 32),
        0,
        bytes.fromhex("55" * 32),
        1,
        9,
    )
    assert align_overlay_to_latest(body, latest) is False
    assert body["pendingOnChain"] is True
