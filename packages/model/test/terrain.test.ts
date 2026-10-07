import { describe, expect, it } from 'vitest';
import { analyseTerrain, computeField, computeTimeContext, evalCell, makeWindContext, newCellResult, Grid, type ModelParams } from '../src';

/** Synthetic east–west valley draining westwards, ridges north and south. */
function valleyTerrain() {
  const grid = new Grid({ zoom: 9, tileSize: 256, px0: 67400, py0: 46600, width: 120, height: 80 });
  const z = new Float32Array(grid.size);
  for (let j = 0; j < grid.height; j++)
    for (let i = 0; i < grid.width; i++) {
      const d = Math.abs(j - 40); // distance to the valley axis (cells)
      z[j * grid.width + i] = 400 + i * 4 + Math.min(d, 30) ** 1.6 * 9;
    }
  return { grid, terrain: analyseTerrain(grid, z) };
}

const params = (hour: number, wind = 0, from = 270): ModelParams => ({
  year: 2026,
  month0: 6,
  day: 15,
  hour,
  synoptic: { fromDeg: from, speedKmh: wind },
  height: { mode: 'agl', meters: 50 },
  breezeScale: 1,
});

describe('terrain analysis', () => {
  const { grid, terrain } = valleyTerrain();
  it('finds the valley axis pointing down-valley (west)', () => {
    const k = 40 * grid.width + 60;
    expect(terrain.axisX[k]).toBeLessThan(-0.8);
    expect(terrain.valley[k]).toBeGreaterThan(0.1);
  });

  it('blows up-valley in the afternoon and down-valley at night', () => {
    const k = 40 * grid.width + 60;
    const day = evalCell(k, makeWindContext(terrain, computeTimeContext(terrain, params(15)), params(15), null), newCellResult());
    const night = evalCell(k, makeWindContext(terrain, computeTimeContext(terrain, params(2)), params(2), null), newCellResult());
    expect(day.valley[0]).toBeGreaterThan(0.5); // eastwards = up-valley
    expect(night.valley[0]).toBeLessThan(0);
  });

  it('puts the lee side of a ridge in shelter under synoptic wind', () => {
    const p = params(15, 30, 0); // north wind
    const ctx = makeWindContext(terrain, computeTimeContext(terrain, p), p, null);
    // South side of the northern ridge, close to its crest: sheltered from the north.
    const lee = evalCell(22 * grid.width + 60, ctx, newCellResult());
    // North face of the northern ridge (windward).
    const windward = evalCell(4 * grid.width + 60, ctx, newCellResult());
    expect(lee.lee).toBeGreaterThan(windward.lee);
    const field = computeField(ctx);
    expect(field.field.length).toBe(grid.size * 4);
  });
});
