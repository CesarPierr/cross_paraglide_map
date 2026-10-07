/**
 * User journeys in headless Chromium, with screenshots: welcome, massifs
 * (sector map → massif page → guided visit), a probed point, the conditions
 * and layers panels, cross-country routes, and the phone layout. Fails on page
 * errors.
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
await shot('d00-welcome');
await page.locator('.welcome').getByRole('radio', { name: /Je fais du cross/ }).click();
await page.locator('.welcome').getByRole('button', { name: /Découvrir un massif/ }).click();
await page.waitForTimeout(2500);
await shot('d01-massifs-map');

await page.locator('.sidebar').getByRole('button', { name: /^Chartreuse/ }).first().click();
await page.waitForTimeout(3000);
await shot('d02-massif-tour');
for (let i = 0; i < 5; i++) {
  await page.locator('.tour').getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(1600);
}
await shot('d03-tour-step6');
const deeper = page.locator('.tour').getByRole('button', { name: /Approfondir/ });
if (await deeper.count()) {
  await deeper.click();
  await page.waitForTimeout(500);
  await shot('d04-tour-deeper');
}
await page.locator('.tour').getByRole('button', { name: 'Quitter la présentation' }).click();
await page.waitForTimeout(800);
await shot('d05-massif-page');
await page.getByRole('button', { name: 'Fermer le massif' }).click();
await page.waitForTimeout(1500);

// Live map: a probed point on the Grésivaudan floor.
await page.evaluate('location.hash = "#12.2/45.27/5.86/0/0"');
await page.waitForTimeout(3500);
await page.mouse.click(760, 470);
await page.waitForTimeout(2500);
await shot('d06-probe');
await page.keyboard.press('Escape');

await page.locator('.wind-chip').click();
await page.waitForTimeout(500);
await shot('d07-conditions');
await page.locator('.wind-chip').click();
await page.getByRole('button', { name: /Calques/ }).click();
await page.waitForTimeout(500);
await shot('d08-layers');
await page.getByRole('button', { name: /Calques/ }).click();

// Cross: a documented route read leg by leg, then a traced one.
await page.evaluate('location.hash = "#9.4/45.3/5.9/-10/50"');
await page.getByRole('tab', { name: 'Cross' }).click();
await page.waitForTimeout(600);
await page.locator('.browser .region li button').first().click();
await page.waitForTimeout(3000);
await shot('d09-route-legs');
await page.getByRole('button', { name: 'Fermer l’itinéraire' }).click();
await page.getByRole('button', { name: 'Tracer mon itinéraire' }).click();
for (const [x, y] of [
  [600, 420],
  [700, 380],
  [820, 450],
])
  await page.mouse.click(x, y);
await page.waitForTimeout(1500);
await shot('d10-plan');
await page.close();

// ---------- Phone ----------
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
watch(phone);
await phone.goto(`${url}#9.4/45.3/5.9/-10/50`, { waitUntil: 'domcontentloaded' });
await ready(phone);
await phone.screenshot({ path: `${out}/m00-welcome.png` });
await phone.getByRole('button', { name: 'Juste explorer la carte' }).click();
await phone.waitForTimeout(1000);
await phone.screenshot({ path: `${out}/m01-home.png` });
await phone.locator('.mobile-dock').getByRole('button', { name: /Massifs/ }).click();
await phone.waitForTimeout(2000);
await phone.screenshot({ path: `${out}/m02-massifs.png` });
await phone.locator('.mobile-dock').getByRole('button', { name: /Calques/ }).click();
await phone.waitForTimeout(800);
await phone.screenshot({ path: `${out}/m03-layers.png` });
await phone.locator('.wind-chip').click();
await phone.waitForTimeout(800);
await phone.screenshot({ path: `${out}/m04-conditions.png` });

await browser.close();
if (errors.length) {
  console.log(errors.join('\n'));
  process.exitCode = 1;
} else console.log('no page errors');
