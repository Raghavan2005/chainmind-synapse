from services.chain import claim_abi, identity_abi


def test_committed_abis_load():
    claim_names = {item.get("name") for item in claim_abi()}
    identity_names = {item.get("name") for item in identity_abi()}
    assert "postClaim" in claim_names
    assert "ClaimPosted" in claim_names
    assert "commit" in identity_names
    assert "StateCommitted" in identity_names
