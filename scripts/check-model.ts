/**
 * Checks that every documented local phenomenon of the atlas behaves in the wind
 * model (packages/model, TypeScript reference) as its sources describe it, on the
 * real DEM. Writes docs/MODEL_QA.md (French).
 *
 *   npm run model:check [-- atlas.json] [--out docs/MODEL_QA.md] [--json results.json] [--reparse]
 *
 * --reparse re-derives the hours and conditions of the breezes from their atlas
 * text with the current extraction (scripts/build-data.ts), to assess an atlas
 * compiled with an older extraction.
 *
 * Checks (criteria are repeated in the report):
 * - breezes: direction and speed along the path, at the ground and in the layer
 *   (30 % / 60 % of the valley depth or of the documented thickness), in the middle
 *   of their hours (July, no synoptic wind unless their condition says otherwise),
 *   near-zero outside their hours / outside their condition;
 * - convergences: model convergence positive along the line at the documented time;
 * - thermals: thermal potential above the local median at the documented hours;
 * - hazards (venturi, lee, foehn, strong breeze): expected effect under the cited wind,
 *   at the place itself (±330 m), with the documented hazard layer and by the relief
 *   model alone;
 * - take-offs facing the wind (first documented orientation, 20 km/h): must not show
 *   as lee or turbulent (control against a lee drawn everywhere).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Atlas, AtlasFeature, BreezeCondition, CuratedBreezeInput } from '@brises/shared';
import {
  analyseTerrain,
  computeTimeContext,
  evalCell,
  makeWindContext,
  newCellResult,
  rasterizeCurated,
  RULES,
  type CellResult,
  type CuratedLayer,
  type ModelParams,
  type Terrain,
  type TimeContext,
  type WindContext,
} from '@brises/model';
import { loadDem } from '@brises/model/node';
import { parseCondition, parseHours, windFromText } from './build-data';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const ATLAS = resolve(ROOT, args.find((a, i) => !a.startsWith('--') && !['--out', '--json'].includes(args[i - 1] ?? '')) ?? 'apps/web/public/data/atlas.json');
const OUT = resolve(ROOT, opt('--out') ?? 'docs/MODEL_QA.md');
const JSON_OUT = opt('--json');
const REPARSE = args.includes('--reparse');

// ---------- Criteria ----------
/** Direction agrees when cos(model, documented) exceeds this (±60°). */
const COS_OK = 0.5;
/** Share of the samples that must agree in direction. */
const DIR_SHARE = 0.6;
/** Expected model / documented speed ratio (median of the samples). */
const RATIO: [number, number] = [0.5, 1.6];
/** In the upper part of the layer the breeze weakens (Zardi & Whiteman 2013): only its presence is required. */
const RATIO_HIGH_MIN = 0.3;
/** Outside its hours / its condition, the along-path component must stay below this share of the documented speed. */
const OFF_MAX = 0.3;
/** Strong wind threshold (km/h): "vent > 20 km/h = fort" (S8, model rule `seuils-synoptique-vs-brise`). */
const STRONG_KMH = 20;

// ---------- Model setup ----------
const atlas = JSON.parse(readFileSync(ATLAS, 'utf8')) as Atlas;
const { grid, elevation } = loadDem(ROOT);
const terrain: Terrain = analyseTerrain(grid, elevation);
const featureById = new Map(atlas.features.breezes.map((f) => [f.properties.id, f]));

const breezes: CuratedBreezeInput[] = atlas.curated.map((b) => {
  if (!REPARSE) return b;
  const f = featureById.get(b.id);
  const hours = f?.properties.details?.Horaires;
  return { ...b, window: parseHours(hours, b.kind), condition: parseCondition({ name: b.name, hours }) };
});
const layer: CuratedLayer = rasterizeCurated(terrain, breezes, atlas.curatedHazards ?? []);
/** The same without the documented hazards: what the relief model finds by itself. */
const layerPhysics: CuratedLayer = rasterizeCurated(terrain, breezes);

const timeCache = new Map<string, TimeContext>();
interface Scenario {
  month0: number;
  hour: number;
  wind?: { fromDeg: number; kmh: number };
  heatwave?: boolean;
}
function context(s: Scenario, height: ModelParams['height'], curated: CuratedLayer | null = layer): WindContext {
  const p: ModelParams = {
    year: 2026,
    month0: s.month0,
    day: 15,
    hour: ((s.hour % 24) + 24) % 24,
    synoptic: { fromDeg: s.wind?.fromDeg ?? 0, speedKmh: s.wind?.kmh ?? 0 },
    height,
    breezeScale: 1,
    heatwave: s.heatwave,
  };
  const key = `${p.month0}-${p.hour.toFixed(2)}`;
  let time = timeCache.get(key);
  if (!time) {
    time = computeTimeContext(terrain, p);
    timeCache.set(key, time);
  }
  return makeWindContext(terrain, time, p, curated);
}

const W = grid.width;
function cellAt(lon: number, lat: number): number {
  if (!grid.contains(lon, lat)) return -1;
  const [x, y] = grid.toGrid(lon, lat);
  return Math.floor(y) * W + Math.floor(x);
}
const cell = newCellResult();
function evalAt(k: number, ctx: WindContext): CellResult {
  return evalCell(k, ctx, cell);
}
const speed = (v: [number, number]) => Math.hypot(v[0], v[1]);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '–');
const kmh = (ms: number) => `${fmt(ms * 3.6, 0)} km/h`;
const hourTxt = (h: number) => {
  const hh = ((h % 24) + 24) % 24;
  return `${Math.floor(hh)}h${String(Math.round((hh % 1) * 60)).padStart(2, '0')}`;
};

/** Middle of a legal-time window (crossing midnight when start > end). */
function midWindow(w: [number, number] | null | undefined, fallback = 15): number {
  if (!w) return fallback;
  const [a, b] = w;
  return b >= a ? (a + b) / 2 : ((a + b + 24) / 2) % 24;
}

