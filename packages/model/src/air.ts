/**
 * Layered air mass: the vertical structure of the air (wind, temperature, dew point by
 * altitude) from a forecast sounding or a manual preset, and what the model reads in it:
 * the synoptic wind at any altitude, the lapse rate of each layer, the stable layers and
 * inversions, the top of the convective layer (thermal ceiling) and the cumulus base.
 *
 * The per-cell functions work on a packed column (`packAir`) and are mirrored in
 * apps/web/src/gpu/model-glsl.ts (airWind, airTemp, airCeiling): keep both in sync.
 * Constants: `RULES.air`. Sources and choices: docs/METHODOLOGIE.md § 5.
 */
import type { ProfileLevel } from '@brises/shared';
import { windFromDeg, windVector } from './grid';
import { clamp } from './raster';
import { RULES } from './rules';

/** One level of the column: altitude (m AMSL), wind (east, north, m/s), temperature and dew point (°C). */
export interface AirLevel {
  z: number;
  u: number;
  v: number;
  t: number;
  td?: number | null;
}

export interface AirColumn {
  /** Levels sorted by altitude (at least 2, at most `AIR_LEVELS_MAX`). */
  levels: AirLevel[];
  /** Low and mid cloud cover 0..1 (forecast), none when absent (manual). */
  cloud?: number;
}

/** Most levels a column may have (uniform arrays of the GPU engine). */
export const AIR_LEVELS_MAX = 12;

/** Column packed for the per-cell evaluation (CPU and GPU). */
export interface PackedAir {
  n: number;
  z: Float64Array;
  u: Float64Array;
  v: Float64Array;
  t: Float64Array;
  /** Dew point per level; `hasTd` false when the column has none. */
  td: Float64Array;
  hasTd: boolean;
  /** Sunshine factor of the cloud cover (`sunCloudFactor`). */
  sunCloud: number;
}

const DRY = () => RULES.air.dryLapse / 1000;

/** Sunshine that reaches the ground under a cloud cover N (0..1): Kasten & Czeplak (1980), 1 − 0.75 N^3.4. */
export function sunCloudFactor(cloud: number | undefined): number {
  if (cloud === undefined || !(cloud > 0)) return 1;
  return 1 - 0.75 * Math.pow(clamp(cloud, 0, 1), 3.4);
}

/** Packs a column (sorted, at most `AIR_LEVELS_MAX` levels, missing dew points filled from their neighbours). */
export function packAir(col: AirColumn | undefined | null): PackedAir | null {
  if (!col) return null;
  const L = col.levels
    .filter((l) => Number.isFinite(l.z) && Number.isFinite(l.t) && Number.isFinite(l.u) && Number.isFinite(l.v))
    .sort((a, b) => a.z - b.z)
    .filter((l, i, a) => i === 0 || l.z - a[i - 1].z > 1)
    .slice(0, AIR_LEVELS_MAX);
  if (L.length < 2) return null;
  const n = L.length;
  const p: PackedAir = {
    n,
    z: new Float64Array(n),
    u: new Float64Array(n),
    v: new Float64Array(n),
    t: new Float64Array(n),
    td: new Float64Array(n),
    hasTd: L.some((l) => l.td != null && Number.isFinite(l.td)),
    sunCloud: sunCloudFactor(col.cloud),
  };
  L.forEach((l, i) => {
    p.z[i] = l.z;
    p.u[i] = l.u;
    p.v[i] = l.v;
    p.t[i] = l.t;
  });
  if (p.hasTd) {
    // Missing dew points: the spread of the nearest level that has one.
    const known = L.map((l, i) => (l.td != null && Number.isFinite(l.td) ? i : -1)).filter((i) => i >= 0);
    L.forEach((l, i) => {
      if (l.td != null && Number.isFinite(l.td)) p.td[i] = l.td;
      else {
        const j = known.reduce((b, k) => (Math.abs(k - i) < Math.abs(b - i) ? k : b), known[0]);
        p.td[i] = l.t - (L[j].t - (L[j].td as number));
      }
    });
  }
  return p;
}

/** Index i of the layer [z_i, z_i+1] used at altitude z (clamped to the first and last layers). */
function segment(p: PackedAir, z: number): number {
  let i = 0;
  for (let k = 1; k < p.n - 1; k++) if (z >= p.z[k]) i = k;
  return i;
}

