/**
 * ChainMind Synapse — Vivid Green & Pure White Visualizer Engine
 * Palette: Emerald Green (#00f59b) & Pure White (#ffffff) on Dark Carbon (#060907)
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
      const nodeColor = isConflict ? '#ffffff' : '#00f59b';

      this.nodes.push({
        ...claim,
        x,
        y,
        vx: 0,
        vy: 0,
        angle,
        orbitRadius: radiusOrbit,
        radius: 17,
        color: nodeColor,
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
          size: 2.4,
          color: n.color
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

    // 1. Radar Circles
    [80, 160, 240].forEach(r => {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(0, 245, 155, 0.035)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    });

    // 2. Green Sweeping Radar Line
    const scanX = cx + Math.cos(this.radarAngle) * 240;
    const scanY = cy + Math.sin(this.radarAngle) * 180;
    const radarGrad = this.ctx.createLinearGradient(cx, cy, scanX, scanY);
    radarGrad.addColorStop(0, 'rgba(0, 245, 155, 0.25)');
    radarGrad.addColorStop(1, 'rgba(0, 245, 155, 0)');
    
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(scanX, scanY);
    this.ctx.strokeStyle = radarGrad;
    this.ctx.lineWidth = 1.2;
    this.ctx.stroke();

    // 3. Synaptic Lines
    this.nodes.forEach(n => {
      const midX = (n.x + cx) / 2;
      const midY = (n.y + cy) / 2;
      const offset = 25 * Math.sin(n.angle);

      this.ctx.beginPath();
      this.ctx.moveTo(n.x, n.y);
      this.ctx.quadraticCurveTo(midX + offset, midY - offset, cx, cy);

      const grad = this.ctx.createLinearGradient(n.x, n.y, cx, cy);
      grad.addColorStop(0, n.color + '55');
      grad.addColorStop(1, 'rgba(0, 245, 155, 0.4)');

      this.ctx.strokeStyle = grad;
      this.ctx.lineWidth = n.isConflict ? 1.8 : 1.2;
      if (n.isConflict) this.ctx.setLineDash([4, 4]);
      else this.ctx.setLineDash([]);
      this.ctx.stroke();
    });

    // 4. Flowing Green/White Photons
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
      this.ctx.shadowBlur = 8;
      this.ctx.fill();
      this.ctx.restore();
    });

    // 5. Emerald Green Consensus Core
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.coreNode.radius + 12 + this.coreNode.pulse, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(0, 245, 155, 0.25)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(cx, cy, this.coreNode.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0d1410';
    this.ctx.strokeStyle = '#00f59b';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = '#00f59b';
    this.ctx.shadowBlur = 14;
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '700 11px "Space Mono"';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('CORE', cx, cy);
    this.ctx.restore();

    // 6. Ingested Nodes (Green & White)
    this.nodes.forEach(n => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#131c17';
      this.ctx.strokeStyle = n.color;
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = n.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = '700 10px "Space Mono"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const initial = n.chainName.substring(0, 3).toUpperCase();
      this.ctx.fillText(initial, n.x, n.y);

      this.ctx.font = '600 11px "Plus Jakarta Sans"';
      this.ctx.fillStyle = '#a7f3d0';
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
    sCtx.strokeStyle = 'rgba(0, 245, 155, 0.15)';
    sCtx.lineWidth = 1.2;
    sCtx.fillStyle = 'rgba(13, 20, 16, 0.7)';
    sCtx.fill();
    sCtx.stroke();

    // Corner Labels
    sCtx.font = '600 10px "Space Mono"';
    sCtx.textAlign = 'center';
    
    sCtx.fillStyle = '#a7f3d0';
    sCtx.fillText('u=1 (Uncertainty)', topX, topY - 6);

    sCtx.fillStyle = '#ffffff';
    sCtx.fillText('d=1 (Disbelief)', leftX + 18, leftY + 14);

    sCtx.fillStyle = '#00f59b';
    sCtx.fillText('b=1 (Belief)', rightX - 18, rightY + 14);

    // Barycentric coordinates
    const b = this.currentOpinion.b || 0;
    const d = this.currentOpinion.d || 0;
    const u = this.currentOpinion.u || 0;

    const px = b * rightX + d * leftX + u * topX;
    const py = b * rightY + d * leftY + u * topY;

    // Emerald Coordinate pointer
    sCtx.beginPath();
    sCtx.arc(px, py, 5, 0, Math.PI * 2);
    sCtx.fillStyle = '#00f59b';
    sCtx.shadowColor = '#00f59b';
    sCtx.shadowBlur = 10;
    sCtx.fill();

    sCtx.beginPath();
    sCtx.arc(px, py, 10, 0, Math.PI * 2);
    sCtx.strokeStyle = 'rgba(0, 245, 155, 0.4)';
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
