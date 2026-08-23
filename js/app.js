/**
 * ChainMind Synapse — Watch Floor Application Controller
 * Orchestrates Subjective Logic consensus, UI state, Simplex canvas, and REST API modal.
 */

import { SynapseCanvas } from './canvas.js';
import { SubjectiveLogicEngine } from './ai-engine.js';
import { StateStore } from './state.js';

const BYOK_KEY = "synapse.byok.v1";

function loadByok() {
  try {
    const raw = localStorage.getItem(BYOK_KEY);
    if (!raw) {
      return { apiKey: "", baseUrl: "", model: "gpt-4.1-mini", apiBase: "http://127.0.0.1:8000" };
    }
    const parsed = JSON.parse(raw);
    return {
      apiKey: parsed.apiKey || "",
      baseUrl: parsed.baseUrl || "",
      model: parsed.model || "gpt-4.1-mini",
      apiBase: parsed.apiBase || "http://127.0.0.1:8000",
    };
  } catch {
    return { apiKey: "", baseUrl: "", model: "gpt-4.1-mini", apiBase: "http://127.0.0.1:8000" };
  }
}

class WatchFloorApp {
  constructor() {
    this.state = new StateStore();
    this.slEngine = new SubjectiveLogicEngine();
    this.canvas = null;
    this.byok = loadByok();

    this.init();
  }

  init() {
    const synapseCanvasEl = document.getElementById('synapse-canvas');
    const simplexCanvasEl = document.getElementById('simplex-canvas');

    if (synapseCanvasEl && simplexCanvasEl) {
      this.canvas = new SynapseCanvas(synapseCanvasEl, simplexCanvasEl);
    }

    this.state.subscribe((store) => this.renderUI(store));
    this.bindEvents();
    this.fillByokForm();
    this.renderUI(this.state);
    this.refreshLlmChip();
  }

