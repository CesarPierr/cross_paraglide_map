/// <reference lib="dom" />
/**
 * The canopy in the real game: screenshots and cost of the wing in a set of situations
 * (hands up, half brake on one side, full brake, asymmetric collapse, frontal, big ears,
 * strong turbulence), the pilot frozen in the air (pause, the pause card hidden) while the
 * glider model keeps animating with the state poked into `__game.glider`.
 *
 *   npx tsx scripts/dev/wing-bench.ts [--out test-results/wing/after] [--url http://localhost:5174/]
 *                                     [--only hands,collapse] [--no-shots] [--lab] [--lab-only] [--before] [--no-cost] [--no-gpu] [--dpr 2]
 *
 * Per situation it prints the CPU of `GliderModel.update` (ms per frame, the whole model:
 * the canopy's dynamics, the lines, the pilot's pose; and the same in a loop of 1/60 s steps,
 * whatever the page's frame rate) and the GPU of one more draw of the
 * near wing and of its lines in the frame (ms, EXT_disjoint_timer_query_webgl2: the draw
 * repeated inside the query, see INSTALL; averaged over 2 s, the camera of the screenshot,
 * the page's size and pixel ratio). On Apple's tile-based GPUs a repeated opaque draw is
 * shaded once per pixel (hidden surface removal): that number is mostly the vertex stage.
 * The whole cost, fragments included, is the --lab one: the glider alone drawn into a
 * cleared target of the page's size in pixels (as glider-lab.ts `gpu()`: many frames per
 * query, minus empty frames), first person and from outside, the same situations. With --lab it
 * *
 * Needs the dev server (the engine is on window.__game in development); Metal through
 * ANGLE, headless. CHROMIUM_PATH points at a Chrome binary.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const url = opt('--url', 'http://localhost:5174/');
const out = opt('--out', 'test-results/wing/after');
const only = opt('--only', '');
const shots = !args.includes('--no-shots');
/** Pixel ratio of the page (2: a MacBook's Retina screen, the game draws at the device's ratio). */
const dpr = Number(opt('--dpr', '2'));
mkdirSync(out, { recursive: true });

/**
 * Situations: the state written into the glider state every frame (the physics paused), the
 * first-person look (yaw, pitch; rad) and how long to wait before the picture (s).
 */
interface Situation {
  name: string;
  set: string;
  look: [number, number];
  wait: number;
  turb?: boolean;
  /** The lab's narrow look from the pilot's seat (yaw, pitch; rad; beyond π/2: up and back). */
  zoom: [number, number];
  /** Only in the lab and when asked for by --only (the take-off: the wing rising off the ground). */
  extra?: boolean;
}
const SITUATIONS: Situation[] = [
  { name: 'mains-hautes', set: '', look: [0, 1.3], wait: 1.5, zoom: [0.15, 1.5] },
  { name: 'frein-50-droite', set: 'st.brakeR = 0.5;', look: [0.5, 1.15], wait: 1.5, zoom: [0.45, 1.85] },
  { name: 'frein-100', set: 'st.brakeL = 1; st.brakeR = 1;', look: [0.4, 1.2], wait: 1.5, zoom: [0.35, 1.85] },
  { name: 'fermeture-50-gauche', set: 'st.collapse.side = -1; st.collapse.amount = 0.5; st.collapse.peak = 0.5;', look: [-0.5, 1.15], wait: 0.9, zoom: [-0.55, 1.2] },
  { name: 'frontale', set: 'st.collapse.frontal = 0.7;', look: [0, 1.25], wait: 0.6, zoom: [0.1, 1.3] },
  { name: 'grandes-oreilles', set: 'st.ears = 1;', look: [-0.6, 1.1], wait: 1.5, zoom: [-0.8, 1.05] },
  { name: 'turbulence-forte', set: '', look: [0.3, 1.25], wait: 1.5, turb: true, zoom: [0.5, 1.8] },
  { name: 'gonflage', set: 'L.glider.setInflation(Math.min(0.9, i / 90)); L.ground(-1.08);', look: [0, 0.2], wait: 1.2, zoom: [0, 0.3], extra: true },
];
const list = only ? SITUATIONS.filter((s) => only.split(',').some((k) => s.name.includes(k))) : SITUATIONS.filter((s) => !s.extra);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dpr });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|AJAXError|\(\d+\): https?:\/\/|WebSocket/.test(m.text())) errors.push(m.text().slice(0, 300));
});

