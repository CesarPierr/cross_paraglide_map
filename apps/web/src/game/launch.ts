/**
 * On the ground: take-off (inflation, control of the wing overhead, run, lift-off) and the
 * landing's run-out.
 *
 * A simplified but credible model of what a pilot manages on a take-off:
 * - the wing lies on the ground behind (forward launch) or in front of the pilot facing it
 *   (reverse launch); the relative wind (the site's wind plus the run) inflates it and it
 *   rises towards the zenith, held back by gravity;
 * - without a dab of brake as it arrives overhead it overshoots and shoots ahead (a
 *   frontal on the ground): failed;
 * - a cross wind and an uneven pull lay it off to one side: the pilot corrects with the
 *   brake on the high side (here, the opposite brake) and by moving under it; running, the
 *   brakes also steer the run;
 * - in a reverse launch the pilot faces the wing, then turns around once it is overhead; in
 *   a strong wind the wing lifts off the ground by itself into a "wall" (leading edge open,
 *   held low with the brakes) from which it is raised under control; one side first with a
 *   cross wind (cobra);
 * - the wing pulls along its lines with the dynamic pressure: past what the pilot's feet
 *   hold (friction under his remaining weight, plus leaning), it drags him downwind; facing
 *   the wing with it overhead in a strong wind, it plucks him off backwards. Killing it (C
 *   risers or both brakes to the stop) stalls it back to the ground: a clean abort;
 * - running with the wing overhead builds the airspeed; once it is enough for the wing to
 *   carry the pilot (≈ 22–25 km/h of airspeed) and the slope falls away, he is flying.
 * Angles: wing elevation θ (0 on the ground behind, π/2 overhead, more = ahead), wing
 * side angle φ (+ = to the pilot's right).
 */

export type LaunchMode = 'forward' | 'reverse';
export type LaunchPhase = 'ready' | 'inflating' | 'running' | 'airborne' | 'failed' | 'aborted';

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
  /** Run direction relative to the take-off's facing (rad, + = right): the brakes steer the run. */
  dir: number;
  /** Pull of the wing on the pilot (N): along the run (+ forward) and upwards. */
  pullX: number;
  pullZ: number;
  /** Speed at which the wing drags the pilot downwind (m/s) and for how long it has. */
  drag: number;
  dragT: number;
  /** The wing is being killed (C risers or full brakes): it falls back to the ground. */
  killing: boolean;
  /** Reverse launch held as a wall (wing low, leading edge open) in a strong wind. */
  wall: boolean;
}

export interface LaunchInput {
  /** Run forward / pull the A risers (reverse). */
  go: boolean;
  brakeL: number;
  brakeR: number;
  /** Turn around (reverse launch). */
  turn: boolean;
  /** Kill the wing: pull the C risers (or both brakes to the stop). */
  kill?: boolean;
}

