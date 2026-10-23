/**
 * The pilot and his gear posed every frame (geometry in glider-gear.ts), in the glider frame
 * (x right, y up, z back, carabiners at the origin):
 * - seated, reclined ~35° in a cocoon harness in flight, the head upright; standing leaning
 *   a little forward, then running on the take-off (`stand`, eased); the eyes always where
 *   the first-person camera is (world.ts EYE and EYE_STANDING), the body sinking in the
 *   harness under load as the camera does;
 * - the torso (with the seat shell and the rear fairing) pivots about the hips: standing,
 *   the fairing turns up behind the back and sags a little; the speedbag hangs from the
 *   front of the seat: along the legs in flight, limp down the shins on the ground,
 *   swinging with the run;
 * - legs folded into the speedbag in flight; on the ground a gait cycle (cadence and stride
 *   from the run speed, the foot planted while under the body, lifted while it swings
 *   forward, the body lowest at mid-stance), solved by two-bone inverse kinematics;
 * - arms by two-bone inverse kinematics after photos of pilots in pods: hands up, the fists
 *   at the eyes' height just under the pulleys, forearms nearly upright and the elbows low
 *   against the harness's sides; braking, down to the hips with the elbows out and back; on
 *   the outer A lines with big ears; on the take-off holding the risers out and back, round
 *   the carabiners with them as the wing rises. The gloves hold their brake handles like a
 *   stick (the line from the top of the fist), the wrist bent towards the line;
 * - the head compensates part of the bank and of the pendulum's pitch as the camera does
 *   (up to what the neck allows: the horizon tilts in a spiral), and looks into the turn;
 * - the risers (canopy frame) run from the carabiners to the maillons, shortened by the
 *   speed bar; the brake lines from the pulleys to the handles' swivels; the speed lines
 *   from the speedbag to the risers.
 * No allocation per frame; geometries and materials are shared by every glider.
 */
import * as THREE from 'three';
import type { GliderState } from './flight';
import { Anchor, type LineSet } from './glider-lines';
import {
  BODY,
  C,
  CARABINER_X,
  EYE_SEATED,
  EYE_STANDING,
  FAIRING_HINGE_T,
  FEET_Y,
  GRIP,
  NECK_T,
  POD_HINGE_T,
  POD_SPEED_EXIT,
  R,
  SEATED,
  SHOULDER_T,
  STANDING,
  STRAP_CHEST_T,
  SWIVEL,
  at,
  bootGeometry,
  carabinerGeometry,
  fairingGeometry,
  finish,
  forearmGeometry,
  gearMaterial,
  gloveGeometry,
  headGeometry,
  hipFor,
  lowPilotGeometry,
  maillonGeometry,
  merge,
  podGeometry,
  screenGeometry,
  shellGeometry,
  shinGeometry,
  strapGeometry,
  thighGeometry,
  torsoGeometry,
  torsoToGlider,
  upperArmGeometry,
  type Geo,
} from './glider-gear';

export { lowPilotGeometry };

/**
 * Roll and pitch (rad) of the glider that the pilot's head levels out, as the first-person
 * camera in it does (world.ts): about a third of a thermalling turn's bank and half of the
 * pendulum's small swings, but the neck stops at ~15° of roll and ~8° of pitch, so in a
 * spiral dive or a wingover the horizon tilts away and the ground comes in front of the eyes.
 */
export const headRoll = (bank: number) => 0.27 * Math.tanh(bank / 0.75);
export const headPitch = (pitch: number) => 0.14 * Math.tanh(pitch / 0.28);
export function lowPilotMaterial(): THREE.Material {
  return gearMaterial();
}

// ---------------------------------------------------------------------------------------
// Risers and their hardware (canopy frame).

/**
 * Riser layout (right side; x mirrored on the left): webbing from the carabiner to the
 * maillon, A (with the split A' of the outer A lines, for big ears), B, C. Risers ~50 cm
 * long; the speed bar shortens A by 12 cm and B by 10.5 cm, C not at all (Independence
 * Cruiser manual; a 3-liner EN-B is rigged the same way).
 */
