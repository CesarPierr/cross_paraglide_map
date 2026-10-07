/**
 * Compiles the per-sector research JSON files (research_notes/<title>/data/*.json)
 * into a single atlas consumed by the web app (public/data/atlas.json).
 *
 * - merges and namespaces sources, dedupes them by URL;
 * - snaps valley breezes onto the valley floor (least-cost path on the DEM);
 * - parses the free-text hours into an active window;
 * - checks declared altitudes of spots against the DEM;
 * - writes a QA report (docs/DATA_QA.md).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { CuratedBreezeInput } from '../src/model/curated';
import type { Atlas, AtlasFeature, AtlasFeatureProps, AtlasMassif, AtlasSource, FeatureCategory, ModelRule } from '../src/data/atlas-types';
import { analyseTerrain, type Terrain } from '../src/model/terrain';
import { loadDem } from '../src/model/test-utils';

const ROOT = process.cwd();
const RESEARCH = join(ROOT, 'research_notes', 'Brises des Alpes françaises', 'data');

// ---------- Raw research types (lenient: researchers sometimes add fields) ----------
interface RawPoint {
  name?: string;
  lon?: number | null;
  lat?: number | null;
  coord_quality?: string;
}
interface RawItem extends RawPoint {
  id?: string;
  kind?: string;
  description?: string;
  conditions?: string;
  trigger?: string;
  best_hours?: string;
  alt_m?: number | null;
  orientations?: string[];
  wind_dirs?: string[];
  radius_km?: number;
  sources?: string[];
  confidence?: string;
}
interface RawBreeze {
  id: string;
  name: string;
  kind: string;
  waypoints: RawPoint[];
  hours?: string;
  speed_kmh?: { typical?: number | null; max?: number | null } | null;
  season?: string;
  layer_depth_m?: string | number | null;
  description?: string;
  confidence?: string;
  sources?: string[];
}
interface RawConvergence {
  id: string;
  name: string;
  geometry?: { type: string; coordinates: unknown } | null;
  when?: string;
  mechanism?: string;
  usage?: string;
  confidence?: string;
  sources?: string[];
}
interface RawRoute {
  id: string;
  name: string;
  waypoints: RawPoint[];
  distance_km?: number | null;
  description?: string;
  sources?: string[];
}
interface RawMassif {
  id: string;
  name: string;
  parent_massif?: string;
  summary?: string;
  bbox?: number[];
  center?: number[];
  breezes?: RawBreeze[];
  convergences?: RawConvergence[];
  hazards?: RawItem[];
  thermal_spots?: RawItem[];
  soaring_spots?: RawItem[];
  takeoffs?: RawItem[];
  landings?: RawItem[];
  synoptic_effects?: { wind: string; effect: string; sources?: string[] }[];
  xc_routes?: RawRoute[];
  tips?: string[];
}
interface RawFile {
  topic: string;
  massifs: RawMassif[];
  sources: { id: string; title?: string; url?: string; publisher?: string; type?: string; notes?: string }[];
  model_rules?: { id: string; topic: string; rule: string; numbers?: unknown; sources?: string[] }[];
}

const REGION_LABELS: Record<string, string> = {
  chablais_giffre_arve: 'Haute-Savoie nord',
  annecy_bornes_aravis: 'Annecy, Bornes, Aravis',
  montblanc_beaufortain_tarentaise: 'Mont-Blanc, Beaufortain, Tarentaise',
  bauges_chartreuse_gresivaudan: 'Bauges, Chartreuse, Grésivaudan, Belledonne',
  vercors_trieves_oisans: 'Grenoble, Vercors, Trièves, Oisans',
  maurienne_brianconnais_ecrins: 'Maurienne, Briançonnais, Écrins',
  hautes_alpes_sud: 'Hautes-Alpes sud, Drôme, Ubaye',
  provence_maritimes: 'Alpes de Haute-Provence, Alpes-Maritimes',
  synoptic_convergences_xc: 'Échelle des Alpes',
};
const REGION_ORDER = Object.keys(REGION_LABELS);

const qa: string[] = [];

// ---------- Helpers ----------
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const validPoint = <T extends RawPoint>(p: T | undefined): p is T & { lon: number; lat: number } =>
  !!p && isNum(p.lon) && isNum(p.lat) && p.lon > 3 && p.lon < 9 && p.lat > 43 && p.lat < 47;

function confidence(c: string | undefined): 'high' | 'medium' | 'low' {
  return c === 'high' || c === 'medium' ? c : 'low';
}

/** Parse the free-text hours of a breeze into a legal-time window. */
export function parseHours(text: string | undefined, kind: string): [number, number] | null {
  const t = (text ?? '').toLowerCase().replace(/\s+/g, ' ');
  const hm = (h: string, m?: string) => Number(h) + (m ? Number(m) / 60 : 0);
  const range = t.match(/(\d{1,2})\s*h\s*(\d{2})?\s*(?:-|–|—|à|->|→)\s*(\d{1,2})\s*h\s*(\d{2})?/);
  if (range) {
    const a = hm(range[1], range[2]);
    const b = hm(range[3], range[4]);
    if (a >= 0 && a < 24 && b >= 0 && b <= 24) return [a, b];
  }
  const from = t.match(/(?:dès|à partir de|levée|depuis)\s*≈?\s*(\d{1,2})\s*h\s*(\d{2})?/);
  if (from) return [hm(from[1], from[2]), 19];
  if (kind === 'downvalley' || kind === 'katabatic' || /nuit|crépuscule/.test(t)) {
    if (/fin de nuit/.test(t)) return [4, 9.5];
    return [20.5, 9.5];
  }
  if (/fin d.après-midi|fin de journée|soir/.test(t) && !/journée thermique/.test(t)) return [16, 20.5];
  if (/fin de matinée/.test(t)) return [11, 18.5];
  if (/matin/.test(t) && !/après-midi/.test(t)) return [7.5, 11.5];
  if (/après-midi/.test(t)) return [12.5, 18.5];
  return null;
}

