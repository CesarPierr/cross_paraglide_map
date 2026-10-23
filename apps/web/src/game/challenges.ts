/**
 * Challenges from any take-off: reach the day's ceiling, an out-and-return, an FAI triangle.
 *
 * The turn points are generated from the relief around the take-off (the wind model's grid,
 * 216 m) and the day (ceiling, cloud base, wind), so that every take-off of the Alps gets a
 * course a pilot would set there:
 * - every turn point inside the model's playable grid, over relief that can be flown (not a
 *   plain or the sea: some relief within 2 km to make thermals), and low enough under the
 *   day's ceiling to be tagged (not a summit above the cloud base);
 * - the legs along the relief rather than across plains, and not through terrain higher than
 *   the ceiling; with a wind, the first leg into it (the way back is downwind, as pilots plan);
 * - distances exact: the out-and-return turn point at 5, 10 or 20 km; the triangle's
 *   perimeter 10, 25 or 50 km with its shortest side ≥ 28 % of it (FAI rule), the take-off on
 *   one side or close to it, so that the course flown (take-off → B1 → B2 → B3 → take-off)
 *   is the perimeter or at most 15 % more.
 * Deterministic for a take-off and a day. Cost: a coarse field of the relief (500 m cells)
 * then a thousand candidate courses scored on it, a few milliseconds.
 */
import type { TurnPoint } from './task';

export type ChallengeKind = 'ceiling' | 'outreturn' | 'fai';
export type ChallengeLevel = 0 | 1 | 2;

/** Course length by level (km): the out-and-return's turn point distance, the triangle's perimeter. */
export const CHALLENGE_KM = { outreturn: [5, 10, 20], fai: [10, 25, 50] } as const;
export const CHALLENGE_LABEL: Record<ChallengeKind, string> = { ceiling: 'Plafond', outreturn: 'Aller-retour', fai: 'Triangle FAI' };
export const CYLINDER_M = 400;
/** FAI triangle: the shortest side at least this share of the perimeter. */
export const FAI_MIN_SHARE = 0.28;
/** Turn points: some relief within 2 km (m between the lowest and the highest ground), and clearance under the day's top (m). */
export const MIN_RELIEF = 200;
export const TOP_CLEARANCE = 250;
/**
 * Glide counted from the take-off's height to reach a turn point without climbing (a high
 * take-off on a day whose ceiling is below it still glides down to its valley's points).
 */
export const START_GLIDE = 8;
/** FAI triangle: the course take-off → B1 → B2 → B3 → take-off at most this much longer than the perimeter. */
export const FAI_DETOUR = 0.15;

/** Ground height (m) at a local point (metres east, north of the take-off), null outside the playable grid. */
export interface ChallengeTerrain {
  heightAt(x: number, y: number): number | null;
}

/** The day: synoptic wind, and the highest usable altitude over relief whose ~10 km mean is `regional`. */
export interface ChallengeDay {
  windFrom: number;
  windKmh: number;
  top(regional: number): number;
}

export interface Challenge {
  kind: ChallengeKind;
  level: ChallengeLevel;
  /** Key of the records (kind and distance). */
  key: string;
  name: string;
  /** The course: start at the take-off, the turn points, the goal back at the take-off (empty for the ceiling). */
  points: TurnPoint[];
  /** Length of the course between cylinder centres (m). */
  lengthM: number;
  /** All the rules hold (see validateChallenge); otherwise the best course found, with its issues. */
  ok: boolean;
  issues: string[];
}

export function challengeKey(kind: ChallengeKind, level: ChallengeLevel): string {
  return kind === 'ceiling' ? 'ceiling' : `${kind}-${CHALLENGE_KM[kind][level]}`;
}

export function challengeName(kind: ChallengeKind, level: ChallengeLevel): string {
  return kind === 'ceiling' ? 'Plafond du jour' : `${CHALLENGE_LABEL[kind]} ${CHALLENGE_KM[kind][level]} km`;
}

/** Structural view of the model's Grid (packages/model): enough to sample it. */
export interface GridLike {
  width: number;
  height: number;
  toGrid(lon: number, lat: number): [number, number];
}

/**
 * Heights of the model's grid around a take-off, bilinear, in local metres; null within
 * `margin` cells of the grid's edge (the playable area: the take-offs list uses the same).
 */
