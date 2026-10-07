import type { Atlas, ContributionInput } from '@brises/shared';
import { create } from 'zustand';
import type { OverlayMode } from '../engine/cpu-overlays';
import type { FeatureDetails } from '../map/modules/types';
import type { ProbeResult } from '../map/modules/wind';

export type Basemap = 'ign-ortho' | 'relief' | 'ign-plan' | 'otm';

export type LayerKey =
  | 'particles'
  | 'comets'
  | 'thermalColumns'
  | 'breezes'
  | 'convergences'
  | 'hazards'
  | 'thermals'
  | 'soaring'
  | 'takeoffs'
  | 'landings'
  | 'routes'
  | 'sitesOfficial'
  | 'sitesCommunity'
  | 'airspace'
  | 'airspaceProtect'
  | 'airspaceActivity'
  | 'labels'
  | 'kk7Thermals'
  | 'kk7Skyways'
  | 'hillshade';

/** User-facing settings: everything that defines what the map simulates and shows. */
export interface AppState {
  month0: number;
  day: number;
  hour: number;
  playing: boolean;
  synopticFrom: number;
  synopticKmh: number;
  heightMode: 'agl' | 'asl';
  heightAgl: number;
  heightAsl: number;
  breezeScale: number;
  overlay: OverlayMode;
  overlayOpacity: number;
  layers: Record<LayerKey, boolean>;
  basemap: Basemap;
  exaggeration: number;
  particleCount: number;
  particleSpeed: number;
  particleColor: 'speed' | 'lift';
  selectedMassif: string | null;
  panelOpen: boolean;
  aboutOpen: boolean;
  set: (patch: Partial<AppState>) => void;
  toggleLayer: (key: LayerKey) => void;
}

const isSmall = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 860px)').matches;

export const useApp = create<AppState>((set) => ({
  // Default: a typical July thermal day, mid-afternoon, no synoptic wind.
  month0: 6,
  day: 15,
  hour: 15,
  playing: false,
  synopticFrom: 315,
  synopticKmh: 0,
  heightMode: 'agl',
  heightAgl: 80,
  heightAsl: 2500,
  breezeScale: 1,
  overlay: 'none',
  overlayOpacity: 0.85,
  layers: {
    particles: true,
    comets: true,
    thermalColumns: true,
    breezes: true,
    convergences: true,
    hazards: true,
    thermals: true,
    soaring: true,
    takeoffs: true,
    landings: true,
    routes: false,
    sitesOfficial: true,
    sitesCommunity: false,
    airspace: false,
    airspaceProtect: false,
    airspaceActivity: false,
    labels: true,
    kk7Thermals: false,
    kk7Skyways: false,
    hillshade: true,
  },
  basemap: 'ign-ortho',
  exaggeration: 1.3,
  particleCount: isSmall ? 7000 : 16000,
  particleSpeed: 1,
  particleColor: 'speed',
  selectedMassif: null,
  panelOpen: !isSmall,
  aboutOpen: false,
  set: (patch) => set(patch),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
}));

export const CURRENT_YEAR = new Date().getFullYear();

// ---------- Runtime state fed by the map controller ----------

export interface ContributionDraft {
  kind: ContributionInput['kind'];
  targetRef?: string;
  targetTitle?: string;
  category?: ContributionInput['category'];
  /** Points picked on the map (one for a spot, several for a breeze path). */
  points: [number, number][];
  picking: boolean;
}

export interface RuntimeState {
  atlas: Atlas | null;
  dataMode: 'api' | 'static' | null;
  status: { phase: 'loading' | 'terrain' | 'ready' | 'error'; message?: string };
  moduleMessage: string | null;
  sun: { azimuth: number; elevation: number } | null;
  solarHour: number | null;
  probe: { lon: number; lat: number; result: ProbeResult | null } | null;
  feature: FeatureDetails | null;
  draft: ContributionDraft | null;
  toast: string | null;
  set: (patch: Partial<RuntimeState>) => void;
}

export const useRuntime = create<RuntimeState>((set) => ({
  atlas: null,
  dataMode: null,
  status: { phase: 'loading', message: 'Initialisation…' },
  moduleMessage: null,
  sun: null,
  solarHour: null,
  probe: null,
  feature: null,
  draft: null,
  toast: null,
  set: (patch) => set(patch),
}));
