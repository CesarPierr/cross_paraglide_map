/**
 * Thermal hotspots measured from GPS tracks (thermal.kk7.ch, CC BY-NC-SA 4.0),
 * crossed with the documented thermals:
 *
 * - a documented thermal with a hotspot nearby gets its measured probability and
 *   time-of-day profile; when its position was only approximate, it moves onto
 *   the hotspot (measured position);
 * - a strong hotspot that no text describes becomes a thermal of its own
 *   (`origin: 'kk7'`), named after the nearest take-off or OSM place name;
 * - the report lists, sector by sector, the strong hotspots still undescribed
 *   and the documented thermals far from any hotspot (positions to verify).
 *
 * Raw files: research_notes/Seconde passe 2026/sources/kk7/ (hotspots_<season>_<time>.json,
 * osm_toponymes.json), downloaded once; the build stays offline.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AtlasFeature, AtlasMassif, AtlasSource, FeatureCategory } from '@brises/shared';

type LngLat = [number, number];
interface Hotspot {
  lon: number;
  lat: number;
  p: number;
}
interface Toponym {
  lon: number;
  lat: number;
  name: string;
  kind?: string;
}

/** Hotspots below this probability are ignored altogether. */
const BASE_MIN_P = 0.7;
/** A documented thermal and a hotspot closer than this are the same climb. */
const MATCH_M = 600;
/** Undescribed hotspots become thermals from this probability… */
const NEW_MIN_P = 0.8;
/** …when no documented thermal lies within this distance. */
const CLEAR_M = 1000;
/** Time-of-day and season variants of a hotspot are matched within this distance. */
const PROFILE_M = 400;
/** Hotspots farther than this from every sector are outside the atlas. */
const OUTSIDE_M = 3000;

export const KK7_SOURCE = 'kk7:hotspots';

const metres = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110570);

/** Grid index for nearest-neighbour queries over thousands of points. */
class PointIndex<T extends { lon: number; lat: number }> {
  private cells = new Map<string, T[]>();
  constructor(
    items: T[],
    private step = 0.02,
  ) {
    for (const it of items) {
      const k = this.key(it.lon, it.lat);
      const list = this.cells.get(k);
      if (list) list.push(it);
      else this.cells.set(k, [it]);
    }
  }
  private key(lon: number, lat: number) {
    return `${Math.floor(lon / this.step)}:${Math.floor(lat / this.step)}`;
  }
  /** Items within `maxM` metres, nearest first. */
  near(p: LngLat, maxM: number): { item: T; d: number }[] {
    const r = Math.ceil(maxM / (this.step * 75000)) + 1;
    const cx = Math.floor(p[0] / this.step);
    const cy = Math.floor(p[1] / this.step);
    const out: { item: T; d: number }[] = [];
    for (let i = cx - r; i <= cx + r; i++)
      for (let j = cy - r; j <= cy + r; j++)
        for (const item of this.cells.get(`${i}:${j}`) ?? []) {
          const d = metres(p, [item.lon, item.lat]);
          if (d <= maxM) out.push({ item, d });
        }
    return out.sort((a, b) => a.d - b.d);
  }
}

