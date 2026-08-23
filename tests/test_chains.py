from services.common.chains import (
    ALLOWED_CHAIN_IDS,
    BASE_SEPOLIA_CHAIN_ID,
    CHAINS,
    FORBIDDEN_MAINNET_BRIDGES,
    INK_SEPOLIA_CHAIN_ID,
    L2_CHAINS,
    LOG_RANGE,
    MODE_SEPOLIA_CHAIN_ID,
    OP_SEPOLIA_CHAIN_ID,
    SETTLEMENT_CHAIN_ID,
    SONEIUM_MINATO_CHAIN_ID,
    UNICHAIN_SEPOLIA_CHAIN_ID,
    chain_by_slug,
    did_ethr,
    ingest_floor,
    is_forbidden_mainnet_bridge,
)


def test_catalog_is_sepolia_plus_five_l2s():
    assert SETTLEMENT_CHAIN_ID in ALLOWED_CHAIN_IDS
    assert {
        UNICHAIN_SEPOLIA_CHAIN_ID,
        BASE_SEPOLIA_CHAIN_ID,
        OP_SEPOLIA_CHAIN_ID,
        INK_SEPOLIA_CHAIN_ID,
        MODE_SEPOLIA_CHAIN_ID,
        SONEIUM_MINATO_CHAIN_ID,
    } <= ALLOWED_CHAIN_IDS
    assert len(L2_CHAINS) == 6
    assert 80002 not in ALLOWED_CHAIN_IDS
    assert 1 not in ALLOWED_CHAIN_IDS


def test_each_l2_has_unique_sepolia_bridge():
    bridges = [c.l1_bridge.lower() for c in L2_CHAINS]
    assert len(bridges) == len(set(bridges))
    for spec in L2_CHAINS:
        assert spec.l1_bridge
        assert not is_forbidden_mainnet_bridge(spec.l1_bridge)


def test_refuses_known_mainnet_bridges():
    assert "0x81014f44b0a345033bb2b3b21c7a1a308b35feea" in FORBIDDEN_MAINNET_BRIDGES
    assert is_forbidden_mainnet_bridge("0x3154Cf16ccdb4C6d922629664174b904d80F2C35")
    assert is_forbidden_mainnet_bridge("0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1")
    assert not is_forbidden_mainnet_bridge(CHAINS[BASE_SEPOLIA_CHAIN_ID].l1_bridge)


def test_user_supplied_addresses_match_catalog():
    assert CHAINS[BASE_SEPOLIA_CHAIN_ID].l1_bridge == "0xfd0Bf71F60660E2f608ed56e1659C450eB113120"
    assert CHAINS[OP_SEPOLIA_CHAIN_ID].l1_bridge == "0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1"
    assert CHAINS[INK_SEPOLIA_CHAIN_ID].l1_bridge == "0x33f60714BbD74d62b66D79213C348614DE51901C"
    assert CHAINS[MODE_SEPOLIA_CHAIN_ID].l1_bridge == "0xbC5C679879B2965296756CD959C3C739769995E2"
    assert CHAINS[SONEIUM_MINATO_CHAIN_ID].l1_bridge == "0x5f5a404A5edabcDD80DB05E8e54A78c9EBF000C2"


def test_did_ethr_labels():
    addr = "0x" + "ab" * 20
    assert did_ethr(11155111, addr) == f"did:ethr:sepolia:{addr}"
    assert did_ethr(84532, addr) == f"did:ethr:eip155:84532:{addr}"
    assert did_ethr(11155420, addr) == f"did:ethr:eip155:11155420:{addr}"


def test_ingest_floor_uses_claimsource_deploy_not_head_minus_2k():
    assert LOG_RANGE == 2000
    assert ingest_floor(SETTLEMENT_CHAIN_ID, 99_000_000) == CHAINS[SETTLEMENT_CHAIN_ID].ingest_from_block
    assert ingest_floor(UNICHAIN_SEPOLIA_CHAIN_ID, 99_000_000) == CHAINS[UNICHAIN_SEPOLIA_CHAIN_ID].ingest_from_block
    assert ingest_floor(SETTLEMENT_CHAIN_ID, 99_000_000) < 99_000_000 - LOG_RANGE


def test_slug_aliases():
    assert chain_by_slug("base").chain_id == 84532
    assert chain_by_slug("optimism").chain_id == 11155420
    assert chain_by_slug("minato").chain_id == 1946
