/**
 * Schematic view of one massif: the relief is flattened, the imagery veiled,
 * and everything the sources say about the massif is drawn as a clean
 * diagram for a typical summer thermal day: breezes as thick arrows (filtered
 * by time slot), convergences, known thermals, hazards, take-offs, landings,
 * soaring spots, and the cross-country transitions towards the neighbours.
 * The live 3D layers are switched off by the controller meanwhile.
 */
import { isPhoneLayout, phonePadding } from '../viewport';
import type { AtlasFeature, FeatureCategory } from '@brises/shared';
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import { SCHEMA_PHASES, useRuntime, type AppState, type Readability, type SchemaPhase } from '../../state/store';
import { BREEZE_COLORS, COLORS } from '../palette';
import { maxTierAt, zoomForTier } from '../tiers';
import { shortLabel, sortProps, TIER_FONT, TIER_ICON, tierFilter } from './knowledge';
import type { FeatureDetails, MapModule, ModuleContext } from './types';

const LAYERS = [
  'schema-veil',
  'schema-routes',
  'schema-breeze-casing',
  'schema-breeze',
  'schema-breeze-arrows',
  'schema-conv-glow',
  'schema-conv',
  'schema-conv-point',
  'schema-more',
  'schema-more-count',
  'schema-points',
  'schema-breeze-label',
  'schema-route-label',
  'schema-title',
  'schema-hl-line',
  'schema-hl-point',
  'schema-route-pts',
  'schema-route-num',
] as const;
/** The whole-Alps sector (large-scale breezes, convergences and routes). */
const OVERVIEW = 'alpes-francaises';

/** Points of the diagram (convergences are drawn as zones). */
const SCHEMA_POINTS = ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'category'], 'convergences']] as FilterSpecification;

const PICK_LAYERS = ['schema-pick-fill', 'schema-pick-line', 'schema-pick-dot', 'schema-pick-label'] as const;

/** Role of a thermal on the classic routes, read from its sourced description. */
export function thermalRole(text: string | undefined): string | null {
  const t = (text ?? '').toLowerCase();
  if (/plafond|plaf\b/.test(t)) return 'plafond';
  if (/relance|raccroch|remonter|recharge/.test(t)) return 'relance';
  if (/d[ée]clench/.test(t)) return 'déclencheur';
  return null;
}

/** Does an activity window [start, end) (hours, may wrap past midnight) overlap a slot? */
export function activeInSlot(start: number | undefined, end: number | undefined, [a, b]: [number, number]): boolean {
  if (start === undefined || end === undefined) return true;
  if (start <= end) return start < b && end > a;
  return a < end || b > start;
}

const POINT_ICONS: Partial<Record<FeatureCategory, string>> = {
  thermals: 'thermal',
  hazards: 'hazard',
  takeoffs: 'takeoff',
  landings: 'landing',
  soaring: 'soaring',
};

/** Hairline-free arrow drawn as a signed-distance field so it can take each breeze's colour. */
function addArrowImage(map: MlMap): void {
  if (map.hasImage('schema-arrow')) return;
  const s = 48;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(s * 0.2, s * 0.18);
  c.lineTo(s * 0.82, s * 0.5);
  c.lineTo(s * 0.2, s * 0.82);
  c.lineTo(s * 0.36, s * 0.5);
  c.closePath();
  c.fill();
  map.addImage('schema-arrow', c.getImageData(0, 0, s, s), { sdf: true, pixelRatio: 2 });
}

export class SchemaModule implements MapModule {
  readonly id = 'schema';
  readonly clickableLayers = ['schema-pick-fill', 'schema-pick-dot', 'schema-pick-label', 'schema-breeze', 'schema-conv-glow', 'schema-conv', 'schema-conv-point', 'schema-more', 'schema-points', 'schema-routes'];
  private ctx: ModuleContext | null = null;
  private massif: string | null = null;
  private savedCamera: { center: [number, number]; zoom: number; pitch: number; bearing: number } | null = null;

  private picking = false;
  /** Map zoomed out far enough to choose a massif from its shape. */
  private zoomedOut = false;
  private touring = false;
  private threeD = false;
  /** Progressive disclosure (see map/tiers.ts): tiers shown at this zoom, categories asked for, items read or shown by a visit step. */
  private readability: Readability = 'essentiel';
  private revealed: string[] = [];
  private highlighted: string[] = [];
  private focus: string[] = [];
  private maxTier = 0;
  private offRuntime: () => void = () => {};

