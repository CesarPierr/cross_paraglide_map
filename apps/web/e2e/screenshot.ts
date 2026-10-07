/**
 * Smoke test + screenshots in headless Chromium (SwiftShader WebGL).
 * Usage: npx tsx apps/web/e2e/screenshot.ts [url] [outDir]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'test-results';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [];
page.on('console', (m) => {
  const t = m.text();
  if ((m.type() === 'error' || m.type() === 'warning') && !/AJAXError|Failed to load resource|ERR_TUNNEL/.test(t)) errors.push(`[${m.type()}] ${t.slice(0, 300)}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const shot = async (name: string) => page.screenshot({ path: `${out}/${name}.png` });
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
try {
  await page.waitForSelector('.status.ok', { timeout: 120000 });
  console.log('ready after', Date.now() - t0, 'ms');
} catch {
  console.log('NOT ready:', await page.locator('.topbar').textContent());
}
// Imagery hosts may be unreachable in CI: use the self-contained relief basemap.
await page.getByRole('button', { name: 'Affichage' }).click();
await page.getByRole('radio', { name: 'Relief' }).click();
await page.getByRole('button', { name: 'Affichage' }).click();
await page.waitForTimeout(5000);
await shot('01-overview');

await page.evaluate('location.hash = "#11.3/45.32/5.93/-25/66"');
await page.waitForTimeout(6000);
await shot('02-gresivaudan');
await page.mouse.click(720, 560);
await page.waitForTimeout(2000);
await shot('03-probe');
await page.locator('.probe-card .close').click();

await page.getByRole('button', { name: /Chartreuse/ }).first().click();
await page.waitForTimeout(3500);
await shot('04-massif');
await page.locator('.items li button').first().click();
await page.waitForTimeout(3000);
await shot('05-feature');

await page.getByRole('button', { name: 'Ouest', exact: true }).click();
await page.getByRole('radio', { name: /Au vent/ }).check();
await page.waitForTimeout(3000);
await shot('06-west-exposure');

await page.getByRole('radio', { name: /Potentiel thermique/ }).check();
await page.evaluate('location.hash = "#9.6/45.05/6.2/20/60"');
await page.waitForTimeout(6000);
await shot('07-thermal');

console.log(errors.slice(0, 30).join('\n') || 'no console errors');
await browser.close();
