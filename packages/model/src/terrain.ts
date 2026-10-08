/**
 * Static terrain analysis, computed once from the elevation grid:
 * slopes, valley structure (drainage network by priority-flood), valley depth,
 * water bodies and the large-scale "plain → mountain" direction.
 * Everything the time/wind-dependent model needs and that never changes.
 */
import { Grid } from './grid';
import { blur, clamp, extremumFilter, smoothstep } from './raster';
import { RULES } from './rules';

export interface Terrain {
  grid: Grid;
  /** Elevation (m), sea clamped to 0. */
  z: Float32Array;
  /** Slightly smoothed elevation gradient, east and north components (m/m). */
  gx: Float32Array;
  gy: Float32Array;
  /** Valley floor (local minimum envelope, ~1.7 km) and crest envelope (~6 km) elevations (m). */
  floor: Float32Array;
  env: Float32Array;
  /** Local relief: elevation minus its ~1.5 km mean (m). Positive on spurs and ridges. */
  tpi: Float32Array;
  /** Unit vector pointing DOWN-valley (drainage direction, smoothed), east/north. */
  axisX: Float32Array;
  axisY: Float32Array;
  /** How clearly the cell belongs to a valley channel (0..1), times valley size (0..1). */
  valley: Float32Array;
  /**
   * Speed-up of the valley wind where the channel narrows (verrou, goulet), 1..1.5:
   * width of the channel against its median width up and down the valley (see
   * `valleyFunnel`). 1 outside valleys.
   */
  funnel: Float32Array;
  /** Onshore direction × proximity for lakes (by day air leaves the lake). */
  lakeX: Float32Array;
  lakeY: Float32Array;
  /** Same for the Mediterranean sea breeze, longer reach. */
  seaX: Float32Array;
  seaY: Float32Array;
  /** Direction from plains towards the mountain mass × foreland weight. */
  plainX: Float32Array;
  plainY: Float32Array;
  /** 0 land, 1 lake, 2 sea. */
  water: Uint8Array;
  /** Upstream drainage area (km²). */
  drainKm2: Float32Array;
}

/** Seed points of the main lakes (lon, lat). Flood-filled on the flat DEM surface. */
export const LAKE_SEEDS: Array<[string, number, number]> = [
  ['Léman', 6.52, 46.43],
  ['Lac d’Annecy', 6.175, 45.845],
  ['Lac du Bourget', 5.866, 45.73],
  ['Lac d’Aiguebelette', 5.8, 45.555],
  ['Lac de Paladru', 5.535, 45.46],
  ['Lac de Serre-Ponçon', 6.33, 44.52],
  ['Lac de Monteynard', 5.69, 44.96],
  ['Grand lac de Laffrey', 5.775, 45.03],
  ['Lac du Sautet', 5.905, 44.815],
  ['Lac de Castillon', 6.535, 43.89],
  ['Lac de Sainte-Croix', 6.18, 43.77],
  ['Lac de Roselend', 6.62, 45.68],
  ['Lac du Mont-Cenis', 6.94, 45.235],
  ['Lac du Chambon', 6.165, 45.04],
];

/** Crest envelope: max-filter radius and smoothing radius, in cells (≈ 216 m). */
const ENV_RADIUS = 28;
const ENV_SMOOTH = 10;

const N8X = [1, 1, 0, -1, -1, -1, 0, 1];
const N8Y = [0, 1, 1, 1, 0, -1, -1, -1];

/** Binary min-heap of cell indices keyed by float priority. */
class MinHeap {
  private keys: Float64Array;
  private items: Int32Array;
  size = 0;
  constructor(capacity: number) {
    this.keys = new Float64Array(capacity);
    this.items = new Int32Array(capacity);
  }
  push(key: number, item: number): void {
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.keys[i] = this.keys[p];
      this.items[i] = this.items[p];
      i = p;
    }
    this.keys[i] = key;
    this.items[i] = item;
  }
  pop(): number {
    const top = this.items[0];
    const lastKey = this.keys[--this.size];
    const lastItem = this.items[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.keys[c + 1] < this.keys[c]) c++;
      if (this.keys[c] >= lastKey) break;
      this.keys[i] = this.keys[c];
      this.items[i] = this.items[c];
      i = c;
    }
    this.keys[i] = lastKey;
    this.items[i] = lastItem;
    return top;
  }
}

/**
 * Priority-flood (Barnes et al. 2014) from the grid border and the sea:
 * gives each cell the neighbour it drains into, through depressions and flats,
 * and a topological order to accumulate upstream area.
 */
