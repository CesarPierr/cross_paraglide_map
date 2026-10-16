import { describe, expect, it } from 'vitest';
import { clearance, lodByDistance, type LodState } from '../src/game/lod';

const state: LodState = { centerM: 1200, clearanceM: 50 };
/** MapLibre's units: the centre 1200 m away is at 0.002 mercator units here. */
const dc = 0.002;
const m = (metres: number) => (metres / 1200) * dc;

describe('tile detail by true distance', () => {
  const zoom = lodByDistance(state, 0);

  it('gives the centre its own zoom and one level less per doubling of the distance', () => {
    expect(zoom(16, m(1200), m(10), dc, 66)).toBeCloseTo(16 + Math.log2(1200 / Math.hypot(1200, 50)), 6);
    const near = zoom(16, m(5000), 0, dc, 66);
    const far = zoom(16, m(10000), 0, dc, 66);
    expect(near - far).toBeCloseTo(1, 2);
  });

  it('does not depend on the angle of view (a level view asks for no more tiles)', () => {
    // The camera's height above MapLibre's centre vanishes when the view is level: it is ignored.
    for (const d of [0, 300, 3000, 30000, 300000]) expect(zoom(16, m(d), 0, dc, 66)).toBeCloseTo(zoom(16, m(d), m(500), dc, 66), 9);
  });

  it('is bounded near the eye by its clearance from the relief', () => {
    const max = 16 + Math.log2(1200 / 50);
    expect(zoom(16, 0, 0, dc, 66)).toBeCloseTo(max, 6);
    expect(zoom(16, m(10), 0, dc, 66)).toBeLessThanOrEqual(max);
  });

  it('stays finite for degenerate input', () => {
    for (const v of [zoom(16, 0, 0, 0, 66), zoom(16, NaN, NaN, dc, 66), zoom(16, Infinity, 0, dc, 66), zoom(NaN, 1, 1, 1, 66)]) expect(Number.isFinite(v)).toBe(true);
  });

  it('applies the bias of the source', () => {
    expect(lodByDistance(state, -1)(16, m(2000), 0, dc, 66)).toBeCloseTo(zoom(16, m(2000), 0, dc, 66) - 1, 9);
  });
});

describe('clearance from the relief', () => {
  it('is the height above flat ground', () => {
    expect(clearance(0, 0, 1300, () => 1000)).toBeCloseTo(300, 6);
  });

  it('is the distance to a slope beside the eye when it is nearer than the ground below', () => {
    // A wall rising 25 m east of the eye, the valley 300 m below.
    const g = (x: number) => (x > 20 ? 1400 : 1000);
    expect(clearance(0, 0, 1300, g)).toBeCloseTo(25, 6);
  });

  it('falls back to a default where the relief is not loaded', () => {
    expect(clearance(0, 0, 1300, () => null)).toBe(300);
  });
});
