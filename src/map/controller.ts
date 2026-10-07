/**
 * Imperative owner of the MapLibre map: style, data layers, wind model worker
 * and particle layer. React talks to it through `apply(state)`; the render
 * loop never goes through React.
 */
import {
  GeolocateControl,
  Map as MlMap,
  Marker,
  NavigationControl,
  ScaleControl,
  type ExpressionSpecification,
  type ImageSource,
  type LayerSpecification,
  type MapMouseEvent,
  type SymbolLayerSpecification,
} from 'maplibre-gl';
import type { Atlas, AtlasFeature, FeatureCategory } from '../data/atlas-types';
import { ModelClient, type FieldMessage, type ProbeMessage } from '../engine/model-client';
import { windowActivity, type ModelParams } from '../model/field';
import { Grid, type GridMeta } from '../model/grid';
import type { OverlayMode } from '../model/overlays';
import { CURRENT_YEAR, type AppState, type Basemap, type LayerKey } from '../state/store';
import { addIcons } from './icons';
import { buildStyle, LABEL_LAYERS } from './style';
import { WindParticleLayer, type ParticleSettings } from './wind-particles';

const EMPTY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export const BREEZE_COLORS: Record<string, string> = {
  valley: '#38bdf8',
  downvalley: '#818cf8',
  slope: '#fbbf24',
  'plain-to-mountain': '#2dd4bf',
  lake: '#7dd3fc',
  'pass-transfer': '#f472b6',
  regional: '#5eead4',
  katabatic: '#a5b4fc',
};

const CLICKABLE_LAYERS = [
  'breezes-hit',
  'convergences-line',
  'convergences-point',
  'hazards',
  'thermals',
  'soaring',
  'takeoffs',
  'landings',
  'routes-line',
] as const;

export interface ControllerEvents {
  onAtlas: (atlas: Atlas) => void;
  onStatus: (status: { phase: 'loading' | 'terrain' | 'ready' | 'computing' | 'error'; message?: string }) => void;
  onField: (info: { sun: FieldMessage['sun']; solarHour: number; ms: number }) => void;
  onFeatureClick: (id: string | null) => void;
  onProbe: (probe: { lon: number; lat: number; result: ProbeMessage } | null) => void;
}

export class MapController {
  readonly map: MlMap;
  private model = new ModelClient();
  private grid: Grid | null = null;
  private particles: WindParticleLayer | null = null;
  private atlas: Atlas | null = null;
  private featureIndex = new Map<string, AtlasFeature>();
  private state: AppState | null = null;
  private ready = false;
  private computing = false;
  private dirty = false;
  private computeTimer = 0;
  private dashTimer = 0;
  private overlayUrl: string | null = null;
  private probeMarker: Marker | null = null;
  private lastProbe: { lon: number; lat: number } | null = null;
  private selectedFeatureNum: { source: string; id: number } | null = null;

