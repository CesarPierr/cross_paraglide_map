/**
 * The air the pilot flies in, beyond the mean wind of the model: individual thermals,
 * their cumulus, the sink that balances them, the documented convergences and the gusts.
 *
 * Thermals are placed where the site's model puts the thermal potential (sun on the
 * slope, convexity, height…) and where documented or measured (kk7) thermals are. Their
 * shape follows the updraft model used for soaring research (Allen, 2006, NASA
 * TM-2006-213475): radius growing with height, peak lift in the lower third of the
 * convective layer, a ring of sink around the core that strengthens in the upper half. On
 * top of that, what makes a real thermal hard to centre:
 * - each trigger breathes: bubbles released in cycles of 9–21 min, each with its own
 *   strength, duration and ramps (cosine life cycle, Rachelson et al.); a bubble starts at
 *   the bottom and cuts from the bottom too; a source shaded by a cloud stops feeding it
 *   within minutes, which with its own cumulus makes the cycles under a cloud;
 * - sizes differ, the lift is two or three bubbles drifting around the axis, and its edge
 *   is sharp and turbulent on an unstable day;
 * - each thermal leans with the wind of the layers it crosses (the site's model sampled at
 *   the source: up a slope in the breeze, then with the wind aloft), bends back under the
 *   inversion; its core sits on the windward side with the strongest sink right next to
 *   it; in strong wind it breaks into separate bubbles;
 * - on a slope facing the wind it hugs the relief; in the lee it is torn.
 * Mass is conserved: the ring and a broad sink around each thermal return its flow, and a
 * zero-mean background lifts over sun-facing relief and sinks over the valleys between them.
 * Above the condensation level the thermal feeds a cumulus whose base is regional (smooth
 * over ~10 km), and the lift strengthens under it.
 */
import type { PotentialGrid } from './game-client';
import { LocalFrame } from './geo';

export interface Scenario {
  month0: number;
  day: number;
  /** French legal time at the start, decimal hours. */
  hour: number;
  windFrom: number;
  windKmh: number;
  /** 0 stable … 1 very unstable air mass. */
  instability: number;
  /** 0 dry (blue thermals) … 1 humid (low cumulus). */
  humidity: number;
  /** The weather evolves on its own during the flight. */
  randomWeather: boolean;
  /** Game time speed: 1 = real time. */
  timeScale: number;
  seed: number;
}

interface Core {
  /** Offset from the axis in core radii, its angle and how fast it turns (rad/s). */
  off: number;
  ang: number;
  spin: number;
  share: number;
}

/** Heights above a source (m) where the site's wind is sampled to lean its thermal. */
export const PROFILE_DZ = [0, 100, 300, 600, 1000, 1500, 2200];

export interface ThermalSource {
  x: number;
  y: number;
  ground: number;
  /** 0..1: documented/measured thermals and strong potential are worth more. */
  weight: number;
  /** Current thermal potential of the model there (sun on the slope at this hour). */
  potential: number;
  /** Direction the slope faces (deg), its steepness (deg) and the model's lee there (0..1). */
  aspect: number;
  slope: number;
  lee: number;
  base: number;
  /** Size: < 1 narrow and punchy, > 1 wide and soft. */
  size: number;
  period: number;
  phase: number;
  active: number;
  cores: Core[];
  name?: string;
  /** Index for the per-cycle draws. */
  id: number;
  /** Sharpness of its edge (0.7..1.3). */
  edge: number;
  /**
   * Elongation of the core (≥ 1, at the same area) and its long axis (unit, east/north):
   * along the slope's contour (a thermal off a ridge or a cliff band), at random on the
   * flat. Mostly round; about one in ten stretched 2–2.6 times: lift a pilot crosses but
   * cannot circle in.
   */
  elong: number;
  ex: number;
  ey: number;
  /** Sunlight on the source, lagged by the ground's heat (0..1), and its history (one value every SHADE_STEP s). */
  sun: number;
  sunHist: Float32Array;
  /** Terrain smoothed over ~10 km at the source (m): sets the regional ceiling and cloud base. */
  terrain: number;
  /** Site wind at PROFILE_DZ (m/s) and its integral along the rise (m²/s, with the slope's hold): the lean. */
  pu: Float32Array | null;
  pv: Float32Array | null;
  iu: Float32Array | null;
  iv: Float32Array | null;
  /** Cached per-cycle draws. */
  cyc: { gen: number; life: number; start: number; ramp: number; amp: number; reach: number };
}

export interface Convergence {
  name: string;
  pts: [number, number][];
  start: number;
  end: number;
}

export interface CloudInfo {
  x: number;
  y: number;
  base: number;
  top: number;
  radius: number;
  /** 0..1 growth of the cloud. */
  size: number;
  seed: number;
}

export interface VerticalAir {
  w: number;
  /** Extra turbulence from thermal edges and torn lee thermals, 0..1. */
  shear: number;
  /** Inside a cloud: 0..1 (white-out). */
  cloud: number;
  /** Horizontal air added by the thermals' inflow and the convergences (m/s). */
  u: number;
  v: number;
}

export interface Column {
  cx: number;
  cy: number;
  rc: number;
  w: number;
  top: number;
}

/** Everything the lift of one thermal at one height needs (filled without allocation). */
interface ColumnEx extends Column {
  /** Unit vector downwind at this height and the wind strength factor 0..1. */
  dx: number;
  dy: number;
  wf: number;
  /** Along-wind scales upwind/downwind (× rc). */
  sUp: number;
  sDown: number;
  /** Sink ring amplitude (m/s) and its upwind excess, broad sink kernel (flux m³/s, sigma m). */
  ringA: number;
  ringUp: number;
  envFlux: number;
  envSigma: number;
  /** Strong-wind bubble train: mix, vertical spacing (m), rise speed (m/s). */
  bubble: number;
  lambda: number;
  rise: number;
  /** Radial inflow (+) or outflow (−) per unit of lift at the core edge (m/s per m/s). */
  inflow: number;
  /** How torn by the lee (0..1) and how sharp its edge is (0 smooth … 1 a ~5 m wall). */
  torn: number;
  sharp: number;
  /** Feeds a cumulus whose base is at `base` (m). */
  cumulus: boolean;
  base: number;
}

const newColumnEx = (): ColumnEx => ({ cx: 0, cy: 0, rc: 0, w: 0, top: 0, dx: 1, dy: 0, wf: 0, sUp: 1, sDown: 1, ringA: 0, ringUp: 0, envFlux: 0, envSigma: 600, bubble: 0, lambda: 300, rise: 2, inflow: 0, torn: 0, sharp: 0, cumulus: false, base: 0 });

interface NearThermal {
  s: ThermalSource;
  c: ColumnEx;
  z0: number;
  /** Lean of the axis per metre of height around z0. */
  lx: number;
  ly: number;
}

interface Pocket {
  fx: number;
  fy: number;
  fz: number;
  amp: number;
  rad: number;
  life: number;
  ph0: number;
}

/**
 * A plausible weather for the month: wind direction from the usual Alpine regimes
 * (north/bise, north-west/west flow, south-west/south ahead of a front, east rare),
 * speed mostly light, air mass more unstable in late spring and summer.
 */
export function randomWeather(month0: number, rng: () => number): { windFrom: number; windKmh: number; instability: number; humidity: number } {
  const regimes: [number, number][] = [
    [0, 0.24],
    [315, 0.16],
    [270, 0.14],
    [225, 0.14],
    [180, 0.14],
    [45, 0.1],
    [90, 0.04],
    [135, 0.04],
  ];
  let u = rng();
  let from = 0;
  for (const [d, p] of regimes) {
    if ((u -= p) <= 0) {
      from = d;
      break;
    }
  }
  from = (from + (rng() - 0.5) * 40 + 360) % 360;
  const kmh = Math.min(38, Math.round(-Math.log(1 - rng() * 0.97) * 9));
  const season = Math.sin(((month0 + 0.5) / 12) * Math.PI) ** 1.5;
  const instability = clamp(0.2 + 0.5 * season + (rng() - 0.5) * 0.45, 0.05, 1);
  const humidity = clamp(0.45 + (rng() - 0.5) * 0.6, 0, 1);
  return { windFrom: Math.round(from), windKmh: kmh, instability, humidity };
}

