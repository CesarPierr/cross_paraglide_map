import { describe, expect, it } from 'vitest';
import { newGlider, type GliderState } from '../src/game/flight';
import { buildGlider, FlapCloth } from '../src/game/glider';
import { LINE_PIECES, LineSet } from '../src/game/glider-lines';
import { ARC, SHEET_NC, SHEET_NU, arcSolve, intactSkins, newDeform, wingPoint, type WingDeform } from '../src/game/glider-shape';
import { nearRows } from '../src/game/glider-wing';

const still = (over: Partial<GliderState> = {}): GliderState => Object.assign(newGlider(0, 0, 1500, 0), over);
type Model = ReturnType<typeof buildGlider>;

/**
 * Points of the folded part as drawn (wingPoint, the JS twin of the shader: both skins, the
 * pleats) that lie inside the open wing (between its skins at their section, less `tol`).
 */
function intrusions(d: WingDeform, side: number, tol: number): number {
  let bad = 0;
  const p = { x: 0, y: 0, z: 0 };
  const f = side < 0 ? d.foldL : d.foldR;
  let a0 = 0;
  for (let i = 0; i <= 120; i++) {
    const a = side * (-0.6 + (1.6 * i) / 120);
    for (let j = 1; j < 40; j++) {
      const c = j / 40;
      const m = side * a;
      if (m <= f[0] + (f[1] - f[0]) * c) continue;
      for (const sk of [-1, 1]) {
        wingPoint(d, a, sk * Math.sqrt(c), 0.5, 0, 0, 0.2, p);
        const as = arcSolve(p.x, p.y, a0, 4);
        a0 = as;
        const cs = (p.z - ARC.zq) / ARC.ch + 0.25;
        if (cs < 0.03 || cs > 0.97) continue;
        // Only where the wing is open (not on the folded part itself).
        if (side * as > f[0] + (f[1] - f[0]) * cs - 0.08) continue;
        const h = (p.x - ARC.ax) * ARC.nx + (p.y - ARC.ay) * ARC.ny;
        const s = intactSkins(d, as, cs);
        if (h > s.lo + tol && h < s.up - tol) bad++;
      }
    }
  }
  return bad;
}

/** The model's deform state, through the glider's update (a hook: the cloth writes into it). */
function deformOf(g: Model, st: GliderState): WingDeform {
  const cloth = g.cloth!;
  let captured: WingDeform | null = null;
  const up = cloth.update.bind(cloth);
  cloth.update = (s, d, dt, l, t) => {
    captured = d;
    up(s, d, dt, l, t);
  };
  g.update(st, 1 / 60);
  cloth.update = up;
  return captured!;
}

