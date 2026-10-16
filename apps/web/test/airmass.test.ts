import { describe, expect, it } from 'vitest';
import { AirMass, type Scenario } from '../src/game/airmass';
import { LocalFrame } from '../src/game/geo';

const scenario = (windFrom: number, windKmh: number): Scenario => ({ month0: 6, day: 15, hour: 14, windFrom, windKmh, instability: 0.7, humidity: 0.3, randomWeather: false, timeScale: 1, seed: 42 });

/** One thermal source on a slope facing east, on flat 5×5 cells around it. */
function airWith(windFrom: number, windKmh: number, lee = 0) {
  const a = new AirMass(new LocalFrame(6, 45), scenario(windFrom, windKmh));
  a.season = 1;
  const n = 5;
  const lon = new Float32Array(n).map((_, i) => 5.99 + i * 0.005);
  const lat = new Float32Array(n).map((_, j) => 45.01 - j * 0.005);
  const fill = (v: number) => new Float32Array(n * n).fill(v);
  const thermal = fill(0.1);
  thermal[12] = 0.9;
  a.placeSources({ cols: n, rows: n, lon, lat, thermal, elevation: fill(1000), aspect: fill(90), slope: fill(25), lee: fill(lee) }, [], 0, 0);
  // A working trigger (the daily draw may make some weak).
  a.sources[0].base = 1;
  return a;
}

describe('air mass', () => {
  it('a thermal lifts in its core, sinks around it, and grows a column up to the ceiling', () => {
    const a = airWith(0, 0);
    const s = a.sources[0];
    let best = -1e9;
    let at = 0;
    for (let t = 0; t < 1200; t += 20) {
      const c = a.column(s, 1600, t);
      if (c && c.w > best) {
        best = c.w;
        at = t;
      }
    }
    expect(best).toBeGreaterThan(1.5);
    const c = a.column(s, 1600, at)!;
    expect(a.vertical(c.cx, c.cy, 1600, 1000, at).w).toBeGreaterThan(1);
    expect(a.vertical(c.cx + 6 * c.rc, c.cy, 1600, 1000, at).w).toBeLessThan(0);
  });

  it('leans downwind with height', () => {
    // Wind from the east onto the east-facing slope (windward): blows towards the west.
    const a = airWith(90, 25);
    const s = a.sources[0];
    for (let t = 0; t < 1200; t += 20) {
      const lo = a.column(s, 1300, t);
      const hi = a.column(s, 2200, t);
      if (lo && hi) {
        expect(hi.cx).toBeLessThan(lo.cx - 100);
        return;
      }
    }
    throw new Error('thermal never active at both heights');
  });

  it('is stronger on a slope facing the wind than in the lee', () => {
    const windward = airWith(90, 25);
    const leeward = airWith(270, 25, 0.8);
    expect(windward.strength(windward.sources[0])).toBeGreaterThan(leeward.strength(leeward.sources[0]) * 1.4);
  });
});
