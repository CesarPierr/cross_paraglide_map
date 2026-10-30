/**
 * 3D paraglider: a 25 m² EN-B canopy (50 cells, arched planform, airfoil, ballooning,
 * cell openings, stabilos; a two-colour design seen glowing through from below), its line
 * cascade, the risers and their hardware, and the pilot in a cocoon harness with the
 * cockpit. Glider frame: x right, y up, z backwards (metres), the carabiners at the origin.
 *
 * The canopy is deformed on the GPU from the glider state (brakes, speed bar, big ears,
 * asymmetric and frontal collapses, cravat, stall, spin, the inflation on the take-off)
 * and from its own motion and fabric (WingDynamics: the span heaving, surging and twisting
 * in the gusts, the cells' internal pressure filling, spreading and lost in a fold, the
 * trailing edge fluttering, the folds slamming in, flapping and reopening from the centre
 * out); the CPU only updates a few uniforms and about a hundred springs, the lines (a few
 * hundred points, their bows springs too) and the pilot's pose: no allocation per frame.
 * Why a reduced model and not a cloth simulation: glider-shape.ts (WingDeform). Levels of detail: full
 * near the camera, simpler beyond ~150 m and 1.2 km (other pilots), lighter canopy mesh on
 * phones.
 *
 * The pilot is not bolted to the wing: he hangs from the carabiners, and the canopy (with
 * its lines and risers) turns about them relative to his body: a short pendulum (~1.1 s,
 * damped) driven by the roll and pitch accelerations of the whole glider (the light wing
 * leads, the heavy pilot lags), by the weight shift (the harness leans under the risers,
 * ~5° at full shift) and by the tip gusts (a lifted tip rolls the wing first). After the
 * take-off the canopy swings in from where it was on the ground.
 * Modules: glider-shape (shape and deformations), glider-wing (canopy mesh and shader),
 * glider-lines (line cascade), glider-gear (pilot and harness geometry), glider-pilot
 * (pilot's pose, risers, cockpit).
 */
import * as THREE from 'three';
import type { GliderState } from './flight';
import { DYN_N, HALF_SPAN, newDeform, type WingDeform } from './glider-shape';
import { Anchor, LineSet } from './glider-lines';
import { PilotRig, lowPilotGeometry, lowPilotMaterial, type RigInput } from './glider-pilot';
import { WING_HIGH, WING_LOW, WING_MIN, WING_PHONE, wingGeometry, wingMaterial, wingUniforms, type WingRes, type WingUniforms } from './glider-wing';

export interface GliderModel {
  root: THREE.Group;
  /**
   * On the take-off: wing elevation and side angle (see below); `ground` is the height of the
   * ground under the laid-out wing relative to the carabiners (default −1.08 m: flat).
   */
  setInflation(theta: number | null, phi?: number, facingWing?: boolean, ground?: number): void;
  /** The pilot's head (hidden in first person: the camera is in it). */
  pilot: THREE.Group;
  /** 0 seated in the harness … 1 standing on the take-off (the pose's blend, eased). */
  standing(): number;
  /** Poses the glider for this frame; `dt` (s) defaults to the time since the last call. */
  update(st: GliderState, dt?: number): void;
  /**
   * The air's turbulence 0..1 at the pilot (AirSample.turbulence), for the fabric: how much
   * the trailing edge flutters and the slack fabric shivers. Optional: without it the
   * canopy estimates it from the gusts under its tips (GliderState.tipHpL/R).
   */
  setAir(turbulence: number): void;
  /** The canopy's attitude relative to the pilot and its own motion (development, tests). */
  sway?: Sway;
  dynamics?: WingDynamics;
}

export interface GliderOptions {
  /** 'auto' (default): full detail near the camera, simpler far away; or one level forced. */
  lod?: 'auto' | 'high' | 'low';
}

/** Distances (m) from which the simpler levels are drawn. */
const LOD_FAR = 150;
const LOD_VERY_FAR = 1200;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function phone(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 700);
}

const camPos = new THREE.Vector3();
const objPos = new THREE.Vector3();
/**
 * Level of detail picked from the camera distance, also for the map's camera (a plain
 * THREE.Camera without zoom, at the anchor near the pilot), with some hysteresis.
 */
class GliderLOD extends THREE.LOD {
  level = 0;
  update(camera: THREE.Camera): void {
    const lv = this.levels;
    if (lv.length < 2) return;
    camPos.setFromMatrixPosition(camera.matrixWorld);
    objPos.setFromMatrixPosition(this.matrixWorld);
    const zoom = (camera as THREE.PerspectiveCamera).zoom;
    const d = camPos.distanceTo(objPos) / (zoom > 0 ? zoom : 1);
    let i = 0;
    for (let k = 1; k < lv.length; k++) {
      if (d >= lv[k].distance * (k <= this.level ? 0.9 : 1)) i = k;
      else break;
    }
    for (let k = 0; k < lv.length; k++) lv[k].object.visible = k === i;
    this.level = i;
  }
}

