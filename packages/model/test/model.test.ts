import { describe, expect, it } from 'vitest';
import { Grid, legalTimeToUtc, sunPosition, windFromDeg, windowActivity, windVector, franceUtcOffset, compassFr } from '../src';
import { smoothstep, blur, extremumFilter } from '../src/raster';

describe('sun', () => {
  it('reaches ~68° at solar noon in July at 45°N', () => {
    const utc = legalTimeToUtc(2026, 6, 15, 13.6);
    const s = sunPosition(utc, 45, 6.3);
    expect(s.elevation).toBeGreaterThan(65);
    expect(s.elevation).toBeLessThan(70);
    expect(Math.abs(s.azimuth - 180)).toBeLessThan(12);
  });
  it('is below the horizon at night and in the west in the evening', () => {
    expect(sunPosition(legalTimeToUtc(2026, 6, 15, 23), 45, 6.3).elevation).toBeLessThan(0);
    const ev = sunPosition(legalTimeToUtc(2026, 6, 15, 19), 45, 6.3);
    expect(ev.azimuth).toBeGreaterThan(260);
  });
  it('knows French summer time', () => {
    expect(franceUtcOffset(2026, 6, 15)).toBe(2);
    expect(franceUtcOffset(2026, 0, 15)).toBe(1);
  });
});

describe('wind conventions', () => {
  it('round-trips meteorological directions', () => {
    for (const d of [0, 45, 90, 225, 315]) {
      const [u, v] = windVector(d, 10);
      expect(windFromDeg(u, v)).toBeCloseTo(d, 5);
    }
    // A north wind blows towards the south.
    expect(windVector(0, 10)[1]).toBeLessThan(0);
    expect(compassFr(270)).toBe('O');
  });
});

describe('breeze windows', () => {
  it('is fully active inside the window and off outside', () => {
    expect(windowActivity(15, [11, 19])).toBe(1);
    expect(windowActivity(8, [11, 19])).toBe(0);
  });
  it('handles windows across midnight (night breezes)', () => {
    expect(windowActivity(2, [20.5, 9.5])).toBe(1);
    expect(windowActivity(15, [20.5, 9.5])).toBe(0);
  });
});

describe('grid', () => {
  const grid = new Grid({ zoom: 9, tileSize: 256, px0: 67301, py0: 46367, width: 1094, height: 1521 });
  it('maps lon/lat to cells and back', () => {
    const [x, y] = grid.toGrid(5.7245, 45.1885);
    expect(grid.colLon(x)).toBeCloseTo(5.7245, 6);
    expect(grid.rowLat(y)).toBeCloseTo(45.1885, 6);
    expect(grid.contains(5.72, 45.19)).toBe(true);
    expect(grid.contains(2, 45)).toBe(false);
  });
  it('has ~216 m cells at 45°N', () => {
    const j = Math.round(grid.toGrid(6, 45)[1]);
    expect(grid.cellM[j]).toBeGreaterThan(205);
    expect(grid.cellM[j]).toBeLessThan(225);
  });
});

describe('raster', () => {
  it('blurs preserving the mean and filters extrema', () => {
    const w = 20;
    const h = 20;
    const f = new Float32Array(w * h);
    f[10 * w + 10] = 100;
    const b = blur(f, w, h, 3);
    const sum = b.reduce((a, x) => a + x, 0);
    expect(sum).toBeCloseTo(100, 0);
    const m = extremumFilter(f, w, h, 2, true);
    expect(m[10 * w + 12]).toBe(100);
    expect(m[10 * w + 13]).toBe(0);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});
