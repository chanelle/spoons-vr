// SPOONS: hands-first seated WebXR game. Spend your spoons, survive the day.
import * as THREE from 'three';
import * as G from './game.js';
import * as A from './art.js';
import { sfx, unlockAudio } from './audio.js';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';

const V = THREE.Vector3;
const tmp = new V(), tmp2 = new V();

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 30);
scene.add(new THREE.HemisphereLight(0xd6d0ff, 0x140c28, 0.7));
const sun = new THREE.DirectionalLight(0xfff4ea, 1.3);
sun.position.set(0.4, 2.5, 0.8);
scene.add(sun);
const rim = new THREE.PointLight(0x8f6bff, 1.2, 3);
rim.position.set(0, 1.0, -1.0);
scene.add(rim);

// Sky: aurora, floor grid and stars. Hidden in passthrough so the real room shows.
const sky = new THREE.Group();
const aurora = A.makeAurora();
const floorGrid = A.makeFloorGrid();
floorGrid.position.y = 0.002;
sky.add(aurora, floorGrid, A.makeStars());
scene.add(sky);

// Everything lives in `root`, positioned at the player's eyes. Seated, two-foot radius.
const root = new THREE.Group();
const DESK_ROOT = new V(0, 1.2, 0);
root.position.copy(DESK_ROOT);
scene.add(root);

// Two layouts. "wide" is the headset and landscape layout: everything within ~60 cm.
// "tall" stacks things for portrait phones and narrow windows.
const LAYOUTS = {
  wide: {
    tray: [0, -0.36, -0.36], slots: [[-0.235, -0.1, -0.47], [0, -0.06, -0.5], [0.235, -0.1, -0.47]],
    shelf: [-0.43, -0.31, -0.3], bowl: [0.43, -0.34, -0.3], pillow: [0.27, -0.36, -0.19], jar: [-0.27, -0.39, -0.19],
    hud: [0, 0.17, -0.62], big: [0, 0.0, -0.53], orbY: -0.17, orbGap: 0.14, shelfRot: 0.6, cardScale: 1,
    labels: { shelf: [0, 0.15, 0], bowl: [0, 0.09, 0], pillow: [0, -0.06, 0.03], jar: [0, 0.125, 0] },
    view: { c: [0, -0.17, -0.4], hw: 0.6, hh: 0.41 },
  },
  tall: {
    tray: [0, -0.34, -0.4], slots: [[0, 0.13, -0.52], [0, -0.045, -0.51], [0, -0.22, -0.5]],
    shelf: [-0.13, -0.57, -0.38], bowl: [0.13, -0.58, -0.38], pillow: [0.13, -0.76, -0.33], jar: [-0.13, -0.78, -0.33],
    hud: [0, 0.27, -0.6], big: [0, 0.0, -0.53], orbY: -0.2, orbGap: 0.13, shelfRot: 0.2, cardScale: 1.3,
    labels: { shelf: [0, 0.15, 0], bowl: [0, 0.09, 0], pillow: [0, 0.085, 0], jar: [0, 0.125, 0] },
    view: { c: [0, -0.25, -0.45], hw: 0.27, hh: 0.58 },
  },
};
const L = {
  tray: new V(), slots: [new V(), new V(), new V()], shelf: new V(), bowl: new V(),
  pillow: new V(), jar: new V(), hud: new V(), big: new V(), orbY: -0.17, orbGap: 0.14, cardScale: 1, name: '',
};

// In XR the viewer is at root's origin; on desktop it's the camera.
const headWorld = () => (renderer.xr.isPresenting ? root.localToWorld(tmp2.set(0, 0, 0)) : tmp2.copy(camera.position));
function faceHead(obj) { obj.lookAt(headWorld()); }

// ---------- registry of interactive things ----------
const grabs = [];
function reg(type, obj, id, radius) {
  const e = { type, obj, id, radius };
  obj.traverse((o) => { o.userData.g = e; });
  grabs.push(e);
  return e;
}
function unreg(e) { const i = grabs.indexOf(e); if (i >= 0) grabs.splice(i, 1); }
const PICKABLE = new Set(['spoon', 'card', 'pillow', 'jar', 'orb']);

