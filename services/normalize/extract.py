from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from eth_utils import keccak

from services.common.llm import LLMOverride, complete_structured, runtime_from
from services.common.topics import did_ethr, name_from_hash, topic_hex
from services.normalize.schema import NormalizedClaim

PROMPT_PATH = Path(__file__).with_name("prompts") / "p1_extract.txt"


def prompt_version() -> str:
    return hashlib.sha256(PROMPT_PATH.read_bytes()).hexdigest()[:16]


def _evidence_body(uri: str) -> str:
    if uri.startswith("data:application/json,"):
        return unquote(uri.split(",", 1)[1])
    if uri.startswith("data:application/json;base64,"):
        import base64

        return base64.b64decode(uri.split(",", 1)[1]).decode("utf-8")
    return ""


def parse_evidence_json(uri: str) -> dict[str, Any]:
    body = _evidence_body(uri)
    if not body:
        return {}
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return {"rawText": body}
    return data if isinstance(data, dict) else {"rawText": body}


def from_event(event: dict[str, Any], head: int) -> NormalizedClaim:
    """Deterministic extractor for ClaimPosted logs plus inline JSON evidence."""
    extras = parse_evidence_json(event["evidenceURI"])
    topic = extras.get("topic") or name_from_hash(event["topic"]) or extras.get("topicHint") or "kyc.adult"
    polarity = int(extras.get("polarity", event["polarity"]))
    if polarity not in (-1, 1):
        polarity = int(event["polarity"])
    expires_at = int(extras.get("expiresAt", event["expiresAt"]))
    raw_text = str(extras.get("note") or extras.get("rawText") or extras.get("text") or "")
    confirmations = max(0, head - int(event["blockNumber"]))
    body = _evidence_body(event["evidenceURI"])
    evidence_hash = "0x" + keccak(text=body or event["evidenceURI"]).hex()
    return NormalizedClaim.model_validate(
        {
            "claimId": event["claimId"],
            "chainId": int(event["chainId"]),
            "subject": event["subject"],
            "subjectDid": did_ethr(int(event["chainId"]), event["subject"]),
            "issuer": event["issuer"],
            "issuerDid": extras.get("issuerDid") or did_ethr(int(event["chainId"]), event["issuer"]),
            "topic": topic,
            "topicHash": event["topic"] if str(event["topic"]).startswith("0x") else topic_hex(topic),
            "polarity": polarity,
            "expiresAt": expires_at,
            "postedAt": int(event.get("postedAt") or extras.get("postedAt") or 0),
            "revoked": bool(event.get("revoked", False)),
            "revokedAt": event.get("revokedAt"),
            "evidenceURI": event["evidenceURI"],
            "evidenceHash": evidence_hash,
            "txHash": event["txHash"],
            "logIndex": int(event["logIndex"]),
            "blockNumber": int(event["blockNumber"]),
            "confirmations": confirmations,
            "signatureValid": True,
            "rawText": raw_text,
        }
    )


def extract_claim(
    event: dict[str, Any],
    head: int,
    settings: Any | None = None,
    override: LLMOverride | None = None,
) -> tuple[NormalizedClaim, str]:
    """Return (claim, engine). Instructor-over-LiteLLM when a key is set; else the event/JSON parser."""
    base = from_event(event, head)
    if settings is not None and not getattr(settings, "llm_extract", False) and override is None:
        return base, "rules"
    runtime = runtime_from(settings, override)
    if not runtime.enabled:
        return base, "rules"
    try:
        user = (
            f"chainId: {event['chainId']}\n"
            f"subject: {event['subject']}\n"
            f"issuer: {event['issuer']}\n"
            f"topic_hint: {base.topic}\n"
            f"expiresAt_unix: {event['expiresAt']}\n"
            f"revoked: {event.get('revoked', False)}\n"
            f"evidence:\n---\n{_evidence_body(event['evidenceURI'])}\n---\n"
            f"raw event: {json.dumps(event, default=str)}"
        )
        extracted = complete_structured(
            runtime=runtime,
            response_model=NormalizedClaim,
            temperature=0,
            max_tokens=800,
            timeout=8.0,
            messages=[
                {"role": "system", "content": PROMPT_PATH.read_text(encoding="utf-8")},
                {"role": "user", "content": user},
            ],
        )
        merged = extracted.model_copy(
            update={
                "claim_id": base.claim_id,
                "tx_hash": base.tx_hash,
                "log_index": base.log_index,
                "block_number": base.block_number,
                "confirmations": base.confirmations,
                "chain_id": base.chain_id,
                "subject": base.subject,
                "issuer": base.issuer,
                "topic_hash": base.topic_hash,
                "evidence_uri": base.evidence_uri,
                "evidence_hash": base.evidence_hash,
                "signature_valid": True,
            }
        )
        return NormalizedClaim.model_validate(merged.model_dump(by_alias=True)), "instructor"
    except Exception:
        return base, "rules"
