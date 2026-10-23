/**
 * Paraglider flight model for the game: an inertial point mass flown by lift and drag.
 *
 * - The glider has a ground-frame velocity; the wing sees the air-relative velocity (the
 *   glider's minus the wind and its gusts). Lift is perpendicular to it, tilted by the
 *   bank, drag along it, weight down. A gust of headwind raises the airspeed and the glider
 *   zooms; a tailwind gust or a descent through the wind gradient costs airspeed; a vertical
 *   gust changes the angle of attack and the load. Flare, zoom, dive after a release and the
 *   spiral's speed build-up all come out of these forces, not from a hand-made rule.
 * - Coefficients come from the polar (trim speed, sink → glide angle → CL, CD per brake and
 *   bar setting); the brake changes the camber at once (part of its lift) and the angle of
 *   attack the canopy settles at (the rest, with its pitch stability τ ≈ 0.55 s). Added mass
 *   of the air around the canopy (≈ 22 kg normal to it) slows the response to gusts.
 * - The pilot hangs 7 m under the wing (pendulum ≈ 5.5 s): the line follows the wing's
 *   aerodynamic force, so braking swings the wing back, releasing makes it surge. Its pitch
 *   stability holds the canopy pitched up when faster than the equilibrium speed and down
 *   when slower, which damps the speed–height oscillation in one or two swings; a gust from
 *   behind surges the canopy (lower angle of attack), one from ahead pitches it back.
 * - Turns: the brakes and the weight shift set a turn rate and the bank it needs; the bank
 *   tilts the lift and the trajectory turns; the heading follows the airflow. Deep inner
 *   brake at low speed skids the turn flat and stalls the inner wing (spin).
 * - Incidents follow the angle of attack: a tip or the centre falling below the class's
 *   threshold (raised by brake pressure, lowered by the speed bar) folds; above CLmax the
 *   wing stalls; a side overloaded by a counter-brake on a collapse spins.
 *
 * Frame: x east, y north, z up (metres, altitude above sea level). Heading in radians,
 * clockwise from north. Pure and deterministic given its random source: unit-tested.
 */

export const G = 9.81;
/** Line length, pilot to wing (m): sets the pendulum period. */
const LINE_M = 7;
/** Projected area (m²) and lift slope (per rad) of the reference wing (25 m² flat, projected aspect ratio ≈ 3.7). */
const AREA = 21.5;
const CL_ALPHA = 3.8;
/** Share of the brake's lift gain that comes at once from the camber (the rest from the angle of attack). */
const K_CAMBER = 0.4;
/** Pitch stability: time for the canopy to return to its trim angle of attack after a gust (s). */
const TAU_ALPHA = 0.6;
/**
 * Added (apparent) mass of the air moved with the canopy, kg at the reference density
 * (Lissaman & Brown coefficients for a 25 m² wing: ≈ 25 kg normal to the canopy, a few kg
 * along the chord and sideways): it slows the response to gusts and inputs.
 */
const ADDED_N = 22;
const ADDED_T = 4;
const ADDED_S = 8;
/** Side force per radian of sideslip (the arched canopy's side area). */
const CY_BETA = 0.6;
/** Profile drag of the brake deflection at full brake. */
const C_FLAP = 0.05;
/** Lift and drag coefficients of the developed stall (deep, parachutal descent ≈ 6 m/s). */
const CL_STALLED = 0.7;
const CD_STALLED = 1.3;
const DEG = Math.PI / 180;
/**
 * Speed stability of the pendulum (rad of angle of attack per relative speed error): flying
 * faster than the equilibrium of the brake, bar and load, the line holds the canopy pitched up
 * (it climbs and slows), slower pitched down. It damps the speed–height oscillation (phugoid)
 * in one or two swings, as a paraglider's pitch does.
 */
const K_SPEED_AOA = 0.9;
/**
 * Pitch damping of the pendulum (s): the canopy, with more drag for its mass than the pilot,
 * lags behind him while the glider gathers speed (higher angle of attack) and runs ahead
 * while it slows. It damps the zoom and dive that follow a brake change, so that each step
 * of brake settles on its slower, flatter glide within a few seconds without overshooting
 * into more sink than before.
 */
const K_PITCH_DAMP = 0.2;
/** Share of a collapsed wing's yaw that skids instead of banking, and how much a skid turns the trajectory flat. */
const K_SKID = 0.45;
const K_FLAT = 0.8;
/** Angle-of-attack response to a gust along the heading (the canopy's drag changes before the pilot's inertia). */
const K_HGUST = 0.25;
/** Nose-down of the spiral dive at full bank (rad) and the extra drag of a steep spiral per (g − 1.3)^1.5. */
const SPIRAL_DIVE = 14 * (Math.PI / 180);
const SPIRAL_DRAG = 0.016;

export interface Controls {
  /** Brake travel requested by the pilot, 0 (hands up) … 1 (full). */
  brakeL: number;
  brakeR: number;
  /** Speed bar 0 … 1. */
  speedbar: number;
  /** Big ears pulled in (outer A lines): a descent technique. */
  ears?: boolean;
  /** Pulling the stabilo line of the side caught in a cravat. */
  stabilo?: boolean;
  /** The pilot's own weight shift in the harness, -1 (left) … 1 (right); added to the automatic lean into the turn. */
  weight?: number;
}

/** What the air does at the pilot: wind (m/s, east/north/up) and its turbulence 0..1. */
export interface AirSample {
  u: number;
  v: number;
  w: number;
  turbulence: number;
  /** Vertical air at the left and right wing tips (m/s): a thermal under one side lifts it. */
  wL?: number;
  wR?: number;
  /** Height of the pilot above the ground (m), for the ground effect. */
  agl?: number;
}

export interface Collapse {
  /** -1 left, +1 right, 0 none. */
  side: number;
  /** Share of the span folded, 0..0.75. */
  amount: number;
  /** Frontal collapse 0..1. */
  frontal: number;
  /** Largest fold of the current collapse. */
  peak?: number;
  /** Cravat: the tip of side `cravatSide` caught in the lines after reopening (0..0.3). */
  cravat: number;
  cravatSide: number;
}

