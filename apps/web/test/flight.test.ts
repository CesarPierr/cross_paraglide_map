import { describe, expect, it } from 'vitest';
import { newGlider, polar, step, WINGS, type AirSample, type Controls, type WingParams } from '../src/game/flight';

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

describe('inertial point mass: the wind acts on the wing', () => {
  const gustRun = (gu: number, gw: number) => {
    const ref = newGlider(0, 0, 1000, 0);
    const s = newGlider(0, 0, 1000, 0);
    const dt = 1 / 120;
    let v0 = 0;
    let jump = 0;
    for (let t = 0; t < 12; t += dt) {
      step(ref, hands(), still, dt, rng);
      const air: AirSample = t > 1 ? { u: 0, v: gu, w: gw, turbulence: 0 } : still;
      step(s, hands(), air, dt, rng);
      if (t < 1) v0 = s.airspeed;
      if (t > 1 && t < 1 + 1.5 * dt) jump = s.airspeed - v0;
    }
    return { jump, dz: s.z - ref.z };
  };
  it('a headwind gust raises the airspeed at once and the glider zooms; a tailwind gust costs height', () => {
    // Heading north: v < 0 is a headwind.
    const head = gustRun(-5, 0);
    expect(head.jump).toBeGreaterThan(4.4);
    expect(head.dz).toBeGreaterThan(1.5);
    const tail = gustRun(5, 0);
    expect(tail.jump).toBeLessThan(-4.4);
    expect(tail.dz).toBeLessThan(-1.5);
  });

  it('follows a vertical gust within a few tenths of a second (plunge with the added mass)', () => {
    const s = newGlider(0, 0, 1000, 0);
    const dt = 1 / 120;
    for (let t = 0; t < 10; t += dt) step(s, hands(), still, dt, rng);
    const vz0 = s.vz;
    let t63 = -1;
    for (let t = 0; t < 2; t += dt) {
      step(s, hands(), { u: 0, v: 0, w: 2, turbulence: 0 }, dt, rng);
      if (t63 < 0 && s.vz - vz0 > 1.26) t63 = t;
    }
    expect(t63).toBeGreaterThan(0.08);
    expect(t63).toBeLessThan(0.5);
  });

  it('flares: a quick full brake at trim speed climbs for about a second, then stalls if held', () => {
    const s = newGlider(0, 0, 500, 0);
    const dt = 1 / 120;
    for (let t = 0; t < 15; t += dt) step(s, hands(), still, dt, rng);
    let vzMax = -9;
    let tStall = -1;
    for (let t = 0; t < 6; t += dt) {
      const b = Math.min(1, t / 0.4);
      step(s, hands(b, b), still, dt, rng);
      vzMax = Math.max(vzMax, s.vz);
      if (tStall < 0 && s.stall > 0.5) tStall = t;
    }
    expect(vzMax).toBeGreaterThan(0.3);
    expect(tStall).toBeGreaterThan(1.5);
    expect(tStall).toBeLessThan(5);
  });

  it('sinks more at touchdown descending through a wind gradient than in a uniform wind', () => {
    const run = (gradient: boolean) => {
      const s = newGlider(0, 0, 40, 0);
      const dt = 1 / 120;
      for (let t = 0; t < 90 && s.z > 1; t += dt) {
        const f = gradient ? Math.min(1, Math.log(1 + Math.max(0, s.z) / 0.15) / Math.log(1 + 60 / 0.15)) : 0.7;
        step(s, hands(), { u: 0, v: -7 * f, w: 0, turbulence: 0, agl: s.z }, dt, rng);
      }
      return s.vz;
    };
    expect(run(true)).toBeLessThan(run(false) - 0.3);
  });
});

