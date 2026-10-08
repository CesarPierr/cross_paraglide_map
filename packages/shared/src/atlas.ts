/** Types of the compiled research atlas (atlas.json / API), produced by scripts/build-data.ts. */

/**
 * Condition under which a documented breeze exists ("seulement par canicule",
 * "par Lombarde"...). A conditional breeze stays in the atlas but only enters the
 * simulation when its condition is met.
 */
export interface BreezeCondition {
  /** Short French text completing "seulement si …" / "seulement par …". */
  label: string;
  /** Synoptic wind required: meteorological direction (deg, where it blows from) and minimum speed. */
  wind?: { fromDeg: number; minKmh: number };
  /** Thermal regime required: heatwave (simulation option), winter / persistent inversion (Nov–Feb). */
  regime?: 'heatwave' | 'winter';
}

/** A documented breeze as the wind model consumes it. */
export interface CuratedBreezeInfo {
  id: string;
  name: string;
  kind: string;
  speedMs: number;
  /** Active window in legal time [start, end] (hours), null = follow the generic valley cycle. */
  window: [number, number] | null;
  /** Only simulated when this condition holds (absent = regular breeze). */
  condition?: BreezeCondition | null;
}

export interface CuratedBreezeInput extends CuratedBreezeInfo {
  /** Path in the direction the air flows, [lon, lat]. */
  coords: [number, number][];
  /** Half-width of the influence corridor, metres. */
  radiusM: number;
  /** 0..1 trust in this breeze (confidence of the sources); scales its influence. */
  strength: number;
}

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
  /** Compact name for map labels and lists. */
  shortName: string;
  region: string;
  parent?: string;
  summary: string;
  bbox: [number, number, number, number];
  center: [number, number];
  tips: string[];
  synoptic: AtlasSynopticEffect[];
  /** Colour slot of the sector on the schematic map (neighbours never share one). */
  colorIndex?: number;
  /** Sector outline (lon, lat ring) for picking the massif on the map; absent for the regional sector. */
  outline?: [number, number][];
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
  /** `measured`: position of a thermal hotspot computed from GPS tracks (thermal.kk7.ch). */
  coordQuality?: 'source' | 'approx' | 'mixed' | 'measured';
  /** Thermals: `kk7` for a hotspot found only in GPS tracks, not yet described by any text. */
  origin?: 'research' | 'kk7';
  /** Thermals: probability of the matching kk7 hotspot (0–1) and its distance to the documented point (m). */
  kk7P?: number;
  kk7DistM?: number;
  /** Thermals: kk7 hotspot probability by time of day — sunrise to +6 h, +6 to +9 h, later (0 when absent). */
  kk7Morning?: number;
  kk7Midday?: number;
  kk7Evening?: number;
  /** Free-form extra details shown in the popup: label → value. */
  details?: Record<string, string>;
  /** Breezes: legal-time active window, typical speed (km/h). */
  windowStart?: number;
  windowEnd?: number;
  speedKmh?: number;
  /** Breezes: "seulement si …" text of a conditional breeze (see `BreezeCondition`). */
  condition?: string;
  /** Breezes: synoptic wind of a wind-conditional breeze (direction it blows from, deg; minimum speed, km/h). */
  conditionWindFrom?: number;
  conditionWindKmh?: number;
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

/** An annotated drawing (breeze arrows on a photo, club map…) linked from the sheets, never re-hosted. */
export interface AtlasFigure {
  id: string;
  massif: string;
  title: string;
  /** Direct image URL when the figure is a web image. */
  imageUrl?: string;
  /** Page or PDF that contains the figure. */
  pageUrl: string;
  pdfPage?: number;
  publisher?: string;
  /** What the figure shows. */
  shows: string;
  /** Atlas feature ids drawn from the figure. */
  features: string[];
  sources: string[];
}

/** One step of a written guided visit of a massif (research_notes/<pass>/visites/<massif>.json). */
export interface AtlasTourStep {
  chapter: string;
  title: string;
  /** Narration: a few explicit, didactic sentences. */
  text: string;
  /** Atlas feature ids shown and highlighted by the step (their sources back the text). */
  features: string[];
  /** Extra source ids cited by the step. */
  sources: string[];
  phase?: 'morning' | 'midday' | 'afternoon' | 'evening';
  wind?: { fromDeg: number; kmh: number };
  /** "massif" frames the whole sector; default frames the step's features. */
  view?: 'massif' | 'features';
  /** Places the text names (villages, summits, cols, rivers), in reading order: pinned on the map, highlighted in the text. */
  places?: AtlasTourPlace[];
}

export interface AtlasTourPlace {
  /** As written in the text. */
  name: string;
  /** Official name (IGN gazetteer) or the atlas item it was located from. */
  label: string;
  lon: number;
  lat: number;
  kind?: string;
}

export interface Atlas {
  generatedAt: string;
  massifs: AtlasMassif[];
  regions: string[];
  sources: Record<string, AtlasSource>;
  features: Record<FeatureCategory, AtlasFeature[]>;
  curated: CuratedBreezeInput[];
  rules: ModelRule[];
  /** Annotated figures from clubs and federations (optional: older atlases have none). */
  figures?: AtlasFigure[];
  /** Research dossier (notes: sources read, changes, gaps) of each massif, repository-relative path. */
  dossiers?: Record<string, string>;
  /** Written guided visits by massif id (absent: the app builds one from the data). */
  tours?: Record<string, AtlasTourStep[]>;
  /** Set once the text part (descriptions, notes, summaries) is merged (see atlas-split.ts). */
  textLoaded?: boolean;
  stats: Record<string, number>;
}
