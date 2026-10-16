/**
 * Paraglider flight model for the game: a wing with a measured-like polar, the pilot
 * hanging ~7 m below it as a pendulum (pitch and roll swing), coordinated turns from
 * the brakes with automatic weight shift, and the incidents a real wing has: collapses
 * from negative gusts (asymmetric or frontal), stall when both brakes are held deep,
 * spin when one side is braked hard at low speed.
 *
 * Frame: x east, y north, z up (metres, altitude above sea level). Heading in radians,
 * clockwise from north. Pure and deterministic given its random source: unit-tested.
 */

export const G = 9.81;
/** Line length, pilot to wing (m): sets the pendulum period (~5.3 s). */
const LINE_M = 7;
const PITCH_OMEGA = Math.sqrt(G / LINE_M);

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
  /** Multiplier on the gust needed to fold the wing. */
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
  heading: number;
  /** Horizontal airspeed along the heading (m/s). */
  airspeed: number;
  /** Vertical speed relative to the air (m/s, negative = sinking). */
  vzAir: number;
  /** Vertical speed relative to the ground (vario), m/s. */
  vz: number;
  /** Ground velocity (m/s). */
  vx: number;
  vy: number;
  bank: number;
  bankRate: number;
  /** Pendulum pitch of the wing relative to the pilot (rad, + = wing ahead / diving). */
  pitch: number;
  pitchRate: number;
  yawRate: number;
  /** Actual brake positions (the hands move at a finite speed). */
  brakeL: number;
  brakeR: number;
  speedbar: number;
  /** Automatic weight shift used in the turn, -1..1 (+ = right). */
  weightShift: number;
  /** Big ears 0..1 (folding in or reopening over ~1.5 s). */
  ears: number;
  /** All-up weight (kg): a heavier pilot flies faster and sinks more (√ of the load). */
  mass: number;
  collapse: Collapse;
  /** Developed stall 0..1 and spin 0..1. */
  stall: number;
  spin: number;
  /** Load factor (g). */
  load: number;
  /** High-passed vertical gust, kept to detect the sharp edges that fold a wing. */
  gustHp: number;
  /** Vertical air smoothed by the wing's inertia, and the raw value of the last step. */
  lastW: number;
  lastRawW: number;
  /** Brake travel on each side 0.3 s ago, to detect pumping on a collapsed side. */
  pumpL: number;
  pumpR: number;
}

/** Polar of a mid-range (EN-B) wing: brake travel → [airspeed, sink] (m/s). */
const POLAR: [number, number, number][] = [
  [0, 10.4, 1.05],
  [0.2, 9.4, 0.98],
  [0.4, 8.5, 1.1],
  [0.6, 7.6, 1.4],
  [0.8, 6.8, 2.0],
  [0.9, 6.2, 2.6],
  [1, 5.6, 3.4],
];

export function polar(brake: number, speedbar: number, wing: WingParams = WINGS.B): { v: number; sink: number } {
  const b = Math.min(1, Math.max(0, brake));
  let i = 0;
  while (i < POLAR.length - 2 && b > POLAR[i + 1][0]) i++;
  const [b0, v0, s0] = POLAR[i];
  const [b1, v1, s1] = POLAR[i + 1];
  const f = (b - b0) / (b1 - b0);
  const s = Math.min(1, Math.max(0, speedbar)) * (1 - b);
  return { v: (v0 + (v1 - v0) * f) * wing.speed + wing.bar * s, sink: (s0 + (s1 - s0) * f) * wing.sink + 0.95 * s * s };
}

/** Air density (kg/m³) at an altitude (m), standard atmosphere. */
export function airDensity(z: number): number {
  return 1.225 * Math.pow(Math.max(0.2, 1 - 2.2558e-5 * z), 4.2559);
}

/** The polar is that of a test flight around 500 m. */
const RHO_REF = airDensity(500);

/** Reference all-up weight of the wing's polar (kg): middle of a 25 m² wing's range. */
export const REF_MASS = 95;