export function gridHeights(grid: GridLike, elev: (k: number) => number, toLngLat: (x: number, y: number) => [number, number], margin = 20): ChallengeTerrain {
  const W = grid.width;
  const H = grid.height;
  return {
    heightAt(x: number, y: number): number | null {
      const [lon, lat] = toLngLat(x, y);
      const [gx, gy] = grid.toGrid(lon, lat);
      if (gx < margin || gy < margin || gx > W - margin || gy > H - margin) return null;
      const fx = gx - 0.5;
      const fy = gy - 0.5;
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const tx = fx - i;
      const ty = fy - j;
      const k = j * W + i;
      return (elev(k) * (1 - tx) + elev(k + 1) * tx) * (1 - ty) + (elev(k + W) * (1 - tx) + elev(k + W + 1) * tx) * ty;
    },
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Why a turn point cannot be used, or null: outside the grid, the sea, no relief to fly, or
 * a summit too high for the day (its ground must be TOP_CLEARANCE under the day's top, or
 * under `glideAlt`, the height a glide from the take-off arrives with).
 */
export function turnPointIssue(terrain: ChallengeTerrain, day: ChallengeDay, x: number, y: number, glideAlt = -Infinity): string | null {
  const c = terrain.heightAt(x, y);
  if (c === null) return 'hors de la grille jouable';
  let lo = c;
  let hi = c;
  let cylMin = c;
  for (const r of [CYLINDER_M, 1000, 2000]) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const h = terrain.heightAt(x + Math.sin(a) * r, y + Math.cos(a) * r);
      if (h === null) return 'au bord de la grille jouable';
      if (r === CYLINDER_M) cylMin = Math.min(cylMin, h);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  if (c < 5 || cylMin < 2) return 'en mer';
  if (hi - lo < MIN_RELIEF) return `sans relief exploitable (${Math.round(hi - lo)} m de dénivelé dans 2 km)`;
  const top = Math.max(day.top(regionalAt(terrain, x, y)), glideAlt);
  if (c > top - TOP_CLEARANCE) return `sommet inaccessible (${Math.round(c)} m, plafond ${Math.round(top)} m)`;
  return null;
}

/** Relief averaged over ~10 km (±4 km), what the ceiling and the cloud base follow. */
function regionalAt(terrain: ChallengeTerrain, x: number, y: number): number {
  let s = 0;
  let n = 0;
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) {
      const h = terrain.heightAt(x + i * 2000, y + j * 2000);
      if (h !== null) {
        s += h;
        n++;
      }
    }
  return n ? s / n : 0;
}

/** Everything that breaks the rules of a generated challenge (empty when it is valid). */
export function validateChallenge(ch: Challenge, terrain: ChallengeTerrain, day: ChallengeDay): string[] {
  const out: string[] = [];
  if (ch.kind === 'ceiling') return out;
  const pts = ch.points;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (Math.hypot(first.x, first.y) > 1 || Math.hypot(last.x, last.y) > 1) out.push('départ ou but hors du déco');
  const turn = pts.slice(1, -1);
  const startAlt = terrain.heightAt(0, 0) ?? 0;
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (i === pts.length - 1) break;
    const why = turnPointIssue(terrain, day, pts[i].x, pts[i].y, startAlt - len / START_GLIDE);
    if (why) out.push(`${pts[i].name} ${why}`);
  }
  if (ch.kind === 'outreturn') {
    const d = CHALLENGE_KM.outreturn[ch.level] * 1000;
    if (turn.length !== 1) out.push('aller-retour sans balise unique');
    else if (Math.abs(Math.hypot(turn[0].x, turn[0].y) - d) > 0.01 * d) out.push(`balise à ${(Math.hypot(turn[0].x, turn[0].y) / 1000).toFixed(2)} km au lieu de ${d / 1000}`);
    if (Math.abs(len - 2 * d) > 0.01 * 2 * d) out.push(`parcours de ${(len / 1000).toFixed(2)} km au lieu de ${(2 * d) / 1000}`);
  } else {
    const P = CHALLENGE_KM.fai[ch.level] * 1000;
    if (turn.length !== 3) out.push('triangle sans trois balises');
    else {
      const [a, b, c] = turn;
      const s1 = Math.hypot(b.x - a.x, b.y - a.y);
      const s2 = Math.hypot(c.x - b.x, c.y - b.y);
      const s3 = Math.hypot(a.x - c.x, a.y - c.y);
      const per = s1 + s2 + s3;
      if (Math.abs(per - P) > 0.01 * P) out.push(`périmètre de ${(per / 1000).toFixed(2)} km au lieu de ${P / 1000}`);
      if (Math.min(s1, s2, s3) / per < FAI_MIN_SHARE - 1e-6) out.push(`plus petite branche à ${((100 * Math.min(s1, s2, s3)) / per).toFixed(1)} % (règle FAI : 28 %)`);
      if (len < per - 1 || len > per * (1 + FAI_DETOUR)) out.push(`parcours déco-balises-déco de ${(len / 1000).toFixed(2)} km pour un triangle de ${(per / 1000).toFixed(2)}`);
    }
  }
  if (Math.abs(len - ch.lengthM) > 1) out.push('longueur annoncée fausse');
  return out;
}

