// Procedural art: frosted glass, chrome spoons, aurora sky. No downloaded assets.
import * as THREE from 'three';

export const C = {
  text: '#f4f2ff', dim: '#bdb8dc', glass: 'rgba(30,30,56,0.58)', edge: 'rgba(225,230,255,0.42)',
  must: '#ff7f6b', should: '#7fe3a6', want: '#7cc4ff',
  amber: '#ffb84d', lavender: '#bba6ff', tan: '#e9c9a4', green: '#62e09a', mint: '#8fe8c0', cyan: '#9ee8ff',
};
const KIND_LABEL = { must: 'MUST', should: 'SHOULD', want: 'WANT' };

// ---------- materials ----------
const chrome = new THREE.MeshStandardMaterial({ color: 0xeef0f8, metalness: 1, roughness: 0.14 });
const bentMat = new THREE.MeshStandardMaterial({ color: 0x7a6474, metalness: 0.6, roughness: 0.55, emissive: 0x2a0812 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc66e, metalness: 1, roughness: 0.2, emissive: 0x3a2200 });
const glass = (color, opacity = 0.24, emissive = 0x000000) => new THREE.MeshPhysicalMaterial({
  color, emissive, metalness: 0, roughness: 0.12, transparent: true, opacity,
  clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide,
});
const lineMat = (color, opacity = 0.9) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
function glowEdges(mesh, color, opacity) {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), lineMat(color, opacity));
  l.position.copy(mesh.position); l.rotation.copy(mesh.rotation); l.scale.copy(mesh.scale);
  l.raycast = () => {};
  return l;
}

// Soft additive halo, faked bloom that also works in a headset.
let glowTex = null;
export function makeGlow(color, size) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size);
  s.raycast = () => {};
  return s;
}

// ---------- spoons ----------
export function makeSpoon(borrowed = false) {
  const g = new THREE.Group();
  const mat = borrowed ? goldMat : chrome;
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.08, 4, 10), mat);
  handle.rotation.x = Math.PI / 2;
  handle.scale.set(1.3, 1, 0.55); // flatten (capsule axis is y before rotation)
  handle.position.z = 0.032;
  g.add(handle);
  const head = new THREE.Group();
  head.position.z = -0.012;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0042, 0.022, 10), mat);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = -0.008;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.017, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  bowl.scale.set(1, 0.42, 1.45);
  bowl.rotation.x = Math.PI;
  bowl.position.set(0, 0.004, -0.036);
  head.add(neck, bowl);
  g.add(head);
  // generous invisible hit box so mice, touch and fingertips catch a thin spoon
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.03, 0.14), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.z = 0.01;
  g.add(hit);
  g.userData.head = head;
  g.userData.parts = [handle, neck, bowl];
  g.userData.baseMat = mat;
  return g;
}
export function setBent(spoon, bent) {
  spoon.userData.bentTarget = bent ? 0.95 : 0;
  for (const p of spoon.userData.parts) p.material = bent ? bentMat : spoon.userData.baseMat;
}

// ---------- canvas panels ----------
export class Panel {
  constructor(w, h, px = 1024) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = px;
    this.canvas.height = Math.round(px * (h / w));
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
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
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

// Frosted glass slab: tinted fill, top sheen, hairline edge, optional colored glow.
function glassSlab(ctx, W, H, r, glow) {
  const pad = glow ? 26 : 6;
  if (glow) { ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 30; roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, r); ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fill(); ctx.restore(); }
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, r);
  const f = ctx.createLinearGradient(0, pad, 0, H - pad);
  f.addColorStop(0, 'rgba(58,58,96,0.66)'); f.addColorStop(1, 'rgba(20,20,40,0.6)');
  ctx.fillStyle = f; ctx.fill();
  ctx.save(); ctx.clip();
  const s = ctx.createLinearGradient(pad, pad, W * 0.6, H * 0.7);
  s.addColorStop(0, 'rgba(255,255,255,0.16)'); s.addColorStop(0.45, 'rgba(255,255,255,0.03)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  roundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, r);
  ctx.lineWidth = 3; ctx.strokeStyle = glow || C.edge; ctx.stroke();
  return pad;
}

