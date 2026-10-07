/**
 * Map modules: each family of layers (relief, local knowledge, airspace,
 * sites, wind…) is a self-contained module. The controller only orders them,
 * forwards state changes and routes clicks. Adding a data source = adding a
 * module (and usually a provider in src/services).
 */
import type { LayerSpecification, Map as MlMap } from 'maplibre-gl';
import type { Atlas } from '@brises/shared';
import type { Grid } from '@brises/model';
import type { AppState } from '../../state/store';

/** Stacking slots, bottom to top. Modules insert their layers into a slot. */
export const SLOTS = ['base', 'analysis', 'areas', 'lines', 'scene', 'points', 'labels'] as const;
export type Slot = (typeof SLOTS)[number];

export const slotMarker = (slot: Slot) => `slot-end-${slot}`;

export interface ModuleContext {
  map: MlMap;
  grid: Grid;
  atlas: Atlas;
  /** Adds a style layer at the top of a slot. */
  addLayer(layer: LayerSpecification | Parameters<MlMap['addLayer']>[0], slot: Slot): void;
  /** Tells the UI something changed in this module (e.g. new data loaded). */
  notify(event: ModuleEvent): void;
}

export type ModuleEvent =
  | { type: 'status'; module: string; message: string | null }
  | { type: 'data'; module: string };

/** Everything the side sheet needs to present a clicked feature, whatever its source. */
export interface FeatureDetails {
  /** `${module}:${id}` */
  ref: string;
  category: string;
  title: string;
  subtitle?: string;
  badges?: { label: string; tone?: 'ok' | 'warn' | 'bad' | 'info' }[];
  /** One prominent line (e.g. "≈ 20 km/h · 12h → 19h"). */
  stat?: string;
  details?: [string, string][];
  /** Paragraphs; atlas text may carry inline citations like [region:S3]. */
  paragraphs?: string[];
  /** Global source ids (atlas) — resolved by the UI. */
  sourceIds?: string[];
  /** Explicit links (external directories). */
  links?: { label: string; url: string }[];
  warning?: string;
  /** For "fly to" and the massif back-link. */
  bbox: [number, number, number, number];
  massifId?: string;
  attribution?: string;
}

export interface MapModule {
  readonly id: string;
  /** Layer ids whose features are clickable; features must carry `properties.id`. */
  readonly clickableLayers?: string[];
  add(ctx: ModuleContext): void | Promise<void>;
  /** Called on every app-state change; modules diff what concerns them. */
  apply(state: AppState, prev: AppState | null): void;
  describe?(featureId: string, properties: Record<string, unknown>): FeatureDetails | null;
  dispose?(): void;
}

export function bboxOf(coords: number[][]): [number, number, number, number] {
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
