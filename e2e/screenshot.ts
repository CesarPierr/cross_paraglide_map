/**
 * Smoke test + screenshots in headless Chromium (SwiftShader WebGL).
 * Usage: npx tsx e2e/screenshot.ts [url] [outDir]
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

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
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
try {
  await page.waitForSelector('.status.ok', { timeout: 120000 });
  console.log('model ready after', Date.now() - t0, 'ms');
} catch {
  console.log('model NOT ready; status =', await page.locator('.status').textContent());
  console.log(errors.slice(0, 30).join('\n'));
}
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/01-overview.png` });

// Fly to the Grésivaudan at 15h and probe a point.
await page.evaluate('location.hash = "#11.2/45.33/5.93/-30/68"');
await page.waitForTimeout(6000);
await page.screenshot({ path: `${out}/02-gresivaudan.png` });
await page.mouse.click(720, 520);
await page.waitForTimeout(2500);
await page.screenshot({ path: `${out}/03-probe.png` });

// West wind 25 km/h + exposure overlay.
await page.getByRole('button', { name: 'Ouest', exact: true }).click();
await page.getByRole('radio', { name: /Au vent/ }).check();
await page.waitForSelector('.status.ok', { timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/04-west-exposure.png` });

console.log(errors.slice(0, 40).join('\n'));
await browser.close();
