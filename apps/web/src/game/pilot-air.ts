/**
 * The air at the pilot, each physics step, sampled at the centre and both wing tips into an
 * AirSample without allocation:
 * - the site's wind (model, 5 Hz, smoothed) with its gradient near the ground: a log profile
 *   whose roughness grows in the lee and whose depth grows when the air is stable;
 * - the flow forced by the fine relief (terrain tiles, ~10 m) along the wind through the
 *   pilot: linear potential flow over the profile, i.e. the slope smoothed by a kernel whose
 *   width is the height above the ground, so the lift starts upwind of a face, rises one to
 *   two face heights above the crest and weakens with height; the speed-up and compression
 *   over crests; the sink beyond them; a 3D factor (the air goes round a peak, over a ridge);
 * - flow separation in the lee of a steep crest when the wind exceeds ~20 km/h: a rotor
 *   (reversed flow near the ground, rising along the lee slope, sinking downstream) and the
 *   turbulent shear layer at crest height;
 * - the speed-up through gaps and passes (venturi), beyond what the model's 216 m grid sees;
 * - the air mass (thermals, background, air holes, convergences) and the turbulence: Dryden
 *   near the ground (σ and eddy sizes from the height and the wind), Lenschow in the
 *   convective layer, plus the lee, the rotor, shear layers and the thermals' edges.
 */
import { RULES } from '@brises/model';
import type { AirMass, VerticalAir } from './airmass';
import type { AirSample, GliderState } from './flight';

export type GroundAt = (x: number, y: number) => number | null;

/** What the site's model says at the pilot (see game-worker ModelAir). */
export interface ModelAirLike {
  u: number;
  v: number;
  lift: number;
  turbulence: number;
  lee: number;
  ground: number;
  /** Speed-up of the model's wind through a gap (0..1), already in u, v. */
  venturi?: number;
  /** Vertical shear of the model's wind at the pilot (1/s). */
  shear?: number;
  /** Heating efficiency of the ground (land cover; 1 = the mean of the Alps' land). */
  surface?: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * The upslope (anabatic) breeze along the sunlit relief near the pilot: the layer the sun
 * heats against a slope rises along it (Prandtl's slope flow: 1–4 m/s, layers 20 to 200 m
 * thick, Zardi & Whiteman 2013), the lift pilots soar close to a sunny face or a cliff in the
 * afternoon, even in a light cross wind. The map's model has it on its 216 m grid, where a
 * cliff is a smoothed slope and the layer is mixed into the wind at the pilot's height; here
 * it follows the fine relief: the nearest surface, its slope and its sun, at the model's
 * speed (RULES.slopeBreezeMax, its insolation and steepness factors) and the ground's
 * heating (rock more, forest less, snow hardly). A wind across the relief mixes the thin
 * layer away. ANA_DEPTH: e-folding distance from the surface (m), close to a face.
 */
const ANA_DEPTH = 50;
/** Points searched for the nearest surface: rings (m) × 8 directions, and the point below. */
const ANA_RINGS = [12, 30, 60, 100, 150];

/**
 * Up-slope breeze speed (m/s) on a surface of unit normal n under the sun s (unit, z up),
 * its ground heating and a wind U (m/s). A convective speed goes as the cube root of the
 * heat flux (Deardorff's w*, slope flows alike): a face the sun strikes at a slant still
 * breathes well (42 % of the flux, 75 % of the speed), where the map's model is linear.
 */
export function anabaticSpeed(nx: number, ny: number, nz: number, sx: number, sy: number, sz: number, season: number, surface: number, U: number): number {
  if (sz < 0.05) return 0;
  const ins = Math.max(0, nx * sx + ny * sy + nz * sz) * (0.55 + 0.45 * season);
  const force = Math.cbrt(clamp((ins - 0.1) / 0.9, 0, 1));
  const sinT = Math.sqrt(Math.max(0, 1 - nz * nz));
  const steep = clamp(sinT * 2.2, 0, 1);
  const mix = 1 / (1 + (U / 6) ** 2);
  return RULES.slopeBreezeMax * force * steep * clamp(surface, 0.1, 1.5) * mix;
}
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Terrain profile along the wind: samples every DS metres from −HALF to +HALF around the pilot. */
const DS = 40;
const N = 49;
const HALF = ((N - 1) / 2) * DS;
/** Cross-wind probes for gaps (m either side). */
const CROSS = [60, 150, 300, 500];
/**
 * σw (m/s) of the small eddies at a thermal's edge per unit of the air mass's shear there:
 * ≈ 1 m/s at the edge of a strong thermal on an unstable day (Kolmogorov estimate, see
 * airmass EDGE_L). On the bench, 40 crossings of strong thermals on a very unstable day
 * fold a B flown hands up a few times (4 since the frozen turbulence no longer jitters when
 * its eddies change size; 11 before), never with active piloting, constantly on the bar.
 */
const EDGE_SIGMA = 1.0;

/**
 * The relief seen by the wind through the pilot, refreshed ~10 times a second from the fine
 * terrain; evaluated per step at the centre and the tips.
 */
export class ReliefFlow {
  ok = false;
  ox = 0;
  oy = 0;
  ux = 1;
  uy = 0;
  readonly h = new Float32Array(N);
  readonly slope = new Float32Array(N - 1);
  /** 3D factor 0.55 (isolated peak, the air goes round) … 1 (long ridge across the wind). */
  kappa = 1;
  /** Flow separation behind the crest upwind: strength 0..1, crest position (m along the wind), its height above the pilot's ground. */
  sep = 0;
  crestA = 0;
  crestH = 0;
  /** Speed-up factor through a gap at the pilot (≥ 1). */
  gap = 1;

