/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * The simulator ("Jeu" tab) in headless Chromium: a forward launch flown with the keyboard
 * (run, a dab of brake as the wing comes overhead, run on), a cross-country task (HUD and
 * cylinders), the topo pause, two pilots in the same multiplayer room, a phone held
 * sideways and upright (touch controls clear of one another), the flying school (its steps
 * on the take-off, a thermal's entry, an approach, its cost per frame) and the challenges
 * (an FAI triangle checked and flown by jumps, the ceiling). Screenshots in
 * the output directory; fails on page errors. Rendering is software (SwiftShader): frame
 * rates here mean nothing, only behaviour.
 *
 *   npx tsx apps/web/e2e/game.ts [url] [outDir] [solo|multi|phone|ecole|defi]
 *   CHROMIUM_PATH=… to point at a Chromium binary. The multiplayer step needs the API (/api).
 */
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5174/";
const out = process.argv[3] ?? "test-results/game";
mkdirSync(out, { recursive: true });

// Software rendering by default (any machine); E2E_GPU=1 uses the real GPU (Metal on macOS),
// much faster with the volumetric clouds: two pilots in one room need it.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    "--use-gl=angle",
    process.env.E2E_GPU ? "--use-angle=metal" : "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const errors: string[] = [];
const watch = (page: Page, who: string) => {
  page.on("pageerror", (e) => errors.push(`[${who} pageerror] ${e.message}`));
  // (Tile fetches that fail: MapLibre's AJAXError, "statusText (status): url", its class
  // name minified in the library's build.)
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !/Failed to load resource|AJAXError|\(\d+\): https?:\/\/|WebSocket/.test(m.text())
    )
      errors.push(
        `[${who} console] ${m.text().slice(0, 240)} @ ${m.location().url.split("/").pop()}:${m.location().lineNumber}`,
      );
  });
};

interface Hud {
  alt: number;
  launch: {
    phase: string;
    theta: number;
    phi: number;
    airKmh: number;
    facingWing: boolean;
  } | null;
  task: { next: string; distKm: number } | null;
  multi: { status: string; pilots: { name: string }[] } | null;
}
const hud = (page: Page) =>
  page.evaluate(() => {
    const g = (window as unknown as { __game?: { hud(): unknown } }).__game;
    return (g ? g.hud() : null) as Hud | null;
  });

async function start(page: Page, settings: Record<string, unknown>) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.evaluate((s) => {
    localStorage.setItem("brises.game", JSON.stringify(s));
    localStorage.setItem("brises.welcomed", "1");
  }, settings);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll(".ui-mode-switch button")].find(
      (x) => x.textContent?.includes("Jeu"),
    ) as HTMLButtonElement | undefined;
    b?.click();
  });
  await page.waitForSelector("button.game-go", { timeout: 30000 });
  // The take-off and route lists load after the menu opens.
  await page
    .waitForFunction(
      () =>
        !document.querySelector(".gt-current") ||
        [...document.querySelectorAll(".game-seg button")].some((b) =>
          /Manche de cross \(/.test(b.textContent ?? ""),
        ),
      null,
      { timeout: 30000 },
    )
    .catch(() => {});
  await page.click("button.game-go", { noWaitAfter: true, timeout: 90000 });
  const t0 = Date.now();
  try {
    await page.waitForSelector(".game-vario", { timeout: 120000 });
  } catch (e) {
    const status = await page.evaluate(
      () =>
        document.querySelector(".game-card.narrow p, .game-error")
          ?.textContent ?? "(rien)",
    );
    await page.screenshot({ path: `${out}/blocage.png` });
    console.log("  bloqué sur :", status, "\n", errors.join("\n"));
    throw e;
  }
  console.log("  en vol après", Date.now() - t0, "ms");
}

const base = {
  takeoffId: "default-saint-hilaire",
  month0: 6,
  hour: 13,
  randomWeather: false,
  windFrom: 110,
  windKmh: 10,
  instability: 0.6,
  humidity: 0.55,
  showThermals: true,
  view: "first",
  wing: "B",
  mass: 95,
  routeId: null,
  multi: false,
  room: "",
  pilotName: "",
};

const only = process.argv[4];
const want = (k: string) => !only || only === k;