/**
 * What changes between certification classes (EN 926-2): an EN-A forgives (damped, reopens
 * on its own, long brake travel before the stall), an EN-C rewards (faster, better glide)
 * and punishes (pitches and rolls more, folds more, turns harder on a collapse, reopens
 * late, stalls and spins with less brake): active piloting matters more on it.
 */
export interface WingParams {
  id: 'A' | 'B' | 'C';
  label: string;
  /** Multipliers on the trim speed and the sink; speed added by the full bar (m/s). */
  speed: number;
  sink: number;
  bar: number;
  /** Multiplier on the pitch/roll damping. */
  damping: number;
  /** Multiplier on the angle-of-attack margin before a fold (≈ 11° at trim on a B). */
  firmness: number;
  /** Re-inflation rate without help (share of span per second). */
  reopen: number;
  /** Yaw towards a collapsed side (rad/s per folded share) and largest fold. */
  collapseYaw: number;
  collapseMax: number;
  /** Brake travel where the stall and the spin start. */
  stallBrake: number;
  spinBrake: number;
  turnGain: number;
  /** Spiral stability (how much a steep bank damps the turn) and spiral inertia (slow exit). */
  spiralStab: number;
  spiralInertia: number;
  /** Response to vertical gusts (pitch) and to turbulence (roll). */
  gustPitch: number;
  turbRoll: number;
}

export const WINGS: Record<WingParams['id'], WingParams> = {
  A: { id: 'A', label: 'EN-A (école, très tolérante)', speed: 0.96, sink: 1.06, bar: 2.6, damping: 1.5, firmness: 1.35, reopen: 0.34, collapseYaw: 0.9, collapseMax: 0.5, stallBrake: 0.95, spinBrake: 0.94, turnGain: 0.7, spiralStab: 0.45, spiralInertia: 0.5, gustPitch: 0.8, turbRoll: 0.7 },
  B: { id: 'B', label: 'EN-B (intermédiaire)', speed: 1, sink: 1, bar: 3.6, damping: 1, firmness: 1, reopen: 0.2, collapseYaw: 1.4, collapseMax: 0.7, stallBrake: 0.88, spinBrake: 0.85, turnGain: 0.78, spiralStab: 0.12, spiralInertia: 1, gustPitch: 1, turbRoll: 1 },
  C: { id: 'C', label: 'EN-C (sport, exigeante)', speed: 1.06, sink: 0.94, bar: 4.6, damping: 0.68, firmness: 0.78, reopen: 0.13, collapseYaw: 1.8, collapseMax: 0.75, stallBrake: 0.82, spinBrake: 0.79, turnGain: 0.84, spiralStab: 0, spiralInertia: 1.4, gustPitch: 1.35, turbRoll: 1.35 },
};

export interface GliderState {
  wing: WingParams;
  x: number;
  y: number;
  z: number;
  /** Direction the wing points to (rad, clockwise from north): follows the airflow, plus sideslip. */
  heading: number;
  /** True airspeed (m/s). */
  airspeed: number;
  /** Vertical speed relative to the air (m/s, negative = sinking). */
  vzAir: number;
  /** Ground-frame velocity (m/s): the inertial state of the point mass; vz is the vario. */
  vz: number;
  vx: number;
  vy: number;
  bank: number;
  bankRate: number;
  /**
   * Pitch attitude of the glider (rad, + = nose down / wing ahead): the pendulum's swing,
   * plus the nose-down of a steeply banked descending path (drawn and sent to the others).
   */
  pitch: number;
  /** Pendulum swing of the wing about the pilot (rad, + = wing ahead / diving) and its rate. */
  swing: number;
  pitchRate: number;
  /** Turn rate the controls ask for (rad/s): sets the bank target. */
  yawRate: number;
  /** Actual rate of change of the heading (rad/s). */
  turnRate: number;
  /** Sideslip: heading minus the direction of the airflow (rad). */
  beta: number;
  /** Air-relative flight-path angle (rad) and angle of attack relative to the hands-up trim (rad). */
  gamma: number;
  alpha: number;
  /** Actual brake positions (the hands move at a finite speed). */
  brakeL: number;
  brakeR: number;
  speedbar: number;
  /** Weight shift in the harness, -1..1 (+ = right): automatic lean into the turn plus the pilot's own. */
  weightShift: number;
  wsAuto: number;
  wsActive: number;
  /** Rate of the weight shift (1/s, smoothed): its first effect is the other way. */
  wsRate: number;
  /** Big ears 0..1 (folding in or reopening over ~1.5 s). */
  ears: number;
  /** All-up weight (kg): a heavier pilot flies faster and sinks more (√ of the load). */
  mass: number;
  collapse: Collapse;
  /** Developed stall 0..1 and spin 0..1 (towards spinSide). */
  stall: number;
  spin: number;
  spinSide: number;
  /** Load factor (g): aerodynamic force over weight. */
  load: number;
  /** Lift coefficient flown (for the HUD and tests). */
  cl: number;
  /** Margin of the angle of attack before a fold (deg) at the centre and each tip. */
  marginC: number;
  marginL: number;
  marginR: number;
  /** Brake pressure felt in each hand (kg): rises with the speed and the travel, drops before a fold or a stall. */
  pressureL: number;
  pressureR: number;
  /** Skid of the turn 0..1 (deep inner brake at low speed), and the turn rate it carries without bank (rad/s). */
  skid: number;
  rSkid: number;
  /** Tip gusts high-passed by the wing's roll response (m/s) and their last raw values. */
  tipHpL: number;
  tipHpR: number;
  tipPrevL: number;
  tipPrevR: number;
  /** After a big collapse reopens: time left during which the other side folds more easily, and that side. */
  cascadeT: number;
  cascadeSide: number;
  /** The first step adopts the air's velocity (the glider starts at trim in the air it is in). */
  started: boolean;
  /** Air of the last step (m/s): its jumps kick the pendulum and the angle of attack. */
  lastAirW: number;
  lastAirU: number;
  lastAirV: number;
  /** Equilibrium airspeed the pendulum is settled on (m/s) and the CLmax excess low-passed by the stall delay. */
  vEq: number;
  stallLp: number;
  /** Each half-wing's excess over its CLmax, low-passed like the stall's (separation delay). */
  exLLp: number;
  exRLp: number;
  /** Relative deviation of the airspeed from that equilibrium, as the canopy's pitch follows it. */
  speedDev: number;
  /** Acceleration along the airflow (m/s², low-passed): the pendulum's pitch damping follows it. */
  accV: number;
  /** Brake travel on each side 0.3 s ago, to detect pumping on a collapsed side. */
  pumpL: number;
  pumpR: number;
}

