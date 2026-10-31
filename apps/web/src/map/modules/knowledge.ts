/**
 * Local knowledge from the research atlas: documented breezes, convergences,
 * hazards, thermal and soaring spots, take-offs, landings, XC routes and
 * massif labels.
 */
import { isPhoneLayout } from '../viewport';
import type { ExpressionSpecification, FilterSpecification, GeoJSONSource, SymbolLayerSpecification } from 'maplibre-gl';
import type { AtlasFeature, FeatureCategory } from '@brises/shared';
import { windowActivity } from '@brises/model';
import { useRuntime, type AppState, type LayerKey, type Readability } from '../../state/store';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, KIND_LABELS, ensureImportance } from '@brises/shared';
import { EXPLAIN } from '../../glossary';
import { BREEZE_COLORS, COLORS } from '../palette';
import { maxTierAt, zoomForTier } from '../tiers';
import { bboxOf, type FeatureDetails, type MapModule, type ModuleContext } from './types';

const GROUPS: Partial<Record<LayerKey, string[]>> = {
  breezes: ['breezes-glow', 'breezes-core', 'breezes-core-low', 'breezes-arrows', 'breezes-hit', 'breezes-label'],
  convergences: ['convergences-zone', 'convergences-arrows', 'convergences-point'],
  hazards: ['hazards'],
  thermals: ['thermals', 'thermals-measured', 'thermals-cluster', 'thermals-single', 'thermals-cluster-count'],
  soaring: ['soaring'],
  takeoffs: ['takeoffs'],
  landings: ['landings'],
  routes: ['routes-line', 'routes-label'],
  labels: ['massif-labels'],
};

/** Point categories filtered by tier (lines are always drawn, lighter when secondary). */
const POINT_LAYERS: [string, FeatureCategory, FilterSpecification | null][] = [
  ['landings', 'landings', null],
  ['soaring', 'soaring', null],
  ['thermals', 'thermals', ['!=', ['get', 'origin'], 'kk7']],
  ['thermals-measured', 'thermals', ['==', ['get', 'origin'], 'kk7']],
  ['takeoffs', 'takeoffs', null],
  ['hazards', 'hazards', null],
  ['breezes-label', 'breezes', null],
  ['routes-label', 'routes', null],
];

const tier = ['coalesce', ['get', 'tier'], 2] as ExpressionSpecification;
/** Icon scale by tier: the essentials stand out, the detail stays discreet. */
export const TIER_ICON = ['match', tier, 1, 1.15, 2, 0.88, 0.68] as ExpressionSpecification;
/** Map label by tier and zoom: the essentials from massif scale, the rest closer in. */
export const TIER_TEXT = (label: ExpressionSpecification = ['get', 'label']) =>
  ['step', ['zoom'], ['case', ['==', tier, 1], label, ''], 10.5, ['case', ['<=', tier, 2], label, ''], 12, label] as ExpressionSpecification;
export const TIER_FONT = ['case', ['==', tier, 1], ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]] as ExpressionSpecification;

/**
 * Is the item drawn: its tier is shown at this zoom, its category was asked for (in the
 * sector `massif` when given), or it is the one being read.
 */
export function tierFilter(maxTier: number, revealed: boolean, forced: string[], massif: string | null = null): ExpressionSpecification {
  if (revealed && !massif) return ['literal', true] as unknown as ExpressionSpecification;
  const base: ExpressionSpecification[] = [['<=', tier, maxTier], ['in', ['get', 'id'], ['literal', forced]]];
  if (revealed && massif) base.push(['==', ['get', 'massif'], massif]);
  return ['any', ...base] as ExpressionSpecification;
}

/** Short map label: no parenthetical, cut at a dash or comma, at most ~30 characters. */
export function shortLabel(name: string): string {
  let t = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (t.length > 30) t = t.split(/\s[–—-]\s|,|:/)[0].trim();
  return t.length > 32 ? `${t.slice(0, 30).trimEnd()}…` : t || name;
}