// ---------- static furniture ----------
const tray = A.makeTray(); root.add(tray);
const shelf = A.makeShelf(); root.add(shelf);
reg('zone-tomorrow', shelf, 'shelf', 0.16);
const shelfLabel = A.makeLabel('TOMORROW', 0.16, A.C.green); root.add(shelfLabel);
const bowl = A.makeBowl(); root.add(bowl);
reg('zone-letgo', bowl, 'bowl', 0.16);
const bowlLabel = A.makeLabel('LET GO', 0.13, A.C.tan); root.add(bowlLabel);
const pillow = A.makePillow(); root.add(pillow);
const pillowE = reg('pillow', pillow, 'pillow', 0.09);
const ring = A.makeRing(); root.add(ring);
const pillowLabel = A.makeLabel('HOLD TO REST', 0.16, A.C.lavender); root.add(pillowLabel);
const jar = A.makeJar(); root.add(jar);
reg('jar', jar, 'jar', 0.07);
const jarLabel = A.makeLabel('BORROW', 0.13, A.C.amber); root.add(jarLabel);
const hud = new A.Panel(0.4, 0.075, 1024); root.add(hud.mesh);
const big = new A.Panel(0.46, 0.27, 1024); root.add(big.mesh);

function applyLayout(name, force = false) {
  if (L.name === name && !force) return;
  const cfg = LAYOUTS[name];
  L.name = name;
  for (const k of ['tray', 'shelf', 'bowl', 'pillow', 'jar', 'hud', 'big']) L[k].fromArray(cfg[k]);
  cfg.slots.forEach((a, i) => L.slots[i].fromArray(a));
  L.orbY = cfg.orbY; L.orbGap = cfg.orbGap; L.cardScale = cfg.cardScale * (renderer.xr.isPresenting || name === 'tall' ? 1 : 1.2);
  const lo = (k) => new V().fromArray(cfg.labels[k]);
  tray.position.copy(L.tray);
  shelf.position.copy(L.shelf); shelf.rotation.y = name === 'wide' ? cfg.shelfRot : cfg.shelfRot;
  shelfLabel.position.copy(L.shelf).add(lo('shelf'));
  bowl.position.copy(L.bowl); bowlLabel.position.copy(L.bowl).add(lo('bowl'));
  pillow.position.copy(L.pillow); ring.position.copy(L.pillow).add(new V(0, 0.032, 0));
  pillowLabel.position.copy(L.pillow).add(lo('pillow'));
  jar.position.copy(L.jar); jarLabel.position.copy(L.jar).add(lo('jar'));
  hud.mesh.position.copy(L.hud);
  big.mesh.position.copy(L.big);
  for (const v of cardViews.values()) { v.home.copy(L.slots[v.slot]); v.m.scale.setScalar(L.cardScale); }
  orbs.forEach((o) => { o.mesh.position.set(o.idx * L.orbGap, L.orbY, -0.44); o.label.position.set(o.idx * L.orbGap, L.orbY - 0.055, -0.44); });
  tomorrowPile.forEach((m, i) => m.position.copy(L.shelf).add(new V(0, 0.035 + i * 0.012, 0.01)));
  if (s) layoutTray();
}

// Frame the whole table for any window shape (desktop and phones).
function fitCamera() {
  if (renderer.xr.isPresenting) return;
  const aspect = innerWidth / innerHeight;
  applyLayout(aspect < 0.85 ? 'tall' : 'wide');
  const v = LAYOUTS[L.name].view;
  const f = THREE.MathUtils.degToRad(camera.fov / 2);
  const d = Math.max(v.hh / Math.tan(f), v.hw / (Math.tan(f) * aspect)) * 1.05 + 0.08;
  const tilt = 0.36;
  const c = root.localToWorld(new V().fromArray(v.c));
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.position.copy(c).add(new V(0, Math.sin(tilt) * d, Math.cos(tilt) * d));
  camera.lookAt(c);
}

// ---------- game state ----------
let s = null; // game.js state
let mode = 'read'; // read | play | end
let pendingPrev = null; // previous day (for carry-over)
let replaySeed = null;
let toast = { text: '', until: 0 };
let now = 0;
let paused = false;
const spoonViews = new Map();
const cardViews = new Map();
const tomorrowPile = [];
const tweens = [];
const orbs = [];

function say(text, secs = 3.5) { toast = { text, until: now + secs }; }

