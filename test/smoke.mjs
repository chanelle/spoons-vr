// Headless smoke test: plays part of a day with the mouse and saves screenshots.
// Usage: node test/smoke.mjs <url> <outdir>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';

const url = process.argv[2] || 'http://127.0.0.1:8765/';
const out = process.argv[3] || '.';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
const frames = (n = 2) => page.evaluate((n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await page.waitForFunction(() => window.__spoons, null, { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/01-morning.png` });

// screen position of a grabbable
const screenOf = (pred) => page.evaluate((src) => {
  const S = window.__spoons; const f = eval(src);
  const e = S.grabs.find(f); if (!e) return null;
  const v = e.obj.getWorldPosition(new e.obj.position.constructor()).project(S.camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, id: e.id };
}, pred.toString());
const drag = async (a, b) => {
  await page.mouse.move(a.x, a.y); await frames(2);
  await page.mouse.down(); await frames(2);
  for (let i = 1; i <= 4; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 4, a.y + (b.y - a.y) * i / 4); await frames(1); }
  await frames(2); await page.mouse.up(); await frames(3);
};
const click = async (a) => { await page.mouse.move(a.x, a.y); await frames(2); await page.mouse.down(); await frames(2); await page.mouse.up(); await frames(3); };

const orb = await screenOf((e) => e.type === 'orb' && e.id === 'CAREFUL');
await click(orb);
const mode = await page.evaluate(() => window.__spoons.mode);
console.log('mode after orb:', mode);
// fast-forward until a card is up
await page.evaluate(() => { const S = window.__spoons; S.handle(S.G.step(S.s, 14)); });
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/02-first-task.png` });

const card = await screenOf((e) => e.type === 'card');
const st0 = await page.evaluate(() => ({ spoons: window.__spoons.s.spoons.length, cost: window.__spoons.s.active[0]?.cost, title: window.__spoons.s.active[0]?.title }));
console.log('before pay', st0);
const sp = await screenOf((e) => e.type === 'spoon');
await drag(sp, card);
const st1 = await page.evaluate(() => ({ spoons: window.__spoons.s.spoons.length, paid: window.__spoons.s.active[0]?.paid, done: window.__spoons.s.done.length }));
console.log('after one spoon', st1);
await page.screenshot({ path: `${out}/03-paid.png` });

// spawn more, defer one to tomorrow
await page.evaluate(() => { const S = window.__spoons; S.handle(S.G.step(S.s, 40)); });
await page.waitForTimeout(900);
const card2 = await screenOf((e) => e.type === 'card');
const shelf = await screenOf((e) => e.type === 'zone-tomorrow');
await drag(card2, shelf);
console.log('tomorrow:', await page.evaluate(() => window.__spoons.s.tomorrow.length));

// borrow, then force a flare by bending, then rest
const jar = await screenOf((e) => e.type === 'jar');
await click(jar);
console.log('borrowed:', await page.evaluate(() => window.__spoons.s.borrowed));
await page.evaluate(() => { const S = window.__spoons; S.s.flareTimes.unshift(S.s.t); S.handle(S.G.step(S.s, 0.01)); });
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/04-flare.png` });
const pil = await screenOf((e) => e.type === 'pillow');
await page.mouse.move(pil.x, pil.y); await frames(2); await page.mouse.down(); await frames(2);
await page.waitForTimeout(3200);
await page.screenshot({ path: `${out}/05-resting.png` });
await page.waitForTimeout(3300);
await page.mouse.up();
console.log('rested:', await page.evaluate(() => window.__spoons.s.rested));

// end the day
await page.evaluate(() => { const S = window.__spoons; for (let i = 0; i < 400 && S.s.phase === 'play'; i++) S.handle(S.G.step(S.s, 1)); });
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/06-end.png` });
console.log('mode end:', await page.evaluate(() => window.__spoons.mode), await page.evaluate(() => JSON.stringify(window.__spoons.G.summary(window.__spoons.s))));
const next = await screenOf((e) => e.type === 'orb' && e.id === 'NEXT MORNING');
await click(next);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/07-next-morning.png` });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
