/**
 * The air the pilot flies in, beyond the mean wind of the model: individual thermals,
 * their cumulus, the sink between them, the documented convergences and the gusts.
 *
 * Thermals are placed where the site's model puts the thermal potential (sun on the
 * slope, convexity, height…) and where documented or measured (kk7) thermals are, and
 * each one breathes: bubbles released in cycles of 10–20 min rise at a few m/s, so a
 * thermal starts at the bottom and cuts from the bottom too. Their shape follows the
 * updraft model used for soaring research (Allen, 2006, NASA TM-2006-213475): radius
 * growing with height, peak lift in the lower third of the convective layer, a ring of
 * sink around the core. On top of that, what makes a real thermal hard to centre:
 * - sizes differ: narrow punchy cores and wide soft ones;
 * - the lift is not one smooth bell but two or three bubbles drifting around the axis;
 * - wind stretches the column downwind and leans it with height (the bubbles rise a few
 *   m/s while the wind carries them);
 * - on a slope facing the wind the thermal hugs the relief and mixes with the dynamic
 *   lift; in the lee it is torn: weaker, shorter-lived, scattered, turbulent.
 * Above the condensation level the thermal feeds a cumulus and the lift strengthens
 * under its base (cloud suck).
 */
import type { PotentialGrid } from './game-client';
import { LocalFrame, segmentDistance } from './geo';

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
}

export interface Column {
  cx: number;
  cy: number;
  rc: number;
  w: number;
  top: number;
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

/** Smooth 3D value noise in [-1, 1]. */
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
  const h = (i: number, j: number, k: number) => {
    let n = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683) ^ Math.imul(seed, 1274126177)) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 2147483648 - 1;
  };
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(h(ix, iy, iz), h(ix + 1, iy, iz), sx), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), sx), sy),
    l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), sx), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), sx), sy),
    sz,
  );
}

