/**
 * ChainMind Synapse — Neutral Slate Dynamic Visualizers
 * - Plus Jakarta Sans & Space Mono typography
 * - Neutral photon topology with spring physics
 * - Jøsang Barycentric Simplex coordinate tracer (b + d + u = 1)
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
    this.radarAngle = 0;

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

    this.coreNode = {
      x: centerX,
      y: centerY,
      radius: 25,
      pulse: 0,
      isCore: true
    };

    const total = claims.length;
    const radiusOrbit = Math.min(this.width, this.height) * 0.36;

    claims.forEach((claim, idx) => {
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radiusOrbit + (idx % 2 === 0 ? 20 : -15));
      const y = centerY + Math.sin(angle) * (radiusOrbit * 0.75 + (idx % 2 === 0 ? 15 : -10));

      const isConflict = claim.polarity === -1 || claim.revoked;

      this.nodes.push({
        ...claim,
        x,
        y,
        vx: 0,
        vy: 0,
        angle,
        orbitRadius: radiusOrbit,
        radius: 17,
        isConflict
      });
    });

    this.particles = [];
    this.nodes.forEach(n => {
      const count = 4;
      for (let i = 0; i < count; i++) {
        this.particles.push({
          sourceNode: n,
          progress: i / count,
          speed: 0.005 + Math.random() * 0.003,
          size: 2.2
        });
      }
    });
  }

  updatePhysics() {
    const time = performance.now() * 0.001;

    this.radarAngle += 0.015;

    if (this.coreNode) {
      this.coreNode.pulse = Math.sin(time * 2.5) * 3;
    }

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

    // 1. Neutral Radar Circles
    [80, 160, 240].forEach(r => {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    });

    // 2. Sweeping Radar Line
    const scanX = cx + Math.cos(this.radarAngle) * 240;
    const scanY = cy + Math.sin(this.radarAngle) * 180;
    const radarGrad = this.ctx.createLinearGradient(cx, cy, scanX, scanY);
    radarGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    radarGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(scanX, scanY);
    this.ctx.strokeStyle = radarGrad;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // 3. Synaptic Lines
    this.nodes.forEach(n => {
      this.ctx.beginPath();
      this.ctx.moveTo(n.x, n.y);
      this.ctx.lineTo(cx, cy);
      this.ctx.strokeStyle = n.isConflict ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)';
      this.ctx.lineWidth = 1;
      if (n.isConflict) this.ctx.setLineDash([4, 4]);
      else this.ctx.setLineDash([]);
      this.ctx.stroke();
    });

    // 4. White Photons
    this.particles.forEach(p => {
      const n = p.sourceNode;
      const px = n.x + (cx - n.x) * p.progress;
      const py = n.y + (cy - n.y) * p.progress;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 6;
      this.ctx.fill();
      this.ctx.restore();
    });

    // 5. Consensus Core
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.coreNode.radius + 12 + this.coreNode.pulse, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.coreNode.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#13171f';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '700 11px "Space Mono"';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('CORE', cx, cy);
    this.ctx.restore();

    // 6. Ingested Nodes
    this.nodes.forEach(n => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#1a202b';
      this.ctx.strokeStyle = n.isConflict ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.25)';
      this.ctx.lineWidth = 1.5;
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '700 10px "Space Mono"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(n.chainName.substring(0, 3).toUpperCase(), n.x, n.y);

      this.ctx.font = '500 11px "Plus Jakarta Sans"';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText(n.topic, n.x, n.y + n.radius + 13);
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

    const pad = 24;
    const topX = w / 2;
    const topY = pad + 6;
    const leftX = pad + 10;
    const leftY = h - pad;
    const rightX = w - pad - 10;
    const rightY = h - pad;

    // Ternary Outline
    sCtx.save();
    sCtx.beginPath();
    sCtx.moveTo(topX, topY);
    sCtx.lineTo(leftX, leftY);
    sCtx.lineTo(rightX, rightY);
    sCtx.closePath();
    sCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    sCtx.lineWidth = 1;
    sCtx.stroke();

    // Internal Altitudes
    sCtx.beginPath();
    sCtx.moveTo(topX, topY);
    sCtx.lineTo((leftX + rightX) / 2, leftY);
    sCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    sCtx.stroke();

    // Corner Labels
    sCtx.font = '500 10px "Space Mono"';
    sCtx.textAlign = 'center';
    sCtx.fillStyle = '#94a3b8';
    sCtx.fillText('u=1 (Uncertainty)', topX, topY - 6);
    sCtx.fillText('d=1 (Disbelief)', leftX + 15, leftY + 14);
    sCtx.fillText('b=1 (Belief)', rightX - 15, rightY + 14);

    // Barycentric coordinates
    const b = this.currentOpinion.b || 0;
    const d = this.currentOpinion.d || 0;
    const u = this.currentOpinion.u || 0;

    const px = b * rightX + d * leftX + u * topX;
    const py = b * rightY + d * leftY + u * topY;

    // Coordinate pointer
    sCtx.beginPath();
    sCtx.arc(px, py, 4.5, 0, Math.PI * 2);
    sCtx.fillStyle = '#ffffff';
    sCtx.shadowColor = '#ffffff';
    sCtx.shadowBlur = 10;
    sCtx.fill();

    sCtx.beginPath();
    sCtx.arc(px, py, 9, 0, Math.PI * 2);
    sCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    sCtx.lineWidth = 1;
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
