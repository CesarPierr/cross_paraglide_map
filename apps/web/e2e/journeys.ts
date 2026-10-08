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
// The site tour: a few steps, then skip.
await page.locator('.welcome').getByRole('button', { name: /Visite du site/ }).click();
await page.waitForTimeout(2500);
await shot('d00a-tour-map');
for (let i = 0; i < 3; i++) {
  await page.locator('.site-tour').getByRole('button', { name: 'Suivant' }).click();
  await page.waitForTimeout(2200);
}
await shot('d00b-tour-probe');
await page.locator('.site-tour').getByRole('button', { name: 'Passer' }).click();
await page.waitForTimeout(800);
await page.getByRole('tab', { name: 'Massifs' }).click();
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

// Simulation: the wind chip opens it; the reading of the relief is one tap.
await page.locator('.wind-chip').click();
await page.waitForTimeout(600);
await page.locator('.simulation').getByRole('button', { name: 'Nord', exact: true }).click();
await page.waitForTimeout(2500);
await shot('d07-simulation');
await page.locator('.simulation').getByRole('radio', { name: /Thermique/ }).click();
await page.waitForTimeout(2000);
await shot('d07b-simulation-thermal');
await page.locator('.ui-mode-switch').getByRole('radio', { name: /Explorer/ }).click();
await page.waitForTimeout(800);
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
const pshot = (name: string) => phone.screenshot({ path: `${out}/${name}.png` });
await phone.goto(`${url}#9.4/45.3/5.9/-10/50`, { waitUntil: 'domcontentloaded' });
await ready(phone);
await pshot('m00-welcome');
await phone.getByRole('button', { name: 'Explorer directement' }).click();
await phone.waitForTimeout(1500);
await pshot('m01-home');
// Massifs: the sector map above, the list in the sheet; a visit from the list.
await phone.locator('.mobile-dock').getByRole('button', { name: /Massifs/ }).click();
await phone.waitForTimeout(2500);
await pshot('m02-massifs');
await phone.locator('.sidebar').getByRole('button', { name: /^Chartreuse/ }).first().click();
await phone.waitForTimeout(3500);
await pshot('m03-visit');
// Drag the sheet down to its smallest height: the map gets the screen, the step stays readable.
{
  const grab = phone.locator('.tour .sheet-handle .grab');
  const box = (await grab.boundingBox())!;
  await phone.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await phone.mouse.down();
  await phone.mouse.move(box.x + box.width / 2, box.y + 320, { steps: 8 });
  await phone.mouse.up();
  await phone.waitForTimeout(2200);
  await pshot('m03b-visit-peek');
  await grab.click();
  await phone.waitForTimeout(1200);
}
for (let i = 0; i < 3; i++) {
  await phone.locator('.tour').getByRole('button', { name: 'Suivant' }).click();
  await phone.waitForTimeout(1800);
}
await pshot('m04-visit-step4');
await phone.locator('.tour').getByRole('button', { name: 'Quitter la présentation' }).click();
await phone.waitForTimeout(1500);
await pshot('m05-massif-page');
await phone.locator('.sidebar').getByRole('button', { name: 'Fermer le panneau' }).click();
await phone.waitForTimeout(1500);
await phone.locator('.mobile-dock').getByRole('button', { name: /Calques/ }).click();
await phone.waitForTimeout(800);
await pshot('m06-layers');
await phone.locator('.mobile-dock').getByRole('button', { name: /Calques/ }).click();
await phone.waitForTimeout(600);
await phone.locator('.wind-chip').click();
await phone.waitForTimeout(1200);
await pshot('m07-simulation');
await phone.locator('.mobile-dock').getByRole('button', { name: /Explorer/ }).click();
await phone.waitForTimeout(800);
await pshot('m08-back-to-explore');

await browser.close();
if (errors.length) {
  console.log(errors.join('\n'));
  process.exitCode = 1;
} else console.log('no page errors');
