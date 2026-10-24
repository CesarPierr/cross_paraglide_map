/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * The flight model in the real game: the site's model wind, the fine relief, the thermals and
 * the turbulence at the pilot, flown by a robot in the page. At each take-off, hands up for
 * a minute of game time (how far the heading wanders, the roll and the pitch it gets), then
 * a held spiral (bank, sink, nose-down) with first-person and outside captures, and a turn
 * at 30 % for the tiles seen while turning. Numbers per site and over all of them.
 *
 *   npx tsx scripts/dev/game-flight-live.ts [--url http://localhost:5174/] [--out dir]
 *                                           [--sites id,id] [--wing A|B|C] [--seconds 60]
 *
 * Needs the dev server (the engine is on window.__game in development). Uses the GPU
 * (Metal through ANGLE) unless --soft. CHROMIUM_PATH points at a Chrome binary.
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const url = opt('--url', 'http://localhost:5174/');
const out = opt('--out', 'test-results/flight-live');
const wing = opt('--wing', 'B');
const seconds = Number(opt('--seconds', '60'));
mkdirSync(out, { recursive: true });

/** Take-offs spread over the Alps; `name`: a part of the name the menu shows (the run waits for it). */
const SITES: { id: string; name: string }[] = [
  { id: 'chartreuse/st-hilaire-sud-nord', name: 'Saint-Hilaire' },
  { id: 'lac-annecy/forclaz', name: 'Forclaz' },
  { id: 'mont-blanc-chamonix/planpraz', name: 'Planpraz' },
  { id: 'ecrins-vallouise-haute-durance/pelvoux-station-sommet', name: 'Pelvoux' },
  { id: 'bauges/margeriaz', name: 'Margériaz' },
  { id: 'prealpes-grasse-castellane/greolieres-cretes', name: 'Gréolières' },
];
const only = opt('--sites', '');
const sites = only ? SITES.filter((s) => only.split(',').some((k) => s.id.includes(k))) : SITES;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-gl=angle', args.includes('--soft') ? '--use-angle=swiftshader' : '--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

async function start(p: Page, takeoffId: string, name: string) {
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  await p.evaluate(
    ([id, w]) => {
      localStorage.setItem(
        'brises.game',
        JSON.stringify({ takeoffId: id, month0: 6, hour: 14, randomWeather: false, windFrom: 250, windKmh: 12, instability: 0.7, humidity: 0.5, showThermals: false, view: 'first', wing: w, mass: 95, routeId: null, multi: false, room: '', pilotName: '', start: 'air' }),
      );
      localStorage.setItem('brises.welcomed', '1');
    },
    [takeoffId, wing],
  );
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('.ui-mode-switch button')].find((x) => x.textContent?.includes('Jeu')) as HTMLButtonElement | undefined;
    b?.click();
  });
  await p.waitForSelector('button.game-go', { timeout: 30000 });
  // The take-off list loads after the menu: until then the menu shows the default one.
  await p.waitForFunction((n) => document.querySelector('.gt-current')?.textContent?.includes(n), name, { timeout: 30000 });
  await p.click('button.game-go', { noWaitAfter: true, timeout: 90000 });
  await p.waitForSelector('.game-vario', { timeout: 120000 });
}

/** Runs a robot in the page for `dur` s of game time; returns one row per frame. */
const robot = (p: Page, dur: number, mode: 'hands' | 'spiral' | 'turn') =>
  p.evaluate(`new Promise((resolve) => {
    const g = window.__game;
    const mode = ${JSON.stringify(mode)};
    const t0 = g.flightS;
    const rows = [];
    g.setWeight(0);
    function tick() {
      const t = g.flightS - t0;
      if (mode === 'hands') { g.setBrake('L', 0); g.setBrake('R', 0); }
      else if (mode === 'turn') { g.setBrake('L', 0); g.setBrake('R', 0.3); }
      else { g.setBrake('L', 0); g.setBrake('R', Math.min(${wing === 'A' ? 0.85 : 0.75}, t / 3 * ${wing === 'A' ? 0.85 : 0.75})); g.setWeight(Math.min(1, t)); }
      const s = g.glider;
      const a = g.airSample;
      rows.push([t, s.heading, s.bank, s.pitch, s.turnRate, s.vz, s.airspeed, s.spin, s.collapse.amount + s.collapse.frontal, s.z, a.turbulence, (a.wR ?? 0) - (a.wL ?? 0), Math.hypot(a.u, a.v), s.betaG]);
      if (t >= ${dur} || g.landing || g.ended || g.launch) return resolve(rows);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`) as Promise<number[][]>;

const deg = (r: number) => (r * 180) / Math.PI;
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
const pct = (v: number[], q: number) => (v.length ? [...v].sort((x, y) => x - y)[Math.min(v.length - 1, Math.floor(v.length * q))] : NaN);
const all = { d10: [] as number[], bank: [] as number[], turn: [] as number[] };

