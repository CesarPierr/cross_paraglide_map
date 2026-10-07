/**
 * Thin orchestrator around MapLibre: creates the map, loads the shared data,
 * mounts the map modules in order, forwards app state and routes pointer
 * events. Feature-specific logic lives in ./modules.
 */
import { Grid } from '@brises/model';
import type { Atlas } from '@brises/shared';
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
import { addIcons } from './icons';
import { AirspaceModule } from './modules/airspace';
import { KnowledgeModule } from './modules/knowledge';
import { Kk7Module } from './modules/kk7';
import { LabelsModule } from './modules/labels';
import { ReliefModule } from './modules/relief';
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
  /** Map picked a point for a contribution ("place on map" mode). */
  onPick: (lngLat: [number, number]) => void;
}

export class MapController {
  readonly map: MlMap;
  private modules: MapModule[] = [];
  private wind: WindModule | null = null;
  private knowledge: KnowledgeModule | null = null;
  private state: AppState | null = null;
  private prevApplied: AppState | null = null;
  private ready = false;
  private probeMarker: Marker | null = null;
  private lastProbe: { lon: number; lat: number } | null = null;
  private hover: Popup;
  private picking = false;
  private disposed = false;

  constructor(
    container: HTMLElement,
    private data: DataClient,
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
      canvasContextAttributes: { antialias: true, powerPreference: 'high-performance' },
    });
    this.map.addControl(new NavigationControl({ visualizePitch: true, showCompass: true }), 'bottom-right');
    this.map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
    this.map.addControl(new GeolocateControl({ trackUserLocation: false }), 'bottom-right');
    this.hover = new Popup({ closeButton: false, closeOnClick: false, className: 'hover-tip', offset: 14, maxWidth: '260px' });
    // Start as soon as the style is parsed: waiting for 'load' would block on unreachable third-party tiles.
    this.map.once('style.load', () => void this.start());
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
      const [meta, atlas] = await Promise.all([this.data.demMeta(), this.data.atlas()]);
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
        atlas.features.thermals.map((f) => ({ name: f.properties.name, lon: f.geometry.coordinates[0] as number, lat: f.geometry.coordinates[1] as number })),
        () => this.emitTime(),
      );
      this.modules = [new ReliefModule(), new Kk7Module(), new AirspaceModule(), this.knowledge, new SitesModule(this.data.siteProviders()), new LabelsModule(), this.wind];
      for (const m of this.modules) if (m !== this.wind) await m.add(ctx);
      this.ready = true;
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

  private applyAll(s: AppState, prev: AppState | null): void {
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

  // ---------- Navigation ----------

  describe(ref: string): FeatureDetails | null {
    const [moduleId, ...rest] = ref.split(':');
    const m = this.modules.find((x) => x.id === moduleId);
    return m?.describe?.(rest.join(':'), {}) ?? null;
  }

  flyToBbox(bbox: [number, number, number, number], opts: { maxZoom?: number } = {}): void {
    const wide = window.innerWidth > 860;
    this.map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        padding: wide ? { top: 90, bottom: 130, left: 400, right: 360 } : { top: 80, bottom: 260, left: 30, right: 30 },
        pitch: 62,
        bearing: this.map.getBearing(),
        duration: 2200,
        maxZoom: opts.maxZoom ?? 12.5,
      },
    );
  }

  /** Adds a transient GeoJSON source (e.g. a contribution being drawn). */
  setScratch(data: GeoJSON.FeatureCollection): void {
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
    for (const m of this.modules) m.dispose?.();
    this.map.remove();
  }
}
