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

    deployer_private_key: str = ""
    operator_address: str = ""
    issuer_a_private_key: str = ""
    issuer_b_private_key: str = ""
    demo_subject: str = ""

    claim_source_sepolia: str = ""
    claim_source_unichain_sepolia: str = ""
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
