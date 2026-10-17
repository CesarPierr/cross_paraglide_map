import { describe, expect, it } from 'vitest';
import { AirMass } from '../src/game/airmass';
import { newGlider, type AirSample } from '../src/game/flight';
import { LocalFrame } from '../src/game/geo';
import { anabaticSpeed, PilotAir, ReliefFlow, surfaceFactor, turbulenceModel, type TurbulenceState } from '../src/game/pilot-air';

/** A ridge across a west wind: windward slope ~30° from x = −520, crest 300 m high at x = 0, steep lee to x = 330. */
const ridge = (x: number) => {
  if (x < -520) return 1000;
  if (x < 0) return 1000 + 300 * (1 - (-x / 520) ** 1.5);
  if (x < 330) return 1300 - 300 * (x / 330);
  return 1000;
};

/** Relief flow at (x, z) for a west wind of U m/s: vertical speed (m/s), speed-up, rotor. */
function at(x: number, z: number, U: number) {
  const r = new ReliefFlow();
  const g = ridge(x);
  expect(r.update((px) => ridge(px), x, 0, z, g, U, 0, 0)).toBe(true);
  const f = { w: 0, du: 0 };
  r.flowAt(0, z - g + 12, f);
  const rot = { u: 0, w: 0, f: 0, block: 0, shear: 0 };
  r.rotorAt(0, z - g, rot);
  return { w: f.w * U, du: f.du, rot, sep: r.sep };
}

describe('relief flow along the wind (fine terrain)', () => {
  it('ridge lift starts upwind of the face, rises above the crest and weakens with height', () => {
    const U = 5.6;
    expect(at(-620, 1150, U).w).toBeGreaterThan(0.8); // 100 m in front of the foot of the face, mid-height
    expect(at(-260, 1350, U).w).toBeGreaterThan(1); // over the face
    expect(at(-60, 1500, U).w).toBeGreaterThan(0.3); // 200 m above the crest
    expect(at(-260, 2300, U).w).toBeLessThan(at(-260, 1350, U).w * 0.5);
  });

  it('speeds the wind up over the crest and sinks beyond it', () => {
    const U = 5.6;
    const crest = at(0, 1330, U);
    expect(crest.du).toBeGreaterThan(0.15);
    expect(crest.du).toBeLessThan(0.8);
    expect(at(250, 1150, U).w).toBeLessThan(-0.2);
  });

  it('above ~25 km/h the flow separates behind the steep crest: a rotor turns the wind back near the ground', () => {
    const strong = at(500, 1060, 9.7);
    expect(strong.sep).toBeGreaterThan(0.5);
    expect(strong.rot.u).toBeLessThan(-0.15);
    expect(at(500, 1060, 3).sep).toBeLessThan(0.05);
  });

  it('speeds the wind up through a narrow gap between walls (venturi)', () => {
    const r = new ReliefFlow();
    r.update((_x, y) => (Math.abs(y) > 150 ? 1200 : 1000), 0, 0, 1050, 1000, 5.6, 0, 0);
    expect(r.gap).toBeGreaterThan(1.15);
    const open = new ReliefFlow();
    open.update(() => 1000, 0, 0, 1050, 1000, 5.6, 0, 0);
    expect(open.gap).toBe(1);
  });
});

