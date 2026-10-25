import { describe, expect, it } from 'vitest';
import { AirMass, PROFILE_DZ, type Scenario } from '../src/game/airmass';
import { LocalFrame } from '../src/game/geo';

const scenario = (windFrom: number, windKmh: number, extra: Partial<Scenario> = {}): Scenario => ({ month0: 6, day: 15, hour: 14, windFrom, windKmh, instability: 0.7, humidity: 0.3, randomWeather: false, timeScale: 1, seed: 42, ...extra });

/** One thermal source on a slope facing east, in a uniform potential (no background relief). */
function airWith(windFrom: number, windKmh: number, lee = 0, extra: Partial<Scenario> = {}) {
  const a = new AirMass(new LocalFrame(6, 45), scenario(windFrom, windKmh, extra));
  a.season = 1;
  const n = 7;
  const lon = new Float32Array(n).map((_, i) => 5.985 + i * 0.005);
  const lat = new Float32Array(n).map((_, j) => 45.015 - j * 0.005);
  const fill = (v: number) => new Float32Array(n * n).fill(v);
  const thermal = fill(0.6);
  thermal[24] = 0.62;
  a.placeSources({ cols: n, rows: n, lon, lat, thermal, elevation: fill(1000), aspect: fill(90), slope: fill(25), lee: fill(lee) }, [], 0, 0);
  const s = a.sources.find((x) => Math.hypot(x.x - a.frame.toXY(6, 45)[0], x.y - a.frame.toXY(6, 45)[1]) < 300)!;
  for (const o of a.sources) if (o !== s) o.base = 0;
  // A working trigger (the daily draw may make some weak), one core.
  s.base = 1;
  s.cores = [{ off: 0.01, ang: 0, spin: 0, share: 1 }];
  return { a, s };
}

/** A time when the thermal works at height z. */
function activeAt(a: AirMass, s: ReturnType<typeof airWith>['s'], z: number, min = 1): number {
  for (let t = 0; t < 6000; t += 10) if ((a.column(s, z, t)?.w ?? 0) > min) return t;
  throw new Error('thermal never active');
}