describe('the folded part as cloth', () => {
  it('folds a collapse in as cloth, finite, pinned on the crease, and gives it back when it reopens', () => {
    const g = buildGlider(undefined, { lod: 'high' });
    const st = still({
      collapse: {
        side: -1,
        amount: 0.5,
        peak: 0.5,
        frontal: 0,
        cravat: 0,
        cravatSide: 0,
      },
    });
    for (let i = 0; i < 90; i++) g.update(st, 1 / 60);
    const cl = g.cloth!;
    expect(cl.on).toEqual([true, false]);
    expect(Array.from(cl.x[0]).every(Number.isFinite)).toBe(true);
    // The flap hangs under the wing: its outer nodes well below the crease.
    const x = cl.x[0];
    const crease = x[2 * SHEET_NU * 3 + 1];
    const tip = x[(2 * SHEET_NU + SHEET_NU - 1) * 3 + 1];
    expect(tip).toBeLessThan(crease - 0.4);
    // Reopening: the cloth hands the side back to the open wing.
    for (let i = 0; i < 300; i++) {
      st.collapse.amount = Math.max(0, 0.5 - 0.25 * (i / 60));
      g.update(st, 1 / 60);
    }
    expect(cl.on[0]).toBe(false);
  });

  it('keeps the folded fabric out of the open wing (contact), however big the fold', () => {
    for (const amount of [0.3, 0.5, 0.7]) {
      const g = buildGlider(undefined, { lod: 'high' });
      const st = still({
        collapse: {
          side: 1,
          amount,
          peak: amount,
          frontal: 0,
          cravat: 0,
          cravatSide: 0,
        },
      });
      let worst = 0;
      let d: WingDeform | null = null;
      for (let i = 0; i < 150; i++) {
        if (i % 25 === 24) {
          d = deformOf(g, st);
          // (2 cm: the reference skins leave out the cells' ballooning, ~1–2 cm.)
          worst = Math.max(worst, intrusions(d, 1, 0.02));
        } else g.update(st, 1 / 60);
      }
      expect(d!.cloth[1]).toBe(1);
      expect(worst).toBe(0);
    }
  });

  it('wraps a cravat round the lines: the tip in a bundle under the wing, the lines dragged, cleared with the state', () => {
    const g = buildGlider(undefined, { lod: 'high' });
    const st = still({
      collapse: { side: 0, amount: 0, frontal: 0, cravat: 0.26, cravatSide: 1 },
    });
    for (let i = 0; i < 120; i++) g.update(st, 1 / 60);
    const cl = g.cloth!;
    expect(cl.on[1]).toBe(true);
    expect(cl.bundleK).toBeGreaterThan(0.9);
    const b = cl.bundle;
    // A fifth of the way down the outer lines: ~1.5–2.5 m under the tip's wing.
    expect(b[1]).toBeLessThan(5.8);
    expect(b[1]).toBeGreaterThan(3.5);
    expect(b[0]).toBeGreaterThan(2);
    // The tip's column wrapped round it (within ~25 cm).
    const x = cl.x[1];
    for (let j = 0; j < SHEET_NC; j++) {
      const n = j * SHEET_NU + SHEET_NU - 1;
      expect(Math.hypot(x[n * 3] - b[0], x[n * 3 + 1] - b[1], x[n * 3 + 2] - b[2])).toBeLessThan(0.25);
    }
    // Cleared: the bundle lets go and the fold reopens.
    st.collapse.cravat = 0;
    st.collapse.cravatSide = 0;
    for (let i = 0; i < 240; i++) g.update(st, 1 / 60);
    expect(cl.bundleK).toBe(0);
    expect(cl.on[1]).toBe(false);
  });

  it('drags the caught side’s lines into the bundle', () => {
    const ls = new LineSet('high');
    const d = newDeform();
    ls.update(d);
    const free = ls.samples(4);
    ls.setCatch(1, 4.2, 4.8, 0.3, 1);
    ls.update(d);
    const caught = ls.samples(4);
    let movedRight = 0;
    let movedLeft = 0;
    for (let i = 0; i < free.length; i += 3) {
      const m = Math.hypot(caught[i] - free[i], caught[i + 1] - free[i + 1], caught[i + 2] - free[i + 2]);
      if (m > 0.05 && free[i] > 0) movedRight++;
      else if (m > 0.05) movedLeft++;
    }
    expect(movedRight).toBeGreaterThan(10);
    expect(movedLeft).toBe(0);
  });

  it('costs about as much as the rest of the glider\u2019s update per folded side, nothing when nothing is folded', () => {
    // Interleaved blocks, the fastest of each kind (a test machine is busy: a ratio, not a time).
    const st = still();
    const idle = new FlapCloth();
    const dIdle = newDeform();
    const folded = new FlapCloth();
    const d = newDeform();
    d.foldL[0] = 0.2;
    d.foldL[1] = 0.45;
    d.foldL[2] = 2.45;
    d.foldL[3] = 0.12;
    const g = buildGlider(undefined, { lod: 'high' });
    const best = [Infinity, Infinity, Infinity];
    const runs: (() => void)[] = [() => idle.update(st, dIdle, 1 / 60, null, 0), () => folded.update(st, d, 1 / 60, null, 0), () => g.update(st, 1 / 60)];
    for (let rep = 0; rep < 30; rep++)
      runs.forEach((run, k) => {
        const t0 = performance.now();
        for (let i = 0; i < 50; i++) run();
        best[k] = Math.min(best[k], (performance.now() - t0) / 50);
      });
    const [tIdle, tFolded, base] = best;
    expect(tIdle).toBeLessThan(0.1 * base);
    expect(tFolded).toBeLessThan(2.5 * base);
    expect(d.cloth[0]).toBe(1);
    expect(Array.from(d.sheet).every(Number.isFinite)).toBe(true);
  });
});

