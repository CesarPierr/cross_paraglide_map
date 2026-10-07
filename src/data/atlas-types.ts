/** Types of the compiled research atlas (public/data/atlas.json), produced by scripts/build-data.ts. */
import type { CuratedBreezeInput } from '../model/curated';

export interface AtlasSource {
  id: string;
  title: string;
  url?: string;
  publisher?: string;
  type?: string;
  notes?: string;
}

export interface AtlasSynopticEffect {
  wind: string;
  effect: string;
  sources: string[];
}

export interface AtlasMassif {
  id: string;
  name: string;
  region: string;
  parent?: string;
  summary: string;
  bbox: [number, number, number, number];
  center: [number, number];
  tips: string[];
  synoptic: AtlasSynopticEffect[];
  /** Feature ids by category, for the side panel. */
  items: Record<FeatureCategory, string[]>;
  sources: string[];
}

export type FeatureCategory =
  | 'breezes'
  | 'convergences'
  | 'hazards'
  | 'thermals'
  | 'soaring'
  | 'takeoffs'
  | 'landings'
  | 'routes';

/** Properties shared by every atlas feature (flattened for MapLibre). */
export interface AtlasFeatureProps {
  id: string;
  category: FeatureCategory;
  massif: string;
  name: string;
  kind?: string;
  description: string;
  confidence?: 'high' | 'medium' | 'low';
  /** Global source ids, comma separated (MapLibre flattens arrays). */
  sources: string;
  coordQuality?: 'source' | 'approx' | 'mixed';
  /** Free-form extra details shown in the popup: label → value. */
  details?: Record<string, string>;
  /** Breezes: legal-time active window, typical speed (km/h). */
  windowStart?: number;
  windowEnd?: number;
  speedKmh?: number;
  /** Elevation check for points: DEM elevation minus declared altitude (m). */
  altDelta?: number;
}

export interface AtlasFeature {
  type: 'Feature';
  id?: number;
  geometry: { type: 'Point'; coordinates: [number, number] } | { type: 'LineString'; coordinates: [number, number][] };
  properties: AtlasFeatureProps;
}

export interface ModelRule {
  id: string;
  topic: string;
  rule: string;
  numbers?: unknown;
  sources: string[];
}

export interface Atlas {
  generatedAt: string;
  massifs: AtlasMassif[];
  regions: string[];
  sources: Record<string, AtlasSource>;
  features: Record<FeatureCategory, AtlasFeature[]>;
  curated: CuratedBreezeInput[];
  rules: ModelRule[];
  stats: Record<string, number>;
}
