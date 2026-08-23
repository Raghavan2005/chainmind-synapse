import { useEffect, useMemo, useState } from "react";

const ENV_API = import.meta.env.VITE_API_BASE || "";
const BYOK_KEY = "synapse.byok.v1";

function shortHex(value) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function Chip({ kind, children }) {
  return <span className={`chip ${kind || ""}`}>{children}</span>;
}

function loadByok() {
  try {
    const raw = localStorage.getItem(BYOK_KEY);
    if (!raw) return { apiKey: "", baseUrl: "", model: "gpt-4.1-mini", apiBase: ENV_API };
    const parsed = JSON.parse(raw);
    return {
      apiKey: parsed.apiKey || "",
      baseUrl: parsed.baseUrl || "",
      model: parsed.model || "gpt-4.1-mini",
      apiBase: parsed.apiBase ?? ENV_API,
    };
  } catch {
    return { apiKey: "", baseUrl: "", model: "gpt-4.1-mini", apiBase: ENV_API };
  }
}

export default function App() {
  const initial = window.location.hash.replace("#/", "") || localStorage.getItem("demoSubject") || "";
  const [subject, setSubject] = useState(initial);
  const [health, setHealth] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [byok, setByok] = useState(loadByok);
  const [byokStatus, setByokStatus] = useState("");
  const [byokBusy, setByokBusy] = useState("");

  const api = (byok.apiBase || ENV_API).replace(/\/$/, "");

  async function load(next = subject) {
    if (!next) return;
    setLoading(true);
    setError("");
    window.location.hash = `/${next}`;
    try {
      const [h, i] = await Promise.all([
        fetch(`${api}/v1/health`).then((r) => r.json()),
        fetch(`${api}/v1/identity/${next}`).then(async (r) => {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error(await r.text());
          return r.json();
        }),
      ]);
      setHealth(h);
      setIdentity(i);
      if (i?.commit?.commitId) {
        const exp = await fetch(`${api}/v1/identity/${next}/explanation`);
        setExplanation(exp.ok ? await exp.json() : null);
      } else {
        setExplanation(null);
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(subject);
    const id = setInterval(() => load(subject), 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, api]);

  const explorer = (tx) => (tx ? `https://sepolia.etherscan.io/tx/${tx}` : null);
  const banner = useMemo(() => {
    if (error) return "error";
    if (loading && !identity) return "loading";
    if (!identity) return "empty";
    if (identity.verdict === "conflict") return "conflict";
    if (identity.pendingOnChain) return "pending";
    return "ok";
  }, [error, loading, identity]);

  function saveByok() {
    localStorage.setItem(BYOK_KEY, JSON.stringify(byok));
    setByokStatus("Saved in this browser only. The server does not store the key.");
  }

  function byokBody() {
    return {
      apiKey: byok.apiKey,
      baseUrl: byok.baseUrl,
      model: byok.model,
    };
  }

  async function testConnection() {
    setByokBusy("test");
    setByokStatus("");
    try {
      const res = await fetch(`${api}/v1/llm/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(byokBody()),
      });
      const data = await res.json();
      if (data.ok) {
        setByokStatus(`LiteLLM ok · ${data.model}`);
      } else {
        setByokStatus(data.error || "Test failed");
      }
    } catch (err) {
      setByokStatus(err.message || String(err));
    } finally {
      setByokBusy("");
    }
  }

  async function generateExplanation() {
    if (!subject) {
      setByokStatus("Enter a subject first.");
      return;
    }
    setByokBusy("explain");
    setByokStatus("");
    try {
      const res = await fetch(`${api}/v1/identity/${subject}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(byokBody()),
      });
      if (res.status === 404) {
        setByokStatus("No overlay/commit for this subject. Ingest first.");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setExplanation(data);
      setByokStatus(`Explanation ready · engine ${data.engine || "—"}`);
    } catch (err) {
      setByokStatus(err.message || String(err));
    } finally {
      setByokBusy("");
    }
  }

  const llm = health?.llm;
  const llmChip = llm?.envConfigured ? "ok" : "warn";

  return (
    <div className="floor">
      <header className="rail">
        <p className="kicker">Synapse watch floor</p>
        <h1>Claims, not vibes.</h1>
        <label>
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="0x…"
            aria-label="Subject address"
          />
        </label>
        <button type="button" onClick={() => load(subject)}>Reload</button>
        <div className="chips">
          {[
            ["11155111", "Sepolia", health?.sepoliaHead ?? health?.heads?.["11155111"]],
            ["1301", "Unichain", health?.unichainSepoliaHead ?? health?.heads?.["1301"]],
            ["84532", "Base", health?.heads?.["84532"]],
            ["11155420", "OP", health?.heads?.["11155420"]],
            ["763373", "Ink", health?.heads?.["763373"]],
            ["919", "Mode", health?.heads?.["919"]],
            ["1946", "Minato", health?.heads?.["1946"]],
          ].map(([id, label, head]) => (
            <Chip key={id} kind={health?.rpcErrors?.[id] ? "warn" : "ok"}>
              {label} {head ?? "—"}
            </Chip>
          ))}
          <Chip>acc {health?.modelAccuracy ? health.modelAccuracy.toFixed(2) : "—"}</Chip>
          <Chip kind={llmChip}>
            LiteLLM {llm?.envConfigured ? "env set" : "env unset"}
            {llm?.model ? ` · ${llm.model}` : ""}
          </Chip>
          {explanation?.engine && <Chip kind="ok">explain {explanation.engine}</Chip>}
        </div>
        {identity?.commit?.txHash && (
          <a href={explorer(identity.commit.txHash)} target="_blank" rel="noreferrer">
            Open Sepolia tx {shortHex(identity.commit.txHash)}
          </a>
        )}

        <details className="byok">
          <summary>LiteLLM / BYOK</summary>
          <p className="byok-warn">
            The API key stays in this browser (localStorage). It is sent only on Test and
            Generate explanation. GET polls never include it. The server does not persist keys.
          </p>
          <div className="byok-grid">
            <label>
              Synapse API base
              <input
                value={byok.apiBase}
                onChange={(e) => setByok({ ...byok, apiBase: e.target.value })}
                placeholder="http://127.0.0.1:8000 or leave empty for same-origin"
                aria-label="Synapse API base URL"
              />
            </label>
            <label>
              LLM base URL
              <input
                value={byok.baseUrl}
                onChange={(e) => setByok({ ...byok, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1 or Ollama / Groq / Together"
                aria-label="LLM base URL"
              />
            </label>
            <label>
              Model
              <input
                value={byok.model}
                onChange={(e) => setByok({ ...byok, model: e.target.value })}
                placeholder="gpt-4.1-mini or openai/llama3.2"
                aria-label="LLM model"
              />
            </label>
            <label>
              API key
              <input
                type="password"
                autoComplete="off"
                value={byok.apiKey}
                onChange={(e) => setByok({ ...byok, apiKey: e.target.value })}
                placeholder="sk-… (never committed)"
                aria-label="LLM API key"
              />
            </label>
          </div>
          <div className="byok-actions">
            <button type="button" className="ghost" onClick={saveByok}>
              Save locally
            </button>
            <button type="button" onClick={testConnection} disabled={byokBusy === "test"}>
              {byokBusy === "test" ? "Testing…" : "Test connection"}
            </button>
            <button type="button" onClick={generateExplanation} disabled={byokBusy === "explain"}>
              {byokBusy === "explain" ? "Generating…" : "Generate explanation"}
            </button>
          </div>
          {byokStatus && <p className="byok-status" role="status">{byokStatus}</p>}
        </details>
      </header>

      {banner === "loading" && <div className="skel" aria-hidden="true" />}
      {banner === "empty" && (
        <p className="empty">No claims for this subject on watched chains.</p>
      )}
      {banner === "error" && (
        <div className="banner danger">
          <p>{error}</p>
          {health?.degraded && <p>Degraded chains: {JSON.stringify(health.rpcErrors)}</p>}
          <button type="button" onClick={() => load(subject)}>Retry</button>
        </div>
      )}
      {identity && (
        <>
          {identity.verdict === "conflict" && (
            <div className="banner danger">
              Conflict on {identity.conflicts?.[0]?.topic}. Both sides stay listed.
            </div>
          )}
          {identity.pendingOnChain && <div className="banner warn">overlay not mined</div>}
          {identity.verdict !== "conflict" && !identity.pendingOnChain && (
            <div className="banner ok">{identity.verdict}</div>
          )}
          <main className="grid">
            <section>
              <h2>Claims</h2>
              <ul>
                {identity.claims?.map((c) => (
                  <li key={c.claimId} className={c.revoked ? "revoked" : ""}>
                    <Chip>{c.chainId}</Chip> {c.topic} {c.polarity > 0 ? "+1" : "−1"} · p {c.pCredible?.toFixed(2)}
                    <div className="mute">{shortHex(c.issuer)} · {shortHex(c.txHash)}</div>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2>Fusion</h2>
              <p className="score">{identity.scoreBps} <span>bps</span></p>
              {identity.topics?.map((t) => (
                <div key={t.topic} className="bar">
                  <p>{t.topic} · {t.verdict} · K {t.conflictK?.toFixed(2)}</p>
                  <div className="stack">
                    <i style={{ width: `${t.opinion.b * 100}%` }} className="b" />
                    <i style={{ width: `${t.opinion.d * 100}%` }} className="d" />
                    <i style={{ width: `${t.opinion.u * 100}%` }} className="u" />
                  </div>
                </div>
              ))}
              {explanation && (
                <dl>
                  <dt>Summary · {explanation.engine || "—"}</dt>
                  <dd>{explanation.summary}</dd>
                  {explanation.reasons?.map((r) => (
                    <div key={r.feature}>
                      <dt>{r.feature} · {r.shap}</dt>
                      <dd>{r.text}</dd>
                    </div>
                  ))}
                  {explanation.caveats?.map((c) => (
                    <dd className="mute" key={c}>{c}</dd>
                  ))}
                </dl>
              )}
            </section>
          </main>
        </>
      )}
    </div>
  );
}
