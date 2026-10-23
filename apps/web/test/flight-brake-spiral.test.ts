import { describe, expect, it } from 'vitest';
import { newGlider, step, WINGS, type AirSample, type Controls, type GliderState } from '../src/game/flight';
import { headPitch, headRoll } from '../src/game/glider-pilot';

const still: AirSample = { u: 0, v: 0, w: 0, turbulence: 0 };
const rng = () => 0.5;
const dt = 1 / 120;
const kmh = (s: GliderState) => Math.hypot(s.vx, s.vy) * 3.6;
const deg = (r: number) => (r * 180) / Math.PI;

function fly(s: GliderState, seconds: number, c: Controls | ((t: number) => Controls), each?: (s: GliderState, t: number) => void): GliderState {
  for (let t = 0; t < seconds; t += dt) {
    step(s, typeof c === 'function' ? c(t) : c, still, dt, rng);
    each?.(s, t);
  }
  return s;
}
const brakes = (b: number, weight = 0): Controls => ({ brakeL: b, brakeR: b, speedbar: 0, weight });

describe('braked polar, step by step (keyboard steps of 10 %)', () => {
  // Each step from the previous one's equilibrium, as the keyboard does.
  const rows: { b: number; v: number; sink: number; peakSink: number; v2s: number }[] = [];
  const s = fly(newGlider(0, 0, 500, 0), 30, brakes(0));
  rows.push({ b: 0, v: kmh(s), sink: -s.vzAir, peakSink: -s.vzAir, v2s: kmh(s) });
  for (let i = 1; i <= 8; i++) {
    const b = i / 10;
    let peakSink = 0;
    let v2s = 0;
    fly(s, 25, brakes(b), (g, t) => {
      if (t > 0.5) peakSink = Math.max(peakSink, -g.vzAir);
      if (Math.abs(t - 2) < dt / 2) v2s = kmh(g);
    });
    rows.push({ b, v: kmh(s), sink: -s.vzAir, peakSink, v2s });
  }

  it('flies an EN-B polar: trim ~37.5 km/h at ~1.1 m/s, minimum sink ~1.0 m/s near 30 %, ~24 km/h at 80 %', () => {
    expect(rows[0].v).toBeGreaterThan(36.5);
    expect(rows[0].v).toBeLessThan(39);
    expect(rows[0].sink).toBeGreaterThan(1.05);
    expect(rows[0].sink).toBeLessThan(1.2);
    const min = rows.reduce((a, r) => (r.sink < a.sink ? r : a));
    expect(min.b).toBeGreaterThanOrEqual(0.2);
    expect(min.b).toBeLessThanOrEqual(0.4);
    expect(min.sink).toBeGreaterThan(0.94);
    expect(min.sink).toBeLessThan(1.02);
    expect(min.v).toBeGreaterThan(29);
    expect(min.v).toBeLessThan(33);
    expect(rows[8].v).toBeGreaterThan(22.5);
    expect(rows[8].v).toBeLessThan(25.5);
    // Past the minimum sink, the sink climbs faster and faster towards the stall.
    expect(rows[8].sink).toBeGreaterThan(rows[6].sink + 0.4);
    expect(rows[6].sink).toBeGreaterThan(rows[4].sink + 0.15);
    expect(s.stall).toBe(0);
  });

  it('slows down by a clear amount at every step', () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].v - rows[i].v).toBeGreaterThan(1.2);
      // Felt within two seconds: most of the step's slowing is there.
      expect((rows[i - 1].v - rows[i].v2s) / (rows[i - 1].v - rows[i].v)).toBeGreaterThan(0.45);
    }
  });

  it('sinks less at each step down to the minimum sink, without overshooting into more sink', () => {
    for (let i = 1; i <= 3; i++) {
      expect(rows[i].sink).toBeLessThan(rows[i - 1].sink - 0.01);
      expect(rows[i].peakSink).toBeLessThan(rows[i - 1].sink + 0.05);
    }
  });
});

describe('spiral dive and wingovers', () => {
  it('a held inner brake and weight shift engage a spiral: steep bank, nose down, EN sink rates, exit with a pull-up', () => {
    const s = newGlider(0, 0, 3000, 0, WINGS.B);
    fly(s, 25, (t) => ({ brakeL: 0, brakeR: Math.min(0.75, (t / 3) * 0.75), speedbar: 0, weight: 1 }));
    expect(deg(s.bank)).toBeGreaterThan(60);
    expect(deg(s.bank)).toBeLessThan(82);
    expect(deg(s.pitch)).toBeGreaterThan(25);
    expect(-s.vz).toBeGreaterThan(12);
    expect(-s.vz).toBeLessThan(19);
    expect(s.load).toBeGreaterThan(3);
    // Hands up: the wing comes out of the dive, nose up and climbing for a moment.
    let noseUp = 0;
    let climb = -99;
    let level = -1;
    fly(s, 12, brakes(0), (g, t) => {
      noseUp = Math.min(noseUp, deg(g.pitch));
      climb = Math.max(climb, g.vz);
      if (level < 0 && Math.abs(g.bank) < 0.25) level = t;
    });
    expect(noseUp).toBeLessThan(-15);
    expect(climb).toBeGreaterThan(1);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(8);
  });

  it('wingovers swing the wing past 70° of bank each side, the nose rising and falling', () => {
    const s = newGlider(0, 0, 3000, 0, WINGS.B);
    let left = 0;
    let right = 0;
    let pMin = 0;
    let pMax = 0;
    fly(s, 20, (t) => (Math.floor(t / 2.5) % 2 ? { brakeL: 0.7, brakeR: 0, speedbar: 0, weight: -1 } : { brakeL: 0, brakeR: 0.7, speedbar: 0, weight: 1 }), (g, t) => {
      if (t < 8) return;
      left = Math.min(left, deg(g.bank));
      right = Math.max(right, deg(g.bank));
      pMin = Math.min(pMin, deg(g.pitch));
      pMax = Math.max(pMax, deg(g.pitch));
    });
    expect(right).toBeGreaterThan(70);
    expect(left).toBeLessThan(-70);
    expect(pMax - pMin).toBeGreaterThan(30);
  });

  it('the pilot’s head levels small swings but not a spiral’s bank and pitch', () => {
    expect(headRoll(0.4) / 0.4).toBeGreaterThan(0.3);
    expect(headPitch(0.1) / 0.1).toBeGreaterThan(0.4);
    // 75° of bank and 35° of nose-down: the view keeps most of it (the ground ahead).
    expect(deg(1.31 - headRoll(1.31))).toBeGreaterThan(55);
    expect(deg(0.61 - headPitch(0.61))).toBeGreaterThan(25);
  });
});
