/**
 * ChainMind Synapse — High-Fidelity Dynamic Visualizers
 * - Neural Ingestion Topology with photon pulses and animated field
 * - Jøsang Barycentric Simplex with animated coordinate tracer and uncertainty contours
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
    this.tracerHistory = [];

    this.mouse = { x: null, y: null, isHovering: false, isDragging: false, draggedNode: null };

    this.init();
  }

  init() {
    this.resize();
    this.bindEvents();
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

      if (this.coreNode) {
        this.coreNode.x = this.width / 2;
        this.coreNode.y = this.height / 2;
      }
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

  bindEvents() {
    if (!this.canvas) return;

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    this.canvas.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
      this.mouse.isHovering = true;

      if (this.mouse.isDragging && this.mouse.draggedNode) {
        this.mouse.draggedNode.x = pos.x;
        this.mouse.draggedNode.y = pos.y;
        this.mouse.draggedNode.vx = 0;
        this.mouse.draggedNode.vy = 0;
      } else {
        const hovered = this.findNodeAt(pos.x, pos.y);
        this.canvas.style.cursor = hovered ? 'pointer' : 'crosshair';
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      const clicked = this.findNodeAt(pos.x, pos.y);
      if (clicked && !clicked.isCore) {
        this.mouse.isDragging = true;
        this.mouse.draggedNode = clicked;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mouseup', () => {
      this.mouse.isDragging = false;
      this.mouse.draggedNode = null;
      if (this.canvas) this.canvas.style.cursor = 'crosshair';
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.isHovering = false;
      this.mouse.x = null;
      this.mouse.y = null;
    });
  }

  findNodeAt(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dist = Math.hypot(n.x - x, n.y - y);
      if (dist <= n.radius + 8) return n;
    }
    return null;
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
      radius: 26,
      pulse: 0,
      isCore: true
    };

    const total = claims.length;
    const radiusOrbit = Math.min(this.width, this.height) * 0.36;

    claims.forEach((claim, idx) => {
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radiusOrbit + (idx % 2 === 0 ? 25 : -20));
      const y = centerY + Math.sin(angle) * (radiusOrbit * 0.75 + (idx % 2 === 0 ? 15 : -10));

      const isConflict = claim.polarity === -1 || claim.revoked;
      const nodeColor = isConflict ? '#ff3366' : '#10b981';

      this.nodes.push({
        ...claim,
        x,
        y,
        vx: 0,
        vy: 0,
        angle,
        orbitRadius: radiusOrbit,
        radius: 18,
        color: nodeColor,
        isConflict
      });
    });

    // Particle flow
    this.particles = [];
    this.nodes.forEach(n => {
      const count = 4;
      for (let i = 0; i < count; i++) {
        this.particles.push({
          sourceNode: n,
          progress: i / count,
          speed: 0.005 + Math.random() * 0.004,
          size: 2.6,
          color: n.color
        });
      }
    });
  }

  updatePhysics() {
    const time = performance.now() * 0.001;

    if (this.coreNode) {
      this.coreNode.pulse = Math.sin(time * 2.5) * 4;
    }

    // Gentle orbital floating & spring physics
    this.nodes.forEach((node, idx) => {
      if (node === this.mouse.draggedNode) return;

      const targetX = (this.width / 2) + Math.cos(node.angle + time * 0.06) * node.orbitRadius;
      const targetY = (this.height / 2) + Math.sin(node.angle + time * 0.06) * (node.orbitRadius * 0.72);

      node.vx += (targetX - node.x) * 0.02;
      node.vy += (targetY - node.y) * 0.02;
      node.vx *= 0.88;
      node.vy *= 0.88;
      node.x += node.vx;
      node.y += node.vy;
    });

    // Flowing particles
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

    // Concentric range grid
    [80, 160, 240].forEach(r => {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    });

    // Synaptic connections
    this.nodes.forEach(n => {
      const midX = (n.x + cx) / 2;
      const midY = (n.y + cy) / 2;
      const offset = 25 * Math.sin(n.angle);

      this.ctx.beginPath();
      this.ctx.moveTo(n.x, n.y);
      this.ctx.quadraticCurveTo(midX + offset, midY - offset, cx, cy);

      const grad = this.ctx.createLinearGradient(n.x, n.y, cx, cy);
      grad.addColorStop(0, n.color + '66');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0.4)');

      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = n.isConflict ? 2 : 1.5;
      if (n.isConflict) this.ctx.setLineDash([5, 4]);
      else this.ctx.setLineDash([]);
      this.ctx.stroke();
    });

    // Flowing photons
    this.particles.forEach(p => {
      const n = p.sourceNode;
      const midX = (n.x + cx) / 2;
      const midY = (n.y + cy) / 2;
      const offset = 25 * Math.sin(n.angle);

      const t = p.progress;
      const cpX = midX + offset;
      const cpY = midY - offset;
      
      const px = (1 - t) * (1 - t) * n.x + 2 * (1 - t) * t * cpX + t * t * cx;
      const py = (1 - t) * (1 - t) * n.y + 2 * (1 - t) * t * cpY + t * t * cy;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
      this.ctx.restore();
    });

    // Consensus Core Node
    this.ctx.save();
    
    // Core Outer Pulse Halo
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.coreNode.radius + 16 + this.coreNode.pulse, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Core Body
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.coreNode.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0b111e';
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 16;
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '600 11.5px "IBM Plex Mono"';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('CORE', cx, cy);
    this.ctx.restore();

    // Ingested Claims Nodes
    this.nodes.forEach(n => {
      this.ctx.save();

      // Outer glow
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, n.radius + 5, 0, Math.PI * 2);
      this.ctx.strokeStyle = n.color + '44';
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      // Node Body
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#111a2d';
      this.ctx.strokeStyle = n.color;
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = n.color;
      this.ctx.shadowBlur = 12;
      this.ctx.fill();
      this.ctx.stroke();

      // Chain Name
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '600 10.5px "IBM Plex Mono"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(n.chainName.substring(0, 3).toUpperCase(), n.x, n.y);

      // Topic Label
      this.ctx.font = '11px "IBM Plex Sans"';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText(n.topic, n.x, n.y + n.radius + 14);

      this.ctx.restore();
    });

    this.drawSimplex();
  }

  drawSimplex() {
    if (!this.simplexCtx) return;
    const sCtx = this.simplexCtx;
    const w = this.simplexWidth;
    const h = this.simplexHeight;

    sCtx.clearRect(0, 0, w, h);

    const pad = 28;
    const topX = w / 2;
    const topY = pad + 8;
    const leftX = pad + 10;
    const leftY = h - pad;
    const rightX = w - pad - 10;
    const rightY = h - pad;

    // Ternary Triangle Fill & Outline
    sCtx.save();
    sCtx.beginPath();
    sCtx.moveTo(topX, topY);
    sCtx.lineTo(leftX, leftY);
    sCtx.lineTo(rightX, rightY);
    sCtx.closePath();

    const triGrad = sCtx.createRadialGradient(w/2, h/2 + 20, 10, w/2, h/2 + 20, 120);
    triGrad.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
    triGrad.addColorStop(1, 'rgba(11, 17, 30, 0.9)');
    sCtx.fillStyle = triGrad;
    sCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    sCtx.lineWidth = 1.5;
    sCtx.fill();
    sCtx.stroke();

    // Altitude lines
    sCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    sCtx.beginPath();
    sCtx.moveTo(topX, topY);
    sCtx.lineTo((leftX + rightX) / 2, leftY);
    sCtx.stroke();

    // Corner Labels
    sCtx.font = '600 10.5px "IBM Plex Mono"';
    sCtx.textAlign = 'center';
    
    sCtx.fillStyle = '#94a3b8';
    sCtx.fillText('u = 1.0 (Uncertainty)', topX, topY - 8);

    sCtx.fillStyle = '#ff4d79';
    sCtx.fillText('d = 1.0 (Disbelief)', leftX + 15, leftY + 16);

    sCtx.fillStyle = '#00f0ff';
    sCtx.fillText('b = 1.0 (Belief)', rightX - 15, rightY + 16);

    // Barycentric coordinates:
    // P = b * Right + d * Left + u * Top
    const b = this.currentOpinion.b || 0;
    const d = this.currentOpinion.d || 0;
    const u = this.currentOpinion.u || 0;

    const px = b * rightX + d * leftX + u * topX;
    const py = b * rightY + d * leftY + u * topY;

    // Draw tracer coordinate line from center
    sCtx.beginPath();
    sCtx.moveTo(w / 2, (topY + leftY) / 2);
    sCtx.lineTo(px, py);
    sCtx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
    sCtx.lineWidth = 1;
    sCtx.setLineDash([3, 3]);
    sCtx.stroke();
    sCtx.setLineDash([]);

    // Draw coordinate pointer with luminous aura
    sCtx.beginPath();
    sCtx.arc(px, py, 6, 0, Math.PI * 2);
    sCtx.fillStyle = '#00f0ff';
    sCtx.shadowColor = '#00f0ff';
    sCtx.shadowBlur = 14;
    sCtx.fill();

    sCtx.beginPath();
    sCtx.arc(px, py, 11, 0, Math.PI * 2);
    sCtx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    sCtx.lineWidth = 1.5;
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
