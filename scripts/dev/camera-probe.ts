/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Where MapLibre draws the landscape from vs where the game puts the eye: standing on a
 * take-off and beside a slope (Château Nardent's east face, ~43°), first and third person,
 * the head (or the chase camera) turned all around. MapLibre used to lift its camera
 * wherever its near plane cut into the relief (up to 50 m): the landscape rose and sank
 * around the pilot as the head turned. PASS: no lift (≤ 0.5 m), the eye ≥ 1 m off the ground.
 *
 *   npx tsx scripts/dev/camera-probe.ts [--url http://localhost:5174/] [--out dir]
 *
 * Needs the dev server (window.__game). CHROMIUM_PATH points at a Chrome binary.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const url = opt('--url', 'http://localhost:5174/');
const out = opt('--out', 'test-results/camera-probe');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'warning' && m.text().includes('[terrain]')) errors.push(m.text());
});

async function start(mode: 'air' | 'forward') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate((mode) => {
    localStorage.setItem('brises.game', JSON.stringify({ takeoffId: 'chartreuse/st-hilaire-sud-nord', month0: 7, hour: 14.5, randomWeather: false, windFrom: 250, windKmh: 14, instability: 0.7, humidity: 0.5, showThermals: false, view: 'first', wing: 'B', mass: 95, routeId: null, multi: false, room: '', pilotName: '', start: mode }));
    localStorage.setItem('brises.welcomed', '1');
  }, mode);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.ui-mode-switch button')].find((x) => x.textContent?.includes('Jeu')) as HTMLButtonElement | undefined;
    b?.click();
  });
  await page.waitForSelector('button.game-go', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('.gt-current')?.textContent?.includes('Saint-Hilaire'), null, { timeout: 30000 });
  await page.click('button.game-go', { noWaitAfter: true });
  await page.waitForSelector('.game-vario', { timeout: 120000 });
  await page.waitForTimeout(3000);
}

let fails = 0;
/** Eight directions of view at the glider's place (held there, `agl` m over the slope, or as it is). */
async function sweep(tag: string, view: 'first' | 'third', agl: number | null) {
  const lift: number[] = [];
  const clear: number[] = [];
  for (let k = 0; k < 8; k++) {
    const r = await page.evaluate(
      `(async () => {
        const g = window.__game;
        const w = g.world;
        const m = w.map;
        g.setView(${JSON.stringify(view)});
        if (${agl} !== null) {
          g.timeScale = 1e-4;
          const [x, y] = g.frame.toXY(5.8384 + 800 / 78600, 45.2805);
          await w.heights.ready(x, y);
          Object.assign(g.glider, { x, y, z: w.heights.at(x, y) + ${agl}, vz: 0, bank: 0, pitch: 0, heading: 0 });
        }
        g.head.yaw = ${(k / 8) * 2 * Math.PI}; g.head.pitch = -0.15;
        await new Promise((r) => setTimeout(r, 1200));
        const tr = m._camera?.transform ?? m.transform;
        const ground = w.heights.at(g.glider.x + w.eye.x, g.glider.y + w.eye.y) ?? NaN;
        return [tr.getCameraAltitude() - (g.glider.z + w.eye.z), tr.getCameraAltitude() - ground];
      })()`,
    ) as [number, number];
    lift.push(r[0]);
    clear.push(r[1]);
    if (k === 2) await page.screenshot({ path: `${out}/${tag.replace(/[^a-z0-9]+/gi, '-')}.png` });
  }
  const ok = Math.max(...lift) <= 0.5 && Math.min(...clear) >= 1;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${tag.padEnd(26)} caméra remontée de ${Math.max(...lift).toFixed(1)} m au plus, œil à ${Math.min(...clear).toFixed(1)} m du sol au moins`);
}

await start('forward');
await sweep('déco, 1re personne', 'first', null);
await sweep('déco, 3e personne', 'third', null);
await start('air');
for (const agl of [50, 30, 15]) {
  await sweep(`pente à ${agl} m, 1re personne`, 'first', agl);
  await sweep(`pente à ${agl} m, 3e personne`, 'third', agl);
}
if (errors.length) console.log('Erreurs :\n' + errors.slice(0, 5).join('\n'));
console.log(fails || errors.length ? `${fails} échec(s)` : 'Tout passe');
await browser.close();
process.exit(fails || errors.length ? 1 : 0);
