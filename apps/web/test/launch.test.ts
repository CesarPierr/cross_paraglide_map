import { describe, expect, it } from 'vitest';
import { launchStep, newLaunch, type LaunchInput, type LaunchState } from '../src/game/launch';

const dt = 1 / 120;
function run(s: LaunchState, input: (s: LaunchState, t: number) => LaunchInput, head: number, cross: number, slope: number, seconds: number) {
  for (let t = 0; t < seconds && s.phase !== 'airborne' && s.phase !== 'failed'; t += dt) launchStep(s, input(s, t), head, cross, slope, dt);
  return s;
}
/** A good forward launch: run, a dab of brake as the wing arrives overhead, then run on. */
const goodForward = (s: LaunchState): LaunchInput => {
  const dab = s.theta > 1.15 && s.thetaRate > 0.2 ? 0.45 : 0.05;
  return { go: true, brakeL: dab, brakeR: dab, turn: false };
};

describe('take-off', () => {
  it('a forward launch with a dab of brake lifts off on a slope in light wind', () => {
    const s = run(newLaunch('forward'), goodForward, 2, 0, 0.3, 20);
    expect(s.phase).toBe('airborne');
  });

  it('without braking, the wing overshoots', () => {
    const s = run(newLaunch('forward'), () => ({ go: true, brakeL: 0, brakeR: 0, turn: false }), 4, 0, 0.3, 20);
    expect(s.phase).toBe('failed');
    expect(s.failReason).toMatch(/dépassé/);
  });

  it('a cross wind lays the wing off unless countered with the opposite brake', () => {
    const lazy = run(newLaunch('forward'), goodForward, 3, 3, 0.3, 20);
    expect(lazy.phase).toBe('failed');
    const counter = (s: LaunchState): LaunchInput => {
      const g = goodForward(s);
      // Wing falling left (phi < 0): brake the high side, the right one.
      const k = Math.max(-0.5, Math.min(0.5, s.phi * 2.5 + s.phiRate));
      return { ...g, brakeL: g.brakeL + Math.max(0, k), brakeR: g.brakeR + Math.max(0, -k) };
    };
    expect(run(newLaunch('forward'), counter, 3, 3, 0.3, 20).phase).toBe('airborne');
  });

  it('a reverse launch in a stronger wind: inflate facing the wing, turn around, take off', () => {
    const s = run(
      newLaunch('reverse'),
      (st) => {
        const dab = st.theta > 1.15 && st.thetaRate > 0.2 ? 0.5 : 0.05;
        return { go: true, brakeL: dab, brakeR: dab, turn: st.theta > 1.3 };
      },
      5.5,
      0,
      0.25,
      20,
    );
    expect(s.facingWing).toBe(false);
    expect(s.phase).toBe('airborne');
  });
});