  bindEvents() {
    // Scenario Pills
    const pills = document.querySelectorAll('.pill-btn');
    pills.forEach((btn) => {
      btn.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        this.state.loadScenario(btn.dataset.scenario);
      });
    });

    // Conflict Action Shortcut
    const btnInjectConflict = document.getElementById('btn-inject-conflict-action');
    if (btnInjectConflict) {
      btnInjectConflict.addEventListener('click', () => {
        const pill = document.getElementById('pill-scenario-conflict');
        if (pill) pill.click();
      });
    }

    // Tamper Button
    const btnTamper = document.getElementById('btn-tamper-toggle');
    if (btnTamper) {
      btnTamper.addEventListener('click', () => {
        this.state.tamperHash();
      });
    }

    // Replay Logs
    const btnReplay = document.getElementById('btn-replay-logs');
    if (btnReplay) {
      btnReplay.addEventListener('click', () => {
        this.state.loadScenario(this.state.activeScenario);
      });
    }

    // Subject Search
    const formSearch = document.getElementById('form-subject-search');
    if (formSearch) {
      formSearch.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('input-subject').value.trim();
        if (input) {
          this.state.subject = input;
          this.state.subjectDid = `did:ethr:sepolia:${input}`;
          this.state.notify();
        }
      });
    }

    // Modal API JSON Inspector
    const btnApiModal = document.getElementById('btn-api-modal');
    const modal = document.getElementById('modal-api-inspector');
    const btnClose = document.getElementById('btn-close-modal');
    const btnCloseConfirm = document.getElementById('btn-close-modal-confirm');
    const btnCopyJson = document.getElementById('btn-copy-modal-json');

    if (btnApiModal && modal) {
      btnApiModal.addEventListener('click', () => {
        this.renderApiModalContent();
        modal.classList.remove('hidden');
      });
      [btnClose, btnCloseConfirm].forEach(b => {
        if (b) b.addEventListener('click', () => modal.classList.add('hidden'));
      });
    }

    if (btnCopyJson) {
      btnCopyJson.addEventListener('click', () => {
        const pre = document.getElementById('json-modal-content');
        if (pre) {
          navigator.clipboard.writeText(pre.textContent);
          btnCopyJson.textContent = 'Copied!';
          setTimeout(() => btnCopyJson.textContent = 'Copy JSON', 1500);
        }
      });
    }

    // Preimage Verify Link
    const linkVerify = document.getElementById('link-verify-preimage');
    if (linkVerify && modal) {
      linkVerify.addEventListener('click', (e) => {
        e.preventDefault();
        this.renderPreimageModalContent();
        modal.classList.remove('hidden');
      });
    }

    // Copy Buttons
    const btnCopyCommit = document.getElementById('btn-copy-commit');
    if (btnCopyCommit) {
      btnCopyCommit.addEventListener('click', () => {
        navigator.clipboard.writeText(this.state.commitId);
      });
    }

    const btnCopyState = document.getElementById('btn-copy-state');
    if (btnCopyState) {
      btnCopyState.addEventListener('click', () => {
        navigator.clipboard.writeText(this.state.stateHash);
      });
    }

    const byokModal = document.getElementById('modal-byok');
    const btnByok = document.getElementById('btn-byok-modal');
    const btnCloseByok = document.getElementById('btn-close-byok');
    if (btnByok && byokModal) {
      btnByok.addEventListener('click', () => {
        this.fillByokForm();
        byokModal.classList.remove('hidden');
      });
    }
    if (btnCloseByok && byokModal) {
      btnCloseByok.addEventListener('click', () => byokModal.classList.add('hidden'));
    }
    const btnSave = document.getElementById('btn-byok-save');
    const btnTest = document.getElementById('btn-byok-test');
    const btnExplain = document.getElementById('btn-byok-explain');
    if (btnSave) btnSave.addEventListener('click', () => this.saveByok());
    if (btnTest) btnTest.addEventListener('click', () => this.testLlm());
    if (btnExplain) btnExplain.addEventListener('click', () => this.generateLiveExplanation());
  }

  apiBase() {
    return (this.byok.apiBase || "http://127.0.0.1:8000").replace(/\/$/, "");
  }

  fillByokForm() {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value || "";
    };
    set("byok-api-base", this.byok.apiBase);
    set("byok-base-url", this.byok.baseUrl);
    set("byok-model", this.byok.model);
    set("byok-api-key", this.byok.apiKey);
  }

  readByokForm() {
    const val = (id) => document.getElementById(id)?.value?.trim() || "";
    this.byok = {
      apiBase: val("byok-api-base") || "http://127.0.0.1:8000",
      baseUrl: val("byok-base-url"),
      model: val("byok-model") || "gpt-4.1-mini",
      apiKey: document.getElementById("byok-api-key")?.value || "",
    };
    return this.byok;
  }

  setByokStatus(text) {
    const el = document.getElementById("byok-status");
    if (el) el.textContent = text;
  }

  saveByok() {
    this.readByokForm();
    localStorage.setItem(BYOK_KEY, JSON.stringify(this.byok));
    this.setByokStatus("Saved in this browser only. The server does not store the key.");
  }

  async refreshLlmChip() {
    const chip = document.getElementById("chip-litellm");
    const val = document.getElementById("val-litellm");
    try {
      const res = await fetch(`${this.apiBase()}/v1/health`);
      if (!res.ok) return;
      const health = await res.json();
      const llm = health.llm || {};
      if (val) val.textContent = llm.envConfigured ? `env set · ${llm.model || "litellm"}` : "env unset";
      if (chip) {
        chip.classList.toggle("ok", Boolean(llm.envConfigured));
        chip.classList.toggle("warn", !llm.envConfigured);
      }
    } catch {
      if (val) val.textContent = "api offline";
    }
  }

  async testLlm() {
    this.readByokForm();
    this.setByokStatus("Testing…");
    try {
      const res = await fetch(`${this.apiBase()}/v1/llm/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: this.byok.apiKey,
          baseUrl: this.byok.baseUrl,
          model: this.byok.model,
        }),
      });
      const data = await res.json();
      this.setByokStatus(data.ok ? `LiteLLM ok · ${data.model}` : (data.error || "Test failed"));
      this.refreshLlmChip();
    } catch (err) {
      this.setByokStatus(err.message || String(err));
    }
  }

  async generateLiveExplanation() {
    this.readByokForm();
    const subject = document.getElementById("input-subject")?.value?.trim() || this.state.subject;
    if (!subject) {
      this.setByokStatus("Enter a subject first.");
      return;
    }
    this.setByokStatus("Generating…");
    try {
      const res = await fetch(`${this.apiBase()}/v1/identity/${subject}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: this.byok.apiKey,
          baseUrl: this.byok.baseUrl,
          model: this.byok.model,
        }),
      });
      if (res.status === 404) {
        this.setByokStatus("No overlay/commit on the live API. Canned score is unchanged.");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      this.renderLiveExplanation(data);
      this.setByokStatus(`Explanation ready · engine ${data.engine || "—"}`);
    } catch (err) {
      this.setByokStatus(err.message || String(err));
    }
  }

  renderLiveExplanation(data) {
    const escape = (value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const box = document.getElementById("live-explanation-box");
    const summary = document.getElementById("live-explain-summary");
    const engine = document.getElementById("live-explain-engine");
    const reasons = document.getElementById("live-explain-reasons");
    if (!box) return;
    box.classList.remove("hidden");
    if (engine) engine.textContent = data.engine || "shap+prompt";
    if (summary) summary.textContent = data.summary || "";
    if (reasons) {
      reasons.innerHTML = "";
      (data.reasons || []).forEach((r) => {
        const item = document.createElement("div");
        item.className = "shap-item";
        item.innerHTML = `
          <div class="shap-top-row">
            <span class="shap-feat">${escape(r.feature)}</span>
            <span>${escape(r.shap ?? "")}</span>
          </div>
          <div class="shap-desc">${escape(r.text || "")}</div>
        `;
        reasons.appendChild(item);
      });
    }
  }

  renderUI(store) {
    const slResult = this.slEngine.evaluateSubject(store.claims);

    // 1. Update Canvas & Simplex
    if (this.canvas) {
      this.canvas.loadState(store.claims, slResult.fusedOpinion);
    }

    // 2. Simplex Numbers
    const valB = document.getElementById('simplex-val-b');
    const valD = document.getElementById('simplex-val-d');
    const valU = document.getElementById('simplex-val-u');
    if (valB) valB.textContent = slResult.fusedOpinion.b;
    if (valD) valD.textContent = slResult.fusedOpinion.d;
    if (valU) valU.textContent = slResult.fusedOpinion.u;

    // 3. Rail Metadata
    const metaSubDid = document.getElementById('meta-subject-did');
    const metaCommit = document.getElementById('meta-commit-id');
    const metaState = document.getElementById('meta-state-hash');
    const metaTx = document.getElementById('meta-tx-link');

    if (metaSubDid) metaSubDid.textContent = store.subjectDid.substring(0, 24) + '...';
    if (metaCommit) metaCommit.textContent = store.commitId.substring(0, 8) + '...' + store.commitId.substring(store.commitId.length - 4);
    if (metaState) metaState.textContent = store.stateHash.substring(0, 8) + '...' + store.stateHash.substring(store.stateHash.length - 4);
    if (metaTx) metaTx.textContent = store.settlementTx.substring(0, 8) + '...' + store.settlementTx.substring(store.settlementTx.length - 4) + ' ↗';

    // Conflict Banner
    const conflictBanner = document.getElementById('conflict-alert-box');
    const conflictDesc = document.getElementById('conflict-alert-desc');
    if (slResult.conflicts.length > 0) {
      conflictBanner.classList.remove('hidden');
      if (conflictDesc) conflictDesc.textContent = slResult.conflicts[0].note;
    } else {
      conflictBanner.classList.add('hidden');
    }

    // 4. Claims List
    this.renderClaimsList(store.claims, slResult.conflicts);

    // 5. Fusion Confidence & Stacked Bar
    const scoreBpsEl = document.getElementById('val-score-bps');
    const confFloatEl = document.getElementById('val-confidence-float');
    const verdictBadge = document.getElementById('badge-verdict');
    const massKEl = document.getElementById('val-mass-k');

    if (scoreBpsEl) scoreBpsEl.textContent = `${slResult.scoreBps} bps`;
    if (confFloatEl) confFloatEl.textContent = slResult.confidence;
    if (massKEl) massKEl.textContent = slResult.conflictK;

    if (verdictBadge) {
      verdictBadge.textContent = slResult.verdict.toUpperCase();
      verdictBadge.className = `verdict-badge verdict-${slResult.verdict}`;
    }

    // Stacked Opinion Bar
    const barB = document.getElementById('bar-b');
    const barD = document.getElementById('bar-d');
    const barU = document.getElementById('bar-u');
    if (barB && barD && barU) {
      barB.style.width = `${Math.round(slResult.fusedOpinion.b * 100)}%`;
      barD.style.width = `${Math.round(slResult.fusedOpinion.d * 100)}%`;
      barU.style.width = `${Math.round(slResult.fusedOpinion.u * 100)}%`;
      barB.title = `Belief (b): ${slResult.fusedOpinion.b}`;
      barD.title = `Disbelief (d): ${slResult.fusedOpinion.d}`;
      barU.title = `Uncertainty (u): ${slResult.fusedOpinion.u}`;
    }

    // 6. SHAP Reasons List
    this.renderShapReasons(slResult.reasons);
  }

  renderClaimsList(claims, conflicts) {
    const listEl = document.getElementById('claims-list-container');
    const countBadge = document.getElementById('claims-count-badge');
    if (!listEl) return;

    if (countBadge) countBadge.textContent = `${claims.length} Normalized`;
    listEl.innerHTML = '';

    claims.forEach((c) => {
      const hasConflict = conflicts.some(con => con.claimIds && con.claimIds.includes(c.claimId));
      const row = document.createElement('div');
      row.className = `claim-row ${hasConflict ? 'has-conflict' : ''}`;

      const polClass = c.polarity === 1 ? 'polarity-plus' : 'polarity-minus';
      const polText = c.polarity === 1 ? '+1 (affirm)' : '-1 (deny)';

      row.innerHTML = `
        <div class="claim-header-line">
          <span>${c.chainName} (${c.chainId}) · #${c.blockNumber}</span>
          <span class="polarity-tag ${polClass}">${polText}</span>
        </div>
        <div class="claim-topic-name">${c.topic} ${c.revoked ? '<span style="color: var(--danger); font-size: 11px;">[REVOKED]</span>' : (c.expired ? '<span style="color: var(--warn); font-size: 11px;">[EXPIRED]</span>' : '')}</div>
        <div class="claim-footer-line">
          <span>${c.issuerDid}</span>
          <span class="p-cred-badge">pCredible: <strong>${c.pCredible}</strong> (b=${c.opinion?.b || 0}, d=${c.opinion?.d || 0})</span>
        </div>
      `;
      listEl.appendChild(row);
    });
  }

  renderShapReasons(reasons) {
    const container = document.getElementById('shap-reasons-container');
    if (!container) return;

    container.innerHTML = '';
    reasons.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'shap-item';

      const isPos = r.shap >= 0;
      const shapClass = isPos ? 'shap-val-pos' : 'shap-val-neg';
      const shapText = `${isPos ? '+' : ''}${r.shap.toFixed(2)}`;

      item.innerHTML = `
        <div class="shap-top-row">
          <span class="shap-feat">${r.feature}</span>
          <span class="${shapClass}">${shapText}</span>
        </div>
        <div class="shap-desc">${r.text}</div>
      `;
      container.appendChild(item);
    });
  }

  renderApiModalContent() {
    const pre = document.getElementById('json-modal-content');
    const title = document.getElementById('modal-header-title');
    if (!pre) return;

    if (title) title.textContent = `GET /v1/identity/${this.state.subject}`;

    const sl = this.slEngine.evaluateSubject(this.state.claims);
    const payload = {
      subject: this.state.subject,
      subjectDid: this.state.subjectDid,
      verdict: sl.verdict,
      confidence: sl.confidence,
      scoreBps: sl.scoreBps,
      modelVersion: this.state.modelVersion,
      pendingOnChain: false,
      degradedChains: [],
      commit: {
        commitId: this.state.commitId,
        stateHash: this.state.stateHash,
        txHash: this.state.settlementTx,
        chainId: 11155111,
        issuedAt: this.state.issuedAt,
        blockNumber: 19825
      },
      topics: [
        {
          topic: 'kyc.adult',
          opinion: sl.fusedOpinion,
          conflictK: sl.conflictK,
          verdict: sl.verdict === 'conflict' ? 'unresolved' : 'true'
        }
      ],
      claims: this.state.claims.map(c => ({
        claimId: c.claimId,
        chainId: c.chainId,
        issuer: c.issuer,
        topic: c.topic,
        polarity: c.polarity,
        pCredible: c.pCredible,
        opinion: c.opinion,
        txHash: c.txHash,
        revoked: c.revoked
      })),
      conflicts: sl.conflicts
    };

    pre.textContent = JSON.stringify(payload, null, 2);
  }

  renderPreimageModalContent() {
    const pre = document.getElementById('json-modal-content');
    const title = document.getElementById('modal-header-title');
    if (!pre) return;

    if (title) title.textContent = 'Hash Preimage JSON (verify_hash.py)';

    const sl = this.slEngine.evaluateSubject(this.state.claims);
    const preimage = {
      subject: this.state.subject,
      claimIdsSorted: this.state.claims.map(c => c.claimId).sort(),
      scoreBps: sl.scoreBps,
      modelVersion: this.state.modelVersion,
      issuedAt: this.state.issuedAt
    };

    pre.textContent = JSON.stringify(preimage, null, 2);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new WatchFloorApp();
});
