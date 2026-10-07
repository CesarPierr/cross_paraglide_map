/// <reference lib="webworker" />
/**
 * Web Worker running the wind model off the main thread.
 * Protocol: see `src/engine/model-client.ts`.
 */
import { rasterizeCurated, type CuratedBreezeInput } from './curated';
import {
  computeField,
  computeTimeContext,
  evalCell,
  makeWindContext,
  newCellResult,
  type CuratedLayer,
  type FieldResult,
  type ModelParams,
  type TimeContext,
  type WindContext,
} from './field';
import { Grid, type GridMeta } from './grid';
import { renderOverlay, type OverlayMode } from './overlays';
import { analyseTerrain, type Terrain } from './terrain';

declare const self: DedicatedWorkerGlobalScope;

export type WorkerRequest =
  | { type: 'init'; id: number; demUrl: string; meta: GridMeta }
  | { type: 'curated'; id: number; breezes: CuratedBreezeInput[] }
  | { type: 'compute'; id: number; params: ModelParams; overlay: OverlayMode }
  | { type: 'probe'; id: number; lon: number; lat: number };

let terrain: Terrain | null = null;
let curated: CuratedLayer | null = null;
let timeCache: { key: string; ctx: TimeContext } | null = null;
let last: { ctx: WindContext; result: FieldResult } | null = null;

async function decodeDem(url: string, meta: GridMeta): Promise<Float32Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DEM ${res.status}`);
  const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const data = ctx.getImageData(0, 0, meta.width, meta.height).data;
  const out = new Float32Array(meta.width * meta.height);
  for (let k = 0; k < out.length; k++) out[k] = data[k * 4] * 256 + data[k * 4 + 1] - 32768;
  return out;
}

async function overlayBlob(mode: OverlayMode, result: FieldResult, gKmh: number, grid: Grid): Promise<Blob | null> {
  if (mode === 'none') return null;
  const rgba = new Uint8ClampedArray(grid.size * 4);
  renderOverlay(mode, result, gKmh, rgba);
  const canvas = new OffscreenCanvas(grid.width, grid.height);
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(rgba, grid.width, grid.height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      const t0 = performance.now();
      const raw = await decodeDem(msg.demUrl, msg.meta);
      const grid = new Grid(msg.meta);
      terrain = analyseTerrain(grid, raw);
      const elevation = new Float32Array(terrain.z);
      self.postMessage({ type: 'ready', id: msg.id, elevation, ms: performance.now() - t0 }, [elevation.buffer]);
    } else if (msg.type === 'curated') {
      if (!terrain) throw new Error('not initialised');
      curated = rasterizeCurated(terrain, msg.breezes);
      self.postMessage({ type: 'ok', id: msg.id });
    } else if (msg.type === 'compute') {
      if (!terrain) throw new Error('not initialised');
      const t0 = performance.now();
      const p = msg.params;
      const key = `${p.year}-${p.month0}-${p.day}-${p.hour.toFixed(3)}`;
      if (!timeCache || timeCache.key !== key) timeCache = { key, ctx: computeTimeContext(terrain, p) };
      const ctx = makeWindContext(terrain, timeCache.ctx, p, curated);
      const result = computeField(ctx);
      last = { ctx, result };
      const blob = await overlayBlob(msg.overlay, result, p.synoptic.speedKmh, terrain.grid);
      const field = new Float32Array(result.field);
      self.postMessage(
        {
          type: 'field',
          id: msg.id,
          field,
          overlay: blob,
          sun: timeCache.ctx.sun,
          solarHour: timeCache.ctx.solarHour,
          ms: performance.now() - t0,
        },
        [field.buffer],
      );
    } else if (msg.type === 'probe') {
      if (!terrain || !last) throw new Error('not ready');
      const grid = terrain.grid;
      if (!grid.contains(msg.lon, msg.lat)) {
        self.postMessage({ type: 'probe', id: msg.id, cell: null });
        return;
      }
      const [x, y] = grid.toGrid(msg.lon, msg.lat);
      const k = Math.floor(y) * grid.width + Math.floor(x);
      const cell = evalCell(k, last.ctx, newCellResult());
      const curatedName = cell.curatedIndex >= 0 && curated ? curated.breezes[cell.curatedIndex].name : null;
      self.postMessage({
        type: 'probe',
        id: msg.id,
        cell,
        curatedName,
        convergence: last.result.convergence[k],
        water: terrain.water[k],
        drainKm2: terrain.drainKm2[k],
      });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