  constructor(
    private describeAtlas: (id: string) => FeatureDetails | null,
    private pick: (massifId: string) => void,
  ) {}

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
    const { map } = ctx;
    addArrowImage(map);
    const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    map.addSource('schema', { type: 'geojson', data: empty });
    map.addSource('schema-veil', { type: 'geojson', data: empty });
    // Turn points of the route a visit step walks through, numbered in flying order.
    map.addSource('schema-route-pts', { type: 'geojson', data: empty });
    // Thermals of the sector not drawn at this zoom: numbered bubbles, opened by a tap.
    map.addSource('schema-more', {
      type: 'geojson',
      data: empty,
      cluster: true,
      clusterRadius: 90,
      clusterMaxZoom: 14,
      clusterProperties: { minTier: ['min', ['get', 'tier']], lon: ['+', ['get', 'lon']], lat: ['+', ['get', 'lat']] },
    });
    const kindColor = ['match', ['get', 'kind'], ...Object.entries(BREEZE_COLORS).flat(), BREEZE_COLORS.valley] as unknown as ExpressionSpecification;
    // Neighbouring massifs stay visible for the transitions, but faded.
    const own = ['case', ['==', ['get', 'own'], true], 1, 0.35] as ExpressionSpecification;
    const isCat = (c: string) => ['==', ['get', 'category'], c] as ExpressionSpecification;