// --- Generator.

/** Coarse field of the relief around the take-off: what makes a leg or a turn point flyable. */
const STEP = 500;
class Field {
  readonly n: number;
  readonly half: number;
  /** Ground (NaN outside the playable grid), the flyable quality 0..1, ground above the day's top. */
  readonly h: Float32Array;
  readonly q: Float32Array;
  readonly blocked: Uint8Array;
  readonly flat: Uint8Array;
  /** The turn point rules, approximated on the field (relief, clearance under the top, not the sea). */
  readonly tpOk: Uint8Array;

  constructor(terrain: ChallengeTerrain, day: ChallengeDay, radius: number, startAlt: number) {
    const half = Math.ceil(radius / STEP);
    const n = 2 * half + 1;
    this.n = n;
    this.half = half;
    const N = n * n;
    const h = new Float32Array(N);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const v = terrain.heightAt((i - half) * STEP, (j - half) * STEP);
        h[j * n + i] = v === null ? NaN : v;
      }
    this.h = h;
    // Relief: highest minus lowest ground within ±2 km (separable max/min).
    const R = 4;
    const rowMax = new Float32Array(N);
    const rowMin = new Float32Array(N);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        let mx = -Infinity;
        let mn = Infinity;
        for (let d = -R; d <= R; d++) {
          const ii = i + d;
          if (ii < 0 || ii >= n) continue;
          const v = h[j * n + ii];
          if (v !== v) continue;
          if (v > mx) mx = v;
          if (v < mn) mn = v;
        }
        rowMax[j * n + i] = mx;
        rowMin[j * n + i] = mn;
      }
    // Summed areas of the valid ground and its count, for the ±1 km and ±4 km means.
    const S = new Float64Array((n + 1) * (n + 1));
    const C = new Float64Array((n + 1) * (n + 1));
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const v = h[j * n + i];
        const ok = v === v;
        const o = (j + 1) * (n + 1) + i + 1;
        S[o] = (ok ? v : 0) + S[o - 1] + S[o - n - 1] - S[o - n - 2];
        C[o] = (ok ? 1 : 0) + C[o - 1] + C[o - n - 1] - C[o - n - 2];
      }
    const box = (A: Float64Array, i: number, j: number, r: number) => {
      const i0 = Math.max(0, i - r);
      const j0 = Math.max(0, j - r);
      const i1 = Math.min(n, i + r + 1);
      const j1 = Math.min(n, j + r + 1);
      return A[j1 * (n + 1) + i1] - A[j0 * (n + 1) + i1] - A[j1 * (n + 1) + i0] + A[j0 * (n + 1) + i0];
    };
    this.q = new Float32Array(N);
    this.blocked = new Uint8Array(N);
    this.flat = new Uint8Array(N);
    this.tpOk = new Uint8Array(N);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const v = h[k];
        if (v !== v) continue;
        let mx = -Infinity;
        let mn = Infinity;
        for (let d = -R; d <= R; d++) {
          const jj = j + d;
          if (jj < 0 || jj >= n) continue;
          mx = Math.max(mx, rowMax[jj * n + i]);
          mn = Math.min(mn, rowMin[jj * n + i]);
        }
        const relief = mx - mn;
        const regional = box(S, i, j, 8) / Math.max(1, box(C, i, j, 8));
        const near = box(S, i, j, 2) / Math.max(1, box(C, i, j, 2));
        const top = Math.max(day.top(regional), startAlt - (Math.hypot(i - half, j - half) * STEP) / START_GLIDE);
        const exploit = v < 5 ? 0 : clamp((relief - 150) / 450, 0, 1);
        // On the slopes and ridges rather than the valley floors.
        const ridge = clamp((v - near) / 150 + 0.5, 0, 1);
        this.blocked[k] = v > top - 50 ? 1 : 0;
        this.flat[k] = relief < 150 || v < 5 ? 1 : 0;
        this.q[k] = v > top - TOP_CLEARANCE ? 0 : exploit * (0.75 + 0.25 * ridge);
        // (A margin over the exact rules: the field is coarser than the grid.)
        this.tpOk[k] = v >= 5 && relief >= MIN_RELIEF + 40 && v < top - TOP_CLEARANCE - 60 ? 1 : 0;
      }
  }

  /** Cell of a local point, -1 outside the field or the grid. */
  cell(x: number, y: number): number {
    const i = Math.round(x / STEP) + this.half;
    const j = Math.round(y / STEP) + this.half;
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    const k = j * this.n + i;
    return this.h[k] === this.h[k] ? k : -1;
  }
}