/** Five pseudo-random numbers in [0, 1) for an integer cell. */
function hash3(i: number, j: number, k: number, seed: number): [number, number, number, number, number] {
  let h = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ Math.imul(seed, 1274126177)) >>> 0;
  const out: number[] = [];
  for (let n = 0; n < 5; n++) {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    out.push(h / 4294967296);
  }
  return out as [number, number, number, number, number];
}
function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

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
  private gust = { w: 0, u: 0, v: 0 };
  private slow = { w: 0, u: 0, v: 0 };
  private fast = { w: 0, u: 0, v: 0 };
  /** Values the random weather drifts around. */
  private mean: { windKmh: number; instability: number; humidity: number };

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

  /** Top of the convection (inversion), m above sea level, over ground at `ground` m. */
  ceiling(ground: number): number {
    const flat = 900 + (800 + 2200 * this.instability) * (0.4 + 0.6 * this.season) * this.dayFactor();
    return Math.max(ground + 250, flat + 0.35 * Math.max(0, ground - 800));
  }

  /** Condensation level (cloud base), m above sea level. */
  cloudBase(ground: number): number {
    return 1200 + (1 - this.humidity) * 2800 + 0.25 * Math.max(0, ground - 800);
  }

  windAloft(): [number, number] {
    const r = (this.windFrom * Math.PI) / 180;
    const s = (this.windKmh / 3.6) * 0.85;
    return [-Math.sin(r) * s, -Math.cos(r) * s];
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

  private makeSource(x: number, y: number, ground: number, weight: number, potential: number, aspect: number, slope: number, lee: number, name?: string): ThermalSource {
    const r = this.rng;
    const n = 1 + Math.floor(r() * 2.6);
    const cores: Core[] = [];
    for (let i = 0; i < n; i++) cores.push({ off: n === 1 ? 0.15 * r() : 0.25 + 0.4 * r(), ang: r() * Math.PI * 2, spin: (r() - 0.5) * 0.03, share: 0.6 + 0.8 * r() });
    const total = cores.reduce((a, c) => a + c.share, 0);
    for (const c of cores) c.share /= total / (n === 1 ? 1 : 1.25);
    // Not every trigger works every day: documented ones are reliable, the others a coin
    // toss; a "dud" still bubbles weakly. Sizes: mostly modest, sometimes a big one.
    const works = r() < 0.5 + 0.5 * weight;
    return { x, y, ground, weight, potential, aspect, slope, lee, base: (works ? 0.75 + 0.5 * r() : 0.15 + 0.2 * r()), size: 0.5 + r() * r() * 1.6, period: 540 + 720 * r(), phase: r(), active: 0.4 + 0.3 * r(), cores, name };
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
    maxima.sort((a, b) => b.v - a.v);
    for (const m of maxima) {
      const x = xs[m.i];
      const y = ys[m.j];
      if (cand.some((c) => Math.hypot(c.x - x, c.y - y) < 750)) continue;
      const c = at(m.i, m.j);
      cand.push(this.makeSource(x, y, elevation[c], 0.25 + 0.5 * m.v, m.v, aspect[c], slope[c], lee[c]));
      if (cand.length > 320) break;
    }
    this.sources = cand;
    this.placedAt = { x: cx, y: cy };
    this.nearAt.t = -1e9;
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

  /** Bubble release cycle of a source: 0..1. Torn lee thermals release shorter, irregular bubbles. */
  private cycle(s: ThermalSource, t: number, torn: number): number {
    const active = s.active * (1 - 0.35 * torn);
    const u = (((t / (s.period * (1 - 0.4 * torn)) + s.phase) % 1) + 1) % 1;
    return smoothstep(0, 0.08, u) * (1 - smoothstep(active - 0.08, active, u));
  }

  /** How torn a thermal is by the wind in the lee (0..1). */
  private torn(s: ThermalSource): number {
    return clamp(Math.max(s.lee, -this.windward(s)) * this.windF(), 0, 1);
  }

  /** Peak lift of a source now, before the vertical profile (m/s). */
  strength(s: ThermalSource): number {
    const wf = this.windF();
    // Narrow thermals punch harder, wide ones are soft; the wind on a windward face feeds
    // it, in the lee it is torn; a strong wind shears the weak ones apart.
    const wind = 1 + 0.15 * Math.max(0, this.windward(s)) * wf - 0.4 * this.torn(s) - 0.25 * wf * (1 - s.weight);
    return this.wStar() * (0.45 + 0.85 * s.weight) * s.base * (1.25 - 0.3 * s.size) * wind * smoothstep(0.08, 0.45, s.potential);
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

  /** Thermal at height z: axis (drifted with the wind), core radius, lift (m/s). */
  column(s: ThermalSource, z: number, t: number): Column | null {
    const dz = z - s.ground;
    if (dz < 0) return null;
    const zi = this.ceiling(s.ground);
    const base = this.cloudBase(s.ground);
    const cumulus = base < zi;
    const top = cumulus ? base : zi;
    const cloudTop = cumulus ? zi + 300 + 1500 * this.instability * this.humidity : top;
    if (z > cloudTop) return null;
    const strength = this.strength(s);
    if (strength <= 0.05) return null;
    const torn = this.torn(s);
    const rise = Math.max(1.5, 0.9 * strength);
    const [wu, wv] = this.windAloft();
    // Lean: the bubbles drift with the wind while they rise. On a windward face they stick
    // to the slope for the first couple of hundred metres before leaving the relief.
    const ww = Math.max(0, this.windward(s));
    const lean = dz < 250 ? dz * (1 - 0.7 * ww) : 250 * (1 - 0.7 * ww) + (Math.min(dz, top - s.ground) - 250);
    const lag = Math.max(0, lean) / rise;
    const act = this.cycle(s, t - Math.min(dz, top - s.ground) / rise, torn);
    if (act <= 0.01) return null;
    const D = Math.max(200, top - s.ground);
    const zeta = Math.min(dz / D, 1);
    let f: number;
    if (z <= top) {
      f = (Math.cbrt(zeta + 0.03) * (1 - 1.1 * zeta)) / 0.457;
      // Under a cumulus the lift holds and strengthens up to the base; without, it dies at the inversion.
      f = cumulus ? Math.max(f, 0.75 + 0.35 * smoothstep(0.6, 1, zeta)) : f * (1 - smoothstep(0.82, 1, zeta)) + 0.15 * (1 - smoothstep(0.8, 1, zeta));
    } else f = 0.9 * (1 - smoothstep(0.6, 1, (z - top) / Math.max(50, cloudTop - top)));
    const rc = Math.max(30, 0.102 * Math.cbrt(zeta) * (1 - 0.25 * zeta) * D) * s.size * (0.85 + 0.3 * s.weight) * (z > top ? 1.6 : 1);
    return { cx: s.x + wu * lag, cy: s.y + wv * lag, rc, w: strength * clamp(f, 0, 1.15) * act, top: cloudTop };
  }

  /** Vertical air speed at a point, thermals + sink + convergences (without the relief's own lift). */
  vertical(x: number, y: number, z: number, ground: number, t: number): VerticalAir {
    let w = 0;
    let shear = 0;
    let cloud = 0;
    const [wu, wv] = this.windAloft();
    const ws = Math.hypot(wu, wv);
    // Unit vector downwind: the cores are stretched along it.
    const dx = ws > 0.3 ? wu / ws : 1;
    const dy = ws > 0.3 ? wv / ws : 0;
    const stretch = 1 + 0.6 * this.windF();
    for (const s of this.nearby(x, y, t)) {
      const c = this.column(s, z, t);
      if (!c) continue;
      const r = Math.hypot(x - c.cx, y - c.cy);
      if (r > 4 * c.rc * stretch) continue;
      const torn = this.torn(s);
      // Bubbles around the axis, each a smaller core; torn thermals scatter them more.
      const multi = s.cores.length > 1;
      const coreR = c.rc * (multi ? 0.6 : 1);
      let lift = 0;
      for (const k of s.cores) {
        const a = k.ang + k.spin * t;
        const off = k.off * (1 + torn) * c.rc;
        const px = x - (c.cx + Math.cos(a) * off);
        const py = y - (c.cy + Math.sin(a) * off);
        const along = (px * dx + py * dy) / stretch;
        const across = -px * dy + py * dx;
        const q2 = (along * along + across * across) / (coreR * coreR);
        lift += k.share * Math.exp(-q2);
      }
      const q = r / c.rc;
      w += c.w * (lift - 0.22 * Math.exp(-(((q - 2) / 0.8) ** 2)));
      shear += Math.abs(c.w) * (0.12 + 0.25 * torn) * Math.exp(-(((q - 1.2) / 0.7) ** 2));
      const base = this.cloudBase(s.ground);
      if (base < this.ceiling(s.ground) && z > base && r < c.rc * 2.2) cloud = Math.max(cloud, smoothstep(c.rc * 2.2, c.rc * 1.2, r) * smoothstep(base, base + 60, z));
    }
    // Compensating sink between the thermals, stronger on unstable days.
    const zi = this.ceiling(ground);
    const below = z < zi ? 1 : smoothstep(zi + 300, zi, z);
    w -= (0.08 + 0.05 * this.wStar()) * below * smoothstep(0.1, 0.6, this.dayFactor() * this.season);
    // Small features of the air mass: air holes (sharp sink a few dozen metres wide) and
    // bubbles too small to circle in, drifting with the wind.
    const pf = this.pockets(x, y, z, t);
    w += pf.w;
    shear += pf.shear;
    // Documented convergences: a lift line where the breezes meet, during their hours.
    for (const c of this.convergences) {
      if (this.hour < c.start || this.hour > c.end || z > zi) continue;
      let d = 1e9;
      for (let i = 1; i < c.pts.length; i++) d = Math.min(d, segmentDistance(x, y, c.pts[i - 1][0], c.pts[i - 1][1], c.pts[i][0], c.pts[i][1]));
      if (d < 900) w += (0.5 + 0.9 * this.instability) * Math.exp(-((d / 280) ** 2));
    }
    return { w, shear: clamp(shear, 0, 1), cloud };
  }

  /** Gusts: a random process whose strength follows the turbulence (Ornstein–Uhlenbeck). */
  /**
   * Gusts: two random processes (Ornstein–Uhlenbeck), a slow one (~2.5 s, most of the
   * energy) and a fast small one (~0.4 s), whose strength follows the turbulence: calm air
   * is smooth, a lee or a thermal edge shakes.
   */
  gusts(dt: number, intensity: number): { u: number; v: number; w: number } {
    const g = this.gust;
    const n = () => (this.rng() + this.rng() + this.rng() - 1.5) * 2;
    const ou = (v: number, tau: number, sigma: number) => {
      const k = Math.exp(-dt / tau);
      return v * k + sigma * Math.sqrt(1 - k * k) * n();
    };
    const sw = 0.1 + 0.85 * intensity;
    const sh = 0.15 + 1.1 * intensity;
    this.slow.w = ou(this.slow.w, 2.5, sw * 0.95);
    this.slow.u = ou(this.slow.u, 3, sh * 0.95);
    this.slow.v = ou(this.slow.v, 3, sh * 0.95);
    this.fast.w = ou(this.fast.w, 0.4, sw * 0.3);
    this.fast.u = ou(this.fast.u, 0.5, sh * 0.3);
    this.fast.v = ou(this.fast.v, 0.5, sh * 0.3);
    g.w = this.slow.w + this.fast.w;
    g.u = this.slow.u + this.fast.u;
    g.v = this.slow.v + this.fast.v;
    return g;
  }

  /**
   * Turbulence as a frozen field carried by the wind (Taylor's hypothesis): eddies whose size
   * grows with the height above the ground (tens of metres low down, a few hundred higher),
   * three octaves for a spectrum falling roughly as k^-5/3. Sampled at the wing tips it rolls
   * the wing when one side meets an eddy, as it really does.
   */
  turbulenceAt(x: number, y: number, z: number, t: number, agl: number, intensity: number): { u: number; v: number; w: number } {
    const [wu, wv] = this.windAloft();
    const px = x - wu * t;
    const py = y - wv * t;
    const L = clamp(agl * 0.8, 30, 260);
    const sw = 0.1 + 0.85 * intensity;
    const sh = 0.15 + 1.1 * intensity;
    const seed = this.scenario.seed;
    let u = 0;
    let v = 0;
    let w = 0;
    let amp = 1;
    let l = L;
    for (let o = 0; o < 3; o++) {
      const qx = px / l;
      const qy = py / l;
      const qz = z / (l * 0.7);
      w += amp * vnoise(qx, qy, qz, seed + o * 31);
      u += amp * vnoise(qx + 17.3, qy, qz, seed + o * 31 + 7);
      v += amp * vnoise(qx, qy + 29.1, qz, seed + o * 31 + 13);
      amp *= 0.45;
      l /= 3;
    }
    // Normalise the sum of octaves (≈ unit variance) and scale.
    const k = 1.25;
    return { u: u * sh * k, v: v * sh * k, w: w * sw * k };
  }

  /**
   * Air holes and small bubbles: procedural (a hash per 3D cell of 450 × 450 × 300 m
   * drifting with the wind), so there is nothing to store and they are everywhere.
   */
  pockets(x: number, y: number, z: number, t: number): { w: number; shear: number } {
    const [wu, wv] = this.windAloft();
    const px = x - wu * t;
    const py = y - wv * t;
    const C = 450;
    const H = 300;
    const ci = Math.floor(px / C);
    const cj = Math.floor(py / C);
    const ck = Math.floor(z / H);
    let w = 0;
    let shear = 0;
    const day = smoothstep(0.1, 0.6, this.dayFactor() * this.season);
    const inst = this.instability;
    for (let dk = -1; dk <= 1; dk++)
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const i = ci + di;
          const j = cj + dj;
          const k = ck + dk;
          const h = hash3(i, j, k, this.scenario.seed);
          const kind = h[0];
          const pSink = 0.16 + 0.22 * inst;
          const pBubble = 0.12 + 0.35 * inst;
          let amp: number;
          let rad: number;
          let life: number;
          if (kind < pSink) {
            amp = -(1.2 + 2.6 * inst * h[1]) * day;
            rad = 35 + 60 * h[2];
            life = 120 + 180 * h[3];
          } else if (kind < pSink + pBubble) {
            amp = (0.8 + 2.0 * inst * h[1]) * day;
            rad = 14 + 18 * h[2];
            life = 50 + 90 * h[3];
          } else continue;
          // A short life, then it reappears elsewhere in its cell.
          const cyc = t / life + h[4] * 7;
          const gen = Math.floor(cyc);
          const ph = cyc - gen;
          const env = Math.sin(Math.PI * ph);
          const g = hash3(i * 7 + gen, j * 13 - gen, k, this.scenario.seed + 11);
          const fx = (i + 0.15 + 0.7 * g[0]) * C;
          const fy = (j + 0.15 + 0.7 * g[1]) * C;
          const fz = (k + 0.2 + 0.6 * g[2]) * H;
          const dx = px - fx;
          const dy = py - fy;
          const dz = (z - fz) / 2.5;
          const q2 = (dx * dx + dy * dy + dz * dz) / (rad * rad);
          if (q2 > 9) continue;
          const f = Math.exp(-q2) * env;
          w += amp * f;
          shear += Math.abs(amp) * 0.12 * Math.exp(-(((Math.sqrt(q2) - 1) / 0.6) ** 2)) * env;
        }
    return { w, shear };
  }

  /** Cumulus of the active thermals within `range` of a point. */
  clouds(x: number, y: number, t: number, range = 16000): CloudInfo[] {
    const out: CloudInfo[] = [];
    for (const s of this.sources) {
      if (Math.abs(s.x - x) > range || Math.abs(s.y - y) > range) continue;
      const base = this.cloudBase(s.ground);
      const zi = this.ceiling(s.ground);
      if (base >= zi) continue;
      const strength = this.strength(s);
      if (strength < 0.4) continue;
      const rise = Math.max(1.5, 0.9 * strength);
      const lag = (base - s.ground) / rise;
      const torn = this.torn(s);
      // The cloud grows while the bubbles arrive and dissolves a few minutes after they stop.
      const size = Math.max(this.cycle(s, t - lag, torn), 0.6 * this.cycle(s, t - lag - 180, torn), 0.25 * this.cycle(s, t - lag - 360, torn));
      if (size < 0.08) continue;
      const [wu, wv] = this.windAloft();
      const top = base + (zi + 300 + 1500 * this.instability * this.humidity - base) * (0.4 + 0.6 * size);
      out.push({ x: s.x + wu * lag, y: s.y + wv * lag, base, top, radius: (250 + 500 * Math.min(1, strength / 3)) * (0.5 + 0.5 * size) * (0.8 + 0.3 * s.size), size, seed: s.phase });
    }
    return out;
  }
}
