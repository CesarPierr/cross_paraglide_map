/**
 * Importance of the atlas items, so a massif reads at a glance: what structures its
 * aerology first, the secondary next, the detail last. Computed by the data pipeline
 * (scripts/build-data.ts stamps `rank` and `tier` on every feature) and, for an older
 * atlas without them, by the app at load (without the text signals, which arrive later).
 *
 * - Tier 1, the essential (at most `TIER1_MAX` items per sector): the best-ranked
 *   breezes, convergences, documented hazards, main take-offs and soaring sites, sourced
 *   (not low confidence, not conditional), one category never taking the whole budget,
 *   and never two points closer than `TIER1_RADIUS_M`.
 * - Tier 3, the detail: thermal hotspots known only from GPS tracks, low-confidence
 *   points no guided visit cites, and a point closer than `TIER3_RADIUS_M` to a
 *   better-ranked one of the same category (they would sit on top of each other).
 * - Tier 2: everything else (other breezes and hazards, take-offs, thermals, landings…).
 *
 * Deterministic: the order depends only on the data (ties broken by id).
 */
import type { AtlasFeature, AtlasFeatureProps, AtlasTourStep, FeatureCategory } from './atlas';

export type Tier = 1 | 2 | 3;

export interface ImportanceSignals {
  /** Guided visits by sector: a step citing an item makes it part of the sector's story. */
  tours?: Record<string, AtlasTourStep[]>;
  /** Club and federation figures, with the items drawn from them. */
  figures?: { features: string[] }[];
  /** Sector summaries by sector id: an item named there is one the summary relies on. */
  summaries?: Record<string, string>;
}

/** Essential items per sector. */
export const TIER1_MAX = 6;
/** Essential items per category and sector, so the essentials stay varied. */
export const TIER1_CAPS: Partial<Record<FeatureCategory, number>> = { breezes: 2, convergences: 1, hazards: 2, takeoffs: 2, soaring: 1 };
/** Two essential points are never closer than this (m): the second one waits for a closer zoom. */
export const TIER1_RADIUS_M = 3000;
/** A point this close (m) to a better-ranked one of its category is detail. */
export const TIER3_RADIUS_M = 500;

/** Weight of each category: the phenomena that structure a day first. */
export const CATEGORY_WEIGHT: Record<FeatureCategory, number> = { breezes: 50, convergences: 46, hazards: 42, takeoffs: 36, soaring: 34, routes: 28, thermals: 24, landings: 18 };

/** Categories in order of importance (side panel groups, legend). */
export const CATEGORY_ORDER = (Object.keys(CATEGORY_WEIGHT) as FeatureCategory[]).sort((a, b) => CATEGORY_WEIGHT[b] - CATEGORY_WEIGHT[a]);

const BREEZE_KIND: Record<string, number> = { valley: 4, regional: 4, 'plain-to-mountain': 4, lake: 3, 'pass-transfer': 1, downvalley: 0, katabatic: -2, slope: -3 };
const HAZARD_KIND: Record<string, number> = { 'lee-rotor': 3, venturi: 3, foehn: 3, 'strong-breeze': 3, downdraft: 2, 'landing-turbulence': 1, overdevelopment: 1, other: 0, airspace: -2 };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Great-circle distance (m), equirectangular (fine at the scale of a sector). */
export function distanceM(a: [number, number], b: [number, number]): number {
  const k = Math.PI / 180;
  const x = (b[0] - a[0]) * k * Math.cos(((a[1] + b[1]) / 2) * k);
  const y = (b[1] - a[1]) * k;
  return 6371000 * Math.hypot(x, y);
}

function lengthKm(coords: [number, number][]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += distanceM(coords[i - 1], coords[i]);
  return m / 1000;
}

export interface ImportanceContext {
  tourCited: Set<string>;
  figureCited: Set<string>;
  /** Normalised summary of each sector. */
  summaries: Map<string, string>;
}

export function importanceContext(s: ImportanceSignals = {}): ImportanceContext {
  return {
    tourCited: new Set(Object.values(s.tours ?? {}).flatMap((steps) => steps.flatMap((x) => x.features))),
    figureCited: new Set((s.figures ?? []).flatMap((f) => f.features)),
    summaries: new Map(Object.entries(s.summaries ?? {}).map(([k, v]) => [k, norm(v)])),
  };
}

/** Name without its parenthesis, as it would be written in a summary. */
function plainName(name: string): string {
  return norm(name.replace(/\s*\([^)]*\)/g, '').split(/\s[–—-]\s|:/)[0]);
}