// ---------- orbs (menus) ----------
function clearOrbs() { for (const o of orbs) { root.remove(o.mesh, o.label); unreg(o.e); } orbs.length = 0; }
function addOrb(color, label, idx, action) {
  const x = idx * L.orbGap, y = L.orbY;
  const mesh = A.makeOrb(color);
  mesh.position.set(x, y, -0.44);
  root.add(mesh);
  const lbl = A.makeLabel(label, 0.13);
  lbl.position.set(x, y - 0.055, -0.44);
  faceHead(lbl);
  root.add(lbl);
  const e = reg('orb', mesh, label, 0.06);
  e.action = action;
  orbs.push({ mesh, label: lbl, e, idx });
}

function showRead() {
  mode = 'read';
  clearOrbs();
  big.mesh.visible = true;
  A.drawText(big, [
    { text: 'Good morning.', size: 64, weight: 600, serif: true, gap: 10 },
    { text: "How's your body today? Pinch one.", size: 42 },
    ...(pendingPrev && pendingPrev.borrowed ? [{ text: `You borrowed ${pendingPrev.borrowed} yesterday. You start ${pendingPrev.borrowed * G.BORROW_INTEREST} short.`, size: 34, color: A.C.must }] : []),
    ...(pendingPrev && pendingPrev.tomorrow.length ? [{ text: `${pendingPrev.tomorrow.length} thing${pendingPrev.tomorrow.length === 1 ? ' is' : 's are'} waiting from yesterday.`, size: 34, color: A.C.mint }] : []),
  ]);
  addOrb(0x4be38a, 'GOOD-ISH', -1, () => startDay('green'));
  addOrb(0xffb03a, 'CAREFUL', 0, () => startDay('yellow'));
  addOrb(0xff4f5e, 'FLARE', 1, () => startDay('red'));
}

function startDay(read) {
  clearOrbs();
  big.mesh.visible = false;
  for (const v of spoonViews.values()) root.remove(v.m);
  for (const v of cardViews.values()) root.remove(v.m);
  for (const m of tomorrowPile) root.remove(m);
  spoonViews.clear(); cardViews.clear(); tomorrowPile.length = 0;
  for (const e of grabs.slice()) if (e.type === 'spoon' || e.type === 'card') unreg(e);
  s = pendingPrev ? G.nextDay(pendingPrev, read) : G.createDay({ seed: replaySeed ?? G.dailySeed(), read });
  replaySeed = null;
  for (const sp of s.spoons) addSpoon(sp, L.tray.clone().add(new V(0, 0.25, 0)));
  layoutTray();
  mode = 'play';
  document.dispatchEvent(new Event('spoons:start'));
  say(`${G.READS[read].label}. ${s.spoons.length} spoons. Spend them well.`, 4);
  sfx.done();
}

function showEnd(sum) {
  mode = 'end';
  big.mesh.visible = true;
  const lines = [
    { text: '10:00 PM. The day is over.', size: 54, weight: 600, serif: true, gap: 8 },
    { text: `Done ${sum.done}  ·  Tomorrow ${sum.tomorrow}  ·  Missed ${sum.missed}  ·  Let go ${sum.dropped}`, size: 36 },
    { text: `Joy ${sum.joy}  ·  Rested ${sum.rested}x${sum.borrowed ? `  ·  Borrowed ${sum.borrowed} (owe ${sum.owed})` : ''}`, size: 36, gap: 8 },
    ...sum.consequences.slice(0, 3).map((t) => ({ text: t, size: 32, color: A.C.must })),
    { text: sum.selah, size: 38, italic: true, serif: true, color: A.C.mint },
  ];
  A.drawText(big, lines);
  const prev = s;
  addOrb(0x5fe3b0, 'NEXT MORNING', -0.65, () => { pendingPrev = prev; showRead(); });
  addOrb(0xa98bff, 'REPLAY TODAY', 0.65, () => { pendingPrev = null; replaySeed = prev.seed; showRead(); });
}

// ---------- spoons ----------
function addSpoon(sp, from) {
  const m = A.makeSpoon(sp.borrowed);
  root.add(m);
  m.position.copy(from || L.tray);
  A.setBent(m, sp.bent);
  const e = reg('spoon', m, sp.id, 0.05);
  spoonViews.set(sp.id, { m, e, home: L.tray.clone(), held: false });
}
function layoutTray() {
  const n = s.spoons.length;
  const gap = Math.min(0.026, 0.34 / Math.max(n, 1));
  s.spoons.forEach((sp, i) => {
    const v = spoonViews.get(sp.id);
    if (v) v.home = L.tray.clone().add(new V((i - (n - 1) / 2) * gap, 0.012, 0));
  });
}