describe('air mass', () => {
  it('a thermal lifts in its core, with a ring of sink around it (Allen), up to the ceiling', () => {
    const { a, s } = airWith(0, 0);
    const t = activeAt(a, s, 1600, 1.5);
    const c = a.column(s, 1600, t)!;
    expect(a.vertical(c.cx, c.cy, 1600, 1000, t).w).toBeGreaterThan(1);
    let ring = 0;
    for (let ang = 0; ang < 2 * Math.PI; ang += Math.PI / 6) ring = Math.min(ring, a.vertical(c.cx + 1.7 * c.rc * Math.cos(ang), c.cy + 1.7 * c.rc * Math.sin(ang), 1600, 1000, t).w);
    expect(ring).toBeLessThan(-0.1);
    expect(c.top).toBeGreaterThan(a.ceilingAt(s.x, s.y, s.ground) - 1);
  });

  it('a working thermal on a good summer afternoon climbs as the sources say (varios of 2 to 3 m/s, +4 in the best)', () => {
    const { a, s } = airWith(0, 0);
    s.size = 1;
    // At a quarter of the layer (the best height), the core over its bubbles' cycles.
    const z = s.ground + 0.25 * (Math.min(a.cloudBase(s.terrain), a.ceilingAt(s.x, s.y, s.ground)) - s.ground);
    const w: number[] = [];
    for (let t = 0; t < 6000; t += 20) {
      const c = a.column(s, z, t);
      if (c) w.push(a.vertical(c.cx, c.cy, z, s.ground, t).w);
    }
    w.sort((p, q) => p - q);
    // Net of a glider circling at ~1.4 m/s of sink: +2 to +3 while it works, up to +5 at best.
    expect(w[w.length >> 1]).toBeGreaterThan(3.4);
    expect(w[w.length >> 1]).toBeLessThan(4.6);
    expect(w[w.length - 1]).toBeLessThan(6.5);
  });

  it('conserves mass: over a window of many thermals the mean vertical air is ~0', () => {
    const frame = new LocalFrame(6, 45);
    const a = new AirMass(frame, scenario(0, 0, { seed: 5 }));
    a.season = 1;
    const n = 81;
    const [lonW, latS] = frame.toLngLat(-9000, -9000);
    const [lonE, latN] = frame.toLngLat(9000, 9000);
    const lon = new Float32Array(n).map((_, i) => lonW + ((lonE - lonW) * i) / (n - 1));
    const lat = new Float32Array(n).map((_, j) => latN - ((latN - latS) * j) / (n - 1));
    const thermal = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) thermal[j * n + i] = Math.max(0, 0.45 + 0.25 * Math.sin(i / 3.1) * Math.cos(j / 2.7) + 0.12 * Math.sin(i / 1.3 + j / 1.9));
    const fill = (v: number) => new Float32Array(n * n).fill(v);
    a.placeSources({ cols: n, rows: n, lon, lat, thermal, elevation: fill(800), aspect: fill(180), slope: fill(5), lee: fill(0) }, [], 0, 0);
    const z = 800 + 0.4 * (a.ceilingAt(0, 0, 800) - 800);
    let sum = 0;
    let k = 0;
    for (let x = -5000; x <= 5000; x += 50)
      for (let y = -5000; y <= 5000; y += 250) {
        sum += a.vertical(x, y, z, 800, 2000).w;
        k++;
      }
    expect(Math.abs(sum / k)).toBeLessThan(0.08);
  });

  it('breathes: bubbles with cosine ramps, of different strengths, part of the time', () => {
    const { a, s } = airWith(0, 0);
    let on = 0;
    let n = 0;
    const peaks: number[] = [];
    let cur = 0;
    for (let t = 0; t < 30000; t += 10) {
      const w = a.column(s, 1500, t)?.w ?? 0;
      n++;
      if (w > 0.3) {
        on++;
        cur = Math.max(cur, w);
      } else if (cur > 0) {
        peaks.push(cur);
        cur = 0;
      }
    }
    expect(on / n).toBeGreaterThan(0.2);
    expect(on / n).toBeLessThan(0.85);
    expect(Math.max(...peaks) / Math.min(...peaks)).toBeGreaterThan(1.1);
  });

  it('leans downwind with height', () => {
    // Wind from the east onto the east-facing slope (windward): blows towards the west.
    const { a, s } = airWith(90, 25);
    for (let t = 0; t < 3000; t += 20) {
      const lo = a.column(s, 1300, t);
      const hi = a.column(s, 2200, t);
      if (lo && hi) {
        expect(hi.cx).toBeLessThan(lo.cx - 100);
        return;
      }
    }
    throw new Error('thermal never active at both heights');
  });

  it('leans with the site’s wind of each layer: up-valley breeze low, the wind aloft higher', () => {
    const { a, s } = airWith(270, 20);
    const u = new Float32Array(PROFILE_DZ.length);
    const v = new Float32Array(PROFILE_DZ.length);
    PROFILE_DZ.forEach((dz, i) => (u[i] = dz < 500 ? -3 : 5));
    a.setProfiles([s.id], u, v);
    for (let t = 0; t < 6000; t += 10) {
      const lo = a.column(s, 1350, t);
      const hi = a.column(s, 2400, t);
      if (!lo || !hi) continue;
      expect(lo.cx - s.x).toBeLessThan(-50);
      expect(hi.cx - lo.cx).toBeGreaterThan(100);
      return;
    }
    throw new Error('thermal never active at both heights');
  });

  it('bends back against the wind under the inversion', () => {
    const { a, s } = airWith(270, 20, 0, { humidity: 0 });
    const zi = a.ceilingAt(s.x, s.y, s.ground);
    for (let t = 0; t < 6000; t += 10) {
      const c75 = a.column(s, s.ground + 0.75 * (zi - s.ground), t);
      const c95 = a.column(s, s.ground + 0.95 * (zi - s.ground), t);
      if (!c75 || !c95) continue;
      expect(c75.cx - c95.cx).toBeGreaterThan(20);
      return;
    }
    throw new Error('thermal never active at both heights');
  });

  it('in wind, the core sits on the windward side with the strongest sink there; in strong wind it breaks into bubbles', () => {
    const { a, s } = airWith(270, 25);
    const t = activeAt(a, s, 1700, 1);
    const c = a.column(s, 1700, t)!;
    let up = 0;
    let down = 0;
    for (let d = 1.2 * c.rc; d < 2.6 * c.rc; d += 5) {
      up = Math.min(up, a.vertical(c.cx - d, c.cy, 1700, 1000, t).w);
      down = Math.min(down, a.vertical(c.cx + d, c.cy, 1700, 1000, t).w);
    }
    expect(up).toBeLessThan(down - 0.05);
    const strong = airWith(270, 36);
    let max = 0;
    let sum = 0;
    let n = 0;
    for (let tt = 0; tt < 1500; tt += 2) {
      const cc = strong.a.column(strong.s, 1500, tt);
      if (!cc) continue;
      const w = Math.max(0, strong.a.vertical(cc.cx, cc.cy, 1500, 1000, tt).w);
      max = Math.max(max, w);
      sum += w;
      n++;
    }
    expect(max / (sum / Math.max(1, n))).toBeGreaterThan(1.8);
  });

  it('is stronger on a slope facing the wind than in the lee', () => {
    const windward = airWith(90, 25);
    const leeward = airWith(270, 25, 0.8);
    expect(windward.a.strength(windward.s)).toBeGreaterThan(leeward.a.strength(leeward.s) * 1.4);
  });

  it('cumulus bases are regional: near-uniform over relief, not one per summit', () => {
    const frame = new LocalFrame(6, 45);
    const a = new AirMass(frame, scenario(0, 0, { humidity: 0.6 }));
    a.season = 1;
    const n = 81;
    const [lonW, latS] = frame.toLngLat(-9000, -9000);
    const [lonE, latN] = frame.toLngLat(9000, 9000);
    const lon = new Float32Array(n).map((_, i) => lonW + ((lonE - lonW) * i) / (n - 1));
    const lat = new Float32Array(n).map((_, j) => latN - ((latN - latS) * j) / (n - 1));
    const elev = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) elev[j * n + i] = 1200 + 800 * Math.sin(i / 4) * Math.cos(j / 5);
    const fill = (v: number) => new Float32Array(n * n).fill(v);
    a.placeSources({ cols: n, rows: n, lon, lat, thermal: fill(0.5), elevation: elev, aspect: fill(180), slope: fill(10), lee: fill(0) }, [], 0, 0);
    const pts = [
      [-1500, 0],
      [0, 0],
      [1500, 800],
      [-800, -1500],
    ];
    const bases = pts.map(([x, y]) => a.cloudBaseAt(x, y, 0));
    expect(Math.max(...bases) - Math.min(...bases)).toBeLessThan(120);
  });

  it('a thermal shaded by a cumulus weakens within minutes, from the bottom', () => {
    const { a, s } = airWith(0, 0);
    const t0 = activeAt(a, s, s.ground + 150, 0.8);
    const sunny = a.column(s, s.ground + 150, t0)!.w;
    (a as unknown as { lastClouds: unknown[] }).lastClouds = [{ x: s.x, y: s.y, base: s.ground + 1500, top: s.ground + 3000, radius: 1500, size: 1, seed: 0 }];
    for (let t = 0; t < 360; t++) a.updateShade(180, 89, t0 - 360 + t, 1, s.x, s.y);
    expect(a.column(s, s.ground + 150, t0)!.w).toBeLessThan(0.5 * sunny);
  });

  it('a documented convergence lifts on its line and the breezes meet across it', () => {
    const { a } = airWith(0, 0);
    for (const s of a.sources) s.base = 0;
    a.convergences = [{ name: 'c', pts: [[-5000, 3000], [5000, 3000]], start: 10, end: 18 }];
    expect(a.vertical(0, 3000, 1400, 1000, 100).w).toBeGreaterThan(0.8);
    const north = a.vertical(0, 3400, 1150, 1000, 100);
    const south = a.vertical(0, 2600, 1150, 1000, 100);
    // South of the line the air flows north, north of it south.
    expect(south.v).toBeGreaterThan(0.4);
    expect(north.v).toBeLessThan(-0.4);
  });

  it('frozen turbulence has the variance it is asked for', () => {
    const { a } = airWith(0, 0);
    const o = { u: 0, v: 0, w: 0 };
    let s2 = 0;
    let n = 0;
    for (let x = 0; x < 40000; x += 7) {
      a.turbInto(x, 0.37 * x, 1500, 0, 0.8, 0.6, 200, 100, 0, 10, o);
      s2 += o.w * o.w;
      n++;
    }
    expect(Math.sqrt(s2 / n)).toBeGreaterThan(0.45);
    expect(Math.sqrt(s2 / n)).toBeLessThan(0.75);
  });

  it('frozen turbulence stays smooth while its eddies grow along the path (climbing away from a slope)', () => {
    const { a } = airWith(0, 0);
    const o = { u: 0, v: 0, w: 0 };
    let prevU = 0;
    let prevW = 0;
    let maxDu = 0;
    let maxDw = 0;
    // Steps of 1/120 s at 12 m/s, kilometres from the origin; the eddies grow 1.5 % a step,
    // as the height above a slope falling away from the take-off.
    for (let k = 0, L = 20; k < 200; k++, L *= 1.015) {
      a.turbInto(3000 + 0.1 * k, 2000, 1000 + 0.02 * k, 0, 0.8, 0.6, L, 0.6 * L, 0.3, Math.min(30, 0.3 * L), o);
      if (k) {
        maxDu = Math.max(maxDu, Math.abs(o.u - prevU));
        maxDw = Math.max(maxDw, Math.abs(o.w - prevW));
      }
      prevU = o.u;
      prevW = o.w;
    }
    // σ 0.8 and 0.6 m/s: a step moves the gust by a few hundredths of them, never a new draw.
    expect(maxDu).toBeLessThan(0.12);
    expect(maxDw).toBeLessThan(0.12);
  });
});
