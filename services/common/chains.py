"""Sepolia-settled ingest catalog.

FR-01 minimum pair remains Sepolia + Unichain Sepolia. Extra L2s are Superchain
testnets whose gas is native ETH minted by that chain's own L1StandardBridge on
Ethereum Sepolia. Never a mainnet bridge.
"""

from __future__ import annotations

from dataclasses import dataclass


SETTLEMENT_CHAIN_ID = 11155111
UNICHAIN_SEPOLIA_CHAIN_ID = 1301
BASE_SEPOLIA_CHAIN_ID = 84532
OP_SEPOLIA_CHAIN_ID = 11155420
INK_SEPOLIA_CHAIN_ID = 763373
MODE_SEPOLIA_CHAIN_ID = 919
SONEIUM_MINATO_CHAIN_ID = 1946

# Never send SepETH here. Verified 2026-08-23: these have code on chain id 1.
FORBIDDEN_MAINNET_BRIDGES = frozenset(
    {
        "0x81014f44b0a345033bb2b3b21c7a1a308b35feea",  # Unichain mainnet
        "0x3154cf16ccdb4c6d922629664174b904d80f2c35",  # Base mainnet
        "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1",  # OP mainnet
    }
)


@dataclass(frozen=True)
class ChainSpec:
    chain_id: int
    slug: str
    label: str
    rpc_attr: str
    rpc_fallback_attr: str
    claim_source_attr: str
    l1_bridge: str | None
    l1_bridge_attr: str | None
    explorer: str
    rpc_default: str
    rpc_fallback_default: str
    rewind: int = 12