  /**
   * Samples the terrain along the wind (u, v) through (x, y) and across it. False when the
   * terrain is not loaded there or the wind is too light to matter.
   */
  update(ground: GroundAt, x: number, y: number, z: number, groundHere: number, u: number, v: number, modelVenturi: number): boolean {
    const U = Math.hypot(u, v);
    if (U < 0.5) {
      this.ok = false;
      return false;
    }
    this.ux = u / U;
    this.uy = v / U;
    this.ox = x;
    this.oy = y;
    for (let i = 0; i < N; i++) {
      const s = i * DS - HALF;
      const g = ground(x + this.ux * s, y + this.uy * s);
      if (g === null) {
        this.ok = false;
        return false;
      }
      this.h[i] = g;
    }
    // 3D factor: across the wind at the highest point near the pilot, is it a ridge or a peak?
    let ic = 0;
    let hMax = -1e9;
    let hMin = 1e9;
    for (let i = 0; i < N; i++) {
      hMin = Math.min(hMin, this.h[i]);
      const s = i * DS - HALF;
      if (Math.abs(s) <= 520 && this.h[i] > hMax) {
        hMax = this.h[i];
        ic = i;
      }
    }
    const sc = ic * DS - HALF;
    const cx = x + this.ux * sc;
    const cy = y + this.uy * sc;
    const l = ground(cx - this.uy * 300, cy + this.ux * 300);
    const r = ground(cx + this.uy * 300, cy - this.ux * 300);
    const relief = hMax - hMin;
    this.kappa = l === null || r === null || relief < 20 ? 1 : 0.55 + 0.45 * clamp((Math.min(l, r) - hMin) / relief, 0, 1);
    // Separation: the highest point upwind, how steeply the ground falls behind it, how high above us.
    let iu = 0;
    let hu = -1e9;
    for (let i = 0; i < (N - 1) / 2; i++) {
      if (this.h[i] > hu) {
        hu = this.h[i];
        iu = i;
      }
    }
    const k3 = Math.min(N - 1, iu + 3);
    const leeSlope = (this.h[iu] - this.h[k3]) / ((k3 - iu) * DS || 1);
    this.crestA = iu * DS - HALF;
    this.crestH = hu - groundHere;
    this.sep = smoothstep(4.5, 7.5, U) * smoothstep(0.3, 0.55, leeSlope) * smoothstep(25, 60, this.crestH) * this.kappa;
    // Slopes, limited to what the airflow can follow: the flow down a lee slope is weaker than
    // up the windward one (the boundary layer thickens there, the lift band leans over the
    // crest), and behind a separating crest it does not dive down the lee slope at all.
    for (let i = 0; i < N - 1; i++) {
      let s = clamp((this.h[i + 1] - this.h[i]) / DS, -1.2, 1.2);
      if (s < 0) s *= 0.6;
      if (this.sep > 0 && i >= iu && (i - iu) * DS < 7 * Math.max(30, this.crestH)) s = Math.max(s, -0.2 - 0.5 * (1 - this.sep));
      this.slope[i] = s;
    }
    // Gap: terrain rising above the pilot on both sides across the wind, close by.
    let riseL = -1e9;
    let riseR = -1e9;
    let dL = 1e9;
    let dR = 1e9;
    for (const d of CROSS) {
      const hl = ground(x - this.uy * d, y + this.ux * d);
      const hr = ground(x + this.uy * d, y - this.ux * d);
      if (hl !== null) {
        riseL = Math.max(riseL, hl - z);
        if (hl > z && d < dL) dL = d;
      }
      if (hr !== null) {
        riseR = Math.max(riseR, hr - z);
        if (hr > z && d < dR) dR = d;
      }
    }
    const confined = smoothstep(10, 100, Math.min(riseL, riseR)) * smoothstep(1100, 250, dL + dR);
    this.gap = 1 + 0.35 * confined * (1 - 0.7 * clamp(modelVenturi, 0, 1));
    this.ok = true;
    return true;
  }

