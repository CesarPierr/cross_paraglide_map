/**
 * Local knowledge from the research atlas: documented breezes, convergences,
 * hazards, thermal and soaring spots, take-offs, landings, XC routes and
 * massif labels.
 */
import type { ExpressionSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import type { AtlasFeature, FeatureCategory } from '@brises/shared';
import { windowActivity } from '@brises/model';
import type { AppState, LayerKey } from '../../state/store';
import { CATEGORY_LABELS, CONFIDENCE_LABELS, KIND_LABELS } from '@brises/shared';
import { EXPLAIN } from '../../glossary';
import { BREEZE_COLORS, COLORS } from '../palette';
import { bboxOf, type FeatureDetails, type MapModule, type ModuleContext } from './types';

const GROUPS: Partial<Record<LayerKey, string[]>> = {
  breezes: ['breezes-glow', 'breezes-core', 'breezes-core-low', 'breezes-arrows', 'breezes-hit', 'breezes-label'],
  convergences: ['convergences-glow', 'convergences-line', 'convergences-point'],
  hazards: ['hazards'],
  thermals: ['thermals'],
  soaring: ['soaring'],
  takeoffs: ['takeoffs'],
  landings: ['landings'],
  routes: ['routes-line', 'routes-label'],
  labels: ['massif-labels'],
};

/** Short map label: no parenthetical, cut at a dash or comma, at most ~30 characters. */
export function shortLabel(name: string): string {
  let t = name.replace(/\s*\([^)]*\)/g, '').trim();
  if (t.length > 30) t = t.split(/\s[–—-]\s|,|:/)[0].trim();
  return t.length > 32 ? `${t.slice(0, 30).trimEnd()}…` : t || name;
}

export class KnowledgeModule implements MapModule {
  readonly id = 'atlas';
  readonly clickableLayers = ['breezes-hit', 'convergences-line', 'convergences-point', 'hazards', 'thermals', 'soaring', 'takeoffs', 'landings', 'routes-line'];
  private ctx: ModuleContext | null = null;
  private index = new Map<string, AtlasFeature>();

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
    const { map, atlas } = ctx;
    for (const list of Object.values(atlas.features)) for (const f of list) this.index.set(f.properties.id, f);
    for (const cat of Object.keys(atlas.features) as FeatureCategory[]) {
      // Map labels use a short name; the full one stays in the sheet.
      const features = atlas.features[cat].map((f) => ({ ...f, properties: { ...f.properties, label: shortLabel(f.properties.name) } }));
      map.addSource(cat, { type: 'geojson', data: { type: 'FeatureCollection', features } as GeoJSON.FeatureCollection });
    }
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
        paint: { 'line-color': COLORS.route, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 12, 3], 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
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
          'line-opacity': ['*', 0.28, active, conf],
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
            'line-opacity': ['*', 0.75, active, conf],
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
        paint: { 'icon-opacity': ['*', active, conf] },
      },
      'lines',
    );
    ctx.addLayer({ id: 'breezes-hit', type: 'line', source: 'breezes', paint: { 'line-color': '#000', 'line-opacity': 0.001, 'line-width': 18 } }, 'lines');
    ctx.addLayer(
      {
        id: 'convergences-glow',
        type: 'line',
        source: 'convergences',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COLORS.convergence, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 22], 'line-blur': 10, 'line-opacity': 0.4 },
      },
      'lines',
    );
    ctx.addLayer(
      {
        id: 'convergences-line',
        type: 'line',
        source: 'convergences',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f5d0fe', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 3.5], 'line-dasharray': [1, 1.5] },
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

    const point = (id: FeatureCategory, icon: string, minzoom: number, extra: Partial<NonNullable<SymbolLayerSpecification['layout']>> = {}) =>
      ctx.addLayer(
        {
          id,
          type: 'symbol',
          source: id,
          minzoom,
          layout: {
            'icon-image': icon,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.55, 12, 0.95],
            'icon-allow-overlap': true,
            'text-field': ['step', ['zoom'], '', 10.5, ['get', 'label']],
            'text-font': ['Noto Sans Regular'],
            'text-size': 11,
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
            'text-optional': true,
            'text-max-width': 10,
            ...extra,
          },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(15,23,42,0.9)', 'text-halo-width': 1.3 },
        },
        'points',
      );
    // Hundreds of items: they appear as one zooms in, so the overview stays readable.
    point('landings', 'landing', 10);
    point('soaring', 'soaring', 9.5);
    point('thermals', 'thermal', 9);
    point('takeoffs', 'takeoff', 9.5);
    point('hazards', 'hazard', 10);

    ctx.addLayer(
      {
        id: 'breezes-label',
        type: 'symbol',
        source: 'breezes',
        minzoom: 10,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['concat', ['get', 'label'], '  ', ['to-string', ['get', 'speedKmh']], ' km/h'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
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
        layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-offset': [0, -1] },
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
  }

  apply(s: AppState, prev: AppState | null): void {
    const map = this.ctx?.map;
    if (!map) return;
    if (!prev || prev.layers !== s.layers)
      for (const [key, ids] of Object.entries(GROUPS) as [LayerKey, string[]][])
        if (!prev || prev.layers[key] !== s.layers[key]) for (const id of ids) map.setLayoutProperty(id, 'visibility', s.layers[key] ? 'visible' : 'none');
    if (!prev || prev.hour !== s.hour) this.updateActivity(s.hour);
  }

  /** Breezes fade in and out with the hour, following their documented window. */
  private updateActivity(hour: number): void {
    const { map, atlas } = this.ctx!;
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
      sourceIds: p.sources.split(',').filter(Boolean),
      warning: p.coordQuality && p.coordQuality !== 'source' ? 'Position estimée à partir de descriptions : à vérifier sur la fiche FFVL avant usage.' : undefined,
      bbox: bboxOf(coords),
      massifId: p.massif,
      explain: (p.kind && EXPLAIN[p.kind]) || EXPLAIN[p.category],
    };
  }
}
