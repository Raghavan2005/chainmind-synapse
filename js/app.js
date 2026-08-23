/**
 * ChainMind Synapse - Application Controller & Entry Point
 * Orchestrates Canvas visualizer, AI Trust Engine, State management, 3D card tilt, and UI events.
 */

import { SynapseCanvas } from './canvas.js';
import { AITrustEngine } from './ai-engine.js';
import { StateStore } from './state.js';

class AppController {
  constructor() {
    this.state = new StateStore();
    this.aiEngine = new AITrustEngine();
    this.canvas = null;
    this.currentDisplayedScore = 0;

    this.init();
  }

  init() {
    // 1. Initialize Canvas Visualizer
    const canvasEl = document.getElementById('synapse-canvas');
    if (canvasEl) {
      this.canvas = new SynapseCanvas(canvasEl, (node, clientX, clientY) => {
        this.handleNodeHover(node, clientX, clientY);
      });
    }

    // 2. Subscribe to State changes
    this.state.subscribe((store) => this.renderUI(store));

    // 3. Bind UI & 3D Interactive Card Events
    this.bindEvents();
    this.initCardTilt();

    // 4. Initial Render
    this.renderUI(this.state);
  }

  initCardTilt() {
    // 3D Parallax Tilt Effect on Dashboard Cards
    const cards = document.querySelectorAll('.dashboard-col');
    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -4;
        const rotateY = ((x - centerX) / centerX) * 4;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
      });
    });
  }

  bindEvents() {
    // Scenario Pills
    const pills = document.querySelectorAll('.pill-btn');
    pills.forEach((btn) => {
      btn.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const scenario = btn.dataset.scenario;
        this.state.loadScenario(scenario);
        this.showToast(`Switched scenario to: ${btn.textContent.trim()}`);
      });
    });

    // Quick Action Conflict Injection
    const btnSimConflict = document.getElementById('btn-simulate-conflict');
    if (btnSimConflict) {
      btnSimConflict.addEventListener('click', () => {
        const revPill = document.getElementById('pill-revocation-conflict');
        if (revPill) revPill.click();
      });
    }

    // Tamper Button
    const btnTamper = document.getElementById('btn-tamper-claim');
    if (btnTamper) {
      btnTamper.addEventListener('click', () => {
        this.state.tamperClaim();
        this.showToast('⚠️ Tampered with cryptographic signature!');
      });
    }

    // Reset Button
    const btnReset = document.getElementById('btn-reset-state');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.state.restoreGenesis();
        this.showToast('✅ Restored verified state!');
      });
    }

    // REST API Modal
    const btnApi = document.getElementById('btn-api-inspector');
    const modalApi = document.getElementById('modal-api-inspector');
    const btnCloseApi = document.getElementById('btn-close-api-modal');
    const btnCloseApiAct = document.getElementById('btn-modal-close-action');

    if (btnApi && modalApi) {
      btnApi.addEventListener('click', () => {
        this.updateApiJsonModal();
        modalApi.classList.remove('hidden');
      });
      [btnCloseApi, btnCloseApiAct].forEach(b => {
        if (b) b.addEventListener('click', () => modalApi.classList.add('hidden'));
      });
    }

    // Custom Claim Modal
    const btnOpenClaim = document.getElementById('btn-open-claim-modal');
    const modalClaim = document.getElementById('modal-custom-claim');
    const btnCloseClaim = document.getElementById('btn-close-claim-modal');
    const btnCancelClaim = document.getElementById('btn-cancel-claim-modal');
    const formClaim = document.getElementById('form-custom-claim');

    if (btnOpenClaim && modalClaim) {
      btnOpenClaim.addEventListener('click', () => modalClaim.classList.remove('hidden'));
      [btnCloseClaim, btnCancelClaim].forEach(b => {
        if (b) b.addEventListener('click', () => modalClaim.classList.add('hidden'));
      });
    }

    if (formClaim) {
      formClaim.addEventListener('submit', (e) => {
        e.preventDefault();
        const chain = document.getElementById('claim-chain').value;
        const type = document.getElementById('claim-type').value;
        const issuer = document.getElementById('claim-issuer').value;
        const status = document.getElementById('claim-status').value;
        const reputation = document.getElementById('claim-reputation').value;

        this.state.addCustomClaim({ chain, type, issuer, status, reputation });
        modalClaim.classList.add('hidden');
        this.showToast(`✨ Injected ${type} from ${chain}!`);
        formClaim.reset();
      });
    }

    // Copy Root Hash
    const btnCopyHash = document.getElementById('btn-copy-hash');
    if (btnCopyHash) {
      btnCopyHash.addEventListener('click', () => {
        navigator.clipboard.writeText(this.state.stateHash);
        this.showToast('Copied state hash!');
      });
    }

    // Copy JSON API Payload
    const btnCopyJson = document.getElementById('btn-copy-json');
    if (btnCopyJson) {
      btnCopyJson.addEventListener('click', () => {
        const jsonEl = document.getElementById('api-json-content');
        if (jsonEl) {
          navigator.clipboard.writeText(jsonEl.textContent);
          this.showToast('Copied JSON response!');
        }
      });
    }
  }

  handleNodeHover(node, clientX, clientY) {
    const card = document.getElementById('node-hover-card');
    if (!card) return;

    if (!node) {
      card.classList.add('hidden');
      return;
    }

    const chainBadge = document.getElementById('hover-chain-badge');
    const typeBadge = document.getElementById('hover-type-badge');
    const titleEl = document.getElementById('hover-node-title');
    const issuerEl = document.getElementById('hover-issuer');
    const statusEl = document.getElementById('hover-status');
    const weightEl = document.getElementById('hover-weight');

    if (chainBadge) chainBadge.textContent = node.chain;
    if (typeBadge) typeBadge.textContent = node.type;
    if (titleEl) titleEl.textContent = node.title || node.type;
    if (issuerEl) issuerEl.textContent = node.issuer || 'Consensus Arbiter';
    if (statusEl) {
      statusEl.textContent = node.status || 'Active';
      statusEl.className = node.status === 'Revoked' ? 'text-crimson' : 'text-cyan';
    }
    if (weightEl) weightEl.textContent = (node.issuerReputation || 95) + '%';

    const canvasRect = this.canvas.canvas.parentElement.getBoundingClientRect();
    card.style.left = (clientX - canvasRect.left) + 'px';
    card.style.top = (clientY - canvasRect.top) + 'px';
    card.classList.remove('hidden');
  }

  animateScoreTicker(targetScore) {
    const scoreValEl = document.getElementById('overall-trust-score');
    if (!scoreValEl) return;

    const start = this.currentDisplayedScore;
    const duration = 600;
    const startTime = performance.now();

    const update = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = start + (targetScore - start) * easeProgress;
      
      scoreValEl.textContent = current.toFixed(1);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        this.currentDisplayedScore = targetScore;
        scoreValEl.textContent = targetScore.toFixed(1);
      }
    };

    requestAnimationFrame(update);
  }

  renderUI(store) {
    if (this.canvas) {
      this.canvas.loadState(store.claims);
    }

    const aiResult = this.aiEngine.evaluateClaims(store.claims);

    // 1. Animated Score Ticker & Radial Progress
    this.animateScoreTicker(aiResult.overallScore);
    
    const progressEl = document.getElementById('radial-progress-bar');
    const gradeBadge = document.getElementById('trust-grade-badge');

    if (gradeBadge) {
      gradeBadge.textContent = aiResult.grade.split(' ')[0] + ' ' + (aiResult.grade.split(' ')[1] || '');
      gradeBadge.className = `radial-grade-badge ${aiResult.gradeClass}`;
    }

    if (progressEl) {
      const maxOffset = 515;
      const offset = maxOffset - (maxOffset * (aiResult.overallScore / 100));
      progressEl.style.strokeDashoffset = offset;
      progressEl.style.stroke = aiResult.overallScore >= 70 ? 'var(--teal-glow)' : (aiResult.overallScore >= 45 ? '#f59e0b' : 'var(--state-alert)');
    }

    // 2. Breakdown Bars
    const setBar = (fillId, textId, val) => {
      const fill = document.getElementById(fillId);
      const text = document.getElementById(textId);
      if (fill) fill.style.width = `${val}%`;
      if (text) text.textContent = `${val}%`;
    };
    setBar('fill-issuer', 'score-issuer', aiResult.breakdown.issuer);
    setBar('fill-temporal', 'score-temporal', aiResult.breakdown.temporal);
    setBar('fill-coherence', 'score-coherence', aiResult.breakdown.coherence);
    setBar('fill-revocation', 'score-revocation', aiResult.breakdown.crypto);

    // 3. Gen-AI Terminal Explanation
    const terminalEl = document.getElementById('xai-terminal-text');
    if (terminalEl) {
      terminalEl.innerHTML = aiResult.explanation;
      terminalEl.scrollTop = terminalEl.scrollHeight;
    }

    // 4. Ingested Claims List
    this.renderClaimsFeed(store.claims);

    // 5. Merkle Ledger & Tamper Alerts
    const stateHashEl = document.getElementById('current-state-hash');
    const merkleRootEl = document.getElementById('current-merkle-root');
    const merkleStatusPill = document.getElementById('merkle-status-pill');
    const tamperAlertBanner = document.getElementById('tamper-alert-banner');

    if (stateHashEl) stateHashEl.textContent = store.stateHash.substring(0, 10) + '...' + store.stateHash.substring(store.stateHash.length - 4);
    if (merkleRootEl) merkleRootEl.textContent = store.merkleRoot.substring(0, 10) + '...' + store.merkleRoot.substring(store.merkleRoot.length - 4);

    if (store.isTampered) {
      if (merkleStatusPill) {
        merkleStatusPill.className = 'status-pill status-tampered';
        merkleStatusPill.textContent = 'TAMPER DETECTED';
      }
      if (tamperAlertBanner) tamperAlertBanner.classList.remove('hidden');
    } else {
      if (merkleStatusPill) {
        merkleStatusPill.className = 'status-pill status-verified';
        merkleStatusPill.textContent = 'TAMPER-PROOF';
      }
      if (tamperAlertBanner) tamperAlertBanner.classList.add('hidden');
    }

    // 6. Audit History
    this.renderAuditHistory(store.auditHistory);
  }

  renderClaimsFeed(claims) {
    const container = document.getElementById('claims-stream-container');
    const badgeCount = document.getElementById('claim-count-badge');
    if (!container) return;

    if (badgeCount) badgeCount.textContent = `${claims.length} Active`;
    container.innerHTML = '';

    claims.forEach((c) => {
      const card = document.createElement('div');
      card.className = `claim-item-card ${c.status === 'Revoked' ? 'is-conflict' : ''}`;

      let statusClass = 'pill-active';
      if (c.status === 'Revoked') statusClass = 'pill-revoked';
      if (c.status === 'Under Dispute' || c.status === 'Expired') statusClass = 'pill-disputed';

      card.innerHTML = `
        <div class="claim-top-row">
          <span class="claim-network-badge">
            <i class="fa-solid fa-cube"></i> ${c.chain} (#${c.blockNumber})
          </span>
          <span class="claim-status-pill ${statusClass}">${c.status}</span>
        </div>
        <div class="claim-title-text">${c.title}</div>
        <div class="claim-meta-details">
          <span>Issuer: ${c.issuer}</span>
          <span>${c.timestamp}</span>
        </div>
      `;
      container.appendChild(card);
    });
  }

  renderAuditHistory(history) {
    const listEl = document.getElementById('audit-history-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    history.forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'audit-entry';
      row.innerHTML = `
        <span class="audit-time">${entry.time}</span>
        <span class="audit-action">${entry.action}</span>
        <span class="audit-block">${entry.block}</span>
      `;
      listEl.appendChild(row);
    });
  }

  updateApiJsonModal() {
    const jsonEl = document.getElementById('api-json-content');
    if (!jsonEl) return;

    const aiResult = this.aiEngine.evaluateClaims(this.state.claims);
    const payload = {
      protocol: 'ChainMind Synapse',
      version: '1.0.0',
      subjectDID: 'did:pkh:eip155:1:0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      timestamp: new Date().toISOString(),
      unifiedIdentityState: {
        trustScore: aiResult.overallScore,
        grade: aiResult.grade,
        isTamperProof: !this.state.isTampered,
        merkleRoot: this.state.merkleRoot,
        stateHash: this.state.stateHash,
        settlementTx: this.state.settlementTx
      },
      trustVectorBreakdown: aiResult.breakdown,
      ingestedClaims: this.state.claims.map(c => ({
        id: c.id,
        claimType: c.type,
        sourceChain: c.chain,
        issuer: c.issuer,
        status: c.status,
        blockNumber: c.blockNumber,
        proofHash: c.hash
      })),
      aiConsensusExplanation: {
        latencyMs: 38,
        anomaliesDetected: aiResult.conflicts.length,
        conflicts: aiResult.conflicts
      }
    };

    jsonEl.textContent = JSON.stringify(payload, null, 2);
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-cube text-cyan"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