  /**
   * Potential flow over the profile at `a` metres along the wind from the origin, `hz` above
   * the ground: vertical speed and speed-up, per m/s of wind.
   */
  flowAt(a: number, hz: number, out: { w: number; du: number }): void {
    let w = 0;
    let du = 0;
    const z2 = hz * hz;
    for (let i = 0; i < N - 1; i++) {
      const m = i * DS - HALF + DS / 2;
      const dx = a - m;
      const k = this.slope[i] / (dx * dx + z2);
      w += k * hz;
      du += k * dx;
    }
    const f = (DS / Math.PI) * this.kappa;
    out.w = clamp(w * f, -0.8, 1.3);
    out.du = clamp(du * f, -0.5, 0.7);
  }

  /** Rotor behind a separating crest at `a` along the wind, `agl` above the ground: along-wind and vertical speeds per m/s, and its strength. */
  rotorAt(a: number, agl: number, out: { u: number; w: number; f: number; block: number; shear: number }): void {
    out.u = 0;
    out.w = 0;
    out.f = 0;
    out.block = 0;
    out.shear = 0;
    if (this.sep <= 0.01) return;
    const H = Math.max(30, this.crestH);
    const xd = a - this.crestA;
    const Lr = Math.min(1500, 6 * H);
    if (xd <= 0 || xd > Lr || agl > 1.5 * H) return;
    const f = this.sep * (1 - smoothstep(0.75 * Lr, Lr, xd)) * (1 - smoothstep(1.0 * H, 1.35 * H, agl));
    const xc = 2.2 * H;
    const zc = 0.45 * H;
    const r0 = 0.6 * H;
    const dx = xd - xc;
    const dz = agl - zc;
    const k = (0.55 * H) / (dx * dx + dz * dz + r0 * r0);
    // Clockwise seen with the wind to the right: forward at the top, back towards the crest near the ground, down on its far side.
    out.u = f * k * dz;
    out.w = -f * k * dx;
    out.f = f;
    out.block = 0.7 * f * (1 - smoothstep(0.7 * H, 1.2 * H, agl));
    out.shear = this.sep * Math.exp(-(((agl / H - 1) / 0.25) ** 2)) * (1 - smoothstep(0.75 * Lr, Lr, xd));
  }
}

/** Wind gradient near the ground: share of the wind at `agl` (log profile, roughness z0, reaching the full wind at zr). */
export function surfaceFactor(agl: number, z0: number, zr: number): number {
  if (agl >= zr) return 1;
  return clamp(Math.log(1 + Math.max(0, agl) / z0) / Math.log(1 + zr / z0), 0, 1);
}

/** Turbulence at the pilot: σ (m/s) and eddy sizes (m) of the frozen field, and of its small-eddy part. */
export interface TurbulenceState {
  sigU: number;
  sigW: number;
  Lu: number;
  Lw: number;
  sigX: number;
  Lx: number;
  /** 0..1 for the wing's random roll and the HUD. */
  intensity: number;
}

/**
 * Turbulence model. Mechanical (MIL-F-8785C Dryden, low altitude, h in feet): σw = 0.1 W20
 * (here ×1.3 for mountain roughness), σu = σw / (0.177 + 0.000823 h)^0.4, Lw = h,
 * Lu = h / (0.177 + 0.000823 h)^1.2, fading above ~300 m; weaker and smaller when the air is
 * stable. Convective (Lenschow et al. 1980, the share below the thermals' scale):
 * σw = 0.35 · √1.8 w* (z/zi)^(1/3)(1 − 0.8 z/zi), eddies ~1.5 z up to 0.4 zi. Plus the
 * small eddies of the lee and rotors, shear layers and thermal edges.
 */
export function turbulenceModel(agl: number, U6: number, conv: number, convSigma: number, convLength: number, extra: number, out: TurbulenceState): TurbulenceState {
  const h = Math.max(3, agl);
  const hft = h * 3.281;
  const low = h < 305;
  const stab = 0.6 + 0.4 * conv;
  const sw = 0.13 * U6 * (1 - 0.6 * smoothstep(300, 1500, h)) * stab;
  const ru = low ? 1 / Math.pow(0.177 + 0.000823 * hft, 0.4) : 1;
  const su = sw * ru;
  const lw = clamp(h, 10, 300) * (0.5 + 0.5 * conv);
  const lu = (low ? Math.max(20, h / Math.pow(0.177 + 0.000823 * hft, 1.2)) : 533) * (0.5 + 0.5 * conv);
  const cw = 0.35 * convSigma;
  out.sigW = Math.hypot(sw, cw);
  out.sigU = Math.hypot(su, 0.6 * cw);
  // Eddy sizes weighted by each part's variance.
  const vw = sw * sw + cw * cw + 1e-6;
  out.Lw = (lw * sw * sw + convLength * cw * cw) / vw + (vw < 1e-5 ? lw : 0);
  out.Lu = (lu * sw * sw + 1.6 * convLength * cw * cw) / vw + (vw < 1e-5 ? lu : 0);
  out.sigX = extra;
  out.Lx = clamp(0.3 * h, 8, 30);
  out.intensity = clamp(Math.hypot(out.sigW, extra) / 1.6, 0, 1);
  return out;
}

/** What the pilot's air did this step (HUD, bench and tests). */
export interface PilotAirInfo {
  /** Share of the wind left by the ground's gradient at the pilot. */
  gradient: number;
  /** Relief lift (m/s), speed-up (share), rotor strength (0..1), gap speed-up (≥ 1). */
  relief: number;
  speedUp: number;
  rotor: number;
  venturi: number;
  /** Turbulence σw (m/s), its small-eddy part and that of the thermals' edges. */
  sigmaW: number;
  sigmaX: number;
  sigmaE: number;
  /** Upslope breeze along the nearest surface (m/s) and the vertical speed it gives here. */
  anabatic: number;
  anabaticW: number;
}

/**
 * Composes the air at the pilot each step. The engine feeds it the model's samples
 * (`setModel`, 5 Hz), refreshes the relief (`update`, 10 Hz) and samples it per step.
 */
export class PilotAir {
  /** The model's air, smoothed towards its last sample (the 5 Hz samples must not step the wind). */
  private m = { u: 0, v: 0, lift: 0, turbulence: 0, lee: 0, venturi: 0, shear: 0, surface: 1 };
  /** The sun (unit vector, east/north/up) and the nearest surface: distance, normal (refreshed with the relief). */
  private sun = { x: 0, y: 0, z: -1 };
  private near = { ok: false, d: 1e9, nx: 0, ny: 0, nz: 1, light: 1 };
  /** Sunlight on that surface, lagged by the ground's heat (cools in ~2–3 min under a cloud, ~4 min to heat again). */
  private surfSun = 1;
  private target: ModelAirLike | null = null;
  private hasModel = false;
  readonly relief = new ReliefFlow();
  private va: VerticalAir = { w: 0, shear: 0, cloud: 0, u: 0, v: 0 };
  private vt: VerticalAir = { w: 0, shear: 0, cloud: 0, u: 0, v: 0 };
  private fl = { w: 0, du: 0 };
  private rot = { u: 0, w: 0, f: 0, block: 0, shear: 0 };
  private tb = { u: 0, v: 0, w: 0 };
  private ts: TurbulenceState = { sigU: 0, sigW: 0, Lu: 100, Lw: 100, sigX: 0, Lx: 20, intensity: 0 };
  private cs = { sigma: 0, length: 100, zi: 2000 };
  readonly info: PilotAirInfo = { gradient: 1, relief: 0, speedUp: 0, rotor: 0, venturi: 1, sigmaW: 0, sigmaX: 0, sigmaE: 0, anabatic: 0, anabaticW: 0 };
  /** Last cloud white-out at the pilot (0..1). */
  cloud = 0;

