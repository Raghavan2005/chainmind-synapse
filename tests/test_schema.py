import pytest
from pydantic import ValidationError

from services.normalize.extract import from_event
from services.normalize.schema import NormalizedClaim


FIXTURE = {
    "claimId": "0x" + "11" * 32,
    "chainId": 11155111,
    "subject": "0x" + "ab" * 20,
    "issuer": "0x" + "cd" * 20,
    "topic": "0x" + "ee" * 32,
    "polarity": 1,
    "expiresAt": 1_900_000_000,
    "evidenceURI": 'data:application/json,{"topic":"kyc.adult","polarity":1,"expiresAt":1900000000,"note":"government-like"}',
    "txHash": "0x" + "22" * 32,
    "logIndex": 0,
    "blockNumber": 10,
    "postedAt": 1_700_000_000,
}


def test_normalized_claim_rejects_bad_polarity():
    with pytest.raises(ValidationError):
        NormalizedClaim.model_validate(
            {
                "claimId": "0x" + "11" * 32,
                "chainId": 11155111,
                "subject": "0x" + "ab" * 20,
                "subjectDid": "did:ethr:sepolia:0xab",
                "issuer": "0x" + "cd" * 20,
                "issuerDid": "did:ethr:sepolia:0xcd",
                "topic": "kyc.adult",
                "topicHash": "0x" + "ee" * 32,
                "polarity": 0,
                "expiresAt": 1,
                "postedAt": 1,
                "evidenceURI": "x",
                "evidenceHash": "0x" + "00" * 32,
                "txHash": "0x" + "22" * 32,
                "logIndex": 0,
                "blockNumber": 1,
            }
        )


def test_rules_extractor_inline_json():
    claim = from_event(FIXTURE, head=18)
    assert claim.topic == "kyc.adult"
    assert claim.polarity == 1
    assert claim.signature_valid is True
    assert claim.confirmations == 8
    dumped = claim.model_dump(by_alias=True)
    assert "claimId" in dumped
    NormalizedClaim.model_validate(dumped)
