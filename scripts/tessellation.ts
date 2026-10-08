/**
 * Sector outlines that tile the French Alps without holes or overlaps: the
 * mountain area (Alpine départements, within reach of the documented items)
 * is cut into blocks, each place going to the sector of its nearest
 * documented item; every sector is one connected block.
 *
 * Done on a grid of ~0.8 km cells: nearest-item labelling, small detached
 * pieces handed to the neighbour that surrounds them, holes of the area
 * filled, then each block's border traced and simplified.
 */
import type { AtlasFeature, AtlasMassif, FeatureCategory } from '@brises/shared';

type LngLat = [number, number];
type Ring = LngLat[];
interface Geo {
  type: string;
  coordinates: unknown;
}

const STEP_LON = 0.01;
const STEP_LAT = 0.007; // square cells at 45° N
/** Mountain area: places within this distance of a documented item. */
const REACH_KM = 13;
const KM_LON = 111.32 * Math.cos((45 * Math.PI) / 180);
const KM_LAT = 110.57;

function insideRing(x: number, y: number, ring: number[][]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Polygons (outer ring + holes) of a GeoJSON Polygon / MultiPolygon. */
function polygonsOf(g: Geo): number[][][][] {
  return g.type === 'Polygon' ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
}

function insideGeo(x: number, y: number, polys: { box: number[]; rings: number[][][] }[]): boolean {
  for (const p of polys) {
    if (x < p.box[0] || x > p.box[2] || y < p.box[1] || y > p.box[3]) continue;
    if (insideRing(x, y, p.rings[0]) && !p.rings.slice(1).some((h) => insideRing(x, y, h))) return true;
  }
  return false;
}

/** Douglas–Peucker on an open polyline (degrees, lon scaled). */
function simplify(pts: LngLat[], tol: number): LngLat[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const k = Math.cos((45 * Math.PI) / 180);
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = [pts[a][0] * k, pts[a][1]];
    const [bx, by] = [pts[b][0] * k, pts[b][1]];
    const len = Math.hypot(bx - ax, by - ay) || 1e-12;
    let best = -1;
    let dmax = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0] * k) * (by - ay)) / len;
      if (d > dmax) {
        dmax = d;
        best = i;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export interface TilingReport {
  cells: number;
  sectors: number;
  reassigned: number;
}

/**
 * Sets `outline` on every sector (all massifs but the whole-Alps overview).
 * `departments`: GeoJSON features of the Alpine départements (the area never leaves France).
 */
export function tileSectors(massifs: AtlasMassif[], features: Record<FeatureCategory, AtlasFeature[]>, departments: { geometry: Geo }[]): TilingReport {
  const sectors = massifs.filter((m) => m.id !== 'alpes-francaises');
  const index = new Map(sectors.map((m, i) => [m.id, i]));
  // Documented items of each sector (not the long cross routes, not the hotspots known only from tracks).
  const items: { x: number; y: number; s: number }[] = [];
  for (const cat of Object.keys(features) as FeatureCategory[]) {
    if (cat === 'routes') continue;
    for (const f of features[cat]) {
      const s = index.get(f.properties.massif);
      if (s === undefined || f.properties.origin === 'kk7') continue;
      const cs = (f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates) as LngLat[];
      for (const [x, y] of cs) items.push({ x, y, s });
    }
  }
  sectors.forEach((m, s) => items.push({ x: m.center[0], y: m.center[1], s }));
  const x0 = Math.min(...items.map((p) => p.x)) - 0.3;
  const x1 = Math.max(...items.map((p) => p.x)) + 0.3;
  const y0 = Math.min(...items.map((p) => p.y)) - 0.25;
  const y1 = Math.max(...items.map((p) => p.y)) + 0.25;
  const W = Math.ceil((x1 - x0) / STEP_LON);
  const H = Math.ceil((y1 - y0) / STEP_LAT);
  const cx = (i: number) => x0 + (i + 0.5) * STEP_LON;
  const cy = (j: number) => y0 + (j + 0.5) * STEP_LAT;

  // Items binned for nearest-item queries.
  const BIN = 0.1;
  const bins = new Map<string, typeof items>();
  for (const p of items) {
    const k = `${Math.floor(p.x / BIN)}:${Math.floor(p.y / BIN)}`;
    const list = bins.get(k);
    if (list) list.push(p);
    else bins.set(k, [p]);
  }
  const nearest = (x: number, y: number): { s: number; d: number } => {
    const bx = Math.floor(x / BIN);
    const by = Math.floor(y / BIN);
    let best = { s: -1, d: Infinity };
    for (let r = 0; r < 12; r++) {
      for (let i = bx - r; i <= bx + r; i++)
        for (let j = by - r; j <= by + r; j++) {
          if (Math.max(Math.abs(i - bx), Math.abs(j - by)) !== r) continue;
          for (const p of bins.get(`${i}:${j}`) ?? []) {
            const d = Math.hypot((p.x - x) * KM_LON, (p.y - y) * KM_LAT);
            if (d < best.d) best = { s: p.s, d };
          }
        }
      // Ring r guarantees everything closer than r bins has been seen.
      if (best.s >= 0 && best.d <= r * BIN * KM_LAT * 0.7) break;
    }
    return best;
  };

  // 1. Mountain area inside the Alpine départements, and the nearest sector of each cell.
  const polys = departments.flatMap((f) =>
    polygonsOf(f.geometry).map((rings) => {
      const xs = rings[0].map((p) => p[0]);
      const ys = rings[0].map((p) => p[1]);
      return { box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], rings };
    }),
  );
  const label = new Int16Array(W * H).fill(-1);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x = cx(i);
      const y = cy(j);
      if (!insideGeo(x, y, polys)) continue;
      const n = nearest(x, y);
      if (n.d <= REACH_KM) label[j * W + i] = n.s;
    }

  // 2. Holes of the area (inner valleys far from any item) are filled: every empty cell not
  // connected to the grid's edge takes its nearest sector.
  const outside = new Uint8Array(W * H);
  const queue: number[] = [];
  for (let i = 0; i < W; i++) for (const j of [0, H - 1]) if (label[j * W + i] < 0) queue.push(j * W + i);
  for (let j = 0; j < H; j++) for (const i of [0, W - 1]) if (label[j * W + i] < 0) queue.push(j * W + i);
  for (const q of queue) outside[q] = 1;
  while (queue.length) {
    const q = queue.pop()!;
    const i = q % W;
    const j = (q / W) | 0;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const n = nj * W + ni;
      if (outside[n] || label[n] >= 0) continue;
      outside[n] = 1;
      queue.push(n);
    }
  }
  for (let q = 0; q < W * H; q++) if (label[q] < 0 && !outside[q]) label[q] = nearest(cx(q % W), cy((q / W) | 0)).s;

  // 3a. Smoothing: each cell takes the sector most present around it (5 × 5), which removes the thin
  // corridors a breeze drawn along a valley would carve into a neighbour; the area itself is unchanged.
  for (let pass = 0; pass < 2; pass++) {
    const prev = label.slice();
    const count = new Int16Array(sectors.length);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const q = j * W + i;
        if (prev[q] < 0) continue;
        const touched: number[] = [];
        for (let dj = -2; dj <= 2; dj++)
          for (let di = -2; di <= 2; di++) {
            const ni = i + di;
            const nj = j + dj;
            if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
            const v = prev[nj * W + ni];
            if (v < 0) continue;
            if (!count[v]) touched.push(v);
            count[v]++;
          }
        let best = prev[q];
        for (const v of touched) if (count[v] > count[best]) best = v;
        label[q] = best;
        for (const v of touched) count[v] = 0;
      }
  }

  // 3b. One block per sector: detached pieces go to the neighbour that surrounds them most.
  let reassigned = 0;
  for (let pass = 0; pass < 6; pass++) {
    const comp = new Int32Array(W * H).fill(-1);
    const sizes: number[] = [];
    const owner: number[] = [];
    for (let q = 0; q < W * H; q++) {
      if (label[q] < 0 || comp[q] >= 0) continue;
      const id = sizes.length;
      let size = 0;
      const st = [q];
      comp[q] = id;
      while (st.length) {
        const c = st.pop()!;
        size++;
        const i = c % W;
        const j = (c / W) | 0;
        for (const n of [i + 1 < W ? c + 1 : -1, i > 0 ? c - 1 : -1, j + 1 < H ? c + W : -1, j > 0 ? c - W : -1]) {
          if (n < 0 || comp[n] >= 0 || label[n] !== label[q]) continue;
          comp[n] = id;
          st.push(n);
        }
      }
      sizes.push(size);
      owner.push(label[q]);
    }
    const biggest = new Map<number, number>();
    sizes.forEach((sz, id) => {
      const s = owner[id];
      if (!biggest.has(s) || sz > sizes[biggest.get(s)!]) biggest.set(s, id);
    });
    let changed = 0;
    const votes = new Map<number, Map<number, number>>();
    for (let q = 0; q < W * H; q++) {
      const id = comp[q];
      if (id < 0 || biggest.get(owner[id]) === id) continue;
      const i = q % W;
      const j = (q / W) | 0;
      for (const n of [i + 1 < W ? q + 1 : -1, i > 0 ? q - 1 : -1, j + 1 < H ? q + W : -1, j > 0 ? q - W : -1]) {
        if (n < 0 || label[n] < 0 || comp[n] === id) continue;
        const v = votes.get(id) ?? new Map<number, number>();
        v.set(label[n], (v.get(label[n]) ?? 0) + 1);
        votes.set(id, v);
      }
    }
    for (let q = 0; q < W * H; q++) {
      const v = votes.get(comp[q]);
      if (!v) continue;
      label[q] = [...v.entries()].sort((a, b) => b[1] - a[1])[0][0];
      changed++;
    }
    reassigned += changed;
    if (!changed) break;
  }

  // 3c. Colours for the schematic map: neighbouring blocks never share one (greedy colouring of the adjacency).
  const adjacent = sectors.map(() => new Set<number>());
  for (let q = 0; q < W * H; q++) {
    const a = label[q];
    if (a < 0) continue;
    for (const n of [(q % W) + 1 < W ? q + 1 : -1, q + W < W * H ? q + W : -1]) {
      const b = n >= 0 ? label[n] : -1;
      if (b >= 0 && b !== a) {
        adjacent[a].add(b);
        adjacent[b].add(a);
      }
    }
  }
  const colour = new Array<number>(sectors.length).fill(-1);
  for (const s of sectors.map((_, i) => i).sort((a, b) => adjacent[b].size - adjacent[a].size)) {
    const used = new Set([...adjacent[s]].map((n) => colour[n]));
    let c = 0;
    while (used.has(c)) c++;
    colour[s] = c;
    sectors[s].colorIndex = c;
  }

  // 4. Border of each block: cell edges with the block on the left, chained into rings; the longest is the outline.
  for (let s = 0; s < sectors.length; s++) {
    // Outgoing edges per corner (a corner where the block touches itself diagonally has two).
    const next = new Map<string, string[]>();
    const key = (i: number, j: number) => `${i},${j}`;
    const at = (i: number, j: number) => i >= 0 && j >= 0 && i < W && j < H && label[j * W + i] === s;
    const edge = (a: string, b: string) => {
      const list = next.get(a);
      if (list) list.push(b);
      else next.set(a, [b]);
    };
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        if (!at(i, j)) continue;
        // Counter-clockwise around the cell: bottom, right, top, left edges where the neighbour is outside.
        if (!at(i, j - 1)) edge(key(i, j), key(i + 1, j));
        if (!at(i + 1, j)) edge(key(i + 1, j), key(i + 1, j + 1));
        if (!at(i, j + 1)) edge(key(i + 1, j + 1), key(i, j + 1));
        if (!at(i - 1, j)) edge(key(i, j + 1), key(i, j));
      }
    let best: Ring = [];
    for (const start of [...next.keys()]) {
      const ring: Ring = [];
      let k: string | undefined = start;
      while (k) {
        const out = next.get(k);
        if (!out?.length) break;
        const [i, j] = k.split(',').map(Number);
        ring.push([x0 + i * STEP_LON, y0 + j * STEP_LAT]);
        k = out.pop();
      }
      if (ring.length > best.length) best = ring;
    }
    if (best.length < 4) continue;
    // A closed ring has no baseline: simplify its two halves, split at the corner farthest from the start.
    let far = 0;
    best.forEach((p, i) => {
      if (Math.hypot(p[0] - best[0][0], p[1] - best[0][1]) > Math.hypot(best[far][0] - best[0][0], best[far][1] - best[0][1])) far = i;
    });
    const closed = [...simplify(best.slice(0, far + 1), 0.005).slice(0, -1), ...simplify([...best.slice(far), best[0]], 0.005).slice(0, -1)];
    sectors[s].outline = closed.map(([x, y]) => [Math.round(x * 1e3) / 1e3, Math.round(y * 1e3) / 1e3]);
  }
  return { cells: label.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0), sectors: sectors.length, reassigned };
}