const DEFAULT_SPEED: Record<string, number> = {
  valley: 15,
  downvalley: 8,
  slope: 8,
  'plain-to-mountain': 10,
  lake: 12,
  'pass-transfer': 15,
  regional: 10,
  katabatic: 6,
};
const RADIUS: Record<string, number> = {
  valley: 1700,
  downvalley: 1500,
  slope: 900,
  'plain-to-mountain': 5000,
  lake: 2200,
  'pass-transfer': 1400,
  regional: 6000,
  katabatic: 900,
};
const SNAP_KINDS = new Set(['valley', 'downvalley', 'pass-transfer', 'katabatic']);

// ---------- Valley snapping: Dijkstra within a corridor, cost favours the valley floor ----------
class Heap {
  k: number[] = [];
  v: number[] = [];
  push(key: number, val: number) {
    const { k, v } = this;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const { k, v } = this;
    const top: [number, number] = [k[0], v[0]];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= k.length) break;
        if (c + 1 < k.length && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return top;
  }
  get size() {
    return this.k.length;
  }
}

function snapToFloor(t: Terrain, lon: number, lat: number, radiusCells: number): [number, number] {
  const g = t.grid;
  const [x, y] = g.toGrid(lon, lat);
  const ci = Math.floor(x);
  const cj = Math.floor(y);
  let best = -1;
  let bestScore = Infinity;
  for (let dj = -radiusCells; dj <= radiusCells; dj++) {
    for (let di = -radiusCells; di <= radiusCells; di++) {
      const i = ci + di;
      const j = cj + dj;
      if (i < 0 || j < 0 || i >= g.width || j >= g.height) continue;
      const k = j * g.width + i;
      const score = t.z[k] - t.floor[k] + Math.hypot(di, dj) * 4;
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
  }
  return [best % g.width, Math.floor(best / g.width)];
}

function routeAlongFloor(t: Terrain, a: [number, number], b: [number, number]): [number, number][] {
  const g = t.grid;
  const w = g.width;
  const margin = 18;
  const i0 = Math.max(0, Math.min(a[0], b[0]) - margin);
  const i1 = Math.min(w - 1, Math.max(a[0], b[0]) + margin);
  const j0 = Math.max(0, Math.min(a[1], b[1]) - margin);
  const j1 = Math.min(g.height - 1, Math.max(a[1], b[1]) + margin);
  const bw = i1 - i0 + 1;
  const bh = j1 - j0 + 1;
  const dist = new Float64Array(bw * bh).fill(Infinity);
  const prev = new Int32Array(bw * bh).fill(-1);
  const li = (i: number, j: number) => (j - j0) * bw + (i - i0);
  const start = li(a[0], a[1]);
  const goal = li(b[0], b[1]);
  dist[start] = 0;
  const heap = new Heap();
  heap.push(0, start);
  const DX = [1, 1, 0, -1, -1, -1, 0, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];
  while (heap.size) {
    const [d, c] = heap.pop();
    if (c === goal) break;
    if (d > dist[c]) continue;
    const ci = (c % bw) + i0;
    const cj = Math.floor(c / bw) + j0;
    for (let n = 0; n < 8; n++) {
      const ni = ci + DX[n];
      const nj = cj + DY[n];
      if (ni < i0 || nj < j0 || ni > i1 || nj > j1) continue;
      const k = nj * w + ni;
      const rel = Math.max(0, t.z[k] - t.floor[k]);
      const step = (n % 2 ? Math.SQRT2 : 1) * (1 + (rel / 60) ** 2) * (t.water[k] === 1 ? 0.8 : 1);
      const nd = d + step;
      const l = li(ni, nj);
      if (nd < dist[l]) {
        dist[l] = nd;
        prev[l] = c;
        heap.push(nd, l);
      }
    }
  }
  const path: [number, number][] = [];
  let c = goal;
  if (prev[c] < 0 && c !== start) return [a, b];
  while (c >= 0) {
    path.push([(c % bw) + i0, Math.floor(c / bw) + j0]);
    if (c === start) break;
    c = prev[c];
  }
  return path.reverse();
}

function chaikin(pts: [number, number][], iterations: number): [number, number][] {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    if (p.length < 3) return p;
    const out: [number, number][] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [x0, y0] = p[i];
      const [x1, y1] = p[i + 1];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [ax, ay] = pts[s];
    const [bx, by] = pts[e];
    const L = Math.hypot(bx - ax, by - ay) || 1e-9;
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function densify(coords: [number, number][], stepDeg = 0.01): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / stepDeg));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  out.push(coords[coords.length - 1]);
  return out;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

