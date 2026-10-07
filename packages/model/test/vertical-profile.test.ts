import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyseTerrain,
  computeTimeContext,
  evalCell,
  makeWindContext,
  newCellResult,
  rasterizeCurated,
  RULES,
  valleyProfile,
  type CuratedBreezeInput,
  type ModelParams,
} from '../src';
import { loadDem } from '../src/node';

const speed = (v: [number, number]) => Math.hypot(v[0], v[1]);

describe('valley-wind vertical profile', () => {
  it('keeps the jet in the lower valley, vanishes at crest height, weak antiwind above', () => {
    expect(valleyProfile(0)).toBe(1);
    expect(valleyProfile(RULES.valleyProfile[0])).toBe(1);
    expect(valleyProfile(0.65)).toBeGreaterThan(0.4);
    expect(valleyProfile(0.65)).toBeLessThan(0.6);
    // Monotonic decrease from the jet to the crest.
    for (let z = 0.3; z < 1; z += 0.05) expect(valleyProfile(z + 0.05)).toBeLessThanOrEqual(valleyProfile(z) + 1e-9);
    expect(Math.abs(valleyProfile(1))).toBeLessThan(0.1);
    // Return flow: opposite sign, much weaker than the valley wind.
    expect(valleyProfile(1.25)).toBeLessThan(-0.05);
    expect(valleyProfile(1.25)).toBeGreaterThanOrEqual(-RULES.valleyAntiwind);
    expect(valleyProfile(2)).toBe(0);
  });
});

describe('Grésivaudan at Saint-Hilaire, 15 July 15:00, no synoptic wind (real DEM)', () => {
  const root = process.cwd();
  const { grid, elevation } = loadDem(root);
  const terrain = analyseTerrain(grid, elevation);
  const atlas = JSON.parse(readFileSync(join(root, 'apps/web/public/data/atlas.json'), 'utf8')) as { curated: CuratedBreezeInput[] };
  const curated = rasterizeCurated(terrain, atlas.curated);
  // Isère in the Grésivaudan below Saint-Hilaire-du-Touvet (floor ~230 m).
  const [x, y] = grid.toGrid(5.94, 45.31);
  const k = Math.floor(y) * grid.width + Math.floor(x);
  const at = (mode: 'agl' | 'asl', meters: number, withCurated: boolean) => {
    const p: ModelParams = { year: 2026, month0: 6, day: 15, hour: 15, synoptic: { fromDeg: 315, speedKmh: 0 }, height: { mode, meters }, breezeScale: 1 };
    return evalCell(k, makeWindContext(terrain, computeTimeContext(terrain, p), p, withCurated ? curated : null), newCellResult());
  };

  it('sees crests near 2000 m around the valley', () => {
    expect(terrain.z[k]).toBeLessThan(300);
    expect(terrain.env[k]).toBeGreaterThan(1800);
    expect(terrain.env[k]).toBeLessThan(2400);
  });

  it('keeps the generic valley breeze at 1500 m and lets it fade above the crests', () => {
    const ground = speed(at('agl', 50, false).valley);
    const mid = speed(at('asl', 1500, false).valley);
    const aloft = speed(at('asl', 2600, false).valley);
    expect(ground).toBeGreaterThan(3);
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(ground);
    expect(aloft).toBeLessThan(0.4 * mid);
  });

  it('keeps the documented breeze (total wind) at 1500 m, weaker above the crests', () => {
    const ground = at('agl', 50, true);
    const mid = at('asl', 1500, true);
    const aloft = at('asl', 2600, true);
    expect(speed(ground.total)).toBeGreaterThan(2.5);
    expect(speed(mid.total)).toBeGreaterThan(1.2);
    expect(speed(aloft.total)).toBeLessThan(speed(mid.total));
    // Same direction as at the ground (no cancellation between documented and generic flows).
    const cos = (mid.total[0] * ground.total[0] + mid.total[1] * ground.total[1]) / (speed(mid.total) * speed(ground.total));
    expect(cos).toBeGreaterThan(0.8);
  });
});