// ---------- cards ----------
function freeSlot() {
  const used = new Set([...cardViews.values()].filter((v) => !v.leaving).map((v) => v.slot));
  return [1, 0, 2].find((i) => !used.has(i)) ?? 0;
}
function addCard(d) {
  const slot = freeSlot();
  const p = A.makeCard(d);
  const m = p.mesh;
  root.add(m);
  m.position.copy(L.slots[slot]).add(new V(0, 0.22, 0));
  m.scale.setScalar(L.cardScale);
  faceHead(m);
  const e = reg('card', m, d.id, 0.11);
  cardViews.set(d.id, { p, m, e, slot, home: L.slots[slot].clone(), held: false });
}
function retireCard(id, how) {
  const v = cardViews.get(id);
  if (!v) return;
  unreg(v.e);
  v.leaving = true;
  cardViews.delete(id);
  if (how === 'tomorrow') {
    const to = L.shelf.clone().add(new V(0, 0.035 + tomorrowPile.length * 0.012, 0.01));
    tomorrowPile.push(v.m);
    tween(v.m, to, 0.42, 0.45, false);
  } else if (how === 'letgo') {
    tween(v.m, L.bowl.clone().add(new V(0, 0.02, 0)), 0.05, 0.5, true);
  } else if (how === 'done') {
    tween(v.m, v.m.position.clone().add(new V(0, 0.18, -0.05)), 1.15, 0.7, true);
  } else if (how === 'missed') {
    tween(v.m, v.m.position.clone().add(new V(0, -0.25, 0.02)), 0.8, 0.9, true);
  }
}
function tween(obj, to, scale, dur, removeAfter) {
  tweens.push({ obj, from: obj.position.clone(), to, s0: obj.scale.x, s1: scale, dur, t: 0, removeAfter });
}

// ---------- events from game.js ----------
function handle(evs) {
  for (const e of evs) {
    switch (e.type) {
      case 'spawn': addCard(e.demand); sfx.pick(); break;
      case 'paid': {
        const v = spoonViews.get(e.spoonId);
        const c = cardViews.get(e.demand.id);
        if (v) { unreg(v.e); spoonViews.delete(e.spoonId); tween(v.m, c ? c.m.position.clone() : v.m.position.clone(), 0.2, 0.25, true); }
        if (c) A.drawCard(c.p, c.p.demand.age / c.p.demand.life, false);
        sfx.clink();
        layoutTray();
        break;
      }
      case 'done': retireCard(e.demand.id, 'done'); sfx.done(); say(e.demand.kind === 'want' ? 'That one was for you.' : `Done: ${e.demand.title}.`); break;
      case 'deferred': retireCard(e.demand.id, 'tomorrow'); sfx.defer(); say('Moved to tomorrow. It will be back.'); break;
      case 'dropped': retireCard(e.demand.id, 'letgo'); sfx.drop(); say(e.demand.kind === 'must' ? `Let go. ${e.demand.miss}` : 'Let go. That is allowed.'); break;
      case 'missed': retireCard(e.demand.id, 'missed'); sfx.missed(); say(`Missed: ${e.demand.title}. ${e.demand.miss}`); break;
      case 'flare':
        for (const id of e.spoonIds) { const v = spoonViews.get(id); if (v) A.setBent(v.m, true); }
        sfx.flare();
        say(e.spoonIds.length ? `Flare. ${e.spoonIds.length} spoon${e.spoonIds.length > 1 ? 's' : ''} bent. Rest straightens them.` : 'Flare. Nothing left to bend.', 4.5);
        break;
      case 'straightened': { const v = spoonViews.get(e.spoonId); if (v) A.setBent(v.m, false); sfx.rest(); say('A spoon straightened out.'); break; }
      case 'recovered': { addSpoon(s.spoons.find((x) => x.id === e.spoonId), L.pillow.clone()); layoutTray(); sfx.rest(); say('Rest gave one back.'); break; }
      case 'rested-full': say('Tray is full. Resting anyway counts.'); break;
      case 'borrowed': { addSpoon(s.spoons.find((x) => x.id === e.spoonId), L.jar.clone().add(new V(0, 0.05, 0))); layoutTray(); sfx.borrow(); say(`Borrowed from tomorrow. It costs ${G.BORROW_INTEREST} back.`); break; }
      case 'end':
        for (const id of [...cardViews.keys()]) retireCard(id, 'tomorrow');
        showEnd(e.summary);
        break;
      default: break;
    }
  }
}