/** Deterministic random numbers (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Pseudo-random number in [0, 1) for three integers and a salt (no allocation). */
function hashU(a: number, b: number, c: number, salt: number): number {
  let h = (Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 2147483647) ^ Math.imul(salt, 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Lattice value in [-1, 1] for the noise. */
function lattice(i: number, j: number, k: number, seed: number): number {
  let n = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683) ^ Math.imul(seed, 1274126177)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 2147483648 - 1;
}

/** Smooth 3D value noise in [-1, 1] (standard deviation ≈ 0.42), without allocation. */
function vnoise(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const a00 = lattice(ix, iy, iz, seed) + (lattice(ix + 1, iy, iz, seed) - lattice(ix, iy, iz, seed)) * sx;
  const a10 = lattice(ix, iy + 1, iz, seed) + (lattice(ix + 1, iy + 1, iz, seed) - lattice(ix, iy + 1, iz, seed)) * sx;
  const a01 = lattice(ix, iy, iz + 1, seed) + (lattice(ix + 1, iy, iz + 1, seed) - lattice(ix, iy, iz + 1, seed)) * sx;
  const a11 = lattice(ix, iy + 1, iz + 1, seed) + (lattice(ix + 1, iy + 1, iz + 1, seed) - lattice(ix, iy + 1, iz + 1, seed)) * sx;
  const b0 = a00 + (a10 - a00) * sy;
  const b1 = a01 + (a11 - a01) * sy;
  return b0 + (b1 - b0) * sz;
}

/** Three octaves (scale ÷2.6, amplitude ×0.62: a spectrum close to k^-5/3), normalised to unit variance (measured). */
function fractal(x: number, y: number, z: number, seed: number): number {
  return (vnoise(x, y, z, seed) + 0.62 * vnoise(x * 2.6 + 11.3, y * 2.6 - 7.1, z * 2.6 + 3.7, seed + 17) + 0.384 * vnoise(x * 6.76 - 5.9, y * 6.76 + 13.4, z * 6.76 - 1.3, seed + 29)) * 2.18;
}

/**
 * A unit-variance noise with eddies of size L (vertical size zr · L) that stays steady as L
 * changes along the flight: the fields of the two fixed sizes (powers of 2 m) around L,
 * blended by where L lies between them. Dividing the coordinates by L itself would jump
 * through the field at every change of L, the positions being thousands of metres from the
 * origin: near the ground, where the eddies follow the height, that is white noise, gusts
 * of 2 m/s from one step to the next, and a wing folding at every take-off.
 */
function atScale(noise: (x: number, y: number, z: number, seed: number) => number, x: number, y: number, z: number, L: number, zr: number, dz: number, seed: number): number {
  const lg = Math.log2(Math.max(1, L));
  const k = Math.floor(lg);
  const f = lg - k;
  const l0 = 2 ** k;
  const l1 = 2 * l0;
  const a = noise(x / l0, y / l0, z / (zr * l0) + dz, seed + 37 * k);
  const b = noise(x / l1, y / l1, z / (zr * l1) + dz, seed + 37 * (k + 1));
  return (a * (1 - f) + b * f) / Math.sqrt((1 - f) * (1 - f) + f * f);
}

/** Separable box blur of a grid (radius in cells), twice: close to a Gaussian, edges averaged over what exists. */
function blur(src: Float32Array, cols: number, rows: number, r: number): Float32Array {
  const cur = Float32Array.from(src);
  const tmp = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < rows; j++) {
      const o = j * cols;
      let sum = 0;
      let n = 0;
      for (let i = 0; i <= Math.min(cols - 1, r); i++) {
        sum += cur[o + i];
        n++;
      }
      for (let i = 0; i < cols; i++) {
        tmp[o + i] = sum / n;
        if (i + r + 1 < cols) {
          sum += cur[o + i + r + 1];
          n++;
        }
        if (i - r >= 0) {
          sum -= cur[o + i - r];
          n--;
        }
      }
    }
    for (let i = 0; i < cols; i++) {
      let sum = 0;
      let n = 0;
      for (let j = 0; j <= Math.min(rows - 1, r); j++) {
        sum += tmp[j * cols + i];
        n++;
      }
      for (let j = 0; j < rows; j++) {
        cur[j * cols + i] = sum / n;
        if (j + r + 1 < rows) {
          sum += tmp[(j + r + 1) * cols + i];
          n++;
        }
        if (j - r >= 0) {
          sum -= tmp[(j - r) * cols + i];
          n--;
        }
      }
    }
  }
  return cur;
}

/** A grid of values in the local frame, sampled bilinearly. */
interface FieldGrid {
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  cols: number;
  rows: number;
  data: Float32Array;
}

function sampleGrid(g: FieldGrid, x: number, y: number): number {
  const fi = clamp((x - g.x0) / g.dx, 0, g.cols - 1.001);
  const fj = clamp((y - g.y0) / g.dy, 0, g.rows - 1.001);
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  const tx = fi - i;
  const ty = fj - j;
  const d = g.data;
  const k = j * g.cols + i;
  const a = d[k] + (d[k + 1] - d[k]) * tx;
  const b = d[k + g.cols] + (d[k + g.cols + 1] - d[k + g.cols]) * tx;
  return a + (b - a) * ty;
}

/** Time between two values of a source's sunlight history (s), and its length. */
const SHADE_STEP = 20;
const SHADE_N = 72;
/** Pilot-local cache: radius of the thermals kept (m) and of the broad sink kernels. */
const NEAR_R = 2600;
const ENV_R = 4500;
/**
 * Eddy size in the shear layer at a thermal's edge (m): with a dissipation rate of 0.05–0.1
 * m²/s³ there, Kolmogorov's δv ≈ 2 (ε r)^(1/3) gives 1–1.6 m/s across ~4 m, sharper than the
 * wing's plunge response (~0.2 s): the gusts that fold a wing at a thermal's edge.
 */
const EDGE_L = 4;

export class AirMass {
  sources: ThermalSource[] = [];
  convergences: Convergence[] = [];
  /** Synoptic wind now (drifts in random weather). */
  windFrom: number;
  windKmh: number;
  instability: number;
  humidity: number;
  /** Seasonal intensity from the model's sun (0..1). */
  season = 0.7;
  hour: number;
  /** Centre of the window the thermals were placed in (local metres). */
  placedAt = { x: 0, y: 0 };
  private near: ThermalSource[] = [];
  private nearAt = { x: 1e12, y: 1e12, t: -1e9 };
  private rng: () => number;
  /** Values the random weather drifts around. */
  private mean: { windKmh: number; instability: number; humidity: number };
  private nextId = 0;
  /** Terrain smoothed over ~10 km and the zero-mean background of convection (from the potential), when known. */
  private terrain10: FieldGrid | null = null;
  private background: FieldGrid | null = null;
  /** Displacement of the air (frozen turbulence, air holes) when the pilot's air drives it; null = the wind aloft × t. */
  private adv: { x: number; y: number } | null = null;
  /** Time of the newest value in the sources' sunlight history. */
  private shadeT = -1e9;
  /** Last clouds computed (for the shade). */
  private lastClouds: CloudInfo[] = [];
  /** The sun's direction at the last shade update (unit, east/north/up). */
  private sunVec = { x: 0, y: 0, z: 1 };

  constructor(
    readonly frame: LocalFrame,
    readonly scenario: Scenario,
  ) {
    this.rng = makeRng(scenario.seed);
    this.windFrom = scenario.windFrom;
    this.windKmh = scenario.windKmh;
    this.instability = scenario.instability;
    this.humidity = scenario.humidity;
    this.mean = { windKmh: this.windKmh, instability: this.instability, humidity: this.humidity };
    this.hour = scenario.hour;
  }

  /** Strength scale of the day's thermals (m/s at their best). */
  wStar(): number {
    return (1.1 + 2.9 * this.instability) * (0.45 + 0.55 * this.season);
  }

  dayFactor(): number {
    const h = this.hour;
    return 0.45 + 0.55 * smoothstep(9.5, 14.5, h) - 0.35 * smoothstep(17, 20, h);
  }

  /** How convective the boundary layer is now (0 stable … 1 strongly convective): sets turbulence and the wind gradient. */
  convection(): number {
    return smoothstep(0.15, 0.7, this.instability * this.dayFactor() * (0.4 + 0.6 * this.season));
  }

  private flatCeiling(): number {
    return 900 + (800 + 2200 * this.instability) * (0.4 + 0.6 * this.season) * this.dayFactor();
  }

  /** Top of the convection (inversion), m above sea level, over relief whose ~10 km average is `ground`. */
  ceiling(ground: number): number {
    return Math.max(ground + 250, this.flatCeiling() + 0.35 * Math.max(0, ground - 800));
  }

