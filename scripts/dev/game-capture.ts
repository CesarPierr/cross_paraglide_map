/**
 * Landscape captures of the game ("Jeu" tab) at fixed places and hours, for before/after
 * comparisons of the rendering (terrain materials, light, shadows): the same framing every
 * run, the pilot frozen (pause) at a given position, the cockpit hidden, one image per
 * hour once the tiles are loaded. Optionally measures the frame time with some passes off.
 *
 *   npx tsx scripts/dev/game-capture.ts [--out dir] [--scenes falaise,lac] [--hours 8,13,18.5]
 *                                       [--size 1280x800] [--gpu] [--perf] [--url http://localhost:5174/]
 *                                       [--debug 1|2|3|4] [--plain] [--month 0-11] [--dpr 2] [--profile name]
 *                                       [--no-imagery]
 *
 * Rendering is software (SwiftShader) unless --gpu (Metal through ANGLE, headless): slow
 * but deterministic. A persistent profile in .cache/game-capture-profile keeps the tile
 * cache (service worker) between runs. CHROMIUM_PATH points at Chrome for Testing.
 * --perf (with --gpu): mean frame time over 4 s at each scene with the terrain's light and
 * materials (ground.ts, materials.ts), with the relief's light only, and with neither
 * (`__game.world.ground`), vsync off; a large --size and --dpr make the frame GPU-bound,
 * so the differences are the passes' cost. --debug shows the
 * terrain's classes (1), normals (2), sun (3) or sky (4) visibility; --plain the relief's
 * light without the materials; --month overrides the scenes' month. --no-imagery refuses the
 * orthophotos and Sentinel-2 (service worker off, own profile): the landscape made from the
 * land cover and the map's water and roads everywhere (materials.ts `gBackdrop`; --debug 9
 * shows it).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';

interface Scene {
  name: string;
  takeoffId: string;
  month0: number;
  /** Camera: lon, lat, altitude (m), heading (deg from north), head pitch (deg, + up). */
  lon: number;
  lat: number;
  alt: number;
  heading: number;
  pitch: number;
  /** Air mass: cumulus or a clear sky. */
  humidity?: number;
  instability?: number;
  /** Standing at the take-off, ready to launch (the camera is the pilot's; lon/lat/alt unused). */
  ground?: boolean;
}

const SCENES: Scene[] = [
  // Chartreuse: the cliff band under the Petites Roches plateau and the Dent de Crolles, from the Grésivaudan.
  { name: 'falaise', takeoffId: 'chartreuse/st-hilaire-sud-nord', month0: 6, lon: 5.925, lat: 45.296, alt: 1150, heading: 300, pitch: -4 },
  // Close to the cliff band under the Petites Roches plateau (soaring the « crêtes à mouettes »).
  { name: 'paroi', takeoffId: 'chartreuse/st-hilaire-sud-nord', month0: 6, lon: 5.9105, lat: 45.3035, alt: 720, heading: 300, pitch: 4 },
  // Forested slopes under Saint-Hilaire, low over the trees.
  { name: 'foret', takeoffId: 'chartreuse/st-hilaire-sud-nord', month0: 6, lon: 5.9035, lat: 45.3035, alt: 760, heading: 200, pitch: -16 },
  // Chamonix: the Bossons glacier and Mont Blanc from above Planpraz.
  { name: 'glacier', takeoffId: 'mont-blanc-chamonix/planpraz', month0: 6, lon: 6.845, lat: 45.93, alt: 2350, heading: 150, pitch: 2 },
  // Lake Annecy from the Col de la Forclaz.
  { name: 'lac', takeoffId: 'lac-annecy/forclaz', month0: 6, lon: 6.238, lat: 45.818, alt: 1250, heading: 320, pitch: -12 },
  // Low over Lake Annecy off Talloires, towards the evening sun (ripples, glitter).
  { name: 'rive', takeoffId: 'lac-annecy/planfait', month0: 6, lon: 6.2045, lat: 45.8405, alt: 490, heading: 265, pitch: -9, humidity: 0.2 },
  // Talloires and the lake shore from Planfait.
  { name: 'village', takeoffId: 'lac-annecy/planfait', month0: 6, lon: 6.2235, lat: 45.8495, alt: 1010, heading: 245, pitch: -18 },
  // Alpine pastures of the Haute Maurienne (L'Estive), low over the grass.
  { name: 'alpage', takeoffId: 'haute-maurienne/orgere-estive', month0: 6, lon: 6.661, lat: 45.2485, alt: 2640, heading: 20, pitch: -12 },
  // On the ground at the take-off of Saint-Hilaire, looking out over the valley.
  { name: 'deco', takeoffId: 'chartreuse/st-hilaire-sud-nord', month0: 6, lon: 5.8909, lat: 45.3102, alt: 1022, heading: 125, pitch: -8 },
  // Standing at the take-off of Saint-Hilaire, wing laid out, looking down the slope.
  { name: 'sol', takeoffId: 'chartreuse/st-hilaire-sud-nord', month0: 6, lon: 0, lat: 0, alt: 0, heading: 0, pitch: -14, ground: true },
  // Winter: Chamonix in February (seasonal snow).
  { name: 'hiver', takeoffId: 'mont-blanc-chamonix/planpraz', month0: 1, lon: 6.845, lat: 45.93, alt: 2350, heading: 150, pitch: -6 },
];