/** Points along a path every `stepKm`, between 10 % and 90 % of its length (the override fades at the ends). */
function samplePath(coords: [number, number][], maxSamples = 12): { lon: number; lat: number; dir: [number, number] }[] {
  const pts = coords.map(([lon, lat]) => [lon * Math.cos((lat * Math.PI) / 180) * 111.32, lat * 110.57] as [number, number]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  if (L < 0.05) return [];
  const n = Math.max(2, Math.min(maxSamples, Math.round((0.8 * L) / 0.8)));
  const out: { lon: number; lat: number; dir: [number, number] }[] = [];
  for (let s = 0; s < n; s++) {
    const d = L * (0.1 + (0.8 * s) / Math.max(1, n - 1));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
    const lon = coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t;
    const lat = coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t;
    // Local tangent over ±0.6 km.
    const at = (dd: number) => {
      let j = 1;
      while (j < cum.length - 1 && cum[j] < dd) j++;
      const tt = Math.max(0, Math.min(1, (dd - cum[j - 1]) / Math.max(1e-9, cum[j] - cum[j - 1])));
      return [pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * tt, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * tt];
    };
    const a = at(Math.max(0, d - 0.6));
    const b = at(Math.min(L, d + 0.6));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    out.push({ lon, lat, dir: [dx / len, dy / len] });
  }
  return out;
}

/**
 * Vertical extent given by an "Épaisseur" text: a thickness above the ground
 * ("200 à 500 m", "50 à 100 m") and/or the altitude the breeze reaches ("sensible
 * jusqu'à 2500 m d'altitude", "remontent jusqu'à ~900 m d'altitude où elles se
 * calment", "jusqu'aux Têtes de L'Argentière (2044 m)").
 */
function layerExtent(text: string | undefined): { thick: number | null; top: number | null } {
  if (!text || /^non document/i.test(text.trim())) return { thick: null, top: null };
  let thick: number | null = null;
  let top: number | null = null;
  for (const clause of text.split(/[;,]/)) {
    const nums = [...clause.matchAll(/(\d{2,4})(?:\s*(?:-|–|à)\s*(\d{2,4}))?\s*m\b/g)];
    if (!nums.length) continue;
    if (/altitude|jusqu|vers|crêtes|têtes|\(\d{3,4} m\)|scotché|rencontrée/i.test(clause) && !/au-dessus d|épaisseur|dénivelé/i.test(clause)) {
      const v = Math.min(...nums.map((m) => Number(m[1])));
      if (v >= 500) top = top === null ? v : Math.min(top, v);
    } else if (!/dénivelé/i.test(clause)) {
      const v = Math.max(...nums.map((m) => Number(m[2] ?? m[1])));
      if (v >= 20 && v <= 1500) thick = thick === null ? v : Math.max(thick, v);
    }
  }
  return { thick, top };
}

/** Default layer thickness by kind when the sheet gives none (m), with its source. */
const KIND_LAYER: Record<string, [number, string] | undefined> = {
  slope: [200, 'brise de pente 100–200 m (S1, règle cycle-brise-pente)'],
  katabatic: [100, 'écoulement descendant 3–100 m (S3)'],
  'plain-to-mountain': [1000, 'aspiration plaine → montagne ≈ 1000 m (S4)'],
  regional: [1000, 'circulation régionale ≈ 1000 m (S4)'],
};

const KIND_FR: Record<string, string> = {
  valley: 'vallée',
  downvalley: 'descendante',
  slope: 'pente',
  'plain-to-mountain': 'plaine → montagne',
  lake: 'lac',
  'pass-transfer': 'transfert de col',
  regional: 'régionale',
  katabatic: 'catabatique',
};

// ---------- Results ----------
type Category = 'brises' | 'convergences' | 'thermiques' | 'pièges';
interface Result {
  category: Category;
  id: string;
  name: string;
  massif: string;
  status: 'ok' | 'échec' | 'non testable';
  /** Hazards: the effect also shows with the relief model alone (documented layer off). */
  physicsOk?: boolean;
  /** Failed sub-checks, or why it is not testable. */
  checks: { name: string; ok: boolean; expected: string; got: string }[];
  cause?: string;
  scenario?: string;
  /** Failure class: model defect, data defect or assumed limit of the model. */
  kind?: 'modèle' | 'donnée' | 'limite';
}

/** Classifies a failure from its diagnosed cause (see MODEL_QA.md). */
function classify(r: Result, breezeKind?: string): Result['kind'] {
  const c = r.cause ?? '';
  if (r.category === 'brises') {
    if (/autre brise documentée|tracé hors du fond|tracé peut-être/.test(c)) return 'donnée';
    if (/^hors horaires/.test(c) && (breezeKind === 'slope' || breezeKind === 'katabatic')) return 'limite';
    if (/confiance|diluée/.test(c) && !/flux générique/.test(c)) return 'limite';
    return 'modèle';
  }
  if (r.category === 'convergences') return /décalée/.test(c) ? 'donnée' : 'modèle';
  if (r.category === 'thermiques') return /déclenchement/.test(c) ? 'modèle' : 'limite';
  return 'limite';
}
const results: Result[] = [];
/** Breezes whose path is covered, outside their hours, by another documented breeze blowing the same way. */
const sharedCorridor = new Set<string>();
/** Documented vs modelled thermal onsets (legal hours). */
const timing: { id: string; doc: number; model: number; explicit: boolean }[] = [];
const massifName = new Map(atlas.massifs.map((m) => [m.id, m.shortName ?? m.name]));

// ---------- Breezes ----------
function seasonMonth(f: AtlasFeature | undefined, cond: BreezeCondition | null | undefined): number {
  if (cond?.regime === 'winter') return 0;
  const s = (f?.properties.details?.Saison ?? '').toLowerCase();
  return /hiver/.test(s) && !/été|printemps|toute/.test(s) ? 0 : 6;
}

function scenarioFor(b: CuratedBreezeInput, f: AtlasFeature | undefined): Scenario {
  const cond = b.condition;
  return {
    month0: seasonMonth(f, cond),
    hour: midWindow(b.window),
    wind: cond?.wind ? { fromDeg: cond.wind.fromDeg, kmh: Math.max(15, cond.wind.minKmh * 1.5) } : undefined,
    heatwave: cond?.regime === 'heatwave',
  };
}

interface Level {
  label: string;
  height: (k: number) => ModelParams['height'] | null;
  speedRange: [number, number] | null;
}

function levelsFor(b: CuratedBreezeInput, f: AtlasFeature | undefined): { levels: Level[]; basis: string } {
  const ground: Level = { label: 'sol (50 m)', height: () => ({ mode: 'agl', meters: 50 }), speedRange: RATIO };
  const thinKind = b.kind === 'slope' || b.kind === 'katabatic';
  const ext = layerExtent(f?.properties.details?.['Épaisseur']);
  // The altitude a breeze reaches: fractions of the way from the valley floor to it.
  if (ext.top && !thinKind) {
    const top = ext.top;
    const atTop = (frac: number) => (k: number) => {
      const asl = terrain.floor[k] + frac * (top - terrain.floor[k]);
      return asl - terrain.z[k] < 30 ? null : ({ mode: 'asl', meters: asl } as const);
    };
    return {
      basis: `altitude atteinte documentée ${top} m`,
      levels: [
        ground,
        { label: `30 % de l’altitude atteinte`, height: atTop(0.3), speedRange: RATIO },
        { label: `60 % de l’altitude atteinte`, height: atTop(0.6), speedRange: [RATIO_HIGH_MIN, RATIO[1]] },
      ],
    };
  }
  const kindLayer = KIND_LAYER[b.kind];
  const L = ext.thick ?? kindLayer?.[0];
  if (L) {
    const basis = ext.thick ? `épaisseur documentée ${ext.thick} m` : kindLayer![1];
    return {
      basis,
      levels: [
        ground,
        { label: `30 % couche (${Math.round(0.3 * L)} m sol)`, height: () => ({ mode: 'agl', meters: Math.max(50, 0.3 * L) }), speedRange: RATIO },
        { label: `60 % couche (${Math.round(0.6 * L)} m sol)`, height: () => ({ mode: 'agl', meters: Math.max(60, 0.6 * L) }), speedRange: [RATIO_HIGH_MIN, RATIO[1]] },
      ],
    };
  }
  // Valley-scale flows: fractions of the local valley depth above the floor.
  const atDepth = (frac: number) => (k: number) => {
    const depth = Math.max(terrain.env[k] - terrain.floor[k], 150);
    const asl = terrain.floor[k] + frac * depth;
    return asl - terrain.z[k] < 30 ? null : ({ mode: 'asl', meters: asl } as const);
  };
  return {
    basis: 'profondeur locale de la vallée (crêtes − fond)',
    levels: [
      ground,
      { label: '30 % profondeur', height: atDepth(0.3), speedRange: RATIO },
      { label: '60 % profondeur', height: atDepth(0.6), speedRange: [RATIO_HIGH_MIN, RATIO[1]] },
    ],
  };
}

interface SampleEval {
  cos: number;
  ratio: number;
  along: number;
  r: { cw: number; ci: number; act: number; cur: number; other: number; slope: number; valley: number; night: number; regional: number; synoptic: number; total: number };
}

function evalSamples(samples: ReturnType<typeof samplePath>, s: Scenario, height: Level['height'], docMs: number, ownIndex: number): SampleEval[] {
  const out: SampleEval[] = [];
  for (const smp of samples) {
    const k = cellAt(smp.lon, smp.lat);
    if (k < 0) continue;
    const h = height(k);
    if (!h) continue;
    const ctx = context(s, h);
    const o = evalAt(k, ctx);
    if (o.underground) continue;
    const proj = (v: [number, number]) => v[0] * smp.dir[0] + v[1] * smp.dir[1];
    const sp = speed(o.total);
    out.push({
      cos: sp > 0.05 ? proj(o.total) / sp : 0,
      ratio: sp / docMs,
      along: proj(o.total) / docMs,
      r: {
        cw: o.curatedIndex === ownIndex ? o.curatedWeight : 0,
        ci: o.curatedIndex,
        act: ctx.curatedActivity[ownIndex] ?? 0,
        cur: o.curatedIndex === ownIndex ? proj(o.curated) * o.curatedWeight * o.breezeWeight : 0,
        other: o.curatedIndex !== ownIndex && o.curatedIndex >= 0 ? proj(o.curated) * o.curatedWeight * o.breezeWeight : 0,
        slope: proj(o.slope),
        valley: proj(o.valley) * (1 - o.curatedWeight),
        night: ctx.time.valleyPhase < 0 ? proj(o.valley) * (1 - o.curatedWeight) * o.breezeWeight : 0,
        regional: proj(o.regional) * (1 - o.curatedWeight),
        synoptic: proj(o.synoptic),
        total: proj(o.total),
      },
    });
  }
  return out;
}

function diagnose(ev: SampleEval[], b: CuratedBreezeInput, kind: 'direction' | 'slow' | 'fast' | 'off'): string {
  const cw = mean(ev.map((e) => e.r.cw));
  const act = mean(ev.map((e) => e.r.act));
  const others = new Map<number, number>();
  ev.forEach((e) => e.r.ci >= 0 && e.r.ci !== breezes.indexOf(b) && others.set(e.r.ci, (others.get(e.r.ci) ?? 0) + 1));
  const top = [...others.entries()].sort((a, b2) => b2[1] - a[1])[0];
  const parts = { pente: mean(ev.map((e) => e.r.slope)), 'vallée générique': mean(ev.map((e) => e.r.valley)), 'plaine/lac/mer': mean(ev.map((e) => e.r.regional)), 'vent météo': mean(ev.map((e) => e.r.synoptic)) };
  const worst = Object.entries(parts).sort((a, c) => a[1] - c[1])[0];
  const best = Object.entries(parts).sort((a, c) => c[1] - a[1])[0];
  if (kind === 'off') return `composante dans le sens du tracé hors horaires : ${Object.entries(parts).map(([n, v]) => `${n} ${kmh(v)}`).join(', ')} (brise documentée active à ${fmt(act * 100, 0)} %)`;
  if (act < 0.3) return `brise documentée peu active à cette heure (activité ${fmt(act * 100, 0)} %)`;
  if (cw < 0.35 && top && top[1] >= ev.length / 3) return `cellules attribuées à une autre brise documentée : ${breezes[top[0]].id} (poids propre moyen ${fmt(cw, 2)})`;
  if (cw < 0.35) return `poids de la brise documentée faible sur le tracé (${fmt(cw, 2)}) : tracé hors du fond de vallée ou en bout de couloir`;
  if (kind === 'direction') return `flux générique opposé (${worst[0]} ${kmh(worst[1])} le long du tracé) malgré la brise documentée (poids ${fmt(cw, 2)})`;
  if (kind === 'slow') return `vitesse documentée diluée : poids ${fmt(cw, 2)}, activité ${fmt(act * 100, 0)} %, apport principal ${best[0]} ${kmh(best[1])}`;
  return `vitesse ajoutée par ${best[0]} (${kmh(best[1])} le long du tracé)`;
}

function checkBreeze(b: CuratedBreezeInput, bi: number): void {
  const f = featureById.get(b.id);
  const p = f?.properties;
  const docKmh = p?.speedKmh ?? b.speedMs * 3.6;
  const docMs = docKmh / 3.6;
  const speedDocumented = !(p?.details?.Force ?? '').startsWith('non documentée');
  const s = scenarioFor(b, f);
  const samples = samplePath(b.coords);
  const res: Result = {
    category: 'brises',
    id: b.id,
    name: `${b.name} (${KIND_FR[b.kind] ?? b.kind}${b.condition ? `, seulement ${b.condition.label}` : ''})`,
    massif: p?.massif ?? b.id.split('/')[0],
    status: 'ok',
    checks: [],
    scenario: `${s.month0 === 0 ? 'janvier' : 'juillet'} ${hourTxt(s.hour)}${s.wind ? `, vent météo ${s.wind.fromDeg}° ${s.wind.kmh} km/h` : ', sans vent météo'}${s.heatwave ? ', canicule' : ''}`,
  };
  results.push(res);
  if (samples.length < 2) {
    res.status = 'non testable';
    res.checks.push({ name: 'tracé', ok: false, expected: 'tracé exploitable', got: 'tracé trop court' });
    return;
  }
  if (b.condition && !b.condition.wind && !b.condition.regime) {
    res.status = 'non testable';
    res.checks.push({ name: 'condition', ok: false, expected: 'condition interprétable', got: b.condition.label });
    return;
  }
  const { levels, basis } = levelsFor(b, f);
  res.scenario += ` · couches : ${basis}`;
  const causes: string[] = [];
  for (const lv of levels) {
    const ev = evalSamples(samples, s, lv.height, docMs, bi);
    if (ev.length < 2) continue;
    const share = ev.filter((e) => e.cos > COS_OK).length / ev.length;
    const dirOk = share >= DIR_SHARE;
    res.checks.push({
      name: `sens, ${lv.label}`,
      ok: dirOk,
      expected: `cos > ${COS_OK} sur ≥ ${DIR_SHARE * 100} % du tracé`,
      got: `${fmt(share * 100, 0)} % (cos médian ${fmt(median(ev.map((e) => e.cos)), 2)})`,
    });
    if (!dirOk) causes.push(`${lv.label} : ${diagnose(ev, b, 'direction')}`);
    if (lv.speedRange && speedDocumented) {
      const r = median(ev.map((e) => e.ratio));
      const ok = r >= lv.speedRange[0] && r <= lv.speedRange[1];
      res.checks.push({
        name: `vitesse, ${lv.label}`,
        ok,
        expected: `${fmt(lv.speedRange[0] * docKmh, 0)}–${fmt(lv.speedRange[1] * docKmh, 0)} km/h (doc. ${docKmh} km/h)`,
        got: `${fmt(r * docKmh, 0)} km/h`,
      });
      if (!ok) causes.push(`${lv.label} : ${diagnose(ev, b, r < lv.speedRange[0] ? 'slow' : 'fast')}`);
    }
  }
  // Outside its hours (diurnal windows) the breeze must be gone.
  const w = b.window;
  if (w && w[1] > w[0] && w[0] >= 6) {
    const offHour = w[0] - 2.5 >= 5.5 ? w[0] - 2.5 : w[1] + 2.5;
    const ev = evalSamples(samples, { ...s, hour: offHour }, levels[0].height, docMs, bi);
    if (ev.length >= 2) {
      // Other phenomena legitimately blowing the same way are not this breeze: another
      // documented breeze active at that hour (shared corridor, listed as a data note)
      // and the generic night/morning down-valley flow.
      const along = median(ev.map((e) => e.along - (e.r.other + e.r.night) / docMs));
      const raw = median(ev.map((e) => e.along));
      const ok = along < OFF_MAX;
      res.checks.push({ name: `hors horaires (${hourTxt(offHour)})`, ok, expected: `composante < ${fmt(OFF_MAX * docKmh, 0)} km/h`, got: `${kmh(along * docMs)}${Math.abs(raw - along) > 0.05 ? ` (${kmh(raw * docMs)} avec l’écoulement nocturne et les autres brises documentées)` : ''}` });
      if (!ok) causes.push(`hors horaires : ${diagnose(ev, b, 'off')}`);
      const other = mean(ev.map((e) => e.r.other)) / docMs;
      if (other > OFF_MAX) sharedCorridor.add(`${b.id}|${offHour}`);
    }
  }
  // Outside its condition a conditional breeze must be gone.
  if (b.condition) {
    const plain: Scenario = { month0: 6, hour: s.hour };
    const ev = evalSamples(samples, plain, levels[0].height, docMs, bi);
    if (ev.length >= 2) {
      const own = mean(ev.map((e) => e.r.cur)) / docMs;
      const ok = own < OFF_MAX;
      res.checks.push({ name: 'hors condition (juillet, sans vent)', ok, expected: 'brise documentée absente', got: `apport ${kmh(own * docMs)}` });
      if (!ok) causes.push('hors condition : la brise conditionnelle reste simulée');
    }
  }
  if (res.checks.some((c) => !c.ok)) {
    res.status = 'échec';
    res.cause = causes.join(' ; ');
    res.kind = classify(res, b.kind);
  }
}

// ---------- Convergences ----------
/** Model convergence (m/s) at a cell, exactly as computeField: smoothed divergence over a 5×5 patch. */
function localConvergence(k: number, ctx: WindContext): number {
  const i0 = k % W;
  const j0 = (k / W) | 0;
  const u = new Map<number, [number, number]>();
  const at = (i: number, j: number): [number, number] => {
    const kk = j * W + i;
    let v = u.get(kk);
    if (!v) {
      const o = evalAt(kk, ctx);
      v = o.underground ? [0, 0] : [o.total[0], o.total[1]];
      u.set(kk, v);
    }
    return v;
  };
  const conv = (i: number, j: number) => {
    const cs = grid.cellM[j];
    const dudx = (at(i + 1, j)[0] - at(i - 1, j)[0]) / (2 * cs);
    const dvdy = -(at(i, j + 1)[1] - at(i, j - 1)[1]) / (2 * cs);
    return -(dudx + dvdy) * RULES.convergenceDepth;
  };
  if (i0 < 3 || j0 < 3 || i0 >= W - 3 || j0 >= grid.height - 3) return NaN;
  let s = 4 * conv(i0, j0);
  s += 2 * (conv(i0 - 1, j0) + conv(i0 + 1, j0) + conv(i0, j0 - 1) + conv(i0, j0 + 1));
  s += conv(i0 - 1, j0 - 1) + conv(i0 + 1, j0 - 1) + conv(i0 - 1, j0 + 1) + conv(i0 + 1, j0 + 1);
  return s / 16;
}

/** Synoptic wind of a free text when it is cited as a situation (convergences, hazards). */
/** Typical speed of the named winds when the text gives none (km/h): mistral 50 (Météo-France: souvent 50–60 km/h en moyenne), foehn 40. */
const NAMED_KMH: [RegExp, number][] = [
  [/mistral/i, 50],
  [/foehn|föhn/i, 40],
];
function citedWind(text: string | undefined, defaultKmh: number): { fromDeg: number; kmh: number; label: string } | null {
  const w = windFromText(text);
  if (!w) return null;
  const t = (text ?? '').toLowerCase();
  const named = NAMED_KMH.find(([re]) => re.test(w.label))?.[1];
  const kmhV = w.kmh ?? (/\bfort|rafale|tempête/.test(t) ? 40 : /faible|léger/.test(t) ? 15 : (named ?? defaultKmh));
  return { fromDeg: w.fromDeg, kmh: kmhV, label: w.label };
}

function lineSamples(f: AtlasFeature): { lon: number; lat: number }[] {
  if (f.geometry.type === 'Point') return [{ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }];
  const c = f.geometry.coordinates;
  const pts: { lon: number; lat: number }[] = [];
  for (let i = 0; i < c.length - 1; i++) {
    const n = Math.max(1, Math.round(Math.hypot((c[i + 1][0] - c[i][0]) * 78, (c[i + 1][1] - c[i][1]) * 111) / 0.6));
    for (let s = 0; s < n; s++) pts.push({ lon: c[i][0] + ((c[i + 1][0] - c[i][0]) * s) / n, lat: c[i][1] + ((c[i + 1][1] - c[i][1]) * s) / n });
  }
  pts.push({ lon: c[c.length - 1][0], lat: c[c.length - 1][1] });
  return pts.length > 40 ? pts.filter((_, i) => i % Math.ceil(pts.length / 40) === 0) : pts;
}

function checkConvergence(f: AtlasFeature): void {
  const p = f.properties;
  const when = p.details?.Quand;
  const window = parseHours(when, 'valley');
  const res: Result = { category: 'convergences', id: p.id, name: p.name, massif: p.massif, status: 'ok', checks: [] };
  results.push(res);
  if (!window) {
    res.status = 'non testable';
    res.checks.push({ name: 'heure', ok: false, expected: 'heure analysable dans « Quand »', got: when ?? '(absent)' });
    return;
  }
  const wind = /synoptique|situation|flux|lombarde|mistral|bise/i.test(when ?? '') ? citedWind(when, 15) : null;
  const s: Scenario = { month0: 6, hour: midWindow(window), wind: wind ?? undefined };
  res.scenario = `juillet ${hourTxt(s.hour)}${wind ? `, ${wind.label} ${wind.kmh} km/h` : ', sans vent météo'}, 80 m sol`;
  const ctx = context(s, { mode: 'agl', meters: 80 });
  // Tolerance of one cell (216 m, the model resolution) around the drawn line.
  const vals = lineSamples(f)
    .map(({ lon, lat }) => cellAt(lon, lat))
    .filter((k) => k >= 0)
    .map((k) => Math.max(...[-W - 1, -W, -W + 1, -1, 0, 1, W - 1, W, W + 1].map((d) => localConvergence(k + d, ctx)).filter(Number.isFinite)))
    .filter(Number.isFinite);
  const share = vals.filter((v) => v > 0).length / Math.max(1, vals.length);
  const avg = mean(vals);
  const ok = share >= 0.5 && avg > 0;
  res.checks.push({ name: 'convergence le long de la ligne', ok, expected: 'moyenne > 0 et ≥ 50 % des points > 0', got: `moyenne ${fmt(avg, 2)} m/s, ${fmt(share * 100, 0)} % > 0` });
  if (!ok) {
    res.status = 'échec';
    const maxNear = Math.max(...vals);
    res.cause = maxNear > 0.1 ? `convergence présente mais décalée ou intermittente (max ${fmt(maxNear, 2)} m/s sur la ligne)` : 'les flux modélisés ne se rencontrent pas sur cette ligne à cette heure';
  }
}

// ---------- Thermals ----------
function checkThermal(f: AtlasFeature): void {
  const p = f.properties;
  const hours = p.details?.Heures;
  let window = parseHours(hours, 'slope');
  const res: Result = { category: 'thermiques', id: p.id, name: p.name, massif: p.massif, status: 'ok', checks: [] };
  results.push(res);
  const assumed = !window;
  if (!window) window = [12, 15];
  const s: Scenario = { month0: 6, hour: midWindow(window) };
  res.scenario = `juillet ${hourTxt(s.hour)}${assumed ? ' (heures non précisées : milieu de journée supposé)' : ''}`;
  const ctx = context(s, { mode: 'agl', meters: 80 });
  const [lon, lat] = f.geometry.type === 'Point' ? f.geometry.coordinates : f.geometry.coordinates[0];
  const k = cellAt(lon, lat);
  if (k < 0) {
    res.status = 'non testable';
    return;
  }
  const i0 = k % W;
  const j0 = (k / W) | 0;
  let here = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) here = Math.max(here, evalAt((j0 + dj) * W + i0 + di, ctx).thermal);
  const R = Math.round(5000 / grid.cellM[j0]);
  const around: number[] = [];
  for (let dj = -R; dj <= R; dj += 2)
    for (let di = -R; di <= R; di += 2) {
      if (di * di + dj * dj > R * R) continue;
      const kk = (j0 + dj) * W + i0 + di;
      if (kk < 0 || kk >= grid.size || terrain.water[kk]) continue;
      around.push(evalAt(kk, ctx).thermal);
    }
  const med = median(around);
  const rank = around.filter((v) => v < here).length / Math.max(1, around.length);
  const ok = here > med;
  res.checks.push({ name: 'potentiel thermique', ok, expected: 'au-dessus de la médiane locale (5 km)', got: `${fmt(here, 2)} (médiane ${fmt(med, 2)}, rang ${fmt(rank * 100, 0)} %)` });
  // Timing: a documented spot shows its thermal column (3D layer) when its potential
  // exceeds 0.25 / 1.15 (wind-scene.ts, documented spots). It must start within ±1 h
  // of the documented onset.
  const COLUMN = 0.25 / 1.15;
  let onsetOk = true;
  if (!assumed && window[1] > window[0]) {
    let onsetH = NaN;
    for (let hr = 5; hr <= 16; hr += 0.25) {
      const cx = context({ month0: 6, hour: hr }, { mode: 'agl', meters: 80 });
      let v = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) v = Math.max(v, evalAt((j0 + dj) * W + i0 + di, cx).thermal);
      if (v >= COLUMN) {
        onsetH = hr;
        break;
      }
    }
    // Only an explicit onset ("dès 10h", "3 h après le lever du soleil") can be too
    // early; "après-midi", "12h-17h" often give the best hours, not the onset.
    const explicit = /dès|à partir|lever/.test(hours ?? '');
    // Period words ("matin" = 8h–11h30) say the thermals work during that period: the
    // column must show by its middle, or 1 h after its start for short periods.
    const latest = explicit ? window[0] + 1 : Math.max(window[0] + 1, (window[0] + window[1]) / 2);
    onsetOk = Number.isFinite(onsetH) && onsetH <= latest && (!explicit || onsetH - window[0] >= -1);
    res.checks.push({
      name: 'déclenchement',
      ok: onsetOk,
      expected: explicit ? `colonne thermique à ±1 h du début documenté (${hourTxt(window[0])})` : `colonne thermique au plus tard à ${hourTxt(latest)} (heures documentées ${hourTxt(window[0])}–${hourTxt(window[1])})`,
      got: Number.isFinite(onsetH) ? `${hourTxt(onsetH)}${explicit && onsetH < window[0] - 1 ? ' (trop tôt)' : onsetH > latest ? ' (trop tard)' : ''}` : 'pas de colonne avant 16h',
    });
    timing.push({ id: p.id, doc: window[0], model: onsetH, explicit });
  }
  if (!ok || !onsetOk) {
    res.status = 'échec';
    const o = evalAt(k, ctx);
    res.cause = ok
      ? 'déclenchement décalé par rapport au début documenté'
      : o.insolation < 0.4 ? `pente peu ensoleillée à cette heure dans le modèle (ensoleillement ${fmt(o.insolation * 100, 0)} %, exposition ${Math.round(o.aspectDeg)}°)` : `relief concave ou bas pour le modèle (convexité TPI ${Math.round(terrain.tpi[k])} m, altitude ${Math.round(o.elevation)} m)`;
  }
}