/** Synoptic wind (east, north, m/s) at altitude z: linear between levels, held beyond them. */
export function packedWind(p: PackedAir, z: number, out: [number, number] = [0, 0]): [number, number] {
  const top = p.n - 1;
  if (z <= p.z[0]) {
    out[0] = p.u[0];
    out[1] = p.v[0];
  } else if (z >= p.z[top]) {
    out[0] = p.u[top];
    out[1] = p.v[top];
  } else {
    const i = segment(p, z);
    const f = (z - p.z[i]) / (p.z[i + 1] - p.z[i]);
    out[0] = p.u[i] + (p.u[i + 1] - p.u[i]) * f;
    out[1] = p.v[i] + (p.v[i + 1] - p.v[i]) * f;
  }
  return out;
}

/** Temperature (°C) at altitude z; below and above the column, its end layers with clamped lapse rates. */
export function packedTemp(p: PackedAir, z: number): number {
  const i = segment(p, z);
  let s = (p.t[i + 1] - p.t[i]) / (p.z[i + 1] - p.z[i]);
  const [e0, e1] = RULES.air.extrapLapse;
  if (z < p.z[0]) s = clamp(s, -e1 / 1000, -e0 / 1000);
  else if (z > p.z[p.n - 1]) s = clamp(s, -DRY(), 0);
  return p.t[i] + s * (z - p.z[i]);
}

/** Dew point (°C) at altitude z, or NaN without humidity. Below: constant mixing ratio; above: constant spread. */
export function packedDew(p: PackedAir, z: number): number {
  if (!p.hasTd) return NaN;
  const top = p.n - 1;
  if (z < p.z[0]) return p.td[0] + (RULES.air.dewLapse / 1000) * (p.z[0] - z);
  if (z > p.z[top]) return packedTemp(p, z) - (p.t[top] - p.td[top]);
  const i = segment(p, z);
  const f = (z - p.z[i]) / (p.z[i + 1] - p.z[i]);
  return p.td[i] + (p.td[i + 1] - p.td[i]) * f;
}

/**
 * Top of the dry thermals over a ground at zg (m AMSL): a parcel `RULES.air.parcelExcess`
 * warmer than the air at the ground rises along the dry adiabat until it meets the
 * sounding (exact on each linear layer); the top level when it never does.
 */
export function packedParcelTop(p: PackedAir, zg: number): number {
  const ex = RULES.air.parcelExcess;
  const tp0 = packedTemp(p, zg) + ex;
  const dry = DRY();
  let a = zg;
  let da = ex;
  for (let k = 0; k < p.n; k++) {
    const b = p.z[k];
    if (b <= a) continue;
    const db = tp0 - dry * (b - zg) - p.t[k];
    if (db <= 0) return a + (da / (da - db)) * (b - a);
    a = b;
    da = db;
  }
  return a;
}

/** Cumulus base over a ground at zg by Espy's rule, or NaN without humidity. */
export function packedCloudBase(p: PackedAir, zg: number): number {
  if (!p.hasTd) return NaN;
  return zg + RULES.air.espyMPerK * Math.max(0, packedTemp(p, zg) - packedDew(p, zg));
}

/** Thermal ceiling over a ground at zg: the dry top, or the cumulus base when lower. */
export function packedCeiling(p: PackedAir, zg: number): number {
  const top = packedParcelTop(p, zg);
  const base = packedCloudBase(p, zg);
  return base < top ? base : top;
}

/** Lapse rate (K/km) of the layer that contains altitude z (end layers beyond the column). */
export function packedLapse(p: PackedAir, z: number): number {
  const i = segment(p, z);
  return (-(p.t[i + 1] - p.t[i]) / (p.z[i + 1] - p.z[i])) * 1000;
}

const cache = new WeakMap<AirColumn, PackedAir | null>();
/** Packed column, memoised per column object. */
export function packed(col: AirColumn): PackedAir | null {
  if (!cache.has(col)) cache.set(col, packAir(col));
  return cache.get(col) ?? null;
}

/** Wind at altitude z of a column: direction it blows from (deg) and speed (km/h). */
export function airWindAt(col: AirColumn, z: number): { fromDeg: number; kmh: number } | null {
  const p = packed(col);
  if (!p) return null;
  const [u, v] = packedWind(p, z);
  return { fromDeg: windFromDeg(u, v), kmh: Math.hypot(u, v) * 3.6 };
}

export interface AirLayer {
  base: number;
  top: number;
  /** K/km (positive: the temperature decreases with height). */
  lapse: number;
}

/** The layers between consecutive levels. */
export function airLayers(col: AirColumn): AirLayer[] {
  const p = packed(col);
  if (!p) return [];
  const out: AirLayer[] = [];
  for (let i = 0; i < p.n - 1; i++) out.push({ base: p.z[i], top: p.z[i + 1], lapse: (-(p.t[i + 1] - p.t[i]) / (p.z[i + 1] - p.z[i])) * 1000 });
  return out;
}

