from types import SimpleNamespace

from services.common.llm import (
    LLMOverride,
    LLMRuntime,
    llm_public_status,
    resolve_model,
    runtime_from,
    structured_call_options,
    uses_groq,
)
from services.normalize.extract import extract_claim
from tests.test_schema import FIXTURE


def test_resolve_model_prefixes_openai_when_base_url():
    assert resolve_model("gpt-4.1-mini", "http://127.0.0.1:11434/v1") == "openai/gpt-4.1-mini"


def test_resolve_model_keeps_provider_prefix():
    assert resolve_model("groq/llama-3.1-8b-instant", "https://api.groq.com/openai/v1") == (
        "groq/llama-3.1-8b-instant"
    )


def test_resolve_model_no_base_url():
    assert resolve_model("gpt-4.1-mini", "") == "gpt-4.1-mini"


def test_resolve_model_empty_defaults():
    assert resolve_model("", None) == "qwen/qwen3.6-27b"


def test_resolve_model_keeps_groq_qwen_id():
    assert resolve_model("qwen/qwen3.6-27b", "https://api.groq.com/openai/v1") == "qwen/qwen3.6-27b"


def test_groq_structured_options_disable_reasoning_and_use_openai_compat():
    rt = LLMRuntime(
        api_key="gsk_test",
        base_url="https://api.groq.com/openai/v1",
        model="qwen/qwen3.6-27b",
    )
    assert uses_groq(rt) is True
    opts = structured_call_options(rt)
    assert opts["custom_llm_provider"] == "openai"
    assert opts["api_base"] == "https://api.groq.com/openai/v1"
    assert opts["extra_body"] == {"reasoning_effort": "none"}


def test_openai_compat_non_groq_keeps_tools_path_options():
    rt = LLMRuntime(api_key="sk-test", base_url="https://api.openai.com/v1", model="gpt-4.1-mini")
    assert uses_groq(rt) is False
    opts = structured_call_options(rt)
    assert "extra_body" not in opts
    assert opts["custom_llm_provider"] == "openai"


def test_runtime_byok_wins_when_key_present():
    settings = SimpleNamespace(llm_api_key="env-key", llm_base_url="https://env.example/v1", llm_model="env-model")
    rt = runtime_from(settings, LLMOverride(api_key="sk-user", base_url="http://localhost/v1", model="llama3.2"))
    assert rt.api_key == "sk-user"
    assert rt.base_url == "http://localhost/v1"
    assert rt.resolved_model == "openai/llama3.2"
    assert rt.enabled is True


def test_runtime_falls_back_to_env_without_byok_key():
    settings = SimpleNamespace(llm_api_key="env-key", llm_base_url="", llm_model="gpt-4.1-mini")
    rt = runtime_from(settings, LLMOverride(api_key="", model="ignored"))
    assert rt.api_key == "env-key"
    assert rt.resolved_model == "gpt-4.1-mini"


def test_public_status_never_includes_secrets():
    settings = SimpleNamespace(
        llm_api_key="sk-secret-should-not-leak",
        llm_base_url="https://example.invalid/v1",
        llm_model="gpt-4.1-mini",
    )
    payload = llm_public_status(settings)
    blob = str(payload).lower()
    assert "sk-secret" not in blob
    assert "apikey" not in blob
    assert payload["router"] == "litellm"
    assert payload["envConfigured"] is True
    assert payload["baseUrlSet"] is True
    assert payload["byok"] is True
    assert payload["extractMode"] == "rules"
    assert payload["explainMode"] == "shap+litellm"


def test_extract_claim_rules_without_key():
    settings = SimpleNamespace(llm_api_key="", llm_base_url="", llm_model="gpt-4.1-mini")
    claim, engine = extract_claim(FIXTURE, 18, settings=settings)
    assert engine == "rules"
    assert claim.topic == "kyc.adult"


def test_extract_stays_rules_when_llm_extract_off_even_with_env_key():
    settings = SimpleNamespace(
        llm_api_key="sk-would-call-network",
        llm_base_url="https://example.invalid/v1",
        llm_model="gpt-4.1-mini",
        llm_extract=False,
    )
    claim, engine = extract_claim(FIXTURE, 18, settings=settings)
    assert engine == "rules"
    assert claim.topic == "kyc.adult"