  constructor(
    readonly air: AirMass,
    private ground: GroundAt,
  ) {}

  setModel(m: ModelAirLike): void {
    this.target = m;
    if (!this.hasModel) {
      this.hasModel = true;
      this.m.u = m.u;
      this.m.v = m.v;
      this.m.lift = m.lift;
      this.m.turbulence = m.turbulence;
      this.m.lee = m.lee;
      this.m.venturi = m.venturi ?? 0;
      this.m.shear = m.shear ?? 0;
      this.m.surface = m.surface ?? 1;
    }
  }

  /** The sun's azimuth (° from north) and elevation (°). */
  setSun(azimuthDeg: number, elevationDeg: number): void {
    const a = (azimuthDeg * Math.PI) / 180;
    const e = (elevationDeg * Math.PI) / 180;
    this.sun = { x: Math.sin(a) * Math.cos(e), y: Math.cos(a) * Math.cos(e), z: Math.sin(e) };
  }

  /** The smoothed model wind at the pilot (m/s). */
  get modelWind(): [number, number] {
    return [this.m.u, this.m.v];
  }

  /** Refreshes the relief profile along the wind through the pilot (call ~10 times a second). */
  update(g: GliderState, groundHere: number): void {
    this.relief.update(this.ground, g.x, g.y, g.z, groundHere, this.m.u, this.m.v, this.m.venturi);
    this.findSurface(g.x, g.y, g.z, groundHere);
  }