/** Score of one item: the higher, the more it structures the sector's aerology. */
export function importanceScore(f: AtlasFeature, ctx: ImportanceContext): number {
  const p = f.properties;
  let s = CATEGORY_WEIGHT[p.category] ?? 20;
  s += p.confidence === 'high' ? 12 : p.confidence === 'medium' ? 6 : p.confidence === 'low' ? -10 : 2;
  const n = p.sources.split(',').filter(Boolean).length;
  s += Math.min(16, 5 * Math.log2(1 + n));
  if (ctx.tourCited.has(p.id)) s += 14;
  if (ctx.figureCited.has(p.id)) s += 4;
  const name = plainName(p.name);
  if (name.length >= 8 && ctx.summaries.get(p.massif)?.includes(name)) s += 6;
  if (f.geometry.type === 'LineString') s += Math.min(10, 3 * Math.log2(1 + lengthKm(f.geometry.coordinates)));
  if (p.category === 'breezes') {
    s += BREEZE_KIND[p.kind ?? ''] ?? 0;
    if (p.condition) s -= 6;
  }
  if (p.category === 'hazards') s += HAZARD_KIND[p.kind ?? ''] ?? 0;
  if (p.category === 'thermals') {
    if (p.origin === 'kk7') s += -18 + 8 * (p.kk7P ?? 0.5);
    else if (p.kk7P !== undefined) s += 3;
  }
  if (p.coordQuality === 'approx') s -= 2;
  return Math.round(s * 10) / 10;
}

const point = (f: AtlasFeature): [number, number] | null => (f.geometry.type === 'Point' ? f.geometry.coordinates : null);

/** Is an item detail by itself (before the density rule)? */
function isDetail(p: AtlasFeatureProps, ctx: ImportanceContext): boolean {
  if (p.category === 'thermals' && p.origin === 'kk7') return true;
  // Lines (breezes, convergences, routes) are drawn whatever their tier: a deduced breeze is secondary, not detail.
  if (['breezes', 'convergences', 'routes'].includes(p.category)) return false;
  return p.confidence === 'low' && !ctx.tourCited.has(p.id);
}

function eligibleForEssential(p: AtlasFeatureProps): boolean {
  return TIER1_CAPS[p.category] !== undefined && p.confidence !== 'low' && !p.condition;
}

export interface Ranked {
  rank: number;
  tier: Tier;
}

/**
 * Ranks and tiers every feature, sector by sector. Returns id → { rank, tier }.
 */
export function rankFeatures(features: AtlasFeature[], signals: ImportanceSignals = {}): Map<string, Ranked> {
  const ctx = importanceContext(signals);
  const out = new Map<string, Ranked>();
  const bySector = new Map<string, { f: AtlasFeature; score: number }[]>();
  for (const f of features) {
    const list = bySector.get(f.properties.massif) ?? [];
    list.push({ f, score: importanceScore(f, ctx) });
    bySector.set(f.properties.massif, list);
  }
  for (const list of bySector.values()) {
    list.sort((a, b) => b.score - a.score || (a.f.properties.id < b.f.properties.id ? -1 : a.f.properties.id > b.f.properties.id ? 1 : 0));
    // Essentials: best first, within the caps, spread out.
    const essential: AtlasFeature[] = [];
    const perCat = new Map<FeatureCategory, number>();
    for (const { f } of list) {
      if (essential.length >= TIER1_MAX) break;
      const p = f.properties;
      if (!eligibleForEssential(p)) continue;
      if ((perCat.get(p.category) ?? 0) >= TIER1_CAPS[p.category]!) continue;
      const at = point(f);
      if (at && essential.some((e) => point(e) && distanceM(point(e)!, at) < TIER1_RADIUS_M)) continue;
      essential.push(f);
      perCat.set(p.category, (perCat.get(p.category) ?? 0) + 1);
    }
    const tier1 = new Set(essential);
    // Density: among the points of a category, a point too close to a better-ranked one is detail.
    const kept = new Map<FeatureCategory, [number, number][]>();
    for (const { f, score } of list) {
      const p = f.properties;
      let tier: Tier = tier1.has(f) ? 1 : isDetail(p, ctx) ? 3 : 2;
      const at = point(f);
      if (at && tier === 2 && (kept.get(p.category) ?? []).some((q) => distanceM(q, at) < TIER3_RADIUS_M)) tier = 3;
      if (at && tier <= 2) kept.set(p.category, [...(kept.get(p.category) ?? []), at]);
      out.set(p.id, { rank: score, tier });
    }
  }
  return out;
}

/** Stamps `rank` and `tier` on the features of an atlas, in place. */
export function stampImportance(features: Record<FeatureCategory, AtlasFeature[]>, signals: ImportanceSignals = {}): void {
  const all = Object.values(features).flat();
  const ranked = rankFeatures(all, signals);
  for (const f of all) {
    const r = ranked.get(f.properties.id);
    if (r) {
      f.properties.rank = r.rank;
      f.properties.tier = r.tier;
    }
  }
}

/** For an atlas compiled before the ranking: ranks it at load (no text signals), once. */
export function ensureImportance(atlas: { features: Record<FeatureCategory, AtlasFeature[]>; tours?: Record<string, AtlasTourStep[]> }): void {
  const all = Object.values(atlas.features).flat();
  if (all.every((f) => f.properties.tier !== undefined)) return;
  stampImportance(atlas.features, { tours: atlas.tours });
}
