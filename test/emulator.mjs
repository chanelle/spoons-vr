// IWSDK emulator check: enters XR in the IWER emulator (injected by `npm run dev`) and plays with
// emulated hand tracking only (no mouse, no controllers). Prints PASS/FAIL per check, saves 2 stills.
// Usage: SPOONS_HTTP=1 npm run dev   (other shell)   then   node test/emulator.mjs http://localhost:8081/ OUTDIR
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import('/opt/npm-tools/node_modules/playwright/index.mjs')); } catch { ({ chromium } = require('playwright')); } // same Playwright as smoke.mjs, else the project's own

const url = process.argv[2] || 'http://localhost:8081/';
const out = process.argv[3] || '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const external = new Set();
page.on('request', (r) => { const u = new URL(r.url()); if (u.protocol.startsWith('http') && !['localhost', '127.0.0.1'].includes(u.hostname)) external.add(u.origin); });
let fails = 0;
const check = (name, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? '  ' + JSON.stringify(detail) : ''}`); };
const frames = (n = 3) => page.evaluate((n) => new Promise((r) => { const S = window.__spoons; let k = 0; const f = () => (++k >= n ? r() : (S.renderer.xr.getSession() || window).requestAnimationFrame(f)); f(); }), n);

await page.goto(url);
await page.waitForFunction(() => window.__spoons);
check('IWER emulator injected', await page.evaluate(() => !!window.IWER_DEVICE));
check('IWSDK world running', await page.evaluate(() => !!window.__spoons.world && window.__spoons.world.constructor.name.length > 0));
const label = await page.textContent('#enter');
check('passthrough (immersive-ar) offered', /passthrough/.test(label), label);

await page.click('#enter');
await page.waitForFunction(() => window.__spoons.renderer.xr.isPresenting);
await frames(8);
const sess = await page.evaluate(() => { const S = window.__spoons, x = S.renderer.xr, ses = x.getSession(); return {
  blend: ses.environmentBlendMode, features: ses.enabledFeatures, sky: S.sky.visible, clearAlpha: S.renderer.getClearAlpha(),
  root: S.root.position.toArray().map((v) => +v.toFixed(2)), head: S.world.player.head.position.toArray().map((v) => +v.toFixed(2)), inXr: document.body.classList.contains('in-xr') }; });
check('session started through IWSDK (world.session)', await page.evaluate(() => !!window.__spoons.world.session), sess);
check('passthrough: sky hidden, clear alpha 0', sess.sky === false && sess.clearAlpha === 0);
check('table recentred on the seated head', Math.hypot(sess.root[0] - sess.head[0], sess.root[1] - sess.head[1], sess.root[2] - sess.head[2]) < 0.02);
const reach = await page.evaluate(() => { const S = window.__spoons; let m = 0; const h = S.world.player.head.getWorldPosition(new S.root.position.constructor());
  for (const e of S.grabs) m = Math.max(m, e.obj.getWorldPosition(new S.camera.position.constructor()).distanceTo(h)); return +m.toFixed(2); });
check('everything within seated reach (<= 0.65 m of the head)', reach <= 0.65, reach);

// --- emulated hands only ---
await page.evaluate(() => { const d = window.IWER_DEVICE; d.primaryInputMode = 'hand'; });
await frames(8);
const H = 'right', PID = 'hand1';
const hand = (fn, arg) => page.evaluate(([src, H, PID, arg]) => eval(src)(window.IWER_DEVICE.hands[H], window.__spoons.pointers.get(PID), window.__spoons, arg), [fn.toString(), H, PID, arg]);
check('hand tracked by IWSDK input', await hand((h, p, S) => S.world.input.xr.isPrimary('hand', 'right')) && await hand((h, p) => !!p && p.active));
const pinch = async (v) => { await hand((h, p, S, v) => h.updatePinchValue(v), v); await frames(6); };
// The emulated hand changes shape as it pinches, so aim with the closed-pinch offset:
// measured once in empty air, then the hand is placed so the closed pinch lands on the target.
await pinch(1);
const off = await hand((h, p) => ({ x: p.pos.x - h.position.x, y: p.pos.y - h.position.y, z: p.pos.z - h.position.z }));
await pinch(0);
const moveTo = async (t) => {
  await page.evaluate(([H, p]) => window.IWER_DEVICE.remote.dispatch('set_transform', { device: `hand-${H}`, position: p }), [H, { x: t.x - off.x, y: t.y - off.y, z: t.z - off.z }]);
  await frames(6);
};
const posOf = (pred) => page.evaluate((src) => { const S = window.__spoons; const e = S.grabs.find(eval(src)); if (!e) return null; const v = e.obj.getWorldPosition(new S.camera.position.constructor()); return { x: v.x, y: v.y, z: v.z, id: e.id }; }, pred.toString());
const st = () => page.evaluate(() => { const S = window.__spoons, s = S.s; return { mode: S.mode, paused: S.paused, spoons: s?.spoons.length, paid: s?.active[0]?.paid, tomorrow: s?.tomorrow.length, dropped: s?.dropped?.length, borrowed: s?.borrowed, rested: s?.rested, resting: s?.resting, t: s?.t }; });

await moveTo(await posOf((e) => e.type === 'orb' && e.id === 'CAREFUL'));
check('open hand hovering does not select', (await st()).mode === 'read');
await pinch(1); await pinch(0);
check('pinch on CAREFUL starts the day', (await st()).mode === 'play', await st());

await page.evaluate(() => { const S = window.__spoons; S.handle(S.G.step(S.s, 14)); });
await frames(40);
const a = await st();
await moveTo(await posOf((e) => e.type === 'spoon'));
await pinch(1);
check('pinch picks up a spoon', await hand((h, p) => p.held && p.held.type === 'spoon'));
await moveTo(await posOf((e) => e.type === 'card'));
await frames(10);
await page.screenshot({ path: `${out}/emu-01-spoon-over-task.png` });
await pinch(0);
const b = await st();
check('releasing the spoon on a task pays it', b.spoons === a.spoons - 1 && b.paid === 1, { before: a.spoons, after: b.spoons, paid: b.paid });

await moveTo(await posOf((e) => e.type === 'card'));
await pinch(1);
check('pinch picks up a task card', await hand((h, p) => p.held && p.held.type === 'card'));
await moveTo(await posOf((e) => e.type === 'zone-tomorrow'));
await frames(10); await pinch(0);
check('card released on Tomorrow is deferred', (await st()).tomorrow === 1, (await st()).tomorrow);

await page.evaluate(() => { const S = window.__spoons; S.handle(S.G.step(S.s, 40)); });
await frames(40);
if (await posOf((e) => e.type === 'card')) {
  await moveTo(await posOf((e) => e.type === 'card')); await pinch(1);
  await moveTo(await posOf((e) => e.type === 'zone-letgo')); await frames(10); await pinch(0);
  const d = await page.evaluate(() => window.__spoons.G.summary(window.__spoons.s).dropped);
  check('card released on Let go is dropped', d === 1, d);
} else check('card released on Let go is dropped', false, 'no card on the table');

await moveTo(await posOf((e) => e.type === 'jar'));
await pinch(1); await pinch(0);
check('pinch on the jar borrows a spoon', (await st()).borrowed === 1, (await st()).borrowed);

await moveTo(await posOf((e) => e.type === 'pillow'));
await pinch(1);
const r0 = await page.evaluate(() => window.__spoons.G.restFraction(window.__spoons.s));
await page.waitForTimeout(1500); await frames(4);
const r1 = await page.evaluate(() => window.__spoons.G.restFraction(window.__spoons.s));
check('holding a pinch on the pillow rests', r1 > r0, { r0: +r0.toFixed(3), r1: +r1.toFixed(3) });
await pinch(0);
await page.screenshot({ path: `${out}/emu-02-day.png` });

// left hand works too
const left = await page.evaluate(() => { const p = window.__spoons.pointers.get('hand0'); return !!p && p.active; });
check('left hand tracked as well', left);

// controllers still work (trigger = pinch)
await page.evaluate(() => window.IWER_DEVICE.remote.dispatch('set_input_mode', { mode: 'controller' }));
await frames(10);
const ctrl = (fn) => page.evaluate((src) => eval(src)(window.__spoons.pointers.get('ctrl1')), fn.toString());
const cmove = (p) => page.evaluate((p) => window.IWER_DEVICE.remote.dispatch('set_transform', { device: 'controller-right', position: p }), p);
const sp2 = await posOf((e) => e.type === 'spoon');
await cmove(sp2); await frames(6);
const cp = await ctrl((p) => ({ x: p.pos.x, y: p.pos.y, z: p.pos.z, active: p.active }));
await cmove({ x: 2 * sp2.x - cp.x, y: 2 * sp2.y - cp.y, z: 2 * sp2.z - cp.z }); await frames(6);
await page.evaluate(() => window.IWER_DEVICE.remote.dispatch('set_select_value', { device: 'controller-right', value: 1 })); await frames(6);
check('controller trigger picks up a spoon', cp.active && await ctrl((p) => !!p.held && p.held.type === 'spoon'));
await page.evaluate(() => window.IWER_DEVICE.remote.dispatch('set_select_value', { device: 'controller-right', value: 0 })); await frames(6);

// headset off: the day pauses
const t0 = (await st()).t;
const vis = await page.evaluate(() => { const d = window.IWER_DEVICE; if (typeof d.updateVisibilityState !== 'function') return false; d.updateVisibilityState('hidden'); return true; });
if (vis) {
  await page.waitForTimeout(700);
  const hid = await st();
  await page.evaluate(() => window.IWER_DEVICE.updateVisibilityState('visible'));
  await page.waitForTimeout(500);
  check('game pauses while the session is hidden', hid.paused === true, { advanced: +(hid.t - t0).toFixed(2) });
  check('game resumes when visible again', (await st()).paused === false);
} else console.log('SKIP  visibility pause (emulator has no updateVisibilityState)');

// leave XR: desktop view comes back
await page.evaluate(() => window.__spoons.renderer.xr.getSession().end());
await page.waitForFunction(() => !window.__spoons.renderer.xr.isPresenting);
await page.waitForTimeout(600);
const after = await page.evaluate(() => { const S = window.__spoons; return { sky: S.sky.visible, session: !!S.world.session, inXr: document.body.classList.contains('in-xr'), camY: +S.camera.position.y.toFixed(2), mode: S.mode }; });
check('exit XR restores the desktop view and keeps the day', after.sky && !after.session && !after.inXr && after.mode === 'play', after);

const real = errors.filter((e) => !/Failed to load visual asset/.test(e));
check('no page errors', real.length === 0, real.slice(0, 5));
check('no network requests to other hosts', external.size === 0, [...external]);
console.log(fails ? `\n${fails} check(s) FAILED` : '\nALL CHECKS PASSED');
await browser.close();
process.exit(fails ? 1 : 0);