// ---------- pointers: hands, controllers, mouse ----------
const pointers = new Map();
function pointer(id, kind) {
  if (!pointers.has(id)) pointers.set(id, { id, kind, pos: new V(), pinch: false, was: false, held: null, hover: null, active: false });
  return pointers.get(id);
}

const hands = [0, 1].map((i) => { const h = renderer.xr.getHand(i); scene.add(h); return h; });
const tipMat = new THREE.MeshBasicMaterial({ color: 0xf3eee3 });
const handDots = hands.map(() => {
  const d = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), tipMat.clone());
  d.visible = false; scene.add(d); return d;
});
const controllers = [0, 1].map((i) => {
  const c = renderer.xr.getControllerGrip(i);
  c.userData.select = false;
  c.addEventListener('connected', (ev) => { c.userData.source = ev.data; });
  c.addEventListener('disconnected', () => { c.userData.source = null; });
  scene.add(c);
  const ray = renderer.xr.getController(i);
  ray.addEventListener('selectstart', () => { c.userData.select = true; });
  ray.addEventListener('selectend', () => { c.userData.select = false; });
  scene.add(ray);
  return c;
});

function updateXRPointers() {
  hands.forEach((h, i) => {
    const p = pointer(`hand${i}`, 'hand');
    const it = h.joints && h.joints['index-finger-tip'];
    const th = h.joints && h.joints['thumb-tip'];
    p.active = !!(it && th && it.visible !== false && renderer.xr.isPresenting);
    handDots[i].visible = p.active;
    if (!p.active) { p.pinch = false; return; }
    const a = it.getWorldPosition(tmp), b = th.getWorldPosition(new V());
    const dist = a.distanceTo(b);
    p.pos.copy(a).add(b).multiplyScalar(0.5);
    p.pinch = p.pinch ? dist < 0.04 : dist < 0.02; // hysteresis
    handDots[i].position.copy(p.pos);
    handDots[i].material.color.set(p.pinch ? 0xd9a441 : 0xf3eee3);
  });
  controllers.forEach((c, i) => {
    const p = pointer(`ctrl${i}`, 'ctrl');
    const src = c.userData.source;
    p.active = !!(src && !src.hand && renderer.xr.isPresenting);
    if (!p.active) { p.pinch = false; return; }
    c.getWorldPosition(p.pos);
    p.pinch = c.userData.select;
  });
}

// Mouse/touch: lets judges and the emulator play on desktop too.
const mouse = { ndc: new THREE.Vector2(), down: false, edge: false, inside: false };
const ray = new THREE.Raycaster();
const dragPlane = new THREE.Plane();
renderer.domElement.addEventListener('pointermove', (e) => { mouse.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouse.inside = true; });
renderer.domElement.addEventListener('pointerdown', (e) => { unlockAudio(); mouse.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouse.down = true; mouse.edge = true; mouse.inside = true; });
addEventListener('pointerup', () => { mouse.down = false; });

function rayHits(exclude) {
  ray.setFromCamera(mouse.ndc, camera);
  const objs = grabs.filter((e) => e !== exclude).map((e) => e.obj);
  return ray.intersectObjects(objs, true).map((h) => ({ e: h.object.userData.g, point: h.point })).filter((h) => h.e);
}

function updateMousePointer() {
  const p = pointer('mouse', 'mouse');
  p.active = !renderer.xr.isPresenting && mouse.inside;
  if (!p.active) { p.pinch = false; return; }
  if (p.held && (p.held.type === 'spoon' || p.held.type === 'card')) {
    ray.setFromCamera(mouse.ndc, camera);
    ray.ray.intersectPlane(dragPlane, p.pos);
    p.hover = null;
  } else {
    const hit = rayHits().find((h) => PICKABLE.has(h.e.type));
    p.hover = hit ? hit.e : null;
    if (hit) p.pos.copy(hit.point);
  }
  p.pinch = mouse.down || mouse.edge; // a quick click between frames still counts
  mouse.edge = false;
}

function nearest(pos, types, exclude) {
  let best = null, bd = Infinity;
  for (const e of grabs) {
    if (e === exclude || !types.has(e.type)) continue;
    const d = e.obj.getWorldPosition(tmp).distanceTo(pos);
    if (d < e.radius && d < bd) { bd = d; best = e; }
  }
  return best;
}