function spoonGlyph(ctx, x, y, s, filled, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = filled ? color : 'rgba(255,255,255,0.16)';
  if (filled) { ctx.shadowColor = color; ctx.shadowBlur = 16; }
  ctx.beginPath(); ctx.ellipse(0, -s * 0.55, s * 0.28, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  roundRect(ctx, -s * 0.07, -s * 0.2, s * 0.14, s * 0.9, s * 0.07); ctx.fill();
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
  const pad = glassSlab(ctx, W, H, 34, hover ? C.amber : kc);
  const x = pad + 30;
  ctx.font = '700 30px system-ui, sans-serif';
  const lbl = KIND_LABEL[d.kind];
  const lw = ctx.measureText(lbl).width + 30;
  roundRect(ctx, x, pad + 26, lw, 44, 22); ctx.fillStyle = kc + '33'; ctx.fill();
  ctx.fillStyle = kc; ctx.fillText(lbl, x + 15, pad + 59);
  if (d.carried) { ctx.fillStyle = C.dim; ctx.fillText('FROM YESTERDAY', x + lw + 16, pad + 59); }
  ctx.fillStyle = C.text;
  ctx.font = `600 ${d.title.length > 22 ? 50 : 58}px Georgia, serif`;
  wrap(ctx, d.title, x, pad + 136, W - x * 2, d.title.length > 22 ? 56 : 64);
  for (let i = 0; i < d.cost; i++) spoonGlyph(ctx, x + 22 + i * 54, H - pad - 62, 50, i < d.paid, kc);
  roundRect(ctx, x, H - pad - 34, W - x * 2, 12, 6); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  roundRect(ctx, x, H - pad - 34, Math.max(12, (W - x * 2) * (1 - ttl)), 12, 6);
  ctx.fillStyle = ttl > 0.75 ? C.must : kc; ctx.fill();
  p.update();
}

export function drawText(p, lines, { bg = true, align = 'center' } = {}) {
  const key = JSON.stringify(lines);
  if (key === p.key) return;
  p.key = key;
  const ctx = p.ctx, W = p.W, H = p.H;
  ctx.clearRect(0, 0, W, H);
  if (bg) glassSlab(ctx, W, H, 44, null);
  ctx.textAlign = align;
  const x = align === 'center' ? W / 2 : 60;
  const total = lines.reduce((a, l) => a + (l.size || 40) * 1.35 + (l.gap || 0), 0);
  let y = Math.max(50, (H - total) / 2) + (lines[0]?.size || 40);
  for (const l of lines) {
    ctx.fillStyle = l.color || C.text;
    ctx.font = `${l.italic ? 'italic ' : ''}${l.weight || 500} ${l.size || 40}px ${l.serif ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
    y = wrap(ctx, l.text, x, y, W - 120, (l.size || 40) * 1.3) + (l.gap || 0);
  }
  ctx.textAlign = 'left';
  p.update();
}

export function makeLabel(text, w = 0.14, color = C.text) {
  const p = new Panel(w, w * 0.24, 512);
  const ctx = p.ctx;
  let size = 76;
  const font = () => `800 ${size}px system-ui, sans-serif`;
  ctx.font = font();
  while (ctx.measureText(text).width > p.W - 50 && size > 20) { size -= 4; ctx.font = font(); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.fillText(text, p.W / 2, p.H / 2);
  ctx.shadowBlur = 0;
  ctx.fillText(text, p.W / 2, p.H / 2);
  p.update();
  p.mesh.userData.label = true;
  p.mesh.raycast = () => {};
  return p.mesh;
}

// ---------- furniture ----------
export function makeTray() {
  const g = new THREE.Group();
  const mat = glass(0xd6ecff, 0.2);
  const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m, glowEdges(m, 0x9ee8ff, 0.85)); };
  add(new THREE.BoxGeometry(0.38, 0.01, 0.15), 0, 0, 0);
  for (const z of [-0.075, 0.075]) add(new THREE.BoxGeometry(0.38, 0.02, 0.008), 0, 0.012, z);
  for (const x of [-0.19, 0.19]) add(new THREE.BoxGeometry(0.008, 0.02, 0.15), x, 0.012, 0);
  // faint grid etched into the glass floor
  const pts = [];
  for (let i = 1; i < 12; i++) { const x = -0.18 + i * 0.03; pts.push(x, 0.0055, -0.07, x, 0.0055, 0.07); }
  for (let i = 1; i < 5; i++) { const z = -0.07 + i * 0.028; pts.push(-0.18, 0.0055, z, 0.18, 0.0055, z); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const etch = new THREE.LineSegments(gg, lineMat(0x9ee8ff, 0.22)); etch.raycast = () => {}; g.add(etch);
  const glow = makeGlow(0x7fd8ff, 0.5); glow.position.y = -0.02; glow.material.opacity = 0.18; g.add(glow);
  return g;
}

export function makeShelf() {
  const g = new THREE.Group();
  const mat = glass(0x62e09a, 0.38, 0x0c3a22);
  const parts = [
    [new THREE.BoxGeometry(0.2, 0.012, 0.14), 0, 0, 0],
    [new THREE.BoxGeometry(0.2, 0.1, 0.01), 0, 0.05, -0.07],
    [new THREE.BoxGeometry(0.2, 0.012, 0.05), 0, 0.035, -0.045],
  ];
  for (const [geo, x, y, z] of parts) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m, glowEdges(m, 0x62e09a, 0.9)); }
  const glow = makeGlow(0x62e09a, 0.3); glow.material.opacity = 0.28; glow.position.y = 0.02; g.add(glow);
  return g;
}

function platform(color, emissive, glowColor) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 40, 20), new THREE.MeshPhysicalMaterial({
    color, emissive, roughness: 0.45, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.55,
  }));
  m.scale.set(1.3, 0.42, 0.9);
  const glow = makeGlow(glowColor, 0.28); glow.material.opacity = 0.4; glow.position.y = -0.01;
  g.add(glow, m);
  g.userData.body = m;
  return g;
}
export function makeBowl() { return platform(0xc8925e, 0x1a0e04, 0xffb46a); }
export function makePillow() { return platform(0x8d6cf0, 0x170c3a, 0x9a7cff); }

export function makeJar() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.085, 36, 1, true), glass(0xffd6a0, 0.22));
  shell.position.y = 0.0425;
  for (const y of [0.002, 0.083]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0012, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
    ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffb340, emissive: 0xff8a1a, emissiveIntensity: 0.8, roughness: 0.3 }));
  ball.position.y = 0.032;
  const glow = makeGlow(0xffa940, 0.16); glow.position.y = 0.032;
  g.add(shell, ball, glow);
  return g;
}

export function makeOrb(color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 20), new THREE.MeshPhysicalMaterial({
    color, emissive: new THREE.Color(color).multiplyScalar(0.28), roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.7,
  }));
  const glow = makeGlow(color, 0.15);
  glow.material.opacity = 0.45;
  m.add(glow);
  return m;
}

export function makeRing() {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.085, 0.095, 48, 1, 0, 0.0001),
    new THREE.MeshBasicMaterial({ color: 0xd8ccff, side: THREE.DoubleSide, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2;
  return m;
}
export function setRing(ring, frac) {
  ring.geometry.dispose();
  ring.geometry = new THREE.RingGeometry(0.085, 0.095, 48, 1, Math.PI / 2, Math.max(0.0001, frac * Math.PI * 2));
}

// ---------- environment (hidden in passthrough) ----------
// Aurora painted once into a small texture, then drifted by rotating two layers.
// Far cheaper than a full-screen noise shader, which matters on a headset.
function auroraCanvas(w, h, seed, withBase) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7 + seed * 17.3) * 43758.5453; return v - Math.floor(v); };
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c2 = hash(ix, iy + 1), e = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c2 - a) * uy + (a - b - c2 + e) * ux * uy;
  };
  const fbm = (x, y) => { let v = 0, amp = 0.5; for (let i = 0; i < 4; i++) { v += amp * noise(x, y); x *= 2.03; y *= 2.03; amp *= 0.5; } return v; };
  for (let j = 0; j < h; j++) {
    const el = Math.cos((j / (h - 1)) * Math.PI); // +1 top, -1 bottom
    for (let i = 0; i < w; i++) {
      const az = (i / w) * Math.PI * 2;
      const ax = Math.cos(az) * 1.6, ay = Math.sin(az) * 1.6; // seamless around the circle
      const warp = fbm(ax + 4, ay + seed);
      const r1 = 0.1 + Math.sin(az * 3 + warp * 5) * 0.08;
      const r2 = 0.27 + Math.sin(az * 2 - warp * 4 + 1.3) * 0.07;
      const streak = 0.45 + 0.55 * fbm(ax * 4 + el * 3, ay * 4);
      const c1 = Math.exp(-((el - r1) ** 2) * 30) * streak;
      const c2 = Math.exp(-((el - r2) ** 2) * 45) * fbm(ax * 3 + 9, ay * 3 + el * 2);
      const mix = fbm(ax * 2 + 2, ay * 2);
      let r = 0, g = 0, b = 0;
      if (withBase) {
        const k = Math.min(1, Math.max(0, (el + 0.4) / 1.1));
        r = 5 + 10 * k; g = 4 + 6 * k; b = 13 + 18 * k;
      }
      r += c1 * (40 + 10 * mix) * 0.9 + c2 * 122 * 0.8;
      g += c1 * (200 - 60 * mix) * 0.9 + c2 * 66 * 0.8;
      b += c1 * (140 + 40 * mix) * 0.9 + c2 * 230 * 0.8;
      const o = (j * w + i) * 4;
      d[o] = Math.min(255, r); d[o + 1] = Math.min(255, g); d[o + 2] = Math.min(255, b); d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
export function makeAurora() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 24),
    new THREE.MeshBasicMaterial({ map: auroraCanvas(512, 256, 1, true), side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false }));
  const veil = new THREE.Mesh(new THREE.SphereGeometry(8.6, 48, 24),
    new THREE.MeshBasicMaterial({ map: auroraCanvas(512, 256, 7, false), side: THREE.BackSide, depthWrite: false, toneMapped: false, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending }));
  g.add(base, veil);
  g.traverse((o) => { o.raycast = () => {}; });
  g.userData.update = (t) => { base.rotation.y = t * 0.004; veil.rotation.y = -t * 0.007; veil.material.opacity = 0.35 + 0.15 * Math.sin(t * 0.25); };
  return g;
}

export function makeFloorGrid() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec2 vP;
      void main(){
        vec2 g = abs(fract(vP / 0.5 - 0.5) - 0.5) / fwidth(vP / 0.5);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float fade = 1.0 - smoothstep(0.8, 5.0, length(vP));
        gl_FragColor = vec4(0.45, 0.85, 0.95, line * fade * 0.14);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mat);
  m.rotation.x = -Math.PI / 2;
  m.raycast = () => {};
  return m;
}

export function makeStars(n = 700) {
  const pos = [];
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 5 + Math.random() * 3;
    const s = Math.sqrt(1 - u * u);
    pos.push(r * s * Math.cos(th), Math.abs(r * u) * 0.9 + 0.2, r * s * Math.sin(th));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.025, transparent: true, opacity: 0.7, depthWrite: false }));
  p.raycast = () => {};
  return p;
}
