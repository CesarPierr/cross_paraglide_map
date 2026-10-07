/**
 * Leg-by-leg reading of a cross-country route against the atlas: relaunch
 * thermals met along each leg, hazards nearby, convergences crossed, and the
 * documented breezes active at the simulated hour, read as head, tail or
 * cross wind for that leg. Pure functions (no DOM), cheap enough to run on
 * every change of the route or the hour.
 */
import type { Atlas, AtlasFeature, AtlasFeatureProps } from '@brises/shared';
import { thermalRole } from '../map/modules/schema';

export type LngLat = [number, number];

export interface LegReport {
  from: LngLat;
  to: LngLat;
  fromName?: string;
  toName?: string;
  km: number;
  climbs: AtlasFeatureProps[];
  hazards: AtlasFeatureProps[];
  convergences: AtlasFeatureProps[];
  breezes: { p: AtlasFeatureProps; relation: 'face' | 'dos' | 'travers' }[];
}

const K_LAT = 110.57;
const kx = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

export function distKm(a: LngLat, b: LngLat): number {
  return Math.hypot((a[0] - b[0]) * kx((a[1] + b[1]) / 2), (a[1] - b[1]) * K_LAT);
}

/** Distance from p to the segment ab, in km (local flat projection). */
function toSegmentKm(p: LngLat, a: LngLat, b: LngLat): number {
  const k = kx(p[1]);
  const ax = (a[0] - p[0]) * k;
  const ay = (a[1] - p[1]) * K_LAT;
  const bx = (b[0] - p[0]) * k;
  const by = (b[1] - p[1]) * K_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

const coordsOf = (f: AtlasFeature): LngLat[] => (f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates);

/** Is a [start, end) window (hours, may wrap) active at `hour`? */
function activeAt(p: AtlasFeatureProps, hour: number): boolean {
  if (p.windowStart === undefined || p.windowEnd === undefined) return true;
  return p.windowStart <= p.windowEnd ? hour >= p.windowStart && hour < p.windowEnd : hour >= p.windowStart || hour < p.windowEnd;
}

export function analyseRoute(atlas: Atlas, points: LngLat[], names: string[] = [], hour = 15): LegReport[] {
  const legs: LegReport[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const near = (f: AtlasFeature, km: number) => coordsOf(f).some((c) => toSegmentKm(c, a, b) <= km);
    const climbs = atlas.features.thermals.filter((f) => near(f, 1.5)).map((f) => f.properties);
    // Relaunch points and ceilings first.
    const rank = (p: AtlasFeatureProps) => ({ plafond: 0, relance: 1, déclencheur: 2 })[thermalRole(p.description) ?? ''] ?? 3;
    climbs.sort((x, y) => rank(x) - rank(y));
    const legBearing = Math.atan2((b[0] - a[0]) * kx(a[1]), (b[1] - a[1]) * K_LAT);
    const breezes: LegReport['breezes'] = [];
    for (const f of atlas.features.breezes) {
      if (!activeAt(f.properties, hour) || f.properties.condition) continue;
      const cs = coordsOf(f);
      let best = Infinity;
      let at = 0;
      cs.forEach((c, k) => {
        const d = toSegmentKm(c, a, b);
        if (d < best) {
          best = d;
          at = k;
        }
      });
      if (best > 1.2 || cs.length < 2) continue;
      const c0 = cs[Math.max(0, at - 1)];
      const c1 = cs[Math.min(cs.length - 1, at + 1)];
      const flow = Math.atan2((c1[0] - c0[0]) * kx(c0[1]), (c1[1] - c0[1]) * K_LAT);
      const cos = Math.cos(flow - legBearing);
      breezes.push({ p: f.properties, relation: cos > 0.5 ? 'dos' : cos < -0.5 ? 'face' : 'travers' });
    }
    legs.push({
      from: a,
      to: b,
      fromName: names[i],
      toName: names[i + 1],
      km: distKm(a, b),
      climbs: climbs.slice(0, 4),
      hazards: atlas.features.hazards.filter((f) => near(f, 1.5)).map((f) => f.properties).slice(0, 3),
      convergences: atlas.features.convergences.filter((f) => near(f, 1.5)).map((f) => f.properties).slice(0, 2),
      breezes: breezes.slice(0, 3),
    });
  }
  return legs;
}
