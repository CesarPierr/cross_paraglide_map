import { describe, expect, it } from 'vitest';
import { CHALLENGE_KM, FAI_MIN_SHARE, makeChallenge, MIN_RELIEF, turnPointIssue, validateChallenge, type ChallengeDay, type ChallengeLevel, type ChallengeTerrain } from '../src/game/challenges';

/** Hills everywhere (±600 m every few km), a plain west of x = -6 km, the grid's edge at |x|, |y| = 40 km. */
const hills: ChallengeTerrain = {
  heightAt(x, y) {
    if (Math.abs(x) > 40000 || Math.abs(y) > 40000) return null;
    if (x < -6000) return 250;
    return 1300 + 600 * Math.sin(x / 1700) * Math.cos(y / 2300);
  },
};
const day: ChallengeDay = { windFrom: 0, windKmh: 0, top: () => 2600 };

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('challenge generator', () => {
  it('places the out-and-return turn point at the exact distance, back to the take-off', () => {
    for (const level of [0, 1, 2] as ChallengeLevel[]) {
      const ch = makeChallenge('outreturn', level, hills, day);
      expect(ch.ok).toBe(true);
      expect(ch.points).toHaveLength(3);
      const d = CHALLENGE_KM.outreturn[level] * 1000;
      expect(dist(ch.points[1], { x: 0, y: 0 })).toBeCloseTo(d, -1);
      expect(ch.lengthM).toBeCloseTo(2 * d, -1);
      expect(ch.points[0]).toMatchObject({ x: 0, y: 0 });
      expect(ch.points[2]).toMatchObject({ x: 0, y: 0 });
      // Never over the plain.
      expect(ch.points[1].x).toBeGreaterThan(-6000);
      expect(validateChallenge(ch, hills, day)).toEqual([]);
    }
  });

  it('builds FAI triangles of the right perimeter, shortest side ≥ 28 %', () => {
    for (const level of [0, 1, 2] as ChallengeLevel[]) {
      const ch = makeChallenge('fai', level, hills, day);
      expect(ch.ok).toBe(true);
      const [, a, b, c] = ch.points;
      const sides = [dist(a, b), dist(b, c), dist(c, a)];
      const per = sides[0] + sides[1] + sides[2];
      expect(per).toBeCloseTo(CHALLENGE_KM.fai[level] * 1000, -2);
      expect(Math.min(...sides) / per).toBeGreaterThanOrEqual(FAI_MIN_SHARE - 1e-9);
      // The course closes at the take-off, at most 15 % longer than the triangle.
      expect(ch.lengthM).toBeGreaterThanOrEqual(per - 1);
      expect(ch.lengthM).toBeLessThanOrEqual(per * 1.15);
      for (const p of [a, b, c]) expect(p.x).toBeGreaterThan(-6000);
    }
  });

  it('keeps the turn points inside the playable grid', () => {
    // The take-off 3 km from the eastern edge.
    const edge: ChallengeTerrain = { heightAt: (x, y) => (x > 3000 || Math.abs(x) > 40000 || Math.abs(y) > 40000 ? null : 1300 + 600 * Math.sin(x / 1700) * Math.cos(y / 2300)) };
    for (const kind of ['outreturn', 'fai'] as const) {
      const ch = makeChallenge(kind, 2, edge, day);
      expect(ch.ok).toBe(true);
      for (const p of ch.points) expect(edge.heightAt(p.x, p.y)).not.toBeNull();
    }
  });

  it('avoids summits above the day’s ceiling', () => {
    // High mountains north of y = 3 km (3 500 m), under a 2 600 m top.
    const alps: ChallengeTerrain = { heightAt: (x, y) => (y > 3000 ? 3500 + 300 * Math.sin(x / 900) : hills.heightAt(x, y)) };
    const ch = makeChallenge('outreturn', 1, alps, day);
    expect(ch.ok).toBe(true);
    expect(ch.points[1].y).toBeLessThan(3000);
    expect(turnPointIssue(alps, day, 0, 8000)).toMatch(/sommet inaccessible/);
  });

  it('flags a turn point over a plain or the sea', () => {
    expect(turnPointIssue(hills, day, -20000, 0)).toMatch(/sans relief/);
    const sea: ChallengeTerrain = { heightAt: (x, y) => (x > 5000 ? 0 : hills.heightAt(x, y)) };
    expect(turnPointIssue(sea, day, 15000, 0)).toMatch(/mer|relief/);
    expect(MIN_RELIEF).toBeGreaterThan(0);
  });

  it('sends the first leg into the wind', () => {
    // Relief the same in every direction: the wind decides.
    const even: ChallengeTerrain = { heightAt: (x, y) => 1300 + 500 * Math.sin(Math.hypot(x, y) / 1200) };
    for (const from of [90, 270]) {
      const ch = makeChallenge('outreturn', 1, even, { ...day, windFrom: from, windKmh: 25 });
      const brg = (Math.atan2(ch.points[1].x, ch.points[1].y) * 180) / Math.PI;
      expect(Math.abs((((brg - from + 540) % 360) + 360) % 360 - 180)).toBeLessThan(40);
    }
  });

  it('is deterministic and quick', () => {
    const t0 = performance.now();
    const a = makeChallenge('fai', 2, hills, day);
    const ms = performance.now() - t0;
    const b = makeChallenge('fai', 2, hills, day);
    expect(b.points).toEqual(a.points);
    expect(ms).toBeLessThan(200);
  });

  it('reports what breaks the rules', () => {
    const ch = makeChallenge('outreturn', 0, hills, day);
    const broken = { ...ch, points: ch.points.map((p, i) => (i === 1 ? { ...p, x: p.x * 1.2, y: p.y * 1.2 } : p)) };
    expect(validateChallenge(broken, hills, day).join(' ')).toMatch(/au lieu de 5/);
    const ceiling = makeChallenge('ceiling', 0, hills, day);
    expect(ceiling.points).toEqual([]);
    expect(ceiling.name).toBe('Plafond du jour');
  });
});
