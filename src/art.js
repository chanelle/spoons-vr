// Procedural art: no downloaded assets, so cold start is instant.
import * as THREE from 'three';

export const C = {
  cream: '#f3eee3', ink: '#2b2a26', olive: '#6b6f3a', wood: '#8b6a4a',
  must: '#b5573b', should: '#6b6f3a', want: '#5b7c99', amber: '#d9a441', lavender: '#a99bc4',
};
const KIND_LABEL = { must: 'MUST', should: 'SHOULD', want: 'WANT' };

const steel = new THREE.MeshStandardMaterial({ color: 0xdedad0, metalness: 0.55, roughness: 0.28, emissive: 0x1b1a17 });
const bentMat = new THREE.MeshStandardMaterial({ color: 0x7d7364, metalness: 0.3, roughness: 0.6 });
const amberMat = new THREE.MeshStandardMaterial({ color: 0xe2b35a, metalness: 0.5, roughness: 0.3, emissive: 0x3a2a08 });

export function makeSpoon(borrowed = false) {
  const g = new THREE.Group();
  const mat = borrowed ? amberMat : steel;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.004, 0.085), mat);
  handle.position.z = 0.03;
  g.add(handle);
  const head = new THREE.Group(); // pivots when the spoon bends
  head.position.z = -0.012;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.004, 0.02), mat);
  neck.position.z = -0.01;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.017, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  bowl.scale.set(1, 0.45, 1.45);
  bowl.rotation.x = Math.PI; // cup faces up
  bowl.position.set(0, 0.004, -0.038);
  head.add(neck, bowl);
  g.add(head);
  g.scale.setScalar(1.3);
  g.userData.head = head;
  g.userData.parts = [handle, neck, bowl];
  g.userData.baseMat = mat;
  return g;
}

export function setBent(spoon, bent) {
  spoon.userData.bentTarget = bent ? 0.95 : 0;
  for (const p of spoon.userData.parts) p.material = bent ? bentMat : spoon.userData.baseMat;
}

