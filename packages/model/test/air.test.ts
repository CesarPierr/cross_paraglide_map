import { describe, expect, it } from 'vitest';
import {
  airFromSounding,
  airWindAt,
  analyseTerrain,
  computeTimeContext,
  convectiveLayer,
  evalCell,
  inversionAbove,
  lclHeight,
  makeWindContext,
  newCellResult,
  packAir,
  packedCeiling,
  packedParcelTop,
  packedTemp,
  packedWind,
  presetAir,
  ridgeLapse,
  RULES,
  stableLayerAbove,
  sunCloudFactor,
  windVector,
  type AirColumn,
  type ModelParams,
} from '../src';
import { loadDem } from '../src/node';

/** A column from (altitude, wind from, km/h, T, Td) rows. */
const col = (rows: [number, number, number, number, number?][], cloud?: number): AirColumn => ({
  levels: rows.map(([z, from, kmh, t, td]) => {
    const [u, v] = windVector(from, kmh / 3.6);
    return { z, u, v, t, td: td ?? null };
  }),
  cloud,
});

describe('air column: interpolation with height', () => {
  const c = col([
    [500, 180, 10, 15],
    [1500, 270, 20, 9],
    [3000, 270, 40, 0],
  ]);
  const p = packAir(c)!;

  it('interpolates the wind vector between levels and holds it beyond them', () => {
    const at = (z: number) => airWindAt(c, z)!;
    expect(at(0).kmh).toBeCloseTo(10, 6);
    expect(at(0).fromDeg).toBeCloseTo(180, 6);
    expect(at(5000).kmh).toBeCloseTo(40, 6);
    expect(at(2250).kmh).toBeCloseTo(30, 6);
    // Veering with height: from S at 500 m to W at 1500 m, SW-ish in between.
    const mid = at(1000);
    expect(mid.fromDeg).toBeGreaterThan(200);
    expect(mid.fromDeg).toBeLessThan(260);
    // Vector interpolation (not of speeds): the half-way vector of 10 km/h S and 20 km/h W.
    const [u, v] = packedWind(p, 1000);
    expect(u).toBeCloseTo((windVector(180, 10 / 3.6)[0] + windVector(270, 20 / 3.6)[0]) / 2, 6);
    expect(v).toBeCloseTo((windVector(180, 10 / 3.6)[1] + windVector(270, 20 / 3.6)[1]) / 2, 6);
  });

  it('extrapolates the temperature with the end layers, lapse rates clamped', () => {
    expect(packedTemp(p, 1000)).toBeCloseTo(12, 6);
    // Below: the lowest layer (6 K/km).
    expect(packedTemp(p, 0)).toBeCloseTo(18, 6);
    // Above: the highest layer (6 K/km), within [0, dry].
    expect(packedTemp(p, 4000)).toBeCloseTo(-6, 6);
    const inverted = packAir(col([[500, 0, 0, 0], [1000, 0, 0, 10], [2000, 0, 0, 4]]))!;
    // A lowest layer warming by 20 K/km is extrapolated downwards at most at −5 K/km.
    expect(packedTemp(inverted, 0)).toBeCloseTo(0 - (RULES.air.extrapLapse[0] / 1000) * -500, 6);
  });

  it('reads the 850–700 hPa stability between 1500 and 3000 m', () => {
    expect(ridgeLapse(c)).toBeCloseTo(6, 6);
  });
});