  /**
   * The nearest point of the relief (below or beside: a cliff's face) and its normal, from the
   * fine heights: what the upslope breeze flows along.
   */
  private findSurface(x: number, y: number, z: number, groundHere: number): void {
    const n = this.near;
    let best = Math.max(0, z - groundHere);
    let bx = x;
    let by = y;
    for (const r of ANA_RINGS) {
      if (r > best + 20) break;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        const h = this.ground(px, py);
        if (h === null) continue;
        const d = Math.hypot(r, Math.max(0, z - h));
        if (d < best) {
          best = d;
          bx = px;
          by = py;
        }
      }
    }
    const e = 6;
    const hx0 = this.ground(bx - e, by);
    const hx1 = this.ground(bx + e, by);
    const hy0 = this.ground(bx, by - e);
    const hy1 = this.ground(bx, by + e);
    if (hx0 === null || hx1 === null || hy0 === null || hy1 === null) {
      n.ok = false;
      return;
    }
    const gx = (hx1 - hx0) / (2 * e);
    const gy = (hy1 - hy0) / (2 * e);
    const l = Math.hypot(gx, gy, 1);
    n.ok = true;
    n.d = best;
    n.nx = -gx / l;
    n.ny = -gy / l;
    n.nz = 1 / l;
    n.light = this.air.lightAt(bx, by, (hx0 + hx1) / 2 + 5);
  }