export function newGlider(x: number, y: number, z: number, heading: number, wing: WingParams = WINGS.B): GliderState {
  const p = polar(0, 0, wing);
  return {
    wing,
    x,
    y,
    z,
    heading,
    airspeed: p.v,
    vzAir: -p.sink,
    vz: -p.sink,
    vx: Math.sin(heading) * p.v,
    vy: Math.cos(heading) * p.v,
    bank: 0,
    bankRate: 0,
    pitch: 0,
    pitchRate: 0,
    yawRate: 0,
    brakeL: 0,
    brakeR: 0,
    speedbar: 0,
    weightShift: 0,
    ears: 0,
    mass: REF_MASS,
    collapse: { side: 0, amount: 0, frontal: 0, cravat: 0, cravatSide: 0 },
    stall: 0,
    spin: 0,
    load: 1,
    gustHp: 0,
    lastW: 0,
    lastRawW: 0,
    pumpL: 0,
    pumpR: 0,
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const approach = (v: number, target: number, rate: number, dt: number) => v + clamp(target - v, -rate * dt, rate * dt);

export type Rng = () => number;

/** Events the HUD reports (a collapse, a stall…), returned by `step`. */
export type FlightEvent = 'collapse-left' | 'collapse-right' | 'frontal' | 'stall' | 'spin' | 'reopened' | 'cravat' | 'cravat-cleared';

/** Advances the glider by `dt` seconds (call with dt ≤ 1/60 for stability). */
export function step(s: GliderState, c: Controls, air: AirSample, dt: number, rng: Rng): FlightEvent[] {
  const events: FlightEvent[] = [];
  // Hands and bar move at a human speed.
  s.brakeL = approach(s.brakeL, clamp(c.brakeL, 0, 1), 2.4, dt);
  s.brakeR = approach(s.brakeR, clamp(c.brakeR, 0, 1), 2.4, dt);
  // The bar is pushed progressively with the legs, released faster.
  s.speedbar = approach(s.speedbar, clamp(c.speedbar, 0, 1), c.speedbar > s.speedbar ? 0.8 : 2, dt);
  s.ears = approach(s.ears, c.ears ? 1 : 0, 0.7, dt);
  const bAvg = (s.brakeL + s.brakeR) / 2;
  const bDiff = s.brakeR - s.brakeL;

  // --- Gusts: a sharp drop of the vertical air speed lowers the angle of attack; under
  // little brake pressure (or accelerated) the wing folds. Active piloting (some brake)
  // keeps it inflated.
  // The wing has inertia (and the air its added mass): it reacts to the vertical air
  // smoothed over a few tenths of a second, not to every jolt.
  const wLp = s.lastW + (air.w - s.lastW) * Math.min(1, dt / 0.3);
  const dw = wLp - s.lastW;
  s.lastW = wLp;
  // A sharp edge of the raw air is what folds a wing.
  const dwRaw = air.w - s.lastRawW;
  s.lastRawW = air.w;
  s.gustHp = s.gustHp * Math.exp(-dt / 0.6) + dwRaw;
  const W = s.wing;
  // Brake pressure (active piloting) firms the wing up; the bar softens it.
  // Big ears load the centre section: much harder to fold.
  const firmness = (1 + 2 * clamp(bAvg - 0.1, 0, 0.4) - 0.45 * s.speedbar) * W.firmness * (1 + 0.8 * s.ears);
  const col = s.collapse;
  if (col.amount < 0.05 && col.frontal < 0.05 && s.stall < 0.3) {
    const threshold = 2 * firmness;
    if (s.gustHp < -threshold) {
      const excess = -s.gustHp - threshold;
      if (excess > 1.4 * firmness && rng() < 0.35) {
        col.frontal = clamp(0.5 + excess / 4, 0.5, 1);
        events.push('frontal');
      } else {
        col.side = rng() < 0.5 ? -1 : 1;
        col.amount = clamp(0.25 + excess / 3.5, 0.25, W.collapseMax);
        col.peak = col.amount;
        events.push(col.side < 0 ? 'collapse-left' : 'collapse-right');
      }
      s.gustHp = 0;
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
      // A big fold may leave the tip caught in the lines (more likely on a demanding wing).
      if ((col.peak ?? 0) > 0.55 && rng() < (W.id === 'C' ? 0.35 : W.id === 'B' ? 0.15 : 0.03)) {
        col.cravat = 0.18 + 0.12 * rng();
        col.cravatSide = col.side;
        events.push('cravat');
      } else events.push('reopened');
      col.side = 0;
      col.peak = 0;
    }
  }
  if (col.cravat > 0) {
    // Cleared by pulling the stabilo line, or now and then by a firm pump on that side.
    const pump = col.cravatSide < 0 ? s.brakeL - s.pumpL : s.brakeR - s.pumpR;
    if (c.stabilo) col.cravat = Math.max(0, col.cravat - dt * 0.2);
    else if (pump > 0.25 && rng() < dt * 3) col.cravat = Math.max(0, col.cravat - 0.1);
    if (col.cravat === 0) {
      col.cravatSide = 0;
      events.push('cravat-cleared');
    }
  }
  if (col.frontal > 0) {
    col.frontal = Math.max(0, col.frontal - dt * (0.35 + W.reopen * 1.3));
    if (col.frontal === 0) events.push('reopened');
  }

  // --- Stall (both brakes deep) and spin (one side deep at low speed).
  const deepStall = bAvg > W.stallBrake || (bAvg > W.stallBrake - 0.08 && s.airspeed < 5.8);
  if (deepStall) {
    if (s.stall < 0.5 && s.stall + dt / 1.2 >= 0.5) events.push('stall');
    s.stall = Math.min(1, s.stall + dt / 1.2);
  } else if (bAvg < 0.6) s.stall = Math.max(0, s.stall - dt / 1.5);
  const hard = Math.max(s.brakeL, s.brakeR);
  const soft = Math.min(s.brakeL, s.brakeR);
  if (hard > W.spinBrake && soft < 0.45 && s.airspeed < 8 && s.stall < 0.5) {
    if (s.spin < 0.5 && s.spin + dt / 0.9 >= 0.5) events.push('spin');
    s.spin = Math.min(1, s.spin + dt / 0.9);
  } else if (hard < 0.5) s.spin = Math.max(0, s.spin - dt / 1.2);

  // --- Target flight point from the polar, degraded by incidents.
  const p0 = polar(bAvg, s.speedbar, W);
  // True airspeed and sink grow as the air thins (+10 % at 2000 m) and with the load.
  const scale = Math.sqrt(RHO_REF / airDensity(s.z)) * Math.sqrt(s.mass / REF_MASS);
  const p = { v: p0.v * scale, sink: p0.sink * scale };
  const cosB = Math.max(0.2, Math.cos(s.bank));
  let vTarget = p.v / Math.sqrt(cosB);
  // Big ears: ~20 % less area, about +1.3 m/s of sink, a little slower (EN manuals: 2–3 m/s total).
  let sink = p.sink / Math.pow(cosB, 1.5) + 2.2 * col.amount + 3.2 * col.frontal + 1.3 * s.ears + 5 * col.cravat;
  vTarget -= 0.8 * s.ears;
  // Parasitic drag (lines, pilot) grows with the square of the speed: what makes a spiral
  // or a full-bar glide sink much more than the bank alone would.
  sink += 0.045 * Math.max(0, s.airspeed - p.v) ** 2;
  vTarget *= 1 - 0.35 * col.frontal;
  const stallMix = s.stall;
  vTarget = vTarget * (1 - stallMix) + 2.5 * stallMix;
  sink = sink * (1 - stallMix) + 6.5 * stallMix;
  vTarget = vTarget * (1 - s.spin) + 3 * s.spin;
  sink = sink * (1 - s.spin) + 5.5 * s.spin;
  vTarget = Math.min(vTarget, 26);

  // --- Airspeed with inertia, plus the pendulum: a wing ahead of the pilot dives and
  // speeds up. Speed traded for height (and back) by energy conservation: braking makes
  // the glider climb a little before it slows, releasing makes it dive.
  const dV = (vTarget - s.airspeed) / 1.7 + G * Math.sin(s.pitch) * 0.55;
  s.airspeed = Math.max(0.5, s.airspeed + dV * dt);
  const exchange = -(s.airspeed * dV) / G * 0.75;
  s.vzAir = -sink + exchange;

  // --- Pitch pendulum: the wing lags behind when braked, surges when released,
  // pitches back entering a thermal (rising air raises the angle of attack).
  const pitchEq = clamp(0.055 * (vTarget - s.airspeed), -0.5, 0.6) - 0.6 * s.stall + 0.25 * col.frontal;
  const pitchAcc = PITCH_OMEGA * PITCH_OMEGA * (pitchEq - s.pitch) - 2 * 0.28 * W.damping * PITCH_OMEGA * s.pitchRate;
  // A step of rising air raises the angle of attack: the wing pitches back (and surges
  // forward leaving the thermal), the cue pilots feel entering and leaving a core.
  s.pitchRate += pitchAcc * dt - 0.12 * W.gustPitch * dw;
  s.pitch = clamp(s.pitch + s.pitchRate * dt, -1.2, 1.2);

  // --- Turn: differential brake, automatic weight shift into the turn. The yaw rate
  // grows with speed, the bank follows the coordinated turn with a pendular lag; deep
  // banks build speed and therefore bank (spiral).
  s.weightShift = approach(s.weightShift, clamp(bDiff * 1.4, -1, 1), 1.2, dt);
  const steer = bDiff + 0.35 * s.weightShift;
  // With big ears the brakes barely steer: the pilot turns with his weight.
  // Beyond ~60 % of differential input the turn tightens more than in proportion: held, it
  // builds speed, bank and turn rate until the spiral dive (EN 926-2: 4–5 g, 12–18 m/s).
  const steerNl = steer + Math.sign(steer) * 1.2 * Math.max(0, Math.abs(steer) - 0.6) ** 1.5;
  let yawTarget = W.turnGain * steerNl * (s.airspeed / 9.5) * (1 - 0.5 * s.ears);
  // Spiral stability: a tolerant wing damps its own turn when steeply banked.
  yawTarget *= 1 - W.spiralStab * Math.max(0, Math.min(1, (Math.abs(s.bank) - 0.7) / 0.5));
  // Rising air under one wing lifts it and turns the glider away from the thermal: the
  // pilot feels it and turns towards the lifted side to core it.
  const asym = (air.wR ?? air.w) - (air.wL ?? air.w);
  yawTarget -= 0.12 * asym;
  // A collapsed side drags the wing towards it; braking the open side counters it.
  yawTarget += col.side * col.amount * W.collapseYaw;
  // A cravat keeps turning the wing towards the caught side.
  yawTarget += col.cravatSide * col.cravat * 3.5;
  yawTarget += Math.sign(s.brakeR - s.brakeL || 1) * 2.2 * s.spin;
  yawTarget *= 1 - 0.8 * s.stall;
  // Spiral inertia: a fast, steep turn takes longer to unwind once released.
  const tauYaw = 0.55 * (1 + 2 * Math.max(0, s.load - 1.5) * W.spiralInertia);
  s.yawRate += (yawTarget - s.yawRate) * Math.min(1, dt / tauYaw);
  // A collapsed wing turns in a skid: much of its yaw does not bank it (EN 926-2 tests:
  // 15–45° of roll for 90–180° of turn on a B).
  const yawCollapse = col.side * col.amount * W.collapseYaw;
  const bankTarget = clamp(Math.atan((s.airspeed * (s.yawRate - 0.65 * yawCollapse)) / G), -1.35, 1.35) + col.side * col.amount * 0.2;
  const wR = 2.1;
  const turbTorque = (rng() - 0.5) * air.turbulence * 9 * W.turbRoll - 1.1 * asym;
  s.bankRate += (wR * wR * (bankTarget - s.bank) - 2 * 0.32 * W.damping * wR * s.bankRate + turbTorque) * dt;
  s.bank = clamp(s.bank + s.bankRate * dt, -1.45, 1.45);
  s.heading = (s.heading + s.yawRate * dt + 2 * Math.PI) % (2 * Math.PI);
  s.load = 1 / Math.max(0.25, Math.cos(s.bank));

  // --- Motion through the moving air.
  const ax = Math.sin(s.heading) * s.airspeed;
  const ay = Math.cos(s.heading) * s.airspeed;
  s.vx = ax + air.u;
  s.vy = ay + air.v;
  s.vz = s.vzAir + air.w;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  return events;
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
