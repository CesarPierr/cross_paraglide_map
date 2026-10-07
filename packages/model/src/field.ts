/**
 * Time- and wind-dependent part of the model: combines thermal breezes
 * (slope, valley, plain, lake/sea, plus curated local knowledge) with the
 * synoptic wind modified by the relief (shelter, channelling, venturi),
 * at a chosen height. Pure functions over typed arrays: runs in a Web Worker
 * and in unit tests.
 */
import type { BreezeCondition, CuratedBreezeInfo } from '@brises/shared';
import { CuratedLayerKind, curatedLayerKind } from './curated';
import { compassFr, windFromDeg, windVector } from './grid';
import { clamp, smoothstep } from './raster';
import { RULES } from './rules';
import { legalTimeToUtc, noonElevation, solarTime, sunPosition, sunSamples, type SunPosition } from './sun';
import type { Terrain } from './terrain';

export type { CuratedBreezeInfo };

export interface ModelParams {
  year: number;
  month0: number;
  day: number;
  /** French legal time, decimal hours. */
  hour: number;
  synoptic: { fromDeg: number; speedKmh: number };
  /** Evaluation height: above ground (agl) or absolute altitude (asl), metres. */
  height: { mode: 'agl' | 'asl'; meters: number };
  /** User multiplier on thermal breezes (1 = model default). */
  breezeScale: number;
  /** Heatwave day: enables the breezes documented "par forte chaleur / canicule" (default off). */
  heatwave?: boolean;
}

/** Dominant curated breeze per cell, for one layer. */
export interface CuratedRaster {
  /** Index into `breezes` or -1. */
  index: Int16Array;
  /** Influence 0..1. */
  weight: Float32Array;
  /** Unit flow direction (east, north). */
  tx: Float32Array;
  ty: Float32Array;
}

/** Known breezes rasterised on the grid (see `rasterizeCurated`). */
export interface CuratedLayer {
  /** Regular valley-scale and regional breezes. */
  main: CuratedRaster;
  /** Conditional breezes, taking their corridor over when their condition holds. */
  cond: CuratedRaster;
  /** Slope and katabatic breezes: thin near-ground layer under the others. */
  thin: CuratedRaster;
  breezes: CuratedBreezeInfo[];
}


export interface TimeContext {
  sun: SunPosition;
  solarHour: number;
  /** -1..1 forcing of slope breezes (negative = katabatic). Per-cell insolation is in `insol`. */
  night: boolean;
  valleyPhase: number;
  waterPhase: number;
  season: number;
  /** Afternoon decline of the thermals, 0.5..1 (`thermalDecline`). */
  thermalDecline: number;
  /** Insolation 0..1 per cell including cast shadows. */
  insol: Float32Array;
  /**
   * Sunshine received by each cell since sunrise, in hours of full sun on its slope
   * (integral of cos(incidence) × low-sun attenuation, without cast shadows).
   */
  sunHours: Float32Array;
}

/** Smooth trapezoid: -nightValue before a, ramps to 1 at b, 1 until c, back to -nightValue after d. */
function cycle(t: number, s: [number, number, number, number], nightValue: number): number {
  const [a, b, c, d] = s;
  if (t <= a - 2 || t >= d + 2) return -nightValue;
  if (t < a) return -nightValue * smoothstep(a, a - 2, t);
  if (t < b) return smoothstep(a, b, t);
  if (t <= c) return 1;
  if (t < d) return 1 - smoothstep(c, d, t);
  return -nightValue * smoothstep(d, d + 2, t);
}

/**
 * Along-valley wind relative to its peak, as a function of ζ = height above the
 * valley floor / valley depth (crest envelope − floor): full speed in the lower
 * part of the valley (jet), decreasing to zero at about crest height, then a weak
 * return flow (antiwind) above the crests. See `RULES.valleyProfile` for sources.
 * Mirrored in apps/web/src/gpu/model-glsl.ts.
 */
export function valleyProfile(zeta: number): number {
  const [jet, top] = RULES.valleyProfile;
  const [a0, a1, a2, a3] = RULES.valleyAntiwindZone;
  const core = 1 - smoothstep(jet, top, zeta);
  const anti = RULES.valleyAntiwind * smoothstep(a0, a1, zeta) * (1 - smoothstep(a2, a3, zeta));
  return core - anti;
}

