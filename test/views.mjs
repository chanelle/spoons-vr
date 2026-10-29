// Screenshots at several window sizes. Usage: node test/views.mjs URL OUTDIR
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sizes = { desktop: [1440, 860], laptop: [1180, 760], phone: [390, 844], tablet: [820, 1180] };
const errors = [];
for (const [name, [w, h]] of Object.entries(sizes)) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(name + ': ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__spoons);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}-morning.png` });
  await page.evaluate(() => { const S = window.__spoons; S.startDay('yellow'); S.handle(S.G.step(S.s, 60)); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}-play.png` });
  await page.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
