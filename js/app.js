/**
 * ChainMind Synapse — Watch Floor Application Controller
 * Orchestrates Subjective Logic consensus, UI state, Simplex canvas, and REST API modal.
 */

import { SynapseCanvas } from './canvas.js';
import { SubjectiveLogicEngine } from './ai-engine.js';
import { StateStore } from './state.js';

class WatchFloorApp {
  constructor() {
    this.state = new StateStore();
    this.slEngine = new SubjectiveLogicEngine();
    this.canvas = null;

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
    this.renderUI(this.state);
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