async function start(p: Page): Promise<void> {
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    localStorage.setItem(
      'brises.game',
      JSON.stringify({ takeoffId: 'chartreuse/st-hilaire-sud-nord', month0: 6, hour: 13, randomWeather: false, forecastWeather: false, windFrom: 250, windKmh: 10, instability: 0.4, humidity: 0.3, showThermals: false, view: 'first', wing: 'B', mass: 95, routeId: null, multi: false, room: '', pilotName: '', start: 'air' }),
    );
    localStorage.setItem('brises.welcomed', '1');
  });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(`(() => {
    const b = [...document.querySelectorAll('.ui-mode-switch button')].find((x) => x.textContent && x.textContent.includes('Jeu'));
    if (b) b.click();
  })()`);
  await p.waitForSelector('button.game-go', { timeout: 60000 });
  await p.waitForFunction(() => document.querySelector('.gt-current')?.textContent?.includes('Saint-Hilaire'), null, { timeout: 30000 });
  await p.click('button.game-go', { noWaitAfter: true, timeout: 90000 });
  await p.waitForSelector('.game-vario', { timeout: 180000 });
  // The pause card off the picture (the physics is paused to hold each situation).
  await p.addStyleTag({ content: '.game-pause { display: none !important; }' });
}

/**
 * Installs in the page: the situation driver (writes the state every frame, the turbulence
 * as gusts under each tip, rolls and loads), the CPU timer around GliderModel.update and the
 * GPU timer queries around the near wing's and lines' draws.
 */
const INSTALL = `(() => {
  const g = window.__game;
  const m = g.world.glider;
  const W = (window.__wing = { cpu: 0, cpuN: 0, gpu: {}, gpuN: {}, set: null, turb: false, t: 0, pend: [], extra: 1 });
  const upd = m.update;
  W.rawUpdate = upd;
  m.update = (st, dt) => {
    if (W.set) W.set(st);
    const t0 = performance.now();
    upd(st, dt);
    W.cpu += performance.now() - t0;
    W.cpuN++;
  };
  // The nearest level's wing and lines.
  let lod = null;
  m.root.traverse((o) => { if (o.isLOD && !lod) lod = o; });
  const level = lod ? lod.levels[0].object : m.root;
  const meshes = [];
  level.traverse((o) => {
    const u = o.material && o.material.uniforms;
    if (!o.isMesh || !u) return;
    if (u.uFoldL) meshes.push([o, 'wing']);
    else if (u.uViewport) meshes.push([o, 'lines']);
  });
  // A timer query around a single draw measures mostly the render pass it splits (ANGLE on
  // Metal): every other frame the draw is repeated in two queries back to back, once and
  // 1 + EXTRA times, and the difference divided by EXTRA is the cost of one draw (the same
  // camera, target and pixels as the frame's; the repeats draw the same fragments again).
  const EXTRA = 40;
  let gl = null, ext = null;
  const pool = [];
  let frame = 0;
  for (const [mesh, label] of ${args.includes('--no-gpu') ? '[]' : 'meshes'}) {
    mesh.onAfterRender = (r, scene, camera, geometry, material, group) => {
      if (!gl) {
        gl = r.getContext();
        ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (ext) for (let i = 0; i < 64; i++) pool.push(gl.createQuery());
      }
      if (!ext || frame & 1 || pool.length < 2 || gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return;
      for (const n of [1, 1 + EXTRA]) {
        const q = pool.pop();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        for (let i = 0; i < n; i++) r.renderBufferDirect(camera, scene, geometry, material, mesh, group);
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        W.pend.push([q, label + (n > 1 ? 'X' : '1')]);
      }
    };
  }
  const poll = () => {
    if (gl && ext) {
      const dis = gl.getParameter(ext.GPU_DISJOINT_EXT);
      W.pend = W.pend.filter(([q, label]) => {
        if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return true;
        if (!dis) {
          W.gpu[label] = (W.gpu[label] || 0) + gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
          W.gpuN[label] = (W.gpuN[label] || 0) + 1;
        }
        pool.push(q);
        return false;
      });
    }
    frame++;
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
  W.extra = EXTRA;
  return meshes.map((x) => x[1]).join(',');
})()`;

