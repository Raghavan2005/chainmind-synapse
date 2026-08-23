import { useEffect, useMemo, useState } from "react";

const ENV_API = import.meta.env.VITE_API_BASE || "";
const BYOK_KEY = "synapse.byok.v1";
const DEMO_SUBJECT = "0x5cCBd2Ef7DBC744AbFF179F5C5B8180B182B1221";
const DEFAULT_API = "https://fmngtnpp5e.us-east-1.awsapprunner.com";

const CHAINS = [
  { id: "11155111", label: "Sepolia", pair: "FR-01 settlement", explorer: "https://sepolia.etherscan.io" },
  { id: "1301", label: "Unichain", pair: "FR-01 source", explorer: "https://sepolia.uniscan.xyz" },
  { id: "84532", label: "Base", pair: "watched L2", explorer: "https://sepolia.basescan.org" },
  { id: "11155420", label: "OP", pair: "watched L2", explorer: "https://sepolia-optimism.etherscan.io" },
  { id: "763373", label: "Ink", pair: "watched L2", explorer: "https://explorer-sepolia.inkonchain.com" },
  { id: "919", label: "Mode", pair: "watched L2", explorer: "https://sepolia.explorer.mode.network" },
  { id: "1946", label: "Minato", pair: "watched L2", explorer: "https://soneium-minato.blockscout.com" },
];

const CONTRACT_KEY = {
  11155111: "claimSourceSepolia",
  1301: "claimSourceUnichainSepolia",
  84532: "claimSourceBaseSepolia",
  11155420: "claimSourceOpSepolia",
  763373: "claimSourceInkSepolia",
  919: "claimSourceModeSepolia",
  1946: "claimSourceSoneiumMinato",
};

const PIPE = [
  { n: "01", title: "Ingest", body: "Watch ClaimPosted / ClaimRevoked on Sepolia plus Unichain and five Superchain L2s. Rebuild overlay from logs. No Graph, no Alchemy Notify." },
  { n: "02", title: "Score", body: "HistGradientBoosting emits pCredible per claim. TrustJudge never writes scoreBps. GET /v1/identity does not call a model vendor." },
  { n: "03", title: "Fuse", body: "Each claim is a (belief, disbelief, uncertainty) opinion. Independent evidence stacks; echoes average. High K revises source trust." },
  { n: "04", title: "Commit", body: "IdentityState on Sepolia stores keccak of the preimage. Overlay JSON is a cache. Replay rebuilds the floor. Ledger is the record." },
];

const FEATURES = [
  {
    title: "Watch every claim source",
    body: "Ingest reads ClaimPosted / ClaimRevoked on Sepolia plus Unichain and five Superchain L2s. No Graph, no Alchemy Notify, no Passport wrap.",
  },
  {
    title: "Score is sklearn, not an LLM integer",
    body: "HistGradientBoosting emits pCredible. TrustJudge never writes scoreBps. GET /v1/identity does not call a model vendor.",
  },
  {
    title: "Conflicts use Jøsang fusion",
    body: "Each claim becomes a (belief, disbelief, uncertainty) opinion. Independent evidence fuses cumulatively; echoes average. High K revises source trust.",
  },
  {
    title: "The ledger is the record",
    body: "IdentityState on Sepolia stores keccak of the preimage. Overlay JSON is a cache. Replay rebuilds from logs. No hosted database as source of truth.",
  },
  {
    title: "Explain with SHAP, narrate if you want",
    body: "TreeExplainer cites feature names. Prose is optional LiteLLM (operator env or browser BYOK). Keys stay in localStorage.",
  },
  {
    title: "Why this exists",
    body: "Nomis / Trusta / Passport score wallets or humanity. They do not reconcile two live credentials that disagree. That remaining conjunction is the product.",
  },
];

const AUDIENCE = [
  { who: "Judges / reviewers", why: "See both sides of a topic, the fused bps, and the Sepolia tx. The losing claim is never hidden." },
  { who: "Operators", why: "Health chips per chain, degraded RPC names, overlay-vs-mined status. Replay stays bearer-gated on the API." },
  { who: "Integrators", why: "GET /v1/identity/{subject} returns verdict, scoreBps, claims, topics, commit. No SDK required." },
  { who: "Issuers", why: "Post or revoke on any watched ClaimSource. The floor notices polarity fights without a Graph subscription." },
];