describe('air column: inversion and convective layer', () => {
  // A stable morning over Grenoble: cold air in the valley under an inversion at 1400 m.
  const morning = col([
    [400, 200, 3, 6, 4],
    [1000, 200, 4, 5, 2],
    [1400, 320, 15, 4.5, 0],
    [1700, 320, 22, 8, -4],
    [3000, 315, 25, 0, -12],
  ]);

  it('finds the inversion and the stable layers above the ground', () => {
    const inv = inversionAbove(morning, 300)!;
    expect(inv.base).toBe(1400);
    expect(inv.top).toBe(1700);
    expect(inv.strengthK).toBeCloseTo(3.5, 6);
    // The whole valley layer is stable (≤ 3 K/km) from the ground.
    const st = stableLayerAbove(morning, 300)!;
    expect(st.base).toBe(400);
    expect(st.top).toBe(1700);
    // Above the inversion, none.
    expect(inversionAbove(morning, 1800)).toBeNull();
  });

  it('stops the thermals under the inversion', () => {
    const p = packAir(morning)!;
    const top = packedParcelTop(p, 300);
    expect(top).toBeLessThan(1000);
    expect(top).toBeGreaterThan(300);
    const cl = convectiveLayer(morning, 300)!;
    expect(cl.cloudBase).toBeNull(); // the dry thermals stop below their condensation level
    expect(cl.ceiling).toBeCloseTo(top, 6);
  });

  it('puts the cumulus base at the condensation level (Espy) when the thermals reach it', () => {
    expect(lclHeight(25, 9)).toBe(2000);
    // Mixed (dry adiabatic) layer to 3000 m, then stable: thermals to ≈ 3000 m, base at 300 + 125 × 18.
    const summer = col([
      [300, 315, 10, 28, 10],
      [3000, 315, 15, 28 - 9.8 * 2.7, 10 - 1.8 * 2.7],
      [3200, 315, 15, 28 - 9.8 * 2.7 + 0.5, -10],
      [5500, 315, 30, -20, -40],
    ]);
    const cl = convectiveLayer(summer, 300)!;
    expect(cl.dryTop).toBeGreaterThan(3000);
    expect(cl.cloudBase).toBeCloseTo(300 + 125 * 18, 6);
    expect(cl.ceiling).toBe(cl.cloudBase);
    expect(cl.cumulusTop!).toBeGreaterThan(cl.cloudBase!);
    expect(packedCeiling(packAir(summer)!, 300)).toBeCloseTo(cl.ceiling, 6);
  });

  it('dims the sunshine under a cloud cover (Kasten & Czeplak)', () => {
    expect(sunCloudFactor(undefined)).toBe(1);
    expect(sunCloudFactor(0)).toBe(1);
    expect(sunCloudFactor(1)).toBeCloseTo(0.25, 6);
    expect(sunCloudFactor(0.3)).toBeGreaterThan(0.95);
  });

  it('converts a forecast sounding (km/h, pressure levels)', () => {
    const a = airFromSounding([
      { pressure: 850, heightM: 1500, temperature: 8, dewpoint: 2, windFromDeg: 315, windKmh: 20 },
      { pressure: 700, heightM: 3100, temperature: -2, windFromDeg: 315, windKmh: 30 },
    ])!;
    expect(airWindAt(a, 1500)!.kmh).toBeCloseTo(20, 6);
    expect(airWindAt(a, 1500)!.fromDeg).toBeCloseTo(315, 6);
    // The missing dew point keeps the spread of its neighbour.
    expect(packAir(a)!.td[1]).toBeCloseTo(-8, 6);
    expect(airFromSounding([])).toBeNull();
  });
});

describe('manual presets', () => {
  it('standard without inversion is the reference day: no layers', () => {
    expect(presetAir({ stability: 'standard', fromDeg: 315, kmh: 10, month0: 6 })).toEqual({});
  });

  it('unstable summer day: cumulus base near 2800 m, ceiling below the mixed-layer top', () => {
    const { air, lapseRate } = presetAir({ stability: 'instable', fromDeg: 315, kmh: 10, month0: 6 });
    expect(lapseRate).toBeGreaterThan(7);
    const cl = convectiveLayer(air!, 300)!;
    expect(cl.cloudBase).not.toBeNull();
    expect(cl.cloudBase!).toBeGreaterThan(2600);
    expect(cl.cloudBase!).toBeLessThan(3000);
    // The same base from a higher ground in the mixed layer (constant mixing ratio).
    expect(Math.abs(convectiveLayer(air!, 1200)!.cloudBase! - cl.cloudBase!)).toBeLessThan(100);
  });

  it('stable blue day: no cumulus, low ceiling', () => {
    const { air, lapseRate } = presetAir({ stability: 'stable', fromDeg: 0, kmh: 5, month0: 6 });
    expect(lapseRate).toBeLessThan(5);
    const cl = convectiveLayer(air!, 300)!;
    expect(cl.cloudBase).toBeNull();
    expect(cl.ceiling).toBeGreaterThan(1500);
    expect(cl.ceiling).toBeLessThan(1900);
  });

  it('an inversion caps the thermals at its altitude and shelters the air below it', () => {
    const { air } = presetAir({ stability: 'standard', inversionM: 1400, fromDeg: 315, kmh: 25, month0: 0 });
    expect(convectiveLayer(air!, 300)!.ceiling).toBeLessThan(1500);
    expect(inversionAbove(air!, 300)!.base).toBe(1400);
    expect(airWindAt(air!, 800)!.kmh).toBeCloseTo(25 * RULES.air.shelteredWind, 6);
    expect(airWindAt(air!, 2000)!.kmh).toBeCloseTo(25, 6);
  });
});