/** Mean quality along a leg, shares blocked by high ground and over flat land; null if it leaves the grid. */
const legOut = { q: 0, blocked: 0, flat: 0 };
function scoreLeg(f: Field, ax: number, ay: number, bx: number, by: number): typeof legOut | null {
  const len = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(len / STEP));
  let q = 0;
  let bl = 0;
  let fl = 0;
  for (let s = 0; s <= n; s++) {
    const k = f.cell(ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n);
    if (k < 0) return null;
    q += f.q[k];
    bl += f.blocked[k];
    fl += f.flat[k];
  }
  legOut.q = q / (n + 1);
  legOut.blocked = bl / (n + 1);
  legOut.flat = fl / (n + 1);
  return legOut;
}

interface Candidate {
  pts: [number, number][];
  score: number;
}

/** Bonus for a first leg into the wind (the way back downwind), growing with the wind. */
function windBonus(day: ChallengeDay, bx: number, by: number): number {
  const wf = clamp((day.windKmh - 5) / 20, 0, 1);
  const brg = Math.atan2(bx, by);
  return 0.12 * wf * Math.cos(brg - (day.windFrom * Math.PI) / 180);
}

/** Scores a course (take-off, turn points…, take-off); -Infinity when a leg leaves the grid. */
function scoreCourse(f: Field, day: ChallengeDay, pts: [number, number][]): number {
  let q = 0;
  let bl = 0;
  let fl = 0;
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const l = Math.hypot(bx - ax, by - ay);
    const s = scoreLeg(f, ax, ay, bx, by);
    if (!s) return -Infinity;
    q += s.q * l;
    bl += s.blocked * l;
    fl += s.flat * l;
    len += l;
  }
  let tp = 0;
  let bad = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const k = f.cell(pts[i][0], pts[i][1]);
    if (k < 0) return -Infinity;
    tp += f.q[k];
    bad += 1 - f.tpOk[k];
  }
  tp /= Math.max(1, pts.length - 2);
  return (0.55 * q) / len + 0.45 * tp - (1.5 * bl) / len - (0.5 * fl) / len - bad + windBonus(day, pts[1][0], pts[1][1]);
}

/** Offsets of the triangle from the take-off (share of the perimeter, + towards its third corner). */
const FAI_OFFSETS = [0, 0.06, -0.06, 0.12, -0.12];
const FAI_OFFSETS_FINE = [0, 0.03, -0.03, 0.06, -0.06, 0.09, -0.09, 0.12, -0.12];

/** FAI shapes: shares of the perimeter of the sides B1B2, B2B3 and B3B1 (the take-off on the last). */
const FAI_SHAPES: [number, number, number][] = [
  [1 / 3, 1 / 3, 1 / 3],
  [0.36, 0.36, 0.28],
  [0.28, 0.36, 0.36],
  [0.36, 0.28, 0.36],
  [0.3, 0.4, 0.3],
  [0.4, 0.3, 0.3],
  [0.3, 0.3, 0.4],
];

/**
 * Candidate courses: the out-and-return every 5°; the triangle by shape, place of the take-off
 * along a side, orientation, handedness and offset; `fine`, a denser search (used only when the
 * first finds nothing valid: a high take-off on a weak day).
 */