/** Writes the situation's state every frame (from a clean flying state). */
const situation = (s: Situation) => `(() => {
  const g = window.__game;
  const W = window.__wing;
  const st = g.glider;
  W.t = 0;
  let last = performance.now();
  W.set = (st) => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    W.t += dt;
    st.brakeL = 0; st.brakeR = 0; st.speedbar = 0; st.ears = 0; st.stall = 0; st.spin = 0; st.weightShift = 0;
    st.collapse.side = 0; st.collapse.amount = 0; st.collapse.peak = 0; st.collapse.frontal = 0; st.collapse.cravat = 0; st.collapse.cravatSide = 0;
    st.tipHpL = 0; st.tipHpR = 0; st.bankRate = 0; st.pitchRate = 0; st.turnRate = 0; st.load = 1;
    st.marginC = 6; st.marginL = 6; st.marginR = 6;
    st.airspeed = 10.5;
    ${s.set}
    if (${!!s.turb}) {
      // Strong turbulence: eddies of a few metres, ~2.5 m/s, different under each tip, the
      // glider rolled and loaded by them, the angle of attack swinging near the fold.
      const t = W.t;
      const gg = (x) => Math.sin(x) + 0.6 * Math.sin(2.3 * x + 1.1) + 0.35 * Math.sin(5.1 * x + 2.3);
      st.tipHpL = 2.2 * gg(t * 2.9 + 4.1);
      st.tipHpR = 2.2 * gg(t * 3.1 + 0.7);
      st.bankRate = 0.35 * gg(t * 1.9);
      st.pitchRate = 0.25 * gg(t * 1.6 + 2);
      st.load = 1 + 0.45 * gg(t * 2.2 + 1.3);
      st.marginC = 3 + 2.5 * gg(t * 1.3);
      st.marginL = 3 + 2.5 * gg(t * 1.7 + 1);
      st.marginR = 3 + 2.5 * gg(t * 1.5 + 2);
    }
  };
})()`;

async function measure(seconds: number): Promise<{ cpu: number; cpuLoop: number; wing: number; lines: number; frames: number }> {
  await page.evaluate(`(() => { const W = window.__wing; W.cpu = 0; W.cpuN = 0; W.gpu = {}; W.gpuN = {}; })()`);
  await page.waitForTimeout(seconds * 1000);
  return (await page.evaluate(`(() => {
    const W = window.__wing;
    const per = (l) => Math.max(0, ((W.gpu[l + 'X'] || 0) / Math.max(1, W.gpuN[l + 'X'] || 0) - (W.gpu[l + '1'] || 0) / Math.max(1, W.gpuN[l + '1'] || 0)) / W.extra);
    // The same update in a loop at 60 Hz steps (the page's own frame rate aside), the JIT warm.
    const st = window.__game.glider;
    for (let i = 0; i < 300; i++) { W.set(st); W.rawUpdate(st, 1 / 60); }
    const t0 = performance.now();
    for (let i = 0; i < 1500; i++) { W.set(st); W.rawUpdate(st, 1 / 60); }
    const cpuLoop = (performance.now() - t0) / 1500;
    return { cpu: W.cpu / Math.max(1, W.cpuN), cpuLoop, wing: per('wing'), lines: per('lines'), frames: W.cpuN };
  })()`)) as { cpu: number; cpuLoop: number; wing: number; lines: number; frames: number };
}

const labOnly = args.includes('--lab-only');
if (!labOnly) await start(page);
if (!labOnly) await page.evaluate(`(() => { const g = window.__game; g.paused = true; g.glider.z += 600; })()`);
// Tiles under the pilot (or 40 s).
if (!labOnly) await page.evaluate(`new Promise((resolve) => {
  const m = window.__game.world.map;
  const t0 = performance.now();
  let ok = 0;
  const tick = () => {
    ok = m.areTilesLoaded() ? ok + 1 : 0;
    if (ok > 4 || performance.now() - t0 > 40000) return resolve(true);
    setTimeout(tick, 400);
  };
  tick();
})`);
if (!labOnly) console.log('timed meshes:', await page.evaluate(INSTALL));
const rows: string[] = [];
for (const s of labOnly ? [] : list.filter((x) => !x.extra)) {
  await page.evaluate(situation(s));
  await page.evaluate(`(() => { const g = window.__game; g.setView('first'); g.head = { yaw: ${s.look[0]}, pitch: ${s.look[1]} }; })()`);
  // (A collapse is drawn as it folds: the picture at the moment given, measured after.)
  await page.waitForTimeout(s.wait * 1000);
  if (shots) await page.screenshot({ path: `${out}/${s.name}-pilote.png`, scale: 'css' });
  const r = await measure(2);
  if (shots) {
    // Re-run the fold for the outside picture at the same moment.
    await page.evaluate(situation({ ...s, set: '' }));
    await page.waitForTimeout(800);
    await page.evaluate(situation(s));
    // From outside, three-quarters ahead on the side that moves, a little above; the picture
    // cropped around the glider at the page's pixel ratio.
    await page.evaluate(`(() => { const g = window.__game; g.setView('third'); g.head = { yaw: ${s.look[0] < -0.3 ? -2.2 : 2.2}, pitch: -0.1 }; })()`);
    await page.waitForTimeout(s.wait * 1000);
    await page.screenshot({ path: `${out}/${s.name}-dehors.png`, clip: { x: 400, y: 160, width: 480, height: 400 } });
  }
  const line = `${s.name.padEnd(20)} CPU update ${r.cpu.toFixed(3)} ms (à 60 Hz ${r.cpuLoop.toFixed(3)} ms)   GPU aile ${r.wing.toFixed(3)} ms   suspentes ${r.lines.toFixed(3)} ms   (${r.frames} images)`;
  console.log(line);
  rows.push(line);
}

