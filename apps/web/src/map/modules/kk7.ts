/**
 * thermal.kk7.ch heat maps derived from millions of GPS tracks: thermal
 * hotspots and "skyways" (CC BY-NC-SA 4.0; the `src` parameter identifying the
 * app is required). TMS tiles draped on the terrain.
 */
import type { AppState } from '../../state/store';
import type { MapModule, ModuleContext } from './types';

const SRC = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
const ATTRIBUTION = '© <a href="https://thermal.kk7.ch" target="_blank" rel="noopener">thermal.kk7.ch</a> (CC BY‑NC‑SA 4.0)';

export class Kk7Module implements MapModule {
  readonly id = 'kk7';
  private ctx: ModuleContext | null = null;
  private added = false;

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
  }

  private ensure(): void {
    if (this.added || !this.ctx) return;
    this.added = true;
    const { map } = this.ctx;
    map.addSource('kk7-thermals', {
      type: 'raster',
      tiles: [`https://thermal.kk7.ch/tiles/thermals_all_all/{z}/{x}/{y}.png?src=${SRC}`],
      scheme: 'tms',
      tileSize: 256,
      maxzoom: 12,
      attribution: `Thermiques ${ATTRIBUTION}`,
    });
    map.addSource('kk7-skyways', {
      type: 'raster',
      tiles: [`https://thermal.kk7.ch/tiles/skyways_all_all/{z}/{x}/{y}.png?src=${SRC}`],
      scheme: 'tms',
      tileSize: 256,
      maxzoom: 13,
      attribution: `Skyways ${ATTRIBUTION}`,
    });
    this.ctx.addLayer({ id: 'kk7-skyways', type: 'raster', source: 'kk7-skyways', paint: { 'raster-opacity': 0.8 } }, 'base');
    this.ctx.addLayer({ id: 'kk7-thermals', type: 'raster', source: 'kk7-thermals', paint: { 'raster-opacity': 0.75 } }, 'base');
  }

  apply(s: AppState, prev: AppState | null): void {
    if (prev && prev.layers.kk7Thermals === s.layers.kk7Thermals && prev.layers.kk7Skyways === s.layers.kk7Skyways) return;
    if (s.layers.kk7Thermals || s.layers.kk7Skyways) this.ensure();
    if (!this.added) return;
    const map = this.ctx!.map;
    map.setLayoutProperty('kk7-thermals', 'visibility', s.layers.kk7Thermals ? 'visible' : 'none');
    map.setLayoutProperty('kk7-skyways', 'visibility', s.layers.kk7Skyways ? 'visible' : 'none');
  }
}
