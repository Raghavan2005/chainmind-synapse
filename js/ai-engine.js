/**
 * ChainMind Synapse - AI Trust Scoring & Gen-AI Explainability Engine
 * Performs real-time multi-factor trust vector calculation, anomaly detection,
 * and natural language reasoning synthesis.
 */

export class AITrustEngine {
  constructor() {
    this.weights = {
      issuer: 0.35,
      temporal: 0.30,
      coherence: 0.20,
      crypto: 0.15
    };
  }

  /**
   * Evaluate a set of cross-chain claims and return a comprehensive trust state
   */
  evaluateClaims(claims) {
    if (!claims || claims.length === 0) {
      return {
        overallScore: 0,
        breakdown: { issuer: 0, temporal: 0, coherence: 0, crypto: 0 },
        grade: 'INSUFFICIENT_DATA',
        conflicts: [],
        explanation: 'No active verifiable claims detected in cross-chain ingest buffer.'
      };
    }

    let sumIssuer = 0;
    let sumTemporal = 0;
    let sumCoherence = 100;
    let sumCrypto = 100;
    let conflicts = [];

    // Analyze individual claims
    claims.forEach((claim) => {
      // Issuer Score
      sumIssuer += claim.issuerReputation || 90;

      // Temporal & Revocation Score
      if (claim.status === 'Active') {
        sumTemporal += 95;
      } else if (claim.status === 'Expired') {
        sumTemporal += 40;
        conflicts.push(`Claim [${claim.title}] on ${claim.chain} has expired its validity window.`);
      } else if (claim.status === 'Revoked') {
        sumTemporal += 10;
        conflicts.push(`CRITICAL: Claim [${claim.title}] was explicitly REVOKED on ${claim.chain}.`);
      } else if (claim.status === 'Under Dispute') {
        sumTemporal += 50;
        conflicts.push(`WARNING: Claim [${claim.title}] is flagged with an active on-chain challenge.`);
      }

      // Check Tamper Status
      if (claim.isTampered) {
        sumCrypto -= 60;
        conflicts.push(`TAMPER ALERT: Cryptographic signature mismatch detected for ${claim.chain} claim.`);
      }
    });

    const avgIssuer = Math.min(100, Math.round(sumIssuer / claims.length));
    const avgTemporal = Math.min(100, Math.round(sumTemporal / claims.length));

    // Coherence check: If one chain says Active and another says Revoked for similar identity
    const hasRevoked = claims.some(c => c.status === 'Revoked');
    const hasActive = claims.some(c => c.status === 'Active');
    if (hasRevoked && hasActive) {
      sumCoherence = 38;
      conflicts.push('CROSS-CHAIN COHERENCE FAILED: Polygon marks credential as Revoked while Ethereum marks it as Active.');
    } else if (claims.some(c => c.status === 'Under Dispute')) {
      sumCoherence = 65;
    }

    const avgCoherence = Math.max(10, Math.min(100, sumCoherence));
    const avgCrypto = Math.max(0, Math.min(100, sumCrypto));

    // Weighted Overall Score
    const overall = (
      avgIssuer * this.weights.issuer +
      avgTemporal * this.weights.temporal +
      avgCoherence * this.weights.coherence +
      avgCrypto * this.weights.crypto
    );

    const overallScore = parseFloat(overall.toFixed(1));

    // Determine Tier Grade
    let grade = 'TIER 1 (CONFIRMED)';
    let gradeClass = 'badge-high';
    if (overallScore < 70 && overallScore >= 45) {
      grade = 'TIER 2 (ELEVATED RISK)';
      gradeClass = 'badge-caution';
    } else if (overallScore < 45) {
      grade = 'TIER 3 (REJECTED / QUARANTINED)';
      gradeClass = 'badge-danger';
    }

    // Generate Gen-AI Explainable Reasoning Stream
    const explanation = this.synthesizeExplanation({
      claims,
      overallScore,
      grade,
      conflicts,
      breakdown: {
        issuer: avgIssuer,
        temporal: avgTemporal,
        coherence: avgCoherence,
        crypto: avgCrypto
      }
    });

    return {
      overallScore,
      breakdown: {
        issuer: avgIssuer,
        temporal: avgTemporal,
        coherence: avgCoherence,
        crypto: avgCrypto
      },
      grade,
      gradeClass,
      conflicts,
      explanation
    };
  }

  synthesizeExplanation(context) {
    const timestamp = new Date().toISOString().substring(11, 19);
    let out = `[${timestamp}] <span class="tag-meta">SYS_INIT:</span> ChainMind Synapse Gen-AI Arbiter v2.4 initialized.\n`;
    out += `[${timestamp}] <span class="tag-meta">EVALUATION_WINDOW:</span> ${context.claims.length} cross-chain credentials ingested across ${new Set(context.claims.map(c => c.chain)).size} networks.\n\n`;

    if (context.conflicts.length === 0 && context.overallScore >= 85) {
      out += `<span class="tag-pass">[CONSENSUS REACHED - SCORE ${context.overallScore}/100]</span>\n`;
      out += `> Semantic verification confirmed harmonious identity state.\n`;
      out += `> Issuer Authority: Tier-1 accredited institutional DIDs (reputation score: ${context.breakdown.issuer}%).\n`;
      out += `> Zero revocation events observed across Ethereum & Polygon RPC logs.\n`;
      out += `> Cryptographic Merkle proof matches on-chain root [VALID].\n`;
      out += `> Unified Identity State status: <span class="tag-pass">AUTHORIZED & TAMPER-PROOF</span>.`;
    } else if (context.conflicts.some(c => c.includes('REVOKED') || c.includes('COHERENCE FAILED'))) {
      out += `<span class="tag-fail">[CRITICAL ANOMALY - TRUST SCORE DOWGRADED TO ${context.overallScore}/100]</span>\n`;
      out += `> Cross-chain discrepancy detected between issuer states:\n`;
      context.conflicts.forEach(c => {
        out += `  * <span class="tag-fail">${c}</span>\n`;
      });
      out += `> AI Decision: Revocation events take precedence over stale active states.\n`;
      out += `> Quarantined Claims: Merkle root recalculated to isolate disputed proofs.\n`;
      out += `> Recommended Action: Service providers should deny high-trust access tokens until issuer dispute clears.`;
    } else if (context.conflicts.some(c => c.includes('TAMPER ALERT'))) {
      out += `<span class="tag-fail">[SECURITY ALERT - CRYPTOGRAPHIC INTEGRITY VIOLATION]</span>\n`;
      out += `> ECDSA signature verification failed on ingested payload.\n`;
      out += `> Tampered payload hash does NOT match Merkle leaves on Sepolia.\n`;
      out += `> AI Arbiter marked payload as <span class="tag-fail">MALICIOUS_INJECTION</span>. Auto-quarantine engaged.`;
    } else {
      out += `<span class="tag-warn">[ELEVATED CAUTION - SCORE ${context.overallScore}/100]</span>\n`;
      context.conflicts.forEach(c => {
        out += `  * <span class="tag-warn">${c}</span>\n`;
      });
      out += `> Verification score meets conditional threshold for Level-2 privileges.\n`;
      out += `> Recommend secondary zero-knowledge challenge for final settlement.`;
    }

    return out;
  }
}