/** Sets a situation on the lab's glider and lets it run `wait` s from an open wing (1/60 s steps). */
const labSituation = (s: Situation) => `
  const L = window.__lab;
  const st = L.state;
  const reset = (st) => {
    st.brakeL = 0; st.brakeR = 0; st.speedbar = 0; st.ears = 0; st.stall = 0; st.spin = 0;
    st.collapse.side = 0; st.collapse.amount = 0; st.collapse.peak = 0; st.collapse.frontal = 0; st.collapse.cravat = 0; st.collapse.cravatSide = 0;
    st.tipHpL = 0; st.tipHpR = 0; st.load = 1; st.marginC = 6; st.marginL = 6; st.marginR = 6; st.bankRate = 0; st.pitchRate = 0;
  };
  L.glider.setInflation(null);
  L.ground(null);
  for (let i = 0; i < 90; i++) { reset(st); L.glider.update(st, 1 / 60); }
  const gg = (x) => Math.sin(x) + 0.6 * Math.sin(2.3 * x + 1.1) + 0.35 * Math.sin(5.1 * x + 2.3);
  for (let i = 0; i < Math.round(${s.wait} * 60); i++) {
    reset(st);
    ${s.set}
    if (${!!s.turb}) {
      const t = i / 60;
      st.tipHpL = 2.2 * gg(t * 2.9 + 4.1); st.tipHpR = 2.2 * gg(t * 3.1 + 0.7);
      st.bankRate = 0.35 * gg(t * 1.9); st.load = 1 + 0.45 * gg(t * 2.2 + 1.3);
      st.marginC = 3 + 2.5 * gg(t * 1.3); st.marginL = 3 + 2.5 * gg(t * 1.7 + 1); st.marginR = 3 + 2.5 * gg(t * 1.5 + 2);
    }
    L.glider.update(st, 1 / 60);
  }
`;

/**
 * GPU of the wing alone (the rest of the glider and the sky hidden) against empty frames,
 * interleaved, 60 frames per query, the fastest of each kind; first person (the
 * situation's look) and from outside; and the CPU of an update (lab.stats()).
 */
const labCost = (s: Situation) => `(async () => {
  ${labSituation(s)}
  const R = L.renderer;
  const gl = R.getContext();
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let lod = null;
  L.glider.root.traverse((o) => { if (o.isLOD && !lod) lod = o; });
  const level = lod ? lod.levels.find((l) => l.object.visible).object : L.glider.root;
  const parts = [];
  level.traverse((o) => { if (o.isMesh) parts.push(o); });
  const wing = parts.filter((o) => o.material.uniforms && o.material.uniforms.uFoldL);
  const lines = parts.filter((o) => o.material.uniforms && o.material.uniforms.uViewport);
  const others = L.scene.children.filter((o) => o !== L.glider.root && o.visible);
  const timeFrames = async (n) => {
    const q = gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    for (let i = 0; i < n; i++) R.render(L.scene, L.camera);
    gl.endQuery(ext.TIME_ELAPSED_EXT);
    gl.finish();
    for (let w = 0; w < 400 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); w++) await new Promise((r) => setTimeout(r, 5));
    const v = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 / n;
    gl.deleteQuery(q);
    return v;
  };
  const cost = async (show) => {
    if (!ext) return null;
    for (const o of others) o.visible = false;
    // (The GPU is shared: whatever else runs only adds time, so the fastest of the runs of
    // each kind, interleaved, is the least disturbed.)
    let e = Infinity;
    let g = Infinity;
    for (let rep = 0; rep < 16; rep++) {
      for (const o of parts) o.visible = false;
      const te = await timeFrames(60);
      for (const o of show) o.visible = true;
      const tg = await timeFrames(60);
      if (rep >= 2) {
        e = Math.min(e, te);
        g = Math.min(g, tg);
      }
    }
    for (const o of parts) o.visible = true;
    for (const o of others) o.visible = true;
    return Math.max(0, g - e);
  };
  L.first(${s.look[0]}, ${s.look[1]});
  const first = await cost(wing);
  const linesFirst = await cost(lines);
  L.orbit(2.6, 0.25, 16);
  const third = await cost(wing);
  const cpu = L.stats().updateMs;
  L.first();
  return { first, third, linesFirst, cpu };
})()`;