/**
 * The canopy's attitude relative to the pilot's body (rad; roll + = canopy rolled to the
 * right, pitch + = canopy ahead), from the glider state.
 */
export class Sway {
  roll = 0;
  rollV = 0;
  pitch = 0;
  pitchV = 0;
  private br = NaN;
  private pr = NaN;
  private accR = 0;
  private accP = 0;

  /** Starts from a given relative attitude (the wing as it was on the ground at lift-off). */
  reset(roll = 0, pitch = 0): void {
    this.roll = roll;
    this.pitch = pitch;
    this.rollV = 0;
    this.pitchV = 0;
    this.br = NaN;
  }

  update(st: GliderState, dt: number): void {
    if (!(dt > 0)) return;
    const br = st.bankRate || 0;
    const pr = st.pitchRate || 0;
    if (Number.isNaN(this.br)) {
      this.br = br;
      this.pr = pr;
    }
    // Roll and pitch accelerations of the whole glider, smoothed over ~0.2 s: the flight
    // model's turbulence kicks the roll rate at every 1/120 s step.
    const ka = Math.min(1, dt / 0.2);
    this.accR += (clamp((br - this.br) / dt, -15, 15) - this.accR) * ka;
    this.accP += (clamp((pr - this.pr) / dt, -15, 15) - this.accP) * ka;
    this.br = br;
    this.pr = pr;
    // The pilot under the risers: a pendulum of ~1.1 s, damping 0.4 (an estimate: the body
    // hangs ~0.3 m under its hang points, the risers' 42 cm spread stiffening it). A full
    // weight shift lowers one side of the seat by ~3.5 cm over that spread: the harness
    // leans ~5° under the risers (the canopy rolls the other way relative to the body). A
    // tip lifted by a gust rolls the wing away from it before the glider follows.
    const w = 5.7;
    const z = 0.4;
    const ws = st.weightShift || 0;
    const tipL = st.tipHpL || 0;
    const tipR = st.tipHpR || 0;
    const rollEq = -0.09 * ws;
    const drive = 0.6 * this.accR + 0.35 * clamp(tipL - tipR, -4, 4);
    // Semi-implicit Euler in steps of 1/120 s: stable at any frame rate.
    const n = Math.max(1, Math.ceil(dt * 120));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.rollV += (w * w * (rollEq - this.roll) - 2 * z * w * this.rollV + drive) * h;
      this.roll = clamp(this.roll + this.rollV * h, -0.14, 0.14);
      this.pitchV += (-w * w * this.pitch - 2 * z * w * this.pitchV + 0.8 * this.accP) * h;
      this.pitch = clamp(this.pitch + this.pitchV * h, -0.16, 0.16);
    }
  }
}

/** Damped spring towards `target`, one semi-implicit Euler step: returns the new velocity. */
function spring(x: number, v: number, target: number, w: number, z: number, h: number): number {
  return v + (w * w * (target - x) - 2 * z * w * v) * h;
}

/**
 * The canopy's own motion: a fabric wing held by its lines is not a rigid body. Per span
 * station (DYN_N, both tips included) three damped degrees of freedom — heave along the
 * section's up, surge along the chord, twist — coupled to their neighbours so that a gust
 * under one tip runs along the span as a wave and the tips, longer and softer, swing more
 * and slower (~1.6 Hz) than the centre (~3 Hz); the leading edge dents where the angle of
 * attack nears the fold. The folds themselves (collapse, big ears, cravat, frontal) are
 * springs too: a collapse sweeps in from the tip in ~0.15 s and the flap slams under the
 * wing and bounces; on reopening the fold line runs out to the tip, the cells it passes
 * kick forward and up (the bang) and the trailing edge shivers. On the take-off the tips
 * lag behind the rising centre and swing in once it is overhead.
 *
 * The fabric (`fab`, per station):
 * - internal pressure, as a share of the trim's (q·Cp ≈ 65 Pa at 38 km/h): towards
 *   (V/V_trim)² times what the cell opening catches (Cp at the inlet falls as the angle of
 *   attack nears the fold: the stagnation point leaves the opening), a gust under the
 *   station adding a little; filled through the opening in ~0.2 s (a cell of ~0.1 m³ through
 *   ~0.02 m² of opening), emptied faster where the leading edge folds or tucks (the air is
 *   squeezed out), spread to the neighbours by the cross-ports (~0.1 s per station). A
 *   collapsed part reopens where the pressure comes back: the fold line can only run out as
 *   far as the cells are full again, from the centre outwards (EN 926-2: re-inflation from
 *   the inside towards the tip);
 * - the trailing edge's flap: behind the C lines the fabric is held only by the brake lines,
 *   a light, little-damped spring (~5–6.5 Hz) shaken by the air (its noise grows with the
 *   speed, the turbulence and the incidents) and coupled along the span: it flutters;
 * - the folded part's flapping in the wake, a slower spring shaken while folded, running
 *   along the flap as waves;
 * - the depth of a frontal tuck: the centre first, the tips lagging, the fold line wavering.
 * Writes `d.dyn` and `d.fab`, filters `d.foldL/R` and `d.misc[0]` in place; no allocation.
 */
