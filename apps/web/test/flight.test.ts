import { describe, expect, it } from 'vitest';
import { newGlider, polar, step, WINGS, type AirSample, type Controls } from '../src/game/flight';

const still: AirSample = { u: 0, v: 0, w: 0, turbulence: 0 };
const hands = (l = 0, r = 0, bar = 0): Controls => ({ brakeL: l, brakeR: r, speedbar: bar });
const rng = () => 0.5;

function fly(seconds: number, c: Controls, air = still, s = newGlider(0, 0, 2000, 0)) {
  const dt = 1 / 120;
  const events: string[] = [];
  for (let t = 0; t < seconds; t += dt) events.push(...step(s, c, air, dt, rng));
  return { s, events };
}

describe('flight model', () => {
  it('glides at trim speed with a realistic glide ratio', () => {
    const { s } = fly(30, hands(), still, newGlider(0, 0, 500, 0));
    expect(s.airspeed * 3.6).toBeGreaterThan(35);
    expect(s.airspeed * 3.6).toBeLessThan(40);
    expect(s.airspeed / -s.vzAir).toBeGreaterThan(8.5);
    expect(s.airspeed / -s.vzAir).toBeLessThan(11);
  });

  it('turns towards the braked side and banks into the turn', () => {
    const { s } = fly(4, hands(0, 0.6));
    expect(s.yawRate).toBeGreaterThan(0.3);
    expect(s.bank).toBeGreaterThan(0.2);
    const left = fly(4, hands(0.6, 0)).s;
    expect(left.yawRate).toBeLessThan(-0.3);
  });

  it('sinks faster in a steep turn than on a straight line', () => {
    const straight = fly(10, hands(0.3, 0.3)).s;
    const turn = fly(10, hands(0, 0.9)).s;
    expect(-turn.vzAir).toBeGreaterThan(-straight.vzAir * 1.4);
  });

  it('stalls when both brakes are held deep, and recovers', () => {
    const { s, events } = fly(4, hands(1, 1));
    expect(events).toContain('stall');
    expect(-s.vzAir).toBeGreaterThan(4);
    fly(6, hands(0, 0), still, s);
    expect(s.stall).toBeLessThan(0.1);
    expect(s.airspeed).toBeGreaterThan(9);
  });

  it('collapses on a sharp downward gust when flying hands up, not when the pilot holds pressure', () => {
    const gust = (s: ReturnType<typeof newGlider>, brake: number) => {
      const dt = 1 / 120;
      const out: string[] = [];
      for (let t = 0; t < 2; t += dt) out.push(...step(s, hands(brake, brake), { u: 0, v: 0, w: t < 1 ? 1.5 : -1.5, turbulence: 0 }, dt, rng));
      return out;
    };
    expect(gust(newGlider(0, 0, 2000, 0), 0).some((e) => e.startsWith('collapse') || e === 'frontal')).toBe(true);
    expect(gust(newGlider(0, 0, 2000, 0), 0.35).some((e) => e.startsWith('collapse') || e === 'frontal')).toBe(false);
  });

  it('drifts with the wind and climbs with rising air', () => {
    const { s } = fly(10, hands(), { u: 5, v: 0, w: 2, turbulence: 0 });
    expect(s.x).toBeGreaterThan(45);
    expect(s.z).toBeGreaterThan(2000);
  });

  it('accelerates with the speed bar', () => {
    expect(polar(0, 1).v).toBeGreaterThan(polar(0, 0).v + 3);
  });

  it('rolls away from a thermal felt under one wing (the pilot must turn into it)', () => {
    const s = newGlider(0, 0, 2000, 0);
    const dt = 1 / 120;
    for (let t = 0; t < 1.5; t += dt) step(s, hands(), { u: 0, v: 0, w: 0.5, wL: -0.2, wR: 1.6, turbulence: 0 }, dt, rng);
    expect(s.bank).toBeLessThan(-0.03);
    expect(s.yawRate).toBeLessThan(0);
  });

  it('an EN-A forgives what folds an EN-C, and reopens sooner', () => {
    const hit = (id: 'A' | 'C') => {
      const s = newGlider(0, 0, 2000, 0, WINGS[id]);
      const dt = 1 / 120;
      const ev: string[] = [];
      for (let t = 0; t < 2; t += dt) ev.push(...step(s, hands(), { u: 0, v: 0, w: t < 1 ? 1.2 : -1.2, turbulence: 0 }, dt, rng));
      return ev.some((e) => e.startsWith('collapse') || e === 'frontal');
    };
    expect(hit('C')).toBe(true);
    expect(hit('A')).toBe(false);
    const reopenTime = (id: 'A' | 'C') => {
      const s = newGlider(0, 0, 2000, 0, WINGS[id]);
      s.collapse = { side: 1, amount: 0.5, frontal: 0, cravat: 0, cravatSide: 0 };
      const dt = 1 / 120;
      let t = 0;
      while (s.collapse.amount > 0 && t < 30) {
        step(s, hands(), still, dt, rng);
        t += dt;
      }
      return t;
    };
    expect(reopenTime('A')).toBeLessThan(reopenTime('C') / 2);
  });

  it('an EN-C is faster and glides better than an EN-A', () => {
    const a = polar(0, 0, WINGS.A);
    const c = polar(0, 0, WINGS.C);
    expect(c.v).toBeGreaterThan(a.v);
    expect(c.v / c.sink).toBeGreaterThan(a.v / a.sink + 1);
  });
});