// ---------- Hazards ----------
const HAZARD_RADIUS_M = 330;
function disc(k: number, radiusM: number, step = 1): number[] {
  const i0 = k % W;
  const j0 = (k / W) | 0;
  const R = Math.max(1, Math.round(radiusM / grid.cellM[j0]));
  const out: number[] = [];
  for (let dj = -R; dj <= R; dj += step)
    for (let di = -R; di <= R; di += step) {
      if (di * di + dj * dj > R * R) continue;
      const i = i0 + di;
      const j = j0 + dj;
      if (i < 0 || j < 0 || i >= W || j >= grid.height) continue;
      out.push(j * W + i);
    }
  return out;
}

function checkHazard(f: AtlasFeature): void {
  const p = f.properties;
  const kind = p.kind ?? 'other';
  if (!['venturi', 'lee-rotor', 'foehn', 'strong-breeze'].includes(kind)) return;
  const cond = p.details?.Conditions ?? '';
  const res: Result = { category: 'pièges', id: p.id, name: `${p.name} (${kind})`, massif: p.massif, status: 'ok', checks: [] };
  results.push(res);
  // At the place itself (±1.5 cells): the effect has to show where the pilots report it,
  // not somewhere within a few kilometres.
  const radius = HAZARD_RADIUS_M;
  const window = parseHours(cond, 'valley');
  // A strong breeze with hours is a breeze phenomenon: winds cited around it ("plus tôt
  // par vent de nord") only modulate it.
  const wind =
    kind === 'strong-breeze' && window
      ? null
      : (citedWind(cond, kind === 'foehn' ? 40 : 30) ?? (kind === 'foehn' ? { fromDeg: 180, kmh: 40, label: 'foehn (flux de sud)' } : null));
  if (!wind && (kind === 'lee-rotor' || !window)) {
    res.status = 'non testable';
    res.checks.push({ name: 'conditions', ok: false, expected: 'vent météo cité (direction) ou horaire de brise', got: cond || '(absent)' });
    return;
  }
  // Storm outflows and fronts are events, not a regular day: the model does not simulate them.
  if (kind === 'strong-breeze' && /orage|cumulonimbus|cu-?nims?|front froid|tempête/i.test(`${p.name} ${cond}`)) {
    res.status = 'non testable';
    res.checks.push({ name: 'conditions', ok: false, expected: 'situation régulière', got: 'événement orageux, non simulé' });
    return;
  }
  const s: Scenario = {
    month0: 6,
    hour: window ? midWindow(window) : 14,
    wind: wind ? { fromDeg: wind.fromDeg, kmh: wind.kmh } : undefined,
    heatwave: /canicule|forte chaleur/i.test(cond),
  };
  res.scenario = `juillet ${hourTxt(s.hour)}${wind ? `, ${wind.label} ${wind.kmh} km/h` : ', sans vent météo'}${s.heatwave ? ', canicule' : ''}, 80 m sol, à ${radius} m du point`;
  const [lon, lat] = f.geometry.type === 'Point' ? f.geometry.coordinates : f.geometry.coordinates[0];
  const k = cellAt(lon, lat);
  if (k < 0) {
    res.status = 'non testable';
    return;
  }
  const ctx = context(s, { mode: 'agl', meters: 80 });
  const cells = disc(k, radius).filter((kk) => !evalAt(kk, ctx).underground);
  // The relief model alone (documented hazards off): informative, does not decide the status.
  const ctxP = context(s, { mode: 'agl', meters: 80 }, layerPhysics);
  const physics = cells.map((kk) => {
    const o = evalAt(kk, ctxP);
    return { lee: o.lee, turb: o.turbulence, ven: o.venturi, sp: speed(o.total) };
  });
  const vals = cells.map((kk) => {
    const o = evalAt(kk, ctx);
    return { sp: speed(o.total), lee: o.lee, turb: o.turbulence, ven: o.venturi };
  });
  const maxSp = Math.max(...vals.map((v) => v.sp));
  const maxLee = Math.max(...vals.map((v) => v.lee));
  const maxTurb = Math.max(...vals.map((v) => v.turb));
  const maxVen = Math.max(...vals.map((v) => v.ven));
  const synMs = (wind?.kmh ?? 0) / 3.6;
  const pLee = Math.max(...physics.map((v) => v.lee));
  const pTurb = Math.max(...physics.map((v) => v.turb));
  const pVen = Math.max(...physics.map((v) => v.ven));
  const pSp = Math.max(...physics.map((v) => v.sp));
  let physicsOk: boolean;
  let ok: boolean;
  let expected: string;
  let got: string;
  if (kind === 'venturi') {
    // Acceleration relative to the flow around (valley cells within 10 km, same
    // scenario): the channelled wind of a valley floor is itself only 0.3–0.6 × the
    // synoptic wind (rule `combinaison-synoptique-brise`).
    const wide = disc(k, 10000, 3)
      .filter((kk) => terrain.valley[kk] > 0.2 && !evalAt(kk, ctx).underground)
      .map((kk) => speed(evalAt(kk, ctx).total));
    const ref = median(wide.length ? wide : [synMs]);
    const accel = maxSp / Math.max(ref, 0.3);
    ok = accel >= 1.15 || (!!wind && maxVen >= 0.3);
    physicsOk = pSp / Math.max(ref, 0.3) >= 1.15 || (!!wind && pVen >= 0.3);
    expected = `vent ≥ 1,15 × médiane des fonds de vallée voisins (10 km)${wind ? ' ou indice venturi ≥ 0,3' : ''}`;
    got = `max ${kmh(maxSp)} (×${fmt(accel, 2)} la médiane ${kmh(ref)}), venturi ${fmt(maxVen, 2)}`;
  } else if (kind === 'lee-rotor') {
    ok = Math.max(maxLee, maxTurb) >= 0.35;
    physicsOk = Math.max(pLee, pTurb) >= 0.35;
    expected = 'abri (sous le vent) ou turbulence ≥ 0,35';
    got = `abri ${fmt(maxLee, 2)}, turbulence ${fmt(maxTurb, 2)}`;
  } else if (kind === 'foehn') {
    ok = maxTurb >= 0.3 || maxSp >= 0.8 * synMs;
    physicsOk = pTurb >= 0.3 || pSp >= 0.8 * synMs;
    expected = `vent fort descendant (≥ ${kmh(0.8 * synMs)}) ou turbulence ≥ 0,3`;
    got = `max ${kmh(maxSp)}, turbulence ${fmt(maxTurb, 2)}, abri ${fmt(maxLee, 2)}`;
  } else {
    ok = maxSp * 3.6 >= STRONG_KMH;
    physicsOk = pSp * 3.6 >= STRONG_KMH;
    expected = `vent ≥ ${STRONG_KMH} km/h (« fort », S8)`;
    got = `max ${kmh(maxSp)}`;
  }
  res.checks.push({ name: 'effet attendu', ok, expected, got });
  res.physicsOk = physicsOk;
  if (!ok) {
    res.status = 'échec';
    res.cause =
      kind === 'foehn'
        ? 'pas de dynamique de foehn dans le modèle (versant sous le vent abrité au lieu d’un vent descendant) — limite assumée'
        : kind === 'lee-rotor'
          ? `relief au vent pas assez haut pour l’indice d’abri (angle max ${fmt(Math.max(...cells.map((kk) => evalAt(kk, ctx).shelterDeg)), 0)}°)`
          : kind === 'venturi'
            ? 'pas de resserrement perpendiculaire au flux détecté à la maille de 216 m'
            : 'brise modélisée moins forte que décrite à cet endroit';
  }
}