describe('layered air in the model (real DEM, Grésivaudan at Saint-Hilaire)', () => {
  const { grid, elevation, landcover } = loadDem(process.cwd());
  const terrain = analyseTerrain(grid, elevation, landcover);
  const [x, y] = grid.toGrid(5.94, 45.31);
  const k = Math.floor(y) * grid.width + Math.floor(x);
  const run = (p: ModelParams) => evalCell(k, makeWindContext(terrain, computeTimeContext(terrain, p), p, null), newCellResult());
  const base = (hour: number, height: ModelParams['height'], air?: AirColumn): ModelParams => ({
    year: 2026,
    month0: 6,
    day: 15,
    hour,
    synoptic: { fromDeg: 315, speedKmh: 25 },
    height,
    breezeScale: 1,
    air,
  });

  it('a uniform wind with a deep convective layer and a clear sky changes nothing', () => {
    const deep = col([
      [0, 315, 25, 30, 0],
      [9000, 315, 25, 30 - 9.8 * 9 - 2, -20],
    ]);
    const a = run(base(14, { mode: 'agl', meters: 80 }));
    const b = run(base(14, { mode: 'agl', meters: 80 }, deep));
    expect(b.total[0]).toBeCloseTo(a.total[0], 9);
    expect(b.total[1]).toBeCloseTo(a.total[1], 9);
    expect(b.thermal).toBeGreaterThan(0);
    // The depth of the convective layer (w*) only scales the thermals, within depthMax.
    expect(b.thermal / a.thermal).toBeLessThanOrEqual(RULES.air.depthMax + 1e-9);
    expect(b.lee).toBeCloseTo(a.lee, 9);
  });

  it('an inversion-capped valley stays sheltered from the wind aloft', () => {
    // 9 h: calm valley under an inversion at 1400 m, 25 km/h NW at the crests.
    const morning = col([
      [200, 200, 3, 9, 6],
      [1000, 200, 4, 7, 3],
      [1400, 315, 8, 6.5, 0],
      [1700, 315, 25, 10, -4],
      [3000, 315, 25, 2, -12],
    ]);
    const floor = run(base(9, { mode: 'agl', meters: 80 }, morning));
    const floorUniform = run(base(9, { mode: 'agl', meters: 80 }));
    const crestLevel = run(base(9, { mode: 'asl', meters: 2200 }, morning));
    const sp = (v: [number, number]) => Math.hypot(v[0], v[1]) * 3.6;
    expect(sp(floor.airWind)).toBeLessThan(5);
    expect(sp(floor.synoptic)).toBeLessThan(sp(floorUniform.synoptic) / 3);
    expect(sp(crestLevel.airWind)).toBeCloseTo(25, 3);
    // The thermal ceiling of the valley floor is under the inversion.
    expect(floor.ceilingM).toBeLessThan(1400);
  });

  it('thermals stop at the ceiling and breezes fade above it by day', () => {
    const low = col([
      [200, 0, 0, 28, 8],
      [1100, 0, 0, 28 - 9.8 * 0.9, 8 - 1.6],
      [1300, 0, 0, 28 - 9.8 * 0.9 + 2, -5],
      [5000, 0, 0, -10, -40],
    ]);
    const atGround = run(base(15, { mode: 'agl', meters: 80 }, low));
    expect(atGround.thermal).toBeGreaterThan(0);
    expect(atGround.ceilingM).toBeGreaterThan(1000);
    expect(atGround.ceilingM).toBeLessThan(1350);
    const p0: ModelParams = { ...base(15, { mode: 'asl', meters: 1700 }), synoptic: { fromDeg: 315, speedKmh: 0 } };
    const free = run(p0);
    const capped = run({ ...p0, air: low });
    expect(capped.thermal).toBe(0);
    expect(Math.hypot(capped.breeze[0], capped.breeze[1])).toBeLessThan(0.2 * Math.hypot(free.breeze[0], free.breeze[1]) + 0.05);
  });

  it('an overcast sky weakens the thermals and the breezes', () => {
    const rows: [number, number, number, number, number][] = [
      [0, 0, 0, 30, 0],
      [9000, 0, 0, 30 - 9.8 * 9 - 2, -20],
    ];
    const p = { ...base(14, { mode: 'agl', meters: 80 }), synoptic: { fromDeg: 0, speedKmh: 0 } };
    const clear = run({ ...p, air: col(rows, 0) });
    const overcast = run({ ...p, air: col(rows, 1) });
    expect(overcast.thermal).toBeLessThan(0.4 * clear.thermal);
    expect(Math.hypot(...overcast.valley)).toBeLessThan(0.4 * Math.hypot(...clear.valley));
  });
});
