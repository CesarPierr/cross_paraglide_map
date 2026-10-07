/** Backgrounds, 3D terrain exaggeration and the hillshade lit by the sun of the selected hour. */
import { timeState } from '../../gpu/engine';
import type { AppState, Basemap } from '../../state/store';
import { CURRENT_YEAR } from '../../state/store';
import type { MapModule, ModuleContext } from './types';

export class ReliefModule implements MapModule {
  readonly id = 'relief';
  private ctx: ModuleContext | null = null;

  add(ctx: ModuleContext): void {
    this.ctx = ctx;
    ctx.map.setTerrain({ source: 'terrain', exaggeration: 1.2 });
  }

  apply(s: AppState, prev: AppState | null): void {
    const map = this.ctx?.map;
    if (!map) return;
    if (!prev || prev.basemap !== s.basemap) this.setBasemap(s.basemap);
    if (!prev || prev.exaggeration !== s.exaggeration) map.setTerrain({ source: 'terrain', exaggeration: s.exaggeration });
    if (!prev || prev.layers.hillshade !== s.layers.hillshade) map.setLayoutProperty('hillshade', 'visibility', s.layers.hillshade ? 'visible' : 'none');
    if (!prev || prev.hour !== s.hour || prev.month0 !== s.month0 || prev.day !== s.day) this.lightBySun(s);
  }

  private setBasemap(b: Basemap): void {
    const map = this.ctx!.map;
    const vis = (id: string, on: boolean) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('bm-s2', b === 'ign-ortho');
    vis('bm-ign-ortho', b === 'ign-ortho');
    vis('bm-topo', b === 'topo');
    // Relief tints stay underneath imagery as a fallback; stronger shading on the bare relief,
    // lighter on the topo map which already draws its own relief.
    map.setPaintProperty('hillshade', 'hillshade-exaggeration', b === 'relief' ? 0.75 : b === 'topo' ? 0.28 : 0.45);
  }

  /** Real sun position: slopes facing the sun light up, the others fall into shade. */
  private lightBySun(s: AppState): void {
    const { map, grid } = this.ctx!;
    const t = timeState(grid, { year: CURRENT_YEAR, month0: s.month0, day: s.day, hour: s.hour, synoptic: { fromDeg: 0, speedKmh: 0 }, height: { mode: 'agl', meters: 0 }, breezeScale: 1 });
    const el = t.sun.elevation;
    map.setPaintProperty('hillshade', 'hillshade-illumination-direction', t.sun.azimuth);
    map.setPaintProperty('hillshade', 'hillshade-illumination-altitude', Math.max(2, el));
    map.setPaintProperty('hillshade', 'hillshade-shadow-color', el <= 0 ? 'rgba(4, 8, 24, 0.78)' : `rgba(12, 20, 40, ${(0.42 + 0.3 * Math.max(0, 1 - el / 60)).toFixed(2)})`);
  }
}