function heldBy(e) { for (const p of pointers.values()) if (p.held === e) return p; return null; }

function press(p) {
  const target = p.kind === 'mouse' ? p.hover : nearest(p.pos, PICKABLE);
  if (!target || heldBy(target)) return;
  unlockAudio();
  if (target.type === 'orb') { sfx.pick(); target.action(); return; }
  if (mode !== 'play') return;
  if (target.type === 'jar') { handle(G.borrow(s)); return; }
  p.held = target;
  if (target.type === 'spoon' || target.type === 'card') {
    sfx.pick();
    if (p.kind === 'mouse') {
      dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new V()).negate(), target.obj.getWorldPosition(new V()));
    }
  }
}

const SPOON_DROP = new Set(['card']);
const CARD_DROP = new Set(['zone-tomorrow', 'zone-letgo']);
function dropTarget(p, types) {
  if (p.kind === 'mouse') {
    const hit = rayHits(p.held).find((h) => types.has(h.e.type));
    if (hit) return hit.e;
  }
  const pos = p.held.obj.getWorldPosition(new V());
  return nearest(pos, types, p.held);
}

function release(p) {
  const e = p.held;
  p.held = null;
  if (!e) return;
  if (e.type === 'pillow') { if (s) G.stopRest(s); A.setRing(ring, 0); return; }
  if (mode !== 'play') return;
  if (e.type === 'spoon') {
    const t = dropTarget(Object.assign({}, p, { held: e }), SPOON_DROP);
    if (t) {
      const evs = G.pay(s, t.id, e.id);
      if (evs[0].type === 'reject') { sfx.reject(); say('A bent spoon cannot carry anything. Rest first.'); }
      handle(evs);
    }
  } else if (e.type === 'card') {
    const t = dropTarget(Object.assign({}, p, { held: e }), CARD_DROP);
    if (t && t.type === 'zone-tomorrow') handle(G.defer(s, e.id));
    else if (t && t.type === 'zone-letgo') handle(G.drop(s, e.id));
  }
}

// ---------- XR session ----------
const btn = document.getElementById('enter');
let xrMode = null, needsRecenter = false, xrFrames = 0;
async function setupXR() {
  if (!navigator.xr) { btn.textContent = 'Desktop mode: drag with your mouse'; btn.disabled = true; return; }
  const ar = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  const vr = await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  xrMode = ar ? 'immersive-ar' : vr ? 'immersive-vr' : null;
  if (!xrMode) { btn.textContent = 'Desktop mode: drag with your mouse'; btn.disabled = true; return; }
  btn.textContent = ar ? 'Enter with your hands (passthrough)' : 'Enter VR with your hands';
  btn.onclick = async () => {
    unlockAudio();
    try {
      const session = await navigator.xr.requestSession(xrMode, { optionalFeatures: ['local-floor', 'hand-tracking'] });
      session.addEventListener('visibilitychange', () => { paused = session.visibilityState !== 'visible'; });
      session.addEventListener('end', onSessionEnd);
      await renderer.xr.setSession(session);
      applyLayout('wide', true);
      if (xrMode === 'immersive-ar') { sky.visible = false; renderer.setClearColor(0x000000, 0); }
      needsRecenter = true; xrFrames = 0;
      document.body.classList.add('in-xr');
    } catch (err) { console.warn('[SPOONS] XR failed', err); btn.textContent = 'Could not start XR. Desktop mode is on.'; }
  };
}
function onSessionEnd() {
  sky.visible = true;
  root.position.copy(DESK_ROOT);
  root.rotation.set(0, 0, 0);
  L.name = '';
  fitCamera();
  paused = false;
  document.body.classList.remove('in-xr');
}
function recenter() {
  const xrCam = renderer.xr.getCamera();
  const pos = new V().setFromMatrixPosition(xrCam.matrixWorld);
  const dir = new V(0, 0, -1).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(xrCam.matrixWorld));
  root.position.copy(pos);
  root.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
}
setupXR();

