import { describe, expect, it } from 'vitest';
import { maxTierAt, shownAtMassifScale, zoomForTier } from '../src/map/tiers';

describe('progressive disclosure of the atlas tiers', () => {
  it('shows only the essentials at massif scale, the rest closer in', () => {
    expect(maxTierAt(9.7, 'essentiel')).toBe(1);
    expect(maxTierAt(11.2, 'essentiel')).toBe(2);
    expect(maxTierAt(12.6, 'essentiel')).toBe(3);
    expect(maxTierAt(9.7, 'detaille')).toBe(2);
    expect(maxTierAt(11.6, 'detaille')).toBe(3);
    expect(maxTierAt(7, 'tout')).toBe(3);
  });

  it('delays the secondary on a phone, never the essentials', () => {
    expect(maxTierAt(11.2, 'essentiel', true)).toBe(1);
    expect(maxTierAt(11.6, 'essentiel', true)).toBe(2);
    expect(zoomForTier(1, 'essentiel', true)).toBe(0);
    expect(zoomForTier(3, 'essentiel')).toBe(12.5);
  });

  it('a bubble opens to the zoom where its thermals show', () => {
    for (const r of ['essentiel', 'detaille', 'tout'] as const) for (const t of [2, 3]) expect(maxTierAt(zoomForTier(t, r), r)).toBeGreaterThanOrEqual(t);
  });

  it('counts what the map shows of a category at massif scale', () => {
    const tiers = [1, 2, 2, 3, undefined];
    expect(shownAtMassifScale(tiers, 'essentiel', false)).toBe(1);
    expect(shownAtMassifScale(tiers, 'detaille', false)).toBe(4);
    expect(shownAtMassifScale(tiers, 'tout', false)).toBe(5);
    expect(shownAtMassifScale(tiers, 'essentiel', true)).toBe(5);
  });
});