type LabCost = { first: number | null; third: number | null; linesFirst: number | null; cpu: number };

/** A page with the development bench (glider-lab.ts), from the working tree or from HEAD (--before). */
async function labPage(before: boolean): Promise<Page> {
  const lab = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: dpr });
  lab.on('pageerror', (e) => errors.push(e.message));
  lab.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 1500));
  });
  await lab.goto(url, { waitUntil: 'domcontentloaded' });
  await lab.waitForTimeout(1500);
  // HEAD's modules: copied to .cache/wing-before by the --before option (see below).
  const src = before ? `/@fs${process.cwd()}/.cache/wing-before/glider-lab.ts` : '/src/game/glider-lab.ts';
  await lab.evaluate(`import('${src}').then((m) => { const L = m.startLab(1280, 800); L.renderer.setPixelRatio(${dpr}); L.renderer.setSize(1280, 800); })`);
  await lab.waitForFunction(() => !!(window as unknown as { __lab?: unknown }).__lab, null, { timeout: 30000 });
  await lab.waitForTimeout(1500);
  return lab;
}

if (args.includes('--lab') || labOnly) {
  // The glider alone in the development bench: many frames per query, the sky hidden. With
  // --before, HEAD's canopy too (git show into .cache/wing-before), measured alternately.
  const compare = args.includes('--before');
  if (compare) {
    mkdirSync('.cache/wing-before', { recursive: true });
    for (const f of ['glider-shape', 'glider-wing', 'glider-lines', 'glider', 'glider-gear', 'glider-pilot', 'glider-lab']) {
      const code = execSync(`git show HEAD:apps/web/src/game/${f}.ts`, { encoding: 'utf8' }).replace(/from '\.\/(flight|airmass|life)'/g, "from '/src/game/$1.ts'");
      writeFileSync(`.cache/wing-before/${f}.ts`, code);
    }
  }
  const after = await labPage(false);
  const before = compare ? await labPage(true) : null;
  const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(3));
  for (const s of list) {
    const runs: { a: LabCost[]; b: LabCost[] } = { a: [], b: [] };
    for (let r = 0; r < (args.includes('--no-cost') ? 0 : compare ? 2 : 1); r++) {
      runs.a.push((await after.evaluate(labCost(s))) as LabCost);
      if (before) runs.b.push((await before.evaluate(labCost(s))) as LabCost);
    }
    const mean = (xs: LabCost[], k: keyof LabCost) => (xs.some((x) => x[k] === null) ? null : xs.reduce((m, x) => m + (x[k] as number), 0) / xs.length);
    const line = (tag: string, xs: LabCost[]) =>
      `lab ${tag} ${s.name.padEnd(20)} GPU aile vue pilote ${fmt(mean(xs, 'first'))} ms, de dehors ${fmt(mean(xs, 'third'))} ms ; suspentes ${fmt(mean(xs, 'linesFirst'))} ms ; CPU update ${fmt(mean(xs, 'cpu'))} ms`;
    if (before && runs.b.length) console.log(line('avant', runs.b));
    if (runs.a.length) console.log(line(compare ? 'après' : '', runs.a));
    if (shots) {
      // A close look at the fabric: three-quarters ahead on the side that moves, a little
      // below the wing; from the pilot's seat; and a narrow look at the fabric from there.
      for (const [tag, cam] of [
        ['proche', `L.orbit(${s.look[0] < -0.3 ? -0.75 : 0.75}, 0.05, 10.5, 4.2, 55)`],
        ['dessous', `L.first(${s.look[0]}, ${s.look[1]}, 75)`],
        ['zoom', `L.first(${s.zoom[0]}, ${s.zoom[1]}, 30)`],
      ]) {
        await after.evaluate(`(() => { ${labSituation(s)}; ${cam}; L.renderer.render(L.scene, L.camera); })()`);
        await after.screenshot({ path: `${out}/${s.name}-labo-${tag}.png`, scale: 'css' });
      }
    }
  }
}
if (errors.length) console.log('Erreurs de page :\n' + errors.slice(0, 8).join('\n'));
else console.log('Aucune erreur de page');
await browser.close();