// ---------- Opposite breezes sharing a corridor ----------
interface Conflict {
  a: string;
  b: string;
  cos: number;
  hours: string;
}
function overlap(a: [number, number] | null, b: [number, number] | null): boolean {
  const span = (w: [number, number] | null) => (w ? (w[1] >= w[0] ? [[w[0], w[1]]] : [[w[0], 24], [0, w[1]]]) : [[11, 19]]);
  return span(a).some(([a0, a1]) => span(b).some(([b0, b1]) => Math.min(a1, b1) - Math.max(a0, b0) > 1));
}
function sameCondition(a: BreezeCondition | null | undefined, b: BreezeCondition | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  if (a.regime || b.regime) return a.regime === b.regime;
  if (a.wind && b.wind) return Math.abs(((a.wind.fromDeg - b.wind.fromDeg + 540) % 360) - 180) < 60;
  return a.label === b.label;
}
function findConflicts(): Conflict[] {
  const out: Conflict[] = [];
  const samp = breezes.map((b) => samplePath(b.coords, 20));
  for (let i = 0; i < breezes.length; i++)
    for (let j = i + 1; j < breezes.length; j++) {
      const A = breezes[i];
      const B = breezes[j];
      if (!overlap(A.window, B.window) || !sameCondition(A.condition, B.condition)) continue;
      const R = Math.min(A.radiusM, B.radiusM) / 1000;
      const coss: number[] = [];
      for (const s of samp[i]) {
        let best: (typeof samp)[number][number] | null = null;
        let bd = Infinity;
        for (const t of samp[j]) {
          const d = Math.hypot((s.lon - t.lon) * 78.7, (s.lat - t.lat) * 111.2);
          if (d < bd) {
            bd = d;
            best = t;
          }
        }
        if (best && bd < R) coss.push(s.dir[0] * best.dir[0] + s.dir[1] * best.dir[1]);
      }
      if (coss.length >= 3 && median(coss) < -0.5) {
        const fmtW = (w: [number, number] | null) => (w ? `${hourTxt(w[0])}–${hourTxt(w[1])}` : 'cycle générique');
        out.push({ a: A.id, b: B.id, cos: median(coss), hours: `${fmtW(A.window)} / ${fmtW(B.window)}` });
      }
    }
  return out;
}

