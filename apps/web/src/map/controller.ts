/**
 * Thin orchestrator around MapLibre: creates the map, loads the shared data,
 * mounts the map modules in order, forwards app state and routes pointer
 * events. Feature-specific logic lives in ./modules.
 */
import { Grid } from '@brises/model';
import type { Atlas, AtlasFeatureProps } from '@brises/shared';
import {
  GeolocateControl,
  Map as MlMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
  type MapMouseEvent,
  type SourceSpecification,
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { DataClient } from '../data/client';
import type { AppState } from '../state/store';
import { budgetFor, onPowerContextChange, pacerFor } from './frame-pacer';
import { isPhoneLayout, phonePadding } from './viewport';
import { addIcons } from './icons';
import { AirspaceModule } from './modules/airspace';
import { KnowledgeModule } from './modules/knowledge';
import { Kk7Module } from './modules/kk7';
import { LabelsModule } from './modules/labels';
import { ReliefModule } from './modules/relief';
import { SchemaModule, thermalRole } from './modules/schema';
import { SitesModule } from './modules/sites';
import { slotMarker, type FeatureDetails, type MapModule, type ModuleContext, type ModuleEvent, type Slot } from './modules/types';
import { WindModule, type ProbeResult } from './modules/wind';
import { buildStyle } from './style';

// MapLibre v6 resolves its worker next to its own module, which bundlers move: point at it explicitly.
setWorkerUrl(maplibreWorkerUrl);

export interface ControllerEvents {
  onAtlas: (atlas: Atlas) => void;
  onStatus: (status: { phase: 'loading' | 'terrain' | 'ready' | 'error'; message?: string }) => void;
  onTime: (info: { sunAzimuth: number; sunElevation: number; solarHour: number }) => void;
  onFeature: (details: FeatureDetails | null) => void;
  onProbe: (probe: { lon: number; lat: number; result: ProbeResult | null } | null) => void;
  onModuleEvent: (e: ModuleEvent) => void;
  /** A massif was picked on the map for the schema view. */
  onPickMassif: (massifId: string) => void;
  /** Map picked a point for a contribution ("place on map" mode). */
  onPick: (lngLat: [number, number]) => void;
}

/**
 * How firmly the sources describe a climb, for its animation when learning a massif:
 * ceilings and relaunch points first, discounted by the confidence of the sources.
 */
function documentedStrength(p: AtlasFeatureProps): number {
  // A hotspot known only from GPS tracks: as strong as it is likely.
  if (p.origin === 'kk7') return 0.35 + 0.5 * (p.kk7P ?? 0.8);
  const role = thermalRole(p.description);
  const base = role === 'plafond' ? 1 : role === 'relance' ? 0.95 : role === 'déclencheur' ? 0.85 : 0.7;
  // Confirmed by the tracks: the documented climb is a sure one.
  const measured = p.kk7P !== undefined ? 1 + 0.15 * p.kk7P : 1;
  return Math.min(1, base * (p.confidence === 'low' ? 0.6 : p.confidence === 'high' ? 1 : 0.9) * measured);
}

/** Layers replaced by the schematic diagram while a schema view is open. */
const LIVE_ONLY: (keyof AppState['layers'])[] = ['particles', 'comets', 'thermalColumns', 'breezes', 'convergences', 'hazards', 'thermals', 'soaring', 'takeoffs', 'landings', 'routes', 'kk7Thermals', 'kk7Skyways', 'sitesCommunity'];

/** The state the map actually renders: the schema view flattens the relief and swaps the live layers for its diagram. */
/** Documented breeze flows and thermal columns stay under the schema; particles only on demand. */
const SCHEMA_KEEP: (keyof AppState['layers'])[] = ['comets', 'thermalColumns'];

function effectiveState(s: AppState): AppState {
  // Picking a massif: only the sector names, so they read at a glance.
  if (s.schemaPicking && !s.schemaMassif)
    return { ...s, overlay: 'none', layers: { ...s.layers, ...Object.fromEntries([...LIVE_ONLY, 'labels', 'sitesOfficial', 'airspace', 'airspaceProtect', 'airspaceActivity'].map((k) => [k, false])) } };
  if (!s.schemaMassif) return s;
  const off = LIVE_ONLY.filter((k) => !SCHEMA_KEEP.includes(k) && !(s.schemaWind && k === 'particles'));
  // The diagram writes its own title: the live map's sector names would overlap it.
  return { ...s, exaggeration: s.schema3d ? s.exaggeration || 1.3 : 0, overlay: 'none', layers: { ...s.layers, ...Object.fromEntries([...off, 'labels', 'airspace', 'airspaceProtect', 'airspaceActivity'].map((k) => [k, false])) } };
}

export class MapController {
  readonly map: MlMap;
  private modules: MapModule[] = [];
  private wind: WindModule | null = null;
  private knowledge: KnowledgeModule | null = null;
  private airspace: AirspaceModule | null = null;
  private schema: SchemaModule | null = null;
  private state: AppState | null = null;
  private prevApplied: AppState | null = null;
  private ready = false;
  private probeMarker: Marker | null = null;
  private lastProbe: { lon: number; lat: number } | null = null;
  private hover: Popup;
  private picking = false;
  private data!: DataClient;
  /** Calls that touch the style before it is ready (the map is created before the data): the last one of each kind, replayed once ready. */
  private deferred = new Map<string, () => void>();
  private disposed = false;
  private offPower: () => void = () => {};

  constructor(
    container: HTMLElement,
    /** The data client may still be deciding between the API and the static files: the map does not wait for it. */
    private dataReady: Promise<DataClient>,
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
      // Retina screens render 4× the pixels: capped by the energy budget.
      pixelRatio: Math.min(window.devicePixelRatio || 1, budgetFor('auto').maxDpr),
      attributionControl: { compact: true },
      canvasContextAttributes: { antialias: true, powerPreference: 'high-performance' },
    });
    // Zoom, pan, rotation and tilt buttons live in the app's own pad (ui/NavPad), which also owns the keyboard.
    this.map.keyboard.disable();
    this.map.addControl(new NavigationControl({ visualizePitch: true, showCompass: true, showZoom: false }), 'bottom-right');
    this.map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
    this.map.addControl(new GeolocateControl({ trackUserLocation: false }), 'bottom-right');
    this.hover = new Popup({ closeButton: false, closeOnClick: false, className: 'hover-tip', offset: 14, maxWidth: '260px' });
    // Start as soon as the style is parsed: waiting for 'load' would block on unreachable third-party tiles.
    this.map.once('style.load', () => void this.start());
    // Battery plugged / unplugged: the auto budget changes.
    this.offPower = onPowerContextChange(() => this.state && this.applyAll(this.state, null));
    // The attribution stays a small (i) button until opened.
    const foldAttribution = () => this.map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    this.map.once('load', foldAttribution);
    // MapLibre opens it again when it first switches to compact mode (narrow screens): fold it once the map settles.
    this.map.once('idle', foldAttribution);
    // Phone: the credits open only on a tap on (i), never by themselves over the map.
    this.map.once('load', () => {
      const attrib = this.map.getContainer().querySelector('.maplibregl-ctrl-attrib');
      attrib?.querySelector('.maplibregl-ctrl-attrib-button')?.addEventListener('click', () => attrib.classList.toggle('user-open'));
    });
    this.map.on('error', (e) => {
      if ((e.error as { status?: number } | undefined)?.status) return; // missing tiles are expected
      console.warn(e.error);
    });
  }

  private async start(): Promise<void> {
    const map = this.map;
    this.events.onStatus({ phase: 'loading', message: 'Chargement des connaissances locales…' });
    addIcons(map);
    try {
      const data = (this.data = await this.dataReady);
      const [meta, atlas] = await Promise.all([data.demMeta(), data.atlas()]);
      if (this.disposed) return;
      this.events.onAtlas(atlas);
      const grid = new Grid(meta);
      const ctx: ModuleContext = {
        map,
        grid,
        atlas,
        addLayer: (layer, slot: Slot) => map.addLayer(layer as Parameters<MlMap['addLayer']>[0], slotMarker(slot)),
        notify: (e) => this.events.onModuleEvent(e),
      };
      this.knowledge = new KnowledgeModule();
      this.wind = new WindModule(
        meta,
        this.data.demUrl(),
        atlas.curated,
        atlas.features.thermals.map((f) => ({
          name: f.properties.name,
          lon: f.geometry.coordinates[0] as number,
          lat: f.geometry.coordinates[1] as number,
          massif: f.properties.massif,
          // Read at display time: the descriptions arrive with the atlas text, after the first render.
          documented: () => documentedStrength(f.properties),
        })),
        () => this.emitTime(),
      );
      const knowledge = this.knowledge;
      const schema = (this.schema = new SchemaModule(
        (id) => knowledge.describe(id),
        (id) => this.events.onPickMassif(id),
      ));
      this.airspace = new AirspaceModule();
      this.modules = [new ReliefModule(), new Kk7Module(), this.airspace, this.knowledge, schema, new SitesModule(this.data.siteProviders()), new LabelsModule(), this.wind];
      for (const m of this.modules) if (m !== this.wind) await m.add(ctx);
      this.ready = true;
      // A phone starting flat (no relief until asked): seen from above, not tilted over a flat map.
      if (isPhoneLayout() && this.state?.exaggeration === 0 && map.getPitch() > 0) map.jumpTo({ pitch: 0 });
      for (const run of this.deferred.values()) run();
      this.deferred.clear();
      if (this.state) this.applyAll(this.state, null);
      this.events.onStatus({ phase: 'terrain', message: 'Analyse du relief (vallées, pentes, lacs)…' });
      await this.wind.add(ctx);
      if (this.disposed) return;
      if (this.state) this.wind.apply(this.state, null);
      this.emitTime();
      this.events.onStatus({ phase: 'ready' });
    } catch (err) {
      console.error(err);
      this.events.onStatus({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
    }
    map.on('click', (e) => this.onClick(e));
    map.on('mousemove', (e) => this.onHover(e));
    map.on('mouseout', () => this.hover.remove());
  }

  private get clickable(): string[] {
    return this.modules.flatMap((m) => m.clickableLayers ?? []).filter((id) => this.map.getLayer(id));
  }

  apply(s: AppState): void {
    this.state = s;
    if (!this.ready) return;
    this.applyAll(s, this.prevApplied);
  }

  private applyPower(s: AppState): void {
    pacerFor(this.map).setMode(s.power);
    // Resizing the canvas flashes the whole map: only when the ratio really changes.
    const ratio = Math.min(window.devicePixelRatio || 1, budgetFor(s.power).maxDpr);
    if (Math.abs(this.map.getPixelRatio() - ratio) > 0.01) this.map.setPixelRatio(ratio);
  }

  private applyAll(raw: AppState, prev: AppState | null): void {
    if (!prev || prev.power !== raw.power) this.applyPower(raw);
    const s = effectiveState(raw);
    for (const m of this.modules) m.apply(s, prev);
    this.prevApplied = s;
    if (prev && (prev.hour !== s.hour || prev.month0 !== s.month0 || prev.day !== s.day)) this.emitTime();
    if (this.lastProbe && prev && prev !== s) this.refreshProbe();
  }

  private emitTime(): void {
    if (!this.wind?.mode || !this.state) return;
    const t = this.wind.time(this.state);
    this.events.onTime({ sunAzimuth: t.sun.azimuth, sunElevation: t.sun.elevation, solarHour: t.solarHour });
  }

  // ---------- Pointer ----------

  setPicking(on: boolean): void {
    this.picking = on;
    this.map.getCanvas().style.cursor = on ? 'crosshair' : '';
  }

  private onHover(e: MapMouseEvent): void {
    if (this.picking) return;
    const hit = this.map.queryRenderedFeatures(e.point, { layers: this.clickable })[0];
    this.map.getCanvas().style.cursor = hit ? 'pointer' : '';
    const name = hit?.properties?.name as string | undefined;
    if (hit && name) {
      this.hover.setLngLat(e.lngLat).setText(name).addTo(this.map);
    } else this.hover.remove();
  }

  private onClick(e: MapMouseEvent): void {
    if (this.picking) {
      this.events.onPick([e.lngLat.lng, e.lngLat.lat]);
      return;
    }
    const hit = this.map.queryRenderedFeatures(e.point, { layers: this.clickable })[0];
    if (hit) {
      const owner = this.modules.find((m) => m.clickableLayers?.includes(hit.layer.id));
      if (owner?.select?.(String(hit.properties?.id), hit.properties ?? {})) return;
      const details = owner?.describe?.(String(hit.properties?.id), hit.properties ?? {}) ?? null;
      if (details) {
        this.events.onFeature(details);
        return;
      }
    }
    void this.probe(e.lngLat.lng, e.lngLat.lat, true);
  }

  async probe(lon: number, lat: number, fromClick: boolean): Promise<void> {
    if (!this.wind?.mode) return;
    this.lastProbe = { lon, lat };
    if (fromClick) {
      if (!this.probeMarker) {
        const el = document.createElement('div');
        el.className = 'probe-marker';
        this.probeMarker = new Marker({ element: el }).setLngLat([lon, lat]).addTo(this.map);
      } else this.probeMarker.setLngLat([lon, lat]);
    }
    const result = await this.wind.probe(lon, lat);
    this.events.onProbe({ lon, lat, result });
  }

  private refreshProbe(): void {
    if (this.lastProbe) void this.probe(this.lastProbe.lon, this.lastProbe.lat, false);
  }

  clearProbe(): void {
    this.lastProbe = null;
    this.probeMarker?.remove();
    this.probeMarker = null;
    this.events.onProbe(null);
  }

  /** Emphasises the schema items a guided-visit step talks about. */
  highlightSchema(ids: string[]): void {
    this.schema?.highlight(ids);
  }

  /** Airspaces of the shown families above a point (for the probe). */
  airspacesAt(lon: number, lat: number) {
    return this.airspace?.at(lon, lat) ?? [];
  }

  // ---------- Navigation ----------

  describe(ref: string): FeatureDetails | null {
    const [moduleId, ...rest] = ref.split(':');
    const m = this.modules.find((x) => x.id === moduleId);
    return m?.describe?.(rest.join(':'), {}) ?? null;
  }

  flyToBbox(bbox: [number, number, number, number], opts: { maxZoom?: number } = {}): void {
    this.map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        padding: isPhoneLayout() ? phonePadding() : { top: 90, bottom: 130, left: 400, right: 360 },
        absolutePadding: true,
        pitch: 62,
        bearing: this.map.getBearing(),
        duration: 2200,
        maxZoom: opts.maxZoom ?? 12.5,
      },
    );
  }

  /** Draws a route (planned or highlighted): line, numbered turn points. */
  setRoute(points: [number, number][]): void {
    if (!this.ready) {
      this.deferred.set('route', () => this.setRoute(points));
      return;
    }
    const map = this.map;
    const data: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        ...(points.length > 1 ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: points }, properties: {} }] : []),
        ...points.map((p, i) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: p }, properties: { n: String(i + 1) } })),
      ],
    };
    const src = map.getSource('route-plan') as { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined;
    if (src?.setData) {
      src.setData(data);
      return;
    }
    map.addSource('route-plan', { type: 'geojson', data } as SourceSpecification);
    map.addLayer({ id: 'route-plan-casing', type: 'line', source: 'route-plan', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1e1b4b', 'line-width': 7, 'line-opacity': 0.7 } }, slotMarker('labels'));
    map.addLayer({ id: 'route-plan-line', type: 'line', source: 'route-plan', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fde68a', 'line-width': 3.5 } }, slotMarker('labels'));
    map.addLayer(
      { id: 'route-plan-pt', type: 'circle', source: 'route-plan', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 10, 'circle-color': '#fde68a', 'circle-stroke-color': '#1e1b4b', 'circle-stroke-width': 2 } },
      slotMarker('labels'),
    );
    map.addLayer(
      {
        id: 'route-plan-n',
        type: 'symbol',
        source: 'route-plan',
        filter: ['==', ['geometry-type'], 'Point'],
        layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true },
        paint: { 'text-color': '#1e1b4b' },
      },
      slotMarker('labels'),
    );
  }

  /** Adds a transient GeoJSON source (e.g. a contribution being drawn). */
  setScratch(data: GeoJSON.FeatureCollection): void {
    if (!this.ready) {
      this.deferred.set('scratch', () => this.setScratch(data));
      return;
    }
    const map = this.map;
    const src = map.getSource('scratch') as { setData?: (d: GeoJSON.FeatureCollection) => void } | undefined;
    if (src?.setData) {
      src.setData(data);
      return;
    }
    map.addSource('scratch', { type: 'geojson', data } as SourceSpecification);
    map.addLayer({ id: 'scratch-line', type: 'line', source: 'scratch', paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [1, 1] } }, slotMarker('labels'));
    map.addLayer(
      { id: 'scratch-point', type: 'circle', source: 'scratch', paint: { 'circle-radius': 7, 'circle-color': '#fbbf24', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },
      slotMarker('labels'),
    );
  }

  dispose(): void {
    this.disposed = true;
    this.offPower();
    for (const m of this.modules) m.dispose?.();
    this.map.remove();
  }
}
