/**
 * 3D paraglider: a 25 m² EN-B canopy (50 cells, arched planform, airfoil, ballooning,
 * cell openings, stabilos; a two-colour design seen glowing through from below), its line
 * cascade, the risers and their hardware, and the pilot in a cocoon harness with the
 * cockpit. Glider frame: x right, y up, z backwards (metres), the carabiners at the origin.
 *
 * The canopy is deformed on the GPU from the glider state (brakes, speed bar, big ears,
 * asymmetric and frontal collapses, cravat, stall, spin, the inflation on the take-off);
 * the CPU only updates a few uniforms, the lines (a few hundred points) and the pilot's
 * pose: no allocation per frame. Levels of detail: full near the camera, simpler beyond
 * ~150 m and 1.2 km (other pilots), lighter canopy mesh on phones.
 * Modules: glider-shape (shape and deformations), glider-wing (canopy mesh and shader),
 * glider-lines (line cascade), glider-pilot (pilot, harness, risers, cockpit).
 */
import * as THREE from 'three';
import type { GliderState } from './flight';
import { newDeform, type WingDeform } from './glider-shape';
import { Anchor, LineSet } from './glider-lines';
import { PilotRig, lowPilotGeometry, lowPilotMaterial } from './glider-pilot';
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
  update(st: GliderState): void;
}

export interface GliderOptions {
  /** 'auto' (default): full detail near the camera, simpler far away; or one level forced. */
  lod?: 'auto' | 'high' | 'low';
}

/** Distances (m) from which the simpler levels are drawn. */
const LOD_FAR = 150;
const LOD_VERY_FAR = 1200;

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
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
  let inflating = false;
  let stand = 0;
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
      inflating = false;
      for (const l of levels) l.canopy.rotation.set(0, 0, 0);
      canopyInv.identity();
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
        // Big ears: the outer cells folded under (pulled by the outer A lines), flapping.
        le = 0.7;
        te = 0.79;
        psi = ears * 2.75 + 0.08 * Math.sin(time * 7.3 + side);
        cr = 0.03 * ears;
      }
      if (col && col.side === side && amount > 0.01 && 1 - 2.2 * amount < le) {
        // Asymmetric collapse: a diagonal fold, bigger at the leading edge.
        le = 1 - 2.2 * amount;
        te = 1 - 1.35 * amount;
        psi = Math.min(1, amount * 6) * 2.85;
        cr = 0.1;
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
    u.uBrake.value.fromArray(d.brake);
    u.uFoldL.value.fromArray(d.foldL);
    u.uFoldR.value.fromArray(d.foldR);
    u.uMisc.value.fromArray(d.misc);
    u.uInfl.value.fromArray(d.infl);
    u.uUp.value.fromArray(d.up);
  }

  function update(st: GliderState): void {
    const now = performance.now();
    const dt = last < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    time += dt;
    deform(st);
    // Standing on the take-off, into the pod once flying.
    stand = inflating ? Math.min(1, stand + dt / 0.4) : Math.max(0, stand - dt / 1.6);
    const level = lod ? lod.level : 0;
    const L = levels[level];
    if (L.rig) {
      L.rig.update({ st, stand, run: inflating ? Math.hypot(st.vx || 0, st.vy || 0) : 0, time, dt, canopyInv }, L.lines);
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
        L.lines.setAnchor(side, Anchor.Handle, side * (0.27 + 0.06 * b), 0.33 - 0.46 * b, 0.13 * b);
      }
    }
    L.lines?.update(d);
  }

  setInflation(null);
  update({ brakeL: 0, brakeR: 0, collapse: { side: 0, amount: 0, frontal: 0, cravat: 0, cravatSide: 0 } } as unknown as GliderState);
  return { root, pilot, update, setInflation };
}
