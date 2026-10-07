/**
 * Contracts between the app and its external data sources.
 *
 * Every source is a small provider object behind one of these interfaces, so
 * new sources (live beacons, other forecast models, flight-track analytics…)
 * plug in without touching the map or the UI. See docs/ARCHITECTURE.md.
 */

/** Free-atmosphere wind used as the synoptic input of the model. */
export interface SynopticWind {
  /** ISO local time (Europe/Paris). */
  time: string;
  hour: number;
  /** Ridge-level wind (~2200 m): direction it blows from (deg) and speed. */
  fromDeg: number;
  speedKmh: number;
  /** Optional raw levels, e.g. { '850hPa': [dir, kmh], '700hPa': [dir, kmh] }. */
  levels?: Record<string, [number, number]>;
}

/** One pressure level of a forecast sounding. */
export interface ProfileLevel {
  pressure: number;
  /** Geopotential height, metres AMSL. */
  heightM: number;
  temperature: number;
  dewpoint?: number;
  windFromDeg: number;
  windKmh: number;
}

/** Soaring-relevant forecast at a point. */
export interface PointForecast {
  time: string;
  hour: number;
  temperature2m?: number;
  dewpoint2m?: number;
  /** Estimated cumulus base, metres AMSL. */
  cloudBaseM?: number;
  boundaryLayerM?: number;
  cape?: number;
  cloudCoverLow?: number;
  cloudCover?: number;
  precipitation?: number;
  freezingLevelM?: number;
  synoptic?: SynopticWind;
  /** Vertical profile (bottom → top), when the provider has pressure levels. */
  profile?: ProfileLevel[];
}

export interface WeatherProvider {
  readonly id: string;
  readonly label: string;
  /** HTML attribution shown next to the data. */
  readonly attribution: string;
  synoptic(lat: number, lon: number, signal?: AbortSignal): Promise<SynopticWind[]>;
  pointForecast?(lat: number, lon: number, signal?: AbortSignal): Promise<{ elevation: number; hours: PointForecast[] }>;
}

export type SiteKind = 'takeoff' | 'landing' | 'site';

/** A take-off, landing or flying site from any directory. */
export interface FlyingSite {
  /** Unique within the provider. */
  id: string;
  provider: string;
  kind: SiteKind;
  name: string;
  lon: number;
  lat: number;
  altitude?: number;
  /** Compass sectors the take-off faces, e.g. ['N', 'NO']. */
  orientations?: string[];
  description?: string;
  url?: string;
  /** Official (federation) vs community-reported site. */
  status?: 'official' | 'community';
}

export interface SiteProvider {
  readonly id: string;
  readonly label: string;
  readonly attribution: string;
  /** Below this zoom the provider is not queried (keeps requests reasonable). */
  readonly minZoom: number;
  /** Sites inside [west, south, east, north]. */
  fetch(bbox: [number, number, number, number], signal: AbortSignal): Promise<FlyingSite[]>;
}