    ctx.addLayer({ id: 'schema-veil', type: 'fill', source: 'schema-veil', paint: { 'fill-color': '#08101c', 'fill-opacity': 0.62 } }, 'analysis');
    ctx.addLayer(
      {
        id: 'schema-routes',
        type: 'line',
        source: 'schema',
        filter: isCat('routes') as FilterSpecification,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.route, 'line-width': 3, 'line-dasharray': [0.6, 1.6], 'line-opacity': ['*', 0.9, own] },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'schema-breeze-casing',
        type: 'line',
        source: 'schema',
        filter: isCat('breezes') as FilterSpecification,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#020617', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 7, 12, 15], 'line-opacity': ['*', 0.7, own] },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'schema-breeze',
        type: 'line',
        source: 'schema',
        filter: isCat('breezes') as FilterSpecification,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': kindColor,
          // Width follows the documented strength.
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, ['+', 2, ['*', 0.12, ['get', 'speedKmh']]], 12, ['+', 5, ['*', 0.3, ['get', 'speedKmh']]]],
          'line-opacity': ['*', ['case', ['==', ['get', 'confidence'], 'low'], 0.6, 0.95], own],
        },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'schema-breeze-arrows',
        type: 'symbol',
        source: 'schema',
        filter: isCat('breezes') as FilterSpecification,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 8, 45, 12, 90],
          'icon-image': 'schema-arrow',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 12, 1],
          'icon-allow-overlap': true,
          'icon-rotation-alignment': 'map',
        },
        paint: { 'icon-color': '#0b1220', 'icon-halo-color': kindColor, 'icon-halo-width': 1.5, 'icon-opacity': own },
      },
      'lines',
    );
    // Convergences as zones where two flows meet: a soft band, arrows from both sides.
    ctx.addLayer(
      {
        id: 'schema-conv-glow',
        type: 'line',
        source: 'schema',
        filter: ['all', isCat('convergences'), ['==', ['geometry-type'], 'LineString']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLORS.convergence,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 18, 12, 70],
          'line-blur': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 10, 12, 34],
          'line-opacity': ['*', 0.5, own],
        },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'schema-conv',
        type: 'symbol',
        source: 'schema',
        filter: ['all', isCat('convergences'), ['==', ['geometry-type'], 'LineString']],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 8, 80, 12, 140],
          'icon-image': 'convergence-arrows',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 12, 1.3],
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': own },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'schema-conv-point',
        type: 'circle',
        source: 'schema',
        filter: ['all', isCat('convergences'), ['==', ['geometry-type'], 'Point']],
        paint: { 'circle-radius': 14, 'circle-color': 'rgba(232,121,249,0.28)', 'circle-stroke-color': '#f5d0fe', 'circle-stroke-width': 2.5, 'circle-opacity': own },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'schema-more',
        type: 'circle',
        source: 'schema-more',
        paint: {
          'circle-radius': ['case', ['has', 'point_count'], ['step', ['get', 'point_count'], 10, 5, 12.5, 15, 15], 3.5],
          'circle-color': ['case', ['has', 'point_count'], 'rgba(251,146,60,0.85)', 'rgba(251,146,60,0.6)'],
          'circle-stroke-color': '#fff7ed',
          'circle-stroke-width': ['case', ['has', 'point_count'], 1.6, 1],
          'circle-pitch-alignment': 'viewport',
        },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'schema-more-count',
        type: 'symbol',
        source: 'schema-more',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['to-string', ['get', 'point_count']], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': '#431407' },
      },
      'labels',
    );
    const own1 = (t: ExpressionSpecification) => ['all', ['==', ['get', 'own'], true], t] as ExpressionSpecification;
    const tier = ['coalesce', ['get', 'tier'], 2] as ExpressionSpecification;
    ctx.addLayer(
      {
        id: 'schema-points',
        type: 'symbol',
        source: 'schema',
        filter: SCHEMA_POINTS,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': ['*', ['case', ['==', ['get', 'own'], true], 1, 0.7], TIER_ICON],
          'icon-allow-overlap': true,
          // Names never overlap: the sector's essentials first, the others closer in.
          'text-field': ['step', ['zoom'], ['case', own1(['==', tier, 1]), ['get', 'label'], ''], 10.5, ['case', own1(['<=', tier, 2]), ['get', 'label'], ''], 12, ['case', own1(['literal', true] as unknown as ExpressionSpecification), ['get', 'label'], '']],
          'text-font': TIER_FONT,
          'text-size': ['match', tier, 1, 12.5, 11.5],
          'text-offset': [0, 1.35],
          'text-anchor': 'top',
          'text-optional': true,
          'text-max-width': 11,
          'text-padding': 3,
          'symbol-sort-key': ['get', 'sk'],
        },
        paint: { 'text-color': '#f8fafc', 'text-halo-color': 'rgba(2,6,23,0.95)', 'text-halo-width': 1.6, 'icon-opacity': own },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'schema-breeze-label',
        type: 'symbol',
        source: 'schema',
        filter: ['all', isCat('breezes'), ['==', ['get', 'own'], true]],
        layout: {
          'symbol-placement': 'line-center',
          'symbol-sort-key': ['get', 'sk'],
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-offset': [0, -1.4],
          'text-max-angle': 35,
          'text-allow-overlap': false,
        },
        paint: { 'text-color': kindColor, 'text-halo-color': 'rgba(2,6,23,0.95)', 'text-halo-width': 1.5 },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'schema-route-label',
        type: 'symbol',
        source: 'schema',
        filter: isCat('routes') as FilterSpecification,
        layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-offset': [0, 1.1] },
        paint: { 'text-color': '#fef3c7', 'text-halo-color': 'rgba(2,6,23,0.95)', 'text-halo-width': 1.5 },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'schema-title',
        type: 'symbol',
        source: 'schema',
        filter: isCat('title') as FilterSpecification,
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 22, 'text-letter-spacing': 0.08, 'text-allow-overlap': true },
        paint: { 'text-color': 'rgba(255,247,224,0.22)', 'text-halo-color': 'rgba(0,0,0,0.2)', 'text-halo-width': 1 },
      },
      'analysis',
    );
    // Highlight of the items a guided-visit step talks about (the others are dimmed).
    ctx.addLayer(
      {
        id: 'schema-hl-line',
        type: 'line',
        source: 'schema',
        filter: ['in', ['get', 'id'], ['literal', []]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#fef08a', 'line-width': 9, 'line-blur': 4, 'line-opacity': 0.75 },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'schema-hl-point',
        type: 'circle',
        source: 'schema',
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['in', ['get', 'id'], ['literal', []]]],
        paint: { 'circle-radius': 16, 'circle-color': 'rgba(254,240,138,0.18)', 'circle-stroke-color': '#fef08a', 'circle-stroke-width': 2.5 },
      },
      'points',
    );
    ctx.addLayer(
      {
        id: 'schema-route-pts',
        type: 'circle',
        source: 'schema-route-pts',
        paint: { 'circle-radius': 10, 'circle-color': COLORS.route, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-pitch-alignment': 'map' },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'schema-route-num',
        type: 'symbol',
        source: 'schema-route-pts',
        layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': '#1c1917' },
      },
      'labels',
    );
    // Picker: the sectors as a map of clickable shapes (outlines computed by the pipeline),
    // with their names; a sector without outline falls back to a dot.
    const REGION_TINTS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#2dd4bf', '#fb923c', '#818cf8', '#a3e635'];
    const regionIndex = new Map(ctx.atlas.regions.map((r, i) => [r, i]));
    const sectors = ctx.atlas.massifs.filter((m) => m.id !== 'alpes-francaises');
    map.addSource('schema-pick', {
      type: 'geojson',
      promoteId: 'id',
      data: {
        type: 'FeatureCollection',
        features: sectors.map((m) => ({
          type: 'Feature',
          geometry: m.outline && m.outline.length >= 3 ? { type: 'Polygon', coordinates: [[...m.outline, m.outline[0]]] } : { type: 'Point', coordinates: m.center },
          properties: { id: m.id, name: m.shortName, tint: REGION_TINTS[(m.colorIndex ?? regionIndex.get(m.region) ?? 0) % REGION_TINTS.length] },
        })),
      },
    });
    map.addSource('schema-pick-labels', {
      type: 'geojson',
      // Rank: sectors with the most documented items keep their name when labels would collide.
      data: { type: 'FeatureCollection', features: sectors.map((m) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: m.center }, properties: { id: m.id, name: m.shortName, rank: -Object.values(m.items).reduce((n, l) => n + l.length, 0) } })) },
    });
    const hovered = ['boolean', ['feature-state', 'hover'], false] as ExpressionSpecification;
    ctx.addLayer(
      {
        id: 'schema-pick-fill',
        type: 'fill',
        source: 'schema-pick',
        filter: ['==', ['geometry-type'], 'Polygon'],
        // Schematic: solid tints that read at a glance (they leave once a massif is chosen).
        paint: { 'fill-color': ['get', 'tint'], 'fill-opacity': ['case', hovered, 0.85, 0.6] },
      },
      'points',
    );
    ctx.addLayer(
      {
        id: 'schema-pick-line',
        type: 'line',
        source: 'schema-pick',
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: { 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': ['case', hovered, 3.2, 1.6], 'line-opacity': ['case', hovered, 1, 0.85] },
      },
      'points',
    );
    ctx.addLayer(
      {
        id: 'schema-pick-dot',
        type: 'circle',
        source: 'schema-pick',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 7, 'circle-color': '#38bdf8', 'circle-stroke-color': '#e0f2fe', 'circle-stroke-width': 2 },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'schema-pick-label',
        type: 'symbol',
        source: 'schema-pick-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 8, 15, 10, 17],
          'text-padding': 3,
          // No piled-up names: the busiest sectors win, the others appear as one zooms in (every shape stays tappable).
          'text-allow-overlap': false,
          'symbol-sort-key': ['get', 'rank'],
          'text-max-width': 8,
        },
        paint: { 'text-color': '#f8fafc', 'text-halo-color': 'rgba(2,6,23,0.9)', 'text-halo-width': 1.5 },
      },
      'labels',
    );
    // Hover highlight of the sector under the pointer.
    let hoverId: string | null = null;
    const setHover = (id: string | null) => {
      if (hoverId === id) return;
      if (hoverId) map.setFeatureState({ source: 'schema-pick', id: hoverId }, { hover: false });
      hoverId = id;
      if (id) map.setFeatureState({ source: 'schema-pick', id }, { hover: true });
    };
    map.on('mousemove', 'schema-pick-fill', (e) => setHover(this.pickShown() ? String(e.features?.[0]?.properties?.id ?? '') || null : null));
    map.on('mouseleave', 'schema-pick-fill', () => setHover(null));
    this.setVisible(false);
    this.setPicking(false);
    // Zoomed out: the sector shapes come back (see refreshPick).
    const onZoom = () => {
      const out = map.getZoom() < 8.3;
      if (out === this.zoomedOut) return;
      this.zoomedOut = out;
      this.refreshPick();
    };
    map.on('zoomend', onZoom);
    onZoom();
    map.on('zoom', () => this.refreshTiers());
    this.offRuntime = useRuntime.subscribe((r, p) => {
      if (r.feature === p.feature) return;
      const ref = r.feature?.ref;
      this.focus = ref?.startsWith('atlas:') ? [ref.slice(6)] : [];
      this.refreshTiers(true);
    });
  }

  /**
   * Shows the tiers due at this zoom: the sector's essentials at massif scale, the rest
   * closer in or on demand; the thermals not shown yet gather in numbered bubbles.
   */
  private refreshTiers(force = false): void {
    const map = this.ctx?.map;
    if (!map || !this.massif) return;
    const max = maxTierAt(map.getZoom(), this.readability, isPhoneLayout());
    if (!force && max === this.maxTier) return;
    this.maxTier = max;
    const forced = [...this.focus, ...this.highlighted];
    const shown = (cat: string) => tierFilter(max, this.revealed.includes(cat), forced);
    map.setFilter('schema-points', ['all', SCHEMA_POINTS, ['any', ...['hazards', 'thermals', 'takeoffs', 'landings', 'soaring'].map((c) => ['all', ['==', ['get', 'category'], c], shown(c)])]] as unknown as FilterSpecification);
    map.setFilter('schema-breeze-label', ['all', ['==', ['get', 'category'], 'breezes'], ['==', ['get', 'own'], true], shown('breezes')] as FilterSpecification);
    map.setFilter('schema-route-label', ['all', ['==', ['get', 'category'], 'routes'], shown('routes')] as FilterSpecification);
    const hidden = this.revealed.includes('thermals')
      ? []
      : this.ctx!.atlas.features.thermals.filter((f) => f.properties.massif === this.massif && f.properties.origin !== 'kk7' && (f.properties.tier ?? 2) > max && !forced.includes(f.properties.id));
    (map.getSource('schema-more') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: hidden.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { id: f.properties.id, name: f.properties.name, tier: f.properties.tier ?? 2, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
      })) as GeoJSON.Feature[],
    });
  }

  dispose(): void {
    this.offRuntime();
  }

  private setPicking(on: boolean): void {
    const map = this.ctx!.map;
    for (const id of PICK_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }

  /**
   * The sector shapes show in the chooser, and also whenever the map is zoomed out (outside a visit),
   * so another massif is always one tap away. On the live map its own sector names stay; in a massif
   * page (live names hidden) the shapes bring theirs.
   */
  private refreshPick(): void {
    const map = this.ctx!.map;
    // Zoomed out on the live map only: once a massif is open its own diagram takes the map.
    const auto = this.zoomedOut && !this.touring && this.massif === null;
    const shown = this.picking || auto;
    for (const id of PICK_LAYERS) {
      const on = shown;
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
  }

  private pickShown(): boolean {
    return this.picking || (this.zoomedOut && !this.touring && this.massif === null);
  }

  select(id: string, props: Record<string, unknown>): boolean {
    // A bubble of thermals not shown yet: zoom in until they show (or the group splits).
    if (props.cluster && this.massif) {
      const map = this.ctx!.map;
      const n = Number(props.point_count) || 1;
      const center: [number, number] = [Number(props.lon) / n, Number(props.lat) / n];
      const minTier = Number(props.minTier) || 2;
      void (map.getSource('schema-more') as GeoJSONSource)
        .getClusterExpansionZoom(Number(props.cluster_id))
        .then((z) => map.easeTo({ center, zoom: Math.min(14, Math.max(z, zoomForTier(minTier, this.readability, isPhoneLayout())) + 0.05), duration: 700 }));
      return true;
    }
    if (!this.pickShown() || props.name === undefined || !this.ctx!.atlas.massifs.some((m) => m.id === id)) return false;
    this.pick(id);
    return true;
  }

  private setVisible(on: boolean): void {
    const map = this.ctx!.map;
    for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  }

  apply(s: AppState, prev: AppState | null): void {
    if (!this.ctx) return;
    const map = this.ctx.map;
    if (!prev || prev.schemaPicking !== s.schemaPicking) {
      this.picking = s.schemaPicking;
      // Step back to see the neighbouring sectors and pick one.
      if (s.schemaPicking) {
        // Phone: the sectors around the current view, large enough to read and tap, above the list.
        // Seen in relief, tilted enough to read the valleys, not so much that far sectors shrink.
        if (isPhoneLayout()) map.easeTo({ zoom: Math.min(map.getZoom(), 7.4), pitch: 40, padding: phonePadding(), duration: 900 });
        else map.easeTo({ zoom: Math.min(map.getZoom(), 8.2), pitch: 40, duration: 900 });
      }
    }
    this.touring = s.tourStep !== null;
    this.refreshPick();
    if (!prev || prev.readability !== s.readability || prev.revealed !== s.revealed) {
      this.readability = s.readability;
      this.revealed = s.revealed;
      this.refreshTiers(true);
    }
    if (prev && prev.schema3d !== s.schema3d && s.schemaMassif) {
      this.threeD = s.schema3d;
      map.easeTo({ pitch: s.schema3d ? 52 : 0, duration: 900 });
    }
    this.threeD = s.schema3d;
    if (prev && prev.schemaMassif === s.schemaMassif && prev.schemaPhase === s.schemaPhase) return;
    if (!s.schemaMassif) {
      if (this.massif) this.exit();
      return;
    }
    const entering = this.massif !== s.schemaMassif;
    this.massif = s.schemaMassif;
    this.refreshPick();
    this.render(s.schemaMassif, s.schemaPhase);
    this.refreshTiers(true);
    this.setVisible(true);
    if (entering) {
      if (!this.savedCamera) {
        const c = map.getCenter();
        this.savedCamera = { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
      }
      const m = this.ctx.atlas.massifs.find((x) => x.id === s.schemaMassif);
      if (m) {
        map.fitBounds(
          [
            [m.bbox[0], m.bbox[1]],
            [m.bbox[2], m.bbox[3]],
          ],
          { padding: isPhoneLayout() ? phonePadding() : { top: 110, bottom: 110, left: 410, right: 40 }, absolutePadding: true, pitch: this.threeD ? 52 : 0, bearing: this.threeD ? map.getBearing() : 0, duration: 1600, maxZoom: 12 },
        );
      }
    }
  }

  private exit(): void {
    const map = this.ctx!.map;
    this.massif = null;
    this.refreshPick();
    this.setVisible(false);
    if (this.savedCamera) map.easeTo({ ...this.savedCamera, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 1400 });
    this.savedCamera = null;
  }

  private render(massifId: string, phase: SchemaPhase): void {
    const { map, atlas } = this.ctx!;
    const m = atlas.massifs.find((x) => x.id === massifId);
    if (!m) return;
    const slot = SCHEMA_PHASES.find((p) => p.key === phase)!.hours;
    // Context margin: neighbours within ~15 km are drawn faded to show the transitions.
    const pad = 0.15;
    const [w, s, e, n] = [m.bbox[0] - pad, m.bbox[1] - pad, m.bbox[2] + pad, m.bbox[3] + pad];
    const inBox = (f: AtlasFeature) => {
      const cs = f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates;
      return cs.some(([x, y]) => x >= w && x <= e && y >= s && y <= n);
    };
    // The 3 routes most contained in the sector (classic local routes first).
    const [bw, bs, be, bn] = m.bbox;
    const share = (f: AtlasFeature) => {
      const cs = f.geometry.coordinates as [number, number][];
      return cs.filter(([x, y]) => x >= bw && x <= be && y >= bs && y <= bn).length / cs.length;
    };
    const localRoutes = new Set(
      atlas.features.routes
        .filter((f) => share(f) >= 0.6)
        .sort((a, b) => share(b) - share(a))
        .slice(0, 3)
        .map((f) => f.properties.id),
    );
    const out: GeoJSON.Feature[] = [];
    for (const cat of Object.keys(atlas.features) as FeatureCategory[]) {
      for (const f of atlas.features[cat]) {
        const p = f.properties;
        const own = p.massif === massifId;
        // The whole-Alps overview shows only its own large-scale items; a sector shows its neighbours' edges.
        if (!own && (massifId === OVERVIEW || !inBox(f))) continue;
        // Hotspots known only from GPS tracks stay on the live map: the diagram teaches documented phenomena.
        if (p.origin === 'kk7') continue;
        // Neighbours lend their lines only (the transitions): their points belong to their own page.
        if (!own && f.geometry.type === 'Point') continue;
        if (cat === 'breezes' && !activeInSlot(p.windowStart, p.windowEnd, slot)) continue;
        // Routes: only the sector's own classic routes, not every cross passing by.
        if (cat === 'routes' && massifId !== OVERVIEW && !localRoutes.has(p.id)) continue;
        let label = shortLabel(p.name);
        if (cat === 'breezes') label = `${shortLabel(p.name)} · ${p.speedKmh ?? '?'} km/h`;
        else if (cat === 'thermals') {
          const role = thermalRole(p.description);
          label = [shortLabel(p.name), role && `${role === 'plafond' ? '▲' : role === 'relance' ? '↻' : '◆'} ${role}`, p.details?.Heures].filter(Boolean).join(' · ');
        }
        else if (cat === 'takeoffs' && p.details?.Orientation) label = `${shortLabel(p.name)} · ${p.details.Orientation}`;
        else if (cat === 'routes' && p.details?.Distance) label = `${shortLabel(p.name)} · ${p.details.Distance}`;
        out.push({
          type: 'Feature',
          geometry: f.geometry,
          properties: {
            id: p.id,
            category: cat,
            kind: p.kind ?? '',
            name: p.name,
            label,
            speedKmh: p.speedKmh ?? 12,
            confidence: p.confidence ?? 'medium',
            icon: POINT_ICONS[cat] ?? 'hazard',
            own,
            ...sortProps(f),
          },
        });
      }
    }
    out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: m.center }, properties: { category: 'title', label: m.shortName.toUpperCase(), own: true } });
    (map.getSource('schema') as GeoJSONSource).setData({ type: 'FeatureCollection', features: out });
    // The veil covers the whole view so only the diagram reads.
    (map.getSource('schema-veil') as GeoJSONSource).setData({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [2, 42],
            [11, 42],
            [11, 48],
            [2, 48],
            [2, 42],
          ],
        ],
      },
      properties: {},
    });
  }

  private baseOpacity = new Map<string, unknown>();

  /** Emphasises some items (guided visit) and dims the rest; an empty list restores the schema. */
  highlight(ids: string[]): void {
    const map = this.ctx?.map;
    if (!map || !map.getLayer('schema-hl-line')) return;
    // What a visit step talks about is drawn whatever its tier.
    this.highlighted = ids;
    this.refreshTiers(true);
    const list = ['literal', ids];
    map.setFilter('schema-hl-line', ['in', ['get', 'id'], list] as unknown as FilterSpecification);
    map.setFilter('schema-hl-point', ['all', ['==', ['geometry-type'], 'Point'], ['in', ['get', 'id'], list]] as unknown as FilterSpecification);
    const dimmed: [string, string][] = [
      ['schema-breeze', 'line-opacity'],
      ['schema-breeze-arrows', 'icon-opacity'],
      ['schema-conv-glow', 'line-opacity'],
      ['schema-conv', 'icon-opacity'],
      ['schema-routes', 'line-opacity'],
      ['schema-route-label', 'text-opacity'],
      ['schema-points', 'icon-opacity'],
      ['schema-points', 'text-opacity'],
      ['schema-breeze-label', 'text-opacity'],
    ];
    for (const [layer, prop] of dimmed) {
      const key = `${layer}|${prop}`;
      if (!this.baseOpacity.has(key)) this.baseOpacity.set(key, map.getPaintProperty(layer, prop as never) ?? 1);
      const base = this.baseOpacity.get(key);
      // Routes the step does not talk about are hidden: overlapping dashed paths read as
      // branches of the one it describes.
      const others = layer.startsWith('schema-route') ? 0 : ['*', 0.28, base];
      const value = ids.length ? ['case', ['in', ['get', 'id'], list], base, others] : base;
      map.setPaintProperty(layer, prop as never, value as never);
    }
    const routes = this.ctx!.atlas.features.routes.filter((f) => ids.includes(f.properties.id) && f.geometry.type === 'LineString');
    (map.getSource('schema-route-pts') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: routes.flatMap((f) =>
        (f.geometry.coordinates as [number, number][]).map((c, i) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: c }, properties: { n: String(i + 1) } })),
      ),
    });
  }

  describe(id: string): FeatureDetails | null {
    return this.describeAtlas(id);
  }
}
