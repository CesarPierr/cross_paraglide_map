/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * How strong the thermals are in the real game, against the climbs the sources document
 * (Grésivaudan in summer: varios of 2 to 3 m/s; reputed thermals often more than +4 m/s):
 * - census: every source within 8 km of the take-off, its column every 30 s for 20 min at
 *   300, 600, 1000 and 1500 m above it; the mean air on a 20 m circle around the core, minus
 *   1.4 m/s of sink in the turn: the net climb of a well-centred pilot, by percentile;
 * - robot: put at the foot of the best thermals around (1st, 3rd, 5th…), an EN-B circling the
 *   core at ~22 m and ~30° of bank (it knows where it is) for 60 s: the climb it gets.
 *
 *   npx tsx scripts/dev/thermal-climb.ts [--site chartreuse/st-hilaire-sud-nord] [--name Saint-Hilaire]
 *        [--month 8] [--hour 14.5] [--instability 0.55] [--wind 250/14] [--trials 8] [--url …]
 *
 * Needs the dev server (window.__game). CHROMIUM_PATH points at a Chrome binary.
 */
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const url = opt('--url', 'http://localhost:5174/');
const site = opt('--site', 'chartreuse/st-hilaire-sud-nord');
const name = opt('--name', 'Saint-Hilaire');
const [windFrom, windKmh] = opt('--wind', '250/14').split('/').map(Number);
const cfg = { takeoffId: site, month0: Number(opt('--month', '8')) - 1, hour: Number(opt('--hour', '14.5')), randomWeather: false, windFrom, windKmh, instability: Number(opt('--instability', '0.55')), humidity: 0.5, showThermals: false, view: 'first', wing: 'B', mass: 95, routeId: null, multi: false, room: '', pilotName: '', start: 'air' };
const trials = Number(opt('--trials', '8'));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', (e) => console.log('Erreur de page :', e.message));
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate((c) => {
  localStorage.setItem('brises.game', JSON.stringify(c));
  localStorage.setItem('brises.welcomed', '1');
}, cfg);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.ui-mode-switch button')].find((x) => x.textContent?.includes('Jeu')) as HTMLButtonElement | undefined;
  b?.click();
});
await page.waitForSelector('button.game-go', { timeout: 30000 });
await page.waitForFunction((n) => document.querySelector('.gt-current')?.textContent?.includes(n), name, { timeout: 30000 });
await page.click('button.game-go', { noWaitAfter: true });
await page.waitForSelector('.game-vario', { timeout: 120000 });
await page.waitForTimeout(4000);

const pct = (v: number[], q: number) => (v.length ? [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(v.length * q))] : NaN);
console.log(`${name}, ${cfg.month0 + 1}/${cfg.hour} h, masse d'air ${cfg.instability}, vent ${windFrom}° ${windKmh} km/h`);
const census = (await page.evaluate(`(() => {
  const g = window.__game;
  g.timeScale = 1e-4;
  const air = g.air;
  const near = air.sources.filter((s) => Math.hypot(s.x - g.glider.x, s.y - g.glider.y) < 8000);
  const out = { 300: [], 600: [], 1000: [], 1500: [] };
  const va = { w: 0, shear: 0, cloud: 0, u: 0, v: 0 };
  for (let k = 0; k < 40; k++) {
    const t = g.gameT + k * 30;
    for (const s of near)
      for (const h of [300, 600, 1000, 1500]) {
        const z = s.ground + h;
        const c = air.column(s, z, t);
        if (!c || c.w < 0.3) continue;
        let best = -9;
        for (const [ox, oy] of [[0, 0], [c.rc * 0.3, 0], [-c.rc * 0.3, 0], [0, c.rc * 0.3], [0, -c.rc * 0.3]]) {
          let m = 0;
          for (let a = 0; a < 12; a++) {
            air.sampleInto(c.cx + ox + 20 * Math.cos(a * Math.PI / 6), c.cy + oy + 20 * Math.sin(a * Math.PI / 6), z, s.ground, t, va);
            m += va.w / 12;
          }
          best = Math.max(best, m);
        }
        out[h].push(best - 1.4);
      }
  }
  return out;
})()`)) as Record<string, number[]>;
for (const h of ['300', '600', '1000', '1500']) {
  const v = census[h];
  console.log(`  ${h.padStart(4)} m au-dessus des sources : ${String(v.length).padStart(5)} colonnes actives, montée nette médiane ${pct(v, 0.5).toFixed(1)}, 75 % ${pct(v, 0.75).toFixed(1)}, 90 % ${pct(v, 0.9).toFixed(1)}, 99 % ${pct(v, 0.99).toFixed(1)} m/s`);
}

