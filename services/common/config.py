from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    sepolia_rpc_url: str = "https://ethereum-sepolia-rpc.publicnode.com"
    unichain_sepolia_rpc_url: str = "https://sepolia.unichain.org"
    sepolia_rpc_url_fallback: str = "https://1rpc.io/sepolia"
    unichain_sepolia_rpc_url_fallback: str = "https://unichain-sepolia.drpc.org"
    settlement_chain: str = "sepolia"
    unichain_l1_bridge_sepolia: str = "0xea58fcA6849d79EAd1f26608855c2D6407d54Ce2"

    # Emergency second source if Unichain Sepolia itself (not just one RPC) is down.
    # Never auto-started — an operator runs scripts/emergency_anvil_source.sh first.
    anvil_emergency_rpc_url: str = ""
    claim_source_anvil_emergency: str = ""

    base_sepolia_rpc_url: str = "https://sepolia.base.org"
    base_sepolia_rpc_url_fallback: str = "https://base-sepolia-rpc.publicnode.com"
    base_l1_bridge_sepolia: str = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120"

    op_sepolia_rpc_url: str = "https://sepolia.optimism.io"
    op_sepolia_rpc_url_fallback: str = "https://optimism-sepolia-rpc.publicnode.com"
    op_l1_bridge_sepolia: str = "0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1"

    ink_sepolia_rpc_url: str = "https://rpc-gel-sepolia.inkonchain.com"
    ink_sepolia_rpc_url_fallback: str = "https://rpc-gel-sepolia.inkonchain.com"
    ink_l1_bridge_sepolia: str = "0x33f60714BbD74d62b66D79213C348614DE51901C"

    mode_sepolia_rpc_url: str = "https://sepolia.mode.network"
    mode_sepolia_rpc_url_fallback: str = "https://sepolia.mode.network"
    mode_l1_bridge_sepolia: str = "0xbC5C679879B2965296756CD959C3C739769995E2"

    soneium_minato_rpc_url: str = "https://rpc.minato.soneium.org"
    soneium_minato_rpc_url_fallback: str = "https://rpc.minato.soneium.org"
    soneium_l1_bridge_sepolia: str = "0x5f5a404A5edabcDD80DB05E8e54A78c9EBF000C2"

    deployer_private_key: str = ""
    operator_address: str = ""
    issuer_a_private_key: str = ""
    issuer_b_private_key: str = ""
    demo_subject: str = ""

    claim_source_sepolia: str = ""
    claim_source_unichain_sepolia: str = ""
    claim_source_base_sepolia: str = ""
    claim_source_op_sepolia: str = ""
    claim_source_ink_sepolia: str = ""
    claim_source_mode_sepolia: str = ""
    claim_source_soneium_minato: str = ""
    identity_state_sepolia: str = ""

    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = "gpt-4.1-mini"

    model_path: Path = ROOT / "data" / "model.joblib"
    metrics_path: Path = ROOT / "data" / "metrics.json"
    overlay_path: Path = ROOT / "data" / "overlay.json"
    cursors_path: Path = ROOT / "data" / "cursors.json"
    explanations_dir: Path = ROOT / "data" / "explanations"
    train_path: Path = ROOT / "data" / "claims_train.jsonl"

    replay_bearer: str = ""
    api_host: str = "0.0.0.0"
    api_port: int = 8000


def load_settings() -> Settings:
    return Settings()