/**
 * First layer above altitude z whose lapse rate is at most `maxLapse` (K/km): a stable
 * layer (`RULES.air.stableLapse`) or an inversion (`inversionLapse`), merged with the
 * stable layers right above it. Its base is not below z. Null when none up to `maxZ`.
 */
export function stableLayerAbove(col: AirColumn, z: number, maxLapse = RULES.air.stableLapse, maxZ = 4500): (AirLayer & { strengthK: number }) | null {
  const layers = airLayers(col);
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i];
    if (L.top <= z || L.base > maxZ || L.lapse > maxLapse) continue;
    let top = L.top;
    let j = i + 1;
    while (j < layers.length && layers[j].lapse <= maxLapse) top = layers[j++].top;
    const base = Math.max(L.base, z);
    const p = packed(col)!;
    const strengthK = packedTemp(p, top) - packedTemp(p, base);
    return { base, top, lapse: ((packedTemp(p, base) - packedTemp(p, top)) / (top - base)) * 1000, strengthK };
  }
  return null;
}

/** Inversion (temperature not decreasing) above altitude z, or null. */
export const inversionAbove = (col: AirColumn, z: number, maxZ = 4500) => stableLayerAbove(col, z, RULES.air.inversionLapse, maxZ);

/** Lapse rate (K/km) between 1500 and 3000 m: the 850–700 hPa stability the model already reads (`stabilityFactors`). */
export function ridgeLapse(col: AirColumn): number | null {
  const p = packed(col);
  if (!p) return null;
  return Math.round(((packedTemp(p, 1500) - packedTemp(p, 3000)) / 1.5) * 10) / 10;
}

/**
 * Saturated (moist) adiabatic lapse rate (K/km) at temperature t (°C) and altitude z (m,
 * pressure of the standard atmosphere): ≈ 4.5 K/km in warm low air, ≈ 7–8 K/km in the cold
 * air of 5 km (AMS Glossary, « saturated-adiabatic lapse rate »).
 */
export function moistLapse(t: number, z: number): number {
  const T = t + 273.15;
  const p = 1013.25 * Math.pow(Math.max(0.1, 1 - 2.25577e-5 * z), 5.2559);
  const es = 6.112 * Math.exp((17.67 * t) / (t + 243.5));
  const r = (0.622 * es) / Math.max(p - es, 1);
  const Lv = 2.501e6;
  return 1000 * ((9.81 * (1 + (Lv * r) / (287 * T))) / (1005 + (Lv * Lv * r * 0.622) / (287 * T * T)));
}

/** Lifting condensation level above the parcel's origin (m), Espy's rule. */
export const lclHeight = (t: number, td: number) => RULES.air.espyMPerK * Math.max(0, t - td);

export interface ConvectiveLayer {
  ground: number;
  /** Thermal ceiling (m AMSL): cumulus base, or the top of the dry thermals. */
  ceiling: number;
  dryTop: number;
  /** Cumulus base (m AMSL) when the thermals reach their condensation level, else null. */
  cloudBase: number | null;
  /** Top of the cumulus (moist parcel), when there are cumulus. */
  cumulusTop: number | null;
  /** Usable depth above the ground (m). */
  depth: number;
}

/** The convective layer over a ground at zg (m AMSL), as the model sees it. */
export function convectiveLayer(col: AirColumn, zg: number): ConvectiveLayer | null {
  const p = packed(col);
  if (!p) return null;
  const dryTop = packedParcelTop(p, zg);
  const base = packedCloudBase(p, zg);
  const cumulus = Number.isFinite(base) && base < dryTop;
  let cumulusTop: number | null = null;
  if (cumulus) {
    // Above the base the parcel follows the moist adiabat until it meets the sounding.
    let tp = packedTemp(p, zg) + RULES.air.parcelExcess - DRY() * (base - zg);
    let z = base;
    const step = 50;
    while (z < 9000 && tp > packedTemp(p, z)) {
      tp -= (moistLapse(tp, z) * step) / 1000;
      z += step;
    }
    cumulusTop = z;
  }
  const ceiling = cumulus ? base : dryTop;
  return { ground: zg, ceiling, dryTop, cloudBase: cumulus ? base : null, cumulusTop, depth: Math.max(0, ceiling - zg) };
}