const CONTRAST = [
  { them: "Gitcoin Passport", does: "Humanity / sybil score for one wallet.", synapse: "Does not wrap stamps. Reconciles two live credentials that disagree." },
  { them: "Nomis / Trusta", does: "Credit-style wallet score from history.", synapse: "Does not rescore wallets. Scores claim credibility, then fuses the fight." },
  { them: "A single L2 contract", does: "Sees only its own chain’s logs.", synapse: "Watches seven sources; settlement hash lives on Sepolia." },
  { them: "An LLM judge", does: "Emits a vibe integer in prose.", synapse: "Official score is sklearn + Jøsang. Prose is optional overlay." },
];

const GLOSSARY = [
  { term: "subject", def: "EOA (or did:ethr method-specific-id) the claims are about. One route: /#/{subject}." },
  { term: "polarity", def: "+1 supports the topic, −1 denies it. Opposite signs on one topic is a conflict." },
  { term: "pCredible", def: "sklearn probability this claim is currently credible. Not the fused official score." },
  { term: "ω (b, d, u)", def: "Jøsang opinion: belief, disbelief, uncertainty. Stacked bar uses those three, plus base rate a." },
  { term: "scoreBps", def: "Fused expectation × 10 000. Written on-chain when a writer key is present." },
  { term: "stateHash", def: "keccak of the published preimage. Overlay JSON is a cache of that preimage, not the source of truth." },
  { term: "K", def: "Conflict mass. High K revises source trust so a hostile echo chamber does not dominate." },
  { term: "pendingOnChain", def: "Overlay exists but this host has no operator key, so the latest hash may not be mined yet. History still reads Sepolia." },
];