/**
 * Afternoon decline of the thermals, 0.5..1: 1 until 13 h solar time, then follows the
 * decline of the valley-wind cycle, down to half. The morning onset is per cell
 * (`thermalOnset`, from the sunshine received since sunrise). Shared with the GPU.
 */
export function thermalDecline(solarHour: number, valleyPhase: number): number {
  return solarHour < 13 ? 1 : 0.5 + 0.5 * Math.max(0, valleyPhase);
}

/**
 * 0..1 onset of the thermals of a slope from the sunshine it has received since
 * sunrise (hours of full sun, `TimeContext.sunHours`): east faces start first, west
 * faces in the afternoon, flat floors in between. See `RULES.thermalSunHours`.
 * Mirrored in apps/web/src/gpu/model-glsl.ts.
 */
export function thermalOnset(sunHours: number): number {
  return smoothstep(RULES.thermalSunHours[0], RULES.thermalSunHours[1], sunHours);
}

/** Activity 0..1 of a curated breeze given its legal-time window, with 1 h ramps. */
export function windowActivity(hour: number, w: [number, number]): number {
  const [a, b] = w;
  if (b > a) return smoothstep(a - 0.5, a + 0.75, hour) * (1 - smoothstep(b - 0.75, b + 0.5, hour));
  // Window across midnight (night / morning down-valley breezes).
  return Math.max(smoothstep(a - 0.5, a + 0.75, hour), 1 - smoothstep(b - 0.75, b + 0.5, hour));
}

/** Angle between two meteorological directions, 0..180°. */
function angleDiff(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** 0..1: how far the simulated situation meets the condition of a conditional breeze. */
export function conditionFactor(c: BreezeCondition, p: ModelParams): number {
  if (c.wind) {
    const [s0, s1] = RULES.conditionSector;
    const dir = 1 - smoothstep(s0, s1, angleDiff(p.synoptic.fromDeg, c.wind.fromDeg));
    return dir * smoothstep(0.6 * c.wind.minKmh, c.wind.minKmh, p.synoptic.speedKmh);
  }
  if (c.regime === 'heatwave') return p.heatwave ? 1 : 0;
  if (c.regime === 'winter') return RULES.winterMonths.includes(p.month0) ? 1 : 0;
  // A condition the model cannot evaluate is never met.
  return 0;
}

/**
 * Activity 0..1 of a documented breeze: its hours (or the generic valley cycle),
 * times its condition. A wind-driven conditional flow without hours (Lombarde)
 * blows whenever its wind does. Shared by the CPU model and the GPU engine.
 */
export function curatedActivity(b: CuratedBreezeInfo, p: ModelParams, valleyPhase: number): number {
  const f = b.condition ? conditionFactor(b.condition, p) : 1;
  if (f <= 0) return 0;
  const base = b.window ? windowActivity(p.hour, b.window) : b.condition?.wind ? 1 : Math.max(0, valleyPhase);
  return base * f;
}

const SHADOW_STEPS = [1, 2, 3, 4, 6, 8, 11, 15, 20, 26, 34, 44, 56, 70];

export function computeTimeContext(t: Terrain, p: ModelParams): TimeContext {
  const { grid, z, gx, gy } = t;
  const { width: w, height: h } = grid;
  const centerLon = grid.colLon(w / 2);
  const centerLat = grid.rowLat(h / 2);
  const utc = legalTimeToUtc(p.year, p.month0, p.day, p.hour);
  const sun = sunPosition(utc, centerLat, centerLon);
  const solarHour = solarTime(utc, centerLon);
  const noonEl = noonElevation(p.month0, p.day, centerLat);
  const season = clamp((noonEl - 18) / 48, 0.2, 1);

  const insol = new Float32Array(grid.size);
  const el = (sun.elevation * Math.PI) / 180;
  const az = (sun.azimuth * Math.PI) / 180;
  if (sun.elevation > -1) {
    const sx = Math.sin(az) * Math.cos(el);
    const sy = Math.cos(az) * Math.cos(el);
    const sz = Math.sin(Math.max(el, 0.005));
    const tanEl = Math.tan(Math.max(el, 0.005));
    // March towards the sun in grid units (columns east, rows south).
    const di = Math.sin(az);
    const dj = -Math.cos(az);
    for (let j = 0; j < h; j++) {
      const cs = grid.cellM[j];
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        const nx = -gx[k];
        const ny = -gy[k];
        const norm = Math.sqrt(nx * nx + ny * ny + 1);
        let cosInc = (nx * sx + ny * sy + sz) / norm;
        if (cosInc <= 0) continue;
        const z0 = z[k] + 2;
        let shade = 0;
        for (let s = 0; s < SHADOW_STEPS.length; s++) {
          const d = SHADOW_STEPS[s];
          const ii = Math.round(i + di * d);
          const jj = Math.round(j + dj * d);
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) break;
          const rise = z[jj * w + ii] - z0 - d * cs * tanEl;
          if (rise > 0) {
            shade = Math.max(shade, clamp(rise / 60, 0, 1));
            if (shade >= 1) break;
          }
        }
        cosInc *= 1 - shade;
        // Low sun is attenuated by the atmosphere.
        insol[k] = cosInc * smoothstep(-1, 12, sun.elevation);
      }
    }
  }
  // Cumulative sunshine of each slope since sunrise (no cast shadows: a few sun
  // positions, analytic, identical on the GPU).
  const sunHours = new Float32Array(grid.size);
  const samples = sunSamples(p.year, p.month0, p.day, p.hour, centerLat, centerLon);
  const ns = samples.length / 4;
  if (ns > 0) {
    for (let k = 0; k < grid.size; k++) {
      const nx = -gx[k];
      const ny = -gy[k];
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      let e = 0;
      for (let s = 0; s < ns; s++) {
        const c = (nx * samples[s * 4] + ny * samples[s * 4 + 1] + samples[s * 4 + 2]) * inv;
        if (c > 0) e += samples[s * 4 + 3] * c;
      }
      sunHours[k] = e;
    }
  }
  const valleyPhase = cycle(solarHour, RULES.valleySchedule, RULES.valleyNightRatio);
  return {
    sun,
    solarHour,
    night: sun.elevation < 0,
    valleyPhase,
    waterPhase: cycle(solarHour, RULES.waterSchedule, 0.25),
    season,
    thermalDecline: thermalDecline(solarHour, valleyPhase),
    insol,
    sunHours,
  };
}