/**
 * Polar of a mid-range (EN-B) wing at the middle of its weight range: brake travel →
 * [horizontal airspeed, sink] (m/s). Hands up ≈ 37.5 km/h sinking 1.1 m/s; every 10 % of
 * brake costs 1.5–2 km/h down to the minimum sink (≈ 1.0 m/s at 30 %, 31 km/h); beyond, the
 * sink climbs faster and faster to the minimum speed (≈ 24 km/h at 80 %) before the stall
 * (manufacturers' figures for EN-B wings: trim 37–39 km/h, minimum 22–25 km/h, minimum sink
 * 1.0–1.1 m/s; measured polars of the class: glide 9.5–10 a little under trim speed).
 */
const POLAR: [number, number, number][] = [
  [0, 10.45, 1.12],
  [0.1, 9.95, 1.035],
  [0.2, 9.35, 0.995],
  [0.3, 8.75, 0.98],
  [0.4, 8.2, 1.03],
  [0.5, 7.75, 1.14],
  [0.6, 7.35, 1.32],
  [0.7, 7.05, 1.6],
  [0.8, 6.75, 2.0],
  [0.9, 6.15, 2.6],
  [1, 5.6, 3.4],
];

function polarInto(brake: number, speedbar: number, wing: WingParams, out: { v: number; sink: number }): void {
  const b = Math.min(1, Math.max(0, brake));
  let i = 0;
  while (i < POLAR.length - 2 && b > POLAR[i + 1][0]) i++;
  const [b0, v0, s0] = POLAR[i];
  const [b1, v1, s1] = POLAR[i + 1];
  const f = (b - b0) / (b1 - b0);
  const s = Math.min(1, Math.max(0, speedbar)) * (1 - b);
  out.v = (v0 + (v1 - v0) * f) * wing.speed + wing.bar * s;
  out.sink = (s0 + (s1 - s0) * f) * wing.sink + 0.95 * s * s;
}

export function polar(brake: number, speedbar: number, wing: WingParams = WINGS.B): { v: number; sink: number } {
  const out = { v: 0, sink: 0 };
  polarInto(brake, speedbar, wing, out);
  return out;
}

/** Air density (kg/m³) at an altitude (m), standard atmosphere. */
export function airDensity(z: number): number {
  return 1.225 * Math.pow(Math.max(0.2, 1 - 2.2558e-5 * z), 4.2559);
}

/** The polar is that of a test flight around 500 m. */
const RHO_REF = airDensity(500);

/** Reference all-up weight of the wing's polar (kg): middle of a 25 m² wing's range. */
export const REF_MASS = 95;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const approach = (v: number, target: number, rate: number, dt: number) => v + clamp(target - v, -rate * dt, rate * dt);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const wrapPi = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

/** Steady lift and drag coefficients of a polar point (horizontal speed v, sink), at the reference weight and density. */
function coeffsOf(v: number, sink: number, out: { cl: number; cd: number }): void {
  const v2 = v * v + sink * sink;
  out.cl = (2 * REF_MASS * G * (v / Math.sqrt(v2))) / (RHO_REF * v2 * AREA);
  out.cd = (out.cl * sink) / v;
}

/** What each wing's polar implies once: trim and stall coefficients, induced and profile drag. */
interface WingAero {
  cl0: number;
  cd0: number;
  k: number;
  /** Trim coefficients at 80 and 85 % brake: beyond, the polar's last points are past CLmax (stall), the trim is extrapolated. */
  cl80: number;
  cd80: number;
  cl85: number;
  cd85: number;
  clStall: number;
}
const AERO = new Map<WingParams, WingAero>();
const PT = { v: 0, sink: 0 };
const CT = { cl: 0, cd: 0 };

function wingAero(w: WingParams): WingAero {
  let a = AERO.get(w);
  if (a) return a;
  const at = (b: number) => {
    polarInto(b, 0, w, PT);
    coeffsOf(PT.v, PT.sink, CT);
    return { cl: CT.cl, cd: CT.cd };
  };
  const t0 = at(0);
  const t2 = at(0.2);
  const t80 = at(0.8);
  const t85 = at(0.85);
  const k = clamp((t2.cd - t0.cd - C_FLAP * 0.04) / (t2.cl * t2.cl - t0.cl * t0.cl), 0.04, 0.12);
  a = { cl0: t0.cl, cd0: t0.cd - k * t0.cl * t0.cl, k, cl80: t80.cl, cd80: t80.cd, cl85: t85.cl, cd85: t85.cd, clStall: 0 };
  AERO.set(w, a);
  const st = { cl: 0, cd: 0 };
  trimInto(w.stallBrake, 0, w, st);
  a.clStall = st.cl;
  return a;
}

/**
 * Trim coefficients at a brake and bar setting: the polar up to 85 % brake, extrapolated
 * beyond (the wing "asks" for more lift than it can give: past the stall brake it stalls).
 */
function trimInto(b: number, bar: number, w: WingParams, out: { cl: number; cd: number }): void {
  const a = AERO.get(w) ?? wingAero(w);
  if (b <= 0.85) {
    polarInto(b, bar, w, PT);
    coeffsOf(PT.v, PT.sink, out);
    return;
  }
  const f = (b - 0.85) / 0.05;
  out.cl = a.cl85 + (a.cl85 - a.cl80) * f;
  out.cd = a.cd85 + (a.cd85 - a.cd80) * f;
}