describe('lines as curves', () => {
  /** Turning angle (rad) between consecutive pieces of line i at LINE_PIECES. */
  function maxTurn(ls: LineSet, i: number): number {
    const n = LINE_PIECES;
    const pts = ls.samples(n);
    const o = i * (n + 1) * 3;
    let worst = 0;
    for (let j = 1; j < n; j++) {
      const ax = pts[o + j * 3] - pts[o + (j - 1) * 3];
      const ay = pts[o + j * 3 + 1] - pts[o + (j - 1) * 3 + 1];
      const az = pts[o + j * 3 + 2] - pts[o + (j - 1) * 3 + 2];
      const bx = pts[o + (j + 1) * 3] - pts[o + j * 3];
      const by = pts[o + (j + 1) * 3 + 1] - pts[o + j * 3 + 1];
      const bz = pts[o + (j + 1) * 3 + 2] - pts[o + j * 3 + 2];
      const c = (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz) || 1);
      worst = Math.max(worst, Math.acos(Math.min(1, Math.max(-1, c))));
    }
    return worst;
  }
  const segsOf = (ls: LineSet) =>
    (
      ls as unknown as {
        segs: { slackK: number; n: number; side: number }[];
        next: Int32Array;
        m0: Float32Array;
        m1: Float32Array;
      }
    ).segs;

  it('draws a slack line as a smooth curve (a few degrees per piece) and a taut one straight', () => {
    const ls = new LineSet('high');
    const d = newDeform();
    d.brake[0] = d.brake[1] = 0.5;
    d.foldL[0] = 0.2;
    d.foldL[1] = 0.45;
    d.foldL[2] = 2.45;
    d.foldL[3] = 0.12;
    ls.update(d);
    const segs = segsOf(ls);
    let slack = 0;
    for (let i = 0; i < segs.length; i++) {
      const t = maxTurn(ls, i);
      expect(t).toBeLessThan((7 * Math.PI) / 180);
      if (segs[i].slackK > 0.5) slack++;
      // The open side's lines are straight (braked: the brake lines too).
      if (segs[i].side > 0 && segs[i].slackK === 0) expect(t).toBeLessThan(1e-3);
    }
    expect(slack).toBeGreaterThan(10);
  });

  it('hangs a slack cascade smoothly through its knots, and keeps the angle of a taut one', () => {
    const ls = new LineSet('high');
    const d = newDeform();
    d.foldL[0] = 0.2;
    d.foldL[1] = 0.45;
    d.foldL[2] = 2.45;
    d.foldL[3] = 0.12;
    ls.update(d);
    const L = ls as unknown as {
      segs: { slackK: number }[];
      next: Int32Array;
      m0: Float32Array;
      m1: Float32Array;
    };
    const ang = (i: number, k: number) => {
      const a = [L.m1[i * 3], L.m1[i * 3 + 1], L.m1[i * 3 + 2]];
      const b = [L.m0[k * 3], L.m0[k * 3 + 1], L.m0[k * 3 + 2]];
      const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]));
      return Math.acos(Math.min(1, Math.max(-1, c)));
    };
    let slackKnots = 0;
    for (let i = 0; i < L.segs.length; i++) {
      const k = L.next[i];
      if (k < 0) continue;
      if (Math.min(L.segs[i].slackK, L.segs[k].slackK) >= 0.99) {
        slackKnots++;
        expect(ang(i, k)).toBeLessThan((25 * Math.PI) / 180);
      }
    }
    expect(slackKnots).toBeGreaterThan(3);
    // Taut, at rest: the knots keep the angle of the straight lines meeting there.
    const taut = new LineSet('high');
    const t = newDeform();
    t.brake[0] = t.brake[1] = 0.5;
    taut.update(t);
    const T = taut as unknown as typeof L;
    let kinks = 0;
    for (let i = 0; i < T.segs.length; i++) {
      const k = T.next[i];
      if (k >= 0 && T.segs[i].slackK === 0) {
        const a = [T.m1[i * 3], T.m1[i * 3 + 1], T.m1[i * 3 + 2]];
        const b = [T.m0[k * 3], T.m0[k * 3 + 1], T.m0[k * 3 + 2]];
        const c = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]));
        if (Math.acos(Math.min(1, c)) > 0.02) kinks++;
      }
    }
    expect(kinks).toBeGreaterThan(20);
  });
});

describe('the near canopy', () => {
  it('packs its rows at the line tabs and the trailing edge, not everywhere', () => {
    const tws = nearRows();
    expect(tws[0]).toBe(-1);
    expect(tws[tws.length - 1]).toBe(1);
    for (let j = 1; j < tws.length; j++) expect(tws[j]).toBeGreaterThan(tws[j - 1]);
    // Spacing (m, root chord) on the lower skin next to each tab row, and mid-chord on the upper skin.
    const gapAt = (c: number, lower: boolean) => {
      let best = Infinity;
      for (let j = 1; j < tws.length; j++) {
        const a = tws[j - 1];
        const b = tws[j];
        if ((lower ? b > 0 : a < 0) || Math.min(a * a, b * b) > c || Math.max(a * a, b * b) < c) continue;
        best = Math.min(best, Math.abs(a * a - b * b) * 2.65);
      }
      return best;
    };
    for (const c of [0.11, 0.37, 0.66]) expect(gapAt(c, true)).toBeLessThan(0.04);
    expect(gapAt(0.98, true)).toBeLessThan(0.05);
    expect(gapAt(0.5, false)).toBeGreaterThan(0.08);
    expect(tws.length).toBeLessThan(80);
  });
});