function drainage(z: Float32Array, w: number, h: number, water: Uint8Array): { down: Int32Array; order: Int32Array } {
  const n = w * h;
  const down = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  const seen = new Uint8Array(n);
  const heap = new MinHeap(n);
  for (let k = 0; k < n; k++) {
    const i = k % w;
    const j = (k / w) | 0;
    if (i === 0 || j === 0 || i === w - 1 || j === h - 1 || water[k] === 2) {
      heap.push(z[k], k);
      seen[k] = 1;
    }
  }
  const level = new Float64Array(z);
  let o = 0;
  while (heap.size > 0) {
    const c = heap.pop();
    order[o++] = c;
    const ci = c % w;
    const cj = (c / w) | 0;
    for (let d = 0; d < 8; d++) {
      const ni = ci + N8X[d];
      const nj = cj + N8Y[d];
      if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
      const nk = nj * w + ni;
      if (seen[nk]) continue;
      seen[nk] = 1;
      down[nk] = c;
      level[nk] = Math.max(z[nk], level[c] + 1e-3);
      heap.push(level[nk], nk);
    }
  }
  return { down, order };
}

function floodLakes(grid: Grid, z: Float32Array, water: Uint8Array): void {
  const { width: w, height: h } = grid;
  const stack: number[] = [];
  for (const [, lon, lat] of LAKE_SEEDS) {
    if (!grid.contains(lon, lat)) continue;
    const [gx, gy] = grid.toGrid(lon, lat);
    // The seed may sit a bit off the water surface: take the lowest cell nearby.
    let seed = -1;
    let best = Infinity;
    for (let dj = -4; dj <= 4; dj++) {
      for (let di = -4; di <= 4; di++) {
        const i = Math.floor(gx) + di;
        const j = Math.floor(gy) + dj;
        if (i < 1 || j < 1 || i >= w - 1 || j >= h - 1) continue;
        const k = j * w + i;
        if (z[k] < best) {
          best = z[k];
          seed = k;
        }
      }
    }
    if (seed < 0 || water[seed]) continue;
    const level = z[seed];
    stack.push(seed);
    water[seed] = 1;
    let count = 0;
    while (stack.length && count < 400000) {
      const c = stack.pop()!;
      count++;
      const ci = c % w;
      const cj = (c / w) | 0;
      for (let d = 0; d < 8; d += 2) {
        const ni = ci + N8X[d];
        const nj = cj + N8Y[d];
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        const nk = nj * w + ni;
        if (water[nk] || Math.abs(z[nk] - level) > 1.5) continue;
        water[nk] = 1;
        stack.push(nk);
      }
    }
  }
}

/** Gradient of a field in metres per metre (east, north). */
function gradient(f: Float32Array, grid: Grid): { gx: Float32Array; gy: Float32Array } {
  const { width: w, height: h } = grid;
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const jm = Math.max(0, j - 1);
    const jp = Math.min(h - 1, j + 1);
    const cs = grid.cellM[j];
    for (let i = 0; i < w; i++) {
      const im = Math.max(0, i - 1);
      const ip = Math.min(w - 1, i + 1);
      const k = j * w + i;
      gx[k] = (f[j * w + ip] - f[j * w + im]) / ((ip - im) * cs);
      // Rows increase southwards: north component is the negated row derivative.
      gy[k] = -(f[jp * w + i] - f[jm * w + i]) / ((jp - jm) * cs);
    }
  }
  return { gx, gy };
}

/** Normalised "onshore" field from a water mask blurred at `radius` cells. */
function onshoreField(mask: Float32Array, grid: Grid, radius: number): { x: Float32Array; y: Float32Array } {
  const b = blur(mask, grid.width, grid.height, radius);
  const { gx, gy } = gradient(b, grid);
  const n = grid.size;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const j = (k / grid.width) | 0;
    // gradient per cell × diameter of the blur ≈ 1 at the shore.
    const len = Math.sqrt(gx[k] * gx[k] + gy[k] * gy[k]);
    const perCell = len * grid.cellM[j];
    const mag = clamp(perCell * radius * 2.2, 0, 1);
    // Mask gradient points to the water: onshore (water → land) is the opposite.
    if (len < 1e-9) continue;
    x[k] = (-gx[k] / len) * mag;
    y[k] = (-gy[k] / len) * mag;
  }
  return { x, y };
}

