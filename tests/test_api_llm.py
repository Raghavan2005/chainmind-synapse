from types import SimpleNamespace

from fastapi.testclient import TestClient

from services.api import main
from services.normalize.schema import Explanation, Reason
from services.score.predict import Scorer


SECRET = "sk-secret-should-not-leak"


def _client(monkeypatch) -> TestClient:
    monkeypatch.setattr(main, "_heads", lambda: ({11155111: 1, 1301: 1, 84532: 1}, {}, False))
    monkeypatch.setattr(main.settings, "llm_api_key", SECRET)
    monkeypatch.setattr(main.settings, "llm_base_url", "https://example.invalid/v1")
    monkeypatch.setattr(main.settings, "llm_model", "gpt-4.1-mini")
    return TestClient(main.app)


def _assert_no_secrets(payload) -> None:
    blob = str(payload).lower()
    assert SECRET.lower() not in blob
    assert "apikey" not in blob
    assert "api_key" not in blob


def test_health_llm_payload_has_no_secrets(monkeypatch):
    client = _client(monkeypatch)
    res = client.get("/v1/health")
    body = res.json()
    _assert_no_secrets(body)
    assert body["llm"]["router"] == "litellm"
    assert body["llm"]["envConfigured"] is True
    assert body["llm"]["baseUrlSet"] is True
    assert body["llm"]["byok"] is True
    assert body["llm"]["model"] == "gpt-4.1-mini"
    assert body["llm"]["extractMode"] == "rules"
    assert body["llm"]["explainMode"] == "shap+litellm"


def test_get_llm_same_public_config(monkeypatch):
    client = _client(monkeypatch)
    res = client.get("/v1/llm")
    body = res.json()
    _assert_no_secrets(body)
    assert body["router"] == "litellm"
    assert body["byok"] is True


def test_llm_test_without_key_does_not_call_network(monkeypatch):
    monkeypatch.setattr(main.settings, "llm_api_key", "")
    monkeypatch.setattr(main.settings, "llm_base_url", "")
    called = {"n": 0}

    def boom(*_a, **_k):
        called["n"] += 1
        raise AssertionError("must not reach LiteLLM without a key")

    monkeypatch.setattr("services.common.llm.complete_structured", boom)
    client = TestClient(main.app)
    res = client.post("/v1/llm/test", json={})
    body = res.json()
    assert body["ok"] is False
    assert body["error"] == "no api key"
    _assert_no_secrets(body)
    assert called["n"] == 0


def test_llm_test_mocked_ok(monkeypatch):
    monkeypatch.setattr(main.settings, "llm_api_key", "")

    def fake_ping(runtime):
        assert runtime.api_key == "sk-user"
        return {"ok": True, "model": runtime.resolved_model, "error": None}

    monkeypatch.setattr(main, "ping", fake_ping)
    client = TestClient(main.app)
    res = client.post(
        "/v1/llm/test",
        json={"apiKey": "sk-user", "baseUrl": "http://localhost:11434/v1", "model": "llama3.2"},
    )
    body = res.json()
    assert body["ok"] is True
    assert body["model"] == "openai/llama3.2"
    _assert_no_secrets(body)


def test_explain_post_404_without_overlay(monkeypatch):
    monkeypatch.setattr(main, "_overlay", lambda _subject: None)
    monkeypatch.setattr(main, "scorer", SimpleNamespace())
    client = TestClient(main.app)
    res = client.post("/v1/identity/0x" + "ab" * 20 + "/explain", json={})
    assert res.status_code == 404
    _assert_no_secrets(res.json())


def test_explain_post_template_without_key(monkeypatch, tmp_path):
    subject = "0x" + "ab" * 20
    overlay = {
        "subject": subject,
        "subjectDid": f"did:ethr:sepolia:{subject}",
        "verdict": "supported",
        "confidence": 0.8,
        "scoreBps": 8000,
        "claims": [],
        "conflicts": [],
        "topics": [],
        "commit": {"commitId": "0x" + "cc" * 32},
        "vectors": {"0x1": [0.0] * 12},
    }
    monkeypatch.setattr(main, "_overlay", lambda _s: overlay)
    monkeypatch.setattr(main.settings, "explanations_dir", tmp_path)
    monkeypatch.setattr(main.settings, "llm_api_key", "")
    monkeypatch.setattr(main, "scorer", Scorer(main.settings.model_path))
    client = TestClient(main.app)
    res = client.post(f"/v1/identity/{subject}/explain", json={})
    assert res.status_code == 200
    body = res.json()
    _assert_no_secrets(body)
    assert body["engine"] == "shap+template"
    assert body["commitId"].startswith("0x")
    assert len(body["reasons"]) >= 2


def test_explain_post_mocked_litellm(monkeypatch, tmp_path):
    subject = "0x" + "ab" * 20
    commit = "0x" + "dd" * 32
    overlay = {
        "subject": subject,
        "verdict": "conflict",
        "confidence": 0.41,
        "scoreBps": 4100,
        "claims": [],
        "conflicts": [{"type": "multi-source"}],
        "topics": [],
        "commit": {"commitId": commit},
        "vectors": {"0x1": [0.0] * 12},
    }

    def fake_llm(*_a, **_k):
        return Explanation(
            commitId=commit,
            summary="Two issuers disagree.",
            reasons=[
                Reason(feature="conflict_count", shap=0.18, text="Opposite polarity."),
                Reason(feature="issuer_prior", shap=-0.09, text="Weak prior."),
            ],
            caveats=["LLM did not produce the score."],
            engine="shap+litellm",
            conflictType="multi-source",
            promptVersion="deadbeefdeadbeef",
        )

    monkeypatch.setattr(main, "_overlay", lambda _s: overlay)
    monkeypatch.setattr(main.settings, "explanations_dir", tmp_path)
    monkeypatch.setattr("services.pipeline.llm_explanation", fake_llm)
    monkeypatch.setattr(main, "scorer", Scorer(main.settings.model_path))
    client = TestClient(main.app)
    res = client.post(
        f"/v1/identity/{subject}/explain",
        json={"apiKey": "sk-user", "baseUrl": "", "model": "gpt-4.1-mini"},
    )
    assert res.status_code == 200
    body = res.json()
    _assert_no_secrets(body)
    assert body["engine"] == "shap+litellm"
    assert "apiKey" not in body