const climbs: number[] = [];
for (let k = 0; k < trials; k++) {
  const r = (await page.evaluate(`new Promise(async (resolve) => {
    const g = window.__game;
    const air = g.air;
    g.timeScale = 1e-4;
    const t = g.gameT;
    const cands = [];
    for (const s of air.sources) {
      if (Math.hypot(s.x - g.spawn.x, s.y - g.spawn.y) > 6000) continue;
      const c = air.column(s, s.ground + 500, t + 20);
      if (c && c.w > 1) cands.push([c.w, s]);
    }
    cands.sort((a, b) => b[0] - a[0]);
    const pick = cands[Math.min(cands.length - 1, ${k} * 2)];
    if (!pick) return resolve(null);
    const s = pick[1];
    const c0 = air.column(s, s.ground + 500, t);
    await g.world.heights.ready(c0.cx, c0.cy);
    Object.assign(g.glider, { x: c0.cx + 25, y: c0.cy, z: s.ground + 500, heading: Math.PI, vx: 0, vy: -9, vz: -1, bank: 0.5, pitch: 0, airspeed: 9.5 });
    await new Promise((r) => setTimeout(r, 300));
    g.timeScale = 2;
    const t0 = g.flightS;
    let z0 = null;
    let n = 0, sink = 0, bank = 0;
    function tick() {
      const T = g.flightS - t0;
      const st = g.glider;
      const c = air.column(s, st.z, g.gameT);
      if (c) {
        // Circling right around the core at ~22 m: the centre on the right, the radius error leans the heading in.
        const dx = c.cx - st.x, dy = c.cy - st.y;
        let err = Math.atan2(dx, dy) - Math.PI / 2 + Math.atan((Math.hypot(dx, dy) - 22) / 18) - st.heading;
        err -= 2 * Math.PI * Math.round(err / (2 * Math.PI));
        g.setBrake('L', 0.05);
        g.setBrake('R', Math.max(0.15, Math.min(0.45, 0.3 + 0.5 * err)));
        g.setWeight(0.5);
        if (T > 10) { n++; sink += st.vz - g.airSample.w; bank += Math.abs(st.bank); }
      }
      if (T >= 10 && z0 === null) z0 = st.z;
      if (T >= 70 || g.landing || g.ended || !c) {
        g.setBrake('R', 0);
        g.setWeight(0);
        return resolve({ core: c0.w, climb: z0 === null ? NaN : (st.z - z0) / (T - 10), sink: sink / n, bank: bank / n * 57.3 });
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`)) as { core: number; climb: number; sink: number; bank: number } | null;
  if (!r) break;
  climbs.push(r.climb);
  console.log(`  robot ${k + 1} : cœur ${r.core.toFixed(1)} m/s à 500 m → montée ${r.climb.toFixed(2)} m/s sur 60 s (chute propre ${(-r.sink).toFixed(2)} m/s, inclinaison ${r.bank.toFixed(0)}°)`);
}
console.log(`Robot : montée médiane ${pct(climbs, 0.5).toFixed(2)} m/s, meilleure ${pct(climbs, 1).toFixed(2)} m/s`);
await browser.close();