export function newLaunch(mode: LaunchMode): LaunchState {
  return { mode, phase: 'ready', facingWing: mode === 'reverse', theta: 0.05, thetaRate: 0, phi: 0, phiRate: 0, run: 0, dist: 0, airspeed: 0, stable: 0, failReason: null, dir: 0, pullX: 0, pullZ: 0, drag: 0, dragT: 0, killing: false, wall: false };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const RHO = 1.12;
/** Flat area (m²), pilot mass (kg) and the force coefficient of a wing pulling at a high angle of attack. */
const AREA = 25;
const MASS = 95;
const G = 9.81;

/**
 * Pull of the wing along its lines (N) at elevation θ in a relative wind va: small while it
 * lies flat, strongest as it climbs through 45–70°, mostly lift once overhead; killed it
 * stalls and lets go.
 */
function wingPull(va: number, theta: number, brake: number, killing: boolean, wall: boolean): number {
  const q = 0.5 * RHO * va * va;
  const rising = 0.25 + 0.75 * Math.sin(clamp(theta, 0, Math.PI / 2));
  const coef = (wall ? 0.45 : 1.1) * (killing ? 0.15 : 1 - 0.35 * clamp(brake - 0.3, 0, 0.6));
  return q * AREA * coef * rising;
}

/**
 * One step on the ground. `headwind` and `crosswind` (m/s, + = from the right) are the
 * site's wind relative to the take-off direction; `slope` the ground slope ahead (m/m, + =
 * falling away).
 */
export function launchStep(s: LaunchState, inp: LaunchInput, headwind: number, crosswind: number, slope: number, dt: number): void {
  if (s.phase === 'airborne' || s.phase === 'failed' || s.phase === 'aborted') return;
  const b = (inp.brakeL + inp.brakeR) / 2;
  // Killing the wing: the C risers, or both brakes held to the stop.
  s.killing = !!inp.kill || (inp.brakeL > 0.85 && inp.brakeR > 0.85);
  // Pilot: runs (or steps back pulling the A risers in a reverse launch), braked by the
  // wing while it is still low behind him, helped by the slope.
  const pulling = inp.go && !s.killing && (!s.facingWing || s.theta < 0.9);
  if (s.facingWing) {
    s.run = 0;
  } else {
    const drag = 1.6 * Math.cos(s.theta) * (s.theta < Math.PI / 2 ? 1 : 0) + 0.5 * b;
    const acc = inp.go ? 3.2 - 0.55 * s.run - drag + 6 * clamp(slope, 0, 0.5) : -2.5 * Math.sign(s.run) - drag;
    // While inflating the pilot walks or trots into the lines; he only runs once the wing is up.
    s.run = clamp(s.run + acc * dt, 0, s.theta < 1.2 ? 2.8 : 6.5);
    s.dist += s.run * dt;
  }
  if (inp.go && s.phase === 'ready' && !s.killing) s.phase = 'inflating';
  const va = Math.max(0, headwind + s.run + (pulling && s.facingWing ? 1.6 : 0));
  s.airspeed = va;

  // A reverse launch in a wind: the wind opens the leading edge and lifts the wing into a
  // wall, held low with the brakes until the pilot pulls the A risers.
  s.wall = s.mode === 'reverse' && s.phase === 'ready' && !s.killing && va > 3 && b < 0.5;

  // Wing elevation: the wing flies towards its equilibrium overhead (a little behind when
  // braked) with a force growing as the square of the airspeed; its inertia carries it past
  // that point (overshoot), the brakes damp it; without enough air it falls back. Killed,
  // it stalls back to the ground.
  const thetaEq = s.killing ? 0.02 : s.wall ? 0.6 : 1.5 - 0.55 * b;
  const active = s.phase !== 'ready' || s.wall || s.killing;
  const aero = active ? (0.085 * va * va * (s.killing ? 0.6 : 1) + (pulling ? 0.9 : 0) + (s.killing ? 1.5 : 0)) * Math.sin(thetaEq - s.theta) : 0;
  const grav = 1.25 * Math.cos(s.theta) * (va < 3 || s.killing ? 1 : 0.35);
  const thetaAcc = aero - grav - (0.4 + 2.8 * b + (s.wall ? 1.5 : 0)) * s.thetaRate;
  s.thetaRate += thetaAcc * dt;
  // The wing cannot swing faster than the air carrying it along the lines (~7 m).
  const maxRate = 0.4 + va / 7;
  s.thetaRate = clamp(s.thetaRate, -maxRate - (s.killing ? 1 : 0), maxRate);
  s.theta = clamp(s.theta + s.thetaRate * dt, 0, 2.4);
  if (s.theta <= 0.001 && s.thetaRate < 0) s.thetaRate = 0;

  // Side angle: the cross wind pushes the wing downwind as it rises; the pilot brakes the
  // high side (the one opposite to where it falls) and moves under it (a restoring pull
  // that grows with the run).
  const up = Math.sin(clamp(s.theta, 0, Math.PI / 2));
  const phiAcc = -0.45 * crosswind * up + 3.0 * (inp.brakeR - inp.brakeL) * up - (0.6 + 0.3 * s.run) * s.phi - 1.6 * s.phiRate;
  s.phiRate += phiAcc * dt;
  s.phi = clamp(s.phi + s.phiRate * dt, -1.6, 1.6);
  // Running under the wing: the brakes steer the run, and the pilot follows the wing's side.
  if (!s.facingWing && s.phase === 'running') s.dir = clamp(s.dir + (0.35 * (inp.brakeR - inp.brakeL) * Math.min(1, s.run / 3) + 0.3 * s.phi * Math.min(1, s.run / 2)) * dt, -0.7, 0.7);

  // The wing's pull on the pilot and what his feet hold.
  const pull = wingPull(va, s.theta, b, s.killing, s.wall);
  const elev = clamp(s.theta, 0, Math.PI);
  // Facing forward the wing is behind: its horizontal pull holds the pilot back (downwind).
  s.pullX = -pull * Math.cos(elev);
  s.pullZ = pull * Math.sin(elev);
  const grip = 0.6 * Math.max(0, MASS * G - s.pullZ) + 180;
  const excess = -s.pullX - grip;
  if (excess > 0) s.drag = Math.min(4, s.drag + (excess / MASS) * dt);
  else s.drag = Math.max(0, s.drag - 2.5 * dt);
  s.dragT = s.drag > 0.6 ? s.dragT + dt : Math.max(0, s.dragT - dt);
  if (!s.facingWing) s.run = Math.max(0, s.run - s.drag * dt * 2);

  if (s.theta > 1.0 && s.phase === 'inflating') s.phase = 'running';
  if (s.facingWing && inp.turn && s.theta > 1.2 && s.theta < 1.9 && Math.abs(s.phi) < 0.4) s.facingWing = false;

  if (s.killing && s.phase !== 'ready' && s.theta < 0.35 && s.drag < 0.3) {
    s.phase = 'aborted';
    s.failReason = 'Décollage interrompu : voile affalée proprement (C ou freins à fond). Replace-la pour recommencer.';
    return;
  }
  if (s.facingWing && s.pullZ > 0.9 * MASS * G && s.theta > 1) fail(s, 'Arraché vers l’arrière par la voile : en vent fort, garde-la basse en mur, monte-la sous contrôle et affale-la (C, X) si elle t’emmène.');
  else if (s.dragT > 1.2) fail(s, 'Traîné par la voile : en vent fort, ne lutte pas, affale-la (C ou freins à fond, X) et rapproche-toi d’elle.');
  else if (s.theta > 1.95) fail(s, 'L’aile t’a dépassé : il fallait la temporiser au frein en arrivant au-dessus de toi.');
  else if (Math.abs(s.phi) > 0.85) fail(s, 'L’aile est partie sur le côté : contre au frein opposé et place-toi dessous.');
  else if (s.phase === 'running' && s.theta < 0.35 && s.thetaRate < 0 && !s.killing) fail(s, 'L’aile est retombée derrière : il manquait de vitesse ou il y avait trop de frein.');
  else if (s.dist > 45) fail(s, 'Bout du déco atteint sans décoller : l’aile n’était pas stable au-dessus de toi.');

  // Lift-off: wing overhead and stable, enough airspeed, the ground falling away.
  const overhead = s.theta > 1.25 && s.theta < 1.85 && Math.abs(s.phi) < 0.35 && Math.abs(s.thetaRate) < 0.35 && Math.abs(s.phiRate) < 0.4;
  s.stable = overhead ? s.stable + dt : 0;
  if (!s.facingWing && !s.killing && s.stable > 0.6 && va > 6.3 && (slope > 0.12 || va > 7.5)) s.phase = 'airborne';
}

function fail(s: LaunchState, why: string): void {
  s.phase = 'failed';
  s.failReason = why;
}

// --- Landing.

export type TouchdownKind = 'landed' | 'hard' | 'crash';

/**
 * Contact with the ground: the impact is the speed into the slope (along its normal), the
 * run-out the speed along it. Legs absorb ~2.5 m/s into the ground (a jump from 30 cm),
 * 4 m/s hurts; on a slope steeper than ~40° nobody runs it out.
 */
export function touchdown(vx: number, vy: number, vz: number, nx: number, ny: number, nz: number): { kind: TouchdownKind | null; impact: number; along: number; reason: string } {
  const vn = vx * nx + vy * ny + vz * nz;
  const impact = Math.max(0, -vn);
  const tx = vx - vn * nx;
  const ty = vy - vn * ny;
  const tz = vz - vn * nz;
  const along = Math.hypot(tx, ty, tz);
  const steep = Math.acos(clamp(nz, -1, 1));
  if (impact > 4 || along > 11) return { kind: 'crash', impact, along, reason: impact > 4 ? 'Impact trop fort dans le sol : arrondi trop tard ou trop tôt, ou pas assez de vitesse.' : 'Beaucoup trop de vitesse sol pour courir : vent arrière ou pas d’arrondi.' };
  if (steep > (40 * Math.PI) / 180 && along > 3) return { kind: 'crash', impact, along, reason: 'Posé dans une pente trop raide : on y roule plus qu’on ne court.' };
  if (impact > 2.5) return { kind: 'hard', impact, along, reason: 'Posé dur : l’arrondi n’a pas cassé la vitesse verticale.' };
  return { kind: null, impact, along, reason: '' };
}

export interface LandingState {
  phase: 'running' | 'done';
  /** Run-out speed along the ground (m/s, + forward) and its direction (rad). */
  v: number;
  dir: number;
  /** Wing elevation (π/2 overhead), its rate, and time since touchdown (s). */
  theta: number;
  thetaRate: number;
  t: number;
  /** Time spent faster than the pilot can run (s), and unable to slow down (s): a fall when it lasts. */
  over: number;
  noStop: number;
  dragT: number;
  kind: TouchdownKind;
  reason: string;
}

export function newLanding(along: number, dir: number): LandingState {
  return { phase: 'running', v: along, dir, theta: 1.45, thetaRate: 0, t: 0, over: 0, noStop: 0, dragT: 0, kind: 'landed', reason: '' };
}

/**
 * Run-out after touchdown: the pilot runs it out (decelerating ~3 m/s², more with the wing
 * braked behind him), helped uphill and pushed downhill (g·sin of the slope); he cannot run
 * much faster than 6.5 m/s and falls if he must for long. The wing keeps flying above him
 * while it has air (a strong headwind can drag him backwards) until he kills it with the
 * brakes or the C risers. `headwind` m/s along the run, `slopeDown` m/m (+ = downhill ahead).
 */
export function landingStep(s: LandingState, brake: number, kill: boolean, headwind: number, slopeDown: number, dt: number): void {
  if (s.phase === 'done') return;
  s.t += dt;
  const killing = kill || brake > 0.8;
  const va = Math.max(0, headwind + s.v);
  // The wing: flies above while there is air and the brakes are not pulled, falls behind otherwise.
  const thetaEq = killing ? 0.05 : va > 4 ? 1.45 : 0.3;
  const aero = (0.085 * va * va + (killing ? 1.5 : 0.3)) * Math.sin(thetaEq - s.theta);
  const grav = 1.25 * Math.cos(s.theta) * (va < 3 || killing ? 1 : 0.35);
  s.thetaRate += (aero - grav - (0.8 + 2 * brake) * s.thetaRate) * dt;
  s.theta = clamp(s.theta + s.thetaRate * dt, 0, 2.2);
  if (s.theta <= 0.001 && s.thetaRate < 0) s.thetaRate = 0;
  // Its pull (backwards while it flies behind/above in the wind) and its lift that unloads the legs.
  const pull = wingPull(va, s.theta, brake, killing, false);
  const back = pull * Math.cos(clamp(s.theta, 0, Math.PI)) * 0.6 + 0.15 * pull * clamp(brake, 0, 1);
  const legs = (s.v > 0.2 ? 3.0 : s.v < -0.2 ? -3.0 : 0) * (1 - 0.4 * clamp(pull / (MASS * G), 0, 1));
  const slopeAcc = G * Math.sin(Math.atan(slopeDown));
  s.v += (-legs - back / MASS + slopeAcc) * dt;
  if (Math.abs(s.v) < 0.25 && Math.abs(slopeAcc) < 2.5 && back < 200) s.v = 0;
  // Faster than a sprint (~6.5 m/s with the wing still carrying part of the weight): a stumble builds with the excess.
  s.over = s.v > 6.5 ? s.over + dt * (s.v - 6.5) : Math.max(0, s.over - dt);
  // Downhill, the legs cannot brake the run: it does not slow down any more.
  s.noStop = s.v > 4.5 && slopeAcc > 1.5 ? s.noStop + dt : Math.max(0, s.noStop - dt);
  s.dragT = s.v < -1 ? s.dragT + dt : Math.max(0, s.dragT - dt);
  if (s.over > 0.25 || s.noStop > 2) {
    s.kind = 'hard';
    s.reason = s.over > 0.25 ? 'Trop vite pour courir : chute au posé (arrondi trop faible ou vent arrière).' : 'Impossible de s’arrêter dans la pente descendante : chute (pose face à la pente ou plus lentement).';
    s.phase = 'done';
  } else if (s.dragT > 1.2) {
    s.kind = 'hard';
    s.reason = 'Traîné par la voile après le posé : affale-la tout de suite (freins à fond ou C) quand il y a du vent.';
    s.phase = 'done';
  } else if ((s.v === 0 && s.theta < 0.6) || s.t > 8) {
    s.phase = 'done';
  }
}
