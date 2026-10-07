/**
 * User journeys in headless Chromium, with screenshots: discover a massif
 * (picker, schema, guided visit), read a place (probe and nearby sources),
 * and the phone layout. Fails on page errors.
 *
 *   npx tsx apps/web/e2e/journeys.ts [url] [outDir]
 *   CHROMIUM_PATH=… to point at a Chromium binary.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:4174/';
const out = process.argv[3] ?? 'test-results/journeys';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors: string[] = [];
const watch = (page: Page) => {
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|AJAXError/.test(m.text())) errors.push(`[console] ${m.text().slice(0, 240)}`);
  });
};
const ready = async (page: Page) => {
  const t0 = Date.now();
  await page.waitForSelector('.status-dot', { timeout: 180000 });
  await page.waitForTimeout(4000);
  console.log('ready after', Date.now() - t0, 'ms');
};

// ---------- Desktop ----------
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
watch(page);
const shot = (name: string) => page.screenshot({ path: `${out}/${name}.png` });
await page.goto(`${url}#9.4/45.3/5.9/-10/50`, { waitUntil: 'domcontentloaded' });
await ready(page);
await shot('d01-home');

await page.getByRole('button', { name: 'Vue schéma' }).click();
await page.waitForTimeout(2500);
await shot('d02-picker');

await page.getByTitle('Massifs').click();
await page.getByRole('button', { name: 'Vue schéma : Chartreuse' }).click();
await page.waitForTimeout(3500);
await shot('d03-schema');

await page.locator('.schema-banner').getByRole('button', { name: 'Présente-moi ce massif' }).click();
await page.waitForTimeout(2500);
await shot('d04-tour-overview');
for (let i = 0; i < 4; i++) {
  await page.locator('.tour').getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(1800);
}
await shot('d05-tour-step5');
const deeper = page.locator('.tour').getByRole('button', { name: /Approfondir/ });
if (await deeper.count()) {
  await deeper.click();
  await page.waitForTimeout(500);
  await shot('d06-tour-deeper');
}
await page.locator('.tour').getByRole('button', { name: 'Quitter la présentation' }).click();
await page.locator('.schema-banner').getByRole('button', { name: 'Vue live' }).click();
await page.waitForTimeout(2500);

await page.mouse.click(800, 500);
await page.waitForTimeout(2500);
await shot('d07-probe');

// ---------- Phone ----------
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
watch(phone);
await phone.goto(`${url}#9.4/45.3/5.9/-10/50`, { waitUntil: 'domcontentloaded' });
await ready(phone);
await phone.screenshot({ path: `${out}/m01-home.png` });
await phone.locator('.mobile-dock').getByRole('button', { name: /Massifs/ }).click();
await phone.waitForTimeout(800);
await phone.screenshot({ path: `${out}/m02-massifs.png` });
await phone.locator('.mobile-dock').getByRole('button', { name: /Vent/ }).click();
await phone.waitForTimeout(800);
await phone.screenshot({ path: `${out}/m03-settings.png` });

await browser.close();
if (errors.length) {
  console.log(errors.join('\n'));
  process.exitCode = 1;
} else console.log('no page errors');