export class WingDynamics {
  /** Per station: heave, surge, twist, dent and their rates (heave, surge, twist). */
  readonly x = new Float32Array(DYN_N * 4);
  readonly v = new Float32Array(DYN_N * 3);
  /** Per station: pressure, trailing-edge flap, fold flapping, frontal tuck (WingDeform.fab), and the two flaps' rates. */
  readonly fab = new Float32Array(DYN_N * 4);
  readonly fabV = new Float32Array(DYN_N * 2);
  /** Folds per side (0 left, 1 right): leading-edge line, trailing-edge line, angle and their rates. */
  readonly fold = new Float32Array([2, 2, 0, 2, 2, 0]);
  readonly foldV = new Float32Array(6);
  frontal = 0;
  frontalV = 0;
  /** Trailing-edge shiver after a reopening (s left). */
  shiver = 0;
  /** Turbulence felt by the fabric 0..1: the air's if given (GliderModel.setAir), else from the tip gusts. */
  turbulence = 0;
  /** The air's turbulence 0..1 when the engine gives it (NaN: estimated). */
  airTurbulence = NaN;
  private br = NaN;
  private tr = 0;
  private tipL = 0;
  private tipR = 0;
  private inflLag = 0;
  private inflPrev = NaN;
  private inflating = false;
  private t = 0;
  private seed = 0x2545f491;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.x.fill(0);
    this.v.fill(0);
    this.fab.fill(0);
    for (let k = 0; k < DYN_N; k++) this.fab[k * 4] = 1;
    this.fabV.fill(0);
    this.fold.set([2, 2, 0, 2, 2, 0]);
    this.foldV.fill(0);
    this.frontal = 0;
    this.frontalV = 0;
    this.shiver = 0;
    this.turbulence = 0;
    this.br = NaN;
  }

  /** On the take-off, the wing's elevation θ (null in flight): the tips lag as it rises. */
  inflation(theta: number | null, dt: number): void {
    this.inflating = theta !== null;
    if (theta === null) {
      this.inflLag = 0;
      this.inflPrev = NaN;
      return;
    }
    const rate = Number.isNaN(this.inflPrev) || !(dt > 0) ? 0 : (theta - this.inflPrev) / dt;
    this.inflPrev = theta;
    // Behind the centre as the wing rises (more the faster), none laid out or overhead.
    this.inflLag = Math.sin(Math.PI * clamp(theta / 1.45, 0, 1)) * (0.35 + 0.5 * clamp(rate, 0, 1.5));
  }

  /** Uniform noise in −1..1 (xorshift: the same flight draws the same fabric). */
  private rnd(): number {
    let s = this.seed;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    this.seed = s;
    return (s >>> 0) / 2147483648 - 1;
  }

  update(st: GliderState, d: WingDeform, dt: number): void {
    if (!(dt > 0)) return;
    const br = st.bankRate || 0;
    const tr = st.turnRate || 0;
    const tipL = clamp(st.tipHpL || 0, -5, 5);
    const tipR = clamp(st.tipHpR || 0, -5, 5);
    if (Number.isNaN(this.br)) {
      this.br = br;
      this.tr = tr;
      this.tipL = tipL;
      this.tipR = tipR;
    }
    const accR = clamp((br - this.br) / dt, -15, 15);
    const accY = clamp((tr - this.tr) / dt, -10, 10);
    this.br = br;
    this.tr = tr;
    // Turbulence: the air's, or the rate at which the gusts under the tips change (~20 m/s²
    // in strong turbulence), over ~0.5 s.
    const gustRate = (Math.abs(tipL - this.tipL) + Math.abs(tipR - this.tipR)) / dt;
    this.tipL = tipL;
    this.tipR = tipR;
    const turbT = Number.isNaN(this.airTurbulence) ? clamp(gustRate / 25, 0, 1) : clamp(this.airTurbulence, 0, 1);
    this.turbulence += (turbT - this.turbulence) * Math.min(1, dt / 0.5);
    const turb = this.turbulence;
    const load = st.load ?? 1;
    const mC = st.marginC ?? 10;
    const mL = st.marginL ?? 10;
    const mR = st.marginR ?? 10;
    const airspeed = st.airspeed || 10.5;
    const speed = clamp(airspeed / 10.5, 0.5, 1.6);
    const stall = st.stall || 0;
    const spin = (st.spin || 0) * ((st as Partial<GliderState>).spinSide || 1);
    const col = st.collapse;
    const incident = Math.min(1, (col?.amount || 0) * 1.5 + (col?.frontal || 0) + stall + (col?.cravat || 0) * 3);
    const lag = this.inflLag;
    const n = Math.max(1, Math.ceil(dt * 120));
    const h = dt / n;
    const x = this.x;
    const v = this.v;
    const fab = this.fab;
    const fabV = this.fabV;
    const fold = this.fold;
    const fv = this.foldV;
    // The fold lines the state asks for (deform() wrote them): where the cells lose their air.
    const tLeL = Math.min(d.foldL[0], 1.6);
    const tLeR = Math.min(d.foldR[0], 1.6);
    const prevL = fold[0];
    const prevR = fold[3];
    // Folds: the targets the state asks for, reached by springs.
    for (let s = 0; s < 2; s++) {
      const f = s ? d.foldR : d.foldL;
      const o = s * 3;
      for (let i = 0; i < n; i++) {
        // The fold line: sweeps in fast, runs back out to the tip a little slower.
        const tLe = Math.min(f[0], 1.6);
        const inLe = tLe < fold[o];
        fv[o] = spring(fold[o], fv[o], tLe, inLe ? 26 : 11, inLe ? 0.8 : 0.6, h);
        fold[o] += fv[o] * h;
        fv[o + 1] = spring(fold[o + 1], fv[o + 1], Math.min(f[1], 1.6), inLe ? 26 : 11, inLe ? 0.8 : 0.6, h);
        fold[o + 1] += fv[o + 1] * h;
        // The flap slams down under the wing and bounces; flicks back past open on reopening.
        fv[o + 2] = spring(fold[o + 2], fv[o + 2], f[2], 15, 0.32, h);
        fold[o + 2] = Math.max(-0.25, fold[o + 2] + fv[o + 2] * h);
      }
    }
    // Frontal: the leading edge tucks under at once and pops back with the wing surging.
    const fr0 = this.frontal;
    for (let i = 0; i < n; i++) {
      this.frontalV = spring(this.frontal, this.frontalV, d.misc[0], 18, 0.45, h);
      this.frontal = clamp(this.frontal + this.frontalV * h, 0, 1);
    }
    if (fr0 > 0.02 && this.frontal <= 0.02 && d.misc[0] === 0) {
      for (let k = 0; k < DYN_N; k++) v[k * 3 + 1] -= 0.9;
      this.shiver = Math.max(this.shiver, 0.5);
    }
    d.misc[0] = this.frontal > 0.002 ? this.frontal : 0;
    // The span: heave, surge, twist per station; the fabric.
    const kc = 2 * Math.PI * 2.4 * ((DYN_N - 1) / 8);
    const qr = clamp(speed * speed, 0.25, 2.2);
    const tauIn = 0.18 * clamp(1 / speed, 0.7, 1.8);
    // Cross-ports: a station's pressure evens out with its neighbours' in ~0.12 s.
    const kp = Math.min(0.24, h / 0.12);
    // Noise of the trailing edge (rms, m): a few millimetres in calm air, centimetres in
    // turbulence or an incident; of the folded part (rad).
    const teAmp = 0.004 + 0.006 * clamp((airspeed - 8) / 8, 0, 1) + 0.03 * turb + 0.025 * Math.min(1, incident + this.shiver);
    for (let i = 0; i < n; i++) {
      this.t += h;
      for (let k = 0; k < DYN_N; k++) {
        const a = -1 + (2 * k) / (DYN_N - 1);
        const al = Math.abs(a);
        const al2 = al * al;
        const kL = Math.max(0, k - 1);
        const kR = Math.min(DYN_N - 1, k + 1);
        // Gust under the station (the tips' gusts high-passed by the wing's roll, zero at the centre).
        const gust = (a < 0 ? tipL : tipR) * Math.pow(al, 1.5);
        const margin = mC + ((a < 0 ? mL : mR) - mC) * al;
        // Heave: the tips softer and slower; a gust lifts its side, a roll leaves the tips behind,
        // a lull (low load) lets them droop.
        const wh = 2 * Math.PI * (3.1 - 1.5 * al2);
        const fh = 9 * gust - 0.35 * accR * a * HALF_SPAN * al - 6 * Math.max(0, 0.55 - load) * al2 - lag * 0.8 * al2 * wh * wh * 0.12;
        const ch = kc * kc * 0.45 * (x[kL * 4] + x[kR * 4] - 2 * x[k * 4]);
        v[k * 3] += (-wh * wh * x[k * 4] - 2 * 0.2 * wh * v[k * 3] + ch + fh) * h;
        // Surge: the tips lag a yaw and a rising wing on the take-off; a gust's drag pushes back.
        const ws = 2 * Math.PI * (2.4 - 1.0 * al2);
        const fs = -0.4 * accY * a * HALF_SPAN * al + 3 * Math.abs(gust) + lag * 2.4 * al2 * ws * ws;
        const cs = kc * kc * 0.35 * (x[kL * 4 + 1] + x[kR * 4 + 1] - 2 * x[k * 4 + 1]);
        v[k * 3 + 1] += (-ws * ws * x[k * 4 + 1] - 2 * 0.25 * ws * v[k * 3 + 1] + cs + fs) * h;
        // Twist: a gust raises the angle of attack, the section pitches up and back.
        const wt = 2 * Math.PI * 3.2;
        const ft = 8 * gust * speed;
        const ct = kc * kc * 0.3 * (x[kL * 4 + 2] + x[kR * 4 + 2] - 2 * x[k * 4 + 2]);
        v[k * 3 + 2] += (-wt * wt * x[k * 4 + 2] - 2 * 0.3 * wt * v[k * 3 + 2] + ct + ft) * h;
        // Dent of the leading edge: from 2° of margin before the fold down to it.
        const dentT = clamp((2 - margin) / 2.5, 0, 1) * (0.4 + 0.6 * al) + 0.6 * Math.max(0, 0.4 - load);
        x[k * 4 + 3] += (Math.min(1, dentT) - x[k * 4 + 3]) * Math.min(1, h / 0.08);
        // Frontal tuck: the centre first, the tips ~0.1 s later, the fold line wavering.
        const frT = this.frontal * (1 + 0.15 * Math.sin(this.t * 4.3 + k * 1.7) * Math.sin(this.t * 2.9 + k * 0.6));
        const fr = fab[k * 4 + 3] + (frT - fab[k * 4 + 3]) * Math.min(1, h / (0.03 + 0.1 * al2));
        fab[k * 4 + 3] = fr < 1e-3 && frT === 0 ? 0 : fr;
        // Pressure: what the opening catches, lost where the leading edge is folded or tucked.
        const side = a < 0 ? 0 : 1;
        let pT = this.inflating ? 1 : qr * (0.3 + 0.7 * smooth(-1.5, 2.5, margin)) * (1 + 0.05 * clamp(gust, -3, 3));
        const tLe = side ? tLeR : tLeL;
        if (tLe < 1.2) pT *= 1 - 0.94 * smooth(tLe - 0.04, tLe + 0.06, al);
        pT *= (1 - 0.85 * fab[k * 4 + 3]) * (1 - 0.5 * stall) * (1 - 0.45 * Math.max(0, spin * (side ? 1 : -1)) * al);
        const p = fab[k * 4];
        const pN = p + (pT - p) * Math.min(1, h / (pT < p ? 0.09 : tauIn)) + kp * (fab[kL * 4] + fab[kR * 4] - 2 * p);
        fab[k * 4] = clamp(pN, 0, 2.2);
        // Trailing edge: a light spring shaken by the air, coupled along the span.
        const wte = 2 * Math.PI * (6.5 - 1.5 * al2);
        const cte = kc * kc * 0.25 * (fab[kL * 4 + 1] + fab[kR * 4 + 1] - 2 * fab[k * 4 + 1]);
        // White noise of variance σ²: stationary rms of the oscillator σ / √(4 ζ ω³).
        const sTe = teAmp * Math.sqrt(4 * 0.12 * wte * wte * wte) * 1.732 * this.rnd() / Math.sqrt(h);
        fabV[k * 2] += (-wte * wte * fab[k * 4 + 1] - 2 * 0.12 * wte * fabV[k * 2] + cte + sTe) * h;
        // The folded part: shaken while folded, waves running along it.
        const fsd = side ? fold[3] : fold[0];
        const folded = fold[side * 3 + 2] > 0.05 ? smooth(fsd - 0.02, fsd + 0.12, al) : 0;
        const wf = 2 * Math.PI * 2.2;
        const cf = kc * kc * 0.5 * (fab[kL * 4 + 2] + fab[kR * 4 + 2] - 2 * fab[k * 4 + 2]);
        const sF = folded * 0.22 * Math.sqrt(4 * 0.2 * wf * wf * wf) * 1.732 * this.rnd() / Math.sqrt(h);
        fabV[k * 2 + 1] += (-wf * wf * fab[k * 4 + 2] - 2 * 0.2 * wf * fabV[k * 2 + 1] + cf * folded + sF) * h;
      }
      for (let k = 0; k < DYN_N; k++) {
        x[k * 4] = clamp(x[k * 4] + v[k * 3] * h, -0.6, 0.6);
        x[k * 4 + 1] = clamp(x[k * 4 + 1] + v[k * 3 + 1] * h, -0.8, 2.5);
        x[k * 4 + 2] = clamp(x[k * 4 + 2] + v[k * 3 + 2] * h, -0.2, 0.2);
        fab[k * 4 + 1] = clamp(fab[k * 4 + 1] + fabV[k * 2] * h, -0.12, 0.12);
        fab[k * 4 + 2] = clamp(fab[k * 4 + 2] + fabV[k * 2 + 1] * h, -0.6, 0.6);
      }
    }
    // The fold lines drawn: reopening, a line runs out only as far as the cells have their
    // air back (the pressure's 0.5 crossing, from the centre out); the cells it passes kick
    // forward and up.
    for (let s = 0; s < 2; s++) {
      const f = s ? d.foldR : d.foldL;
      const o = s * 3;
      const prevLe = s ? prevR : prevL;
      let front = 2;
      const c0 = (DYN_N - 1) / 2;
      for (let j = 1; j <= c0; j++) {
        const k = s ? c0 + j : c0 - j;
        const p = fab[k * 4];
        if (p < 0.5) {
          const pIn = fab[(s ? k - 1 : k + 1) * 4];
          front = (j - 1 + clamp((pIn - 0.5) / Math.max(1e-3, pIn - p), 0, 1)) / c0;
          break;
        }
      }
      if (fv[o] > 0 && fold[o] > front) {
        fold[o] = Math.max(Math.min(prevLe, 1.6), front);
        fv[o] = Math.min(fv[o], 0.5);
      }
      const le = fold[o];
      if (le > prevLe + 1e-4 && prevLe < 1) {
        const kick = clamp((le - prevLe) / dt, 0, 8);
        for (let k = 0; k < DYN_N; k++) {
          const a = -1 + (2 * k) / (DYN_N - 1);
          if ((s ? a : -a) <= 0) continue;
          const al = Math.abs(a);
          const near = 1 - clamp(Math.abs(al - le) / 0.25, 0, 1);
          v[k * 3] += 0.28 * kick * near * 0.55;
          v[k * 3 + 1] -= 0.22 * kick * near * 0.55;
        }
        this.shiver = Math.max(this.shiver, 0.6 * Math.min(1, kick / 3));
      }
      // Leaving the fold, no flap: no fold drawn.
      const open = le >= 1 && fold[o + 1] >= 1;
      f[0] = open ? 2 : le;
      f[1] = open ? 2 : Math.max(le, fold[o + 1]);
      f[2] = open || fold[o + 2] < 0.002 ? 0 : Math.max(0.002, fold[o + 2]);
    }
    this.shiver = Math.max(0, this.shiver - dt);
    d.dyn.set(x);
    d.fab.set(fab);
  }

  /** Mean speed of the span's motion (m/s): the trailing edge flutters with it. */
  energy(): number {
    let e = 0;
    for (let k = 0; k < DYN_N; k++) e += Math.abs(this.v[k * 3]) + Math.abs(this.v[k * 3 + 1]);
    return e / DYN_N;
  }
}