describe('angle of attack, brake pressure and active piloting', () => {
  const critical = (w: WingParams, brake: number, bar: number) => {
    let lo = 0.1;
    let hi = 5;
    for (let k = 0; k < 14; k++) {
      const a = (lo + hi) / 2;
      const s = newGlider(0, 0, 2000, 0, w);
      const dt = 1 / 120;
      let folded = false;
      for (let t = 0; t < 14; t += dt) {
        const ev = step(s, hands(brake, brake, bar), t < 12 ? still : { u: 0, v: 0, w: t < 13 ? a : -a, turbulence: 0 }, dt, rng);
        if (ev.some((e) => e.startsWith('collapse') || e === 'frontal')) folded = true;
      }
      if (folded) hi = a;
      else lo = a;
    }
    return 2 * hi;
  };
  it('folds with a smaller gust on the speed bar, a larger one with brake pressure held', () => {
    const trim = critical(WINGS.B, 0, 0);
    expect(trim).toBeGreaterThan(1.6);
    expect(trim).toBeLessThan(2.4);
    expect(critical(WINGS.B, 0, 1)).toBeLessThan(trim * 0.65);
    expect(critical(WINGS.B, 0.35, 0)).toBeGreaterThan(trim * 1.35);
  });

  it('brake pressure rises with the travel and goes soft before a fold', () => {
    const s = newGlider(0, 0, 1000, 0);
    const dt = 1 / 120;
    for (let t = 0; t < 20; t += dt) step(s, hands(0.3, 0.3), still, dt, rng);
    const p30 = s.pressureL;
    const t2 = newGlider(0, 0, 1000, 0);
    for (let t = 0; t < 20; t += dt) step(t2, hands(0.6, 0.6), still, dt, rng);
    expect(t2.pressureL).toBeGreaterThan(p30);
    expect(p30).toBeGreaterThan(1.5);
    // A downward gust lowers the angle of attack: the pressure drops before anything folds.
    let pMin = 99;
    for (let t = 0; t < 0.4; t += dt) {
      step(s, hands(0.3, 0.3), { u: 0, v: 0, w: -1.2, turbulence: 0 }, dt, rng);
      pMin = Math.min(pMin, s.pressureL);
    }
    expect(pMin).toBeLessThan(0.8 * p30);
  });

  it('a frontal pitches the wing back, then it surges as it reopens', () => {
    const s = newGlider(0, 0, 1500, 0);
    s.collapse = { side: 0, amount: 0, frontal: 0.7, cravat: 0, cravatSide: 0 };
    const dt = 1 / 120;
    let back = 0;
    let surge = 0;
    let reopened = false;
    for (let t = 0; t < 8; t += dt) {
      const ev = step(s, hands(), still, dt, rng);
      if (ev.includes('reopened')) reopened = true;
      if (!reopened) back = Math.min(back, s.pitch);
      else surge = Math.max(surge, s.pitch);
    }
    expect(back).toBeLessThan(-0.05);
    expect(surge).toBeGreaterThan(0.05);
  });

  it('counter-braking a collapse moderately holds the heading; too hard spins or stalls the open side', () => {
    const run = (counter: number) => {
      const s = newGlider(0, 0, 1500, 0);
      s.collapse = { side: 1, amount: 0.5, frontal: 0, cravat: 0, cravatSide: 0 };
      const dt = 1 / 120;
      const ev: string[] = [];
      for (let t = 0; t < 6; t += dt) ev.push(...step(s, hands(counter, 0), still, dt, rng));
      return ev;
    };
    expect(run(0.55).some((e) => e === 'spin' || e === 'stall')).toBe(false);
    expect(run(0.97).some((e) => e === 'spin' || e === 'stall')).toBe(true);
  });

  it('the weight leaves before the wing: a quick lean first rolls it the other way, then it turns', () => {
    const s = newGlider(0, 0, 2000, 0);
    const dt = 1 / 120;
    for (let t = 0; t < 5; t += dt) step(s, hands(), still, dt, rng);
    let minBank = 0;
    for (let t = 0; t < 0.8; t += dt) {
      step(s, { ...hands(), weight: Math.min(1, t / 0.4) }, still, dt, rng);
      minBank = Math.min(minBank, s.bank);
    }
    for (let t = 0; t < 8; t += dt) step(s, { ...hands(), weight: 1 }, still, dt, rng);
    expect(minBank).toBeLessThan(-0.008);
    expect(s.turnRate).toBeGreaterThan(0.1);
  });

  it('slow with deep inner brake: the turn skids flat and the inner wing spins; never in a normal thermal turn', () => {
    const s = newGlider(0, 0, 2000, 0);
    const dt = 1 / 120;
    for (let t = 0; t < 15; t += dt) step(s, hands(0.5, 0.5), still, dt, rng);
    const ev: string[] = [];
    let skid = 0;
    for (let t = 0; t < 4; t += dt) {
      ev.push(...step(s, hands(0.1, 0.9), still, dt, rng));
      skid = Math.max(skid, s.skid);
    }
    expect(skid).toBeGreaterThan(0.3);
    expect(ev).toContain('spin');
    const th = newGlider(0, 0, 2000, 0);
    const ev2: string[] = [];
    for (let t = 0; t < 30; t += dt) ev2.push(...step(th, hands(0.15, 0.5), still, dt, rng));
    expect(ev2).not.toContain('spin');
  });

  it('ground effect is real but tiny for a wing 7 m above the pilot', () => {
    const a = newGlider(0, 0, 500, 0);
    const b = newGlider(0, 0, 500, 0);
    const dt = 1 / 120;
    for (let t = 0; t < 15; t += dt) {
      step(a, hands(), { u: 0, v: 0, w: 0, turbulence: 0, agl: 1 }, dt, rng);
      step(b, hands(), still, dt, rng);
    }
    const gain = 1 - a.vzAir / b.vzAir;
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(0.02);
  });
});
