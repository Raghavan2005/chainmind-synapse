from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    sepolia_rpc_url: str = "https://ethereum-sepolia-rpc.publicnode.com"
    amoy_rpc_url: str = "https://polygon-amoy-bor-rpc.publicnode.com"
    sepolia_rpc_url_fallback: str = ""
    amoy_rpc_url_fallback: str = ""
    settlement_chain: str = "sepolia"

    deployer_private_key: str = ""
    operator_address: str = ""
    issuer_a_private_key: str = ""
    issuer_b_private_key: str = ""
    demo_subject: str = ""

    claim_source_sepolia: str = ""
    claim_source_amoy: str = ""
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
