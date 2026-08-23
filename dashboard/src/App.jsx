import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE || "";

function shortHex(value) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function Chip({ kind, children }) {
  return <span className={`chip ${kind || ""}`}>{children}</span>;
}

export default function App() {
  const initial = window.location.hash.replace("#/", "") || localStorage.getItem("demoSubject") || "";
  const [subject, setSubject] = useState(initial);
  const [health, setHealth] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(next = subject) {
    if (!next) return;
    setLoading(true);
    setError("");
    window.location.hash = `/${next}`;
    try {
      const [h, i] = await Promise.all([
        fetch(`${API}/v1/health`).then((r) => r.json()),
        fetch(`${API}/v1/identity/${next}`).then(async (r) => {
          if (r.status === 404) return null;
          if (!r.ok) throw new Error(await r.text());
          return r.json();
        }),
      ]);
      setHealth(h);
      setIdentity(i);
      if (i?.commit?.commitId) {
        const exp = await fetch(`${API}/v1/identity/${next}/explanation`);
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
  }, [subject]);

  const explorer = (tx) => (tx ? `https://sepolia.etherscan.io/tx/${tx}` : null);
  const banner = useMemo(() => {
    if (error) return "error";
    if (loading && !identity) return "loading";
    if (!identity) return "empty";
    if (identity.verdict === "conflict") return "conflict";
    if (identity.pendingOnChain) return "pending";
    return "ok";
  }, [error, loading, identity]);

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
          <Chip kind={health?.degraded ? "warn" : "ok"}>
            Sepolia {health?.sepoliaHead ?? "—"}
          </Chip>
          <Chip kind={health?.rpcErrors?.["80002"] ? "warn" : "ok"}>
            Amoy {health?.amoyHead ?? "—"}
          </Chip>
          <Chip>acc {health?.modelAccuracy ? health.modelAccuracy.toFixed(2) : "—"}</Chip>
        </div>
        {identity?.commit?.txHash && (
          <a href={explorer(identity.commit.txHash)} target="_blank" rel="noreferrer">
            Open Sepolia tx {shortHex(identity.commit.txHash)}
          </a>
        )}
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
                  <dt>Summary</dt>
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