  /** Condensation level (cloud base), m above sea level, over relief whose ~10 km average is `ground`. */
  cloudBase(ground: number): number {
    return 1200 + (1 - this.humidity) * 2800 + 0.12 * Math.max(0, ground - 800);
  }

  /** Terrain smoothed over ~10 km at a point (m), or null where unknown. */
  regionalTerrain(x: number, y: number): number | null {
    return this.terrain10 ? sampleGrid(this.terrain10, x, y) : null;
  }

  /** Regional ceiling at a point: the inversion follows the relief averaged over ~10 km, not each summit. */
  ceilingAt(x: number, y: number, ground: number): number {
    const t = this.regionalTerrain(x, y) ?? ground;
    return Math.max(ground + 250, this.flatCeiling() + 0.35 * Math.max(0, t - 800));
  }

  /** Regional cloud base: near-uniform over a valley or a massif (≈ +0.12 × the smoothed relief). */
  cloudBaseAt(x: number, y: number, ground = 800): number {
    return this.cloudBase(this.regionalTerrain(x, y) ?? ground);
  }

  windAloft(): [number, number] {
    const r = (this.windFrom * Math.PI) / 180;
    const s = (this.windKmh / 3.6) * 0.85;
    return [-Math.sin(r) * s, -Math.cos(r) * s];
  }

  /** Wind aloft without allocating (into this.wa). */
  private wa = { u: 0, v: 0 };
  private aloft(): { u: number; v: number } {
    const r = (this.windFrom * Math.PI) / 180;
    const s = (this.windKmh / 3.6) * 0.85;
    this.wa.u = -Math.sin(r) * s;
    this.wa.v = -Math.cos(r) * s;
    return this.wa;
  }

  /** How far the air has moved (m), into this.advXY: the air holes and the frozen turbulence drift with it. */
  private advXY = { x: 0, y: 0 };
  private advection(t: number): { x: number; y: number } {
    if (this.adv) {
      this.advXY.x = this.adv.x;
      this.advXY.y = this.adv.y;
    } else {
      const w = this.aloft();
      this.advXY.x = w.u * t;
      this.advXY.y = w.v * t;
    }
    return this.advXY;
  }

  /** The pilot's own air drives the drift of the small features (call every step with the mean wind there, game time t). */
  advance(dt: number, u: number, v: number, t: number): void {
    if (!this.adv) {
      // Take over from the wind aloft where it had carried them, without a jump.
      const w = this.aloft();
      this.adv = { x: w.u * t, y: w.v * t };
    }
    this.adv.x += u * dt;
    this.adv.y += v * dt;
  }

  /** 0 calm … 1 strong wind, for the wind effects on the thermals. */
  private windF(): number {
    return smoothstep(6, 30, this.windKmh);
  }

  /** How much a slope faces the wind: +1 windward, -1 leeward. */
  private windward(s: ThermalSource): number {
    if (s.slope < 8) return 0;
    return Math.cos(((s.aspect - this.windFrom) * Math.PI) / 180) * smoothstep(8, 25, s.slope);
  }

  /** Elongation and long axis of a new source's core (see ThermalSource.elong). */
  private axis(aspect: number, slope: number, r: () => number): { elong: number; ex: number; ey: number } {
    const e = r();
    const elong = 1 + 1.6 * e * e * e;
    const a = slope >= 8 ? ((aspect + 90) * Math.PI) / 180 : r() * Math.PI;
    return { elong, ex: Math.sin(a), ey: Math.cos(a) };
  }

  private makeSource(x: number, y: number, ground: number, weight: number, potential: number, aspect: number, slope: number, lee: number, name?: string): ThermalSource {
    const r = this.rng;
    const n = 1 + Math.floor(r() * 2.6);
    const cores: Core[] = [];
    for (let i = 0; i < n; i++) cores.push({ off: n === 1 ? 0.15 * r() : 0.25 + 0.4 * r(), ang: r() * Math.PI * 2, spin: (r() - 0.5) * 0.03, share: 0.6 + 0.8 * r() });
    const total = cores.reduce((a, c) => a + c.share, 0);
    for (const c of cores) c.share /= total / (n === 1 ? 1 : 1.25);
    // Not every trigger works every day: documented ones are reliable, the others mostly;
    // a "dud" still bubbles weakly. Sizes: mostly modest, sometimes a big one.
    const works = r() < 0.65 + 0.35 * weight;
    return {
      x,
      y,
      ground,
      weight,
      potential,
      aspect,
      slope,
      lee,
      base: works ? 0.75 + 0.5 * r() : 0.15 + 0.2 * r(),
      size: 0.5 + r() * r() * 1.6,
      period: 540 + 720 * r(),
      phase: r(),
      active: 0.7 + 0.25 * r(),
      cores,
      name,
      id: this.nextId++,
      edge: 0.7 + 0.6 * r(),
      ...this.axis(aspect, slope, r),
      sun: 1,
      sunHist: new Float32Array(SHADE_N).fill(1),
      terrain: ground,
      pu: null,
      pv: null,
      iu: null,
      iv: null,
      cyc: { gen: -1e9, life: 0, start: 0, ramp: 0.3, amp: 1, reach: 1 },
    };
  }