const RISERS = [
  { id: Anchor.A, color: 0xb8232a, dz: -0.009, top: [0.238, 0.47, -0.074], bar: 0.12 },
  { id: Anchor.A2, color: 0xb8232a, dz: -0.006, top: [0.262, 0.462, -0.05], bar: 0.12 },
  { id: Anchor.B, color: 0x2a2c31, dz: 0.0, top: [0.248, 0.468, -0.012], bar: 0.105 },
  { id: Anchor.C, color: 0x2a2c31, dz: 0.009, top: [0.24, 0.462, 0.048], bar: 0 },
] as const;
/** Brake pulley on the C riser, speed-system pulley on the A riser, top of the carabiner (riser loops). */
const PULLEY = new THREE.Vector3(0.252, 0.426, 0.072);
const RISER_PULLEY = new THREE.Vector3(0.214, 0.1, -0.03);
const LOOP_Y = 0.036;

/** Woven webbing with its selvedges, bar-tacks and label (greyscale, tinted per riser). */
function webbingTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#bdbdbd';
  g.fillRect(0, 0, 32, 512);
  for (let y = 0; y < 512; y += 3) {
    g.fillStyle = y % 6 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
    g.fillRect(0, y, 32, 1);
  }
  for (let x = 0; x < 32; x += 4) {
    g.fillStyle = 'rgba(0,0,0,0.07)';
    g.fillRect(x, 0, 1, 512);
  }
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(0, 0, 2, 512);
  g.fillRect(30, 0, 2, 512);
  g.strokeStyle = 'rgba(245,245,245,0.85)';
  g.lineWidth = 1.2;
  for (const y0 of [8, 34, 380, 470, 496]) {
    g.beginPath();
    for (let i = 0; i <= 14; i++) g.lineTo(4 + (i % 2) * 24, y0 + i * 1.3);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(6, 300, 20, 46);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(9, 306, 14, 2);
  g.fillRect(9, 312, 10, 2);
  g.fillRect(9, 318, 13, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let webMat: THREE.MeshStandardMaterial | null = null;
function webbingMaterial(): THREE.MeshStandardMaterial {
  return (webMat ??= new THREE.MeshStandardMaterial({ map: webbingTexture(), roughness: 0.85, metalness: 0 }));
}

/** Geometries shared by every glider's rig (built once). */
let sharedGeo: ReturnType<typeof buildShared> | null = null;
function buildShared() {
  const hw: Geo[] = [];
  for (const s of [-1, 1]) {
    // Brake pulley (sheave and its plate), the toggle's magnet on the C riser below it, the speed-system pulley.
    hw.push(finish(new THREE.CylinderGeometry(0.0085, 0.0085, 0.007, 14), C.metal, R.metal, at(s * PULLEY.x, PULLEY.y, PULLEY.z, 0, 0, Math.PI / 2)));
    hw.push(finish(new THREE.TorusGeometry(0.0095, 0.0017, 6, 14), C.metal, R.metal, at(s * PULLEY.x, PULLEY.y + 0.002, PULLEY.z, 0, Math.PI / 2, 0)));
    hw.push(finish(new THREE.CylinderGeometry(0.0085, 0.0085, 0.008, 14), C.plastic, R.plastic, at(s * 0.241, 0.376, 0.041, 0, 0, Math.PI / 2)));
    hw.push(finish(new THREE.CylinderGeometry(0.0065, 0.0065, 0.006, 12), C.metal, R.metal, at(s * RISER_PULLEY.x, RISER_PULLEY.y, RISER_PULLEY.z, 0, 0, Math.PI / 2)));
  }
  const ring = (g: Geo) => finish(g, C.strap, R.fabric);
  return {
    torso: torsoGeometry(),
    shell: shellGeometry(),
    fairing: fairingGeometry(),
    pod: podGeometry(),
    screen: screenGeometry(),
    head: headGeometry(),
    upper: upperArmGeometry(),
    fore: forearmGeometry(),
    gloveL: gloveGeometry(false),
    gloveR: gloveGeometry(true),
    thigh: thighGeometry(),
    shin: shinGeometry(),
    boot: bootGeometry(),
    carab: carabinerGeometry(),
    riser: strapGeometry(0.017, 0.0026),
    harnessStrap: ring(strapGeometry(0.032, 0.004)),
    maillon: maillonGeometry(),
    hardware: merge(hw),
  };
}
function shared() {
  return (sharedGeo ??= buildShared());
}

// ---------------------------------------------------------------------------------------
// Pose helpers.

const Y = new THREE.Vector3(0, 1, 0);
const tA = new THREE.Vector3();
const tB = new THREE.Vector3();
const tC = new THREE.Vector3();
const tD = new THREE.Vector3();
const tE = new THREE.Vector3();
const tF = new THREE.Vector3();
const tQ = new THREE.Quaternion();
const qUp = new THREE.Quaternion();
const qCan = new THREE.Quaternion();
const vUp = new THREE.Vector3();
const vPivot = new THREE.Vector3();
const tM = new THREE.Matrix4();
const tS = new THREE.Vector3(1, 1, 1);
const T3 = new THREE.Vector3();
const tL = new THREE.Vector3();
const tG = new THREE.Vector3();
const tH = new THREE.Vector3();
const tP = new THREE.Vector3();

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Places a mesh built along +y from `a` towards `b`. */
function alignBone(o: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  T3.subVectors(b, a).normalize();
  o.position.copy(a);
  o.quaternion.setFromUnitVectors(Y, T3);
}

/** Seated legs in the speedbag: thigh rising 8° forward, shank 22° below the horizontal (angles from straight down, + forward). */
const THIGH_SEATED = 1.71;
const SHIN_SEATED = 1.19;
/**
 * Fists on the handles (glider frame, right hand): hands up just under the pulley at the
 * eyes' height, just outside the risers and ~33 cm ahead of the face, ~44 cm from the eye
 * (a fist, not a block at the edge of the view; photos of pod harnesses in flight:
 * Advance Impress 4 and Lightness 3, Supair Evo Lite 2, Neo Suspender); full brake at the
 * hips; big ears (outer A lines pulled down). A light brake (~25 %) brings them to the chin
 * and the shoulders, as when thermalling.
 */
const HAND_UP = new THREE.Vector3(0.29, 0.3, 0.01);
const HAND_FULL = new THREE.Vector3(0.3, -0.2, 0.13);
const HAND_EARS = new THREE.Vector3(0.335, 0.24, -0.1);
/**
 * On the take-off (before the canopy's turn about the carabiners, see poseArms): the hands
 * hold the risers and the handles out and back like wings, the arms nearly straight behind
 * the hips while the wing lies behind, raised with it as it comes up.
 */
const HAND_GROUND = new THREE.Vector3(0.44, 0.42, 0.04);
/**
 * Elbow directions (glider frame, right arm): hands up, the elbows low and close to the
 * harness's sides, a little ahead (the forearms nearly upright, as in the photos); hands
 * at the hips, out and back; on the take-off, back and a little out (the arms behind).
 */
const POLE_UP = new THREE.Vector3(0.15, -0.9, -0.35);
const POLE_DOWN = new THREE.Vector3(0.55, -0.35, 0.75);
const POLE_GROUND = new THREE.Vector3(0.35, -0.3, 0.9);
/** A raised fist's natural turn (thumb up, a little in and ahead), where the line runs along the forearm. */
const THUMB_REST = new THREE.Vector3(-0.45, 0.85, -0.25);
/**
 * Standing, the fairing turns up with the back, then sags back this much under its weight
 * (rad) and shrinks a little, slack without the airflow.
 */
const FAIRING_SAG = 0.55;
const FAIRING_SLACK = 0.2;

export interface RigInput {
  st: GliderState;
  /** 0 seated in the pod … 1 standing on the take-off. */
  stand: number;
  /** Running speed on the ground (m/s), for the gait; the frame's time step (s). */
  run: number;
  dt: number;
  /** Glider frame → canopy frame (the canopy turns about the carabiners). */
  canopyInv: THREE.Quaternion;
}

export class PilotRig {
  /** Head and neck: hidden in first person (the camera is in it). */
  readonly pilot = new THREE.Group();
  /** Body, harness, arms, legs: in the glider frame. */
  readonly body = new THREE.Group();
  /** Risers and their hardware: in the canopy frame. */
  readonly risers = new THREE.Group();
  readonly instrument: THREE.Mesh;
  private pelvis = new THREE.Group();
  private fairing = new THREE.Group();
  private pod = new THREE.Group();
  private legs: THREE.Mesh[] = [];
  private upper: THREE.Mesh[] = [];
  private fore: THREE.Mesh[] = [];
  private gloves: THREE.Mesh[] = [];
  private straps: THREE.InstancedMesh;
  private maillons: THREE.InstancedMesh;
  private harnessStraps: THREE.InstancedMesh;
  private hip = new THREE.Vector3();
  private recline: number = SEATED.recline;
  private hands = [new THREE.Vector3(), new THREE.Vector3()];
  private swivels = [new THREE.Vector3(), new THREE.Vector3()];
  private joints = [0, 1].map(() => ({ shoulder: new THREE.Vector3(), elbow: new THREE.Vector3(), wrist: new THREE.Vector3(), grip: new THREE.Vector3() }));
  private phase = 0;
  private headYaw = 0;
  /** Speedbag bumping about its hinge in flight (rad, rad/s). */
  private podSwing = 0;
  private podSwingV = 0;
  private lastVz = 0;
  private screen: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; next: number; vario: number } | null = null;

  constructor() {
    const m = gearMaterial();
    const G = shared();
    this.body.add(this.pelvis, this.pod);
    this.pelvis.add(new THREE.Mesh(G.torso, m), new THREE.Mesh(G.shell, m), this.fairing);
    this.fairing.position.set(FAIRING_HINGE_T[0], FAIRING_HINGE_T[1], FAIRING_HINGE_T[2]);
    this.fairing.add(new THREE.Mesh(G.fairing, m));
    this.pod.add(new THREE.Mesh(G.pod, m));
    const screen = new THREE.Mesh(G.screen, new THREE.MeshBasicMaterial({ color: 0xc9cdc0, toneMapped: false }));
    this.pod.add(screen);
    this.instrument = screen;
    this.pilot.add(new THREE.Mesh(G.head, m));
    this.body.add(this.pilot);
    for (let i = 0; i < 2; i++) {
      for (const g of [G.thigh, G.shin, G.boot]) {
        const mesh = new THREE.Mesh(g, m);
        this.legs.push(mesh);
        this.body.add(mesh);
      }
      const u = new THREE.Mesh(G.upper, m);
      const f = new THREE.Mesh(G.fore, m);
      // The glove holds its brake handle (one mesh).
      const gl = new THREE.Mesh(i ? G.gloveR : G.gloveL, m);
      this.upper.push(u);
      this.fore.push(f);
      this.gloves.push(gl);
      this.body.add(u, f, gl);
    }
    this.body.add(new THREE.Mesh(G.carab, m));
    this.harnessStraps = new THREE.InstancedMesh(G.harnessStrap, m, 4);
    this.body.add(this.harnessStraps);
    this.straps = new THREE.InstancedMesh(G.riser, webbingMaterial(), 8);
    this.maillons = new THREE.InstancedMesh(G.maillon, m, 8);
    const c = new THREE.Color();
    for (let s = 0; s < 2; s++) RISERS.forEach((r, i) => this.straps.setColorAt(s * 4 + i, c.setHex(r.color)));
    this.risers.add(this.straps, this.maillons, new THREE.Mesh(G.hardware, m));
    for (const o of [this.straps, this.maillons, this.harnessStraps]) o.frustumCulled = false;
  }

  /** Poses the rig and gives the line anchors (canopy frame) to `lines`. */
  update(inp: RigInput, lines: LineSet | null): void {
    const st = inp.st;
    const dt = clamp(inp.dt, 1e-3, 0.1);
    const k = inp.stand * inp.stand * (3 - 2 * inp.stand);
    const v = Math.max(0, inp.run || 0);
    const sb = st.speedbar || 0;
    const ears = st.ears || 0;
    // Gait: a stride cycle per ~0.75 s jogging, ~0.6 s sprinting (cadence ~2.6–3.3 steps/s).
    const runK = k * smooth(0.25, 1.4, v);
    if (v > 0.05) this.phase = (this.phase + dt * 2 * Math.PI * (1.05 + 0.12 * Math.min(v, 5))) % (2 * Math.PI);
    const vs = clamp(v / 4, 0, 1);
    // Pose: reclined in the pod, standing leaning a little forward, more so running (the
    // pilot leans into the harness), the head up looking ahead.
    const recline = mix(SEATED.recline, STANDING.recline - 0.2 * vs, k);
    const headP = mix(SEATED.head, STANDING.head + 0.12 * vs, k);
    this.recline = recline;
    // Under load the body sinks in the harness as the first-person eye does (world.ts).
    const sag = 0.05 * clamp((st.load || 1) - 1, 0, 3) * (1 - k);
    // Running: lowest at mid-stance of either foot.
    const bounce = 0.03 * runK * (0.5 + 0.5 * Math.cos(2 * this.phase));
    hipFor(mix(EYE_SEATED[1], EYE_STANDING[1], k) - sag - bounce, mix(EYE_SEATED[2], EYE_STANDING[2], k), recline, headP, this.hip);
    this.pelvis.position.copy(this.hip);
    this.pelvis.rotation.set(recline, 0, 0);

    // Head on the neck: part of the bank and of the pitch compensated (as the camera), turned
    // into the turn with a lag.
    torsoToGlider(NECK_T, this.hip, recline, tA);
    this.pilot.position.copy(tA);
    const fly = 1 - k;
    const look = clamp(0.8 * (st.turnRate || 0) + 0.2 * (st.bank || 0), -0.7, 0.7) * fly;
    this.headYaw += (look - this.headYaw) * Math.min(1, dt / 0.4);
    this.pilot.rotation.set(headP + headPitch(st.pitch || 0) * fly, -this.headYaw, headRoll(st.bank || 0) * fly, 'YXZ');

    // Rear fairing: behind the back in flight; standing, it turns up with the back (sewn to
    // the seat and the back plate) and sags back a little (photos of pilots walking to the
    // take-off: a rigid fairing stands behind the shoulders).
    this.fairing.rotation.set(FAIRING_SAG * k, 0, 0);
    this.fairing.scale.setScalar(1 - FAIRING_SLACK * k);

    // Speedbag: bumped in flight by the vertical accelerations (turbulence), a damped
    // spring about its hinge; running, kicked forward by the knees at each step and lifted
    // by the airflow of the run.
    const vz = st.vz || 0;
    const acc = clamp((vz - this.lastVz) / dt, -30, 30);
    this.lastVz = vz;
    const w0 = 9;
    this.podSwingV += (-w0 * w0 * this.podSwing - 2 * 0.3 * w0 * this.podSwingV + 0.15 * acc * fly) * dt;
    this.podSwing = clamp(this.podSwing + this.podSwingV * dt, -0.2, 0.2);
    const podRun = runK * (0.22 + 0.12 * Math.sin(2 * this.phase + 0.5));
    torsoToGlider(POD_HINGE_T, this.hip, recline, tA);
    this.pod.position.copy(tA);
    this.pod.rotation.set(-1.45 * k + this.podSwing + podRun, 0, 0);
    // Hanging empty it is limp: flat against the legs and bunched up, down to the shins (a
    // Supair Strike 2 on the take-off); pushing the bar stretches the legs in flight.
    this.pod.scale.set(1, 1 - 0.55 * k, (1 - 0.4 * k) * (1 + 0.05 * sb * fly));

    this.poseLegs(k, runK, v);
    this.poseArms(inp, ears, k);
    this.poseHarnessStraps();
    if (lines) this.anchors(inp, lines, sb, ears);
  }

  private poseLegs(k: number, runK: number, v: number): void {
    const show = k > 0.02;
    const stride = Math.min(0.11 * Math.min(v, 4), 0.42);
    const standK = 1 - smooth(0.3, 1.5, v);
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1;
      const thighM = this.legs[s * 3];
      const shinM = this.legs[s * 3 + 1];
      const bootM = this.legs[s * 3 + 2];
      thighM.visible = shinM.visible = bootM.visible = show;
      if (!show) continue;
      const psi = this.phase + (s ? Math.PI : 0);
      const hx = this.hip.x + sg * BODY.hipHalf;
      const hy = this.hip.y;
      const hz = this.hip.z;
      // Foot: under the body, the left one a little ahead (launch stance); running, ahead
      // while it swings forward (lifted), back while planted.
      const footZ = hz - 0.05 + sg * -0.07 * standK - stride * Math.sin(psi) * runK;
      const lift = (0.05 + 0.03 * Math.min(v, 4)) * Math.pow(Math.max(0, Math.cos(psi)), 1.5) * runK;
      const ankleY = FEET_Y + BODY.ankle + lift;
      const dy = ankleY - hy;
      const dz = footZ - hz;
      const d = clamp(Math.hypot(dy, dz), 0.3, BODY.thigh + BODY.shin - 1e-3);
      const base = Math.atan2(-dz, -dy);
      const cosH = (BODY.thigh * BODY.thigh + d * d - BODY.shin * BODY.shin) / (2 * BODY.thigh * d);
      const thighIK = base + Math.acos(clamp(cosH, -1, 1));
      const ky = hy - BODY.thigh * Math.cos(thighIK);
      const kz = hz - BODY.thigh * Math.sin(thighIK);
      const shinIK = Math.atan2(-(footZ - kz), -(ankleY - ky));
      const th = mix(THIGH_SEATED, thighIK, k);
      const sh = mix(SHIN_SEATED, shinIK, k);
      tA.set(hx, hy, hz);
      tE.set(0, -Math.cos(th), -Math.sin(th));
      thighM.position.copy(tA);
      thighM.quaternion.setFromUnitVectors(Y, tE);
      tD.copy(tA).addScaledVector(tE, BODY.thigh);
      tE.set(0, -Math.cos(sh), -Math.sin(sh));
      shinM.position.copy(tD);
      shinM.quaternion.setFromUnitVectors(Y, tE);
      tD.addScaledVector(tE, BODY.shin);
      bootM.position.copy(tD);
      // Seated the sole is on the foot plate (square to the shank); standing it is flat,
      // heel striking ahead, toes pushing off behind.
      const footRot = runK * (0.3 * Math.sin(psi) - 0.25 * Math.max(0, Math.cos(psi)));
      bootM.rotation.set(mix(sh, footRot, k), 0, 0);
    }
  }

  private poseArms(inp: RigInput, ears: number, k: number): void {
    const st = inp.st;
    // On the ground the hands hold the risers too and go round the carabiners with them as
    // the wing rises (behind the pilot in a forward launch, in front facing the wing).
    vUp.copy(Y).applyQuaternion(qCan.copy(inp.canopyInv).invert());
    qUp.setFromUnitVectors(Y, vUp);
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1;
      const b = clamp((s ? st.brakeR : st.brakeL) || 0, 0, 1);
      const h = this.hands[s];
      // In flight: from under the pulley down to the hips, bulging out and forward on the way.
      const bulge = Math.sin(Math.PI * b);
      h.lerpVectors(HAND_UP, HAND_FULL, b);
      h.x += 0.04 * bulge;
      h.z -= 0.03 * bulge;
      if (ears > 0) h.lerp(HAND_EARS, Math.min(1, ears * 1.5));
      // On the take-off: holding the risers, lower and further back with a dab of brake.
      tP.lerpVectors(POLE_UP, POLE_DOWN, smooth(0.15, 0.9, b));
      if (k > 0) {
        h.lerp(tG.set(HAND_GROUND.x, HAND_GROUND.y - 0.3 * b, HAND_GROUND.z + 0.08 * b), k);
        tP.lerp(POLE_GROUND, k);
      }
      h.x *= sg;
      tP.x *= sg;
      vPivot.set(sg * CARABINER_X, LOOP_Y, 0);
      h.sub(vPivot).applyQuaternion(qUp).add(vPivot);
      torsoToGlider(SHOULDER_T, this.hip, this.recline, tF);
      tF.x *= sg;
      // The line the handle hangs on: to the brake pulley (or the outer A maillon with ears).
      if (ears > 0.5) tL.set(sg * RISERS[1].top[0], RISERS[1].top[1], RISERS[1].top[2]);
      else tL.set(sg * PULLEY.x, PULLEY.y, PULLEY.z);
      tL.applyQuaternion(qCan);
      this.arm(s, tF, h, tL, tP);
    }
  }

  /**
   * Two-bone arm from the shoulder to the fist, the elbow towards `pole`; the glove (with its
   * handle) along the forearm, its thumb's side and the handle towards the line, and the
   * swivel the brake line is tied to.
   */
  private arm(s: number, sh: THREE.Vector3, fist: THREE.Vector3, lineTo: THREE.Vector3, pole: THREE.Vector3): void {
    const sg = s ? 1 : -1;
    const L1 = BODY.upperArm;
    const L2 = BODY.forearm + BODY.grip;
    tB.subVectors(fist, sh);
    const d = clamp(tB.length(), 0.12, L1 + L2 - 1e-3);
    tB.normalize();
    const cosA = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    tC.copy(pole).addScaledVector(tB, -pole.dot(tB));
    if (tC.lengthSq() < 1e-8) tC.set(sg, 0, 0).addScaledVector(tB, -sg * tB.x);
    tC.normalize();
    // Elbow, then the wrist on the line to the fist.
    tD.copy(sh).addScaledVector(tB, cosA * L1).addScaledVector(tC, sinA * L1);
    tE.copy(sh).addScaledVector(tB, d);
    tA.subVectors(tE, tD).normalize();
    alignBone(this.upper[s], sh, tD);
    const wrist = tE.copy(tD).addScaledVector(tA, BODY.forearm);
    alignBone(this.fore[s], tD, wrist);
    // Glove: the thumb's side (and the handle) towards the line: first turned about the
    // forearm (eased towards a raised fist's natural turn where the line runs along it),
    // then the wrist bent towards the line, up to ~43° (deviation and extension together,
    // the handle swinging on its swivel: hands up, it hangs nearly upright from the line).
    tB.subVectors(lineTo, wrist).normalize();
    tC.copy(tB).addScaledVector(tA, -tB.dot(tA));
    tH.set(sg * THUMB_REST.x, THUMB_REST.y, THUMB_REST.z);
    tH.addScaledVector(tA, -tH.dot(tA));
    tC.addScaledVector(tH, 0.3);
    if (tC.lengthSq() < 1e-8) tC.set(0, 0, -1).addScaledVector(tA, tA.z);
    tC.normalize();
    const dev = clamp(Math.atan2(tB.dot(tA), Math.max(1e-6, tB.dot(tC))), -0.6, 0.75);
    const cd = Math.cos(dev);
    const sd = Math.sin(dev);
    // Hand axis (y) and thumb (x) turned by `dev` in their plane; the back of the hand (z) stays.
    tH.copy(tA).multiplyScalar(cd).addScaledVector(tC, -sd);
    tC.multiplyScalar(cd).addScaledVector(tA, sd);
    // The right glove is the left one's mirror: its thumb on its −x.
    if (s) tC.negate();
    T3.crossVectors(tC, tH);
    tM.makeBasis(tC, tH, T3);
    const g = this.gloves[s];
    g.quaternion.setFromRotationMatrix(tM);
    g.position.copy(wrist);
    // The swivel on the handle's top (glove frame) → the glider frame.
    this.swivels[s]
      .copy(wrist)
      .addScaledVector(tC, s ? -SWIVEL.x : SWIVEL.x)
      .addScaledVector(tH, SWIVEL.y)
      .addScaledVector(T3, SWIVEL.z);
    const j = this.joints[s];
    j.shoulder.copy(sh);
    j.elbow.copy(tD);
    j.wrist.copy(wrist);
    j.grip.copy(wrist).addScaledVector(tH, GRIP.y).addScaledVector(T3, GRIP.z);
  }

  /** The posed arm of a side (0 left, 1 right; glider frame): shoulder, elbow, wrist, the handle's grip and swivel (development, tests). */
  armPose(side: number): { shoulder: THREE.Vector3; elbow: THREE.Vector3; wrist: THREE.Vector3; grip: THREE.Vector3; swivel: THREE.Vector3 } {
    return { ...this.joints[side], swivel: this.swivels[side] };
  }

  /** Harness straps: from each carabiner down to the seat's side and up the chest to the shoulder strap. */
  private poseHarnessStraps(): void {
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1;
      tA.set(sg * CARABINER_X, -0.04, 0.002);
      tB.set(sg * 0.205, 0.02, 0.0);
      torsoToGlider(tB, this.hip, this.recline, tC);
      this.strap(this.harnessStraps, s * 2, tA, tC);
      tA.set(sg * (CARABINER_X - 0.008), -0.012, -0.002);
      tB.set(sg * STRAP_CHEST_T[0], STRAP_CHEST_T[1], STRAP_CHEST_T[2]);
      torsoToGlider(tB, this.hip, this.recline, tC);
      this.strap(this.harnessStraps, s * 2 + 1, tA, tC);
    }
    this.harnessStraps.instanceMatrix.needsUpdate = true;
  }

  /** One instance of a unit strap from a to b. */
  private strap(mesh: THREE.InstancedMesh, i: number, a: THREE.Vector3, b: THREE.Vector3): void {
    tD.subVectors(b, a);
    const len = Math.max(1e-4, tD.length());
    tQ.setFromUnitVectors(Y, tD.multiplyScalar(1 / len));
    tS.set(1, len, 1);
    tM.compose(a, tQ, tS);
    mesh.setMatrixAt(i, tM);
  }

  private anchors(inp: RigInput, lines: LineSet, sb: number, ears: number): void {
    const inv = inp.canopyInv;
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1;
      const side = s ? 1 : -1;
      for (let i = 0; i < RISERS.length; i++) {
        const r = RISERS[i];
        // Loop on the carabiner (glider frame) to the maillon (canopy frame), the speed bar shortening it.
        tB.set(sg * CARABINER_X, LOOP_Y, r.dz).applyQuaternion(inv);
        tA.set(sg * r.top[0], r.top[1], r.top[2]);
        tC.subVectors(tA, tB);
        const len = tC.length();
        tC.multiplyScalar(1 / len);
        const l = len - r.bar * sb;
        tA.copy(tB).addScaledVector(tC, l);
        tQ.setFromUnitVectors(Y, tC);
        tS.set(1, l, 1);
        tM.compose(tB, tQ, tS);
        this.straps.setMatrixAt(s * 4 + i, tM);
        tS.set(1, 1, 1);
        tM.compose(tA, tQ, tS);
        this.maillons.setMatrixAt(s * 4 + i, tM);
        if (r.id === Anchor.A2 && ears > 0) {
          // Big ears: the outer A lines run to the hand pulling them.
          tD.copy(this.hands[s]).applyQuaternion(inv);
          tA.lerp(tD, Math.min(1, ears * 1.5));
        }
        lines.setAnchor(side, r.id, tA.x, tA.y, tA.z);
      }
      lines.setAnchor(side, Anchor.Pulley, sg * PULLEY.x, PULLEY.y, PULLEY.z);
      tA.copy(this.swivels[s]).applyQuaternion(inv);
      lines.setAnchor(side, Anchor.Handle, tA.x, tA.y, tA.z);
      // Speed system: out of the speedbag by the feet → pulley on the harness → pulley on the A riser.
      const p = this.pod;
      tA.set(sg * POD_SPEED_EXIT.x * p.scale.x, POD_SPEED_EXIT.y * p.scale.y, POD_SPEED_EXIT.z * p.scale.z);
      tA.applyAxisAngle(tE.set(1, 0, 0), p.rotation.x).add(p.position).applyQuaternion(inv);
      lines.setAnchor(side, Anchor.Bar, tA.x, tA.y, tA.z);
      tB.set(sg * 0.215, -0.02, -0.08);
      torsoToGlider(tB, this.hip, this.recline, tA).applyQuaternion(inv);
      lines.setAnchor(side, Anchor.HarnessPulley, tA.x, tA.y, tA.z);
      lines.setAnchor(side, Anchor.RiserPulley, sg * RISER_PULLEY.x, RISER_PULLEY.y - 0.1 * sb, RISER_PULLEY.z);
    }
    this.straps.instanceMatrix.needsUpdate = true;
    this.maillons.instanceMatrix.needsUpdate = true;
  }

  /** Cockpit instrument (altitude, vario, ground speed), redrawn twice a second when seen. */
  updateInstrument(st: GliderState, now: number, dt: number): void {
    const scr = this.instrument;
    if (typeof document === 'undefined') return;
    if (!this.screen) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.screen = { canvas, ctx, tex, next: 0, vario: 0 };
      const mat = scr.material as THREE.MeshBasicMaterial;
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    }
    const S = this.screen;
    S.vario += ((st.vz || 0) - S.vario) * Math.min(1, dt / 0.8);
    if (now < S.next) return;
    S.next = now + 500;
    const g = S.ctx;
    // E-ink look: light grey-green, black digits.
    g.fillStyle = '#c9cdbf';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#16181a';
    g.font = '600 15px system-ui, sans-serif';
    g.textBaseline = 'alphabetic';
    g.fillText('ALT m', 10, 22);
    g.fillText('VARIO m/s', 140, 22);
    g.font = '700 50px ui-monospace, Menlo, Consolas, monospace';
    g.fillText(String(Math.round(st.z || 0)), 8, 72);
    const v = S.vario;
    const vt = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);
    g.font = '700 40px ui-monospace, Menlo, Consolas, monospace';
    g.fillText(vt, 136, 70);
    g.fillRect(244, 10, 2, 140);
    const hb = Math.max(-1, Math.min(1, v / 5)) * 68;
    g.fillRect(234, 80 - Math.max(0, hb), 10, Math.abs(hb));
    g.fillRect(230, 79, 18, 2);
    g.fillRect(8, 92, 222, 2);
    g.font = '600 15px system-ui, sans-serif';
    g.fillText('SOL km/h', 10, 116);
    g.fillText('AIR km/h', 140, 116);
    g.font = '700 30px ui-monospace, Menlo, Consolas, monospace';
    g.fillText(String(Math.round(Math.hypot(st.vx || 0, st.vy || 0) * 3.6)), 10, 148);
    g.fillText(String(Math.round((st.airspeed || 0) * 3.6)), 140, 148);
    S.tex.needsUpdate = true;
  }
}