describe('wind gradient and turbulence at the pilot', () => {
  it('log profile near the ground: deeper and stronger when the air is stable or rough', () => {
    expect(surfaceFactor(10, 0.15, 30)).toBeGreaterThan(surfaceFactor(10, 0.15, 95));
    expect(surfaceFactor(2, 0.75, 60)).toBeLessThan(surfaceFactor(2, 0.15, 60));
    expect(surfaceFactor(200, 0.15, 60)).toBe(1);
  });

  it('Dryden near the ground: σw ≈ 0.13 × the 6 m wind, longer horizontal eddies, σu > σw low down', () => {
    const t: TurbulenceState = { sigU: 0, sigW: 0, Lu: 0, Lw: 0, sigX: 0, Lx: 0, intensity: 0 };
    turbulenceModel(30, 5, 1, 0, 100, 0, t);
    expect(t.sigW).toBeCloseTo(0.65, 1);
    expect(t.sigU).toBeGreaterThan(t.sigW * 1.2);
    expect(t.Lu).toBeGreaterThan(t.Lw);
    // Stable air: weaker, smaller eddies.
    const st: TurbulenceState = { ...t };
    turbulenceModel(30, 5, 0, 0, 100, 0, st);
    expect(st.sigW).toBeLessThan(t.sigW);
    expect(st.Lw).toBeLessThan(t.Lw);
  });

  it('samples the centre and both tips, slows the wind near the ground and adds no relief on the flat', () => {
    const a = new AirMass(new LocalFrame(6, 45), { month0: 6, day: 15, hour: 14, windFrom: 270, windKmh: 20, instability: 0.6, humidity: 0.4, randomWeather: false, timeScale: 1, seed: 1 });
    const pa = new PilotAir(a, () => 500);
    pa.setModel({ u: 6, v: 0, lift: 0, turbulence: 0, lee: 0, ground: 500, venturi: 0, shear: 0 });
    const out: AirSample = { u: 0, v: 0, w: 0, turbulence: 0 };
    const high = newGlider(0, 0, 900, Math.PI / 2);
    pa.update(high, 500);
    let uHigh = 0;
    for (let k = 0; k < 600; k++) {
      high.x = k * 10;
      pa.sample(high, 500, 10, 1 / 120, out);
      uHigh += out.u / 600;
    }
    const low = newGlider(0, 0, 503, Math.PI / 2);
    let uLow = 0;
    for (let k = 0; k < 600; k++) {
      low.x = k * 10;
      pa.sample(low, 500, 10, 1 / 120, out);
      uLow += out.u / 600;
    }
    expect(uHigh).toBeGreaterThan(5);
    expect(uLow).toBeLessThan(0.75 * uHigh);
    expect(out.wL).toBeDefined();
    expect(out.agl).toBeCloseTo(3, 0);
    expect(Math.abs(pa.info.relief)).toBeLessThan(0.01);
  });
});

describe('upslope breeze along the sunlit relief', () => {
  // Unit normal of a slope facing the azimuth `aspect` (° from north), `deg` steep; the sun likewise.
  const normal = (aspect: number, deg: number): [number, number, number] => {
    const a = (aspect * Math.PI) / 180;
    const t = (deg * Math.PI) / 180;
    return [Math.sin(a) * Math.sin(t), Math.cos(a) * Math.sin(t), Math.cos(t)];
  };
  const sun = (az: number, el: number): [number, number, number] => {
    const a = (az * Math.PI) / 180;
    const e = (el * Math.PI) / 180;
    return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
  };
  const v = (n: [number, number, number], s: [number, number, number], surface = 1, U = 0, season = 1) => anabaticSpeed(...n, ...s, season, surface, U);

  it('a sunny cliff breathes 2-4 m/s, a shaded face nothing', () => {
    const noon = sun(180, 65);
    expect(v(normal(160, 75), noon, 1.3)).toBeGreaterThan(2);
    expect(v(normal(160, 75), noon, 1.3)).toBeLessThan(4.5);
    expect(v(normal(340, 75), noon)).toBe(0);
  });

  it('a face lit at a slant keeps most of its breeze (cube root of the heat flux)', () => {
    const early = sun(200, 63);
    const se = v(normal(135, 75), early);
    const s = v(normal(200, 75), early);
    expect(se).toBeGreaterThan(0.6 * s);
  });

  it('weaker on a gentle slope, over forest, and in a wind', () => {
    const noon = sun(180, 65);
    expect(v(normal(180, 10), noon)).toBeLessThan(0.5 * v(normal(180, 40), noon));
    expect(v(normal(180, 40), noon, 0.88)).toBeLessThan(v(normal(180, 40), noon, 1.37));
    expect(v(normal(180, 40), noon, 1, 8)).toBeLessThan(0.5 * v(normal(180, 40), noon, 1, 0));
  });

  it('none at night', () => {
    expect(v(normal(180, 40), sun(180, -5))).toBe(0);
  });
});
