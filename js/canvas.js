/**
 * ChainMind Synapse — Watch Floor Visualizers
 * - Ingestion Topology Canvas (Sepolia & Amoy log emitters to consensus core)
 * - Jøsang Opinion Simplex Widget (Barycentric coordinate mapping: b + d + u = 1)
 */

export class SynapseCanvas {
  constructor(synapseCanvasEl, simplexCanvasEl) {
    this.canvas = synapseCanvasEl;
    this.ctx = synapseCanvasEl.getContext('2d');
    
    this.simplexCanvas = simplexCanvasEl;
    this.simplexCtx = simplexCanvasEl ? simplexCanvasEl.getContext('2d') : null;

    this.nodes = [];
    this.particles = [];
    this.coreNode = null;
    this.currentOpinion = { b: 0.44, d: 0.44, u: 0.12 };

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startAnimationLoop();
  }

  resize() {
    if (this.canvas) {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.scale(dpr, dpr);
      this.width = rect.width;
      this.height = rect.height;
    }

    if (this.simplexCanvas) {
      const rect = this.simplexCanvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.simplexCanvas.width = rect.width * dpr;
      this.simplexCanvas.height = rect.height * dpr;
      this.simplexCtx.scale(dpr, dpr);
      this.simplexWidth = rect.width;
      this.simplexHeight = rect.height;
    }
  }

  loadState(claims, fusedOpinion) {
    this.nodes = [];
    this.particles = [];
    if (fusedOpinion) this.currentOpinion = fusedOpinion;

    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Consensus Core Node
    this.coreNode = {
      x: centerX,
      y: centerY,
      radius: 24,
      title: 'Consensus Core'
    };

    // Distribute Sepolia and Amoy claims
    const total = claims.length;
    const radiusOrbit = Math.min(this.width, this.height) * 0.35;

    claims.forEach((claim, idx) => {
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radiusOrbit;
      const y = centerY + Math.sin(angle) * (radiusOrbit * 0.75);

      this.nodes.push({
        ...claim,
        x,
        y,
        angle,
        orbitRadius: radiusOrbit,
        radius: 16,
        color: claim.polarity === 1 ? '#6f9d7a' : '#c45b4a'
      });
    });

    // Particle flow
    this.particles = [];
    this.nodes.forEach(n => {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          sourceNode: n,
          progress: i / 3,
          speed: 0.006 + Math.random() * 0.004,
          color: n.color
        });
      }
    });
  }

  updatePhysics() {
    this.particles.forEach(p => {
      p.progress += p.speed;
      if (p.progress >= 1) p.progress = 0;
    });
  }

  draw() {
    if (!this.ctx || !this.coreNode) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    const cx = this.coreNode.x;
    const cy = this.coreNode.y;

    // Synaptic connections
    this.nodes.forEach(n => {
      this.ctx.beginPath();
      this.ctx.moveTo(n.x, n.y);
      this.ctx.lineTo(cx, cy);
      this.ctx.strokeStyle = n.revoked ? 'rgba(196, 91, 74, 0.4)' : 'rgba(42, 50, 44, 0.8)';
      this.ctx.lineWidth = n.polarity === -1 ? 2 : 1;
      if (n.polarity === -1) this.ctx.setLineDash([4, 4]);
      else this.ctx.setLineDash([]);
      this.ctx.stroke();
    });

    // Flowing particles
    this.particles.forEach(p => {
      const nx = p.sourceNode.x;
      const ny = p.sourceNode.y;
      const px = nx + (cx - nx) * p.progress;
      const py = ny + (cy - ny) * p.progress;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.fill();
      this.ctx.restore();
    });

    // Core Node
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.coreNode.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#121614';
    this.ctx.strokeStyle = '#c4783a';
    this.ctx.lineWidth = 2;
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#ebe4d4';
    this.ctx.font = '500 11px "IBM Plex Mono"';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('CORE', cx, cy);
    this.ctx.restore();

    // Ingested Nodes
    this.nodes.forEach(n => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#1a1f1c';
      this.ctx.strokeStyle = n.polarity === 1 ? '#6f9d7a' : '#c45b4a';
      this.ctx.lineWidth = 1.5;
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#ebe4d4';
      this.ctx.font = '500 9.5px "IBM Plex Mono"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(n.chainName.substring(0, 3).toUpperCase(), n.x, n.y);

      this.ctx.font = '10px "IBM Plex Sans"';
      this.ctx.fillStyle = '#8a8476';
      this.ctx.fillText(n.topic, n.x, n.y + n.radius + 12);
      this.ctx.restore();
    });

    // Draw Barycentric Simplex
    this.drawSimplex();
  }

  drawSimplex() {
    if (!this.simplexCtx) return;
    const sCtx = this.simplexCtx;
    const w = this.simplexWidth;
    const h = this.simplexHeight;

    sCtx.clearRect(0, 0, w, h);

    const pad = 24;
    const topX = w / 2;
    const topY = pad + 10;
    const leftX = pad + 10;
    const leftY = h - pad;
    const rightX = w - pad - 10;
    const rightY = h - pad;

    // Simplex Triangle Border
    sCtx.beginPath();
    sCtx.moveTo(topX, topY); // Apex: Uncertainty u=1
    sCtx.lineTo(leftX, leftY); // Left: Disbelief d=1
    sCtx.lineTo(rightX, rightY); // Right: Belief b=1
    sCtx.closePath();
    sCtx.strokeStyle = '#2a322c';
    sCtx.lineWidth = 1.5;
    sCtx.fillStyle = '#121614';
    sCtx.fill();
    sCtx.stroke();

    // Labels
    sCtx.font = '500 10px "IBM Plex Mono"';
    sCtx.textAlign = 'center';
    
    sCtx.fillStyle = '#8a8476';
    sCtx.fillText('u=1 (Uncertainty)', topX, topY - 6);

    sCtx.fillStyle = '#c45b4a';
    sCtx.fillText('d=1 (Disbelief)', leftX + 10, leftY + 14);

    sCtx.fillStyle = '#e4a15a';
    sCtx.fillText('b=1 (Belief)', rightX - 10, rightY + 14);

    // Compute barycentric point:
    // P = b * Right + d * Left + u * Top
    const b = this.currentOpinion.b || 0;
    const d = this.currentOpinion.d || 0;
    const u = this.currentOpinion.u || 0;

    const px = b * rightX + d * leftX + u * topX;
    const py = b * rightY + d * leftY + u * topY;

    // Draw opinion coordinate point
    sCtx.save();
    sCtx.beginPath();
    sCtx.arc(px, py, 5, 0, Math.PI * 2);
    sCtx.fillStyle = '#c4783a';
    sCtx.strokeStyle = '#ebe4d4';
    sCtx.lineWidth = 1.5;
    sCtx.fill();
    sCtx.stroke();
    sCtx.restore();
  }

  startAnimationLoop() {
    const loop = () => {
      this.updatePhysics();
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