function candidates(kind: 'outreturn' | 'fai', level: ChallengeLevel, fine = false): [number, number][][] {
  const out: [number, number][][] = [];
  if (kind === 'outreturn') {
    const d = CHALLENGE_KM.outreturn[level] * 1000;
    for (let a = 0; a < 360; a += fine ? 1 : 5) {
      const r = (a * Math.PI) / 180;
      out.push([
        [0, 0],
        [Math.sin(r) * d, Math.cos(r) * d],
        [0, 0],
      ]);
    }
    return out;
  }
  const P = CHALLENGE_KM.fai[level] * 1000;
  for (const [s1, s2, s3] of FAI_SHAPES) {
    const L1 = s1 * P;
    const L2 = s2 * P;
    const L3 = s3 * P;
    const A = Math.acos(clamp((L1 * L1 + L3 * L3 - L2 * L2) / (2 * L1 * L3), -1, 1));
    for (const t of fine ? [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] : [0.2, 0.5, 0.8])
      for (let a = 0; a < 360; a += fine ? 5 : 10)
        for (const hand of [1, -1]) {
          const th = (a * Math.PI) / 180;
          const ux = Math.sin(th);
          const uy = Math.cos(th);
          const b1x = ux * t * L3;
          const b1y = uy * t * L3;
          const b3x = -ux * (1 - t) * L3;
          const b3y = -uy * (1 - t) * L3;
          // From B1, towards B3 turned by the angle at B1.
          const ang = hand * A;
          const dx = -ux * Math.cos(ang) + uy * Math.sin(ang);
          const dy = -ux * Math.sin(ang) - uy * Math.cos(ang);
          const b2x = b1x + dx * L1;
          const b2y = b1y + dy * L1;
          // The take-off on the side B3B1, or a little off it (inside the triangle or out):
          // the course is then a little longer than the perimeter (FAI_DETOUR at most).
          let nx = -uy;
          let ny = ux;
          if ((b2x - b1x) * nx + (b2y - b1y) * ny < 0) {
            nx = -nx;
            ny = -ny;
          }
          for (const off of fine ? FAI_OFFSETS_FINE : FAI_OFFSETS) {
            const ox = nx * off * P;
            const oy = ny * off * P;
            out.push([
              [0, 0],
              [b1x + ox, b1y + oy],
              [b2x + ox, b2y + oy],
              [b3x + ox, b3y + oy],
              [0, 0],
            ]);
          }
        }
  }
  return out;
}

function build(kind: ChallengeKind, level: ChallengeLevel, pts: [number, number][]): Challenge {
  const n = pts.length;
  const points: TurnPoint[] = pts.map(([x, y], i) => ({ name: i === 0 ? 'Départ (déco)' : i === n - 1 ? 'But (déco)' : `B${i}`, x, y, r: CYLINDER_M }));
  let len = 0;
  for (let i = 1; i < n; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { kind, level, key: challengeKey(kind, level), name: challengeName(kind, level), points, lengthM: len, ok: true, issues: [] };
}

/**
 * The challenge of a kind and level from the take-off (local origin): the best-scored course
 * that keeps every rule; if none does, the best one with its issues (ok false).
 */
export function makeChallenge(kind: ChallengeKind, level: ChallengeLevel, terrain: ChallengeTerrain, day: ChallengeDay): Challenge {
  if (kind === 'ceiling') {
    // A day whose top barely clears the take-off leaves nothing to climb to: said at the start
    // (the goal is then just under that top, engine.ts).
    const ch = build('ceiling', level, []);
    const h0 = terrain.heightAt(0, 0) ?? 0;
    const top = day.top(regionalAt(terrain, 0, 0));
    return top - 100 < h0 + 200 ? { ...ch, ok: false, issues: [`le plafond du jour (~${Math.round(top / 50) * 50} m) n’est qu’à ${Math.max(0, Math.round(top - h0))} m au-dessus du déco`] } : ch;
  }
  const reach = kind === 'outreturn' ? CHALLENGE_KM.outreturn[level] * 1000 : (CHALLENGE_KM.fai[level] * 1000) / 2;
  const field = new Field(terrain, day, reach + 2500, terrain.heightAt(0, 0) ?? 0);
  let fallback: Challenge | null = null;
  let any = false;
  for (const fine of [false, true]) {
    const list: Candidate[] = [];
    for (const pts of candidates(kind, level, fine)) {
      const score = scoreCourse(field, day, pts);
      if (score > -Infinity) list.push({ pts, score });
    }
    any ||= list.length > 0;
    list.sort((a, b) => b.score - a.score);
    for (const c of list.slice(0, fine ? 600 : 250)) {
      const ch = build(kind, level, c.pts);
      const issues = validateChallenge(ch, terrain, day);
      if (!issues.length) return ch;
      if (!fallback || issues.length < fallback.issues.length) fallback = { ...ch, ok: false, issues };
    }
  }
  if (fallback) return fallback;
  // Nothing inside the grid at all (a take-off on its very edge): the first course, flagged.
  const ch = build(kind, level, candidates(kind, level)[0]);
  return { ...ch, ok: false, issues: validateChallenge(ch, terrain, day).concat(any ? [] : ['aucun parcours dans la grille jouable']) };
}
