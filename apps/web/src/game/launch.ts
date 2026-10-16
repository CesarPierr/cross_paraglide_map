/**
 * Take-off on the ground: inflation, control of the wing overhead, run, lift-off.
 *
 * A simplified but credible model of what a pilot manages on a take-off:
 * - the wing lies on the ground behind (forward launch) or in front of the pilot facing it
 *   (reverse launch); the relative wind (the site's wind plus the run) inflates it and it
 *   rises towards the zenith, held back by gravity;
 * - without a dab of brake as it arrives overhead it overshoots and shoots ahead (a
 *   frontal on the ground): failed;
 * - a cross wind and an uneven pull lay it off to one side: the pilot corrects with the
 *   brake on the high side (here, the opposite brake) and by moving under it;
 * - in a reverse launch the pilot faces the wing, then turns around once it is overhead;
 * - running with the wing overhead builds the airspeed; once it is enough for the wing to
 *   carry the pilot (≈ 22–25 km/h of airspeed) and the slope falls away, he is flying.
 * Angles: wing elevation θ (0 on the ground behind, π/2 overhead, more = ahead), wing
 * side angle φ (+ = to the pilot's right).
 */

export type LaunchMode = 'forward' | 'reverse';
export type LaunchPhase = 'ready' | 'inflating' | 'running' | 'airborne' | 'failed';

export interface LaunchState {
  mode: LaunchMode;
  phase: LaunchPhase;
  /** Pilot facing the wing (reverse launch, before turning around). */
  facingWing: boolean;
  theta: number;
  thetaRate: number;
  phi: number;
  phiRate: number;
  /** Pilot's run speed along the take-off direction (m/s). */
  run: number;
  /** Distance run from the start (m). */
  dist: number;
  /** Airspeed felt by the wing (m/s). */
  airspeed: number;
  /** Time the wing has been held stable overhead (s): a real pilot checks it before committing. */
  stable: number;
  failReason: string | null;
}

export interface LaunchInput {
  /** Run forward / pull the A risers (reverse). */
  go: boolean;
  brakeL: number;
  brakeR: number;
  /** Turn around (reverse launch). */
  turn: boolean;
}

export function newLaunch(mode: LaunchMode): LaunchState {
  return { mode, phase: 'ready', facingWing: mode === 'reverse', theta: 0.05, thetaRate: 0, phi: 0, phiRate: 0, run: 0, dist: 0, airspeed: 0, stable: 0, failReason: null };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * One step on the ground. `headwind` and `crosswind` (m/s, + = from the right) are the
 * site's wind relative to the take-off direction; `slope` the ground slope ahead (m/m, + =
 * falling away).
 */
export function launchStep(s: LaunchState, inp: LaunchInput, headwind: number, crosswind: number, slope: number, dt: number): void {
  if (s.phase === 'airborne' || s.phase === 'failed') return;
  const b = (inp.brakeL + inp.brakeR) / 2;
  // Pilot: runs (or steps back pulling the A risers in a reverse launch), braked by the
  // wing while it is still low behind him, helped by the slope.
  const pulling = inp.go && (!s.facingWing || s.theta < 0.9);
  if (s.facingWing) {
    s.run = 0;
  } else {
    const drag = 1.6 * Math.cos(s.theta) * (s.theta < Math.PI / 2 ? 1 : 0) + 0.5 * b;
    const acc = inp.go ? 3.2 - 0.55 * s.run - drag + 6 * clamp(slope, 0, 0.5) : -2.5 * Math.sign(s.run) - drag;
    // While inflating the pilot walks or trots into the lines; he only runs once the wing is up.
    s.run = clamp(s.run + acc * dt, 0, s.theta < 1.2 ? 2.8 : 6.5);
    s.dist += s.run * dt;
  }
  if (inp.go && s.phase === 'ready') s.phase = 'inflating';
  const va = Math.max(0, headwind + s.run + (pulling && s.facingWing ? 1.6 : 0));
  s.airspeed = va;

  // Wing elevation: the wing flies towards its equilibrium overhead (a little behind when
  // braked) with a force growing as the square of the airspeed; its inertia carries it past
  // that point (overshoot), the brakes damp it; without enough air it falls back.
  const thetaEq = 1.5 - 0.55 * b;
  const aero = s.phase === 'ready' ? 0 : (0.085 * va * va + (pulling ? 0.9 : 0)) * Math.sin(thetaEq - s.theta);
  const grav = 1.25 * Math.cos(s.theta) * (va < 3 ? 1 : 0.35);
  const thetaAcc = aero - grav - (0.4 + 2.8 * b) * s.thetaRate;
  s.thetaRate += thetaAcc * dt;
  // The wing cannot swing faster than the air carrying it along the lines (~7 m).
  const maxRate = 0.4 + va / 7;
  s.thetaRate = clamp(s.thetaRate, -maxRate, maxRate);
  s.theta = clamp(s.theta + s.thetaRate * dt, 0, 2.4);
  if (s.theta <= 0.001 && s.thetaRate < 0) s.thetaRate = 0;

  // Side angle: the cross wind pushes the wing downwind as it rises; the pilot brakes the
  // high side (the one opposite to where it falls) and moves under it (a restoring pull
  // that grows with the run).
  const up = Math.sin(clamp(s.theta, 0, Math.PI / 2));
  const phiAcc = -0.45 * crosswind * up + 3.0 * (inp.brakeR - inp.brakeL) * up - (0.6 + 0.3 * s.run) * s.phi - 1.6 * s.phiRate;
  s.phiRate += phiAcc * dt;
  s.phi = clamp(s.phi + s.phiRate * dt, -1.6, 1.6);

  if (s.theta > 1.0 && s.phase === 'inflating') s.phase = 'running';
  if (s.facingWing && inp.turn && s.theta > 1.2 && s.theta < 1.9 && Math.abs(s.phi) < 0.4) s.facingWing = false;

  if (s.theta > 1.95) fail(s, 'L’aile t’a dépassé : il fallait la temporiser au frein en arrivant au-dessus de toi.');
  else if (Math.abs(s.phi) > 0.85) fail(s, 'L’aile est partie sur le côté : contre au frein opposé et place-toi dessous.');
  else if (s.phase === 'running' && s.theta < 0.35 && s.thetaRate < 0) fail(s, 'L’aile est retombée derrière : il manquait de vitesse ou il y avait trop de frein.');
  else if (s.dist > 45) fail(s, 'Bout du déco atteint sans décoller : l’aile n’était pas stable au-dessus de toi.');

  // Lift-off: wing overhead and stable, enough airspeed, the ground falling away.
  const overhead = s.theta > 1.25 && s.theta < 1.85 && Math.abs(s.phi) < 0.35 && Math.abs(s.thetaRate) < 0.35 && Math.abs(s.phiRate) < 0.4;
  s.stable = overhead ? s.stable + dt : 0;
  if (!s.facingWing && s.stable > 0.6 && va > 6.3 && (slope > 0.12 || va > 7.5)) s.phase = 'airborne';
}

function fail(s: LaunchState, why: string): void {
  s.phase = 'failed';
  s.failReason = why;
}
