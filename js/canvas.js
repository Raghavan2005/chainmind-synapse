/**
 * ChainMind Synapse - Dynamic Neural Visualizer & Physics Engine
 * Features:
 * - Monochromatic stealth palette with bioluminescent hyper-teal highlights
 * - Interactive click shockwave ripples
 * - Sweeping radar scanlines and concentric pulse rings
 * - Dynamic photon packets with glowing trailing tails
 * - Real-time waveform entropy oscillator
 */

export class SynapseCanvas {
  constructor(canvasElement, onNodeSelect) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onNodeSelect = onNodeSelect;
    
    this.nodes = [];
    this.particles = [];
    this.ripples = [];
    this.coreNode = null;
    this.mouse = { x: null, y: null, isHovering: false, isDragging: false, draggedNode: null };
    this.radarAngle = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();

    // Waveform oscillator canvas
    this.waveCanvas = document.getElementById('waveform-canvas');
    this.waveCtx = this.waveCanvas ? this.waveCanvas.getContext('2d') : null;
    this.wavePhase = 0;
    
    this.initCanvas();
    this.bindEvents();
    this.startAnimationLoop();
  }

  initCanvas() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
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

  bindEvents() {
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

      // Update global mouse spotlight
      const spot = document.getElementById('mouse-spotlight');
      if (spot) {
        spot.style.left = e.clientX + 'px';
        spot.style.top = e.clientY + 'px';
      }

      if (this.mouse.isDragging && this.mouse.draggedNode) {
        this.mouse.draggedNode.x = pos.x;
        this.mouse.draggedNode.y = pos.y;
        this.mouse.draggedNode.vx = 0;
        this.mouse.draggedNode.vy = 0;
      } else {
        const hovered = this.findNodeAt(pos.x, pos.y);
        this.canvas.style.cursor = hovered ? 'pointer' : 'crosshair';
        if (hovered && this.onNodeSelect) {
          this.onNodeSelect(hovered, e.clientX, e.clientY);
        } else if (!hovered && this.onNodeSelect) {
          this.onNodeSelect(null);
        }
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      const clicked = this.findNodeAt(pos.x, pos.y);
      
      // Spawn shockwave ripple
      this.ripples.push({
        x: pos.x,
        y: pos.y,
        radius: 5,
        maxRadius: 160,
        alpha: 0.9,
        speed: 4
      });

      if (clicked && !clicked.isCore) {
        this.mouse.isDragging = true;
        this.mouse.draggedNode = clicked;
        this.canvas.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mouseup', () => {
      this.mouse.isDragging = false;
      this.mouse.draggedNode = null;
      this.canvas.style.cursor = 'crosshair';
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mouse.isHovering = false;
      this.mouse.x = null;
      this.mouse.y = null;
      if (this.onNodeSelect) this.onNodeSelect(null);
    });
  }

  findNodeAt(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      const dist = Math.hypot(n.x - x, n.y - y);
      if (dist <= n.radius + 8) return n;
    }
    if (this.coreNode) {
      const dist = Math.hypot(this.coreNode.x - x, this.coreNode.y - y);
      if (dist <= this.coreNode.radius + 12) return this.coreNode;
    }
    return null;
  }

  loadState(claims) {
    this.nodes = [];
    this.particles = [];
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // AI Core Node
    this.coreNode = {
      id: 'core-ai',
      title: 'ChainMind AI Arbiter',
      chain: 'Consensus Core',
      type: 'AI Engine',
      x: centerX,
      y: centerY,
      radius: 28,
      pulse: 0,
      isCore: true,
      color: '#00f5a0'
    };

    const total = claims.length;
    const radiusOrbit = Math.min(this.width, this.height) * 0.36;

    claims.forEach((claim, idx) => {
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * (radiusOrbit + (idx % 2 === 0 ? 25 : -15));
      const y = centerY + Math.sin(angle) * (radiusOrbit * 0.75 + (idx % 2 === 0 ? 15 : -10));

      let nodeColor = '#00f5a0'; // Teal Valid
      if (claim.status === 'Revoked') nodeColor = '#ff4757';
      if (claim.status === 'Under Dispute' || claim.status === 'Expired') nodeColor = '#94a3b8';

      const node = {
        ...claim,
        x: x,
        y: y,
        vx: 0,
        vy: 0,
        radius: 18,
        angle: angle,
        orbitRadius: radiusOrbit,
        color: nodeColor
      };

      this.nodes.push(node);
    });

    this.initSynapseParticles();
  }

  initSynapseParticles() {
    this.particles = [];
    this.nodes.forEach((node) => {
      const count = 4;
      for (let i = 0; i < count; i++) {
        this.particles.push({
          sourceNode: node,
          progress: i / count,
          speed: 0.006 + Math.random() * 0.004,
          size: 2.5,
          color: node.color,
          trail: []
        });
      }
    });
  }

  updatePhysics() {
    const time = performance.now() * 0.001;

    // Radar scan rotation
    this.radarAngle += 0.02;

    // Pulse core
    if (this.coreNode) {
      this.coreNode.pulse = Math.sin(time * 3) * 4;
    }

    // Update Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += r.speed;
      r.alpha -= 0.015;
      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
      }
    }

    // Nodes gentle orbital floating
    this.nodes.forEach((node, idx) => {
      if (node === this.mouse.draggedNode) return;

      const targetX = (this.width / 2) + Math.cos(node.angle + time * 0.08) * node.orbitRadius;
      const targetY = (this.height / 2) + Math.sin(node.angle + time * 0.08) * (node.orbitRadius * 0.72);

      node.vx += (targetX - node.x) * 0.02;
      node.vy += (targetY - node.y) * 0.02;
      node.vx *= 0.88;
      node.vy *= 0.88;
      node.x += node.vx;
      node.y += node.vy;
    });

    // Update particle flow & trailing tails
    this.particles.forEach((p) => {
      p.progress += p.speed;
      if (p.progress >= 1) {
        p.progress = 0;
        p.trail = [];
      }
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (!this.coreNode) return;

    const cx = this.coreNode.x;
    const cy = this.coreNode.y;

    // 1. Draw Concentric Radar Scan Grid
    this.ctx.save();
    [80, 160, 240].forEach((r) => {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    });

    // Sweeping Radar Line
    const scanX = cx + Math.cos(this.radarAngle) * 240;
    const scanY = cy + Math.sin(this.radarAngle) * 180;
    const radarGrad = this.ctx.createLinearGradient(cx, cy, scanX, scanY);
    radarGrad.addColorStop(0, 'rgba(0, 245, 160, 0.25)');
    radarGrad.addColorStop(1, 'rgba(0, 245, 160, 0)');
    
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy);
    this.ctx.lineTo(scanX, scanY);
    this.ctx.strokeStyle = radarGrad;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();

    // 2. Draw Interactive Shockwave Ripples
    this.ripples.forEach((r) => {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(0, 245, 160, ${r.alpha})`;
      this.ctx.lineWidth = 1.5;
      this.ctx.shadowColor = '#00f5a0';
      this.ctx.shadowBlur = 10;
      this.ctx.stroke();
      this.ctx.restore();
    });

    // 3. Draw Synaptic Curves
    this.nodes.forEach((node) => {
      const midX = (node.x + cx) / 2;
      const midY = (node.y + cy) / 2;
      const offset = 25 * Math.sin(node.angle);

      this.ctx.beginPath();
      this.ctx.moveTo(node.x, node.y);
      this.ctx.quadraticCurveTo(midX + offset, midY - offset, cx, cy);
      
      this.ctx.strokeStyle = node.isTampered ? 'rgba(255, 71, 87, 0.4)' : 'rgba(255, 255, 255, 0.08)';
      this.ctx.lineWidth = 1.5;
      if (node.isTampered) {
        this.ctx.setLineDash([5, 5]);
      } else {
        this.ctx.setLineDash([]);
      }
      this.ctx.stroke();
    });

    // 4. Draw Flowing Photons
    this.particles.forEach((p) => {
      const node = p.sourceNode;
      const midX = (node.x + cx) / 2;
      const midY = (node.y + cy) / 2;
      const offset = 25 * Math.sin(node.angle);

      const t = p.progress;
      const cpX = midX + offset;
      const cpY = midY - offset;
      
      const px = (1 - t) * (1 - t) * node.x + 2 * (1 - t) * t * cpX + t * t * cx;
      const py = (1 - t) * (1 - t) * node.y + 2 * (1 - t) * t * cpY + t * t * cy;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.fill();
      this.ctx.restore();
    });

    // 5. Draw Central AI Core
    const core = this.coreNode;
    this.ctx.save();
    
    // Core Outer Pulse
    this.ctx.beginPath();
    this.ctx.arc(core.x, core.y, core.radius + 14 + core.pulse, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(0, 245, 160, 0.2)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Core Solid Body
    this.ctx.beginPath();
    this.ctx.arc(core.x, core.y, core.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0b0d0f';
    this.ctx.strokeStyle = '#00f5a0';
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = 'rgba(0, 245, 160, 0.4)';
    this.ctx.shadowBlur = 16;
    this.ctx.fill();
    this.ctx.stroke();

    // Core Label
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 13px "JetBrains Mono"';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('CORE', core.x, core.y);

    this.ctx.restore();

    // 6. Draw Nodes
    this.nodes.forEach((node) => {
      this.ctx.save();

      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#121518';
      this.ctx.strokeStyle = node.color;
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = node.color;
      this.ctx.shadowBlur = 8;
      this.ctx.fill();
      this.ctx.stroke();

      // Node Label
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 10.5px "Outfit"';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const initial = node.chain.substring(0, 3).toUpperCase();
      this.ctx.fillText(initial, node.x, node.y);

      this.ctx.font = '10px "Outfit"';
      this.ctx.fillStyle = '#64748b';
      this.ctx.fillText(node.type.split(' ')[0], node.x, node.y + node.radius + 13);

      this.ctx.restore();
    });

    // 7. Draw Mini Waveform Oscillator Widget
    this.drawWaveform();
  }

  drawWaveform() {
    if (!this.waveCtx || !this.waveCanvas) return;
    const w = this.waveCanvas.width;
    const h = this.waveCanvas.height;
    
    this.waveCtx.clearRect(0, 0, w, h);
    this.wavePhase += 0.08;

    this.waveCtx.beginPath();
    this.waveCtx.moveTo(0, h / 2);
    
    for (let x = 0; x < w; x++) {
      const y = (h / 2) + Math.sin((x * 0.08) + this.wavePhase) * (h * 0.35);
      this.waveCtx.lineTo(x, y);
    }

    this.waveCtx.strokeStyle = '#00f5a0';
    this.waveCtx.lineWidth = 1.5;
    this.waveCtx.shadowColor = '#00f5a0';
    this.waveCtx.shadowBlur = 6;
    this.waveCtx.stroke();
  }

  startAnimationLoop() {
    const loop = (currentTime) => {
      this.frameCount++;
      if (currentTime - this.lastFpsUpdate >= 500) {
        this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
        this.frameCount = 0;
        this.lastFpsUpdate = currentTime;
        const fpsEl = document.getElementById('canvas-fps-counter');
        if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;
      }

      this.updatePhysics();
      this.draw();
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}
