/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * The simulator ("Jeu" tab) in headless Chromium: a forward launch flown with the keyboard
 * (run, a dab of brake as the wing comes overhead, run on), a cross-country task (HUD and
 * cylinders), the topo pause, two pilots in the same multiplayer room, and a phone held
 * sideways and upright (touch controls clear of one another). Screenshots in
 * the output directory; fails on page errors. Rendering is software (SwiftShader): frame
 * rates here mean nothing, only behaviour.
 *
 *   npx tsx apps/web/e2e/game.ts [url] [outDir]
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
  const controls = ".game-brake, .game-bar, .game-ears, .game-weight, .game-launch, .gl-touch button, .game-vario, .maplibregl-ctrl-attrib";
  for (const [w, h, label] of [
    [844, 390, "couché"],
    [390, 844, "debout"],
  ] as const) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    watch(p, `tél. ${label}`);
    for (const startMode of ["forward", "air"] as const) {
      await start(p, { ...base, start: startMode });
      await p.waitForTimeout(2000);
      const bad = await overlaps(p, controls);
      console.log(`  ${label}, ${startMode === "forward" ? "au déco" : "en vol"} :`, bad.length ? `chevauchements ${bad.join(" ; ")}` : "commandes dégagées");
      if (bad.length) errors.push(`[tél. ${label}] commandes qui se chevauchent : ${bad.join(" ; ")}`);
    }
    await p.screenshot({ path: `${out}/5-telephone-${label}.png` });
    await ctx.close();
  }
}

await browser.close();
if (errors.length) {
  console.log("\nErreurs :\n" + errors.join("\n"));
  process.exit(1);
}
console.log("\nAucune erreur de page.");