/** Everything the model knows about one cell; filled by `evalCell`. */
export interface CellResult {
  elevation: number;
  heightAgl: number;
  underground: boolean;
  slopeDeg: number;
  /** Direction the slope faces (deg from north). */
  aspectDeg: number;
  insolation: number;
  /** Relative height in the valley: 0 floor, 1 ridge envelope. */
  valleyLevel: number;
  valleyDepth: number;
  slope: [number, number];
  valley: [number, number];
  curated: [number, number];
  curatedIndex: number;
  curatedWeight: number;
  regional: [number, number];
  breeze: [number, number];
  breezeWeight: number;
  synoptic: [number, number];
  shelterDeg: number;
  lee: number;
  venturi: number;
  channelling: number;
  total: [number, number];
  dynamicLift: number;
  thermal: number;
  turbulence: number;
}

export function newCellResult(): CellResult {
  return {
    elevation: 0,
    heightAgl: 0,
    underground: false,
    slopeDeg: 0,
    aspectDeg: 0,
    insolation: 0,
    valleyLevel: 0,
    valleyDepth: 0,
    slope: [0, 0],
    valley: [0, 0],
    curated: [0, 0],
    curatedIndex: -1,
    curatedWeight: 0,
    regional: [0, 0],
    breeze: [0, 0],
    breezeWeight: 0,
    synoptic: [0, 0],
    shelterDeg: 0,
    lee: 0,
    venturi: 0,
    channelling: 0,
    total: [0, 0],
    dynamicLift: 0,
    thermal: 0,
    turbulence: 0,
  };
}

export interface WindContext {
  terrain: Terrain;
  time: TimeContext;
  params: ModelParams;
  curated: CuratedLayer | null;
  /** Per-breeze activity (signed: negative never used, 0..1) at this hour. */
  curatedActivity: Float32Array;
  /** Per-breeze vertical structure (`CuratedLayerKind`). */
  curatedKind: Uint8Array;
  g: [number, number];
  gSpeed: number;
  gKmh: number;
  /** Upwind unit step in grid coordinates. */
  upI: number;
  upJ: number;
}