function breezePath(t: Terrain, kind: string, wps: (RawPoint & { lon: number; lat: number })[]): [number, number][] {
  const g = t.grid;
  if (!SNAP_KINDS.has(kind)) return densify(wps.map((p) => [p.lon, p.lat] as [number, number])).map(([x, y]) => [round5(x), round5(y)]);
  const cells = wps.map((p) => snapToFloor(t, p.lon, p.lat, 5));
  let path: [number, number][] = [];
  for (let i = 0; i < cells.length - 1; i++) {
    const seg = routeAlongFloor(t, cells[i], cells[i + 1]);
    path = path.concat(i === 0 ? seg : seg.slice(1));
  }
  const smooth = chaikin(simplify(path, 0.8), 3);
  return smooth.map(([i, j]) => [round5(g.colLon(i + 0.5)), round5(g.rowLat(j + 0.5))]);
}

function demAt(t: Terrain, lon: number, lat: number): number | null {
  const g = t.grid;
  if (!g.contains(lon, lat)) return null;
  const [x, y] = g.toGrid(lon, lat);
  return t.z[Math.floor(y) * g.width + Math.floor(x)];
}

/** Nearest cell (within maxM) whose elevation matches `alt`, with a mild distance penalty. */
function relocateByAltitude(t: Terrain, lon: number, lat: number, alt: number, maxM: number) {
  const g = t.grid;
  const [x, y] = g.toGrid(lon, lat);
  const cell = g.cellM[Math.floor(y)];
  const r = Math.ceil(maxM / cell);
  let best: { lon: number; lat: number; delta: number; distM: number; score: number } | null = null;
  for (let dj = -r; dj <= r; dj++) {
    for (let di = -r; di <= r; di++) {
      const d = Math.hypot(di, dj) * cell;
      if (d > maxM) continue;
      const i = Math.floor(x) + di;
      const j = Math.floor(y) + dj;
      if (i < 0 || j < 0 || i >= g.width || j >= g.height) continue;
      const delta = t.z[j * g.width + i] - alt;
      const score = Math.abs(delta) + d * 0.08;
      if (!best || score < best.score) best = { lon: g.colLon(i + 0.5), lat: g.rowLat(j + 0.5), delta, distM: Math.round(d), score };
    }
  }
  return best;
}