// ---------- Run ----------
const t0 = performance.now();
breezes.forEach((b, i) => checkBreeze(b, i));
atlas.features.convergences.forEach(checkConvergence);
// Hotspots known only from GPS tracks describe no phenomenon to reproduce.
atlas.features.thermals.filter((f) => f.properties.origin !== 'kk7').forEach(checkThermal);
atlas.features.hazards.forEach(checkHazard);

// ---------- Control: take-offs facing the wind ----------
// A take-off documented for a wind direction is flown with that wind: with it blowing
// straight in (first documented orientation, 20 km/h), the model must not show it as
// lee or turbulent. Guards the lee and the documented hazards against false alarms.
const ORIENT: Record<string, number> = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SSO: 202.5, SW: 225, SO: 225, WSW: 247.5, OSO: 247.5, W: 270, O: 270, WNW: 292.5, ONO: 292.5, NW: 315, NO: 315, NNW: 337.5, NNO: 337.5 };
const takeoffControl = { n: 0, bad: [] as { name: string; massif: string; orient: string; lee: number; turb: number; hazard: string | null }[] };
for (const f of atlas.features.takeoffs) {
  const o = (f.properties.details?.Orientation ?? '').split(/[,;/ ]+/)[0]?.toUpperCase();
  if (!o || ORIENT[o] === undefined || f.geometry.type !== 'Point') continue;
  const k = cellAt(f.geometry.coordinates[0] as number, f.geometry.coordinates[1] as number);
  if (k < 0) continue;
  const c = evalAt(k, context({ month0: 6, hour: 14, wind: { fromDeg: ORIENT[o], kmh: 20 } }, { mode: 'agl', meters: 80 }));
  takeoffControl.n++;
  if (Math.max(c.lee, c.turbulence) >= 0.35)
    takeoffControl.bad.push({ name: f.properties.name, massif: f.properties.massif, orient: o, lee: c.lee, turb: c.turbulence, hazard: c.hazardIndex >= 0 ? (layer.hazards?.[c.hazardIndex]?.name ?? null) : null });
}
const conflicts = findConflicts();
const ms = performance.now() - t0;
for (const r of results) if (r.status === 'échec' && !r.kind) r.kind = classify(r);