function inside(p: LngLat, ring: LngLat[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const pct = (p: number) => `${Math.round(p * 100)} %`;
const TIMES = [
  ['morning', 'le matin', 'du lever du soleil à environ 6 h après'],
  ['midday', 'en milieu de journée', '6 à 9 h après le lever du soleil'],
  ['evening', 'en fin de journée', 'plus de 9 h après le lever du soleil'],
] as const;
const SEASONS = [
  ['apr', 'printemps'],
  ['jul', 'été'],
  ['oct', 'automne'],
  ['jan', 'hiver'],
] as const;

interface Profile {
  morning: number;
  midday: number;
  evening: number;
  seasons: Record<string, number>;
}

/** When the hotspot works, in chronological order; "toute la journée" when the three periods are strong. */
function whenText(pr: Profile): string {
  const strong = TIMES.filter(([k]) => pr[k] >= BASE_MIN_P);
  if (!strong.length) return 'sans moment de la journée marqué';
  const best = [...strong].sort((a, b) => pr[b[0]] - pr[a[0]])[0];
  if (strong.length === 3) return `toute la journée, le plus souvent ${best[1]} (${best[2]})`;
  return strong.map(([, t, hint]) => `${t} (${hint})`).join(' et ');
}

function seasonText(pr: Profile): string {
  const s = SEASONS.filter(([k]) => (pr.seasons[k] ?? 0) >= BASE_MIN_P).map(([, t]) => t);
  return s.length === 4 ? 'toute l’année' : s.length ? s.join(', ') : 'saison non marquée';
}

export interface Kk7Context {
  dir: string;
  massifs: AtlasMassif[];
  features: Record<FeatureCategory, AtlasFeature[]>;
  sources: Record<string, AtlasSource>;
  uniqueId: (base: string) => string;
  altitude: (lon: number, lat: number) => number | undefined;
}

export interface Kk7Report {
  hotspots: number;
  matched: number;
  moved: { id: string; name: string; d: number }[];
  added: number;
  outside: number;
  /** Strong hotspots (≥ 0.9) still without any text, by sector. */
  gaps: Map<string, { name: string; p: number; lon: number; lat: number; when: string }[]>;
  /** Documented thermals more than 2 km from every hotspot. */
  far: { id: string; name: string; d: number; coordQuality?: string }[];
}

const read = (dir: string, name: string): Hotspot[] => {
  const f = join(dir, `hotspots_${name}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as { features: Hotspot[] }).features : [];
};

/** Crosses the documented thermals with the kk7 hotspots; returns null when the raw files are absent. */
export function integrateKk7(ctx: Kk7Context): Kk7Report | null {
  const base = read(ctx.dir, 'all_all').filter((h) => h.p >= BASE_MIN_P);
  if (!base.length) return null;
  const variants = Object.fromEntries(
    ['all_04', 'all_07', 'all_10', 'jan_all', 'apr_all', 'jul_all', 'oct_all'].map((v) => [v, new PointIndex(read(ctx.dir, v))]),
  );
  const pAt = (v: string, h: Hotspot) => variants[v].near([h.lon, h.lat], PROFILE_M)[0]?.item.p ?? 0;
  const profile = (h: Hotspot): Profile => ({
    morning: pAt('all_04', h),
    midday: pAt('all_07', h),
    evening: pAt('all_10', h),
    seasons: Object.fromEntries(SEASONS.map(([k]) => [k, pAt(`${k}_all`, h)])),
  });

  ctx.sources[KK7_SOURCE] = {
    id: KK7_SOURCE,
    title: 'thermal.kk7.ch : points chauds de thermiques calculés à partir de traces GPS',
    url: 'https://thermal.kk7.ch',
    publisher: 'kk7 (Michael von Känel)',
    type: 'dataset',
    notes:
      'Probabilité de trouver un thermique, calculée sur les traces de vol publiées (XContest, etc.), par moment de la journée et par saison. Licence CC BY-NC-SA 4.0, téléchargé le 7 octobre 2026. Dit où ça monte, pas pourquoi.',
  };

  const report: Kk7Report = { hotspots: base.length, matched: 0, moved: [], added: 0, outside: 0, gaps: new Map(), far: [] };
  const hotIndex = new PointIndex(base);
  const used = new Set<Hotspot>();

  // 1. Documented thermals: measured probability, time profile, and a measured position when theirs was approximate.
  for (const f of ctx.features.thermals) {
    if (f.geometry.type !== 'Point') continue;
    const at = f.geometry.coordinates as LngLat;
    const hit = hotIndex.near(at, MATCH_M)[0];
    if (!hit) {
      const nearest = hotIndex.near(at, 2000)[0];
      if (!nearest) report.far.push({ id: f.properties.id, name: f.properties.name, d: 2000, coordQuality: f.properties.coordQuality });
      continue;
    }
    report.matched++;
    used.add(hit.item);
    const pr = profile(hit.item);
    const props = f.properties;
    Object.assign(props, {
      kk7P: hit.item.p,
      kk7DistM: Math.round(hit.d),
      kk7Morning: pr.morning,
      kk7Midday: pr.midday,
      kk7Evening: pr.evening,
    });
    props.sources = [...new Set([...props.sources.split(',').filter(Boolean), KK7_SOURCE])].join(',');
    const details = (props.details ??= {});
    details['Traces GPS (kk7)'] = `point chaud mesuré à ${Math.round(hit.d)} m, probabilité ${pct(hit.item.p)} ; marche ${whenText(pr)} ; ${seasonText(pr)}`;
    if (props.coordQuality !== 'source' && hit.d > 50) {
      f.geometry.coordinates = [hit.item.lon, hit.item.lat];
      props.coordQuality = 'measured';
      details['Position'] = `recalée sur le point chaud mesuré par les traces GPS (${Math.round(hit.d)} m de la position décrite)`;
      report.moved.push({ id: props.id, name: props.name, d: Math.round(hit.d) });
    }
  }

  // 2. Strong hotspots no text describes: thermals of their own, in the sector that contains them.
  const documented = new PointIndex(
    ctx.features.thermals.filter((f) => f.geometry.type === 'Point').map((f) => ({ lon: (f.geometry.coordinates as LngLat)[0], lat: (f.geometry.coordinates as LngLat)[1] })),
  );
  const takeoffs = new PointIndex(
    ctx.features.takeoffs.filter((f) => f.geometry.type === 'Point').map((f) => ({ lon: (f.geometry.coordinates as LngLat)[0], lat: (f.geometry.coordinates as LngLat)[1], name: f.properties.name })),
  );
  const topoFile = join(ctx.dir, 'osm_toponymes.json');
  const toponyms = new PointIndex<Toponym>(existsSync(topoFile) ? (JSON.parse(readFileSync(topoFile, 'utf8')) as { features: Toponym[] }).features : []);
  // Commune containing each hotspot (geo.api.gouv.fr, cached): null means outside France, where the atlas stops.
  const communesFile = join(ctx.dir, 'communes.json');
  const communes = existsSync(communesFile) ? (JSON.parse(readFileSync(communesFile, 'utf8')) as { points: Record<string, string | null> }).points : {};
  const inFrance = (h: Hotspot) => communes[`${h.lon.toFixed(6)},${h.lat.toFixed(6)}`] !== null;
  const sectors = ctx.massifs.filter((m) => m.id !== 'alpes-francaises' && m.outline && m.outline.length >= 3);
  const sectorOf = (p: LngLat) => {
    const m = sectors.find((s) => inside(p, s.outline!));
    if (m) return m;
    let best: { m: AtlasMassif; d: number } | null = null;
    for (const s of sectors) {
      const d = Math.min(...s.outline!.map((c) => metres(p, c)));
      if (!best || d < best.d) best = { m: s, d };
    }
    return best && best.d <= OUTSIDE_M ? best.m : null;
  };
  const RELIEF = /^(peak|saddle|pass|cliff|ridge|arete|cirque|spur|rock|hill|valley)$/;
  const placeName = (p: LngLat): { name: string; near: string } => {
    const t = takeoffs.near(p, 800)[0];
    if (t) return { name: `Point chaud du déco ${t.item.name.replace(/\s*\(.*\)$/, '')}`, near: `à ${Math.round(t.d)} m du décollage ${t.item.name}` };
    const relief = toponyms.near(p, 1500).find((x) => RELIEF.test(x.item.kind ?? ''));
    if (relief) return { name: `Point chaud – ${relief.item.name}`, near: `à ${Math.round(relief.d)} m de ${relief.item.name}` };
    const place = toponyms.near(p, 4000)[0];
    if (place) return { name: `Point chaud vers ${place.item.name}`, near: `à ${(place.d / 1000).toFixed(1).replace('.', ',')} km de ${place.item.name}` };
    return { name: 'Point chaud', near: '' };
  };

  for (const h of base) {
    if (used.has(h) || h.p < NEW_MIN_P) continue;
    const p: LngLat = [h.lon, h.lat];
    if (documented.near(p, CLEAR_M).length) continue;
    const m = inFrance(h) ? sectorOf(p) : null;
    if (!m) {
      report.outside++;
      continue;
    }
    const pr = profile(h);
    const where = placeName(p);
    const alt = ctx.altitude(h.lon, h.lat);
    const when = whenText(pr);
    ctx.features.thermals.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
      properties: {
        id: ctx.uniqueId(`${m.id}/kk7-${h.lat.toFixed(4)}-${h.lon.toFixed(4)}`),
        category: 'thermals',
        massif: m.id,
        name: where.name,
        description:
          `Point chaud mesuré par thermal.kk7.ch à partir des traces GPS${where.near ? `, ${where.near}` : ''} : les vols qui passent ici y trouvent un thermique avec une probabilité de ${pct(h.p)}. ` +
          `Il marche surtout ${when} (${seasonText(pr)}). Aucun texte de club ou de pilote ne le décrit encore : le déclencheur exact reste à documenter.`,
        confidence: h.p >= 0.95 ? 'medium' : 'low',
        sources: KK7_SOURCE,
        coordQuality: 'measured',
        origin: 'kk7',
        kk7P: h.p,
        kk7DistM: 0,
        kk7Morning: pr.morning,
        kk7Midday: pr.midday,
        kk7Evening: pr.evening,
        details: {
          Probabilité: pct(h.p),
          Moment: when,
          Saisons: seasonText(pr),
          ...(alt !== undefined ? { Altitude: `${Math.round(alt)} m (MNT)` } : {}),
          Position: 'mesurée (traces GPS)',
        },
      },
    });
    report.added++;
    if (h.p >= 0.9) {
      const list = report.gaps.get(m.id) ?? [];
      list.push({ name: where.name, p: h.p, lon: h.lon, lat: h.lat, when });
      report.gaps.set(m.id, list);
    }
  }
  return report;
}

/** Markdown report of the crossing (docs/KK7_CROISEMENT.md). */
export function kk7Markdown(r: Kk7Report, massifs: AtlasMassif[], date: string): string {
  const name = (id: string) => massifs.find((m) => m.id === id)?.shortName ?? id;
  const gaps = [...r.gaps.entries()].sort((a, b) => b[1].length - a[1].length);
  return [
    '# Croisement des thermiques documentés avec les traces GPS (thermal.kk7.ch)',
    '',
    `Généré par \`npm run data:build\` le ${date}. ${r.hotspots} points chauds kk7 de probabilité ≥ ${pct(BASE_MIN_P)} dans le périmètre téléchargé.`,
    '',
    `- Thermiques documentés confirmés par un point chaud à moins de ${MATCH_M} m : **${r.matched}**, dont **${r.moved.length}** recalés sur la position mesurée (leur position n’était qu’approximative).`,
    `- Points chauds ≥ ${pct(NEW_MIN_P)} qu’aucun texte ne décrit, ajoutés comme thermiques « mesurés » : **${r.added}** (${r.outside} autres hors des secteurs).`,
    `- Thermiques documentés à plus de 2 km de tout point chaud : **${r.far.length}** (site peu volé, ou position à vérifier).`,
    '',
    '## Points chauds forts (≥ 90 %) sans description, par secteur',
    '',
    'À documenter en priorité : chercher dans les fiches, topos de club et récits ce qui les déclenche et quand.',
    '',
    ...gaps.flatMap(([id, list]) => [
      `### ${name(id)} (${list.length})`,
      '',
      ...list.sort((a, b) => b.p - a.p).map((g) => `- ${g.name} — ${pct(g.p)}, ${g.lat.toFixed(4)} N ${g.lon.toFixed(4)} E — ${g.when}`),
      '',
    ]),
    '## Thermiques documentés loin de tout point chaud',
    '',
    ...r.far.map((f) => `- \`${f.id}\` ${f.name} (position ${f.coordQuality ?? '?'})`),
    '',
    '## Thermiques recalés sur un point chaud',
    '',
    ...r.moved.map((m) => `- \`${m.id}\` ${m.name} : ${m.d} m`),
    '',
  ].join('\n');
}