export function newGlider(x: number, y: number, z: number, heading: number, wing: WingParams = WINGS.B): GliderState {
  const p = polar(0, 0, wing);
  return {
    wing,
    x,
    y,
    z,
    heading,
    airspeed: Math.hypot(p.v, p.sink),
    vzAir: -p.sink,
    vz: -p.sink,
    vx: Math.sin(heading) * p.v,
    vy: Math.cos(heading) * p.v,
    bank: 0,
    bankRate: 0,
    pitch: 0,
    swing: 0,
    pitchRate: 0,
    yawRate: 0,
    turnRate: 0,
    beta: 0,
    gamma: -Math.atan2(p.sink, p.v),
    alpha: 0,
    brakeL: 0,
    brakeR: 0,
    speedbar: 0,
    weightShift: 0,
    wsAuto: 0,
    wsActive: 0,
    wsRate: 0,
    ears: 0,
    mass: REF_MASS,
    collapse: { side: 0, amount: 0, frontal: 0, cravat: 0, cravatSide: 0 },
    stall: 0,
    spin: 0,
    spinSide: 0,
    load: 1,
    cl: wingAero(wing).cl0,
    marginC: 11,
    marginL: 11,
    marginR: 11,
    pressureL: 0.4,
    pressureR: 0.4,
    skid: 0,
    rSkid: 0,
    tipHpL: 0,
    tipHpR: 0,
    tipPrevL: 0,
    tipPrevR: 0,
    cascadeT: 0,
    cascadeSide: 0,
    started: false,
    lastAirW: 0,
    lastAirU: 0,
    lastAirV: 0,
    vEq: 0,
    stallLp: -1,
    exLLp: -1,
    exRLp: -1,
    speedDev: 0,
    accV: 0,
    pumpL: 0,
    pumpR: 0,
  };
}

/**
 * Puts the glider in flight at a given true airspeed along its heading, in the air it is in
 * (the take-off hands over to the flight model with the speed reached on the ground).
 */
export function setAirspeed(s: GliderState, airspeed: number): void {
  const p = polar(0, 0, s.wing);
  const g = -Math.atan2(p.sink, p.v);
  s.vx = Math.sin(s.heading) * airspeed * Math.cos(g);
  s.vy = Math.cos(s.heading) * airspeed * Math.cos(g);
  s.vz = airspeed * Math.sin(g);
  s.airspeed = airspeed;
  s.gamma = g;
  s.started = false;
}

export type Rng = () => number;

/** Events the HUD reports (a collapse, a stall…), returned by `step`. */
export type FlightEvent = 'collapse-left' | 'collapse-right' | 'frontal' | 'stall' | 'spin' | 'reopened' | 'cravat' | 'cravat-cleared';
const NO_EVENTS: FlightEvent[] = [];

const TRIM = { cl: 0, cd: 0 };
const TRIM0 = { cl: 0, cd: 0 };
const TRIM_SIDE = { cl: 0, cd: 0 };

/**
 * Angle-of-attack bonus of brake pressure (rad): the camber and the line tension keep the
 * leading edge loaded; it is what active piloting buys. Pilots fly turbulence with 15–30 %.
 */
const pressureBonus = (b: number) => 24 * DEG * clamp(b - 0.1, 0, 0.4);

