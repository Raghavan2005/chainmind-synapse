from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NormalizedClaim(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    claim_id: str = Field(alias="claimId")
    chain_id: int = Field(alias="chainId")
    subject: str
    subject_did: str = Field(alias="subjectDid")
    issuer: str
    issuer_did: str = Field(alias="issuerDid")
    topic: str
    topic_hash: str = Field(alias="topicHash")
    polarity: Literal[-1, 1]
    expires_at: int = Field(alias="expiresAt")
    posted_at: int = Field(alias="postedAt")
    revoked: bool = False
    revoked_at: int | None = Field(default=None, alias="revokedAt")
    evidence_uri: str = Field(alias="evidenceURI")
    evidence_hash: str = Field(alias="evidenceHash")
    tx_hash: str = Field(alias="txHash")
    log_index: int = Field(alias="logIndex")
    block_number: int = Field(alias="blockNumber")
    confirmations: int = 0
    signature_valid: bool = Field(default=True, alias="signatureValid")
    raw_text: str = Field(default="", alias="rawText")

    @field_validator("polarity")
    @classmethod
    def polarity_binary(cls, value: int) -> int:
        if value not in (-1, 1):
            raise ValueError("polarity must be +1 or -1")
        return value


class Opinion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    b: float
    d: float
    u: float
    a: float
    p: float


class Reason(BaseModel):
    model_config = ConfigDict(extra="forbid")

    feature: str
    shap: float | None = None
    text: str


class Explanation(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    commit_id: str | None = Field(default=None, alias="commitId")
    summary: str
    reasons: list[Reason]
    caveats: list[str]
    engine: str = "shap+prompt"
    conflict_type: Literal["multi-source", "stale", "self-contradiction", "none"] = Field(
        default="none", alias="conflictType"
    )
    prompt_version: str | None = Field(default=None, alias="promptVersion")