// ---------- frame loop ----------
const clock = new THREE.Clock();
let hudTimer = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  now += dt;
  if (renderer.xr.isPresenting && needsRecenter && ++xrFrames > 3) { recenter(); needsRecenter = false; }

  updateXRPointers();
  updateMousePointer();

  // press / release edges
  for (const p of pointers.values()) {
    if (p.active && p.pinch && !p.was) press(p);
    if ((!p.pinch || !p.active) && p.was) release(p);
    p.was = p.active && p.pinch;
  }

  // game time
  if (mode === 'play' && !paused) {
    handle(G.step(s, dt));
    const resting = [...pointers.values()].some((p) => p.held === pillowE && p.pinch);
    if (resting && mode === 'play') { handle(G.rest(s, dt)); A.setRing(ring, s.restProgress / G.REST_SECONDS); }
    pillow.scale.y += ((resting ? 0.7 : 1) - pillow.scale.y) * Math.min(1, dt * 10);
  }

  // held objects follow the hand; everything else eases home
  const k = 1 - Math.exp(-dt * 12);
  for (const v of spoonViews.values()) {
    const p = heldBy(v.e);
    if (p) { v.m.position.lerp(root.worldToLocal(p.pos.clone()), 0.6); }
    else v.m.position.lerp(v.home, k);
    const head = v.m.userData.head;
    head.rotation.x += ((v.m.userData.bentTarget || 0) - head.rotation.x) * k;
  }
  for (const v of cardViews.values()) {
    const p = heldBy(v.e);
    const d = v.p.demand;
    if (p) {
      // the heavier the task, the more it sags in your hand
      v.m.position.lerp(root.worldToLocal(p.pos.clone()).add(new V(0, -0.006 * d.cost, 0)), 0.6);
      faceHead(v.m);
      v.m.rotateX(-0.12 * d.cost);
    } else {
      v.m.position.lerp(v.home, k * 0.8);
      faceHead(v.m);
    }
    const hover = [...pointers.values()].some((q) => q.held && q.held.type === 'spoon' && q.held.obj.getWorldPosition(tmp).distanceTo(v.m.getWorldPosition(new V())) < 0.13);
    A.drawCard(v.p, d.age / d.life, hover);
  }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const t = tweens[i];
    t.t += dt;
    const f = Math.min(1, t.t / t.dur), e = 1 - Math.pow(1 - f, 3);
    t.obj.position.lerpVectors(t.from, t.to, e);
    t.obj.scale.setScalar(t.s0 + (t.s1 - t.s0) * e);
    if (f >= 1) { tweens.splice(i, 1); if (t.removeAfter) root.remove(t.obj); }
  }
  // hover feedback
  for (const e of grabs) if (PICKABLE.has(e.type) && e.type !== 'card') {
    const near = [...pointers.values()].some((p) => p.active && !p.held && (p.kind === 'mouse' ? p.hover === e : e.obj.getWorldPosition(tmp).distanceTo(p.pos) < e.radius));
    const base = e.type === 'spoon' ? 1.3 : 1;
    const target = near ? base * 1.12 : base;
    e.obj.scale.x += (target - e.obj.scale.x) * k;
    if (e.type === 'pillow') e.obj.scale.z = e.obj.scale.x; else e.obj.scale.setScalar(e.obj.scale.x);
  }
  for (const o of orbs) o.mesh.position.y = L.orbY + Math.sin(now * 2 + o.idx * 2) * 0.004;
  aurora.userData.update(now);
  root.traverse((o) => { if (o.userData.label || o === hud.mesh || o === big.mesh) faceHead(o); });

  // HUD
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.2;
    const lines = [];
    if (mode === 'play') {
      lines.push({ text: `${G.clock(s)}   ·   ${G.usableSpoons(s)} spoon${G.usableSpoons(s) === 1 ? '' : 's'} usable${s.spoons.length > G.usableSpoons(s) ? `, ${s.spoons.length - G.usableSpoons(s)} bent` : ''}${paused ? '   ·   paused' : ''}`, size: 46, weight: 600 });
    } else if (mode === 'read') lines.push({ text: 'SPOONS', size: 56, weight: 800, color: A.C.mint });
    else lines.push({ text: 'SPOONS', size: 56, weight: 800, color: A.C.mint });
    if (toast.until > now) lines.push({ text: toast.text, size: 38, color: A.C.mint });
    hud.mesh.visible = mode === 'play' || toast.until > now;
    A.drawText(hud, lines);
  }

  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  fitCamera();
});
document.addEventListener('visibilitychange', () => { if (!renderer.xr.isPresenting) paused = document.hidden; });

fitCamera();
showRead();

// test hook (used by the headless smoke test)
window.__spoons = { get s() { return s; }, get mode() { return mode; }, G, startDay, handle, grabs, camera, root, pointers, scene, sky, renderer };