// ---------- 1. Forward launch at Saint-Hilaire, flown with the keyboard ----------
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
watch(page, "p1");
if (want("solo")) {
  console.log("1. Décollage face pente");
  await start(page, { ...base, start: "forward" });
  await page.screenshot({ path: `${out}/1-deco-pret.png` });
  // A pilot acting every frame inside the page (polling from here is far too slow with
  // software rendering): run, dab the brakes as the wing comes overhead, brake the high
  // side when it drifts, hands up once flying (both brakes let go together: an uneven
  // brake held after lift-off turns the wing back into the slope).
  // (A string: the TS transpiler would inject helpers the page does not have.)
  const launched = (await page.evaluate(`new Promise((resolve) => {
    const g = window.__game;
    g.keyDown("z");
    const t0 = performance.now();
    function tick() {
      const l = g.launch;
      if (!l) {
        g.setBrake("L", 0.1);
        g.setBrake("R", 0.1);
        return resolve(true);
      }
      if (l.phase === "failed" || performance.now() - t0 > 120000) return resolve(false);
      const dab = l.theta > 1.0 && l.thetaRate > 0.15 ? 0.45 : 0.08;
      const k = Math.max(-0.5, Math.min(0.5, l.phi * 2.5 + l.phiRate));
      g.setBrake("L", dab + Math.max(0, k));
      g.setBrake("R", dab + Math.max(0, -k));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`)) as boolean;
  const end = await page.evaluate(
    () =>
      (document.querySelector(".game-pause h2")?.textContent ?? "") +
      " — " +
      (document.querySelector(".game-pause p")?.textContent ?? ""),
  );
  console.log(launched ? "  décollé" : `  pas décollé (${end ?? "au sol"})`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/1-apres-deco.png` });

  if (process.env.TRACE) {
    await browser.close();
    console.log(errors.slice(0, 5).join("\n"));
    process.exit(0);
  }
  // ---------- 2. Cross-country task ----------
  console.log("2. Manche de cross");
  const routeId = await page.evaluate(async () => {
    const atlas = await (await fetch("data/atlas.json")).json();
    const r = atlas.features.routes.find(
      (f: { properties: { name: string } }) =>
        f.properties.name.startsWith("Saint-Hilaire – Barraux"),
    );
    return r?.properties.id ?? null;
  });
  await start(page, { ...base, start: "air", routeId, view: "third" });
  await page.waitForTimeout(3000);
  const t = await hud(page);
  console.log(
    "  manche :",
    t?.task
      ? `prochaine balise ${t.task.next} à ${t.task.distKm.toFixed(1)} km`
      : "pas de manche",
  );
  await page.screenshot({ path: `${out}/2-manche.png` });

  // ---------- 3. Topo pause ----------
  console.log("3. Pause topo");
  await page.keyboard.press("p");
  await page.waitForTimeout(500);
  await page.click("text=Carte topo");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/3-topo.png` });
  await page.click("text=Fermer la carte");
  await page.click(".game-pause button.game-go");
}

// ---------- 4. Two pilots in one room ----------
if (want("multi")) {
  console.log("4. Multijoueur");
  const room = "E2E" + Math.floor(Math.random() * 9000 + 1000);
  const page2 = await browser.newPage({
    viewport: { width: 900, height: 600 },
  });
  watch(page2, "p2");
  await start(page, {
    ...base,
    start: "air",
    multi: true,
    room,
    pilotName: "Alice",
  });
  await start(page2, {
    ...base,
    start: "air",
    multi: true,
    room,
    pilotName: "Bob",
  });
  await page.waitForTimeout(6000);
  const m1 = await hud(page);
  const m2 = await hud(page2);
  console.log(
    "  Alice voit :",
    m1?.multi?.status,
    m1?.multi?.pilots.map((p) => p.name).join(", ") || "personne",
  );
  console.log(
    "  Bob voit   :",
    m2?.multi?.status,
    m2?.multi?.pilots.map((p) => p.name).join(", ") || "personne",
  );
  await page.screenshot({ path: `${out}/4-multi-alice.png` });
}