// Canvas-backed text plane.
export class Panel {
  constructor(w, h, px = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = px;
    this.canvas.height = Math.round(px * (h / w));
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false }),
    );
    this.key = '';
  }
  get W() { return this.canvas.width; }
  get H() { return this.canvas.height; }
  update() { this.tex.needsUpdate = true; }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrap(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

function spoonGlyph(ctx, x, y, s, filled, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? color : 'rgba(43,42,38,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.55, s * 0.28, s * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, -s * 0.07, -s * 0.2, s * 0.14, s * 0.9, s * 0.07);
  ctx.fill();
  ctx.restore();
}

export function makeCard(demand) {
  const p = new Panel(0.2, 0.13, 640);
  p.demand = demand;
  drawCard(p, 0, false);
  return p;
}

export function drawCard(p, ttl, hover) {
  const d = p.demand, ctx = p.ctx, W = p.W, H = p.H;
  const key = `${d.paid}|${Math.round(ttl * 40)}|${hover}`;
  if (key === p.key) return;
  p.key = key;
  const kc = C[d.kind];
  ctx.clearRect(0, 0, W, H);
  roundRect(ctx, 6, 6, W - 12, H - 12, 34);
  ctx.fillStyle = C.cream;
  ctx.fill();
  ctx.lineWidth = hover ? 12 : 6;
  ctx.strokeStyle = hover ? C.amber : kc;
  ctx.stroke();
  ctx.fillStyle = kc;
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText(KIND_LABEL[d.kind] + (d.carried ? '  ·  FROM YESTERDAY' : ''), 40, 66);
  ctx.fillStyle = C.ink;
  ctx.font = `600 ${d.title.length > 22 ? 54 : 64}px Georgia, serif`;
  wrap(ctx, d.title, 40, 140, W - 80, d.title.length > 22 ? 60 : 70);
  for (let i = 0; i < d.cost; i++) spoonGlyph(ctx, 64 + i * 58, H - 92, 56, i < d.paid, kc);
  // time left
  roundRect(ctx, 40, H - 40, W - 80, 14, 7);
  ctx.fillStyle = 'rgba(43,42,38,0.12)';
  ctx.fill();
  roundRect(ctx, 40, H - 40, Math.max(14, (W - 80) * (1 - ttl)), 14, 7);
  ctx.fillStyle = ttl > 0.75 ? C.must : C.olive;
  ctx.fill();
  p.update();
}

// Simple multi-line text panel with a soft card background.
export function drawText(p, lines, { bg = 'rgba(243,238,227,0.94)', align = 'center' } = {}) {
  const key = JSON.stringify(lines);
  if (key === p.key) return;
  p.key = key;
  const ctx = p.ctx, W = p.W, H = p.H;
  ctx.clearRect(0, 0, W, H);
  if (bg) { roundRect(ctx, 4, 4, W - 8, H - 8, 40); ctx.fillStyle = bg; ctx.fill(); }
  ctx.textAlign = align;
  const x = align === 'center' ? W / 2 : 50;
  let y = 0;
  const total = lines.reduce((a, l) => a + (l.size || 40) * 1.35, 0);
  y = Math.max(40, (H - total) / 2) + (lines[0]?.size || 40);
  for (const l of lines) {
    ctx.fillStyle = l.color || C.ink;
    ctx.font = `${l.italic ? 'italic ' : ''}${l.weight || 500} ${l.size || 40}px ${l.serif ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
    y = wrap(ctx, l.text, x, y, W - 100, (l.size || 40) * 1.3) + (l.gap || 0);
  }
  ctx.textAlign = 'left';
  p.update();
}

export function makeLabel(text, w = 0.14, color = C.cream) {
  const p = new Panel(w, w * 0.22, 512);
  const ctx = p.ctx;
  let size = 72;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > p.W - 30 && size > 20) { size -= 4; ctx.font = `700 ${size}px system-ui, sans-serif`; }
  ctx.clearRect(0, 0, p.W, p.H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(36,33,28,0.55)';
  ctx.strokeText(text, p.W / 2, p.H / 2);
  ctx.fillStyle = color;
  ctx.fillText(text, p.W / 2, p.H / 2);
  p.update();
  p.mesh.userData.label = true;
  return p.mesh;
}

export function makeTray() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b6a4a, roughness: 0.75 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.012, 0.15), wood);
  g.add(base);
  const lipGeo = new THREE.BoxGeometry(0.38, 0.018, 0.01);
  const sideGeo = new THREE.BoxGeometry(0.01, 0.018, 0.15);
  for (const z of [-0.075, 0.075]) { const m = new THREE.Mesh(lipGeo, wood); m.position.set(0, 0.012, z); g.add(m); }
  for (const x of [-0.19, 0.19]) { const m = new THREE.Mesh(sideGeo, wood); m.position.set(x, 0.012, 0); g.add(m); }
  return g;
}

export function makeShelf() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.14), new THREE.MeshStandardMaterial({ color: 0x6b6f3a, roughness: 0.8 }));
  g.add(m);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.01), m.material);
  back.position.set(0, 0.05, -0.07);
  g.add(back);
  return g;
}

export function makeBowl() {
  const geo = new THREE.SphereGeometry(0.08, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb5a58a, roughness: 0.6, side: THREE.DoubleSide }));
  m.scale.y = 0.55;
  return m;
}

export function makePillow() {
  const geo = new THREE.SphereGeometry(0.06, 32, 16);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xa99bc4, roughness: 0.95 }));
  m.scale.set(1.3, 0.45, 0.9);
  return m;
}

export function makeJar() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.08, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xd9a441, transparent: true, opacity: 0.35, roughness: 0.1, side: THREE.DoubleSide }),
  );
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  glass.position.y = 0.04; glow.position.y = 0.03;
  g.add(glass, glow);
  return g;
}

export function makeOrb(color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 24, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: new THREE.Color(color).multiplyScalar(0.35) }),
  );
}

export function makeRing() {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.085, 0.095, 48, 1, 0, 0.0001),
    new THREE.MeshBasicMaterial({ color: 0xf3eee3, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function setRing(ring, frac) {
  ring.geometry.dispose();
  ring.geometry = new THREE.RingGeometry(0.085, 0.095, 48, 1, Math.PI / 2, Math.max(0.0001, frac * Math.PI * 2));
}