// ---------- Data defects (from the extraction, never written back to research_notes) ----------
interface DataDefect {
  id: string;
  file: string;
  issue: string;
}
const dataDefects: DataDefect[] = [];
const sourceFile = (f: AtlasFeature | undefined) => (f?.properties.sources.split(',')[0]?.split(':')[0] ?? '?') + '.json';
for (const b of breezes) {
  const f = featureById.get(b.id);
  const p = f?.properties;
  if (!b.window && !b.condition?.wind) dataDefects.push({ id: b.id, file: sourceFile(f), issue: `horaires non analysables (« ${p?.details?.Horaires ?? ''} ») : la brise suit le cycle générique de vallée` });
  if (p && (p.speedKmh ?? 0) > 25)
    dataDefects.push({
      id: b.id,
      file: sourceFile(f),
      issue: `vitesse typique ${p.speedKmh} km/h, au-dessus des valeurs typiques (brise de vallée 3–7 m/s ≈ 10–25 km/h, S3 ; 30–40 km/h seulement en quelques sites connus) : valeur de pointe plutôt que typique ? Le modèle l’applique sur tout le couloir pendant toute la fenêtre`,
    });
  if (p && (p.speedKmh ?? 99) < 4) dataDefects.push({ id: b.id, file: sourceFile(f), issue: `vitesse typique ${p.speedKmh} km/h (quasi nulle)` });
}
for (const key of sharedCorridor) {
  const [id, h] = key.split('|');
  dataDefects.push({ id, file: sourceFile(featureById.get(id)), issue: `hors de ses horaires (${hourTxt(Number(h))}), son couloir est occupé par une autre brise documentée du même sens : doublon probable du même flux (à fusionner, ou horaires à harmoniser)` });
}
for (const c of conflicts) {
  const fa = featureById.get(c.a);
  dataDefects.push({
    id: `${c.a} ↔ ${c.b}`,
    file: sourceFile(fa),
    issue: `brises opposées dans le même couloir aux mêmes heures (${c.hours}, cos ${fmt(c.cos, 2)}), sans condition qui les distingue : elles se remplacent cellule par cellule. Ajouter un champ \`condition\` à celle qui n’existe que dans certaines situations, ou corriger le sens d’un tracé.`,
  });
}
// Breezes whose direction fails at every level while the reversed path would pass: path probably reversed.
for (const r of results.filter((x) => x.category === 'brises' && x.status === 'échec')) {
  const dirChecks = r.checks.filter((c) => c.name.startsWith('sens'));
  if (dirChecks.length && dirChecks.every((c) => !c.ok && /cos médian -0,[6-9]|cos médian -1/.test(c.got))) {
    dataDefects.push({ id: r.id, file: sourceFile(featureById.get(r.id)), issue: 'le modèle souffle partout à l’opposé du tracé : tracé peut-être inversé (à vérifier dans la source)' });
  }
}