export function analyseTerrain(grid: Grid, rawElevation: Float32Array): Terrain {
  const { width: w, height: h, size: n } = grid;
  const z = new Float32Array(n);
  const water = new Uint8Array(n);
  for (let k = 0; k < n; k++) {
    const e = rawElevation[k];
    if (e <= 0) {
      water[k] = 2;
      z[k] = 0;
    } else z[k] = e;
  }
  floodLakes(grid, z, water);

  const zs = blur(z, w, h, 1.5);
  const { gx, gy } = gradient(zs, grid);
  const zMid = blur(z, w, h, 7);
  const tpi = new Float32Array(n);
  for (let k = 0; k < n; k++) tpi[k] = z[k] - zMid[k];

  // Valley floor envelope (~1.7 km local minimum), smoothed.
  const floor = blur(extremumFilter(z, w, h, 8, false), w, h, 5);
  // Local relief envelope (~2.6 km): how incised the channel is (valley presence weight below).
  const envLocal = blur(extremumFilter(z, w, h, 12, true), w, h, 6);
  // Crest envelope: height of the ridges that bound the valley atmosphere, which sets
  // the thickness of the valley-wind layer (it fills the valley up to about ridge-top
  // height, Zardi & Whiteman 2013). Alpine valleys are 10–15 km crest to crest (the
  // Chartreuse crest is ~6.5 km from the Isère at Saint-Hilaire), so the max is taken
  // within ENV_RADIUS ≈ 6 km, then smoothed: ~2 000 m over the Grésivaudan,
  // ~2 600 m in Tarentaise, ~2 150 m at Annecy. The former ~2.6 km envelope only saw
  // the lower slopes (≈ 1 000 m over the Grésivaudan) and cut the valley wind off a
  // few hundred metres above the floor.
  const env = blur(extremumFilter(z, w, h, ENV_RADIUS, true), w, h, ENV_SMOOTH);
  for (let k = 0; k < n; k++) {
    if (floor[k] > z[k]) floor[k] = z[k];
    if (env[k] < z[k]) env[k] = z[k];
    if (envLocal[k] < z[k]) envLocal[k] = z[k];
  }

  // Drainage network.
  const { down, order } = drainage(z, w, h, water);
  const acc = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const j = (k / w) | 0;
    acc[k] = (grid.cellM[j] * grid.cellM[j]) / 1e6;
  }
  for (let o = n - 1; o >= 0; o--) {
    const c = order[o];
    const d = down[c];
    if (d >= 0) acc[d] += acc[c];
  }

  // Down-valley direction, weighted by the size of the stream, then smoothed so
  // that the whole valley floor (not only the thalweg) knows its axis.
  const qx = new Float32Array(n);
  const qy = new Float32Array(n);
  const wt = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const d = down[k];
    if (d < 0 || water[k] === 2) continue;
    const weight = clamp(Math.log10(acc[k]) - 0.5, 0, 4); // 3 km² → 0, 30 000 km² → 4
    if (weight <= 0) continue;
    const dx = (d % w) - (k % w);
    const dy = ((d / w) | 0) - ((k / w) | 0);
    const len = Math.sqrt(dx * dx + dy * dy);
    qx[k] = (dx / len) * weight;
    qy[k] = (-dy / len) * weight;
    wt[k] = weight;
  }
  const bqx = blur(qx, w, h, 8);
  const bqy = blur(qy, w, h, 8);
  const bwt = blur(wt, w, h, 8);
  const sizeMax = blur(extremumFilter(wt, w, h, 9, true), w, h, 4);
  const axisX = new Float32Array(n);
  const axisY = new Float32Array(n);
  const valley = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const len = Math.sqrt(bqx[k] * bqx[k] + bqy[k] * bqy[k]);
    if (len < 1e-6 || bwt[k] < 1e-4) continue;
    axisX[k] = bqx[k] / len;
    axisY[k] = bqy[k] / len;
    // Coherence: 1 when all nearby streams agree on the direction.
    const coherence = clamp(len / bwt[k], 0, 1);
    // Presence: fades out more than ~1.5 km away from any stream.
    const presence = smoothstep(0.004, 0.05, bwt[k] / Math.max(sizeMax[k], 0.3));
    // Size: log of the upstream area (≈30 km² → 0, ≈3000 km² → 1).
    const size = clamp((sizeMax[k] - 0.9) / 2.1, 0, 1);
    const depth = smoothstep(80, 600, envLocal[k] - floor[k]);
    valley[k] = coherence * presence * Math.sqrt(size) * (0.3 + 0.7 * depth);
  }

  const funnel = valleyFunnel(z, floor, envLocal, axisX, axisY, valley, grid);

  // Water breezes.
  const lakeMask = new Float32Array(n);
  const seaMask = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    if (water[k] === 1) lakeMask[k] = 1;
    else if (water[k] === 2) seaMask[k] = 1;
  }
  const lake = onshoreField(lakeMask, grid, 6);
  const sea = onshoreField(seaMask, grid, 45);

  // Plain → mountain direction: gradient of a ~13 km smoothed relief.
  const zReg = blur(z, w, h, 60);
  const reg = gradient(zReg, grid);
  const plainX = new Float32Array(n);
  const plainY = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const g = Math.sqrt(reg.gx[k] * reg.gx[k] + reg.gy[k] * reg.gy[k]);
    if (g < 1e-6 || water[k]) continue;
    const mag = clamp(g / 0.035, 0, 1) * (1 - smoothstep(500, 1300, z[k]));
    plainX[k] = (reg.gx[k] / g) * mag;
    plainY[k] = (reg.gy[k] / g) * mag;
  }

  return {
    grid,
    z,
    gx,
    gy,
    floor,
    env,
    tpi,
    axisX,
    axisY,
    valley,
    funnel,
    lakeX: lake.x,
    lakeY: lake.y,
    seaX: sea.x,
    seaY: sea.y,
    plainX,
    plainY,
    water,
    drainKm2: acc,
  };
}