CHAINS: dict[int, ChainSpec] = {
    SETTLEMENT_CHAIN_ID: ChainSpec(
        chain_id=SETTLEMENT_CHAIN_ID,
        slug="sepolia",
        label="Sepolia",
        rpc_attr="sepolia_rpc_url",
        rpc_fallback_attr="sepolia_rpc_url_fallback",
        claim_source_attr="claim_source_sepolia",
        l1_bridge=None,
        l1_bridge_attr=None,
        explorer="https://sepolia.etherscan.io",
        rpc_default="https://ethereum-sepolia-rpc.publicnode.com",
        rpc_fallback_default="https://1rpc.io/sepolia",
    ),
    UNICHAIN_SEPOLIA_CHAIN_ID: ChainSpec(
        chain_id=UNICHAIN_SEPOLIA_CHAIN_ID,
        slug="unichain",
        label="Unichain Sepolia",
        rpc_attr="unichain_sepolia_rpc_url",
        rpc_fallback_attr="unichain_sepolia_rpc_url_fallback",
        claim_source_attr="claim_source_unichain_sepolia",
        l1_bridge="0xea58fcA6849d79EAd1f26608855c2D6407d54Ce2",
        l1_bridge_attr="unichain_l1_bridge_sepolia",
        explorer="https://sepolia.uniscan.xyz",
        rpc_default="https://sepolia.unichain.org",
        rpc_fallback_default="https://unichain-sepolia.drpc.org",
    ),
    BASE_SEPOLIA_CHAIN_ID: ChainSpec(
        chain_id=BASE_SEPOLIA_CHAIN_ID,
        slug="base",
        label="Base Sepolia",
        rpc_attr="base_sepolia_rpc_url",
        rpc_fallback_attr="base_sepolia_rpc_url_fallback",
        claim_source_attr="claim_source_base_sepolia",
        l1_bridge="0xfd0Bf71F60660E2f608ed56e1659C450eB113120",
        l1_bridge_attr="base_l1_bridge_sepolia",
        explorer="https://sepolia.basescan.org",
        rpc_default="https://sepolia.base.org",
        rpc_fallback_default="https://base-sepolia-rpc.publicnode.com",
    ),
    OP_SEPOLIA_CHAIN_ID: ChainSpec(
        chain_id=OP_SEPOLIA_CHAIN_ID,
        slug="op",
        label="OP Sepolia",
        rpc_attr="op_sepolia_rpc_url",
        rpc_fallback_attr="op_sepolia_rpc_url_fallback",
        claim_source_attr="claim_source_op_sepolia",
        l1_bridge="0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1",
        l1_bridge_attr="op_l1_bridge_sepolia",
        explorer="https://sepolia-optimism.etherscan.io",
        rpc_default="https://sepolia.optimism.io",
        rpc_fallback_default="https://optimism-sepolia-rpc.publicnode.com",
    ),
    INK_SEPOLIA_CHAIN_ID: ChainSpec(
        chain_id=INK_SEPOLIA_CHAIN_ID,
        slug="ink",
        label="Ink Sepolia",
        rpc_attr="ink_sepolia_rpc_url",
        rpc_fallback_attr="ink_sepolia_rpc_url_fallback",
        claim_source_attr="claim_source_ink_sepolia",
        l1_bridge="0x33f60714BbD74d62b66D79213C348614DE51901C",
        l1_bridge_attr="ink_l1_bridge_sepolia",
        explorer="https://explorer-sepolia.inkonchain.com",
        rpc_default="https://rpc-gel-sepolia.inkonchain.com",
        rpc_fallback_default="https://rpc-gel-sepolia.inkonchain.com",
    ),
    MODE_SEPOLIA_CHAIN_ID: ChainSpec(
        chain_id=MODE_SEPOLIA_CHAIN_ID,
        slug="mode",
        label="Mode Sepolia",
        rpc_attr="mode_sepolia_rpc_url",
        rpc_fallback_attr="mode_sepolia_rpc_url_fallback",
        claim_source_attr="claim_source_mode_sepolia",
        l1_bridge="0xbC5C679879B2965296756CD959C3C739769995E2",
        l1_bridge_attr="mode_l1_bridge_sepolia",
        explorer="https://sepolia.explorer.mode.network",
        rpc_default="https://sepolia.mode.network",
        rpc_fallback_default="https://sepolia.mode.network",
    ),
    SONEIUM_MINATO_CHAIN_ID: ChainSpec(
        chain_id=SONEIUM_MINATO_CHAIN_ID,
        slug="soneium",
        label="Soneium Minato",
        rpc_attr="soneium_minato_rpc_url",
        rpc_fallback_attr="soneium_minato_rpc_url_fallback",
        claim_source_attr="claim_source_soneium_minato",
        l1_bridge="0x5f5a404A5edabcDD80DB05E8e54A78c9EBF000C2",
        l1_bridge_attr="soneium_l1_bridge_sepolia",
        explorer="https://soneium-minato.blockscout.com",
        rpc_default="https://rpc.minato.soneium.org",
        rpc_fallback_default="https://rpc.minato.soneium.org",
    ),
}

ALLOWED_CHAIN_IDS = frozenset(CHAINS)
L2_CHAINS = tuple(c for c in CHAINS.values() if c.l1_bridge)
SLUGS = {c.slug: c for c in CHAINS.values()}


def chain_by_slug(slug: str) -> ChainSpec:
    key = slug.strip().lower()
    aliases = {
        "unichain_sepolia": "unichain",
        "base_sepolia": "base",
        "op_sepolia": "op",
        "optimism": "op",
        "ink_sepolia": "ink",
        "mode_sepolia": "mode",
        "soneium_minato": "soneium",
        "minato": "soneium",
    }
    key = aliases.get(key, key)
    if key not in SLUGS:
        raise ValueError(f"unknown chain slug {slug!r}")
    return SLUGS[key]


def is_forbidden_mainnet_bridge(address: str) -> bool:
    return address.lower() in FORBIDDEN_MAINNET_BRIDGES


def did_ethr(chain_id: int, addr: str) -> str:
    addr = addr.lower()
    if chain_id not in CHAINS:
        raise ValueError(f"unsupported chain {chain_id}")
    if chain_id == SETTLEMENT_CHAIN_ID:
        return f"did:ethr:sepolia:{addr}"
    return f"did:ethr:eip155:{chain_id}:{addr}"


def rewind_blocks(chain_id: int) -> int:
    spec = CHAINS.get(chain_id)
    return spec.rewind if spec else 12