const arg = (k: string, d?: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const flag = (k: string) => process.argv.includes(`--${k}`);
const url = arg('url', 'http://localhost:5174/')!;
const out = arg('out', 'test-results/capture')!;
const hours = (arg('hours', '8,13,18.5') ?? '').split(',').map(Number);
const only = arg('scenes')?.split(',');
const [W, H] = (arg('size', '1280x800') ?? '').split('x').map(Number);
const gpu = flag('gpu');
const perf = flag('perf');
const debug = Number(arg('debug', '0'));
const plain = flag('plain');
const month = arg('month');
const dpr = Number(arg('dpr', '1'));
const noImagery = flag('no-imagery');
// Two runs at once need two profiles (Chrome locks its profile directory).
const profile = arg('profile', noImagery ? 'game-capture-profile-noimg' : gpu ? 'game-capture-profile-gpu' : 'game-capture-profile')!;
mkdirSync(out, { recursive: true });

const args = gpu
  ? ['--use-gl=angle', '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ctx: BrowserContext = await chromium.launchPersistentContext(join(process.cwd(), '.cache', profile), {
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args,
  viewport: { width: W, height: H },
  deviceScaleFactor: dpr,
  serviceWorkers: noImagery ? 'block' : 'allow',
});
if (noImagery) await ctx.route(/data\.geopf\.fr\/wmts.*ORTHOIMAGERY|tiles\.maps\.eox\.at/, (r) => r.abort());
const page: Page = ctx.pages()[0] ?? (await ctx.newPage());
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message} ${(e.stack ?? '').split('\n').slice(1, 12).join(' | ')}`));
page.on('console', (m) => {
  const t = m.text();
  // (Tile fetches that fail: MapLibre's AJAXError, "statusText (status): url", its name minified.)
  if (m.type() === 'error' && !/Failed to load resource|AJAXError|\(\d+\): https?:\/\/|WebSocket/.test(t)) errors.push(`[console] ${t.slice(0, 300)}`);
  if (/^\[(terrain|sol|jeu)\]/.test(t)) console.log('   ', t);
});

async function start(s: Scene, hour: number): Promise<void> {
  const launch = s.ground ? 'forward' : 'air';
  const settings = {
    takeoffId: s.takeoffId,
    month0: s.month0,
    hour,
    randomWeather: false,
    forecastWeather: false,
    windFrom: 300,
    windKmh: 8,
    instability: s.instability ?? 0.35,
    humidity: s.humidity ?? 0.25,
    showThermals: false,
    view: 'first',
    wing: 'B',
    mass: 95,
    routeId: null,
    multi: false,
    room: '',
    pilotName: '',
    start: launch,
  };
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate((st) => {
    localStorage.setItem('brises.game', JSON.stringify(st));
    localStorage.setItem('brises.welcomed', '1');
  }, settings);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('.ui-mode-switch button')].find((x) => x.textContent && x.textContent.includes('Jeu'));
    if (b) b.click();
  })()`);
  await page.waitForSelector('button.game-go', { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.click('button.game-go', { noWaitAfter: true, timeout: 90000 });
  await page.waitForSelector('.game-vario', { timeout: 240000 });
  // Only the landscape: no HUD, pause card or attribution.
  await page.addStyleTag({ content: '.game-app > *:not(.game-map), .maplibregl-control-container { display: none !important; }' });
}

/** Freezes the pilot at the scene's camera and the given hour, waits for the tiles. */
async function place(s: Scene, hour: number): Promise<void> {
  await page.evaluate(`(async () => {
    const g = window.__game;
    g.paused = true;
    const st = g.glider;
    if (!${!!s.ground}) {
      const [x, y] = g.frame.toXY(${s.lon}, ${s.lat});
      st.x = x; st.y = y; st.z = ${s.alt};
      st.heading = ${(s.heading * Math.PI) / 180};
      // A sane flying state (the physics divides by the airspeed if it ever runs again).
      st.bank = 0; st.pitch = 0;
      st.vx = Math.sin(st.heading) * 10; st.vy = Math.cos(st.heading) * 10; st.vz = -1;
    }
    g.head = { yaw: 0, pitch: ${(s.pitch * Math.PI) / 180} };
    g.hour = ${hour};
    g.air.hour = ${hour};
    await g.refreshSun(true);
    g.world.glider.root.visible = ${!!s.ground};
    // Full quality whatever the renderer's speed (software rendering is slow).
    g.world.sky.adaptive = false;
    if (g.world.ground) g.world.ground.lowDetail = false;
    if (g.world.ground) { g.world.ground.debug = ${debug}; g.world.ground.materials = ${!plain}; }
  })()`);
  // Tiles: wait until MapLibre has them all (or 90 s), then a few more frames.
  await page.evaluate(`new Promise((resolve) => {
    const m = window.__game.world.map;
    const t0 = performance.now();
    let ok = 0;
    const tick = () => {
      if (m.areTilesLoaded()) ok++;
      else ok = 0;
      if (ok > 6 || performance.now() - t0 > 90000) return resolve(true);
      setTimeout(tick, 400);
    };
    tick();
  })`);
  await page.waitForTimeout(gpu ? 1500 : 5000);
}

async function frameTime(seconds: number): Promise<number> {
  return (await page.evaluate(`new Promise((resolve) => {
    let n = 0;
    const t0 = performance.now();
    const f = () => {
      n++;
      if (performance.now() - t0 < ${seconds * 1000}) requestAnimationFrame(f);
      else resolve((performance.now() - t0) / n);
    };
    requestAnimationFrame(f);
  })`)) as number;
}

const scenes = SCENES.filter((s) => !only || only.includes(s.name)).map((s) => (month !== undefined ? { ...s, month0: Number(month) } : s));
for (const s of scenes) {
  console.log(`${s.name} (${s.takeoffId}, mois ${s.month0 + 1})`);
  const t0 = Date.now();
  try {
    await start(s, hours[0]);
  } catch (e) {
    console.log('   démarrage impossible :', e instanceof Error ? e.message : e);
    await page.screenshot({ path: join(out, `${s.name}-blocage.png`) });
    continue;
  }
  for (const h of hours) {
    await place(s, h);
    const file = join(out, `${s.name}-${String(h).replace('.', 'h')}.png`);
    await page.screenshot({ path: file });
    console.log(`   ${h} h → ${file} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    if (perf) {
      await page.evaluate(`window.__game.world.sky.adaptive = false`);
      const on = await frameTime(4);
      const has = await page.evaluate(`!!(window.__game.world.ground)`);
      let relief = NaN;
      let off = NaN;
      if (has) {
        await page.evaluate(`window.__game.world.ground.materials = false`);
        await page.waitForTimeout(300);
        relief = await frameTime(4);
        await page.evaluate(`window.__game.world.ground.enabled = false`);
        await page.waitForTimeout(300);
        off = await frameTime(4);
        await page.evaluate(`window.__game.world.ground.enabled = true; window.__game.world.ground.materials = true`);
      }
      const timings = await page.evaluate(`JSON.stringify(window.__game.world.sky.timings)`);
      console.log(`   image : ${on.toFixed(2)} ms (matériaux), ${relief.toFixed(2)} ms (lumière du relief seule), ${off.toFixed(2)} ms (ni l'un ni l'autre) ; GPU ${timings}`);
    }
  }
}
await ctx.close();
if (errors.length) console.log('\nErreurs :\n' + [...new Set(errors)].slice(0, 20).join('\n'));