export function makeWindContext(terrain: Terrain, time: TimeContext, params: ModelParams, curated: CuratedLayer | null): WindContext {
  const gSpeed = params.synoptic.speedKmh / 3.6;
  const g = windVector(params.synoptic.fromDeg, gSpeed);
  const r = (params.synoptic.fromDeg * Math.PI) / 180;
  const activity = new Float32Array(curated?.breezes.length ?? 0);
  const kinds = new Uint8Array(curated?.breezes.length ?? 0);
  curated?.breezes.forEach((b, i) => {
    activity[i] = curatedActivity(b, params, time.valleyPhase);
    kinds[i] = curatedLayerKind(b.kind);
  });
  return {
    terrain,
    time,
    params,
    curated,
    curatedActivity: activity,
    curatedKind: kinds,
    g,
    gSpeed,
    gKmh: params.synoptic.speedKmh,
    upI: Math.sin(r),
    upJ: -Math.cos(r),
  };
}

const RAD2DEG = 180 / Math.PI;
const CONF_STEPS = [4, 8, 13];

/** Full model at one cell. Shared by the grid loop and the point probe. */
export function evalCell(k: number, c: WindContext, out: CellResult): CellResult {
  const t = c.terrain;
  const { width: w, height: hgt } = t.grid;
  const i = k % w;
  const j = (k / w) | 0;
  const cs = t.grid.cellM[j];
  const z = t.z[k];
  const p = c.params;
  const h = p.height.mode === 'agl' ? p.height.meters : p.height.meters - z;
  out.elevation = z;
  out.heightAgl = h;
  out.underground = h < 0;
  const hh = Math.max(h, 5);

  const gxk = t.gx[k];
  const gyk = t.gy[k];
  const gmag = Math.sqrt(gxk * gxk + gyk * gyk);
  out.slopeDeg = Math.atan(gmag) * RAD2DEG;
  out.aspectDeg = gmag > 1e-6 ? (Math.atan2(-gxk, -gyk) * RAD2DEG + 360) % 360 : 0;
  const insol = c.time.insol[k];
  out.insolation = insol;

  // ζ: height of the evaluation point above the valley floor, in valley depths
  // (crest envelope − floor). In ASL mode this is the same air layer whatever the
  // ground below (valley centre, sidewall or plateau).
  const depth = Math.max(t.env[k] - t.floor[k], 150);
  const level = (z + hh - t.floor[k]) / depth;
  out.valleyLevel = level;
  out.valleyDepth = t.env[k] - t.floor[k];
  const scale = p.breezeScale;

  // --- Slope breeze: upslope by day on sunlit slopes, downslope at night.
  let slopeForce: number;
  if (c.time.night || c.time.sun.elevation < 3) slopeForce = -RULES.katabaticMax / RULES.slopeBreezeMax;
  else slopeForce = insol * (0.55 + 0.45 * c.time.season) - 0.08;
  const slopeFactor = clamp(Math.sin(Math.atan(gmag)) * 2.2, 0, 1);
  const slopeSpeed = RULES.slopeBreezeMax * slopeForce * slopeFactor * Math.exp(-hh / RULES.slopeBreezeDepth) * scale;
  if (gmag > 1e-6) {
    out.slope[0] = (gxk / gmag) * slopeSpeed;
    out.slope[1] = (gyk / gmag) * slopeSpeed;
  } else out.slope[0] = out.slope[1] = 0;

  // --- Valley breeze: up-valley by day (against drainage), down-valley at night.
  // Vertical profile: jet in the lower valley, zero at crest height, weak antiwind above.
  const vPhase = c.time.valleyPhase * (c.time.valleyPhase > 0 ? c.time.season : 1);
  const vProfile = valleyProfile(level);
  const vSpeed = RULES.valleyBreezeMax * vPhase * t.valley[k] * vProfile * scale;
  out.valley[0] = -t.axisX[k] * vSpeed;
  out.valley[1] = -t.axisY[k] * vSpeed;

  // --- Regional: plain → mountain, lake and sea breezes.
  const plainPhase = Math.max(c.time.valleyPhase, -0.2) * c.time.season;
  // In a valley channel the plain → mountain inflow and the sea or lake breeze are
  // what feeds the valley wind (S4–S7, rule `aspiration-plaine-montagne`; the sea
  // breeze "pousse contre les brises de vallée", S33): they are not added on top of
  // it, which doubled the speed in coastal and foreland valleys (30–35 km/h with no
  // synoptic wind), only kept outside the channels.
  const outside = 1 - t.valley[k];
  const plainDecay = Math.exp(-hh / 900) * outside;
  const wPhase = c.time.waterPhase * (c.time.waterPhase > 0 ? c.time.season : 1);
  const lakeDecay = Math.exp(-hh / 250) * outside;
  const seaDecay = Math.exp(-hh / 700) * outside;
  out.regional[0] =
    (RULES.plainBreezeMax * plainPhase * plainDecay * t.plainX[k] +
      RULES.lakeBreezeMax * wPhase * lakeDecay * t.lakeX[k] +
      RULES.seaBreezeMax * wPhase * seaDecay * t.seaX[k]) *
    scale;
  out.regional[1] =
    (RULES.plainBreezeMax * plainPhase * plainDecay * t.plainY[k] +
      RULES.lakeBreezeMax * wPhase * lakeDecay * t.lakeY[k] +
      RULES.seaBreezeMax * wPhase * seaDecay * t.seaY[k]) *
    scale;

  // --- Curated local knowledge overrides the generic flow.
  let cw = 0;
  out.curatedIndex = -1;
  out.curated[0] = out.curated[1] = 0;
  let thinW = 0;
  let thinX = 0;
  let thinY = 0;
  let thinIdx = -1;
  if (c.curated) {
    const cl = c.curated;
    let idx = cl.main.index[k];
    let wgt = cl.main.weight[k];
    let tx = cl.main.tx[k];
    let ty = cl.main.ty[k];
    let act = idx >= 0 ? c.curatedActivity[idx] : 0;
    // A conditional breeze takes its corridor over when its condition holds: the
    // condition, not the corridor weight, says which of the two flows is there.
    const ci = cl.cond.index[k];
    const ca = ci >= 0 ? c.curatedActivity[ci] : 0;
    if (ci >= 0 && cl.cond.weight[k] * ca > wgt * act * (1 - ca)) {
      idx = ci;
      wgt = cl.cond.weight[k];
      tx = cl.cond.tx[k];
      ty = cl.cond.ty[k];
      act = c.curatedActivity[ci];
    }
    if (idx >= 0) {
      const b = cl.breezes[idx];
      const kind = c.curatedKind[idx];
      // hf: how much the documented breeze overrides the generic flow at this height;
      // vf: its speed relative to the documented (low-level) speed. The override must
      // last as high as the generic flow it replaces: where the documented direction
      // differs from the generic one (Grésivaudan: NE → SW towards Grenoble, against
      // the generic up-drainage direction), a weight fading faster than the generic
      // valley wind would make both cancel aloft. The height decay is therefore put
      // on the speed, and the weight only fades above the antiwind layer.
      let hf = 1;
      let vf: number;
      if (kind === CuratedLayerKind.Valley) {
        const [, , a2, a3] = RULES.valleyAntiwindZone;
        hf = 1 - smoothstep(a2, a3, level);
        vf = vProfile;
      } else {
        // Terrain-following ~1 km inflow; channelled in a valley it fills the valley
        // at least as the valley wind does (positive part of the profile).
        vf = Math.max(Math.exp(-hh / RULES.curatedDeepDepth), vProfile);
      }
      // An inactive documented breeze (outside its hours) says nothing about the flow
      // now: its override fades with its activity instead of imposing a calm.
      cw = wgt * hf * act;
      const sp = b.speedMs * act * vf * scale;
      out.curated[0] = tx * sp;
      out.curated[1] = ty * sp;
      out.curatedIndex = idx;
      // The documented breeze tells which way the along-valley flow goes in its
      // corridor, and when. Where it contradicts the generic valley wind (whose sign
      // only comes from the drainage), the generic one is turned to the documented
      // sense, with a short transition at the corridor edge; otherwise the two cancel
      // wherever the override weight is below 1. Where it agrees by day, its hours
      // replace the generic valley-wind schedule (a breeze documented only in the late
      // afternoon is not simulated at noon by the generic flow underneath).
      const agree = (-t.axisX[k] * tx - t.axisY[k] * ty) * c.time.valleyPhase;
      const corridor = smoothstep(0, RULES.curatedAlignWeight, wgt);
      if (agree < 0) {
        const flip = 1 - 2 * smoothstep(0, RULES.curatedAlignWeight, wgt * act);
        out.valley[0] *= flip;
        out.valley[1] *= flip;
      } else if (c.time.valleyPhase > 0) {
        const timing = 1 - corridor * (1 - act);
        out.valley[0] *= timing;
        out.valley[1] *= timing;
      }
    }
    // Thin layer: a documented slope or katabatic breeze near the ground, under
    // (and replacing there) the slope, valley and regional flows.
    const ti = cl.thin.index[k];
    if (ti >= 0) {
      const tAct = c.curatedActivity[ti];
      const [l0, l1] = c.curatedKind[ti] === CuratedLayerKind.Katabatic ? RULES.curatedKatabaticLayer : RULES.curatedSlopeLayer;
      thinW = cl.thin.weight[k] * tAct * (1 - smoothstep(l0, l1, hh));
      const sp = cl.breezes[ti].speedMs * tAct * scale;
      thinX = cl.thin.tx[k] * sp;
      thinY = cl.thin.ty[k] * sp;
      thinIdx = ti;
    }
  }
  const bx0 = out.slope[0] + (out.valley[0] + out.regional[0]) * (1 - cw) + out.curated[0] * cw;
  const by0 = out.slope[1] + (out.valley[1] + out.regional[1]) * (1 - cw) + out.curated[1] * cw;
  const bx = bx0 * (1 - thinW) + thinX * thinW;
  const by = by0 * (1 - thinW) + thinY * thinW;
  // The probe reports the documented breeze that matters most at this height.
  if (thinW > cw) {
    out.curated[0] = thinX;
    out.curated[1] = thinY;
    out.curatedIndex = thinIdx;
    cw = thinW;
  }
  out.curatedWeight = cw;

  // --- Synoptic wind and the relief.
  const z0 = z + hh;
  let maxTan = -1;
  if (c.gSpeed > 0.05) {
    const steps = RULES.shelterSteps;
    for (let s = 0; s < steps.length; s++) {
      const d = steps[s];
      const ii = Math.round(i + c.upI * d);
      const jj = Math.round(j + c.upJ * d);
      if (ii < 0 || jj < 0 || ii >= w || jj >= hgt) break;
      const tn = (t.z[jj * w + ii] - z0) / (d * cs);
      if (tn > maxTan) maxTan = tn;
    }
  }
  const shelter = Math.atan(maxTan) * RAD2DEG;
  out.shelterDeg = shelter;
  const lee = c.gSpeed > 0.05 ? smoothstep(RULES.leeAngle[0], RULES.leeAngle[1], shelter) : 0;
  out.lee = lee;

  // Lateral confinement perpendicular to the wind → venturi.
  let conf = 0;
  if (c.gSpeed > 0.05) {
    const pI = -c.upJ;
    const pJ = c.upI;
    let left = -1e9;
    let right = -1e9;
    for (let q = 0; q < CONF_STEPS.length; q++) {
      const d = CONF_STEPS[q];
      const li = Math.round(i + pI * d);
      const lj = Math.round(j + pJ * d);
      const ri = Math.round(i - pI * d);
      const rj = Math.round(j - pJ * d);
      if (li >= 0 && lj >= 0 && li < w && lj < hgt) left = Math.max(left, t.z[lj * w + li] - z0);
      if (ri >= 0 && rj >= 0 && ri < w && rj < hgt) right = Math.max(right, t.z[rj * w + ri] - z0);
    }
    conf = smoothstep(120, 650, Math.min(left, right));
  }
  out.venturi = conf * (1 - lee);

  const gx = c.g[0];
  const gy = c.g[1];
  const chan = t.valley[k] * (1 - smoothstep(0.35, 0.9, level));
  out.channelling = chan;
  const along = gx * t.axisX[k] + gy * t.axisY[k];
  const cx = gx + (t.axisX[k] * along * 1.15 - gx) * 0.85 * chan;
  const cy = gy + (t.axisY[k] * along * 1.15 - gy) * 0.85 * chan;
  const fh = (0.3 + 0.7 * smoothstep(-0.1, 1.05, level)) * (0.75 + 0.25 * smoothstep(0, 400, hh));
  const speedFactor = fh * (1 - 0.85 * lee) * (1 + RULES.venturiGain * out.venturi);
  const rotor = 0.25 * lee * smoothstep(10, 30, c.gKmh) * (1 - chan);
  out.synoptic[0] = cx * speedFactor - gx * rotor;
  out.synoptic[1] = cy * speedFactor - gy * rotor;

  // Breezes survive under weak synoptic wind, in deep valleys and in the lee.
  let wb = clamp(1.2 - c.gKmh / RULES.synopticOverrideKmh, 0.15, 1);
  wb = Math.max(wb, clamp(0.6 * t.valley[k] * (1 - level), 0, 0.8), 0.7 * lee);
  out.breezeWeight = wb;
  out.breeze[0] = bx;
  out.breeze[1] = by;
  out.total[0] = bx * wb + out.synoptic[0];
  out.total[1] = by * wb + out.synoptic[1];

  // Orographic vertical speed of the air forced over the slope (dynamic lift).
  out.dynamicLift = (out.synoptic[0] * gxk + out.synoptic[1] * gyk) * Math.exp(-hh / 350);

  // Thermal potential 0..1: sun on the slope, height, convexity, no water, not blown apart.
  const day = c.time.sun.elevation > 5 ? 1 : 0;
  const elevF = 0.55 + 0.45 * smoothstep(400, 2200, z);
  const convexF = 0.55 + 0.45 * smoothstep(-60, 140, t.tpi[k]);
  const windF = 1 - 0.6 * smoothstep(20, 45, c.gKmh);
  const dayF = thermalOnset(c.time.sunHours[k]) * c.time.thermalDecline;
  out.thermal = t.water[k] ? 0 : day * clamp(insol * c.time.season * elevF * convexF * windF * dayF, 0, 1);

  out.turbulence = clamp(lee * smoothstep(8, 35, c.gKmh) + out.venturi * smoothstep(15, 45, c.gKmh) * 0.6, 0, 1);
  return out;
}