/** Converts a forecast sounding (pressure levels, wind in km/h) into a column. */
export function airFromSounding(levels: ProfileLevel[], cloud?: number): AirColumn | null {
  const out: AirLevel[] = levels
    .filter((l) => Number.isFinite(l.heightM) && Number.isFinite(l.temperature) && Number.isFinite(l.windKmh) && Number.isFinite(l.windFromDeg))
    .map((l) => {
      const [u, v] = windVector(l.windFromDeg, l.windKmh / 3.6);
      return { z: l.heightM, u, v, t: l.temperature, td: l.dewpoint ?? null };
    });
  const col: AirColumn = { levels: out, cloud };
  return packAir(col) ? col : null;
}

export type StabilityPreset = 'stable' | 'standard' | 'instable';

/**
 * Manual air masses: 850–700 hPa stability read by `stabilityFactors` (`lapse`, K/km), top
 * of the afternoon mixed layer (m), lapse rates of the capping layer and of the free air
 * above it (up to `UPPER_Z`), and dew-point spread at 300 m (cumulus base ≈ 300 + 125 ×
 * spread). Orders of magnitude of Alpine summer soundings.
 */
export const STABILITY_PRESETS: Record<StabilityPreset, { lapse: number; mixTop: number; capLapse: number; free: number; spread: number }> = {
  stable: { lapse: 4.5, mixTop: 1600, capLapse: -4, free: 4.5, spread: 24 },
  standard: { lapse: 6.5, mixTop: 2400, capLapse: 2, free: 6, spread: 19 },
  instable: { lapse: 7.8, mixTop: 3200, capLapse: 4, free: 6.5, spread: 20 },
};

/** Altitude (m) above which a manual air mass is a little stable (K/km): the cumulus of a fine day stop there. */
const UPPER_Z = 4000;
const UPPER_LAPSE = 4;

/** Afternoon temperature at 300 m by month (°C, January first; mean maxima of the Alpine valleys, Grenoble order of magnitude). */
const VALLEY_TMAX = [6, 8.5, 13, 16, 20.5, 24.5, 27.5, 27, 22.5, 17, 10.5, 6.5];

/**
 * Air mass of a manual setting: one wind « aux crêtes », a stability and an optional
 * inversion altitude. `standard` without inversion is the model's reference day: no
 * column, standard lapse rate (identical to the model without layers). Otherwise a
 * mixed layer up to `mixTop` (or the inversion), its capping layer, then the free air;
 * the wind is the same at all heights, except under an explicit inversion, where the
 * valley stays sheltered (× `RULES.air.shelteredWind`).
 */
export function presetAir(o: { stability: StabilityPreset; inversionM?: number | null; fromDeg: number; kmh: number; month0: number }): { air?: AirColumn; lapseRate?: number } {
  const inv = o.inversionM ?? null;
  if (o.stability === 'standard' && inv === null) return {};
  const P = STABILITY_PRESETS[o.stability];
  const R = RULES.air;
  const zi = inv !== null ? clamp(inv, 500, 4000) : P.mixTop;
  const capLapse = inv !== null ? (-R.inversionK / R.capDepth) * 1000 : P.capLapse;
  const t300 = VALLEY_TMAX[((o.month0 % 12) + 12) % 12];
  const T = (z: number): number => {
    const tMix = t300 - (R.mixedLapse / 1000) * (Math.min(z, zi) - 300);
    if (z <= zi) return tMix;
    const tCap = tMix - (capLapse / 1000) * (Math.min(z, zi + R.capDepth) - zi);
    if (z <= zi + R.capDepth) return tCap;
    // Free air, then slightly stable air above `UPPER_Z`.
    const zf = Math.max(UPPER_Z, zi + R.capDepth);
    const tFree = tCap - (P.free / 1000) * (Math.min(z, zf) - zi - R.capDepth);
    return z <= zf ? tFree : tFree - (UPPER_LAPSE / 1000) * (z - zf);
  };
  // Dew point: constant mixing ratio in the mixed layer, drier free air above.
  const td300 = t300 - P.spread;
  const TD = (z: number): number => {
    const inMix = td300 - (R.dewLapse / 1000) * (Math.min(z, zi) - 300);
    return z <= zi ? inMix : inMix - ((P.free + 2.5) / 1000) * (z - zi);
  };
  const [u, v] = windVector(o.fromDeg, o.kmh / 3.6);
  const sheltered = inv !== null ? R.shelteredWind : 1;
  const zs = [200, zi, zi + R.capDepth, ...(zi + R.capDepth < UPPER_Z ? [UPPER_Z] : []), Math.max(5600, zi + R.capDepth + 500)];
  const levels: AirLevel[] = zs.map((z, i) => {
    const f = i < 2 ? sheltered : 1;
    return { z, u: u * f, v: v * f, t: T(z), td: TD(z) };
  });
  return { air: { levels }, lapseRate: P.lapse };
}
