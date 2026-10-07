import { create } from 'zustand';
import type { Atlas } from '../data/atlas-types';
import type { ProbeMessage } from '../engine/model-client';
import type { SunPosition } from '../model/sun';
import type { OverlayMode } from '../model/overlays';
import type { ParticleColorMode } from '../map/wind-particles';

export type Basemap = 'ign-ortho' | 's2' | 'ign-plan' | 'otm';

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
  | 'labels'
  | 'kk7Thermals'
  | 'kk7Skyways'
  | 'hillshade'
  | 'stations';

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
  particleColor: ParticleColorMode;
  selectedMassif: string | null;
  panelOpen: boolean;
  aboutOpen: boolean;
  set: (patch: Partial<AppState>) => void;
  toggleLayer: (key: LayerKey) => void;
}

const today = new Date();
const isSmall = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 720px)').matches;

export const useApp = create<AppState>((set) => ({
  // Default to a typical July thermal day, mid-afternoon.
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
    hazards: false,
    thermals: true,
    soaring: true,
    takeoffs: true,
    landings: false,
    routes: false,
    labels: true,
    kk7Thermals: false,
    kk7Skyways: false,
    hillshade: true,
    stations: false,
  },
  basemap: 'ign-ortho',
  exaggeration: 1.2,
  particleCount: isSmall ? 6000 : 16000,
  particleSpeed: 1,
  particleColor: 'speed',
  selectedMassif: null,
  panelOpen: !isSmall,
  aboutOpen: false,
  set: (patch) => set(patch),
  toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
}));

export const CURRENT_YEAR = today.getFullYear();

// ---------- Runtime (non-persistent) state fed by the map controller ----------

export interface RuntimeState {
  atlas: Atlas | null;
  status: { phase: 'loading' | 'terrain' | 'ready' | 'computing' | 'error'; message?: string };
  sun: SunPosition | null;
  solarHour: number | null;
  computeMs: number | null;
  probe: { lon: number; lat: number; result: ProbeMessage } | null;
  selectedFeature: string | null;
  set: (patch: Partial<RuntimeState>) => void;
}

export const useRuntime = create<RuntimeState>((set) => ({
  atlas: null,
  status: { phase: 'loading', message: 'Initialisation…' },
  sun: null,
  solarHour: null,
  computeMs: null,
  probe: null,
  selectedFeature: null,
  set: (patch) => set(patch),
}));
