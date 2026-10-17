/**
 * 3D paraglider: a 25 m² EN-B canopy (50 cells, arched planform, airfoil, ballooning,
 * cell openings, stabilos; a two-colour design seen glowing through from below), its line
 * cascade, the risers and their hardware, and the pilot in a cocoon harness with the
 * cockpit. Glider frame: x right, y up, z backwards (metres), the carabiners at the origin.
 *
 * The canopy is deformed on the GPU from the glider state (brakes, speed bar, big ears,
 * asymmetric and frontal collapses, cravat, stall, spin, the inflation on the take-off, a
 * tip flexed by the air under it); the CPU only updates a few uniforms, the lines (a few
 * hundred points) and the pilot's pose: no allocation per frame. Levels of detail: full
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
import { newDeform, type WingDeform } from './glider-shape';
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
  /** The canopy's attitude relative to the pilot (development, tests). */
  sway?: Sway;
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
 * right, pitch + = canopy ahead) and the tips' flex (m, + = up), from the glider state.
 */
export class Sway {
  roll = 0;
  rollV = 0;
  pitch = 0;
  pitchV = 0;
  flexL = 0;
  flexR = 0;
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
    // Tips flexing up under a gust (a 2 m/s gust lifts the tip ~0.14 m), relaxing in ~0.15 s.
    const kf = Math.min(1, dt / 0.15);
    this.flexL += (clamp(0.07 * tipL, -0.22, 0.22) - this.flexL) * kf;
    this.flexR += (clamp(0.07 * tipR, -0.22, 0.22) - this.flexR) * kf;
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
    const wing = new THREE.Mesh(wingGeometry(res), wingMaterial(u, res.balloon));
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
  let inflating = false;
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
  function setInflation(theta: number | null, phi = 0, facingWing = false, ground = -1.08): void {
    if (theta === null) {
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
    const e = theta - 0.3 * (1 - smooth(0, 0.9, theta));
    const back = Math.PI / 2 - e;
    for (const l of levels) l.canopy.rotation.set(facingWing ? -back : back, facingWing ? Math.PI : 0, -phi, 'XZY');
    canopyInv.copy(levels[0].canopy.quaternion).invert();
    d.infl[0] = smooth(0.0, 0.85, theta);
    // Sections lying along the lines (flat) until they start flying.
    d.infl[1] = back * (1 - smooth(0.3, 1.3, theta));
    d.infl[2] = 1 - smooth(0.06, 0.45, theta);
    // The ground: ~1.1 m under the carabiners on a flat take-off.
    d.infl[3] = ground;
    camPos.set(0, 1, 0).applyQuaternion(canopyInv);
    d.up[0] = camPos.x;
    d.up[1] = camPos.y;
    d.up[2] = camPos.z;
  }

  function deform(st: GliderState): void {
    const col = st.collapse;
    d.brake[0] = st.brakeL || 0;
    d.brake[1] = st.brakeR || 0;
    d.brake[2] = st.speedbar || 0;
    d.brake[3] = time;
    const ears = st.ears || 0;
    const amount = col?.amount || 0;
    const cravat = col?.cravat || 0;
    for (let si = 0; si < 2; si++) {
      const side = si ? 1 : -1;
      const f = side < 0 ? d.foldL : d.foldR;
      let le = 2;
      let te = 2;
      let psi = 0;
      let cr = 0;
      if (ears > 0.01) {
        // Big ears: the outer cells folded down and back (pulled by the outer A lines),
        // hanging under the tips and flapping in the airflow.
        le = 0.72 + 0.28 * (1 - Math.min(1, ears * 1.4));
        te = le + 0.07;
        psi = Math.min(1, ears * 1.25) * (2.1 + 0.18 * Math.sin(time * 6.1 + side) + 0.08 * Math.sin(time * 13.7 + 2 * side));
        cr = 0.05 * ears;
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
    // Trailing edge trembling, stronger in incidents and fast flight.
    d.misc[1] = 0.004 + 0.004 * Math.min(1, (st.airspeed || 10) / 14) + 0.03 * Math.min(1, amount + frontal + stall + cravat);
    d.misc[2] = stall;
    d.misc[3] = spin * spinSide;
    d.flex[0] = inflating ? 0 : sway.flexL;
    d.flex[1] = inflating ? 0 : sway.flexR;
    u.uBrake.value.fromArray(d.brake);
    u.uFoldL.value.fromArray(d.foldL);
    u.uFoldR.value.fromArray(d.foldR);
    u.uMisc.value.fromArray(d.misc);
    u.uInfl.value.fromArray(d.infl);
    u.uUp.value.fromArray(d.up);
    u.uFlex.value.fromArray(d.flex);
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
    deform(st);
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
        const b = side < 0 ? st.brakeL || 0 : st.brakeR || 0;
        L.lines.setAnchor(side, Anchor.Handle, side * (0.27 + 0.04 * b), 0.36 - 0.5 * b, 0.06 + 0.07 * b);
      }
    }
    L.lines?.update(d);
  }

  setInflation(null);
  update({ brakeL: 0, brakeR: 0, collapse: { side: 0, amount: 0, frontal: 0, cravat: 0, cravatSide: 0 } } as unknown as GliderState);
  const standing = () => stand * stand * (3 - 2 * stand);
  return { root, pilot, standing, update, setInflation, sway };
}