describe('EN 926-2-like asymmetric collapse, hands off', () => {
  const collapse = (id: 'A' | 'B' | 'C', amount: number) => {
    const s = newGlider(0, 0, 1500, 0, WINGS[id]);
    s.collapse = { side: 1, amount: Math.min(amount, WINGS[id].collapseMax), frontal: 0, cravat: 0, cravatSide: 0 };
    const dt = 1 / 120;
    let maxBank = 0;
    let turned = 0;
    let last = s.heading;
    for (let t = 0; t < 12; t += dt) {
      step(s, hands(), still, dt, rng);
      let dh = s.heading - last;
      if (dh > Math.PI) dh -= 2 * Math.PI;
      if (dh < -Math.PI) dh += 2 * Math.PI;
      turned += dh;
      last = s.heading;
      maxBank = Math.max(maxBank, Math.abs(s.bank));
    }
    return { turnDeg: (turned * 180) / Math.PI, bankDeg: (maxBank * 180) / Math.PI };
  };
  it('a big collapse on a B turns 90–180° with 15–45° of roll', () => {
    const r = collapse('B', 0.7);
    expect(r.turnDeg).toBeGreaterThan(90);
    expect(r.turnDeg).toBeLessThan(180);
    expect(r.bankDeg).toBeGreaterThan(15);
    expect(r.bankDeg).toBeLessThan(45);
  });
  it('an A barely turns, a C turns more but less than a full turn', () => {
    expect(collapse('A', 0.5).turnDeg).toBeLessThan(90);
    const c = collapse('C', 0.75).turnDeg;
    expect(c).toBeGreaterThan(collapse('B', 0.7).turnDeg);
    expect(c).toBeLessThan(360);
  });
  it('flies faster and sinks more in thin air', () => {
    const lo = newGlider(0, 0, 500, 0);
    const hi = newGlider(0, 0, 3000, 0);
    const dt = 1 / 120;
    for (let t = 0; t < 30; t += dt) {
      step(lo, hands(), still, dt, rng);
      step(hi, hands(), still, dt, rng);
    }
    expect(hi.airspeed / lo.airspeed).toBeGreaterThan(1.1);
  });
});

describe('spiral dive', () => {
  it('a B held at 75 % inside brake enters a spiral (≥ 3.5 g, ≥ 10 m/s), an A does not', () => {
    const spiral = (id: 'A' | 'B') => {
      const s = newGlider(0, 0, 3000, 0, WINGS[id]);
      let g = 0;
      let sink = 0;
      const dt = 1 / 120;
      for (let t = 0; t < 25; t += dt) {
        step(s, hands(0, Math.min(0.75, (t / 3) * 0.75)), still, dt, rng);
        g = Math.max(g, s.load);
        sink = Math.max(sink, -s.vz);
      }
      return { g, sink };
    };
    const b = spiral('B');
    expect(b.g).toBeGreaterThan(3.5);
    expect(b.sink).toBeGreaterThan(10);
    expect(spiral('A').g).toBeLessThan(2.5);
  });
});