function shortHex(value) {
  if (!value) return "—";
  const v = String(value);
  if (v.length < 14) return v;
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

function with0x(value) {
  if (!value) return "";
  const v = String(value);
  return v.startsWith("0x") ? v : `0x${v}`;
}

function Chip({ kind, children }) {
  return <span className={`chip ${kind || ""}`}>{children}</span>;
}

function Copy({ value, label }) {
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      className="ghost compact"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      aria-label={`Copy ${label || "value"}`}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function OpinionBar({ opinion, compact }) {
  if (!opinion) return null;
  return (
    <div className={`stack ${compact ? "compact" : ""}`} aria-hidden="true">
      <i style={{ width: `${(opinion.b || 0) * 100}%` }} className="b" />
      <i style={{ width: `${(opinion.d || 0) * 100}%` }} className="d" />
      <i style={{ width: `${(opinion.u || 0) * 100}%` }} className="u" />
    </div>
  );
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

function chainMeta(chainId) {
  return CHAINS.find((c) => c.id === String(chainId));
}

function explorerTx(chainId, tx) {
  if (!tx) return null;
  const meta = chainMeta(chainId);
  const base = meta?.explorer || "https://sepolia.etherscan.io";
  return `${base}/tx/${with0x(tx)}`;
}

function explorerAddr(chainId, addr) {
  if (!addr) return null;
  const meta = chainMeta(chainId);
  const base = meta?.explorer || "https://sepolia.etherscan.io";
  return `${base}/address/${addr}`;
}

function when(ts) {
  if (!ts) return "—";
  const n = Number(ts);
  const ms = n < 1e12 ? n * 1000 : n;
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function subjectFromLocation() {
  const fromHash = window.location.hash.replace(/^#\/?/, "").trim();
  if (fromHash && !fromHash.includes("=")) return fromHash;
  const q = new URLSearchParams(window.location.search).get("subject");
  if (q) return q;
  return localStorage.getItem("demoSubject") || DEMO_SUBJECT;
}

function jump(id) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export default function App() {
  const initial = subjectFromLocation();
  const [subject, setSubject] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [health, setHealth] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [history, setHistory] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [byok, setByok] = useState(loadByok);
  const [byokStatus, setByokStatus] = useState("");
  const [byokBusy, setByokBusy] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [polledAt, setPolledAt] = useState("");
  const [copiedCurl, setCopiedCurl] = useState("");

  const api = (byok.apiBase || ENV_API || DEFAULT_API).replace(/\/$/, "");

  async function load(next = subject) {
    if (!api) {
      setError("Set Synapse API base (LiteLLM / BYOK) or rebuild with VITE_API_BASE.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const h = await fetch(`${api}/v1/health`).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      });
      setHealth(h);
      setPolledAt(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
      if (!next) {
        setIdentity(null);
        setHistory(null);
        setExplanation(null);
        return;
      }
      window.location.hash = `/${next}`;
      const [iRes, histRes] = await Promise.all([
        fetch(`${api}/v1/identity/${next}`),
        fetch(`${api}/v1/identity/${next}/history`),
      ]);
      const i = iRes.status === 404 ? null : iRes.ok ? await iRes.json() : await Promise.reject(new Error(await iRes.text()));
      const hist = histRes.ok ? await histRes.json() : null;
      setIdentity(i);
      setHistory(hist);
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
    const id = setInterval(() => load(subject), 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, api]);

  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.replace(/^#\/?/, "").trim();
      if (next && next !== subject) {
        setDraft(next);
        setSubject(next);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [subject]);

  const banner = useMemo(() => {
    if (error) return "error";
    if (loading && !identity && subject) return "loading";
    if (subject && !identity && !loading) return "empty";
    if (identity?.verdict === "conflict") return "conflict";
    if (identity?.pendingOnChain) return "pending";
    if (identity) return "ok";
    return "idle";
  }, [error, loading, identity, subject]);

  function applySubject(next) {
    const value = (next || draft).trim();
    if (!value) return;
    localStorage.setItem("demoSubject", value);
    setDraft(value);
    setSubject(value);
  }

  function saveByok() {
    localStorage.setItem(BYOK_KEY, JSON.stringify(byok));
    setByokStatus("Saved in this browser only. The server does not store the key.");
  }

  function byokBody() {
    return { apiKey: byok.apiKey, baseUrl: byok.baseUrl, model: byok.model };
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
      setByokStatus(data.ok ? `LiteLLM ok · ${data.model}` : data.error || "Test failed");
    } catch (err) {
      setByokStatus(err.message || String(err));
    } finally {
      setByokBusy("");
    }
  }

  async function generateExplanation() {
    if (!subject) {
      setByokStatus("Load a subject first.");
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

  async function copyCurl(id, text) {
    await navigator.clipboard.writeText(text);
    setCopiedCurl(id);
    setTimeout(() => setCopiedCurl(""), 1200);
  }

  const llm = health?.llm;
  const contracts = health?.contracts || {};
  const commitTx = explorerTx(identity?.commit?.chainId || 11155111, identity?.commit?.txHash);
  const topicConflicts = new Set((identity?.conflicts || []).map((c) => c.topic));
  const curls = {
    health: `curl -s ${api}/v1/health`,
    identity: `curl -s ${api}/v1/identity/${subject || DEMO_SUBJECT}`,
    history: `curl -s ${api}/v1/identity/${subject || DEMO_SUBJECT}/history`,
  };

  return (
    <div className="floor">
      <a className="skip" href="#watch">Skip to watch floor</a>
      <header className="mast">
        <div className="brand">
          <span className="mark" aria-hidden="true">◎</span>
          <div>
            <strong>ChainMind Synapse</strong>
            <span>Watch floor · 23 Aug 2026 · conflicting credentials, one verdict</span>
          </div>
        </div>
        <nav className="mast-links" aria-label="On this page">
          <button type="button" className="textlink" onClick={() => jump("how")}>How</button>
          <button type="button" className="textlink" onClick={() => jump("why")}>Why</button>
          <button type="button" className="textlink" onClick={() => jump("watch")}>Watch</button>
          <button type="button" className="textlink" onClick={() => jump("api")}>API</button>
          <a href="https://github.com/Raghavan2005/chainmind-synapse">GitHub</a>
          <a href={`${api}/v1/health`}>API health</a>
          <a href="https://github.com/Raghavan2005/chainmind-synapse/blob/master/instructions/INDEX.html">Spec</a>
        </nav>
      </header>

      <section className="hero" id="how">
        <p className="kicker">Identity reconciliation · testnet demo</p>
        <h1>Two chains can disagree. This layer says which claim still holds, and writes the hash on-chain.</h1>
        <p className="lede">
          Credentials expire, get revoked, and contradict each other across L2s. A contract on
          Unichain cannot see a revoke on Sepolia. Synapse ingests both, scores credibility with
          a classical model, fuses the fight with subjective logic, and commits{" "}
          <code>stateHash</code> to Sepolia. Judges: this is not Passport, Trusta, or Nomis.
        </p>
        <ol className="howto">
          <li>
            <strong>1 · Load the fixture</strong>
            <span>The demo subject is already on watched ClaimSources. Overlay rebuilds from live logs every few seconds.</span>
          </li>
          <li>
            <strong>2 · Read claims + fusion</strong>
            <span>Opposite polarity on one topic is a conflict. Bars are belief / disbelief / uncertainty, not a vibe meter.</span>
          </li>
          <li>
            <strong>3 · Verify the commit</strong>
            <span>Open the Sepolia tx or GET history. Hash is keccak of the published preimage. LLM never emitted the score.</span>
          </li>
        </ol>
        <div className="hero-actions">
          <button type="button" onClick={() => { applySubject(DEMO_SUBJECT); jump("watch"); }}>
            Load demo subject
          </button>
          <a className="as-btn ghost" href={`${api}/v1/identity/${DEMO_SUBJECT}`}>
            Raw GET JSON
          </a>
          <button type="button" className="ghost" onClick={() => jump("why")}>
            Why this exists
          </button>
        </div>
      </section>

      <ol className="pipe" aria-label="Pipeline">
        {PIPE.map((step) => (
          <li key={step.n}>
            <span className="pipe-n">{step.n}</span>
            <strong>{step.title}</strong>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>

      <section className="why" id="why">
        <div>
          <p className="kicker">Who it is for</p>
          <h2>Use it when two live credentials disagree and a wallet score is the wrong tool.</h2>
          <ul className="audience">
            {AUDIENCE.map((row) => (
              <li key={row.who}>
                <strong>{row.who}</strong>
                <span>{row.why}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="kicker">Not a wrap</p>
          <h2>What adjacent products already do — and what they leave open.</h2>
          <table className="contrast">
            <thead>
              <tr>
                <th>Product</th>
                <th>Already does</th>
                <th>Synapse instead</th>
              </tr>
            </thead>
            <tbody>
              {CONTRAST.map((row) => (
                <tr key={row.them}>
                  <td>{row.them}</td>
                  <td>{row.does}</td>
                  <td>{row.synapse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="features" aria-label="What ships">
        {FEATURES.map((f) => (
          <article key={f.title}>
            <h2>{f.title}</h2>
            <p>{f.body}</p>
          </article>
        ))}
      </section>

      <section className="rail" id="watch">
        <form
          className="lookup"
          onSubmit={(e) => {
            e.preventDefault();
            applySubject(draft);
          }}
        >
          <label htmlFor="subject">Subject (EOA)</label>
          <div className="lookup-row">
            <input
              id="subject"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0x… or paste did:ethr method-specific-id"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit">Read identity</button>
            <button type="button" className="ghost" onClick={() => load(subject)}>
              Reload
            </button>
          </div>
          <p className="field-help">
            Polls every 8s. Demo fixture {shortHex(DEMO_SUBJECT)}.
            {polledAt ? ` Last health ${polledAt}.` : ""}
          </p>
        </form>

        <div className="chips" aria-label="Watched chains">
          {CHAINS.map((c) => {
            const head = health?.heads?.[c.id];
            const err = health?.rpcErrors?.[c.id];
            return (
              <Chip key={c.id} kind={err ? "warn" : head ? "ok" : ""}>
                {c.label} {err ? "rpc" : head ?? "—"}
              </Chip>
            );
          })}
          <Chip>acc {health?.modelAccuracy != null ? health.modelAccuracy.toFixed(2) : "—"}</Chip>
          <Chip>F1 {health?.modelF1 != null ? health.modelF1.toFixed(2) : "—"}</Chip>
          <Chip>Brier {health?.brier != null ? health.brier.toFixed(3) : "—"}</Chip>
          <Chip kind={health?.ok ? "ok" : health?.degraded ? "warn" : ""}>
            {health?.ok ? "API ok" : health ? "degraded" : "API silent"}
          </Chip>
          <Chip kind={llm?.envConfigured ? "ok" : "warn"}>
            LiteLLM {llm?.envConfigured ? "env set" : "env unset"}
            {llm?.model ? ` · ${llm.model}` : ""}
          </Chip>
          {explanation?.engine && <Chip kind="ok">explain {explanation.engine}</Chip>}
        </div>

        <details className="byok">
          <summary>LiteLLM / BYOK and API base</summary>
          <p className="byok-warn">
            Key stays in this browser. Sent only on Test and Generate explanation. GET polls never
            include it. Canonical UI is chainmind-synapse.vercel.app — a second Hobby alias still
            talks to the same App Runner. Replay from logs is bearer-gated on the API, not this panel.
          </p>
          <div className="byok-grid">
            <label>
              Synapse API base
              <input
                value={byok.apiBase}
                onChange={(e) => setByok({ ...byok, apiBase: e.target.value })}
                placeholder={ENV_API || DEFAULT_API}
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
                placeholder="gpt-4.1-mini"
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
      </section>

      {banner === "loading" && <div className="skel" aria-hidden="true" />}
      {banner === "idle" && (
        <p className="empty">
          No subject loaded. Use the demo fixture or paste an address that posted on a watched ClaimSource.
        </p>
      )}
      {banner === "empty" && (
        <div className="banner warn">
          <p>No claims for this subject on watched chains.</p>
          <button type="button" className="ghost" onClick={() => applySubject(DEMO_SUBJECT)}>
            Load demo subject
          </button>
        </div>
      )}
      {banner === "error" && (
        <div className="banner danger">
          <p>{error}</p>
          {health?.degraded && (
            <p className="mute">Degraded: {JSON.stringify(health.rpcErrors)}</p>
          )}
          <button type="button" onClick={() => load(subject)}>Retry</button>
        </div>
      )}
      {identity && (
        <>
          {identity.verdict === "conflict" && (
            <div className="banner danger">
              Conflict on {identity.conflicts?.[0]?.topic || "a topic"}. Both sides stay listed.
              {identity.conflicts?.[0]?.note ? ` ${identity.conflicts[0].note}` : ""}
            </div>
          )}
          {identity.pendingOnChain && (
            <div className="banner warn">
              Overlay not mined on this host (no operator key on App Runner). History still reads the last Sepolia commit.
            </div>
          )}
          {identity.verdict !== "conflict" && !identity.pendingOnChain && (
            <div className="banner ok">Verdict {identity.verdict} · {identity.scoreBps} bps</div>
          )}

          <div className="statstrip">
            <div>
              <p className="stat-label">Verdict</p>
              <p className="stat-value">{identity.verdict}</p>
            </div>
            <div>
              <p className="stat-label">Score</p>
              <p className="stat-value mono">{identity.scoreBps} <span>bps</span></p>
            </div>
            <div>
              <p className="stat-label">Confidence</p>
              <p className="stat-value mono">{identity.confidence?.toFixed(3) ?? "—"}</p>
            </div>
            <div>
              <p className="stat-label">Claims</p>
              <p className="stat-value mono">{identity.claims?.length ?? 0}</p>
            </div>
            <div>
              <p className="stat-label">On-chain history</p>
              <p className="stat-value mono">{history?.count ?? "—"}</p>
            </div>
          </div>
          <p className="legend" aria-hidden="true">
            <span><i className="swatch b" /> belief</span>
            <span><i className="swatch d" /> disbelief</span>
            <span><i className="swatch u" /> uncertainty</span>
            <span>Polarity +1 supports the topic · −1 denies it</span>
          </p>

          <main className="grid">
            <section>
              <h2>Claims</h2>
              <p className="section-help">
                One row per live bulletin-board post. Polarity +1 supports the topic, −1 denies it.
                pCredible is the sklearn probability the claim is currently credible — not the fused score.
              </p>
              <ul>
                {identity.claims?.map((c) => (
                  <li key={c.claimId} className={`${c.revoked ? "revoked" : ""} ${topicConflicts.has(c.topic) ? "fought" : ""}`}>
                    <div className="claim-top">
                      <Chip>{chainMeta(c.chainId)?.label || c.chainId}</Chip>
                      <strong>{c.topic}</strong>
                      <Chip kind={c.polarity > 0 ? "ok" : "warn"}>{c.polarity > 0 ? "+1 support" : "−1 deny"}</Chip>
                      {c.revoked && <Chip kind="warn">revoked</Chip>}
                      {topicConflicts.has(c.topic) && <Chip kind="warn">in conflict</Chip>}
                    </div>
                    <OpinionBar opinion={c.opinion} compact />
                    <p>
                      pCredible {c.pCredible?.toFixed(2) ?? "—"}
                      {c.opinion ? ` · ω b ${c.opinion.b.toFixed(2)} d ${c.opinion.d.toFixed(2)} u ${c.opinion.u.toFixed(2)}` : ""}
                    </p>
                    <div className="mute row-meta">
                      <span>issuer {shortHex(c.issuer)}</span>
                      <Copy value={c.issuer} label="issuer" />
                      <span>claim {shortHex(c.claimId)}</span>
                      <Copy value={c.claimId} label="claimId" />
                      {c.txHash && (
                        <a href={explorerTx(c.chainId, c.txHash)} target="_blank" rel="noreferrer">
                          Open source tx {shortHex(with0x(c.txHash))}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2>Fusion</h2>
              <p className="section-help">
                Stacked bar is belief (copper), disbelief (brick), uncertainty (mute). The large number
                is fused expectation in basis points — written on-chain when the writer is present.
              </p>
              <p className="score">{identity.scoreBps} <span>bps</span></p>
              {identity.topics?.map((t) => (
                <div key={t.topic} className="bar">
                  <p>
                    {t.topic} · {t.verdict} · K {t.conflictK?.toFixed(2)}
                    {t.revised ? " · trust revised" : ""}
                  </p>
                  <OpinionBar opinion={t.opinion} />
                  <p className="mute">
                    E[ω] {t.opinion?.p?.toFixed(3)} · a {t.opinion?.a}
                  </p>
                </div>
              ))}
              {explanation && (
                <dl>
                  <dt>Summary · {explanation.engine || "—"}</dt>
                  <dd>{explanation.summary}</dd>
                  {explanation.reasons?.map((r) => (
                    <div key={r.feature}>
                      <dt>{r.feature} · φ {r.shap}</dt>
                      <dd>{r.text}</dd>
                    </div>
                  ))}
                  {explanation.caveats?.map((c) => (
                    <dd className="mute" key={c}>{c}</dd>
                  ))}
                </dl>
              )}
            </section>

            <section>
              <h2>Evidence</h2>
              <p className="section-help">
                Subject {identity.subjectDid || identity.subject}. Settlement is always Sepolia
                IdentityState — extra L2s only post claims.
              </p>
              <dl className="kv">
                <div>
                  <dt>subject</dt>
                  <dd>
                    <code>{shortHex(identity.subject)}</code>
                    <Copy value={identity.subject} label="subject" />
                  </dd>
                </div>
                <div>
                  <dt>commitId</dt>
                  <dd>
                    <code>{shortHex(identity.commit?.commitId)}</code>
                    <Copy value={identity.commit?.commitId} label="commitId" />
                  </dd>
                </div>
                <div>
                  <dt>stateHash</dt>
                  <dd>
                    <code>{shortHex(identity.commit?.stateHash)}</code>
                    <Copy value={identity.commit?.stateHash} label="stateHash" />
                  </dd>
                </div>
                <div>
                  <dt>modelVersion</dt>
                  <dd><code>{shortHex(identity.modelVersion)}</code></dd>
                </div>
                <div>
                  <dt>latest mined</dt>
                  <dd>
                    {history?.latest ? (
                      <>
                        {shortHex(history.latest.commitId)} · {history.latest.scoreBps} bps · block {history.latest.blockNumber}
                        {history.latest.issuedAt ? ` · ${when(history.latest.issuedAt)}` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
              {commitTx && (
                <p>
                  <a href={commitTx} target="_blank" rel="noreferrer">
                    Open Sepolia tx {shortHex(with0x(identity.commit.txHash))}
                  </a>
                </p>
              )}
              {history?.commitIds?.length > 0 && (
                <ol className="history">
                  {history.commitIds.map((id, idx) => (
                    <li key={id}>
                      <span className="mute">{idx + 1}</span> <code>{shortHex(id)}</code>
                      <Copy value={id} label="history commitId" />
                    </li>
                  ))}
                </ol>
              )}
              <button type="button" className="ghost" onClick={() => setShowJson((v) => !v)}>
                {showJson ? "Hide overlay JSON" : "Show overlay JSON"}
              </button>
              {showJson && <pre className="json">{JSON.stringify(identity, null, 2)}</pre>}
            </section>
          </main>
        </>
      )}

      <section className="glossary" id="terms">
        <p className="kicker">Field guide</p>
        <h2>How to read the floor</h2>
        <dl>
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <dt>{g.term}</dt>
              <dd>{g.def}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="api" id="api">
        <p className="kicker">Designed surface</p>
        <h2>Talk to the brain without the UI</h2>
        <p className="section-help">
          Official score is never an LLM integer. GET /v1/identity has no model vendor. Overlay is a cache;
          Sepolia IdentityState is the record.
        </p>
        <div className="api-grid">
          {[
            { id: "health", title: "GET /v1/health", body: "Heads, contracts, sklearn accuracy / F1 / Brier, LiteLLM env flag.", cmd: curls.health },
            { id: "identity", title: "GET /v1/identity/{subject}", body: "Verdict, scoreBps, claims, topics, commit, pendingOnChain.", cmd: curls.identity },
            { id: "history", title: "GET /v1/identity/{subject}/history", body: "commitIds and latest mined tuple from IdentityState.", cmd: curls.history },
          ].map((card) => (
            <article key={card.id}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <code>{card.cmd}</code>
              <button type="button" className="ghost compact" onClick={() => copyCurl(card.id, card.cmd)}>
                {copiedCurl === card.id ? "Copied" : "Copy curl"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="catalog">
        <h2>Watched sources</h2>
        <p className="section-help">
          FR-01 pair is Sepolia + Unichain Sepolia. Extra Superchain L2s are watched sources only.
          Settlement never leaves Sepolia.
        </p>
        <table>
          <thead>
            <tr>
              <th>Chain</th>
              <th>Id</th>
              <th>Head</th>
              <th>ClaimSource</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {CHAINS.map((c) => {
              const addr = contracts[CONTRACT_KEY[c.id]];
              return (
                <tr key={c.id}>
                  <td>{c.label}</td>
                  <td className="mono">{c.id}</td>
                  <td className="mono">{health?.heads?.[c.id] ?? "—"}</td>
                  <td className="mono">
                    {addr ? (
                      <a href={explorerAddr(c.id, addr)} target="_blank" rel="noreferrer">
                        {shortHex(addr)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{c.pair}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {contracts.identityState && (
          <p className="mute">
            IdentityState{" "}
            <a href={`https://sepolia.etherscan.io/address/${contracts.identityState}`} target="_blank" rel="noreferrer">
              {contracts.identityState}
            </a>
            {health?.operator ? ` · operator ${health.operator}` : ""}
          </p>
        )}
      </section>

      <footer className="foot">
        <p>
          curl the brain:{" "}
          <code>
            curl -s {api}/v1/identity/{DEMO_SUBJECT}
          </code>
        </p>
        <p className="mute">
          Canonical UI https://chainmind-synapse.vercel.app · no fine-tuning · no Gitcoin Passport ·
          FR-01 Sepolia + Unichain Sepolia
        </p>
      </footer>
    </div>
  );
}