  /**
   * Places the thermals in a window around (cx, cy): local maxima of the model's thermal
   * potential, and the documented or measured thermals (which win over a nearby maximum:
   * their position is known).
   */
  placeSources(grid: PotentialGrid, known: { lon: number; lat: number; weight: number; name: string }[], cx: number, cy: number): void {
    const { cols, rows, thermal, elevation, aspect, slope, lee } = grid;
    const xs = Array.from(grid.lon, (lon) => this.frame.toXY(lon, grid.lat[0])[0]);
    const ys = Array.from(grid.lat, (lat) => this.frame.toXY(grid.lon[0], lat)[1]);
    const cand: ThermalSource[] = [];
    const at = (i: number, j: number) => j * cols + i;
    const cellOf = (x: number, y: number): [number, number] => [
      clamp(Math.round(((x - xs[0]) / (xs[cols - 1] - xs[0])) * (cols - 1)), 0, cols - 1),
      clamp(Math.round(((y - ys[0]) / (ys[rows - 1] - ys[0])) * (rows - 1)), 0, rows - 1),
    ];
    for (const k of known) {
      const [x, y] = this.frame.toXY(k.lon, k.lat);
      if (x < Math.min(xs[0], xs[cols - 1]) || x > Math.max(xs[0], xs[cols - 1])) continue;
      if (y < Math.min(ys[0], ys[rows - 1]) || y > Math.max(ys[0], ys[rows - 1])) continue;
      const [i, j] = cellOf(x, y);
      const c = at(i, j);
      cand.push(this.makeSource(x, y, elevation[c], 0.55 + 0.45 * k.weight, thermal[c], aspect[c], slope[c], lee[c], k.name));
    }
    const maxima: { i: number; j: number; v: number }[] = [];
    for (let j = 2; j < rows - 2; j++) {
      for (let i = 2; i < cols - 2; i++) {
        const v = thermal[at(i, j)];
        if (v < 0.22) continue;
        let top = true;
        for (let dj = -2; dj <= 2 && top; dj++) for (let di = -2; di <= 2; di++) if ((di || dj) && thermal[at(i + di, j + dj)] > v) top = false;
        if (top) maxima.push({ i, j, v });
      }
    }
    // Up to ~1 a km², at least SPACING apart: Allen (2006, from Lenschow) counts ~2 updrafts
    // a km² at mid-height under a 2 km convective layer, 1.2 met along a line as long as the
    // layer is deep. Continuous lift along a sunny face is the upslope breeze's
    // (pilot-air.ts), not these plumes'.
    const SPACING = 550;
    const MAX = 1600;
    const bins = new Map<number, ThermalSource[]>();
    const bin = (x: number, y: number) => Math.floor(x / SPACING) * 100003 + Math.floor(y / SPACING);
    const crowded = (x: number, y: number) => {
      const bx = Math.floor(x / SPACING);
      const by = Math.floor(y / SPACING);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) for (const c of bins.get((bx + dx) * 100003 + by + dy) ?? []) if (Math.hypot(c.x - x, c.y - y) < SPACING) return true;
      return false;
    };
    const keep = (src: ThermalSource) => {
      const b = bin(src.x, src.y);
      const l = bins.get(b);
      if (l) l.push(src);
      else bins.set(b, [src]);
    };
    for (const c of cand) keep(c);
    maxima.sort((a, b) => b.v - a.v);
    for (const m of maxima) {
      if (cand.length >= MAX) break;
      const x = xs[m.i];
      const y = ys[m.j];
      if (crowded(x, y)) continue;
      const c = at(m.i, m.j);
      const src = this.makeSource(x, y, elevation[c], 0.25 + 0.5 * m.v, m.v, aspect[c], slope[c], lee[c]);
      cand.push(src);
      keep(src);
    }
    // Between the maxima, more triggers where the ground heats well: each cell may host one,
    // the more likely the higher its potential (sunny slopes many, shade and flats few).
    const order = Array.from({ length: cols * rows }, (_, k) => k);
    for (let k = order.length - 1; k > 0; k--) {
      const q = Math.floor(this.rng() * (k + 1));
      const tmp = order[k];
      order[k] = order[q];
      order[q] = tmp;
    }
    for (const c of order) {
      if (cand.length >= MAX) break;
      const v = thermal[c];
      if (v < 0.25 || this.rng() > 0.35 * smoothstep(0.25, 0.7, v)) continue;
      const x = xs[c % cols];
      const y = ys[Math.floor(c / cols)];
      if (crowded(x, y)) continue;
      const src = this.makeSource(x, y, elevation[c], 0.2 + 0.4 * v, v, aspect[c], slope[c], lee[c]);
      cand.push(src);
      keep(src);
    }
    this.sources = cand;
    this.placedAt = { x: cx, y: cy };
    this.nearAt.t = -1e9;
    this.prep.t = -1e9;
    this.buildFields(grid, xs, ys);
  }

  /** New thermal potential (the sun turns): sources follow their slope's insolation. */
  refreshPotential(grid: PotentialGrid): void {
    const { cols, rows, thermal, lee } = grid;
    const x0 = this.frame.toXY(grid.lon[0], grid.lat[0]);
    const x1 = this.frame.toXY(grid.lon[cols - 1], grid.lat[rows - 1]);
    for (const s of this.sources) {
      const i = clamp(Math.round(((s.x - x0[0]) / (x1[0] - x0[0])) * (cols - 1)), 0, cols - 1);
      const j = clamp(Math.round(((s.y - x0[1]) / (x1[1] - x0[1])) * (rows - 1)), 0, rows - 1);
      s.potential = thermal[j * cols + i];
      s.lee = lee[j * cols + i];
    }
    const xs = Array.from(grid.lon, (lon) => this.frame.toXY(lon, grid.lat[0])[0]);
    const ys = Array.from(grid.lat, (lat) => this.frame.toXY(grid.lon[0], lat)[1]);
    this.buildFields(grid, xs, ys);
    this.prep.t = -1e9;
  }

  /**
   * Fields from the model's window: the terrain smoothed over ~10 km (regional ceiling and
   * cloud base), and the zero-mean background of convection: the potential's excess over its
   * ~1.5 km surroundings (lifting over sunny relief, sinking over the valleys and shaded
   * slopes between them; ±0.2 on real relief, ±0.3–0.5 m/s on a strong day).
   */
  private buildFields(grid: PotentialGrid, xs: number[], ys: number[]): void {
    const { cols, rows } = grid;
    if (cols < 4 || rows < 4) return;
    const cell = Math.abs(xs[1] - xs[0]) || 216;
    const geo = { x0: xs[0], y0: ys[0], dx: (xs[cols - 1] - xs[0]) / (cols - 1), dy: (ys[rows - 1] - ys[0]) / (rows - 1), cols, rows };
    this.terrain10 = { ...geo, data: blur(grid.elevation, cols, rows, Math.max(2, Math.round(2400 / cell))) };
    const fine = blur(grid.thermal, cols, rows, Math.max(1, Math.round(300 / cell)));
    const broad = blur(fine, cols, rows, Math.max(3, Math.round(1500 / cell)));
    const d = new Float32Array(cols * rows);
    for (let k = 0; k < d.length; k++) d[k] = clamp(fine[k] - broad[k], -0.35, 0.35);
    this.background = { ...geo, data: d };
    for (const s of this.sources) s.terrain = sampleGrid(this.terrain10, s.x, s.y);
  }

  /**
   * The site's wind sampled above the sources (`u`, `v`: PROFILE_DZ.length values per source,
   * in the order of `ids`): each thermal leans with the layers it crosses.
   */
  setProfiles(ids: number[], u: Float32Array, v: Float32Array): void {
    const n = PROFILE_DZ.length;
    const byId = new Map<number, ThermalSource>();
    for (const s of this.sources) byId.set(s.id, s);
    ids.forEach((id, k) => {
      const s = byId.get(id);
      if (!s) return;
      const pu = new Float32Array(n);
      const pv = new Float32Array(n);
      const iu = new Float32Array(n);
      const iv = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        pu[i] = u[k * n + i];
        pv[i] = v[k * n + i];
      }
      // On a slope facing the wind the bubbles hug the relief for the first couple of hundred metres.
      const ww = Math.max(0, this.windward(s));
      for (let i = 1; i < n; i++) {
        const h = (PROFILE_DZ[i] + PROFILE_DZ[i - 1]) / 2;
        const hold = h < 250 ? 1 - 0.7 * ww : 1;
        const dh = PROFILE_DZ[i] - PROFILE_DZ[i - 1];
        iu[i] = iu[i - 1] + 0.5 * (pu[i] + pu[i - 1]) * dh * hold;
        iv[i] = iv[i - 1] + 0.5 * (pv[i] + pv[i - 1]) * dh * hold;
      }
      s.pu = pu;
      s.pv = pv;
      s.iu = iu;
      s.iv = iv;
    });
    this.prep.t = -1e9;
  }

  /**
   * Weather evolution (random weather only), as slow random processes: the wind veers by
   * a few tens of degrees over hours and its speed wanders around the day's value; the
   * air mass breathes over ~40 min; on unstable days the humidity builds in the
   * afternoon (cumulus lower and fatter, towards over-development).
   */
  evolve(dt: number): void {
    if (!this.scenario.randomWeather || dt <= 0) return;
    const n = () => (this.rng() + this.rng() + this.rng() - 1.5) * 2;
    const ou = (v: number, mean: number, tau: number, sigma: number) => v + (mean - v) * (dt / tau) + sigma * Math.sqrt((2 * dt) / tau) * n();
    this.windFrom = (this.windFrom + n() * 12 * Math.sqrt(dt / 3600) + 360) % 360;
    this.windKmh = Math.max(0, ou(this.windKmh, this.mean.windKmh, 3600, 0.25 * this.mean.windKmh + 1.5));
    this.instability = clamp(ou(this.instability, this.mean.instability, 2400, 0.07), 0, 1);
    const build = this.hour > 13.5 && this.mean.instability > 0.55 ? 0.06 * (this.mean.instability - 0.55) * (dt / 600) : 0;
    this.mean.humidity = clamp(this.mean.humidity + build, 0, 1);
    this.humidity = clamp(ou(this.humidity, this.mean.humidity, 2400, 0.06), 0, 1);
  }

  /**
   * Release of a source's bubbles (0..~1.25): cycles of `period`, each bubble with its own
   * duration, start, strength and cosine ramps (Rachelson et al.'s life cycle: plateau
   * between ramps of a random share ξ/(1+ξ) of the life). Torn lee thermals release
   * shorter, more irregular bubbles.
   */
  private cycle(s: ThermalSource, t: number, torn: number): number {
    const P = s.period * (1 - 0.4 * torn);
    const u = t / P + s.phase;
    const gen = Math.floor(u);
    const c = s.cyc;
    if (c.gen !== gen) {
      c.gen = gen;
      c.life = clamp(s.active * (1 - 0.35 * torn) * (0.8 + 0.4 * hashU(s.id, gen, 1, 7)), 0.2, 0.9);
      c.start = (1 - c.life) * 0.7 * hashU(s.id, gen, 2, 7);
      const xi = 0.1 + 0.4 * hashU(s.id, gen, 3, 7);
      c.ramp = xi / (1 + xi);
      c.amp = 0.75 + 0.5 * hashU(s.id, gen, 4, 7);
      c.reach = this.reachOf(s, gen);
    }
    const x = (u - gen - c.start) / c.life;
    if (x <= 0 || x >= 1) return 0;
    const e = x < c.ramp ? 0.5 - 0.5 * Math.cos((Math.PI * x) / c.ramp) : x > 1 - c.ramp ? 0.5 - 0.5 * Math.cos((Math.PI * (1 - x)) / c.ramp) : 1;
    return e * c.amp;
  }

  /**
   * How high a bubble of a source rises, as a share of the layer up to the cloud base (or the
   * inversion on a blue day): the strong ones reach it and build the cumulus, weaker ones top
   * out below without a cloud, the more so on a stable day; each bubble draws its own, so the
   * thermals of a valley do not all top out at the same height. ≥ 0.97: it reaches the base.
   * About a third of an average source's bubbles reach it on a good day (instability 0.6),
   * half of a strong one's, one in ten on a stable day.
   */
  private reachOf(s: ThermalSource, gen: number): number {
    const st = this.strength(s) / Math.max(0.5, this.wStar());
    return clamp(0.9 + 0.45 * (this.instability - 0.6) + 0.25 * (st - 0.8) + 0.4 * (hashU(s.id, gen, 5, 7) - 0.5), 0.4, 1);
  }

  /** Sunlight that fed the source at time t (from its history): a shaded trigger stops supplying the bubbles. */
  private sunAt(s: ThermalSource, t: number): number {
    if (t >= this.shadeT) return s.sun;
    const k = (this.shadeT - t) / SHADE_STEP;
    const i = Math.floor(k);
    if (i >= SHADE_N - 1) return s.sunHist[SHADE_N - 1];
    const f = k - i;
    return s.sunHist[i] + (s.sunHist[i + 1] - s.sunHist[i]) * f;
  }

  /** How torn a thermal is by the wind in the lee (0..1). */
  private torn(s: ThermalSource): number {
    return clamp(Math.max(s.lee, -this.windward(s)) * this.windF(), 0, 1);
  }

  /** Peak lift of a source now, before the vertical profile and the cycle (m/s). */
  strength(s: ThermalSource): number {
    const wf = this.windF();
    // Narrow thermals punch harder, wide ones are soft; the wind on a windward face feeds
    // it, in the lee it is torn; a strong wind shears the weak ones apart.
    const wind = 1 + 0.15 * Math.max(0, this.windward(s)) * wf - 0.4 * this.torn(s) - 0.25 * wf * (1 - s.weight);
    return this.wStar() * (0.6 + 0.8 * s.weight) * s.base * (1.25 - 0.3 * s.size) * wind * smoothstep(0.08, 0.45, s.potential);
  }

  private nearby(x: number, y: number, t: number): ThermalSource[] {
    if (Math.hypot(x - this.nearAt.x, y - this.nearAt.y) > 1500 || Math.abs(t - this.nearAt.t) > 20) {
      const [wu, wv] = this.windAloft();
      const reach = 6000 + 400 * Math.hypot(wu, wv);
      this.near = this.sources.filter((s) => Math.hypot(s.x - x, s.y - y) < reach);
      this.nearAt = { x, y, t };
    }
    return this.near;
  }

  /** Wind (m/s) the thermal crosses at height dz above its source: the site's profile, or the wind aloft. */
  private windAt(s: ThermalSource, dz: number, out: { u: number; v: number }): void {
    if (s.pu && s.pv) {
      const n = PROFILE_DZ.length;
      let i = 0;
      while (i < n - 2 && dz > PROFILE_DZ[i + 1]) i++;
      const f = clamp((dz - PROFILE_DZ[i]) / (PROFILE_DZ[i + 1] - PROFILE_DZ[i]), 0, 1);
      out.u = s.pu[i] + (s.pu[i + 1] - s.pu[i]) * f;
      out.v = s.pv[i] + (s.pv[i + 1] - s.pv[i]) * f;
      return;
    }
    const w = this.aloft();
    out.u = w.u;
    out.v = w.v;
  }

  /** Integral of that wind along the rise up to dz (m²/s), with the slope's hold low down. */
  private leanAt(s: ThermalSource, dz: number, out: { u: number; v: number }): void {
    if (s.iu && s.iv && s.pu && s.pv) {
      const n = PROFILE_DZ.length;
      if (dz >= PROFILE_DZ[n - 1]) {
        out.u = s.iu[n - 1] + s.pu[n - 1] * (dz - PROFILE_DZ[n - 1]);
        out.v = s.iv[n - 1] + s.pv[n - 1] * (dz - PROFILE_DZ[n - 1]);
        return;
      }
      let i = 0;
      while (i < n - 2 && dz > PROFILE_DZ[i + 1]) i++;
      const h = dz - PROFILE_DZ[i];
      const f = h / (PROFILE_DZ[i + 1] - PROFILE_DZ[i]);
      const ww = Math.max(0, this.windward(s));
      const hold = dz < 250 ? 1 - 0.7 * ww : 1;
      // Trapezoid from level i to dz.
      const um = s.pu[i] + (s.pu[i + 1] - s.pu[i]) * f * 0.5;
      const vm = s.pv[i] + (s.pv[i + 1] - s.pv[i]) * f * 0.5;
      out.u = s.iu[i] + um * h * hold;
      out.v = s.iv[i] + vm * h * hold;
      return;
    }
    const w = this.aloft();
    const ww = Math.max(0, this.windward(s));
    const l = dz < 250 ? dz * (1 - 0.7 * ww) : 250 * (1 - 0.7 * ww) + (dz - 250);
    out.u = w.u * l;
    out.v = w.v * l;
  }

  private tmpW = { u: 0, v: 0 };
  private tmpL = { u: 0, v: 0 };

  /** Fills `out` with the thermal of `s` at height z and time t; false when there is none. */
  private columnInto(s: ThermalSource, z: number, t: number, out: ColumnEx): boolean {
    const dz = z - s.ground;
    if (dz < 0) return false;
    const zi = Math.max(s.ground + 250, this.flatCeiling() + 0.35 * Math.max(0, s.terrain - 800));
    const base = this.cloudBase(s.terrain);
    const cumulus = base < zi;
    const top = cumulus ? base : zi;
    const cloudTop = cumulus ? zi + 300 + 1500 * this.instability * this.humidity : top;
    if (z > cloudTop) return false;
    const strength = this.strength(s);
    if (strength <= 0.05) return false;
    const torn = this.torn(s);
    const rise = Math.max(1.5, 0.9 * strength);
    const climb = Math.min(dz, top - s.ground);
    // The bubble at this height left the ground climb/rise seconds ago: its cycle and the sun then.
    const tRel = t - climb / rise;
    const act = this.cycle(s, tRel, torn) * (0.15 + 0.85 * this.sunAt(s, tRel));
    if (act <= 0.01) return false;
    // This bubble's own top (reachOf): the strong ones go to the base, the others stop below.
    const reach = s.cyc.reach;
    const full = reach >= 0.97;
    if (!full && dz > reach * (top - s.ground)) return false;
    const D = Math.max(200, top - s.ground);
    const zeta = Math.min(dz / D, 1);
    let f: number;
    if (z <= top) {
      f = (Math.cbrt(zeta + 0.03) * (1 - 1.1 * zeta)) / 0.457;
      if (!full) {
        // Topping out below the layer: it fades over its last fifth.
        f *= 1 - smoothstep(0.8, 1, dz / Math.max(100, reach * D));
      } else {
        // Under a cumulus the lift holds and strengthens up to the base; without, it dies at the inversion.
        f = cumulus ? Math.max(f, 0.75 + 0.35 * smoothstep(0.6, 1, zeta)) : f * (1 - smoothstep(0.82, 1, zeta)) + 0.15 * (1 - smoothstep(0.8, 1, zeta));
      }
    } else if (full) f = 0.9 * (1 - smoothstep(0.6, 1, (z - top) / Math.max(50, cloudTop - top)));
    else return false;
    const rc = Math.max(30, 0.102 * Math.cbrt(zeta) * (1 - 0.25 * zeta) * D) * s.size * (0.85 + 0.3 * s.weight) * (z > top ? 1.6 : 1);
    // Lean: the wind of each layer crossed during the rise; under the inversion the decelerating
    // top bends back against it (the column above 3/4 of the layer recedes).
    const bend = 0.75 * D;
    const dzl = dz <= bend ? dz : Math.max(0, bend - 0.6 * (Math.min(dz, D) - bend)) + Math.max(0, dz - D);
    this.leanAt(s, dzl, this.tmpL);
    this.windAt(s, dz, this.tmpW);
    const wsp = Math.hypot(this.tmpW.u, this.tmpW.v);
    const dxw = wsp > 0.3 ? this.tmpW.u / wsp : 1;
    const dyw = wsp > 0.3 ? this.tmpW.v / wsp : 0;
    const wf = smoothstep(1.5, 8, wsp);
    // In wind the core sits on the windward side of the column, where the sink is strongest too.
    const shift = 0.3 * rc * wf;
    out.cx = s.x + this.tmpL.u / rise - dxw * shift;
    out.cy = s.y + this.tmpL.v / rise - dyw * shift;
    out.rc = rc;
    // Strong wind breaks the column into separate bubbles rising and drifting (toroidal: more sink around).
    const bubble = smoothstep(16, 30, wsp * 3.6) * (1 - 0.5 * s.weight);
    out.bubble = bubble;
    out.lambda = Math.max(120, 2.5 * rc);
    out.rise = rise;
    out.w = strength * clamp(f, 0, 1.15) * act;
    out.top = cloudTop;
    out.dx = dxw;
    out.dy = dyw;
    out.wf = wf;
    out.sUp = 1 - 0.3 * wf;
    out.sDown = 1 + 0.7 * wf;
    out.torn = torn;
    // Sharp edges on unstable days, strong thermals; torn lee thermals are ragged instead.
    const sharp = clamp(1.3 * this.instability - 0.25, 0, 1) * clamp(strength / 2.5, 0, 1) * s.edge * (1 - 0.6 * torn);
    out.sharp = clamp(sharp, 0, 1);
    out.cumulus = cumulus;
    out.base = base;
    // Mass: a share of the core's flux comes down in the ring (Allen: mostly in the upper half),
    // the rest in a broad sink around the thermal.
    const multi = s.cores.length > 1;
    // Flux of the core profile (dome × edge wall) relative to a Gaussian: 0.83 with a sharp wall, ~1 smooth.
    const kn = 0.83 + 0.17 * (1 - out.sharp);
    const coreFlux = out.w * Math.PI * rc * rc * kn * (multi ? 0.45 : 1) * (0.5 * (out.sUp + out.sDown));
    const fr = (0.3 + 0.5 * smoothstep(0.3, 0.8, zeta)) * (1 + 0.6 * bubble);
    const fRing = Math.min(0.85, fr);
    // Ring at 1.7 rc, 0.5 rc wide: ∫ exp(-((q-1.7)/0.5)²) 2πq dq ≈ 9.47.
    out.ringA = (fRing * coreFlux) / (9.47 * rc * rc);
    out.ringUp = 0.6 * wf;
    out.envFlux = (1 - fRing) * coreFlux;
    out.envSigma = Math.max(500, 5 * rc);
    // Continuity: where the lift grows with height, air flows in at the base; under the top it spreads out.
    if (zeta < 0.6 && z <= top) {
      const zc = zeta + 0.03;
      const fRaw = Math.cbrt(zc) * (1 - 1.1 * zeta);
      const dRaw = (1 - 1.1 * zeta) / (3 * Math.cbrt(zc * zc)) - 1.1 * Math.cbrt(zc);
      out.inflow = clamp((0.74 * dRaw * rc) / (Math.max(0.05, fRaw) * D), -0.4, 0.4);
    } else out.inflow = 0;
    return true;
  }

  /** Thermal at height z: axis (drifted with the wind), core radius, lift (m/s). */
  column(s: ThermalSource, z: number, t: number): Column | null {
    const c = this.colTmp;
    if (!this.columnInto(s, z, t, c)) return null;
    return { cx: c.cx, cy: c.cy, rc: c.rc, w: c.w, top: c.top };
  }
  private colTmp = newColumnEx();

  // --- Pilot-local cache: the thermals, air holes and convergences around one point, so the
  // centre and both tips are sampled for the price of a few exponentials.
  private prep = { x: 1e12, y: 1e12, z: -1e9, t: -1e9 };
  private nearPool: NearThermal[] = [];
  private nearCount = 0;
  private envW = 0;
  private pocketPool: Pocket[] = [];
  private pocketCount = 0;
  private convSegs: { ax: number; ay: number; bx: number; by: number; wc: number }[] = [];
  private colB = newColumnEx();

  /** Rebuilds the cache around (x, y, z) at time t (≈ 10 times a second in flight). */
  prepare(x: number, y: number, z: number, t: number): void {
    this.prep.x = x;
    this.prep.y = y;
    this.prep.z = z;
    this.prep.t = t;
    this.nearCount = 0;
    this.envW = 0;
    for (const s of this.nearby(x, y, t)) {
      const ddx = s.x - x;
      const ddy = s.y - y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 > ENV_R * ENV_R * 1.6) continue;
      if (this.nearCount >= this.nearPool.length) this.nearPool.push({ s, c: newColumnEx(), z0: 0, lx: 0, ly: 0 });
      const slot = this.nearPool[this.nearCount];
      if (!this.columnInto(s, z, t, slot.c)) continue;
      const c = slot.c;
      // Broad sink returning the rest of the flux, spread around the axis (it scales with how many thermals work around).
      const ex = c.cx - x;
      const ey = c.cy - y;
      const e2 = ex * ex + ey * ey;
      if (e2 < 9 * c.envSigma * c.envSigma) this.envW -= (c.envFlux / (2 * Math.PI * c.envSigma * c.envSigma)) * Math.exp(-e2 / (2 * c.envSigma * c.envSigma));
      if (e2 > NEAR_R * NEAR_R) continue;
      slot.s = s;
      slot.z0 = z;
      // Lean around this height, for the tips and the next few metres of climb.
      if (this.columnInto(s, z + 10, t, this.colB)) {
        slot.lx = (this.colB.cx - c.cx) / 10;
        slot.ly = (this.colB.cy - c.cy) / 10;
      } else {
        slot.lx = 0;
        slot.ly = 0;
      }
      this.nearCount++;
    }
    this.preparePockets(x, y, z, t);
    // Documented convergences within reach, during their hours.
    this.convSegs.length = 0;
    const wc = 0.5 + 0.9 * this.instability;
    for (const c of this.convergences) {
      if (this.hour < c.start || this.hour > c.end) continue;
      for (let i = 1; i < c.pts.length; i++) {
        const [ax, ay] = c.pts[i - 1];
        const [bx, by] = c.pts[i];
        if (Math.min(ax, bx) - 2500 > x || Math.max(ax, bx) + 2500 < x || Math.min(ay, by) - 2500 > y || Math.max(ay, by) + 2500 < y) continue;
        this.convSegs.push({ ax, ay, bx, by, wc });
      }
    }
  }

  private needsPrepare(x: number, y: number, z: number, ground: number, t: number): boolean {
    const p = this.prep;
    const zTol = Math.max(5, 0.12 * (z - ground));
    return t - p.t > 0.1 || t < p.t || Math.abs(x - p.x) > 600 || Math.abs(y - p.y) > 600 || Math.abs(z - p.z) > zTol;
  }

  /**
   * Air holes and small bubbles: procedural (a hash per 3D cell of 450 × 450 × 300 m
   * drifting with the air), so there is nothing to store and they are everywhere.
   */
  private preparePockets(x: number, y: number, z: number, t: number): void {
    const ad = this.advection(t);
    const px = x - ad.x;
    const py = y - ad.y;
    const C = 450;
    const H = 300;
    const ci = Math.floor(px / C);
    const cj = Math.floor(py / C);
    const ck = Math.floor(z / H);
    const day = smoothstep(0.1, 0.6, this.dayFactor() * this.season);
    const inst = this.instability;
    const seed = this.scenario.seed;
    this.pocketCount = 0;
    for (let dk = -1; dk <= 1; dk++)
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const i = ci + di;
          const j = cj + dj;
          const k = ck + dk;
          const kind = hashU(i, j, k, seed);
          const pSink = 0.16 + 0.22 * inst;
          const pBubble = 0.12 + 0.35 * inst;
          let amp: number;
          let rad: number;
          let life: number;
          if (kind < pSink) {
            amp = -(1.2 + 2.6 * inst * hashU(i, j, k, seed + 1)) * day;
            rad = 35 + 60 * hashU(i, j, k, seed + 2);
            life = 120 + 180 * hashU(i, j, k, seed + 3);
          } else if (kind < pSink + pBubble) {
            amp = (0.8 + 2.0 * inst * hashU(i, j, k, seed + 1)) * day;
            rad = 14 + 18 * hashU(i, j, k, seed + 2);
            life = 50 + 90 * hashU(i, j, k, seed + 3);
          } else continue;
          if (amp === 0) continue;
          // A short life, then it reappears elsewhere in its cell.
          const ph0 = hashU(i, j, k, seed + 4) * 7;
          const gen = Math.floor(t / life + ph0);
          const fx = (i + 0.15 + 0.7 * hashU(i * 7 + gen, j * 13 - gen, k, seed + 11)) * C;
          const fy = (j + 0.15 + 0.7 * hashU(i * 7 + gen, j * 13 - gen, k, seed + 12)) * C;
          const fz = (k + 0.2 + 0.6 * hashU(i * 7 + gen, j * 13 - gen, k, seed + 13)) * H;
          if (this.pocketCount >= this.pocketPool.length) this.pocketPool.push({ fx: 0, fy: 0, fz: 0, amp: 0, rad: 0, life: 0, ph0: 0 });
          const p = this.pocketPool[this.pocketCount++];
          p.fx = fx;
          p.fy = fy;
          p.fz = fz;
          p.amp = amp;
          p.rad = rad;
          p.life = life;
          p.ph0 = ph0;
        }
  }

  /** Mean vertical flux of the air holes and bubbles (m/s): removed from the field so it conserves mass. */
  private pocketMean(): number {
    const day = smoothstep(0.1, 0.6, this.dayFactor() * this.season);
    const inst = this.instability;
    // Each pocket carries amp·rad³·(5√π)/(H·C²) on average over its cell (Gaussian, 2.5× taller than wide, sine life).
    const k = (5 * Math.sqrt(Math.PI)) / (300 * 450 * 450);
    const sink = (0.16 + 0.22 * inst) * -(1.2 + 1.3 * inst) * 333125 * k;
    const bubble = (0.12 + 0.35 * inst) * (0.8 + 1.0 * inst) * 14030 * k;
    return (sink + bubble) * day;
  }

  /** Vertical air speed at a point, thermals + sink + convergences (without the relief's own lift). */
  vertical(x: number, y: number, z: number, ground: number, t: number): VerticalAir {
    const out: VerticalAir = { w: 0, shear: 0, cloud: 0, u: 0, v: 0 };
    this.sampleInto(x, y, z, ground, t, out);
    return out;
  }

  /**
   * Fills `out` with the air of the air mass at a point (no allocation): thermals with their
   * ring, the broad sink that balances them, the background over relief and valleys, air
   * holes and bubbles, documented convergences (lift line and the breezes meeting there).
   */
  sampleInto(x: number, y: number, z: number, ground: number, t: number, out: VerticalAir): void {
    if (this.needsPrepare(x, y, z, ground, t)) this.prepare(x, y, z, t);
    let w = 0;
    let shear = 0;
    let cloud = 0;
    let u = 0;
    let v = 0;
    const tp = this.prep.t;
    for (let n = 0; n < this.nearCount; n++) {
      const slot = this.nearPool[n];
      const c = slot.c;
      const s = slot.s;
      const cx = c.cx + slot.lx * (z - slot.z0);
      const cy = c.cy + slot.ly * (z - slot.z0);
      const px = x - cx;
      const py = y - cy;
      const r2 = px * px + py * py;
      const reach = 4.5 * c.rc * c.sDown;
      if (r2 > reach * reach) continue;
      const r = Math.sqrt(r2);
      // Bubbles around the axis, each a smaller core; torn thermals scatter them more.
      const multi = s.cores.length > 1;
      const coreR = c.rc * (multi ? 0.6 : 1);
      let lift = 0;
      // The edge: a wall whose thickness goes from ~5 m (unstable day, strong thermal) to a
      // smooth Gaussian-like decay, on an irregular boundary.
      const delta = 5 + (1 - c.sharp) * (1 - c.sharp) * (0.6 * coreR - 5);
      const edgeK = coreR / delta;
      for (const k of s.cores) {
        const a = k.ang + k.spin * tp;
        const off = k.off * (1 + c.torn) * c.rc;
        let qx = px - Math.cos(a) * off;
        let qy = py - Math.sin(a) * off;
        if (s.elong > 1.05) {
          // A stretched core (same area): along its long axis it reaches farther, across less.
          const l = (qx * s.ex + qy * s.ey) / Math.sqrt(s.elong);
          const h = (-qx * s.ey + qy * s.ex) * Math.sqrt(s.elong);
          qx = l * s.ex - h * s.ey;
          qy = l * s.ey + h * s.ex;
        }
        const along = qx * c.dx + qy * c.dy;
        const across = -qx * c.dy + qy * c.dx;
        const sa = (along < 0 ? c.sUp : c.sDown) * coreR;
        const q2 = (along * along) / (sa * sa) + (across * across) / (coreR * coreR);
        if (q2 > 9) continue;
        const th = Math.atan2(qy, qx);
        const qe = 1 + 0.1 * Math.sin(3 * th + s.id + 0.02 * tp) + 0.06 * Math.sin(5 * th - 0.7 * s.id);
        lift += k.share * Math.exp(-0.384 * q2) * 0.5 * (1 - Math.tanh((Math.sqrt(q2) - qe) * edgeK));
      }
      // Strong wind: the column is a train of bubbles rising through this height.
      let train = 1;
      if (c.bubble > 0.01) {
        const ph = Math.cos((2 * Math.PI * (z - c.rise * t)) / c.lambda + s.id);
        train = 1 - c.bubble + c.bubble * (0.25 + 2.4 * Math.max(0, ph) ** 1.5);
      }
      const q = r / c.rc;
      // Ring of sink, stronger on the windward side.
      const cosUp = r > 1e-3 ? -(px * c.dx + py * c.dy) / r : 0;
      const ring = c.ringA * (1 + c.ringUp * cosUp) * Math.exp(-(((q - 1.7) / 0.5) ** 2));
      w += c.w * lift * train - ring * (1 + 0.5 * c.bubble * (train - 1));
      // The edge: shear between the rising core and the air around it, sharper on unstable days.
      shear += Math.abs(c.w) * (0.1 + 0.25 * c.torn + 0.35 * c.sharp) * Math.exp(-(((q - 1.15) / 0.45) ** 2));
      // Inflow towards the axis low in the column (outflow under its top).
      if (r > 1) {
        const k = (c.inflow * c.w * q * Math.exp(-q * q)) / r;
        u -= px * k;
        v -= py * k;
      }
      if (c.cumulus && z > c.base && q < 2.2) cloud = Math.max(cloud, smoothstep(2.2, 1.2, q) * smoothstep(c.base, c.base + 60, z));
    }
    // The broad sink balancing the thermals around, and the air holes' mean.
    const zi = this.ceilingAt(x, y, ground);
    const below = z < zi ? 1 : smoothstep(zi + 300, zi, z);
    w += (this.envW - this.pocketMean()) * below;
    // Background of convection: lifting over sunny relief, sinking over the valleys (zero mean).
    if (this.background) {
      const zeta = (z - ground) / Math.max(200, zi - ground);
      if (zeta > 0 && zeta < 1.1) {
        const prof = 1.9 * Math.cbrt(Math.min(1, zeta)) * Math.max(0, 1 - 0.9 * zeta);
        w += 0.9 * this.wStar() * sampleGrid(this.background, x, y) * prof * smoothstep(0.1, 0.6, this.dayFactor() * this.season);
      }
    }
    // Air holes and small bubbles.
    if (this.pocketCount) {
      const ad = this.advection(t);
      const px = x - ad.x;
      const py = y - ad.y;
      for (let n = 0; n < this.pocketCount; n++) {
        const p = this.pocketPool[n];
        const ddx = px - p.fx;
        const ddy = py - p.fy;
        const ddz = (z - p.fz) / 2.5;
        const q2 = (ddx * ddx + ddy * ddy + ddz * ddz) / (p.rad * p.rad);
        if (q2 > 9) continue;
        const cyc = t / p.life + p.ph0;
        const env = Math.sin(Math.PI * (cyc - Math.floor(cyc)));
        w += p.amp * Math.exp(-q2) * env;
        shear += Math.abs(p.amp) * 0.12 * Math.exp(-(((Math.sqrt(q2) - 1) / 0.6) ** 2)) * env;
      }
    }
    // Documented convergences: a lift line where the breezes meet (returned by sink on both
    // sides), and the breezes themselves flowing in from either side near the ground.
    if (this.convSegs.length && z < zi + 200) {
      let best = 1e12;
      let nx = 0;
      let ny = 0;
      let sd = 0;
      let wc = 0;
      for (const sg of this.convSegs) {
        const dx = sg.bx - sg.ax;
        const dy = sg.by - sg.ay;
        const l2 = dx * dx + dy * dy;
        const tt = l2 > 0 ? clamp(((x - sg.ax) * dx + (y - sg.ay) * dy) / l2, 0, 1) : 0;
        const ex = x - sg.ax - tt * dx;
        const ey = y - sg.ay - tt * dy;
        const d2 = ex * ex + ey * ey;
        if (d2 < best) {
          best = d2;
          const l = Math.sqrt(l2) || 1;
          // Left normal of the segment and the signed distance to it.
          nx = -dy / l;
          ny = dx / l;
          sd = ex * nx + ey * ny;
          wc = sg.wc;
        }
      }
      const d = Math.abs(sd);
      if (d < 3000) {
        const hz = 1 - smoothstep(0.8 * zi, zi, z);
        w += wc * (Math.exp(-((d / 280) ** 2)) - 0.35 * Math.exp(-(((d - 1000) / 400) ** 2))) * hz;
        const agl = z - ground;
        const inflow = 0.8 * wc * Math.tanh(sd / 200) * Math.exp(-((sd / 1600) ** 2)) * (1 - smoothstep(150, 450, agl));
        u -= nx * inflow;
        v -= ny * inflow;
        shear += 0.15 * wc * Math.exp(-((d / 250) ** 2));
      }
    }
    out.w = w;
    out.shear = clamp(shear, 0, 1);
    out.cloud = cloud;
    out.u = u;
    out.v = v;
  }

  /** Convective turbulence (Lenschow et al. 1980): σw at height z and the eddy size; the thermals carry the rest. */
  convectiveSigma(z: number, ground: number, x: number, y: number, out = { sigma: 0, length: 0, zi: 0 }): { sigma: number; length: number; zi: number } {
    const zi = this.ceilingAt(x, y, ground);
    const zr = clamp((z - ground) / Math.max(200, zi - ground), 0, 1.2);
    // Deardorff's w* is a bit below the game's thermal scale (their best cores).
    const ws = 0.7 * this.wStar() * this.convection();
    const s = zr < 1 ? Math.sqrt(1.8) * ws * Math.cbrt(zr) * (1 - 0.8 * zr) : Math.sqrt(1.8) * ws * 0.2 * Math.max(0, 1 - (zr - 1) / 0.2);
    out.sigma = s;
    out.length = clamp(1.5 * (z - ground), 30, Math.max(30, 0.4 * (zi - ground)));
    out.zi = zi;
    return out;
  }

  /**
   * Turbulence as a frozen field carried by the air (Taylor's hypothesis): unit-variance
   * noise of three octaves (a spectrum close to k^-5/3) scaled by the σ and the eddy sizes
   * of the turbulence model (horizontal eddies longer than vertical ones), plus a small-eddy
   * part (`sigX`, `Lx`: thermal edges, rotors, shear layers). Sampled at the wing tips it
   * rolls the wing when one side meets an eddy, as it really does.
   */
  turbInto(x: number, y: number, z: number, t: number, sigU: number, sigW: number, Lu: number, Lw: number, sigX: number, Lx: number, out: { u: number; v: number; w: number }, wOnly = false, sigE = 0): void {
    const ad = this.advection(t);
    const px = x - ad.x;
    const py = y - ad.y;
    const seed = this.scenario.seed;
    // Slow evolution of the eddies themselves (Taylor's hypothesis is only approximate).
    const ev = t * 0.02;
    let w = sigW * atScale(fractal, px, py, z, Lw, 0.8, ev, seed);
    if (sigX > 0.01) w += sigX * (atScale(vnoise, px, py, z, Lx, 1, ev * 4, seed + 101) * 2.7);
    // The thin shear layer at a thermal's edge: eddies of ~10 m, the sharp edges that fold a wing.
    if (sigE > 0.01) w += sigE * (vnoise(px / EDGE_L, py / EDGE_L, z / EDGE_L + ev * 8, seed + 211) * 2.7);
    out.w = w;
    if (wOnly) return;
    out.u = sigU * atScale(fractal, px, py, z, Lu, 0.5, ev, seed + 7) + (sigX > 0.01 ? 0.8 * sigX * atScale(vnoise, px, py, z, Lx, 1, 0, seed + 103) * 2.7 : 0);
    out.v = sigU * atScale(fractal, px, py, z, Lu, 0.5, ev, seed + 13) + (sigX > 0.01 ? 0.8 * sigX * atScale(vnoise, px, py, z, Lx, 1, 0, seed + 107) * 2.7 : 0);
  }

  /** Former API: turbulence from an intensity 0..1 (σ and eddy size from the height above the ground). */
  turbulenceAt(x: number, y: number, z: number, t: number, agl: number, intensity: number): { u: number; v: number; w: number } {
    const out = { u: 0, v: 0, w: 0 };
    const L = clamp(agl * 0.8, 30, 260);
    // The former field's amplitude: σ ≈ 0.59 × (0.1 + 0.85 I) vertically.
    this.turbInto(x, y, z, t, 0.59 * (0.15 + 1.1 * intensity), 0.59 * (0.1 + 0.85 * intensity), 1.6 * L, L, 0, 20, out);
    return out;
  }

  /**
   * Shade on the sources: the sunlight reaching each source through the cumulus (the same
   * geometry as the sky's), followed with the ground's thermal lag (a few minutes to cool
   * under a cloud, longer to heat up again) and kept as a history, since a bubble high in a
   * column left the ground minutes ago. Call about once a second (game time `t`).
   */
  updateShade(sunAzimuthDeg: number, sunElevationDeg: number, t: number, dt: number, px: number, py: number): void {
    const el = (sunElevationDeg * Math.PI) / 180;
    const az = (sunAzimuthDeg * Math.PI) / 180;
    this.sunVec.x = Math.cos(el) * Math.sin(az);
    this.sunVec.y = Math.cos(el) * Math.cos(az);
    this.sunVec.z = Math.sin(el);
    const push = t - this.shadeT >= SHADE_STEP;
    for (const s of this.sources) {
      if (Math.abs(s.x - px) > 16000 || Math.abs(s.y - py) > 16000) continue;
      const light = this.lightAt(s.x, s.y, s.ground + 5);
      // The ground cools in ~2–3 min under a cloud and needs ~4 min to heat up again.
      const tau = light < s.sun ? 150 : 240;
      s.sun += (light - s.sun) * Math.min(1, dt / tau);
      if (push) {
        s.sunHist.copyWithin(1, 0, SHADE_N - 1);
        s.sunHist[0] = s.sun;
      }
    }
    if (push) this.shadeT = t;
  }

  /** Direct sunlight now at a point of the ground through the cumulus (0..1; 0.3 with the sun down). */
  lightAt(x: number, y: number, z: number): number {
    const { x: sx, y: sy, z: sz } = this.sunVec;
    if (sz <= 0.02) return 0.3;
    let light = 1;
    for (const c of this.lastClouds) {
      if (z > c.top) continue;
      const mid = Math.max(z, (c.base + c.top) / 2);
      const tt = (mid - z) / sz;
      const d = Math.hypot(x + sx * tt - c.x, y + sy * tt - c.y) / (c.radius * 0.85);
      if (d < 1.2) light *= 1 - 0.8 * c.size * (1 - smoothstep(0.6, 1.2, d));
    }
    return light;
  }

  /** Cumulus of the active thermals within `range` of a point. */
  clouds(x: number, y: number, t: number, range = 16000): CloudInfo[] {
    const out: CloudInfo[] = [];
    for (const s of this.sources) {
      if (Math.abs(s.x - x) > range || Math.abs(s.y - y) > range) continue;
      const base = this.cloudBase(s.terrain);
      const zi = Math.max(s.ground + 250, this.flatCeiling() + 0.35 * Math.max(0, s.terrain - 800));
      if (base >= zi) continue;
      const strength = this.strength(s);
      if (strength < 0.4) continue;
      const rise = Math.max(1.5, 0.9 * strength);
      const lag = (base - s.ground) / rise;
      const torn = this.torn(s);
      // The cloud grows while the bubbles arrive and dissolves a few minutes after they stop;
      // bubbles from a shaded source are weak.
      // Only the bubbles that reach the base build the cloud (reachOf).
      const feed = (tt: number) => {
        const c = this.cycle(s, tt, torn);
        return s.cyc.reach >= 0.97 ? c * (0.15 + 0.85 * this.sunAt(s, tt)) : 0;
      };
      const size = Math.min(1, Math.max(feed(t - lag), 0.6 * feed(t - lag - 180), 0.25 * feed(t - lag - 360)));
      if (size < 0.08) continue;
      // The cumulus sits on the column's top, bent back under the inversion like the column.
      this.leanAt(s, 0.6 * (base - s.ground), this.tmpL);
      const top = base + (zi + 300 + 1500 * this.instability * this.humidity - base) * (0.4 + 0.6 * size);
      out.push({ x: s.x + this.tmpL.u / rise, y: s.y + this.tmpL.v / rise, base, top, radius: (250 + 500 * Math.min(1, strength / 3)) * (0.5 + 0.5 * size) * (0.8 + 0.3 * s.size), size, seed: s.phase });
    }
    this.lastClouds = out;
    return out;
  }
}