for (const site of sites) {
  console.log(`\n=== ${site.name} (EN-${wing})`);
  try {
    await start(page, site.id, site.name);
  } catch (e) {
    console.log('  pas de départ :', (e as Error).message.split('\n')[0]);
    continue;
  }
  await page.waitForTimeout(4000);
  // Double speed: a minute of flight in half the time (the physics steps stay ≤ 1/120 s).
  await page.evaluate(() => ((window as unknown as { __game: { timeScale: number } }).__game.timeScale = 2));
  const rows = await robot(page, seconds, 'hands');
  const T = rows.length ? rows[rows.length - 1][0] : 0;
  // Heading change over 10 s windows, the bank, the turn rate.
  const d10: number[] = [];
  let j = 0;
  for (let i = 0; i < rows.length; i++) {
    while (j < i && rows[i][0] - rows[j][0] > 10) j++;
    if (rows[i][0] - rows[j][0] >= 9.5) d10.push(Math.abs(deg(wrap(rows[i][1] - rows[j][1]))));
  }
  const banks = rows.map((r) => Math.abs(deg(r[2])));
  const turns = rows.map((r) => Math.abs(deg(r[4])));
  const pitch = rows.map((r) => deg(r[3]));
  const total = rows.length ? Math.abs(deg(wrap(rows[rows.length - 1][1] - rows[0][1]))) : NaN;
  const turb = rows.reduce((s, r) => s + r[10], 0) / Math.max(1, rows.length);
  const asym = Math.sqrt(rows.reduce((s, r) => s + r[11] * r[11], 0) / Math.max(1, rows.length));
  const wind = rows.reduce((s, r) => s + r[12], 0) / Math.max(1, rows.length);
  const folds = rows.filter((r, i) => i > 0 && r[8] > 0.05 && rows[i - 1][8] <= 0.05).length;
  console.log(`  ${T.toFixed(0)} s mains hautes, vent ${(wind * 3.6).toFixed(0)} km/h, turbulence ${turb.toFixed(2)}, écart bouts d'aile σ ${asym.toFixed(2)} m/s`);
  console.log(`  cap : Δ sur 10 s médiane ${pct(d10, 0.5).toFixed(1)}°, 95 % ${pct(d10, 0.95).toFixed(1)}°, max ${pct(d10, 1).toFixed(1)}° ; écart total ${total.toFixed(0)}°`);
  console.log(`  roulis médian ${pct(banks, 0.5).toFixed(1)}°, 95 % ${pct(banks, 0.95).toFixed(1)}° ; taux de virage 95 % ${pct(turns, 0.95).toFixed(1)}°/s ; tangage ${pct(pitch, 0.02).toFixed(0)}…${pct(pitch, 0.98).toFixed(0)}° ; fermetures ${folds}`);
  all.d10.push(...d10);
  all.bank.push(...banks);
  all.turn.push(...turns);
  // Turning at 30 %: what the view sees of the tiles while it sweeps the landscape.
  await page.evaluate(() => ((window as unknown as { __game: { timeScale: number } }).__game.timeScale = 1));
  const turnRows = robot(page, 12, 'turn');
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${site.id.split('/').pop()}-virage-${k}.png` });
  }
  await turnRows;
  // A held spiral, a thousand metres higher (room to sink).
  await page.evaluate(() => {
    const g = (window as unknown as { __game: { glider: { z: number } } }).__game;
    g.glider.z += 1000;
  });
  const spiral = robot(page, 22, 'spiral');
  await page.waitForTimeout(16000);
  await page.screenshot({ path: `${out}/${site.id.split('/').pop()}-spirale-pilote.png` });
  await page.evaluate(() => (window as unknown as { __game: { setView(v: string): void } }).__game.setView('third'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${site.id.split('/').pop()}-spirale-dehors.png` });
  const sp = await spiral;
  await page.evaluate(() => (window as unknown as { __game: { setView(v: string): void } }).__game.setView('first'));
  const late = sp.filter((r) => r[0] > 8);
  if (late.length)
    console.log(
      `  spirale : inclinaison ${Math.max(...late.map((r) => Math.abs(deg(r[2])))).toFixed(0)}°, chute ${Math.max(...late.map((r) => -r[5])).toFixed(1)} m/s, nez bas ${Math.max(...late.map((r) => deg(r[3]))).toFixed(0)}°, vrille ${Math.max(...late.map((r) => r[7])).toFixed(2)}`,
    );
}
console.log(`\n=== Tous sites (EN-${wing}) : Δcap sur 10 s médiane ${pct(all.d10, 0.5).toFixed(1)}°, 95 % ${pct(all.d10, 0.95).toFixed(1)}° ; roulis 95 % ${pct(all.bank, 0.95).toFixed(1)}° ; taux de virage 95 % ${pct(all.turn, 0.95).toFixed(1)}°/s`);
if (errors.length) console.log('Erreurs de page :\n' + errors.slice(0, 5).join('\n'));
else console.log('Aucune erreur de page');
await browser.close();