function timingSummary(): string {
  const d = timing.filter((x) => Number.isFinite(x.model) && x.explicit).map((x) => x.model - x.doc);
  return `déclenchement des thermiques au début explicite (« dès 10h », « à partir de midi », « 3 h après le lever du soleil ») : écart médian modèle − fiche ${fmt(median(d), 2)} h sur ${d.length} sites (${d.filter((x) => x < -1).length} trop tôt, ${d.filter((x) => x > 1).length} trop tard)`;
}

// ---------- Report ----------
const cats: Category[] = ['brises', 'convergences', 'thermiques', 'pièges'];
const rate = (rs: Result[]) => {
  const tested = rs.filter((r) => r.status !== 'non testable');
  const ok = tested.filter((r) => r.status === 'ok').length;
  return { ok, tested: tested.length, untestable: rs.length - tested.length, pct: tested.length ? (100 * ok) / tested.length : NaN };
};
const lines: string[] = [];
lines.push('# Contrôle du modèle de vent contre l’atlas');
lines.push('');
lines.push(
  `Généré par \`npm run model:check\` le ${new Date().toISOString().slice(0, 10)} sur \`${ATLAS.replace(ROOT + '/', '')}\` (atlas du ${atlas.generatedAt.slice(0, 10)})${REPARSE ? ', horaires et conditions ré-extraits du texte' : ''}, modèle TypeScript de référence (\`packages/model\`) sur le MNT réel. Durée : ${fmt(ms / 1000, 1)} s.`,
);
lines.push('');
lines.push('## Critères');
lines.push('');
lines.push(
  `- **Brises** : échantillons le long du tracé (10 à 90 % de sa longueur), au milieu de la fenêtre horaire, en juillet sans vent météo (janvier pour une brise d’hiver ; vent météo ou canicule simulés pour une brise conditionnelle). Niveaux : sol (50 m), puis 30 % et 60 % de la couche : altitude atteinte documentée (« Épaisseur » : « sensible jusqu’à 2500 m d’altitude », mesurée depuis le fond de vallée), sinon épaisseur documentée, sinon profondeur locale de la vallée pour les brises de vallée, 200 m pour la pente, 100 m pour un catabatique, 1000 m pour plaine → montagne et régionale. Sens : cos > ${COS_OK} sur au moins ${DIR_SHARE * 100} % des points. Vitesse (si documentée) : rapport médian modèle / fiche entre ${fmt(RATIO[0])} et ${fmt(RATIO[1])} au sol et à 30 %, au moins ${fmt(RATIO_HIGH_MIN)} à 60 % (la brise faiblit vers le haut de la couche, Zardi & Whiteman 2013). Hors horaires (2 h 30 avant le début, ou après la fin) et hors condition : composante le long du tracé < ${OFF_MAX * 100} % de la vitesse documentée.`,
);
lines.push('- **Convergences** : convergence du modèle (divergence lissée, comme la couche « Convergences ») à 80 m sol, à l’heure de « Quand », avec une tolérance d’une maille (216 m) autour de la ligne : moyenne > 0 et au moins la moitié des points > 0.');
lines.push('- **Thermiques** : potentiel thermique (max sur 3 × 3 mailles, positions approchées) au-dessus de la médiane des terres dans un rayon de 5 km, aux heures « Heures » (12h–15h si non précisées) ; et, quand un début est documenté, colonne thermique affichée (potentiel ≥ 0,22, seuil des colonnes des sites connus) à ±1 h d’un début explicite (« dès 10h », « 3 h après le lever du soleil »), sinon au plus tard au milieu de la période documentée (1 h après son début pour une période courte).');
lines.push(
  `- **Pièges** : venturi, sous le vent, foehn et brise forte, sous le vent météo cité par « Conditions » (30 km/h par défaut, 40 si « fort », 15 si « faible ») ou à l’heure de brise citée, au point même (à ${HAZARD_RADIUS_M} m près), avec la couche des dangers documentés (ce que voit l’utilisateur) et, à titre indicatif, par le modèle de relief seul : accélération ≥ ×1,15 par rapport à la médiane des fonds de vallée voisins (10 km) ou indice venturi ≥ 0,3 ; abri ou turbulence ≥ 0,35 ; vent descendant ≥ 0,8 × vent météo ou turbulence ≥ 0,3 ; vent ≥ ${STRONG_KMH} km/h. Sans vent ni horaire cité : non testable.`,
);
lines.push('');
lines.push('## Taux de réussite par catégorie');
lines.push('');
lines.push('| Catégorie | Réussis | Testés | Taux | Non testables |');
lines.push('| --- | --- | --- | --- | --- |');
for (const c of cats) {
  const r = rate(results.filter((x) => x.category === c));
  lines.push(`| ${c} | ${r.ok} | ${r.tested} | ${fmt(r.pct, 0)} % | ${r.untestable} |`);
}
const all = rate(results);
lines.push(`| **total** | **${all.ok}** | **${all.tested}** | **${fmt(all.pct, 0)} %** | ${all.untestable} |`);
lines.push('');
{
  const hz = results.filter((x) => x.category === 'pièges' && x.status !== 'non testable');
  const phys = hz.filter((x) => x.physicsOk).length;
  const lee = hz.filter((x) => x.name.endsWith('(lee-rotor)'));
  lines.push(
    `Pièges au point par le modèle de relief seul (sans la couche des dangers documentés) : ${phys}/${hz.length} (${fmt((100 * phys) / Math.max(1, hz.length), 0)} %), dont sous le vent ${lee.filter((x) => x.physicsOk).length}/${lee.length}. Le reste n’apparaît que par la couche des dangers documentés, active quand le vent simulé correspond à leurs conditions.`,
  );
  lines.push('');
  const tb = takeoffControl.bad;
  lines.push(
    `Contrôle : décollages face au vent (première orientation documentée, 20 km/h) affichés sous le vent ou turbulents : ${tb.length}/${takeoffControl.n} (${fmt((100 * tb.length) / Math.max(1, takeoffControl.n), 1)} %)${tb.length ? ' — ' + tb.slice(0, 12).map((b) => `${b.name} (${b.orient}${b.hazard ? `, danger documenté « ${b.hazard.slice(0, 60)} »` : ''})`).join(' ; ') : ''}.`,
  );
  lines.push('');
}
// Sub-checks of the breezes.
const sub = new Map<string, { ok: number; n: number }>();
for (const r of results.filter((x) => x.category === 'brises'))
  for (const c of r.checks) {
    const key = c.name.replace(/\(.*\)/, '').replace(/couche|profondeur/, 'couche').replace(/\s+/g, ' ').trim();
    const e = sub.get(key) ?? { ok: 0, n: 0 };
    e.n++;
    if (c.ok) e.ok++;
    sub.set(key, e);
  }