/** Advances the glider by `dt` seconds (call with dt ≤ 1/60 for stability; no time, no step). */
export function step(s: GliderState, c: Controls, air: AirSample, dt: number, rng: Rng): FlightEvent[] {
  // The rates below divide by dt: a zero step would turn the whole state into NaN.
  if (!(dt > 0)) return [];
  let events: FlightEvent[] | null = null;
  const W = s.wing;
  const A = AERO.get(W) ?? wingAero(W);
  if (!s.started) {
    // The glider starts at trim relative to the air it is in.
    s.vx += air.u;
    s.vy += air.v;
    s.vz += air.w;
    s.started = true;
    s.tipPrevL = (air.wL ?? air.w) - air.w;
    s.tipPrevR = (air.wR ?? air.w) - air.w;
    s.lastAirW = air.w;
    s.lastAirU = air.u;
    s.lastAirV = air.v;
  }

  // --- Hands, bar, ears and the pilot's weight move at a human speed.
  s.brakeL = approach(s.brakeL, clamp(c.brakeL, 0, 1), 2.4, dt);
  s.brakeR = approach(s.brakeR, clamp(c.brakeR, 0, 1), 2.4, dt);
  // The bar is pushed progressively with the legs, released faster.
  s.speedbar = approach(s.speedbar, clamp(c.speedbar, 0, 1), c.speedbar > s.speedbar ? 0.8 : 2, dt);
  s.ears = approach(s.ears, c.ears ? 1 : 0, 0.7, dt);
  const bAvg = (s.brakeL + s.brakeR) / 2;
  const bDiff = s.brakeR - s.brakeL;
  s.wsAuto = approach(s.wsAuto, clamp(bDiff * 1.4, -1, 1), 1.2, dt);
  s.wsActive = approach(s.wsActive, clamp(c.weight ?? 0, -1, 1), 2.5, dt);
  const ws = clamp(s.wsAuto + s.wsActive, -1, 1);
  s.wsRate += ((ws - s.weightShift) / dt - s.wsRate) * Math.min(1, dt / 0.1);
  s.weightShift = ws;

  // --- The airflow: air-relative velocity, its path angle and direction.
  const rho = airDensity(s.z);
  const rhoRel = rho / RHO_REF;
  const rx = s.vx - air.u;
  const ry = s.vy - air.v;
  const rz = s.vz - air.w;
  const vh = Math.hypot(rx, ry);
  const V = Math.max(0.5, Math.hypot(vh, rz));
  const gam = Math.atan2(rz, Math.max(1e-6, vh));
  const chi = vh > 0.3 ? Math.atan2(rx, ry) : s.heading;
  // A change of the airflow's angle (a vertical gust, the path bending) changes the angle
  // of attack at once; the canopy then pitches back to its trim (pitch stability).
  const dGam = gam - s.gamma;
  s.gamma = gam;
  trimInto(bAvg, s.speedbar, W, TRIM);
  trimInto(bAvg, 0, W, TRIM0);
  const clCam = K_CAMBER * (TRIM0.cl - A.cl0);
  // Steeply banked, the wing noses down into the spiral dive (less on a tolerant wing): it
  // flies faster at a lower lift coefficient, which is what makes a spiral sink 14–19 m/s.
  const dive = SPIRAL_DIVE * smoothstep(0.85, 1.3, Math.abs(s.bank)) * Math.max(0, 1 - 2 * W.spiralStab);
  const aTrim = (TRIM.cl - A.cl0 - clCam) / CL_ALPHA + 3 * DEG * s.ears - dive;
  // A gust along the heading changes the canopy's drag before the pilot's: from behind it
  // surges ahead (lower angle of attack), from ahead it pitches back.
  const sh0 = Math.sin(s.heading);
  const ch0 = Math.cos(s.heading);
  const duAlong = (air.u - s.lastAirU) * sh0 + (air.v - s.lastAirV) * ch0;
  s.lastAirU = air.u;
  s.lastAirV = air.v;
  s.alpha += ((aTrim - s.alpha) * dt) / TAU_ALPHA - dGam - (K_HGUST * clamp(duAlong, -3, 3)) / V;
  s.alpha = clamp(s.alpha, -0.5, 0.6);
  // Speed stability of the pendulum: flying faster than the equilibrium of this brake, bar
  // and load, the line holds the canopy pitched up (it climbs and slows), slower pitched down.
  polarInto(bAvg, s.speedbar, W, PT);
  const vEq = Math.hypot(PT.v, PT.sink) * Math.sqrt(1 / rhoRel) * Math.sqrt(s.mass / REF_MASS) * Math.sqrt(Math.max(0.3, Math.cos(gam)) / Math.max(0.15, Math.cos(s.bank)));
  // The pendulum takes a couple of seconds to settle on a new equilibrium (a brake change is not a speed error).
  if (!(s.vEq > 0)) s.vEq = vEq;
  s.vEq += ((vEq - s.vEq) * dt) / 1.0;
  s.speedDev = clamp((V - s.vEq) / s.vEq, -0.12, 0.25);
  // (Steeply banked the acceleration is the spiral's, which the pendulum does not resist.)
  const aEff = s.alpha + K_SPEED_AOA * s.speedDev + (K_PITCH_DAMP * clamp(s.accV, -4, 4) * smoothstep(0.7, 0.3, Math.abs(s.bank))) / V;

  // Tip gusts: what one side feels more than the other, high-passed by the roll response.
  const tipL = (air.wL ?? air.w) - air.w;
  const tipR = (air.wR ?? air.w) - air.w;
  const kTip = Math.exp(-dt / 0.3);
  s.tipHpL = s.tipHpL * kTip + (tipL - s.tipPrevL);
  s.tipHpR = s.tipHpR * kTip + (tipR - s.tipPrevR);
  s.tipPrevL = tipL;
  s.tipPrevR = tipR;
  const asym = tipR - tipL;

  // --- Incidents follow the angle of attack.
  const col = s.collapse;
  const earsF = 1 + 0.8 * s.ears;
  const base = -11 * DEG * W.firmness * earsF + 2.2 * DEG * s.speedbar;
  const thrC = base - pressureBonus(bAvg);
  const casc = s.cascadeT > 0 ? 2.5 * DEG * (col.peak ?? 0.6) * (W.id === 'C' ? 1.4 : W.id === 'A' ? 0.4 : 1) : 0;
  const thrL = base - pressureBonus(s.brakeL) + 0.5 * DEG + (s.cascadeSide < 0 ? casc : 0);
  const thrR = base - pressureBonus(s.brakeR) + 0.5 * DEG + (s.cascadeSide > 0 ? casc : 0);
  const aL = aEff + (0.8 * s.tipHpL) / V;
  const aR = aEff + (0.8 * s.tipHpR) / V;
  const prevMin = Math.min(s.marginL, s.marginR);
  s.marginC = (aEff - thrC) / DEG;
  s.marginL = (aL - thrL) / DEG;
  s.marginR = (aR - thrR) / DEG;
  if (s.cascadeT > 0) s.cascadeT = Math.max(0, s.cascadeT - dt);
  if (col.amount < 0.05 && col.frontal < 0.05 && s.stall < 0.3 && s.spin < 0.3) {
    const mMin = Math.min(s.marginL, s.marginR);
    if (mMin < 0) {
      // How hard the edge hits: how far below and how fast the margin fell.
      const fall = Math.max(0, (prevMin - mMin) / dt);
      const severity = -mMin + 0.12 * fall;
      const sym = Math.abs(s.marginL - s.marginR) < 2.5 && s.marginC < 1.5;
      const pFrontal = sym ? clamp(0.3 + 0.4 * s.speedbar + 1.2 * Math.max(0, s.swing), 0.1, 0.85) : 0.05;
      if (rng() < pFrontal) {
        col.frontal = clamp(0.45 + severity / 14, 0.45, 1);
        s.pitchRate -= 0.8 * col.frontal;
        (events ??= []).push('frontal');
      } else {
        col.side = s.marginL < s.marginR ? -1 : 1;
        col.amount = clamp(0.25 + severity / 12, 0.25, W.collapseMax);
        col.peak = col.amount;
        (events ??= []).push(col.side < 0 ? 'collapse-left' : 'collapse-right');
      }
    }
  }
  // Re-inflation: on its own after a few seconds, faster when the pilot pumps the brake
  // on the collapsed side.
  const pumpSide = col.side < 0 ? s.brakeL - s.pumpL : s.brakeR - s.pumpR;
  s.pumpL += (s.brakeL - s.pumpL) * Math.min(1, dt / 0.3);
  s.pumpR += (s.brakeR - s.pumpR) * Math.min(1, dt / 0.3);
  if (col.amount > 0) {
    const was = col.amount;
    col.amount = Math.max(0, col.amount - dt * (W.reopen + 1.6 * Math.max(0, pumpSide)));
    if (col.amount === 0 && was > 0) {
      const peak = col.peak ?? 0;
      // A big fold may leave the tip caught in the lines (more likely on a demanding wing).
      if (peak > 0.55 && rng() < (W.id === 'C' ? 0.35 : W.id === 'B' ? 0.15 : 0.03)) {
        col.cravat = 0.18 + 0.12 * rng();
        col.cravatSide = col.side;
        (events ??= []).push('cravat');
      } else (events ??= []).push('reopened');
      // The reopened side catches up: the wing surges and swings away; the other side,
      // unloaded by the surge, folds more easily for a moment (cascade) unless damped.
      if (peak > 0.4) {
        s.pitchRate += 0.35 * peak;
        s.yawRate -= 0.5 * col.side * peak;
        s.cascadeT = 2.5;
        s.cascadeSide = -col.side;
      }
      col.side = 0;
    }
  }
  if (col.cravat > 0) {
    // Cleared by pulling the stabilo line, or now and then by a firm pump on that side.
    const pump = col.cravatSide < 0 ? s.brakeL - s.pumpL : s.brakeR - s.pumpR;
    if (c.stabilo) col.cravat = Math.max(0, col.cravat - dt * 0.2);
    else if (pump > 0.25 && rng() < dt * 3) col.cravat = Math.max(0, col.cravat - 0.1);
    if (col.cravat === 0) {
      col.cravatSide = 0;
      (events ??= []).push('cravat-cleared');
    }
  }
  if (col.frontal > 0) {
    col.frontal = Math.max(0, col.frontal - dt * (0.35 + W.reopen * 1.3));
    if (col.frontal === 0) (events ??= []).push('reopened');
  }

  // --- Lift coefficient asked of the wing (attached flow), stall and spin.
  const clAtt = A.cl0 + clCam + CL_ALPHA * aEff;
  // Developed stall: the wing flies past CLmax (deep brakes, or a slow wing in a gust); it
  // stays stalled while the hands stay down and recovers when they come up.
  // Separation takes a few tenths of a second: a brief excursion past CLmax (a flare at speed, a gust) does not stall.
  s.stallLp += (clAtt - A.clStall - s.stallLp) * Math.min(1, dt / 0.35);
  if ((s.stallLp > 0 && bAvg > 0.4) || (s.stall >= 0.5 && bAvg >= 0.6)) {
    if (s.stall < 0.5 && s.stall + dt / 0.9 >= 0.5) (events ??= []).push('stall');
    s.stall = Math.min(1, s.stall + dt / 0.9);
  } else if (bAvg < 0.6) s.stall = Math.max(0, s.stall - dt / 1.5);
  // Spin: one half-wing past its CLmax: the inner wing of a slow, tight turn (it flies slower
  // than the centre), or the open side loaded by a collapse and a strong counter-brake.
  const rTurn = s.turnRate;
  const vL = Math.max(1, V + rTurn * 2.5);
  const vR = Math.max(1, V - rTurn * 2.5);
  const loadL = col.side > 0 ? 1 + 0.9 * col.amount : 1;
  const loadR = col.side < 0 ? 1 + 0.9 * col.amount : 1;
  trimInto(s.brakeL, 0, W, TRIM_SIDE);
  const clBL = TRIM_SIDE.cl;
  trimInto(s.brakeR, 0, W, TRIM_SIDE);
  const clBR = TRIM_SIDE.cl;
  const clL = (clAtt * V * loadL) / vL + 0.5 * (clBL - TRIM0.cl) + (CL_ALPHA * 0.8 * s.tipHpL) / V;
  const clR = (clAtt * V * loadR) / vR + 0.5 * (clBR - TRIM0.cl) + (CL_ALPHA * 0.8 * s.tipHpR) / V;
  // The flow separates over a few tenths of a second, as for the stall above: a tip gust at a
  // thermal's sharp edge does not spin a wing flown with half brake, a slow deep turn does.
  s.exLLp += (clL - A.clStall * (1 - 0.08 * (loadL - 1)) - s.exLLp) * Math.min(1, dt / 0.35);
  s.exRLp += (clR - A.clStall * (1 - 0.08 * (loadR - 1)) - s.exRLp) * Math.min(1, dt / 0.35);
  const exL = s.exLLp;
  const exR = s.exRLp;
  // Both sides past CLmax is a stall, not a spin; and a half-wing spins only under its brake
  // (the inner brake of a slow turn, the counter-brake on a collapse), never hands up.
  const sideStall = exL > 0 && exL - Math.max(0, exR) > 0.12 && s.brakeL > 0.35 ? -1 : exR > 0 && exR - Math.max(0, exL) > 0.12 && s.brakeR > 0.35 ? 1 : 0;
  if (sideStall !== 0 && s.stall < 0.5 && (s.spin < 0.5 || s.spinSide === sideStall)) {
    if (s.spin < 0.5 && s.spin + dt / 0.8 >= 0.5) (events ??= []).push('spin');
    s.spinSide = sideStall;
    s.spin = Math.min(1, s.spin + dt / 0.8);
  } else if (s.spin >= 0.5 && (s.spinSide < 0 ? s.brakeL : s.brakeR) > 0.45) {
    s.spin = Math.min(1, s.spin + dt / 0.8);
  } else s.spin = Math.max(0, s.spin - dt * (W.id === 'A' ? 1.6 : W.id === 'B' ? 1 : 0.7));
  if (s.spin === 0) s.spinSide = 0;

  // --- Aerodynamic coefficients flown.
  let cl = clAtt;
  if (cl > A.clStall) cl = A.clStall + 0.25 * Math.tanh((cl - A.clStall) / 0.25);
  cl = Math.max(-0.3, cl);
  const clT = Math.max(0.15, TRIM.cl);
  const sep = Math.max(0, TRIM.cd - A.cd0 - C_FLAP * bAvg * bAvg - A.k * clT * clT);
  const ratio = Math.max(0, cl) / clT;
  // Ground effect (McCormick): the wing ~7 m above the ground hardly feels it (< 1 % of the induced drag).
  let ge = 1;
  if (air.agl !== undefined) {
    const h = Math.max(0.3, air.agl + LINE_M * Math.cos(s.bank)) / 9;
    const k16 = 16 * h * 16 * h;
    ge = k16 / (1 + k16);
  }
  let cd = TRIM.cd + A.k * (cl * cl * ge - clT * clT) + sep * (ratio ** 6 - 1);
  cd = Math.max(0.6 * A.cd0, cd);
  // Steep spirals: the inner wing slows, the canopy deforms, the lines vibrate: more drag than the coordinated turn alone.
  cd += SPIRAL_DRAG * Math.max(0, s.load - 1.3) ** 1.5;
  // Incidents: less flying area, more drag.
  let area = AREA * (1 - 0.5 * col.amount) * (1 - 0.4 * col.frontal) * (1 - 0.18 * s.ears) * (1 - 0.25 * col.cravat);
  cl *= 1 - 0.6 * col.frontal;
  cd += 0.1 * col.amount + 0.35 * col.frontal + 0.09 * s.ears + 0.5 * col.cravat;
  cl = cl * (1 - s.stall) + CL_STALLED * s.stall;
  cd = cd * (1 - s.stall) + CD_STALLED * s.stall;
  cl *= 1 - 0.5 * s.spin;
  cd += 0.7 * s.spin;
  area = Math.max(4, area);
  s.cl = cl;

  // --- Forces: lift ⟂ the airflow tilted by the bank, drag along it, side force of the skid,
  // weight. The added mass slows the accelerations normal to the canopy.
  const q = 0.5 * rho * V * V;
  const L = q * area * cl;
  const D = q * area * cd;
  // Side force of the yawed, arched canopy: the skid turns the trajectory flat (no bank); far
  // off the airflow (after a spin) the re-flying wing goes where it points.
  const offFlow = smoothstep(0.3, 1, Math.abs(s.beta));
  // A spinning wing drags its slow trajectory round with it (it rotates almost on the spot).
  const rSpin = s.spinSide * 2.2 * s.spin;
  const Fy = q * area * CY_BETA * (1 + 4 * offFlow) * clamp(s.beta, -0.8, 0.8) + s.mass * vh * (K_FLAT * s.rSkid + rSpin);
  const sg = Math.sin(gam);
  const cg = Math.cos(gam);
  const sc = Math.sin(chi);
  const cc = Math.cos(chi);
  const sb = Math.sin(s.bank);
  const cb = Math.cos(s.bank);
  // Unit vectors: along the airflow (ev), lift (eL: up ⟂ ev, tilted right by the bank), side (es = ev × eL).
  const evx = cg * sc;
  const evy = cg * cc;
  const evz = sg;
  const enx = -sg * sc;
  const eny = -sg * cc;
  const enz = cg;
  const eLx = cb * enx + sb * cc;
  const eLy = cb * eny - sb * sc;
  const eLz = cb * enz;
  const esx = evy * eLz - evz * eLy;
  const esy = evz * eLx - evx * eLz;
  const esz = evx * eLy - evy * eLx;
  const m = s.mass;
  // Aerodynamic force (the line tension the pilot feels), then gravity.
  const fax = L * eLx - D * evx + Fy * cc;
  const fay = L * eLy - D * evy - Fy * sc;
  const faz = L * eLz - D * evz;
  const fz = faz - m * G;
  const Fv = fax * evx + fay * evy + fz * evz;
  const FL = fax * eLx + fay * eLy + fz * eLz;
  const Fs = fax * esx + fay * esy + fz * esz;
  const av = Fv / (m + ADDED_T * rhoRel);
  s.accV += (av - s.accV) * Math.min(1, dt / 0.15);
  const aL2 = FL / (m + ADDED_N * rhoRel);
  const as = Fs / (m + ADDED_S * rhoRel);
  const accX = av * evx + aL2 * eLx + as * esx;
  const accY = av * evy + aL2 * eLy + as * esy;
  const accZ = av * evz + aL2 * eLz + as * esz;
  s.load += (Math.hypot(fax, fay, faz) / (m * G) - s.load) * Math.min(1, dt / 0.08);

  // --- Pendulum (the attitude the pilot sees): the line follows the wing's aerodynamic
  // force; braking (more drag) swings the wing back, releasing or a frontal's reopening
  // makes it surge, a pull-up or a dive tilts it.
  const fwd = fax * sh0 + fay * ch0;
  const pitchEq = clamp(Math.atan2(fwd, Math.max(1, faz)), -0.6, 0.6) - 0.6 * s.stall;
  const pOmega = Math.sqrt(G / LINE_M) / Math.sqrt(1 + (9 * rhoRel) / m);
  const pitchAcc = pOmega * pOmega * (pitchEq - s.swing) - 2 * 0.28 * W.damping * pOmega * s.pitchRate;
  // Rising air raises the angle of attack: the wing pitches back entering a thermal, surges leaving it.
  const dwAir = air.w - s.lastAirW;
  s.lastAirW = air.w;
  s.pitchRate += pitchAcc * dt - 0.12 * W.gustPitch * clamp(dwAir, -3, 3) + 0.05 * W.gustPitch * clamp(duAlong, -3, 3);
  s.swing = clamp(s.swing + s.pitchRate * dt, -1.2, 1.2);
  // Steeply banked, the whole glider pitches along its path: the line leans into the turn
  // and the pilot, facing the airflow, has his nose down the descending helix (the ground
  // ahead in a spiral dive: ≈ 35° at 75° of bank), up and down the path in wingovers. In
  // straight flight the line hangs vertical whatever the glide angle (hence sin² of the bank).
  s.pitch = clamp(s.swing - gam * Math.sin(s.bank) ** 2, -1.4, 1.4);

  // --- Turn: brakes and weight shift ask for a turn rate; the bank that turn needs follows
  // with a pendular lag; the bank tilts the lift (the trajectory turns), the heading follows
  // the airflow. Beyond ~60 % of differential input the turn tightens more than in
  // proportion: held, it builds speed, bank and turn rate until the spiral dive (EN 926-2:
  // 4–5 g, 12–18 m/s).
  const steer = bDiff + 0.35 * ws;
  const steerNl = steer + Math.sign(steer) * 1.2 * Math.max(0, Math.abs(steer) - 0.6) ** 1.5;
  const scale = Math.sqrt(1 / rhoRel) * Math.sqrt(m / REF_MASS);
  // Skid steer: deep inner brake at low speed turns by drag more than by bank (flat, slow turn).
  const inner = Math.max(s.brakeL, s.brakeR);
  s.skid = smoothstep(0.55, 0.85, inner) * smoothstep(9.2 * scale, 7.2 * scale, vh) * Math.min(1, Math.abs(bDiff) * 4);
  let yawTarget = W.turnGain * steerNl * (V / 9.5) * (1 - 0.5 * s.ears) * (1 + 0.3 * s.skid);
  // Spiral stability: a tolerant wing damps its own turn when steeply banked.
  yawTarget *= 1 - W.spiralStab * clamp((Math.abs(s.bank) - 0.7) / 0.5, 0, 1);
  // Rising air under one wing lifts it and turns the glider away from the thermal: the
  // pilot feels it and turns towards the lifted side to core it.
  yawTarget -= 0.12 * asym;
  // A collapsed side drags the wing towards it; braking the open side counters it.
  const yawCollapse = col.side * col.amount * W.collapseYaw;
  yawTarget += yawCollapse;
  // A cravat keeps turning the wing towards the caught side.
  yawTarget += col.cravatSide * col.cravat * 3.5;
  // The weight leaves before the wing loads up: a quick lean first turns it the other way.
  yawTarget -= 0.05 * s.wsRate;
  yawTarget *= 1 - 0.8 * s.stall;
  // Spiral inertia: a fast, steep turn takes longer to unwind once released.
  const tauYaw = 0.55 * (1 + 2 * Math.max(0, s.load - 1.5) * W.spiralInertia);
  s.yawRate += (yawTarget - s.yawRate) * Math.min(1, dt / tauYaw);
  // The yaw the bank does not carry: a collapsed wing turns partly in a skid (EN 926-2
  // tests: 15–45° of roll for 90–180° of turn on a B), and so does a flat turn.
  const rSkid = K_SKID * yawCollapse + 0.5 * s.skid * s.yawRate;
  s.rSkid = rSkid;
  const bankTarget = clamp(Math.atan((V * (s.yawRate - rSkid)) / G), -1.35, 1.35) + col.side * col.amount * 0.2;
  const wR = 2.1;
  // Roll inertia: pilot at the end of the lines plus the canopy's added mass; a heavier pilot is shaken less by the same gust.
  const inertia = (REF_MASS + 12) / (m + 12);
  const turbTorque = ((rng() - 0.5) * air.turbulence * 6 * W.turbRoll - 1.1 * asym) * inertia;
  s.bankRate += (wR * wR * (bankTarget - s.bank) - 2 * 0.32 * W.damping * wR * s.bankRate + turbTorque - 0.35 * s.wsRate) * dt;
  s.bank = clamp(s.bank + s.bankRate * dt, -1.45, 1.45);

  // Heading: follows the airflow (weathercock), plus the yaw the airflow does not explain:
  // the skid of a collapsed wing or of a flat turn (a few degrees of sideslip).
  const rExtra = 0.25 * rSkid;
  const wc = smoothstep(1, 4, vh) * (1 - 0.85 * offFlow);
  s.beta += (rExtra - (s.beta / 0.3) * wc) * dt;
  s.beta = wrapPi(s.beta);
  const newHeading = wrapPi(chi + s.beta);
  s.turnRate += (wrapPi(newHeading - s.heading) / dt - s.turnRate) * Math.min(1, dt / 0.15);
  s.heading = (newHeading + 2 * Math.PI) % (2 * Math.PI);

  // --- Motion: the inertial velocity integrates the forces.
  s.vx += accX * dt;
  s.vy += accY * dt;
  s.vz += accZ * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  s.airspeed = V;
  s.vzAir = rz;

  // --- Brake pressure in each hand: grows with the dynamic pressure and the travel, drops
  // when the angle of attack nears the fold (the cue of active piloting) or the stall
  // (the brake goes soft), slack on a folded side.
  const qRel = (V / (POLAR[0][1] * W.speed * scale)) ** 2;
  const foldL = col.side < 0 ? Math.min(1, col.amount * 1.6) : 0;
  const foldR = col.side > 0 ? Math.min(1, col.amount * 1.6) : 0;
  const kp = Math.min(1, dt / 0.05);
  // The margin this brake setting has in steady flight: the pressure is felt relative to it.
  const steadyL = (aTrim - thrL) / DEG;
  const steadyR = (aTrim - thrR) / DEG;
  s.pressureL += (brakePressure(s.brakeL, s.marginL, steadyL, clL, A.clStall, Math.max(foldL, col.frontal), s.stall, qRel) - s.pressureL) * kp;
  s.pressureR += (brakePressure(s.brakeR, s.marginR, steadyR, clR, A.clStall, Math.max(foldR, col.frontal), s.stall, qRel) - s.pressureR) * kp;
  return events ?? NO_EVENTS;
}