export class KnowledgeModule implements MapModule {
  readonly id = 'atlas';
  readonly clickableLayers = ['breezes-hit', 'convergences-zone', 'convergences-point', 'hazards', 'thermals-cluster', 'thermals-single', 'thermals', 'thermals-measured', 'soaring', 'takeoffs', 'landings', 'routes-line'];
  private ctx: ModuleContext | null = null;
  private index = new Map<string, AtlasFeature>();
  private readability: Readability = 'essentiel';
  private revealed: FeatureCategory[] = [];
  /** Sector whose page asked for whole categories (the live map never reveals a category across the Alps). */
  private revealedIn: string | null = null;
  /** Item open in the sheet: always drawn. */
  private focus: string[] = [];
  private maxTier = 0;
  private phone = false;
  private offRuntime: () => void = () => {};

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
    const { map, atlas } = ctx;
    // An atlas compiled before the ranking gets it now.
    ensureImportance(atlas);
    this.phone = isPhoneLayout();
    for (const list of Object.values(atlas.features)) for (const f of list) this.index.set(f.properties.id, f);
    for (const cat of Object.keys(atlas.features) as FeatureCategory[]) {
      // Map labels use a short name; the full one stays in the sheet. `sk` orders the
      // collisions: the essentials keep their label, the best-ranked first.
      const features = atlas.features[cat].map((f) => ({ ...f, properties: { ...f.properties, label: shortLabel(f.properties.name), ...sortProps(f) } }));
      map.addSource(cat, { type: 'geojson', data: { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection });
    }
    // Thermals not drawn at this zoom gather in numbered bubbles (refreshed when the shown tiers change).
    map.addSource('thermals-more', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      // Wider than in a massif page: the live map shows several sectors at once.
      clusterRadius: 120,
      clusterMaxZoom: 14,
      clusterProperties: { minTier: ['min', ['get', 'tier']], lon: ['+', ['get', 'lon']], lat: ['+', ['get', 'lat']] },
    });
    map.addSource('massif-labels', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: atlas.massifs
          .filter((m) => m.id !== 'alpes-francaises')
          .map((m) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: m.center }, properties: { id: m.id, name: m.shortName } })),
      },
    });

    const kindColor = ['match', ['get', 'kind'], ...Object.entries(BREEZE_COLORS).flat(), '#38bdf8'] as unknown as ExpressionSpecification;
    const active = ['coalesce', ['feature-state', 'active'], 1] as ExpressionSpecification;
    const conf = ['match', ['get', 'confidence'], 'high', 1, 'medium', 0.85, 0.55] as ExpressionSpecification;

    ctx.addLayer(
      {
        id: 'routes-line',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.route, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 3], 'line-dasharray': [2, 2], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.45, 11, 0.9] },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'breezes-glow',
        type: 'line',
        source: 'breezes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': kindColor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, ['*', 0.25, ['get', 'speedKmh']], 12, ['*', 1.1, ['get', 'speedKmh']]],
          'line-blur': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 12],
          'line-opacity': lighter(['*', 0.28, active, conf]),
        },
      },
      'lines',
    );
    // Sourced breezes are solid, deductions (low confidence) dashed.
    for (const [id, low] of [
      ['breezes-core', false],
      ['breezes-core-low', true],
    ] as const)
      ctx.addLayer(
        {
          id,
          type: 'line',
          source: 'breezes',
          filter: low ? ['==', ['get', 'confidence'], 'low'] : ['!=', ['get', 'confidence'], 'low'],
          layout: { 'line-cap': low ? 'butt' : 'round', 'line-join': 'round' },
          paint: {
            'line-color': kindColor,
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 2.5],
            'line-opacity': lighter(['*', 0.75, active, conf]),
            ...(low ? { 'line-dasharray': [2, 2] } : {}),
          },
        },
        'lines',
      );
    ctx.addLayer(
      {
        id: 'breezes-arrows',
        type: 'symbol',
        source: 'breezes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 7, 70, 13, 160],
          'icon-image': 'breeze-arrow',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 13, 0.95],
          'icon-allow-overlap': true,
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
        },
        paint: { 'icon-opacity': lighter(['*', active, conf]) },
      },
      'lines',
    );
    ctx.addLayer({ id: 'breezes-hit', type: 'line', source: 'breezes', paint: { 'line-color': '#000', 'line-opacity': 0.001, 'line-width': 18 } }, 'lines');
    // A convergence is a zone where two flows meet and rise, not a line: a soft band,
    // with arrows from both sides towards its middle; brighter during its hours.
    const convActive = ['coalesce', ['feature-state', 'active'], 1];
    ctx.addLayer(
      {
        id: 'convergences-zone',
        type: 'line',
        source: 'convergences',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': COLORS.convergence,
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 6, 8, 9, 22, 12, 70],
          'line-blur': ['interpolate', ['exponential', 1.6], ['zoom'], 6, 5, 9, 12, 12, 34],
          'line-opacity': lighter(['*', 0.5, ['+', 0.25, ['*', 0.75, convActive]]] as unknown as ExpressionSpecification),
        },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'convergences-arrows',
        type: 'symbol',
        source: 'convergences',
        minzoom: 8,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 8, 80, 12, 140],
          'icon-image': 'convergence-arrows',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 1.3],
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': ['+', 0.15, ['*', 0.85, convActive]] as never },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'convergences-point',
        type: 'circle',
        source: 'convergences',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 16],
          'circle-color': 'rgba(232,121,249,0.3)',
          'circle-stroke-color': '#f5d0fe',
          'circle-stroke-width': 2,
          'circle-pitch-alignment': 'map',
        },
      },
      'lines',
    );

    // A phone shows the same zoom on a screen four times smaller: points come in a little later there.
    const later = this.phone ? 0.8 : 0;
    const point = (id: FeatureCategory, icon: string, extra: Partial<NonNullable<SymbolLayerSpecification['layout']>> = {}) =>
      ctx.addLayer(
        {
          id,
          type: 'symbol',
          source: id,
          minzoom: 8.8 + later,
          layout: {
            'icon-image': icon,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 7, ['*', 0.55, TIER_ICON], 12, ['*', 0.95, TIER_ICON]],
            'icon-allow-overlap': true,
            // Labels never overlap: the essentials and the best-ranked keep theirs.
            'text-field': TIER_TEXT(),
            'text-font': TIER_FONT,
            'text-size': ['match', tier, 1, 12, 11],
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
            'text-optional': true,
            'text-max-width': 10,
            'text-padding': 3,
            'symbol-sort-key': ['get', 'sk'],
            ...extra,
          },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(15,23,42,0.9)', 'text-halo-width': 1.3 },
        },
        'labels',
      );
    // Thousands of items: the essentials show at massif scale, the rest as one zooms in (see map/tiers.ts).
    // In the top slot: placed before the directory sites' icons, which would otherwise take their names' room.
    point('landings', 'landing');
    point('soaring', 'soaring');
    // Thermals not shown yet: one bubble per group, with their number; a tap opens it.
    ctx.addLayer(
      {
        id: 'thermals-cluster',
        type: 'circle',
        source: 'thermals-more',
        minzoom: 8.8 + later,
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 10, 5, 12.5, 15, 15],
          'circle-color': 'rgba(251,146,60,0.82)',
          'circle-stroke-color': '#fff7ed',
          'circle-stroke-width': 1.6,
          'circle-pitch-alignment': 'viewport',
        },
      },
      'labels',
    );
    // A lone thermal not shown yet: a small dot, from valley scale (the overview keeps to the bubbles).
    ctx.addLayer(
      {
        id: 'thermals-single',
        type: 'circle',
        source: 'thermals-more',
        minzoom: 10.5 + later,
        filter: ['!', ['has', 'point_count']],
        paint: { 'circle-radius': 3.5, 'circle-color': 'rgba(251,146,60,0.6)', 'circle-stroke-color': 'rgba(255,247,237,0.7)', 'circle-stroke-width': 1, 'circle-pitch-alignment': 'viewport' },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'thermals-cluster-count',
        type: 'symbol',
        source: 'thermals-more',
        minzoom: 8.8 + later,
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['to-string', ['get', 'point_count']], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': '#431407' },
      },
      'labels',
    );
    point('thermals', 'thermal');
    // Hotspots known only from GPS tracks (kk7): smaller, detail (tier 3).
    ctx.addLayer(
      {
        id: 'thermals-measured',
        type: 'symbol',
        source: 'thermals',
        minzoom: 8.8 + later,
        filter: ['==', ['get', 'origin'], 'kk7'],
        layout: { 'icon-image': 'thermal', 'icon-size': ['interpolate', ['linear'], ['zoom'], 10.5, 0.42, 13, 0.7], 'icon-allow-overlap': true, 'symbol-sort-key': ['-', 1, ['get', 'kk7P']] },
        paint: { 'icon-opacity': 0.72 },
      },
      'labels',
    );
    point('takeoffs', 'takeoff');
    point('hazards', 'hazard');

    ctx.addLayer(
      {
        id: 'breezes-label',
        type: 'symbol',
        source: 'breezes',
        minzoom: 9,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': TIER_TEXT(['concat', ['get', 'label'], '  ', ['to-string', ['get', 'speedKmh']], ' km/h'] as ExpressionSpecification),
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'symbol-sort-key': ['get', 'sk'],
          'text-offset': [0, -1.1],
          'text-max-angle': 30,
        },
        paint: { 'text-color': '#e0f2fe', 'text-halo-color': 'rgba(8,47,73,0.9)', 'text-halo-width': 1.4, 'text-opacity': active },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'routes-label',
        type: 'symbol',
        source: 'routes',
        minzoom: 9,
        layout: { 'symbol-placement': 'line-center', 'text-field': TIER_TEXT(), 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-offset': [0, -1], 'symbol-sort-key': ['get', 'sk'] },
        paint: { 'text-color': '#fef3c7', 'text-halo-color': 'rgba(30,20,0,0.85)', 'text-halo-width': 1.3 },
      },
      'labels',
    );
    ctx.addLayer(
      {
        id: 'massif-labels',
        type: 'symbol',
        source: 'massif-labels',
        maxzoom: 10,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 9, 15],
          'text-letter-spacing': 0.04,
          'text-max-width': 8,
          'text-padding': 6,
        },
        paint: { 'text-color': '#fff7e0', 'text-halo-color': 'rgba(20,16,8,0.7)', 'text-halo-width': 1.6, 'text-halo-blur': 0.5, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.95, 10, 0] },
      },
      'labels',
    );
    // The shown tiers follow the zoom; filters change only when a threshold is crossed.
    map.on('zoom', () => this.refresh());
    this.offRuntime = useRuntime.subscribe((r, p) => {
      if (r.feature === p.feature) return;
      const ref = r.feature?.ref;
      this.focus = ref?.startsWith('atlas:') ? [ref.slice(6)] : [];
      this.refresh(true);
    });
    this.refresh(true);
  }

  /** Applies the tiers shown at this zoom (and the categories asked for) to the point layers and the thermal bubbles. */
  private refresh(force = false): void {
    const map = this.ctx?.map;
    if (!map) return;
    const max = maxTierAt(map.getZoom(), this.readability, this.phone);
    if (!force && max === this.maxTier) return;
    this.maxTier = max;
    for (const [id, cat, base] of POINT_LAYERS) {
      const f = tierFilter(max, !!this.revealedIn && this.revealed.includes(cat), this.focus, this.revealedIn);
      map.setFilter(id, (base ? ['all', base, f] : f) as FilterSpecification);
    }
    const open = this.revealedIn && this.revealed.includes('thermals') ? this.revealedIn : null;
    const hidden = this.ctx!.atlas.features.thermals.filter((f) => (f.properties.tier ?? 2) > max && !this.focus.includes(f.properties.id) && f.properties.massif !== open);
    (map.getSource('thermals-more') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: hidden.map((f) => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: { id: f.properties.id, name: f.properties.name, tier: f.properties.tier ?? 2, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] },
      })) as GeoJSON.Feature[],
    });
  }

  /** A bubble of hidden thermals opens on a tap: zoom in until they show (or the group splits). */
  select(_id: string, props: Record<string, unknown>): boolean {
    if (!props.cluster) return false;
    const map = this.ctx!.map;
    const n = Number(props.point_count) || 1;
    const center: [number, number] = [Number(props.lon) / n, Number(props.lat) / n];
    const minTier = Number(props.minTier) || 2;
    void (map.getSource('thermals-more') as GeoJSONSource)
      .getClusterExpansionZoom(Number(props.cluster_id))
      .then((z) => map.easeTo({ center, zoom: Math.min(14, Math.max(z, zoomForTier(minTier, this.readability, this.phone)) + 0.05), duration: 700 }));
    return true;
  }

  dispose(): void {
    this.offRuntime();
  }

  apply(s: AppState, prev: AppState | null): void {
    const map = this.ctx?.map;
    if (!map) return;
    if (!prev || prev.readability !== s.readability || prev.revealed !== s.revealed || prev.selectedMassif !== s.selectedMassif) {
      this.readability = s.readability;
      this.revealed = s.revealed;
      this.revealedIn = s.selectedMassif;
      this.refresh(true);
    }
    if (!prev || prev.layers !== s.layers)
      for (const [key, ids] of Object.entries(GROUPS) as [LayerKey, string[]][])
        if (!prev || prev.layers[key] !== s.layers[key]) for (const id of ids) map.setLayoutProperty(id, 'visibility', s.layers[key] ? 'visible' : 'none');
    if (!prev || prev.hour !== s.hour) this.updateActivity(s.hour);
  }

  /** Breezes and convergences fade in and out with the hour, following their documented window. */
  private updateActivity(hour: number): void {
    const { map, atlas } = this.ctx!;
    for (const f of atlas.features.convergences) {
      const p = f.properties;
      // Without documented hours: the afternoon, when breezes meet.
      const w: [number, number] = p.windowStart !== undefined && p.windowEnd !== undefined ? [p.windowStart, p.windowEnd] : [12, 18];
      map.setFeatureState({ source: 'convergences', id: f.id! }, { active: windowActivity(hour, w) });
    }
    for (const f of atlas.features.breezes) {
      const p = f.properties;
      const w: [number, number] = p.windowStart !== undefined && p.windowEnd !== undefined ? [p.windowStart, p.windowEnd] : [11, 19];
      map.setFeatureState({ source: 'breezes', id: f.id! }, { active: 0.12 + 0.88 * windowActivity(hour, w) });
    }
  }

  get(id: string): AtlasFeature | undefined {
    return this.index.get(id);
  }

  describe(id: string): FeatureDetails | null {
    const f = this.index.get(id);
    if (!f) return null;
    const p = f.properties;
    const coords = f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const badges: FeatureDetails['badges'] = [];
    if (p.kind && KIND_LABELS[p.kind]) badges.push({ label: KIND_LABELS[p.kind], tone: 'info' });
    if (p.confidence) badges.push({ label: CONFIDENCE_LABELS[p.confidence], tone: p.confidence === 'high' ? 'ok' : p.confidence === 'medium' ? 'warn' : 'bad' });
    if (p.tier === 1) badges.push({ label: 'Essentiel du secteur', tone: 'info' });
    return {
      ref: `${this.id}:${id}`,
      category: CATEGORY_LABELS[p.category],
      title: p.name,
      badges,
      stat:
        p.category === 'breezes' && p.speedKmh !== undefined
          ? `≈ ${p.speedKmh} km/h${p.windowStart !== undefined ? ` · active ${p.windowStart}h → ${p.windowEnd}h` : ''}`
          : undefined,
      details: p.details ? Object.entries(p.details) : undefined,
      paragraphs: p.description ? p.description.split('\n\n') : undefined,
      possible: p.possible,
      sourceIds: p.sources.split(',').filter(Boolean),
      warning: p.coordQuality && p.coordQuality !== 'source' ? 'Position estimée à partir de descriptions : à vérifier sur la fiche FFVL avant usage.' : undefined,
      bbox: bboxOf(coords),
      massifId: p.massif,
      explain: (p.kind && EXPLAIN[p.kind]) || EXPLAIN[p.category],
    };
  }
}

/** Sort key of an item for the label collisions: essentials first, then by rank. */
export function sortProps(f: AtlasFeature): { tier: number; sk: number } {
  const t = f.properties.tier ?? 2;
  return { tier: t, sk: t * 1000 - (f.properties.rank ?? 0) };
}

/** Secondary lines are lighter at massif scale and reach full strength closer in. */
function lighter(base: ExpressionSpecification): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], 8, ['*', base, ['match', tier, 1, 1, 0.45]], 11, ['*', base, ['match', tier, 1, 1, 0.85]], 12.5, base] as ExpressionSpecification;
}
