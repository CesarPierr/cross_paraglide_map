import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyseTerrain,
  computeField,
  computeTimeContext,
  conditionFactor,
  curatedActivity,
  evalCell,
  Grid,
  makeWindContext,
  newCellResult,
  rasterizeCurated,
  sunriseSolarHour,
  sunSamples,
  thermalDecline,
  thermalOnset,
  type CuratedBreezeInput,
  type ModelParams,
} from '../src';
import { loadDem } from '../src/node';

/** Synthetic east–west valley draining westwards, ridges north and south (as terrain.test.ts). */
function valleyTerrain() {
  const grid = new Grid({ zoom: 9, tileSize: 256, px0: 67400, py0: 46600, width: 120, height: 80 });
  const z = new Float32Array(grid.size);
  for (let j = 0; j < grid.height; j++)
    for (let i = 0; i < grid.width; i++) {
      const d = Math.abs(j - 40);
      z[j * grid.width + i] = 400 + i * 4 + Math.min(d, 30) ** 1.6 * 9;
    }
  return { grid, terrain: analyseTerrain(grid, z) };
}

const params = (hour: number, extra: Partial<ModelParams> = {}): ModelParams => ({
  year: 2026,
  month0: 6,
  day: 15,
  hour,
  synoptic: { fromDeg: 270, speedKmh: 0 },
  height: { mode: 'agl', meters: 50 },
  breezeScale: 1,
  ...extra,
});

const { grid, terrain } = valleyTerrain();
/** A path along the valley floor (row 40) from column a to column b. */
const path = (a: number, b: number): [number, number][] => {
  const pts: [number, number][] = [];
  for (let s = 0; s <= 10; s++) {
    const i = a + ((b - a) * s) / 10;
    pts.push([grid.colLon(i + 0.5), grid.rowLat(40.5)]);
  }
  return pts;
};
const breeze = (id: string, kind: string, coords: [number, number][], extra: Partial<CuratedBreezeInput> = {}): CuratedBreezeInput => ({
  id,
  name: id,
  kind,
  speedMs: 4,
  window: [11, 19],
  coords,
  radiusM: 1700,
  strength: 1,
  ...extra,
});
const k = 40 * grid.width + 60;
const at = (b: CuratedBreezeInput[], p: ModelParams) => evalCell(k, makeWindContext(terrain, computeTimeContext(terrain, p), p, rasterizeCurated(terrain, b)), newCellResult());

describe('conditional breezes', () => {
  // Regular breeze blowing west (down the drainage) and a heatwave-only one blowing east, same corridor.
  const regular = breeze('regular', 'valley', path(100, 20));
  const heat = breeze('heat', 'valley', path(20, 100), { condition: { label: 'par forte chaleur (canicule)', regime: 'heatwave' }, strength: 0.85 });

  it('only exist when their condition holds', () => {
    expect(conditionFactor(heat.condition!, params(15))).toBe(0);
    expect(conditionFactor(heat.condition!, params(15, { heatwave: true }))).toBe(1);
    expect(curatedActivity(heat, params(15), 1)).toBe(0);
    const lombarde = { label: 'par Lombarde', wind: { fromDeg: 90, minKmh: 10 } };
    expect(conditionFactor(lombarde, params(15, { synoptic: { fromDeg: 100, speedKmh: 20 } }))).toBe(1);
    expect(conditionFactor(lombarde, params(15, { synoptic: { fromDeg: 270, speedKmh: 20 } }))).toBe(0);
    expect(conditionFactor(lombarde, params(15, { synoptic: { fromDeg: 90, speedKmh: 4 } }))).toBe(0);
    expect(conditionFactor({ label: 'en hiver', regime: 'winter' }, params(15, { month0: 0 }))).toBe(1);
  });

  it('take their corridor over without cancelling the regular breeze', () => {
    const normal = at([regular, heat], params(15));
    expect(normal.total[0]).toBeLessThan(-2.5); // westwards, the regular breeze
    const hot = at([regular, heat], params(15, { heatwave: true }));
    expect(hot.total[0]).toBeGreaterThan(2.5); // eastwards, the heatwave breeze, at full strength
  });
});

describe('thin documented layer', () => {
  it('keeps a katabatic flow under the valley breeze and the valley breeze above it', () => {
    const valley = breeze('valley', 'valley', path(100, 20)); // westwards
    const kata = breeze('kata', 'katabatic', path(20, 100), { window: [17, 20.5], speedMs: 2 }); // eastwards
    const low = at([valley, kata], params(18, { height: { mode: 'agl', meters: 30 } }));
    const high = at([valley, kata], params(18, { height: { mode: 'agl', meters: 400 } }));
    expect(low.total[0]).toBeGreaterThan(0.5);
    expect(high.total[0]).toBeLessThan(-1);
  });
});

describe('corridor specificity', () => {
  it('lets a narrow documented breeze keep its corridor inside a wide regional one', () => {
    const regional = breeze('regional', 'plain-to-mountain', path(110, 10), { radiusM: 5000 }); // westwards
    const local = breeze('local', 'valley', path(30, 90), { strength: 0.85 }); // eastwards
    const o = at([regional, local], params(15));
    expect(o.total[0]).toBeGreaterThan(1);
  });
});