export interface FieldResult {
  /** RGBA per cell: u, v (m/s), estimated vertical air speed (m/s), turbulence 0..1. */
  field: Float32Array;
  /** Thermal potential 0..1. */
  thermal: Float32Array;
  /** Dynamic (orographic) lift, m/s. */
  dynamic: Float32Array;
  /** Lee factor 0..1 and venturi 0..1. */
  lee: Float32Array;
  venturi: Float32Array;
  /** Vertical speed induced by horizontal convergence, m/s (positive = rising). */
  convergence: Float32Array;
}

export function computeField(c: WindContext): FieldResult {
  const t = c.terrain;
  const { width: w, height: h, size: n } = t.grid;
  const field = new Float32Array(n * 4);
  const thermal = new Float32Array(n);
  const dynamic = new Float32Array(n);
  const lee = new Float32Array(n);
  const venturi = new Float32Array(n);
  const convergence = new Float32Array(n);
  const cell = newCellResult();
  for (let k = 0; k < n; k++) {
    evalCell(k, c, cell);
    if (cell.underground) continue;
    field[k * 4] = cell.total[0];
    field[k * 4 + 1] = cell.total[1];
    field[k * 4 + 3] = cell.turbulence;
    thermal[k] = cell.thermal;
    dynamic[k] = cell.dynamicLift;
    lee[k] = cell.lee;
    venturi[k] = cell.venturi;
  }
  // Horizontal divergence → vertical speed through a layer of fixed depth.
  for (let j = 1; j < h - 1; j++) {
    const cs = t.grid.cellM[j];
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      const dudx = (field[(k + 1) * 4] - field[(k - 1) * 4]) / (2 * cs);
      const dvdy = -(field[(k + w) * 4 + 1] - field[(k - w) * 4 + 1]) / (2 * cs);
      convergence[k] = -(dudx + dvdy) * RULES.convergenceDepth;
    }
  }
  // Light smoothing of the convergence (it is noisy at cell scale).
  const conv = smooth3(convergence, w, h);
  for (let k = 0; k < n; k++) {
    convergence[k] = conv[k];
    const lift = thermal[k] * 2.5 + Math.max(dynamic[k], -1.5) + clamp(conv[k], -1.5, 2.5);
    field[k * 4 + 2] = lift;
  }
  return { field, thermal, dynamic, lee, venturi, convergence };
}

function smooth3(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      out[k] =
        (4 * src[k] + 2 * (src[k - 1] + src[k + 1] + src[k - w] + src[k + w]) + src[k - w - 1] + src[k - w + 1] + src[k + w - 1] + src[k + w + 1]) / 16;
    }
  }
  return out;
}

/** Human-readable summary of a vector for the UI. */
export function describeVector(v: [number, number]): { speedKmh: number; fromDeg: number; from: string } {
  const s = Math.hypot(v[0], v[1]);
  const fromDeg = windFromDeg(v[0], v[1]);
  return { speedKmh: s * 3.6, fromDeg, from: compassFr(fromDeg) };
}