  constructor(
    container: HTMLElement,
    private events: ControllerEvents,
  ) {
    this.map = new MlMap({
      container,
      style: buildStyle(),
      center: [6.2, 45.25],
      zoom: 7.4,
      pitch: 55,
      bearing: -15,
      maxPitch: 85,
      maxBounds: [
        [2.5, 42.3],
        [10.5, 47.6],
      ],
      hash: true,
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true },
    });
    this.map.addControl(new NavigationControl({ visualizePitch: true, showCompass: true }), 'bottom-right');
    this.map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
    this.map.addControl(new GeolocateControl({ trackUserLocation: false }), 'bottom-right');
    this.map.on('load', () => void this.onLoad());
    this.map.on('error', (e) => {
      // Missing tiles (e.g. IGN outside France) are expected; keep the console quiet.
      if ((e.error as { status?: number } | undefined)?.status) return;
      console.warn(e.error);
    });
  }

  private async onLoad(): Promise<void> {
    const map = this.map;
    this.events.onStatus({ phase: 'loading', message: 'Chargement du relief…' });
    map.setTerrain({ source: 'terrain', exaggeration: this.state?.exaggeration ?? 1.2 });
    addIcons(map);
    try {
      const [meta, atlas] = await Promise.all([
        fetch('data/dem.json').then((r) => r.json() as Promise<GridMeta>),
        fetch('data/atlas.json').then((r) => r.json() as Promise<Atlas>),
      ]);
      this.atlas = atlas;
      this.events.onAtlas(atlas);
      for (const list of Object.values(atlas.features)) for (const f of list) this.featureIndex.set(f.properties.id, f);
      this.grid = new Grid(meta);
      this.addDataLayers(atlas);
      this.events.onStatus({ phase: 'terrain', message: 'Analyse du relief (vallées, pentes, lacs)…' });
      const demUrl = new URL('data/dem.png', document.baseURI).href;
      const { elevation } = await this.model.init(demUrl, meta);
      await this.model.setCurated(atlas.curated);
      this.particles = new WindParticleLayer(this.grid, this.particleSettings());
      this.particles.setElevation(elevation);
      map.addLayer(this.particles, 'hazards');
      this.ready = true;
      if (this.state) this.apply(this.state, null);
      this.scheduleCompute(0);
    } catch (err) {
      console.error(err);
      this.events.onStatus({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
    }
    map.on('click', (e) => this.onClick(e));
    for (const id of CLICKABLE_LAYERS) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    }
    this.startDashAnimation();
  }

  private addDataLayers(atlas: Atlas): void {
    const map = this.map;
    const fc = (cat: FeatureCategory) => ({ type: 'FeatureCollection' as const, features: atlas.features[cat] });
    for (const cat of Object.keys(atlas.features) as FeatureCategory[]) map.addSource(cat, { type: 'geojson', data: fc(cat) });
    map.addSource('model-overlay', { type: 'image', url: EMPTY_PNG, coordinates: this.grid!.corners() });
    map.addSource('massif-labels', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: atlas.massifs.map((m) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: m.center }, properties: { id: m.id, name: m.name } })),
      },
    });

    map.addLayer({
      id: 'model-overlay',
      type: 'raster',
      source: 'model-overlay',
      paint: { 'raster-opacity': 0.85, 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
    });

    // XC routes.
    map.addLayer({
      id: 'routes-line',
      type: 'line',
      source: 'routes',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: { 'line-color': '#fde68a', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 12, 3], 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
    });

    // Breezes: glow + animated core + arrows. Opacity follows the hour (feature-state "active").
    const kindColor = ['match', ['get', 'kind'], ...Object.entries(BREEZE_COLORS).flat(), '#38bdf8'] as unknown as ExpressionSpecification;
    const active = ['coalesce', ['feature-state', 'active'], 1] as ExpressionSpecification;
    const conf = ['match', ['get', 'confidence'], 'high', 1, 'medium', 0.85, 0.6] as ExpressionSpecification;
    map.addLayer({
      id: 'breezes-glow',
      type: 'line',
      source: 'breezes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': kindColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, ['*', 0.25, ['get', 'speedKmh']], 12, ['*', 1.1, ['get', 'speedKmh']]],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 12],
        'line-opacity': ['*', 0.35, active, conf],
      },
    });
    map.addLayer({
      id: 'breezes-core',
      type: 'line',
      source: 'breezes',
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': kindColor,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 4],
        'line-opacity': ['*', 0.95, active, conf],
        'line-dasharray': [0, 4, 3],
      },
    });
    map.addLayer({
      id: 'breezes-arrows',
      type: 'symbol',
      source: 'breezes',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 7, 60, 13, 140],
        'icon-image': 'breeze-arrow',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.55, 13, 1],
        'icon-allow-overlap': true,
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
      },
      paint: { 'icon-opacity': ['*', active, conf] },
    });
    map.addLayer({
      id: 'breezes-hit',
      type: 'line',
      source: 'breezes',
      paint: { 'line-color': '#000', 'line-opacity': 0.001, 'line-width': 18 },
    });
    map.addLayer({
      id: 'breezes-label',
      type: 'symbol',
      source: 'breezes',
      minzoom: 9.5,
      layout: {
        'symbol-placement': 'line-center',
        'text-field': ['concat', ['get', 'name'], ' · ', ['to-string', ['get', 'speedKmh']], ' km/h'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
        'text-offset': [0, -1.1],
        'text-max-angle': 30,
      },
      paint: { 'text-color': '#e0f2fe', 'text-halo-color': 'rgba(8,47,73,0.9)', 'text-halo-width': 1.4, 'text-opacity': active },
    });

    // Convergences.
    map.addLayer({
      id: 'convergences-glow',
      type: 'line',
      source: 'convergences',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#e879f9', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 22], 'line-blur': 10, 'line-opacity': 0.45 },
    });
    map.addLayer({
      id: 'convergences-line',
      type: 'line',
      source: 'convergences',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#f5d0fe', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 3.5], 'line-dasharray': [1, 1.5] },
    });
    map.addLayer({
      id: 'convergences-point',
      type: 'circle',
      source: 'convergences',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 16],
        'circle-color': 'rgba(232,121,249,0.35)',
        'circle-stroke-color': '#f5d0fe',
        'circle-stroke-width': 2,
      },
    });

    const pointLayer = (id: FeatureCategory, icon: string, minzoom = 0, extra: Partial<NonNullable<SymbolLayerSpecification['layout']>> = {}) =>
      map.addLayer({
        id,
        type: 'symbol',
        source: id,
        minzoom,
        layout: {
          'icon-image': icon,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 12, 1],
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 10.5, ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
          ...extra,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(15,23,42,0.9)', 'text-halo-width': 1.3 },
      });
    pointLayer('landings', 'landing', 8);
    pointLayer('soaring', 'soaring', 7);
    pointLayer('thermals', 'thermal', 6);
    pointLayer('takeoffs', 'takeoff', 7);
    pointLayer('hazards', 'hazard', 7);

    for (const l of LABEL_LAYERS) map.addLayer(l as LayerSpecification);
    map.addLayer({
      id: 'massif-labels',
      type: 'symbol',
      source: 'massif-labels',
      maxzoom: 10,
      layout: {
        'text-field': ['upcase', ['get', 'name']],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 9, 14],
        'text-letter-spacing': 0.12,
        'text-max-width': 9,
      },
      paint: { 'text-color': '#fef3c7', 'text-halo-color': 'rgba(30,20,0,0.75)', 'text-halo-width': 1.6, 'text-opacity': 0.9 },
    });
  }

  /** Marching-dash animation of breeze lines (direction of the flow). */
  private startDashAnimation(): void {
    const seq: number[][] = [
      [0, 4, 3],
      [0.5, 4, 2.5],
      [1, 4, 2],
      [1.5, 4, 1.5],
      [2, 4, 1],
      [2.5, 4, 0.5],
      [3, 4, 0],
      [0, 0.5, 3, 3.5],
      [0, 1, 3, 3],
      [0, 1.5, 3, 2.5],
      [0, 2, 3, 2],
      [0, 2.5, 3, 1.5],
      [0, 3, 3, 1],
      [0, 3.5, 3, 0.5],
    ];
    let step = 0;
    const tick = () => {
      if (this.map.getLayer('breezes-core') && this.state?.layers.breezes) {
        step = (step + 1) % seq.length;
        this.map.setPaintProperty('breezes-core', 'line-dasharray', seq[step]);
      }
    };
    this.dashTimer = window.setInterval(tick, 90);
  }

  private particleSettings(): ParticleSettings {
    const s = this.state;
    return {
      count: s?.particleCount ?? 12000,
      heightMode: s?.heightMode ?? 'agl',
      heightM: s ? (s.heightMode === 'agl' ? s.heightAgl : s.heightAsl) : 80,
      colorMode: s?.particleColor ?? 'speed',
      speed: s?.particleSpeed ?? 1,
      exaggeration: s?.exaggeration ?? 1.2,
    };
  }

  private modelParams(s: AppState): ModelParams {
    return {
      year: CURRENT_YEAR,
      month0: s.month0,
      day: s.day,
      hour: s.hour,
      synoptic: { fromDeg: s.synopticFrom, speedKmh: s.synopticKmh },
      height: { mode: s.heightMode, meters: s.heightMode === 'agl' ? s.heightAgl : s.heightAsl },
      breezeScale: s.breezeScale,
    };
  }

  private scheduleCompute(delay = 60): void {
    window.clearTimeout(this.computeTimer);
    this.computeTimer = window.setTimeout(() => void this.compute(), delay);
  }

  private async compute(): Promise<void> {
    if (!this.ready || !this.state) return;
    if (this.computing) {
      this.dirty = true;
      return;
    }
    this.computing = true;
    this.dirty = false;
    this.events.onStatus({ phase: 'computing' });
    const s = this.state;
    try {
      const res = await this.model.compute(this.modelParams(s), s.overlay);
      this.particles?.setField(res.field);
      this.setOverlay(res.overlay, s.overlay);
      this.events.onField({ sun: res.sun, solarHour: res.solarHour, ms: res.ms });
      if (this.lastProbe) void this.probe(this.lastProbe.lon, this.lastProbe.lat, false);
      this.events.onStatus({ phase: 'ready' });
    } catch (err) {
      this.events.onStatus({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      this.computing = false;
      if (this.dirty) this.scheduleCompute(0);
    }
  }

  private setOverlay(blob: Blob | null, mode: OverlayMode): void {
    const src = this.map.getSource('model-overlay') as ImageSource | undefined;
    if (!src || !this.grid) return;
    if (this.overlayUrl) URL.revokeObjectURL(this.overlayUrl);
    this.overlayUrl = blob ? URL.createObjectURL(blob) : null;
    src.updateImage({ url: this.overlayUrl ?? EMPTY_PNG, coordinates: this.grid.corners() });
    this.map.setLayoutProperty('model-overlay', 'visibility', mode === 'none' ? 'none' : 'visible');
  }

  /** Push the React state into the map; `prev` lets us skip unchanged parts. */
  apply(s: AppState, prev: AppState | null): void {
    this.state = s;
    if (!this.map.isStyleLoaded() && !this.ready) return;
    const map = this.map;
    const changed = <K extends keyof AppState>(k: K) => !prev || prev[k] !== s[k];

    if (changed('basemap')) this.setBasemap(s.basemap);
    if (changed('exaggeration') && map.getTerrain()) map.setTerrain({ source: 'terrain', exaggeration: s.exaggeration });
    if (changed('layers') || !prev) this.applyLayers(s.layers);
    if (this.particles) {
      this.particles.setSettings(this.particleSettings());
      this.particles.setEnabled(s.layers.particles);
    }
    if (changed('hour') || changed('month0') || !prev) this.updateBreezeActivity(s.hour);
    const modelKeys: (keyof AppState)[] = ['hour', 'month0', 'day', 'synopticFrom', 'synopticKmh', 'heightMode', 'heightAgl', 'heightAsl', 'breezeScale', 'overlay'];
    if (!prev || modelKeys.some((k) => prev[k] !== s[k])) this.scheduleCompute(s.playing ? 0 : 80);
  }

  private setBasemap(b: Basemap): void {
    const vis = (id: string, on: boolean) => this.map.getLayer(id) && this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('bm-s2', b === 's2' || b === 'ign-ortho');
    vis('bm-ign-ortho', b === 'ign-ortho');
    vis('bm-ign-plan', b === 'ign-plan');
    vis('bm-otm', b === 'otm');
  }

  private applyLayers(layers: Record<LayerKey, boolean>): void {
    const groups: Partial<Record<LayerKey, string[]>> = {
      breezes: ['breezes-glow', 'breezes-core', 'breezes-arrows', 'breezes-hit', 'breezes-label'],
      convergences: ['convergences-glow', 'convergences-line', 'convergences-point'],
      hazards: ['hazards'],
      thermals: ['thermals'],
      soaring: ['soaring'],
      takeoffs: ['takeoffs'],
      landings: ['landings'],
      routes: ['routes-line'],
      labels: ['lbl-peaks', 'lbl-places', 'massif-labels'],
      kk7Thermals: ['kk7-thermals'],
      kk7Skyways: ['kk7-skyways'],
      hillshade: ['hillshade'],
    };
    for (const [key, ids] of Object.entries(groups) as [LayerKey, string[]][]) {
      for (const id of ids) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', layers[key] ? 'visible' : 'none');
    }
  }

  /** Fade breezes in/out with the hour, using their documented time window. */
  private updateBreezeActivity(hour: number): void {
    if (!this.atlas || !this.map.getSource('breezes')) return;
    for (const f of this.atlas.features.breezes) {
      const p = f.properties;
      let a: number;
      if (p.windowStart !== undefined && p.windowEnd !== undefined) a = windowActivity(hour, [p.windowStart, p.windowEnd]);
      else a = windowActivity(hour, [11, 19]);
      this.map.setFeatureState({ source: 'breezes', id: f.id! }, { active: 0.12 + 0.88 * a });
    }
  }

  /** Sun direction drives the hillshade so slopes light up as in reality. */
  setSun(azimuth: number, elevation: number): void {
    if (!this.map.getLayer('hillshade')) return;
    this.map.setPaintProperty('hillshade', 'hillshade-illumination-direction', azimuth);
    const night = elevation < 0;
    this.map.setPaintProperty('hillshade', 'hillshade-shadow-color', night ? 'rgba(5,10,30,0.75)' : `rgba(10,18,40,${0.35 + 0.3 * Math.max(0, 1 - elevation / 60)})`);
    this.map.setPaintProperty('hillshade', 'hillshade-exaggeration', night ? 0.2 : 0.35 + 0.35 * Math.max(0, 1 - elevation / 70));
  }

  private onClick(e: MapMouseEvent): void {
    const hits = this.map.queryRenderedFeatures(e.point, { layers: CLICKABLE_LAYERS.filter((l) => this.map.getLayer(l)) as string[] });
    if (hits.length) {
      const id = hits[0].properties?.id as string;
      this.events.onFeatureClick(id);
      this.highlight(hits[0].source, hits[0].id as number);
      return;
    }
    void this.probe(e.lngLat.lng, e.lngLat.lat, true);
  }

  private highlight(source: string, id: number | undefined): void {
    if (this.selectedFeatureNum) this.map.removeFeatureState(this.selectedFeatureNum);
    this.selectedFeatureNum = id !== undefined ? { source, id } : null;
  }

  async probe(lon: number, lat: number, fromClick: boolean): Promise<void> {
    if (!this.ready) return;
    this.lastProbe = { lon, lat };
    if (fromClick) {
      if (!this.probeMarker) {
        const el = document.createElement('div');
        el.className = 'probe-marker';
        this.probeMarker = new Marker({ element: el }).setLngLat([lon, lat]).addTo(this.map);
      } else this.probeMarker.setLngLat([lon, lat]);
    }
    try {
      const result = await this.model.probe(lon, lat);
      this.events.onProbe({ lon, lat, result });
    } catch {
      /* model not ready yet */
    }
  }

  clearProbe(): void {
    this.lastProbe = null;
    this.probeMarker?.remove();
    this.probeMarker = null;
    this.events.onProbe(null);
  }

  getFeature(id: string): AtlasFeature | undefined {
    return this.featureIndex.get(id);
  }

  getAtlas(): Atlas | null {
    return this.atlas;
  }

  flyToBbox(bbox: [number, number, number, number]): void {
    this.map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: { top: 80, bottom: 120, left: 380, right: 380 }, pitch: 60, bearing: this.map.getBearing(), duration: 2200, maxZoom: 11.5 },
    );
  }

  flyToFeature(f: AtlasFeature): void {
    if (f.geometry.type === 'Point') {
      this.map.flyTo({ center: f.geometry.coordinates, zoom: 12.5, pitch: 65, duration: 2000 });
    } else {
      const xs = f.geometry.coordinates.map((c) => c[0]);
      const ys = f.geometry.coordinates.map((c) => c[1]);
      this.flyToBbox([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
    }
  }

  dispose(): void {
    window.clearInterval(this.dashTimer);
    window.clearTimeout(this.computeTimer);
    if (this.overlayUrl) URL.revokeObjectURL(this.overlayUrl);
    this.model.dispose();
    this.map.remove();
  }
}

