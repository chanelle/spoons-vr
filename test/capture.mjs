// Captures README media: stills + frame sequences for GIFs.
// Usage: node test/capture.mjs <url> <outdir>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const url = process.argv[2], out = process.argv[3];
fs.mkdirSync(`${out}/frames`, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
await page.goto(url);
await page.waitForFunction(() => window.__spoons);
await page.addStyleTag({ content: '#card{display:none!important}' });
await page.waitForTimeout(600);

let n = 0;
const snap = async (k = 1) => { for (let i = 0; i < k; i++) { await page.screenshot({ path: `${out}/frames/f${String(n++).padStart(4, '0')}.png` }); } };
const at = (pred) => page.evaluate((src) => {
  const S = window.__spoons; const f = eval(src); const e = S.grabs.find(f); if (!e) return null;
  const v = e.obj.getWorldPosition(new e.obj.position.constructor()).project(S.camera);
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
}, pred.toString());
const drag = async (a, b, steps = 10) => {
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await snap();
  for (let i = 1; i <= steps; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps); await snap(); }
  await page.mouse.up(); await snap(4);
};

await page.screenshot({ path: `${out}/morning.png` });
await snap(6);
const orb = await at((e) => e.type === 'orb' && e.id === 'CAREFUL');
await page.mouse.move(orb.x, orb.y); await page.mouse.down(); await page.mouse.up();
await snap(8);
await page.evaluate(() => { const S = window.__spoons; S.handle(S.G.step(S.s, 14)); });
await snap(8);
// pay a card fully
for (let i = 0; i < 2; i++) {
  const sp = await at((e) => e.type === 'spoon');
  const card = await at((e) => e.type === 'card');
  if (!sp || !card) break;
  await drag(sp, card);
}
await snap(8);
await page.evaluate(() => { const S = window.__spoons; S.handle(S.G.step(S.s, 60)); });
await snap(6);
await page.screenshot({ path: `${out}/play.png` });
// toss one to tomorrow
const c2 = await at((e) => e.type === 'card');
const shelf = await at((e) => e.type === 'zone-tomorrow');
if (c2) await drag(c2, shelf, 12);
await snap(6);
// flare
await page.evaluate(() => { const S = window.__spoons; S.s.flareTimes.unshift(S.s.t); S.handle(S.G.step(S.s, 0.01)); });
await snap(10);
await page.screenshot({ path: `${out}/flare.png` });
// rest
const pil = await at((e) => e.type === 'pillow');
await page.mouse.move(pil.x, pil.y); await page.mouse.down();
for (let i = 0; i < 30; i++) { await snap(); await page.waitForTimeout(200); }
await page.mouse.up();
await snap(4);
const gameFrames = n;
// end of day
await page.evaluate(() => { const S = window.__spoons; for (let i = 0; i < 400 && S.s.phase === 'play'; i++) S.handle(S.G.step(S.s, 1)); });
await page.waitForTimeout(1300);
await page.screenshot({ path: `${out}/end.png` });
console.log('frames', gameFrames);
await browser.close();