// ---------- Main ----------
function main() {
  const { grid, elevation } = loadDem(ROOT);
  const terrain = analyseTerrain(grid, elevation);

  const files = readdirSync(RESEARCH)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => REGION_ORDER.indexOf(a.replace('.json', '')) - REGION_ORDER.indexOf(b.replace('.json', '')));

  const sources: Record<string, AtlasSource> = {};
  const urlToId = new Map<string, string>();
  const massifs: AtlasMassif[] = [];
  const features: Record<FeatureCategory, AtlasFeature[]> = {
    breezes: [],
    convergences: [],
    hazards: [],
    thermals: [],
    soaring: [],
    takeoffs: [],
    landings: [],
    routes: [],
  };
  const curated: CuratedBreezeInput[] = [];
  const rules: ModelRule[] = [];
  const usedIds = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  };

  for (const file of files) {
    const slug = file.replace('.json', '');
    const region = REGION_LABELS[slug] ?? slug;
    const raw = JSON.parse(readFileSync(join(RESEARCH, file), 'utf8')) as RawFile;
    // Sources: namespace ids, dedupe by URL.
    const local = new Map<string, string>();
    for (const s of raw.sources ?? []) {
      const url = s.url?.trim();
      const existing = url ? urlToId.get(url) : undefined;
      if (existing) {
        local.set(s.id, existing);
        continue;
      }
      const gid = `${slug}:${s.id}`;
      sources[gid] = { id: gid, title: s.title ?? url ?? s.id, url, publisher: s.publisher, type: s.type, notes: s.notes };
      if (url) urlToId.set(url, gid);
      local.set(s.id, gid);
    }
    const mapSources = (ids: string[] | undefined) =>
      (ids ?? []).map((i) => {
        const g = local.get(i);
        if (!g) qa.push(`${slug}: source inconnue ${i}`);
        return g ?? i;
      });
    // Inline citations "[S3]" in free text → global ids are kept readable as-is; the panel resolves them per region.
    for (const r of raw.model_rules ?? []) rules.push({ id: r.id, topic: r.topic, rule: r.rule, numbers: r.numbers, sources: mapSources(r.sources) });

    for (const m of raw.massifs) {
      const mid = uniqueId(m.id);
      const items: AtlasMassif['items'] = { breezes: [], convergences: [], hazards: [], thermals: [], soaring: [], takeoffs: [], landings: [], routes: [] };
      const allCoords: [number, number][] = [];
      const massifSources = new Set<string>();
      const push = (cat: FeatureCategory, f: AtlasFeature) => {
        features[cat].push(f);
        items[cat].push(f.properties.id);
        f.properties.sources.split(',').filter(Boolean).forEach((s) => massifSources.add(s));
        if (f.geometry.type === 'Point') allCoords.push(f.geometry.coordinates);
        else allCoords.push(...f.geometry.coordinates);
      };

      for (const b of m.breezes ?? []) {
        const wps = (b.waypoints ?? []).filter(validPoint);
        if (wps.length < 2) {
          qa.push(`${mid}: brise « ${b.name} » ignorée (moins de 2 points valides)`);
          continue;
        }
        const id = uniqueId(`${mid}/${b.id}`);
        const coords = breezePath(terrain, b.kind, wps);
        const window = parseHours(b.hours, b.kind);
        const typical = b.speed_kmh?.typical ?? null;
        const speed = typical ?? (b.speed_kmh?.max ? b.speed_kmh.max * 0.6 : DEFAULT_SPEED[b.kind] ?? 12);
        const conf = confidence(b.confidence);
        const quality = wps.every((p) => p.coord_quality === 'source') ? 'source' : wps.some((p) => p.coord_quality === 'source') ? 'mixed' : 'approx';
        const props: AtlasFeatureProps = {
          id,
          category: 'breezes',
          massif: mid,
          name: b.name,
          kind: b.kind,
          description: b.description ?? '',
          confidence: conf,
          sources: mapSources(b.sources).join(','),
          coordQuality: quality,
          windowStart: window?.[0],
          windowEnd: window?.[1],
          speedKmh: Math.round(speed),
          details: {
            ...(b.hours ? { Horaires: b.hours } : {}),
            ...(b.speed_kmh && (b.speed_kmh.typical || b.speed_kmh.max)
              ? { Force: `${b.speed_kmh.typical ?? '?'} km/h typique${b.speed_kmh.max ? `, ${b.speed_kmh.max} km/h max` : ''}` }
              : { Force: `non documentée (valeur par défaut du modèle : ${Math.round(speed)} km/h)` }),
            ...(b.season ? { Saison: b.season } : {}),
            ...(b.layer_depth_m ? { Épaisseur: String(b.layer_depth_m) } : {}),
            Trajet: wps.map((p) => p.name).filter(Boolean).join(' → '),
          },
        };
        push('breezes', { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: props });
        curated.push({
          id,
          name: b.name,
          kind: b.kind,
          speedMs: speed / 3.6,
          window,
          coords,
          radiusM: RADIUS[b.kind] ?? 1500,
          strength: conf === 'high' ? 1 : conf === 'medium' ? 0.85 : 0.55,
        });
      }

      for (const c of m.convergences ?? []) {
        const g = c.geometry;
        let geometry: AtlasFeature['geometry'] | null = null;
        if (g?.type === 'LineString' && Array.isArray(g.coordinates)) {
          const cs = (g.coordinates as number[][]).filter((p) => validPoint({ lon: p[0], lat: p[1] })).map((p) => [p[0], p[1]] as [number, number]);
          if (cs.length >= 2) geometry = { type: 'LineString', coordinates: cs };
          else if (cs.length === 1) geometry = { type: 'Point', coordinates: cs[0] };
        } else if (g?.type === 'Point' && Array.isArray(g.coordinates)) {
          const p = g.coordinates as number[];
          if (validPoint({ lon: p[0], lat: p[1] })) geometry = { type: 'Point', coordinates: [p[0], p[1]] };
        }
        if (!geometry) {
          qa.push(`${mid}: convergence « ${c.name} » sans géométrie exploitable`);
          continue;
        }
        push('convergences', {
          type: 'Feature',
          geometry,
          properties: {
            id: uniqueId(`${mid}/${c.id}`),
            category: 'convergences',
            massif: mid,
            name: c.name,
            description: [c.mechanism, c.usage].filter(Boolean).join('\n\n'),
            confidence: confidence(c.confidence),
            sources: mapSources(c.sources).join(','),
            details: { ...(c.when ? { Quand: c.when } : {}) },
          },
        });
      }

      const pointCat = (cat: FeatureCategory, list: RawItem[] | undefined, extra: (it: RawItem) => Record<string, string>) => {
        for (const it of list ?? []) {
          if (!validPoint(it)) {
            qa.push(`${mid}: ${cat} « ${it.name} » sans coordonnées valides`);
            continue;
          }
          let lon = it.lon;
          let lat = it.lat;
          let dem = demAt(terrain, lon, lat);
          let altDelta = dem !== null && isNum(it.alt_m) ? Math.round(dem - it.alt_m) : undefined;
          let moved = false;
          if (altDelta !== undefined && Math.abs(altDelta) > 250 && it.coord_quality !== 'source' && isNum(it.alt_m)) {
            // Approximate position clearly at the wrong altitude: move it to the nearest
            // terrain at the declared altitude (the coarse DEM flattens summits by ~100-200 m).
            const fixed = relocateByAltitude(terrain, lon, lat, it.alt_m, 2500);
            if (fixed && Math.abs(fixed.delta) < Math.abs(altDelta) * 0.5) {
              qa.push(`${mid}: ${cat} « ${it.name} » recalé de ${fixed.distM} m (altitude déclarée ${it.alt_m} m, MNT ${Math.round(dem!)} m → ${Math.round(it.alt_m + fixed.delta)} m)`);
              lon = fixed.lon;
              lat = fixed.lat;
              dem = it.alt_m + fixed.delta;
              altDelta = Math.round(fixed.delta);
              moved = true;
            }
          }
          if (!moved && altDelta !== undefined && Math.abs(altDelta) > 300)
            qa.push(`${mid}: ${cat} « ${it.name} » altitude déclarée ${it.alt_m} m, MNT ${Math.round(dem!)} m (écart ${altDelta} m, coord ${it.coord_quality ?? '?'})`);
          const details = extra(it);
          if (moved) details['Position'] = 'approximative, recalée sur l’altitude déclarée';
          else if (it.coord_quality !== 'source') details['Position'] = 'approximative';
          push(cat, {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [round5(lon), round5(lat)] },
            properties: {
              id: uniqueId(`${mid}/${it.id ?? it.name}`),
              category: cat,
              massif: mid,
              name: it.name ?? '',
              kind: it.kind,
              description: it.description ?? '',
              confidence: it.confidence ? confidence(it.confidence) : undefined,
              sources: mapSources(it.sources).join(','),
              coordQuality: it.coord_quality === 'source' ? 'source' : 'approx',
              altDelta,
              details,
            },
          });
        }
      };
      pointCat('hazards', m.hazards, (it) => ({ ...(it.conditions ? { Conditions: it.conditions } : {}), ...(it.radius_km ? { Rayon: `${it.radius_km} km` } : {}) }));
      pointCat('thermals', m.thermal_spots, (it) => ({
        ...(it.alt_m ? { Altitude: `${it.alt_m} m` } : {}),
        ...(it.best_hours ? { Heures: it.best_hours } : {}),
        ...(it.trigger ? { Déclencheur: it.trigger } : {}),
      }));
      pointCat('soaring', m.soaring_spots, (it) => ({ ...(it.wind_dirs?.length ? { Vents: it.wind_dirs.join(', ') } : {}) }));
      pointCat('takeoffs', m.takeoffs, (it) => ({
        ...(it.alt_m ? { Altitude: `${it.alt_m} m` } : {}),
        ...(it.orientations?.length ? { Orientation: it.orientations.join(', ') } : {}),
      }));
      pointCat('landings', m.landings, (it) => ({ ...(it.alt_m ? { Altitude: `${it.alt_m} m` } : {}) }));

      for (const r of m.xc_routes ?? []) {
        const wps = (r.waypoints ?? []).filter(validPoint);
        if (wps.length < 2) {
          qa.push(`${mid}: itinéraire « ${r.name} » ignoré (moins de 2 points)`);
          continue;
        }
        push('routes', {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: wps.map((p) => [round5(p.lon), round5(p.lat)]) },
          properties: {
            id: uniqueId(`${mid}/${r.id}`),
            category: 'routes',
            massif: mid,
            name: r.name,
            description: r.description ?? '',
            sources: mapSources(r.sources).join(','),
            details: {
              ...(r.distance_km ? { Distance: `${r.distance_km} km` } : {}),
              Points: wps.map((p) => p.name).filter(Boolean).join(' → '),
            },
          },
        });
      }

      // Geometry of the massif: declared bbox if sane, else the extent of its features.
      let bbox = (m.bbox && m.bbox.length === 4 && m.bbox.every(isNum) ? m.bbox : null) as [number, number, number, number] | null;
      if (bbox && (bbox[0] >= bbox[2] || bbox[1] >= bbox[3] || !validPoint({ lon: bbox[0], lat: bbox[1] }))) bbox = null;
      if (!bbox && allCoords.length) {
        const xs = allCoords.map((c) => c[0]);
        const ys = allCoords.map((c) => c[1]);
        bbox = [Math.min(...xs) - 0.03, Math.min(...ys) - 0.03, Math.max(...xs) + 0.03, Math.max(...ys) + 0.03];
      }
      if (!bbox) bbox = [5, 44, 7.5, 46.3];
      const center = (m.center && m.center.length === 2 && validPoint({ lon: m.center[0], lat: m.center[1] })
        ? m.center
        : [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]) as [number, number];
      const synoptic = (m.synoptic_effects ?? []).map((s) => ({ wind: s.wind, effect: s.effect, sources: mapSources(s.sources) }));
      synoptic.forEach((s) => s.sources.forEach((x) => massifSources.add(x)));
      massifs.push({
        id: mid,
        name: m.name,
        region,
        parent: m.parent_massif,
        summary: m.summary ?? '',
        bbox: bbox.map((v) => Math.round(v * 1e4) / 1e4) as [number, number, number, number],
        center: [Math.round(center[0] * 1e4) / 1e4, Math.round(center[1] * 1e4) / 1e4],
        // Inline [S#] references are region-local: rewrite them to global ids.
        tips: (m.tips ?? []).map((tip) => tip.replace(/\[(S\d+(?:\s*,\s*S\d+)*)\]/g, (_, g: string) => `[${g.split(/\s*,\s*/).map((s) => local.get(s) ?? s).join(', ')}]`)),
        synoptic,
        items,
        sources: [...massifSources].filter((s) => sources[s]),
      });
    }
  }

  // Number the features (MapLibre feature-state needs numeric ids).
  let fid = 1;
  for (const cat of Object.keys(features) as FeatureCategory[]) for (const f of features[cat]) f.id = fid++;

  const atlas: Atlas = {
    generatedAt: new Date().toISOString(),
    massifs,
    regions: REGION_ORDER.map((k) => REGION_LABELS[k]).filter((r) => massifs.some((m) => m.region === r)),
    sources,
    features,
    curated,
    rules,
    stats: {
      massifs: massifs.length,
      sources: Object.keys(sources).length,
      ...Object.fromEntries(Object.entries(features).map(([k, v]) => [k, v.length])),
    },
  };
  writeFileSync(join(ROOT, 'public', 'data', 'atlas.json'), JSON.stringify(atlas));
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(
    join(ROOT, 'docs', 'DATA_QA.md'),
    `# Contrôle qualité des données de recherche\n\nGénéré par \`npm run data:build\` le ${atlas.generatedAt.slice(0, 10)}.\n\n` +
      `## Volumes\n\n${Object.entries(atlas.stats)
        .map(([k, v]) => `- ${k} : ${v}`)
        .join('\n')}\n\n## Points à vérifier (${qa.length})\n\n${qa.map((q) => `- ${q}`).join('\n')}\n`,
  );
  console.log(atlas.stats, `${qa.length} QA warnings`);
}

main();