/** Valley cells taken into account for the narrowing (clear enough channels). */
const FUNNEL_MIN_VALLEY = 0.15;

/**
 * Narrowing of the valley channels. The valley wind carries about the same flow
 * along the valley: where the channel is narrower than up and down the valley it
 * speeds up (mass conservation; pilots report the breeze "forte" at the verrous,
 * goulets and narrow cols: Châtillon-en-Diois, the Combe du Goulet, Megève, the
 * Roya at Tende). For each valley cell: width of the channel across the axis, up to
 * a third of the local valley depth above the floor (at least 120 m); against the
 * median width 0.9–4.3 km up and down the axis. Speed-up (ref / width)^exponent, only
 * accelerating, at most `RULES.funnelMax`, faded with the clarity of the channel.
 */
export function valleyFunnel(z: Float32Array, floor: Float32Array, env: Float32Array, axisX: Float32Array, axisY: Float32Array, valley: Float32Array, grid: Grid): Float32Array {
  const { width: w, height: h, size: n } = grid;
  const width = new Float32Array(n);
  const MAX_STEPS = 25;
  for (let k = 0; k < n; k++) {
    if (valley[k] < FUNNEL_MIN_VALLEY) continue;
    const i0 = k % w;
    const j0 = (k / w) | 0;
    // Across the axis, in grid steps (rows grow southwards).
    const pi = -axisY[k];
    const pj = -axisX[k];
    const top = floor[k] + Math.max(120, (env[k] - floor[k]) / 3);
    let cells = 0;
    for (const side of [1, -1]) {
      let s = 1;
      for (; s <= MAX_STEPS; s++) {
        const i = Math.round(i0 + side * pi * s);
        const j = Math.round(j0 + side * pj * s);
        if (i < 0 || j < 0 || i >= w || j >= h || z[j * w + i] > top) break;
      }
      cells += s - 0.5;
    }
    width[k] = cells * grid.cellM[j0];
  }
  const funnel = new Float32Array(n).fill(1);
  const OFFSETS = [4, 8, 12, 16, 20];
  const around: number[] = [];
  for (let k = 0; k < n; k++) {
    if (width[k] <= 0) continue;
    const i0 = k % w;
    const j0 = (k / w) | 0;
    around.length = 0;
    for (const d of OFFSETS)
      for (const side of [1, -1]) {
        const i = Math.round(i0 + side * axisX[k] * d);
        const j = Math.round(j0 - side * axisY[k] * d);
        if (i < 0 || j < 0 || i >= w || j >= h) continue;
        const wk = width[j * w + i];
        if (wk > 0) around.push(wk);
      }
    if (around.length < 4) continue;
    around.sort((a, b) => a - b);
    const ref = around[around.length >> 1];
    const up = clamp(Math.pow(ref / width[k], RULES.funnelExponent), 1, RULES.funnelMax);
    funnel[k] = 1 + (up - 1) * smoothstep(FUNNEL_MIN_VALLEY, 0.4, valley[k]);
  }
  return funnel;
}
