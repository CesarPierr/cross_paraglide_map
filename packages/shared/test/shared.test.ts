import { describe, expect, it } from 'vitest';
import { dewpoint, estimateThermals, parseOrientations, type ProfileLevel } from '../src';

describe('orientations', () => {
  it('normalises directory notations to French sectors', () => {
    expect(parseOrientations('NW;N')).toEqual(['NO', 'N']);
    expect(parseOrientations('sud-ouest, O')).toEqual(expect.arrayContaining(['SO', 'O']));
    expect(parseOrientations(undefined)).toEqual([]);
  });
});

describe('dew point', () => {
  it('equals temperature at saturation and is lower when dry', () => {
    expect(dewpoint(20, 100)).toBeCloseTo(20, 1);
    expect(dewpoint(25, 40)).toBeCloseTo(10.5, 0);
  });
});

describe('thermal estimate', () => {
  // Standard-ish summer sounding over a 1000 m valley.
  const profile: ProfileLevel[] = [
    { pressure: 850, heightM: 1500, temperature: 18, windFromDeg: 300, windKmh: 10 },
    { pressure: 750, heightM: 2550, temperature: 10, windFromDeg: 300, windKmh: 15 },
    { pressure: 700, heightM: 3150, temperature: 5, windFromDeg: 290, windKmh: 20 },
    { pressure: 600, heightM: 4400, temperature: -4, windFromDeg: 280, windKmh: 25 },
    { pressure: 500, heightM: 5800, temperature: -15, windFromDeg: 270, windKmh: 35 },
  ];
  it('finds a cumulus base from the dew-point spread', () => {
    const e = estimateThermals(profile, { elevationM: 1000, temperature: 25, dewpoint: 10, month0: 6 });
    expect(e.cumulus).toBe(true);
    expect(e.cloudBaseM).toBe(1000 + 125 * 15);
    expect(e.climb).toBeGreaterThan(1);
  });
  it('caps blue thermals under an inversion', () => {
    const inversion = profile.map((p) => (p.heightM === 2550 ? { ...p, temperature: 16 } : p));
    const e = estimateThermals(inversion, { elevationM: 1000, temperature: 25, dewpoint: 0, month0: 6 });
    expect(e.cumulus).toBe(false);
    expect(e.thermalTopM).toBeLessThan(2600);
  });
});
