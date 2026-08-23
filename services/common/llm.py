from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_MODEL = "qwen/qwen3.6-27b"
DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"


@dataclass(frozen=True)
class LLMOverride:
    api_key: str = ""
    base_url: str = ""
    model: str = ""


@dataclass(frozen=True)
class LLMRuntime:
    api_key: str = ""
    base_url: str = ""
    model: str = DEFAULT_MODEL

    @property
    def enabled(self) -> bool:
        return bool(self.api_key.strip())

    @property
    def resolved_model(self) -> str:
        return resolve_model(self.model, self.base_url)


class LLMByokIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    api_key: str = Field(default="", alias="apiKey")
    base_url: str = Field(default="", alias="baseUrl")
    model: str = ""

    def as_override(self) -> LLMOverride:
        return LLMOverride(api_key=self.api_key, base_url=self.base_url, model=self.model)


class _Hello(BaseModel):
    pong: Literal["ok"] = "ok"


def resolve_model(model: str | None, base_url: str | None) -> str:
    name = (model or "").strip() or DEFAULT_MODEL
    url = (base_url or "").strip()
    # Groq's OpenAI-compatible IDs already contain a slash (qwen/qwen3.6-27b).
    # Do not treat that slash as a LiteLLM provider prefix.
    if url and "/" not in name:
        return f"openai/{name}"
    return name


def runtime_from(settings: Any | None = None, override: LLMOverride | None = None) -> LLMRuntime:
    if override is not None and override.api_key.strip():
        return LLMRuntime(
            api_key=override.api_key.strip(),
            base_url=(override.base_url or "").strip(),
            model=(override.model or "").strip()
            or getattr(settings, "llm_model", None)
            or DEFAULT_MODEL,
        )
    return LLMRuntime(
        api_key=getattr(settings, "llm_api_key", "") or "",
        base_url=getattr(settings, "llm_base_url", "") or "",
        model=getattr(settings, "llm_model", None) or DEFAULT_MODEL,
    )


def llm_public_status(settings: Any) -> dict[str, Any]:
    key_set = bool(getattr(settings, "llm_api_key", ""))
    extract_on = bool(getattr(settings, "llm_extract", False)) and key_set
    return {
        "router": "litellm",
        "envConfigured": key_set,
        "model": getattr(settings, "llm_model", None) or DEFAULT_MODEL,
        "baseUrlSet": bool(getattr(settings, "llm_base_url", "")),
        "byok": True,
        "extractMode": "instructor" if extract_on else "rules",
        "explainMode": "shap+litellm" if key_set else "shap+template",
    }


def safe_error(exc: BaseException) -> str:
    text = str(exc)
    text = re.sub(r"gsk_[A-Za-z0-9]+", "[redacted]", text)
    text = re.sub(r"sk-[A-Za-z0-9_\-]+", "[redacted]", text)
    text = re.sub(
        r"(api[_-]?key|authorization|bearer)([=:\s]+)\S+",
        r"\1\2[redacted]",
        text,
        flags=re.IGNORECASE,
    )
    return text[:400]


def uses_groq(runtime: LLMRuntime) -> bool:
    url = (runtime.base_url or "").lower()
    model = (runtime.model or "").lower()
    return "groq.com" in url or model.startswith("groq/") or "qwen/qwen3" in model


def structured_call_options(runtime: LLMRuntime) -> dict[str, Any]:
    opts: dict[str, Any] = {}
    if runtime.base_url:
        opts["api_base"] = runtime.base_url
        opts["custom_llm_provider"] = "openai"
    # Groq Qwen 3.6 reasons by default; tool-calling then 400s.
    # JSON mode + reasoning_effort=none is the working OpenAI-compat path.
    if uses_groq(runtime):
        opts["extra_body"] = {"reasoning_effort": "none"}
    return opts


def _instructor_client(runtime: LLMRuntime):
    import instructor
    import litellm

    litellm.drop_params = True
    litellm.telemetry = False
    litellm.suppress_debug_info = True
    mode = instructor.Mode.JSON if uses_groq(runtime) else instructor.Mode.TOOLS
    return instructor.from_litellm(litellm.completion, mode=mode)


def complete_structured(
    *,
    runtime: LLMRuntime,
    response_model: type,
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int,
    timeout: float = 8.0,
) -> Any:
    if not runtime.enabled:
        raise RuntimeError("llm runtime disabled")
    client = _instructor_client(runtime)
    kwargs: dict[str, Any] = {
        "model": runtime.resolved_model,
        "response_model": response_model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": messages,
        "api_key": runtime.api_key,
        "timeout": timeout,
        "max_retries": 1,
        **structured_call_options(runtime),
    }
    return client.chat.completions.create(**kwargs)


def ping(runtime: LLMRuntime) -> dict[str, Any]:
    model = runtime.resolved_model
    if not runtime.enabled:
        return {"ok": False, "model": model, "error": "no api key"}
    try:
        complete_structured(
            runtime=runtime,
            response_model=_Hello,
            messages=[
                {"role": "system", "content": "Reply with the structured object only."},
                {"role": "user", "content": "ping"},
            ],
            temperature=0,
            max_tokens=40,
            timeout=8.0,
        )
        return {"ok": True, "model": model, "error": None}
    except Exception as exc:
        return {"ok": False, "model": model, "error": safe_error(exc)}