lines.push('Contrôles élémentaires des brises :');
lines.push('');
lines.push('| Contrôle | Réussis | Testés | Taux |');
lines.push('| --- | --- | --- | --- |');
for (const [k, v] of [...sub.entries()].sort()) lines.push(`| ${k} | ${v.ok} | ${v.n} | ${fmt((100 * v.ok) / v.n, 0)} % |`);
lines.push('');
lines.push(`Calendrier : ${timingSummary()}. Les heures « après-midi » ou « 12h-17h » des fiches de thermiques décrivent souvent la meilleure période plutôt que le déclenchement : seuls les débuts explicites mesurent un décalage systématique.`);
lines.push('');
lines.push('## Taux de réussite par secteur');
lines.push('');
lines.push('| Secteur | Brises | Convergences | Thermiques | Pièges | Total |');
lines.push('| --- | --- | --- | --- | --- | --- |');
const massifIds = [...new Set(results.map((r) => r.massif))].sort((a, b) => (massifName.get(a) ?? a).localeCompare(massifName.get(b) ?? b, 'fr'));
for (const m of massifIds) {
  const rs = results.filter((r) => r.massif === m);
  const cell = (c?: Category) => {
    const r = rate(c ? rs.filter((x) => x.category === c) : rs);
    return r.tested ? `${r.ok}/${r.tested}` : '–';
  };
  lines.push(`| ${massifName.get(m) ?? m} | ${cell('brises')} | ${cell('convergences')} | ${cell('thermiques')} | ${cell('pièges')} | ${cell()} |`);
}
lines.push('');
lines.push('## Échecs');
lines.push('');
const kinds: NonNullable<Result['kind']>[] = ['modèle', 'donnée', 'limite'];
lines.push('Classement : **modèle** = défaut du modèle à corriger ; **donnée** = tracé, horaires ou couloirs de la fiche à revoir (voir la dernière section) ; **limite** = limite assumée du modèle (résolution 216 m, pas de dynamique de foehn, pas d’accélération des brises aux cols, convexité à l’échelle de 1,5 km pour le potentiel thermique, pondération par la confiance des sources).');
lines.push('');
lines.push('| Catégorie | ' + kinds.join(' | ') + ' |');
lines.push('| --- | --- | --- | --- |');
for (const c of cats) lines.push(`| ${c} | ${kinds.map((k) => results.filter((r) => r.category === c && r.status === 'échec' && r.kind === k).length).join(' | ')} |`);
lines.push('');
for (const c of cats) {
  const fails = results.filter((r) => r.category === c && r.status === 'échec');
  lines.push(`### ${c[0].toUpperCase() + c.slice(1)} (${fails.length})`);
  lines.push('');
  for (const r of fails) {
    lines.push(`- **${r.name}** — \`${r.id}\`, ${massifName.get(r.massif) ?? r.massif} · *${r.kind}*${r.scenario ? ` · ${r.scenario}` : ''}`);
    for (const ch of r.checks.filter((x) => !x.ok)) lines.push(`  - ${ch.name} : attendu ${ch.expected} ; obtenu ${ch.got}`);
    if (r.cause) lines.push(`  - cause probable : ${r.cause}`);
  }
  lines.push('');
}
lines.push('## Non testables');
lines.push('');
for (const r of results.filter((x) => x.status === 'non testable')) lines.push(`- ${r.category} · ${r.name} (\`${r.id}\`) : ${r.checks.map((c) => `${c.got}`).join(' ; ') || 'position hors grille'}`);
lines.push('');
lines.push('## Défauts de données à corriger dans les notes de recherche');
lines.push('');
lines.push('Repérés automatiquement ; à corriger dans les JSON de `research_notes/`, pas dans l’atlas compilé. Le fichier indiqué est celui de la première source citée (une source partagée est rattachée au premier fichier qui la cite) : à confirmer avec le préfixe de l’identifiant (secteur).');
lines.push('');
for (const d of dataDefects) lines.push(`- \`${d.id}\` (${d.file}) : ${d.issue}`);
lines.push('');
writeFileSync(OUT, lines.join('\n'));
if (JSON_OUT) writeFileSync(resolve(ROOT, JSON_OUT), JSON.stringify({ results, conflicts, dataDefects, timing }, null, 1));
console.log(timingSummary());
for (const c of cats) {
  const r = rate(results.filter((x) => x.category === c));
  console.log(`${c.padEnd(13)} ${r.ok}/${r.tested} (${fmt(r.pct, 0)} %), non testables ${r.untestable}`);
}
console.log(`total ${all.ok}/${all.tested} (${fmt(all.pct, 0)} %) · ${conflicts.length} paires opposées · ${dataDefects.length} défauts de données · ${fmt(ms / 1000, 1)} s → ${OUT.replace(ROOT + '/', '')}`);