  /** Fills `out` with the air at the glider (centre and tips) for this step of `dt` at game time `t`. */
  sample(g: GliderState, groundHere: number, t: number, dt: number, out: AirSample): AirSample {
    const m = this.m;
    const tg = this.target;
    if (tg) {
      // The model's samples arrive every 0.2 s: glide towards them.
      const k = Math.min(1, dt / 0.4);
      m.u += (tg.u - m.u) * k;
      m.v += (tg.v - m.v) * k;
      m.lift += (tg.lift - m.lift) * k;
      m.turbulence += (tg.turbulence - m.turbulence) * k;
      m.lee += (tg.lee - m.lee) * k;
      m.venturi += ((tg.venturi ?? 0) - m.venturi) * k;
      m.shear += ((tg.shear ?? 0) - m.shear) * k;
      m.surface += ((tg.surface ?? 1) - m.surface) * k;
    }
    const air = this.air;
    const agl = Math.max(0, g.z - groundHere);
    const U = Math.hypot(m.u, m.v);
    const R = this.relief;
    const conv = air.convection();
    // Wind gradient near the ground: deeper when the air is stable, rougher behind a crest.
    const z0 = 0.15 + 0.6 * R.sep;
    const zr = 25 + 70 * (1 - conv) + 40 * R.sep;
    const fz = surfaceFactor(agl, z0, zr);
    // Tips 5 m either side across the heading.
    const rx = Math.cos(g.heading) * 5;
    const ry = -Math.sin(g.heading) * 5;
    let wRel: number;
    let wRelL: number;
    let wRelR: number;
    let du = 0;
    let rotU = 0;
    let rotW = 0;
    let rotWL = 0;
    let rotWR = 0;
    let block = 0;
    let rotShear = 0;
    let rotF = 0;
    if (R.ok && U > 0.5) {
      const ux = R.ux;
      const uy = R.uy;
      const a = (g.x - R.ox) * ux + (g.y - R.oy) * uy;
      const da = rx * ux + ry * uy;
      const hz = agl + 12;
      const Uz = U * fz;
      R.flowAt(a, hz, this.fl);
      wRel = Uz * this.fl.w;
      du = this.fl.du;
      R.flowAt(a - da, hz, this.fl);
      wRelL = Uz * this.fl.w;
      R.flowAt(a + da, hz, this.fl);
      wRelR = Uz * this.fl.w;
      R.rotorAt(a, agl, this.rot);
      rotU = U * this.rot.u;
      rotW = U * this.rot.w;
      block = this.rot.block;
      rotShear = this.rot.shear;
      rotF = this.rot.f;
      R.rotorAt(a - da, agl, this.rot);
      rotWL = U * this.rot.w;
      R.rotorAt(a + da, agl, this.rot);
      rotWR = U * this.rot.w;
    } else {
      // Terrain not loaded here yet: the model's own (coarser) lift along the slope.
      wRel = wRelL = wRelR = m.lift * fz;
    }
    // The lee the fine profile does not see (crests farther upwind): the model's lee sinks and shakes.
    const leeFar = m.lee * (1 - R.sep);
    const leeSink = -0.15 * leeFar * U;
    const venturi = R.ok ? R.gap : 1;
    const along = fz * (1 + du) * venturi * (1 - block);
    const mu = m.u * along;
    const mv = m.v * along;
    const ux = U > 0.3 ? m.u / U : 0;
    const uy = U > 0.3 ? m.v / U : 0;
    air.advance(dt, mu, mv, t);
    // Air mass at the centre and the tips.
    const va = this.va;
    air.sampleInto(g.x, g.y, g.z, groundHere, t, va);
    const vt = this.vt;
    air.sampleInto(g.x - rx, g.y - ry, g.z, groundHere, t, vt);
    const wL = vt.w;
    air.sampleInto(g.x + rx, g.y + ry, g.z, groundHere, t, vt);
    const wR = vt.w;
    // Turbulence: mechanical with the 6 m wind, convective, and the small eddies of the lee,
    // the rotor and its shear layer, the valley's shear and the thermals' edges.
    const cs = air.convectiveSigma(g.z, groundHere, g.x, g.y, this.cs);
    const U6 = U * surfaceFactor(6, z0, zr);
    const extra = Math.hypot((0.3 + 0.12 * U) * m.turbulence, 0.32 * U * rotF + 0.25 * U * rotShear, 20 * m.shear, 0.25 * leeFar * U);
    const ts = turbulenceModel(agl, U6, conv, cs.sigma, cs.length, extra, this.ts);
    // Thermal edges (and air holes): small, sharp eddies scaled by the shear there.
    const sigE = EDGE_SIGMA * va.shear;
    const tb = this.tb;
    air.turbInto(g.x, g.y, g.z, t, ts.sigU, ts.sigW, ts.Lu, ts.Lw, ts.sigX, ts.Lx, tb, false, sigE);
    const gu = tb.u;
    const gv = tb.v;
    const gw = tb.w;
    air.turbInto(g.x - rx, g.y - ry, g.z, t, 0, ts.sigW, ts.Lu, ts.Lw, ts.sigX, ts.Lx, tb, true, sigE);
    const gwL = tb.w;
    air.turbInto(g.x + rx, g.y + ry, g.z, t, 0, ts.sigW, ts.Lu, ts.Lw, ts.sigX, ts.Lx, tb, true, sigE);
    const gwR = tb.w;
    // The upslope breeze along the nearest sunny surface: up the slope, rising with it.
    let anaU = 0;
    let anaV = 0;
    let anaW = 0;
    let ana = 0;
    const ns = this.near;
    if (ns.ok) {
      this.surfSun += (ns.light - this.surfSun) * Math.min(1, dt / (ns.light < this.surfSun ? 150 : 240));
      const s = this.sun;
      ana = anabaticSpeed(ns.nx, ns.ny, ns.nz, s.x, s.y, s.z, air.season, m.surface, U) * this.surfSun;
      if (ana > 0.01) {
        const f = ana * Math.exp(-ns.d / ANA_DEPTH);
        const h = Math.hypot(ns.nx, ns.ny);
        const sinT = h;
        const cosT = ns.nz;
        // Up the slope: against the horizontal part of the normal.
        if (h > 1e-3) {
          anaU = (-ns.nx / h) * f * cosT;
          anaV = (-ns.ny / h) * f * cosT;
        }
        anaW = f * sinT;
      }
    }
    this.info.anabatic = ana;
    this.info.anabaticW = anaW;
    out.u = mu + ux * rotU + va.u + gu + anaU;
    out.v = mv + uy * rotU + va.v + gv + anaV;
    out.w = wRel + rotW + leeSink + va.w + gw + anaW;
    out.wL = wRelL + rotWL + leeSink + wL + gwL + anaW;
    out.wR = wRelR + rotWR + leeSink + wR + gwR + anaW;
    out.turbulence = clamp(ts.intensity + sigE / 1.6, 0, 1);
    out.agl = agl;
    this.cloud = va.cloud;
    const inf = this.info;
    inf.gradient = fz;
    inf.relief = wRel;
    inf.speedUp = du;
    inf.rotor = rotF;
    inf.venturi = venturi;
    inf.sigmaW = ts.sigW;
    inf.sigmaX = ts.sigX;
    inf.sigmaE = sigE;
    return out;
  }
}
