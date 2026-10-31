import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER, ensureImportance, importanceContext, importanceScore, rankFeatures, TIER1_MAX, TIER1_RADIUS_M, TIER3_RADIUS_M } from '../src/importance';
import type { AtlasFeature, AtlasFeatureProps, FeatureCategory } from '../src/atlas';

let n = 0;
/** A point `dx` metres east of a fixed origin (45° N). */
function pt(category: FeatureCategory, dx: number, props: Partial<AtlasFeatureProps> = {}): AtlasFeature {
  n++;
  const lon = 6 + dx / (111320 * Math.cos((45 * Math.PI) / 180));
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, 45] },
    properties: { id: props.id ?? `m/${category}-${n}`, category, massif: 'm', name: `Item ${n}`, description: '', sources: 'a:S1,a:S2', confidence: 'medium', ...props },
  };
}
function line(category: FeatureCategory, km: number, props: Partial<AtlasFeatureProps> = {}): AtlasFeature {
  n++;
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[6, 45.2], [6 + km / 78.7, 45.2]] },
    properties: { id: props.id ?? `m/${category}-${n}`, category, massif: 'm', name: `Line ${n}`, description: '', sources: 'a:S1,a:S2', confidence: 'medium', ...props },
  };
}

describe('importance ranking', () => {
  it('is deterministic whatever the input order', () => {
    const fs = [line('breezes', 20), line('breezes', 8), pt('hazards', 0), pt('takeoffs', 5000), pt('thermals', 10000), pt('landings', 15000), pt('soaring', 20000)];
    const a = rankFeatures(fs);
    const b = rankFeatures([...fs].reverse());
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
  });

  it('ranks the structure first: breezes and hazards before landings, sourced before deduced', () => {
    const ctx = importanceContext();
    expect(importanceScore(line('breezes', 10), ctx)).toBeGreaterThan(importanceScore(pt('landings', 0), ctx));
    expect(importanceScore(pt('hazards', 0), ctx)).toBeGreaterThan(importanceScore(pt('thermals', 0), ctx));
    expect(importanceScore(pt('takeoffs', 0, { confidence: 'high' }), ctx)).toBeGreaterThan(importanceScore(pt('takeoffs', 0, { confidence: 'low' }), ctx));
    expect(importanceScore(pt('hazards', 0, { sources: 'a:S1,a:S2,a:S3,a:S4,a:S5' }), ctx)).toBeGreaterThan(importanceScore(pt('hazards', 0, { sources: 'a:S1' }), ctx));
    expect(CATEGORY_ORDER.slice(0, 3)).toEqual(['breezes', 'convergences', 'hazards']);
  });

  it('counts a guided-visit citation and the summary', () => {
    const cited = pt('takeoffs', 0, { id: 'm/cited', name: 'Saint-Hilaire Sud' });
    const plain = pt('takeoffs', 0, { id: 'm/plain', name: 'Autre décollage' });
    const ctx = importanceContext({ tours: { m: [{ chapter: '', title: '', text: '', features: ['m/cited'], sources: [] }] } });
    expect(importanceScore(cited, ctx)).toBeGreaterThan(importanceScore(plain, ctx));
    const sum = importanceContext({ summaries: { m: 'Le décollage de Saint-Hilaire Sud regarde l’est.' } });
    expect(importanceScore(cited, sum)).toBeGreaterThan(importanceScore(cited, importanceContext()));
  });

  it('keeps at most TIER1_MAX essentials per sector, varied, sourced', () => {
    const fs = [
      ...Array.from({ length: 6 }, () => line('breezes', 30, { confidence: 'high' })),
      ...Array.from({ length: 6 }, (_, i) => pt('hazards', i * 10000, { confidence: 'high' })),
      ...Array.from({ length: 6 }, (_, i) => pt('takeoffs', 5000 + i * 10000)),
      pt('soaring', 200000),
      line('breezes', 50, { confidence: 'low' }),
    ];
    const r = rankFeatures(fs);
    const t1 = fs.filter((f) => r.get(f.properties.id)!.tier === 1);
    expect(t1.length).toBeLessThanOrEqual(TIER1_MAX);
    expect(t1.length).toBeGreaterThanOrEqual(3);
    expect(t1.filter((f) => f.properties.category === 'breezes').length).toBeLessThanOrEqual(2);
    expect(t1.some((f) => f.properties.confidence === 'low')).toBe(false);
    // Thermals and landings are never essentials.
    const r2 = rankFeatures([pt('thermals', 0, { confidence: 'high' }), pt('landings', 9000)]);
    expect([...r2.values()].every((x) => x.tier === 2)).toBe(true);
  });

  it('density: two essentials are never closer than TIER1_RADIUS_M, the best one wins', () => {
    const best = pt('hazards', 0, { confidence: 'high', sources: 'a:S1,a:S2,a:S3,a:S4' });
    const near = pt('takeoffs', TIER1_RADIUS_M / 2, { confidence: 'high' });
    const far = pt('takeoffs', TIER1_RADIUS_M * 2, { confidence: 'high' });
    const r = rankFeatures([near, far, best]);
    expect(r.get(best.properties.id)!.tier).toBe(1);
    expect(r.get(near.properties.id)!.tier).toBe(2);
    expect(r.get(far.properties.id)!.tier).toBe(1);
  });

  it('density: a point on top of a better one of its category is detail', () => {
    const a = pt('landings', 0, { sources: 'a:S1,a:S2,a:S3' });
    const b = pt('landings', TIER3_RADIUS_M / 3, { sources: 'a:S1' });
    const c = pt('landings', TIER3_RADIUS_M * 3, { sources: 'a:S1' });
    const r = rankFeatures([a, b, c]);
    expect(r.get(a.properties.id)!.tier).toBe(2);
    expect(r.get(b.properties.id)!.tier).toBe(3);
    expect(r.get(c.properties.id)!.tier).toBe(2);
  });

  it('puts measured-only hotspots and uncited low-confidence points in the detail, never lines', () => {
    const kk7 = pt('thermals', 0, { origin: 'kk7', kk7P: 0.9, confidence: undefined });
    const low = pt('thermals', 5000, { confidence: 'low' });
    const lowCited = pt('thermals', 10000, { confidence: 'low', id: 'm/low-cited' });
    const deduced = line('breezes', 10, { confidence: 'low' });
    const r = rankFeatures([kk7, low, lowCited, deduced], { tours: { m: [{ chapter: '', title: '', text: '', features: ['m/low-cited'], sources: [] }] } });
    expect(r.get(kk7.properties.id)!.tier).toBe(3);
    expect(r.get(low.properties.id)!.tier).toBe(3);
    expect(r.get(lowCited.properties.id)!.tier).toBe(2);
    expect(r.get(deduced.properties.id)!.tier).toBe(2);
  });

  it('ranks sector by sector', () => {
    const a = pt('hazards', 0, { massif: 'a', confidence: 'high' });
    const b = pt('hazards', 100, { massif: 'b', confidence: 'high' });
    const r = rankFeatures([a, b]);
    expect(r.get(a.properties.id)!.tier).toBe(1);
    expect(r.get(b.properties.id)!.tier).toBe(1);
  });

  it('ranks an older atlas at load, once', () => {
    const atlas = { features: { breezes: [line('breezes', 10)], convergences: [], hazards: [pt('hazards', 0)], thermals: [], soaring: [], takeoffs: [], landings: [], routes: [] } as Record<FeatureCategory, AtlasFeature[]> };
    ensureImportance(atlas);
    expect(atlas.features.hazards[0].properties.tier).toBe(1);
    atlas.features.hazards[0].properties.tier = 3;
    ensureImportance(atlas);
    expect(atlas.features.hazards[0].properties.tier).toBe(3);
  });
});
