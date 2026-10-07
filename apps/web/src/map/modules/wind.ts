/**
 * The wind model on the map. Primary path: GPU engine + 3D scene (live
 * sliders). Fallback for browsers without float render targets: the CPU model
 * in a worker, CPU particles and an image overlay.
 */
import type { CuratedBreezeInput } from '@brises/shared';
import type { CellResult, GridMeta, ModelParams } from '@brises/model';
import type { ImageSource } from 'maplibre-gl';
import { ModelClient } from '../../engine/model-client';
import { timeState } from '../../gpu/engine';
import { supportsFloatTargets } from '../../gpu/gl-utils';
import { WindScene, type SceneSettings } from '../../gpu/wind-scene';
import { CURRENT_YEAR, type AppState } from '../../state/store';
import { BREEZE_COLORS } from '../palette';
import { WindParticleLayer, type ParticleSettings } from '../wind-particles';
import type { MapModule, ModuleContext } from './types';

export type ProbeResult = CellResult & { convergence: number; curatedName: string | null };

const EMPTY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const MODEL_KEYS: (keyof AppState)[] = ['hour', 'month0', 'day', 'synopticFrom', 'synopticKmh', 'heightMode', 'heightAgl', 'heightAsl', 'breezeScale'];

export function modelParams(s: AppState): ModelParams {
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

export class WindModule implements MapModule {
  readonly id = 'wind';
  /** 'gpu' | 'cpu' once ready. */
  mode: 'gpu' | 'cpu' | null = null;
  private ctx: ModuleContext | null = null;
  private scene: WindScene | null = null;
  private model: ModelClient | null = new ModelClient();
  private particles: WindParticleLayer | null = null;
  private state: AppState | null = null;
  private cpuBusy = false;
  private cpuDirty = false;
  private overlayUrl: string | null = null;

  constructor(
    private meta: GridMeta,
    private demUrl: string,
    private curated: CuratedBreezeInput[],
    private thermalSpots: { name: string; lon: number; lat: number }[],
    private onUpdated: () => void,
  ) {}

  async add(ctx: ModuleContext): Promise<void> {
    this.ctx = ctx;
    const gl = ctx.map.getCanvas().getContext('webgl2');
    if (gl && supportsFloatTargets(gl)) {
      // GPU: the worker analyses the relief once and hands packed textures over.
      const { pack } = await this.model!.build(this.demUrl, this.meta, this.curated);
      this.model!.dispose();
      this.model = null;
      this.scene = new WindScene(ctx.grid, pack, this.curated, BREEZE_COLORS, this.sceneSettings());
      this.scene.setThermalSpots(this.thermalSpots);
      this.scene.setOnUpdated(this.onUpdated);
      ctx.addLayer(this.scene.engineLayer, 'base');
      ctx.addLayer(this.scene.drapeLayer, 'analysis');
      ctx.addLayer(this.scene.sceneLayer, 'scene');
      this.mode = 'gpu';
    } else {
      const { elevation } = await this.model!.init(this.demUrl, this.meta);
      await this.model!.setCurated(this.curated);
      ctx.map.addSource('model-overlay', { type: 'image', url: EMPTY_PNG, coordinates: ctx.grid.corners() });
      ctx.addLayer({ id: 'model-overlay', type: 'raster', source: 'model-overlay', paint: { 'raster-opacity': 0.85, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, 'analysis');
      this.particles = new WindParticleLayer(ctx.grid, this.particleSettings());
      this.particles.setElevation(elevation);
      ctx.addLayer(this.particles, 'scene');
      this.mode = 'cpu';
    }
    if (this.state) this.apply(this.state, null);
  }

  private sceneSettings(): SceneSettings {
    const s = this.state;
    return {
      particles: s?.layers.particles ?? true,
      particleCount: s?.particleCount ?? 12000,
      particleSpeed: s?.particleSpeed ?? 1,
      colorMode: s?.particleColor ?? 'speed',
      heightMode: s?.heightMode ?? 'agl',
      heightM: s ? (s.heightMode === 'agl' ? s.heightAgl : s.heightAsl) : 80,
      exaggeration: s?.exaggeration ?? 1.2,
      comets: s?.layers.comets ?? true,
      thermals: s?.layers.thermalColumns ?? true,
      overlay: s?.overlay ?? 'none',
      overlayOpacity: s?.overlayOpacity ?? 0.85,
    };
  }

  private particleSettings(): ParticleSettings {
    const s = this.sceneSettings();
    return { count: s.particleCount, heightMode: s.heightMode, heightM: s.heightM, colorMode: s.colorMode, speed: s.particleSpeed, exaggeration: s.exaggeration };
  }

  apply(s: AppState, prev: AppState | null): void {
    this.state = s;
    const modelChanged = !prev || MODEL_KEYS.some((k) => prev[k] !== s[k]);
    if (this.scene) {
      this.scene.setSettings(this.sceneSettings());
      if (modelChanged) this.scene.setParams(modelParams(s));
    } else if (this.particles) {
      this.particles.setSettings(this.particleSettings());
      this.particles.setEnabled(s.layers.particles);
      if (modelChanged || !prev || prev.overlay !== s.overlay) void this.computeCpu();
    }
  }

  /** Sun and solar time for the UI. */
  time(s: AppState) {
    return timeState(this.ctx!.grid, modelParams(s));
  }

  private async computeCpu(): Promise<void> {
    if (!this.model || !this.state) return;
    if (this.cpuBusy) {
      this.cpuDirty = true;
      return;
    }
    this.cpuBusy = true;
    this.cpuDirty = false;
    try {
      const s = this.state;
      const res = await this.model.compute(modelParams(s), s.overlay);
      this.particles?.setField(res.field);
      const src = this.ctx!.map.getSource('model-overlay') as ImageSource | undefined;
      if (this.overlayUrl) URL.revokeObjectURL(this.overlayUrl);
      this.overlayUrl = res.overlay ? URL.createObjectURL(res.overlay) : null;
      src?.updateImage({ url: this.overlayUrl ?? EMPTY_PNG, coordinates: this.ctx!.grid.corners() });
      this.onUpdated();
    } finally {
      this.cpuBusy = false;
      if (this.cpuDirty) void this.computeCpu();
    }
  }

  async probe(lon: number, lat: number): Promise<ProbeResult | null> {
    if (this.scene) return this.scene.probe(lon, lat);
    if (!this.model) return null;
    const r = await this.model.probe(lon, lat);
    return r.cell ? { ...r.cell, convergence: r.convergence ?? 0, curatedName: r.curatedName ?? null } : null;
  }

  dispose(): void {
    this.model?.dispose();
    if (this.overlayUrl) URL.revokeObjectURL(this.overlayUrl);
  }
}