interface Level {
  group: THREE.Group;
  canopy: THREE.Group;
  lines: LineSet | null;
  rig: PilotRig | null;
}

function makeLevel(u: WingUniforms, res: WingRes | null, lines: 'high' | 'low' | null, pilot: 'high' | 'low' | null): Level {
  const group = new THREE.Group();
  const canopy = new THREE.Group();
  group.add(canopy);
  if (res) {
    const wing = new THREE.Mesh(wingGeometry(res), wingMaterial(u, res.balloon, res.wrinkles));
    wing.frustumCulled = false;
    canopy.add(wing);
  }
  const ls = lines ? new LineSet(lines) : null;
  if (ls) canopy.add(ls.mesh);
  let rig: PilotRig | null = null;
  if (pilot === 'high') {
    rig = new PilotRig();
    group.add(rig.body);
    canopy.add(rig.risers);
  } else if (pilot === 'low') {
    const m = new THREE.Mesh(lowPilotGeometry(), lowPilotMaterial());
    group.add(m);
  }
  return { group, canopy, lines: ls, rig };
}

export function buildGlider(colors = { main: 0xd62f2f, stripe: 0xf4f1ea, under: 0xb8b2aa }, opts: GliderOptions = {}): GliderModel {
  const root = new THREE.Group();
  const u = wingUniforms(colors);
  const mode = opts.lod ?? 'auto';
  const levels: Level[] = [];
  if (mode !== 'low') levels.push(makeLevel(u, phone() ? WING_PHONE : WING_HIGH, 'high', 'high'));
  if (mode !== 'high') levels.push(makeLevel(u, WING_LOW, 'low', 'low'));
  if (mode === 'auto') levels.push(makeLevel(u, WING_MIN, null, null));
  let lod: GliderLOD | null = null;
  if (levels.length > 1) {
    lod = new GliderLOD();
    levels.forEach((l, i) => lod!.addLevel(l.group, i === 0 ? 0 : i === 1 ? LOD_FAR : LOD_VERY_FAR));
    root.add(lod);
  } else root.add(levels[0].group);
  const full = levels[0].rig ? levels[0] : null;
  const pilot = full?.rig?.pilot ?? new THREE.Group();

  const d: WingDeform = newDeform();
  const canopyInv = new THREE.Quaternion();
  const sway = new Sway();
  const dyn = new WingDynamics();
  let dynIdle = false;
  let inflating = false;
  let theta: number | null = null;
  let stand = 0;
  const rigIn: RigInput = { st: null as unknown as GliderState, stand: 0, run: 0, dt: 0, canopyInv };
  let last = -1;
  let time = 0;

  /**
   * Wing position on the ground: elevation θ (0 laid out, π/2 overhead) and side angle φ
   * (+ = to the right); in a reverse launch it is in front of the pilot, who faces it.
   * null in flight. The wing lies flat in a crescent behind the pilot, its cells empty;
   * they fill from the leading edge as it rises, and it flies once overhead.
   */
  function setInflation(th: number | null, phi = 0, facingWing = false, ground = -1.08): void {
    theta = th;
    if (th === null) {
      if (inflating) {
        // Lift-off: the canopy swings on from where it was (a little behind, to a side).
        const c = levels[0].canopy.rotation;
        sway.reset(clamp(-c.z, -0.14, 0.14), clamp(-c.x, -0.16, 0.16));
      }
      inflating = false;
      d.infl[0] = 1;
      d.infl[1] = 0;
      d.infl[2] = 0;
      d.infl[3] = -100;
      d.up[0] = 0;
      d.up[1] = 1;
      d.up[2] = 0;
      return;
    }
    inflating = true;
    // Line elevation: the wing starts on the ground, below the carabiners.
    const e = th - 0.3 * (1 - smooth(0, 0.9, th));
    const back = Math.PI / 2 - e;
    for (const l of levels) l.canopy.rotation.set(facingWing ? -back : back, facingWing ? Math.PI : 0, -phi, 'XZY');
    canopyInv.copy(levels[0].canopy.quaternion).invert();
    d.infl[0] = smooth(0.0, 0.85, th);
    // Sections lying along the lines (flat) until they start flying.
    d.infl[1] = back * (1 - smooth(0.3, 1.3, th));
    d.infl[2] = 1 - smooth(0.06, 0.45, th);
    // The ground: ~1.1 m under the carabiners on a flat take-off.
    d.infl[3] = ground;
    camPos.set(0, 1, 0).applyQuaternion(canopyInv);
    d.up[0] = camPos.x;
    d.up[1] = camPos.y;
    d.up[2] = camPos.z;
  }

  function deform(st: GliderState, dt: number): void {
    const col = st.collapse;
    d.brake[0] = st.brakeL || 0;
    d.brake[1] = st.brakeR || 0;
    d.brake[2] = st.speedbar || 0;
    d.brake[3] = time;
    const ears = st.ears || 0;
    // A collapse stays folded most of the time the flight model gives it and pops open at
    // the end (the flight model lets its size fall steadily; the springs below do the pop).
    const peak = col?.peak ?? 0;
    const raw = col?.amount || 0;
    const amount = peak > raw && raw > 0 ? peak * smooth(0.04, 0.32, raw / peak) * (0.8 + 0.2 * (raw / peak)) : raw;
    const cravat = col?.cravat || 0;
    for (let si = 0; si < 2; si++) {
      const side = si ? 1 : -1;
      const f = side < 0 ? d.foldL : d.foldR;
      let le = 2;
      let te = 2;
      let psi = 0;
      let cr = 0;
      if (ears > 0.01) {
        // Big ears: the outer cells folded down along a diagonal from the outer A tab (pulled
        // by the outer A lines), hanging nearly upright beside the narrowed wing and flapping.
        le = 0.64 + 0.36 * (1 - Math.min(1, ears * 1.4));
        te = le + 0.12;
        psi = Math.min(1, ears * 1.25) * (1.45 + 0.14 * Math.sin(time * 6.1 + side) + 0.07 * Math.sin(time * 13.7 + 2 * side));
        cr = 0.04 * ears;
      }
      if (col && col.side === side && amount > 0.01 && 1 - 2.2 * amount < le) {
        // Asymmetric collapse: a diagonal fold, bigger at the leading edge, the folded part
        // hanging under the wing and back, crumpled and flapping.
        le = 1 - 2.2 * amount;
        te = 1 - 1.35 * amount;
        psi = Math.min(1, amount * 6) * (2.45 + 0.12 * Math.sin(time * 5.3 + side));
        cr = 0.12;
      }
      if (col && col.cravatSide === side && cravat > 0.01 && 1 - 1.7 * cravat < le) {
        // Cravat: the tip caught in the lines, twisted and flapping.
        le = 1 - 1.7 * cravat;
        te = le + 0.06;
        psi = 2.3 * Math.min(1, cravat * 8) + 0.15 * Math.sin(time * 11 + side);
        cr = 0.18;
      }
      f[0] = le;
      f[1] = te;
      f[2] = psi;
      f[3] = cr;
    }
    const frontal = col?.frontal || 0;
    const stall = st.stall || 0;
    const spin = st.spin || 0;
    const spinSide = (st as Partial<GliderState>).spinSide || Math.sign((st.brakeR || 0) - (st.brakeL || 0)) || 1;
    d.misc[0] = frontal;
    d.misc[2] = stall;
    d.misc[3] = spin * spinSide;
    // The canopy's own motion; the folds reached by springs (not for a glider beyond
    // ~150 m: its folds as the state gives them, no motion of its own).
    dyn.inflation(theta, dt);
    if (!lod || lod.level === 0) {
      dyn.update(st, d, dt);
      dynIdle = false;
    } else {
      if (!dynIdle) {
        dyn.reset();
        d.dyn.fill(0);
        d.fab.set(dyn.fab);
        dynIdle = true;
      }
      // Far away: the fabric full, a frontal as the state gives it.
      for (let k = 0; k < DYN_N; k++) d.fab[k * 4 + 3] = d.misc[0];
    }
    // The lines' pull on the tabs (the wrinkles under them) and the air's shaking.
    d.air[0] = clamp(st.load ?? 1, 0, 2.5);
    d.air[1] = dyn.turbulence;
    // Trailing edge trembling, stronger in fast flight, when the span moves, in incidents
    // and just after a reopening.
    d.misc[1] = 0.004 + 0.004 * Math.min(1, (st.airspeed || 10) / 14) + 0.012 * Math.min(1, dyn.energy()) + 0.03 * Math.min(1, amount + d.misc[0] + stall + cravat + dyn.shiver);
    u.uBrake.value.fromArray(d.brake);
    u.uFoldL.value.fromArray(d.foldL);
    u.uFoldR.value.fromArray(d.foldR);
    u.uMisc.value.fromArray(d.misc);
    u.uInfl.value.fromArray(d.infl);
    u.uUp.value.fromArray(d.up);
    u.uDyn.value.set(d.dyn);
    u.uFab.value.set(d.fab);
    u.uAir.value.fromArray(d.air);
  }

  function update(st: GliderState, step?: number): void {
    const now = performance.now();
    const dt = step !== undefined ? Math.min(0.1, Math.max(0, step)) : last < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    time += dt;
    if (!inflating) {
      // In flight the canopy turns about the carabiners relative to the pilot.
      sway.update(st, dt);
      for (const l of levels) l.canopy.rotation.set(-sway.pitch, 0, -sway.roll);
      canopyInv.copy(levels[0].canopy.quaternion).invert();
    }
    deform(st, dt);
    // Standing on the take-off, into the pod once flying.
    stand = inflating ? Math.min(1, stand + dt / 0.4) : Math.max(0, stand - dt / 1.6);
    const level = lod ? lod.level : 0;
    const L = levels[level];
    if (L.rig) {
      rigIn.st = st;
      rigIn.stand = stand;
      rigIn.run = inflating ? Math.hypot(st.vx || 0, st.vy || 0) : 0;
      rigIn.dt = dt;
      L.rig.update(rigIn, L.lines);
      if (!L.rig.pilot.visible) L.rig.updateInstrument(st, now, dt);
    } else if (L.lines) {
      for (let si = 0; si < 2; si++) {
        const side = si ? 1 : -1;
        L.lines.setAnchor(side, Anchor.A, side * 0.24, 0.47, -0.07);
        L.lines.setAnchor(side, Anchor.A2, side * 0.26, 0.46, -0.05);
        L.lines.setAnchor(side, Anchor.B, side * 0.25, 0.47, -0.01);
        L.lines.setAnchor(side, Anchor.C, side * 0.24, 0.46, 0.05);
        L.lines.setAnchor(side, Anchor.Pulley, side * 0.25, 0.43, 0.07);
        // The handle's swivel as the posed rig puts it (glider-pilot.ts), hands up to the hips.
        const b = side < 0 ? st.brakeL || 0 : st.brakeR || 0;
        L.lines.setAnchor(side, Anchor.Handle, side * (0.225 + 0.03 * b + 0.04 * Math.sin(Math.PI * b)), 0.33 - 0.45 * b, 0.036 + 0.07 * b);
      }
    }
    L.lines?.update(d);
  }

  setInflation(null);
  update({ brakeL: 0, brakeR: 0, collapse: { side: 0, amount: 0, frontal: 0, cravat: 0, cravatSide: 0 } } as unknown as GliderState);
  const standing = () => stand * stand * (3 - 2 * stand);
  const setAir = (turbulence: number) => {
    dyn.airTurbulence = turbulence;
  };
  return { root, pilot, standing, update, setInflation, setAir, sway, dynamics: dyn };
}