/**
 * Brake pressure in one hand (kg): ~4 kg at half brake in steady flight, rising with the
 * dynamic pressure; it follows the angle of attack's margin before a fold relative to its
 * steady value (`margin`, `steady`, deg): it fades as a gust or a surge lowers the angle of
 * attack (the cue of active piloting), firms up as the wing pitches back, goes soft as the
 * side nears its CLmax (before the stall) and slack on a folded side.
 */
function brakePressure(b: number, margin: number, steady: number, clSide: number, clStall: number, fold: number, stall: number, qRel: number): number {
  const travel = 9.5 * b + 8 * b * b;
  const pf = clamp(margin / Math.max(3, steady), 0, 1.3) * (1 - 0.6 * smoothstep(clStall - 0.25, clStall, clSide)) * (1 - fold) * (1 - 0.7 * stall);
  return 0.35 + qRel * travel * pf;
}

/**
 * Shape of the wing for drawing: per span station (-1 left tip … +1 right tip), how far
 * the trailing edge is pulled down by the brake and how much of the cell is folded.
 */
export function wingDeformation(s: GliderState, station: number): { brake: number; fold: number; front: number } {
  const brake = station < 0 ? s.brakeL * Math.min(1, -station * 1.4) : s.brakeR * Math.min(1, station * 1.4);
  const c = s.collapse;
  // Big ears: the outer cells folded under on both sides.
  let fold = (s.ears ?? 0) * Math.max(0, Math.min(1, (Math.abs(station) - 0.72) / 0.2));
  // Cravat: the caught tip stays folded.
  if (c.cravat > 0 && Math.sign(station) === c.cravatSide) fold = Math.max(fold, Math.max(0, Math.min(1, (Math.abs(station) - (1 - c.cravat * 2)) / 0.15)));
  if (c.amount > 0 && Math.sign(station) === c.side) {
    const edge = 1 - 2 * c.amount; // station beyond which the span is folded
    fold = Math.max(fold, Math.min(1, Math.max(0, (Math.abs(station) - edge) / Math.max(0.05, 1 - edge))));
  }
  return { brake, fold, front: c.frontal };
}
