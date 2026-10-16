import { describe, expect, it } from 'vitest';
import { landingStep, launchStep, newLanding, newLaunch, touchdown, type LaunchInput, type LaunchState } from '../src/game/launch';

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

describe('take-off in a strong wind, abort, steering', () => {
  it('reverse launch in a 29 km/h wind: without pulling, the wing rises into a low wall', () => {
    const s = newLaunch('reverse');
    for (let t = 0; t < 4; t += dt) launchStep(s, { go: false, brakeL: 0.2, brakeR: 0.2, turn: false }, 8, 0, 0.2, dt);
    expect(s.wall).toBe(true);
    expect(s.theta).toBeGreaterThan(0.2);
    expect(s.theta).toBeLessThan(0.65);
    expect(s.phase).toBe('ready');
  });

  it('in a 34 km/h wind, a wing raised without control drags or plucks the pilot', () => {
    const s = run(newLaunch('reverse'), () => ({ go: true, brakeL: 0.05, brakeR: 0.05, turn: false }), 9.5, 0, 0.2, 10);
    expect(s.phase).toBe('failed');
    expect(s.failReason).toMatch(/Arraché|Traîné/);
  });

  it('killing the wing (C risers) stalls it back to the ground: a clean abort', () => {
    const s = newLaunch('reverse');
    let k = 0;
    for (let t = 0; t < 12 && s.phase !== 'aborted' && s.phase !== 'failed'; t += dt) {
      k += dt;
      launchStep(s, { go: k < 0.5, brakeL: 0.3, brakeR: 0.3, turn: false, kill: k > 0.5 }, 7.5, 0, 0.2, dt);
    }
    expect(s.phase).toBe('aborted');
    expect(s.theta).toBeLessThan(0.4);
  });

  it('running, the brakes steer the run', () => {
    const s = newLaunch('forward');
    let running = 0;
    for (let t = 0; t < 8 && s.phase !== 'airborne' && s.phase !== 'failed' && running < 2; t += dt) {
      const g = goodForward(s);
      if (s.phase === 'running') running += dt;
      launchStep(s, { ...g, brakeR: g.brakeR + (s.phase === 'running' ? 0.25 : 0) }, 2.2, 0, 0.05, dt);
    }
    expect(s.dir).toBeGreaterThan(0.05);
  });
});

describe('landing', () => {
  it('judges the impact along the slope’s normal and keeps the speed along it for the run-out', () => {
    expect(touchdown(2.5, 0, -0.8, 0, 0, 1).kind).toBeNull();
    expect(touchdown(0, 3, -3.2, 0, 0, 1).kind).toBe('hard');
    expect(touchdown(0, 3, -5, 0, 0, 1).kind).toBe('crash');
    // 9 m/s into a slope rising ahead (30°): the slope comes up to meet the pilot.
    const up = touchdown(0, 9, -1.2, 0, -0.5, 0.866);
    expect(up.impact).toBeGreaterThan(4);
    // Same speed down a slope falling ahead: soft contact, fast run-out.
    const down = touchdown(0, 4, -2.4, 0, 0.5, 0.866);
    expect(down.impact).toBeLessThan(1.5);
    expect(down.along).toBeGreaterThan(4);
  });

  it('runs it out on the flat with the wing killed; downhill too fast, the pilot falls', () => {
    const go = (along: number, slopeDown: number, brake: number) => {
      const l = newLanding(along, 0);
      for (let t = 0; t < 10 && l.phase !== 'done'; t += dt) landingStep(l, t > 0.5 ? brake : 0, false, 0, slopeDown, dt);
      return l;
    };
    const flat = go(4, 0, 1);
    expect(flat.phase).toBe('done');
    expect(flat.kind).toBe('landed');
    expect(go(6, 0.25, 0.3).kind).toBe('hard');
    expect(go(8, 0, 0.5).kind).toBe('hard');
  });
});