// ---------- 5. A phone, sideways and upright: touch controls clear of one another ----------
if (want("phone")) {
  console.log("5. Téléphone");
  // Pairs of visible controls that overlap (an element and what it contains aside).
  const overlaps = (p: Page, sel: string) =>
    p.evaluate(`(() => {
      const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.getBoundingClientRect().width > 0);
      const out = [];
      for (let i = 0; i < els.length; i++)
        for (let j = i + 1; j < els.length; j++) {
          if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
          const a = els[i].getBoundingClientRect();
          const b = els[j].getBoundingClientRect();
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 2 && h > 2) out.push(els[i].className + " / " + els[j].className);
        }
      return out;
    })()`) as Promise<string[]>;
  const controls = ".game-brake, .game-bar, .game-ears, .game-weight, .game-launch, .gl-touch button, .game-vario, .maplibregl-ctrl-attrib, .game-school";
  for (const [w, h, label] of [
    [844, 390, "couché"],
    [390, 844, "debout"],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    watch(p, `tél. ${label}`);
    for (const startMode of ["forward", "air"] as const) {
      await start(p, { ...base, start: startMode, school: true });
      await p.waitForTimeout(2000);
      const bad = await overlaps(p, controls);
      console.log(`  ${label}, ${startMode === "forward" ? "au déco" : "en vol"} :`, bad.length ? `chevauchements ${bad.join(" ; ")}` : "commandes dégagées");
      if (bad.length) errors.push(`[tél. ${label}] commandes qui se chevauchent : ${bad.join(" ; ")}`);
    }
    await p.screenshot({ path: `${out}/5-telephone-${label}.png` });
    await ctx.close();
  }
}

// ---------- 6. Flying school: guided take-off, a thermal, the approach ----------
if (want("ecole")) {
  console.log("6. Mode école");
  await start(page, { ...base, start: "forward", school: true, launchSlow: 0.75, challenge: null });
  await page.waitForFunction(`!!window.__game.hud().school`, null, { timeout: 15000 });
  await page.screenshot({ path: `${out}/6-ecole-vent.png` });
  // The same pilot as in step 1, the school's tips noted as they come (and a picture of the
  // first brake-step tip).
  const seen = (await page.evaluate(`new Promise((resolve) => {
    const g = window.__game;
    const ids = [];
    let shot = false;
    const t0 = performance.now();
    function tick() {
      const tip = g.school && g.school.active ? g.school.tip.id : null;
      if (tip && ids[ids.length - 1] !== tip) ids.push(tip);
      if (tip === "l-go" && !g.keysDown) { g.keysDown = true; g.keyDown("z"); }
      if (!shot && (tip === "l-dab" || tip === "l-side" || tip === "l-run")) { shot = true; return resolve({ ids, pause: true }); }
      const l = g.launch;
      if (!l) { g.setBrake("L", 0); g.setBrake("R", 0); return resolve({ ids, pause: false }); }
      if (l.phase === "failed" || performance.now() - t0 > 120000) return resolve({ ids, pause: false, failed: true });
      const dab = l.theta > 1.0 && l.thetaRate > 0.15 ? 0.45 : 0.08;
      const k = Math.max(-0.5, Math.min(0.5, l.phi * 2.5 + l.phiRate));
      g.setBrake("L", dab + Math.max(0, k));
      g.setBrake("R", dab + Math.max(0, -k));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`)) as { ids: string[]; pause: boolean; failed?: boolean };
  if (seen.pause) {
    await page.screenshot({ path: `${out}/6-ecole-gonflage.png` });
    const rest = (await page.evaluate(`new Promise((resolve) => {
      const g = window.__game;
      const ids = [];
      const t0 = performance.now();
      function tick() {
        const tip = g.school && g.school.active ? g.school.tip.id : null;
        if (tip && ids[ids.length - 1] !== tip) ids.push(tip);
        const l = g.launch;
        if (!l) { g.setBrake("L", 0); g.setBrake("R", 0); return resolve(ids); }
        if (l.phase === "failed" || performance.now() - t0 > 120000) return resolve(ids.concat(["échec"]));
        const dab = l.theta > 1.0 && l.thetaRate > 0.15 ? 0.45 : 0.08;
        const k = Math.max(-0.5, Math.min(0.5, l.phi * 2.5 + l.phiRate));
        g.setBrake("L", dab + Math.max(0, k));
        g.setBrake("R", dab + Math.max(0, -k));
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })`)) as string[];
    seen.ids.push(...rest);
  }
  await page.waitForTimeout(1500);
  const air = (await page.evaluate(`window.__game.school.active ? window.__game.school.tip.id : null`)) as string | null;
  if (air) seen.ids.push(air);
  console.log("  conseils au décollage :", seen.ids.filter((id, k) => id !== seen.ids[k - 1]).join(" → "));
  if (!seen.ids.includes("l-wind") || !seen.ids.includes("l-go")) errors.push(`[école] étapes du décollage manquantes : ${seen.ids.join(", ")}`);
  await page.screenshot({ path: `${out}/6-ecole-decolle.png` });
  // A thermal: placed 120 m beside the strongest core around, flying across it, to see the
  // school call the side to turn to.
  const thermal = (await page.evaluate(`new Promise((resolve) => {
    const g = window.__game;
    const p0 = { x: g.glider.x, y: g.glider.y };
    // The strongest thermals around now (a thermal lives ~10-20 min, some are off): up to three tries.
    const list = [];
    for (const s of g.air.sources) {
      if (Math.hypot(s.x - p0.x, s.y - p0.y) > 8000) continue;
      const c = g.air.column(s, s.ground + 500, g.gameT);
      if (c && c.w > 1.5) list.push({ s, w: c.w });
    }
    list.sort((a, b) => b.w - a.w);
    if (!list.length) return resolve("aucun thermique");
    let k = -1;
    let t0 = 0;
    let maxV = 0;
    const ids = [];
    function place() {
      k++;
      const s = list[k].s;
      const c = g.air.column(s, s.ground + 500, g.gameT) || { cx: s.x, cy: s.y };
      const p = g.glider;
      const h = Math.atan2(c.cx - p.x, c.cy - p.y);
      p.x = c.cx - Math.sin(h) * 110 + Math.cos(h) * 25;
      p.y = c.cy - Math.cos(h) * 110 - Math.sin(h) * 25;
      p.z = s.ground + 500;
      p.heading = h;
      p.vx = Math.sin(h) * 10;
      p.vy = Math.cos(h) * 10;
      p.vz = 0;
      t0 = performance.now();
    }
    place();
    function tick() {
      const t = g.school.active ? g.school.tip : null;
      if (t && ids[ids.length - 1] !== t.id) ids.push(t.id);
      maxV = Math.max(maxV, g.varioF);
      if (t && t.id === "th-in") return resolve("th-in : " + t.text);
      if (performance.now() - t0 > 12000) {
        if (k + 1 >= Math.min(3, list.length)) return resolve("pas d'entrée détectée (" + ids.join(", ") + ", vario max " + maxV.toFixed(1) + ")");
        place();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`)) as string;
  console.log("  thermique :", thermal);
  await page.screenshot({ path: `${out}/6-ecole-thermique.png` });
  // The approach: 260 m above the documented valley landing field nearest the take-off, 900 m off.
  const approach = (await page.evaluate(`new Promise((resolve) => {
    const g = window.__game;
    const p = g.glider;
    // (A valley field: some sheets list a landing on the take-off's plateau too.)
    const l = g.landings.filter((f) => f.alt !== null && f.alt < 700).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
    if (!l) return resolve("pas d'atterro");
    // From the side where the ground is lowest (a valley, not the slope above the field).
    let a = 0;
    let low = Infinity;
    for (let k = 0; k < 8; k++) {
      const h = g.groundAt(l.x + Math.sin((k * Math.PI) / 4) * 900, l.y + Math.cos((k * Math.PI) / 4) * 900);
      if (h < low) { low = h; a = (k * Math.PI) / 4; }
    }
    p.x = l.x + Math.sin(a) * 900; p.y = l.y + Math.cos(a) * 900; p.z = Math.max(l.alt + 260, (Number.isFinite(low) ? low : l.alt) + 150);
    p.heading = a + Math.PI; p.vx = -Math.sin(a) * 10; p.vy = -Math.cos(a) * 10; p.vz = 0;
    const ids = [];
    // (The field is chosen again within a second.)
    const t0 = performance.now() + 2500;
    function tick() {
      const t = g.school.active ? g.school.tip : null;
      if (t && ids[ids.length - 1] !== t.id) ids.push(t.id);
      if (t && t.id.startsWith("a-") && performance.now() > t0) return resolve(t.id + " : " + t.text);
      if (performance.now() - t0 > 15000) return resolve("pas d'approche (" + ids.join(", ") + ")");
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`)) as string;
  console.log("  approche :", approach);
  await page.screenshot({ path: `${out}/6-ecole-approche.png` });
  const cost = (await page.evaluate(`(() => { const c = window.__game.logicCost; return { mean: c.ms / Math.max(1, c.frames), max: c.maxMs, frames: c.frames, slow: c.slow }; })()`)) as { mean: number; max: number; frames: number; slow: number };
  console.log(`  coût école + défis : ${(cost.mean * 1000).toFixed(1)} µs/image en moyenne, ${cost.slow} images au-dessus de 0,25 ms, ${cost.max.toFixed(2)} ms au plus (${cost.frames} images)`);
}

// ---------- 7. Challenges: an FAI triangle flown by jumps, the ceiling ----------
if (want("defi")) {
  console.log("7. Défis");
  await start(page, { ...base, start: "air", school: false, challenge: "fai", challengeLevel: 1, view: "third" });
  await page.waitForTimeout(2000);
  const fai = (await page.evaluate(`(() => {
    const g = window.__game;
    const pts = g.task.points;
    const sides = [[1, 2], [2, 3], [3, 1]].map(([a, b]) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y));
    const per = sides[0] + sides[1] + sides[2];
    return { name: g.challenge.name, ok: g.challenge.ok, points: pts.map((p) => p.name), perKm: per / 1000, minShare: Math.min(...sides) / per, courseKm: g.challenge.lengthM / 1000 };
  })()`)) as { name: string; ok: boolean; points: string[]; perKm: number; minShare: number; courseKm: number };
  console.log(`  ${fai.name} : ${fai.points.join(" → ")} ; triangle ${fai.perKm.toFixed(1)} km, plus petite branche ${(fai.minShare * 100).toFixed(0)} %, parcours ${fai.courseKm.toFixed(1)} km${fai.ok ? "" : " (difficile aujourd'hui)"}`);
  if (Math.abs(fai.perKm - 25) > 0.3 || fai.minShare < 0.28) errors.push(`[défi] triangle FAI hors règle : ${JSON.stringify(fai)}`);
  await page.screenshot({ path: `${out}/7-defi-fai.png` });
  await page.keyboard.press("p");
  await page.waitForTimeout(500);
  await page.click("text=Carte topo");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/7-defi-topo.png` });
  await page.click("text=Fermer la carte");
  await page.click(".game-pause button.game-go");
  // Tag each cylinder in turn (the glider moved into it, high above the relief), then land: the end card.
  for (let i = 0; i < 5; i++) {
    await page.evaluate(`(() => { const g = window.__game; const p = g.task.points[g.task.next]; if (!p) return; g.glider.x = p.x + 50; g.glider.y = p.y; g.glider.z = Math.max(g.glider.z, 3000); })()`);
    await page.waitForTimeout(700);
  }
  const done = (await page.evaluate(`window.__game.hud().challenge`)) as { done: boolean; clock: string } | null;
  console.log("  parcours :", done?.done ? `bouclé en ${done.clock}` : "pas bouclé");
  if (!done?.done) errors.push("[défi] triangle non validé après les cinq cylindres");
  await page.evaluate(`window.__game.endFlight("landed", -1, 12, "")`);
  await page.waitForSelector(".game-challenge-result", { timeout: 5000 });
  console.log("  bilan :", await page.evaluate(() => document.querySelector(".game-challenge-result")?.textContent));
  await page.screenshot({ path: `${out}/7-defi-bilan.png` });
  // The ceiling: climbed by a jump to the target.
  await start(page, { ...base, start: "air", challenge: "ceiling", challengeLevel: 0, view: "first" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/7-defi-plafond.png` });
  await page.evaluate(`(() => { const g = window.__game; g.glider.z = g.hud().challenge.target + 5; })()`);
  await page.waitForTimeout(1500);
  const ceil = (await page.evaluate(`window.__game.hud().challenge`)) as { done: boolean; clock: string; target: number } | null;
  console.log("  plafond :", ceil?.done ? `atteint en ${ceil.clock} (cible ${Math.round(ceil.target)} m)` : "pas validé");
  if (!ceil?.done) errors.push("[défi] plafond non validé au-dessus de la cible");
}

await browser.close();
if (errors.length) {
  console.log("\nErreurs :\n" + errors.join("\n"));
  process.exit(1);
}
console.log("\nAucune erreur de page.");
