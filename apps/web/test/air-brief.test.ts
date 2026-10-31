import { presetAir, windVector, type AirColumn, type ModelParams } from '@brises/model';
import type { Atlas, SynopticWind } from '@brises/shared';
import { describe, expect, it } from 'vitest';
import { airAtAltitude, airSynthesis, forecastAir, forecastCloud, happeningNow, morningInversion, stabilityWord } from '../src/ui/air-brief';

/** French number formatting uses narrow no-break spaces: compare on plain spaces. */
const plain = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ');

const level = (pressure: number, heightM: number, temperature: number, dewpoint: number, windFromDeg: number, windKmh: number) => ({ pressure, heightM, temperature, dewpoint, windFromDeg, windKmh });

/** A stable morning over Grenoble: cold valley under an inversion at 1400 m, NW 25 km/h aloft. */
const morning: SynopticWind = {
  time: '2026-10-30T09:00',
  hour: 9,
  fromDeg: 315,
  speedKmh: 20,
  lapseRate: 4.2,
  cloudCoverLow: 0,
  cloudCoverMid: 0,
  profile: [level(950, 550, 4, 2, 180, 3), level(900, 1000, 3, 0, 200, 5), level(850, 1400, 2.5, -2, 300, 12), level(800, 1700, 6, -8, 315, 25), level(700, 3100, -2, -15, 315, 25), level(500, 5700, -20, -35, 300, 40)],
};

describe('air synthesis line', () => {
  it('reads a stable morning inversion over Grenoble', () => {
    const air = forecastAir(morning)!;
    const line = plain(airSynthesis({ air, lapseRate: 4.2, groundM: 220, ridge: { fromDeg: 315, kmh: 25 } }));
    expect(line).toMatch(/^Stable, /);
    expect(line).toContain('NO 25 km/h aux crêtes');
    expect(line).toContain('inversion 1 400 m');
  });

  it('reads an unstable afternoon with cumulus and recalls the morning inversion', () => {
    const { air, lapseRate } = presetAir({ stability: 'instable', fromDeg: 315, kmh: 20, month0: 6 });
    const line = plain(airSynthesis({ air: air!, lapseRate: lapseRate!, groundM: 300, ridge: { fromDeg: 315, kmh: 20 }, morning: { base: 1400, hour: 9 } }));
    expect(line).toBe('Instable, base 2 800 m, NO 20 km/h aux crêtes, inversion 1 400 m à 9 h');
  });

  it('says blue thermals under a stable lid, overcast skies, and the reference day', () => {
    const { air, lapseRate } = presetAir({ stability: 'stable', fromDeg: 0, kmh: 5, month0: 6 });
    expect(plain(airSynthesis({ air: air!, lapseRate: lapseRate!, groundM: 300, ridge: { fromDeg: 0, kmh: 5 } }))).toBe('Stable, thermiques bleus jusqu’à 1 700 m, N 5 km/h aux crêtes, inversion 1 600 m');
    const grey: AirColumn = { ...air!, cloud: 0.9 };
    expect(airSynthesis({ air: grey, lapseRate: 4.5, groundM: 300, ridge: { fromDeg: 0, kmh: 0 } })).toContain('ciel couvert');
    expect(airSynthesis({ air: null, lapseRate: null, groundM: 300, ridge: { fromDeg: 0, kmh: 0 } })).toBe('Standard, vent calme aux crêtes');
  });

  it('words the stability like a briefing', () => {
    expect(stabilityWord(2)).toBe('Très stable');
    expect(stabilityWord(6.5)).toBe('Standard');
    expect(stabilityWord(7.5)).toBe('Instable');
    expect(stabilityWord(9)).toBe('Très instable');
  });

  it('finds the morning inversion of the forecast day', () => {
    const noon = { ...morning, time: '2026-10-30T13:00', hour: 13 };
    expect(morningInversion([morning, noon], '2026-10-30', 220)).toEqual({ base: 1400, hour: 9 });
    expect(morningInversion([noon], '2026-10-30', 220)).toBeNull();
  });

  it('combines the low and mid clouds', () => {
    expect(forecastCloud({ cloudCoverLow: 50, cloudCoverMid: 50 })).toBeCloseTo(0.75, 6);
    expect(forecastCloud({})).toBeUndefined();
  });
});

describe('the air at the pilot’s altitude', () => {
  it('gives the wind of the layer, its lapse rate and the distance to the ceiling', () => {
    const air = forecastAir(morning)!;
    const a = airAtAltitude(air, 1550, 220)!;
    expect(a.wind.kmh).toBeGreaterThan(12);
    expect(a.wind.kmh).toBeLessThan(25);
    expect(a.layer).toBe('inversion');
    expect(a.toCeiling).toBeLessThan(0);
    const below = airAtAltitude(air, 700, 220)!;
    expect(below.inversion).toBe(1400);
  });
});

describe('what happens now in the view', () => {
  const atlas = {
    curated: [
      { id: 'm/breeze', name: 'Brise du Grésivaudan', kind: 'valley', speedMs: 4, window: [11, 19], coords: [[5.9, 45.3]], radiusM: 800, strength: 1 },
      { id: 'm/far', name: 'Brise lointaine', kind: 'valley', speedMs: 4, window: [11, 19], coords: [[7.5, 44.0]], radiusM: 800, strength: 1 },
      { id: 'm/bise', name: 'Brise par bise', kind: 'valley', speedMs: 5, window: null, condition: { label: 'par bise', wind: { fromDeg: 45, minKmh: 15 } }, coords: [[5.92, 45.3]], radiusM: 800, strength: 1 },
    ],
    curatedHazards: [{ id: 'm/rotor#0', name: 'Rotors par nord', effect: 'lee', coords: [[5.95, 45.32]], radiusM: 500, fromDeg: 0, tolDeg: 45, minKmh: 10, fullKmh: 18 }],
    features: { convergences: [] },
  } as unknown as Atlas;
  const box: [number, number, number, number] = [5.7, 45.1, 6.1, 45.5];
  const params = (fromDeg: number, kmh: number, hour = 15): ModelParams => ({ year: 2026, month0: 6, day: 15, hour, synoptic: { fromDeg, speedKmh: kmh }, height: { mode: 'agl', meters: 80 }, breezeScale: 1 });

  it('lists the breezes of the hour in the view, not the others', () => {
    const items = happeningNow(atlas, params(315, 5), 1, box);
    expect(items.map((i) => i.id)).toEqual(['m/breeze']);
  });

  it('puts the documented hazards of the wind first, and the conditional breeze of its wind', () => {
    const items = happeningNow(atlas, params(10, 20), 1, box);
    expect(items[0].id).toBe('m/rotor');
    expect(happeningNow(atlas, params(45, 25), 1, box).map((i) => i.id)).toContain('m/bise');
  });

  it('drops the thermal breezes under an overcast sky', () => {
    const [u, v] = windVector(315, 1);
    const grey: AirColumn = { levels: [{ z: 0, u, v, t: 20 }, { z: 5000, u, v, t: -10 }], cloud: 1 };
    expect(happeningNow(atlas, { ...params(315, 5), air: grey }, 1, box)).toEqual([]);
  });
});