describe('thermal onset, face by face', () => {
  /** Sunshine hours since sunrise of a plane slope (aspect, slope in degrees) at 45°N. */
  const sunHoursOf = (hour: number, aspect: number, slope: number) => {
    const s = sunSamples(2026, 6, 15, hour, 45.2, 6.3);
    const a = (aspect * Math.PI) / 180;
    const sl = (slope * Math.PI) / 180;
    const n = [Math.sin(sl) * Math.sin(a), Math.sin(sl) * Math.cos(a), Math.cos(sl)];
    let e = 0;
    for (let i = 0; i < s.length; i += 4) e += s[i + 3] * Math.max(0, n[0] * s[i] + n[1] * s[i + 1] + n[2] * s[i + 2]);
    return e;
  };
  it('samples the sun path from sunrise, in hours of full sun', () => {
    const rise = sunriseSolarHour(6, 15, 45);
    expect(rise).toBeGreaterThan(4);
    expect(rise).toBeLessThan(4.6);
    expect(sunSamples(2026, 6, 15, 5, 45.2, 6.3).length).toBe(0); // before sunrise (legal 5h)
    const flatNoon = sunHoursOf(13.5, 0, 0);
    expect(flatNoon).toBeGreaterThan(3);
    expect(flatNoon).toBeLessThan(7.5); // less than the hours since sunrise
  });
  it('lights east faces first, west faces in the afternoon, flat floors in between', () => {
    const at = (h: number) => [90, 0, 270].map((asp) => thermalOnset(sunHoursOf(h, asp, asp === 0 ? 0 : 30)));
    const [east, flat, west] = at(10.5);
    expect(east).toBeGreaterThan(flat);
    expect(flat).toBeGreaterThan(west);
    expect(west).toBe(0);
    // Saint-Hilaire: calm until ~2 h after sunrise (≈ 8h legal), thermals after 3 h of sun.
    expect(thermalOnset(sunHoursOf(7.5, 90, 30))).toBe(0);
    expect(thermalOnset(sunHoursOf(10.5, 90, 30))).toBeGreaterThan(0.95);
    expect(thermalOnset(sunHoursOf(15, 270, 30))).toBeGreaterThan(0.95);
  });
  it('keeps the afternoon decline', () => {
    expect(thermalDecline(10, 0.5)).toBe(1);
    expect(thermalDecline(18, 0)).toBe(0.5);
  });
  it('is computed per cell by the time context', () => {
    const p = params(14);
    const tc = computeTimeContext(terrain, p);
    // Synthetic valley running east–west: by 14h the south-facing slope (north side,
    // row 30) has had more sun than the north-facing one (row 50); early on a July
    // morning the sun rises in the north-east and the order is reversed.
    expect(tc.sunHours[30 * grid.width + 60]).toBeGreaterThan(tc.sunHours[50 * grid.width + 60]);
    expect(computeTimeContext(terrain, params(5)).sunHours.every((v) => v === 0)).toBe(true);
  });
});

describe('real DEM, 15 July 15:00, no synoptic wind, 80 m above ground', () => {
  const root = process.cwd();
  const dem = loadDem(root);
  const t = analyseTerrain(dem.grid, dem.elevation);
  const atlas = JSON.parse(readFileSync(join(root, 'apps/web/public/data/atlas.json'), 'utf8')) as { curated: CuratedBreezeInput[]; features: { breezes: { properties: { id: string; speedKmh?: number } }[] } };
  const p = params(15, { height: { mode: 'agl', meters: 80 } });
  const ctx = makeWindContext(t, computeTimeContext(t, p), p, rasterizeCurated(t, atlas.curated));

  it('keeps breezes in the documented range (99th percentile ≤ 35 km/h)', () => {
    const f = computeField(ctx).field;
    const sp: number[] = [];
    for (let i = 0; i < dem.grid.size; i += 7) if (t.z[i] > 1 && !t.water[i]) sp.push(Math.hypot(f[i * 4], f[i * 4 + 1]) * 3.6);
    sp.sort((a, b) => a - b);
    expect(sp[Math.floor(0.99 * (sp.length - 1))]).toBeLessThanOrEqual(35);
  });

  it('gives the Maurienne valley breeze its documented speed (×0.5 to ×1.3)', () => {
    const b = atlas.curated.find((x) => x.id === 'maurienne/brise-montante-maurienne');
    const doc = atlas.features.breezes.find((x) => x.properties.id === b?.id)?.properties.speedKmh;
    expect(b && doc).toBeTruthy();
    const vals = b!.coords
      .filter((_, i, a) => i > a.length * 0.1 && i < a.length * 0.9)
      .map(([lon, lat]) => {
        const [x, y] = dem.grid.toGrid(lon, lat);
        const o = evalCell(Math.floor(y) * dem.grid.width + Math.floor(x), ctx, newCellResult());
        return Math.hypot(o.total[0], o.total[1]) * 3.6;
      })
      .sort((a, c) => a - c);
    const med = vals[vals.length >> 1];
    expect(med / doc!).toBeGreaterThanOrEqual(0.5);
    expect(med / doc!).toBeLessThanOrEqual(1.3);
  });
});
