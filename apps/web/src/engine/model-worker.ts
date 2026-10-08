/// <reference lib="webworker" />
/**
 * Web Worker running the wind model off the main thread.
 * Protocol: see `src/engine/model-client.ts`.
 */
import { packCuratedLayers, rasterizeCurated, type CuratedBreezeInput, type CuratedHazardInput } from '@brises/model';
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
} from '@brises/model';
import { Grid, type GridMeta } from '@brises/model';
import { renderOverlay, type OverlayMode } from './cpu-overlays';
import { analyseTerrain, type Terrain } from '@brises/model';

declare const self: DedicatedWorkerGlobalScope;

export type WorkerRequest =
  | { type: 'build'; id: number; demUrl: string; meta: GridMeta; breezes: CuratedBreezeInput[]; hazards: CuratedHazardInput[] }
  | { type: 'init'; id: number; demUrl: string; meta: GridMeta }
  | { type: 'curated'; id: number; breezes: CuratedBreezeInput[]; hazards: CuratedHazardInput[] }
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

/** Interleaves four per-cell fields into one RGBA float array (GPU texture layout). */
function pack4(n: number, a: ArrayLike<number>, b: ArrayLike<number>, c: ArrayLike<number>, d: ArrayLike<number>): Float32Array {
  const out = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    out[k * 4] = a[k];
    out[k * 4 + 1] = b[k];
    out[k * 4 + 2] = c[k];
    out[k * 4 + 3] = d[k];
  }
  return out;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'build') {
      // GPU mode: analyse once, hand packed textures to the main thread, keep nothing.
      const t0 = performance.now();
      const raw = await decodeDem(msg.demUrl, msg.meta);
      const grid = new Grid(msg.meta);
      const t = analyseTerrain(grid, raw);
      const cur = rasterizeCurated(t, msg.breezes, msg.hazards);
      const n = grid.size;
      const pack = {
        tZ: pack4(n, t.z, t.gx, t.gy, t.tpi),
        tV: pack4(n, t.floor, t.env, t.axisX, t.axisY),
        tW: pack4(n, t.valley, t.lakeX, t.lakeY, t.water),
        tR: pack4(n, t.seaX, t.seaY, t.plainX, t.plainY),
        ...packCuratedLayers(cur),
        breezes: cur.breezes,
        hazards: msg.hazards,
      };
      self.postMessage({ type: 'built', id: msg.id, pack, ms: performance.now() - t0 }, [pack.tZ.buffer, pack.tV.buffer, pack.tW.buffer, pack.tR.buffer, pack.tC.buffer, pack.tC2.buffer]);
    } else if (msg.type === 'init') {
      const t0 = performance.now();
      const raw = await decodeDem(msg.demUrl, msg.meta);
      const grid = new Grid(msg.meta);
      terrain = analyseTerrain(grid, raw);
      const elevation = new Float32Array(terrain.z);
      self.postMessage({ type: 'ready', id: msg.id, elevation, ms: performance.now() - t0 }, [elevation.buffer]);
    } else if (msg.type === 'curated') {
      if (!terrain) throw new Error('not initialised');
      curated = rasterizeCurated(terrain, msg.breezes, msg.hazards);
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
      const hazard = cell.hazardIndex >= 0 ? curated?.hazards?.[cell.hazardIndex] : undefined;
      self.postMessage({
        type: 'probe',
        id: msg.id,
        cell,
        curatedName,
        hazardName: hazard?.name ?? null,
        hazardId: hazard?.id ?? null,
        convergence: last.result.convergence[k],
        water: terrain.water[k],
        drainKm2: terrain.drainKm2[k],
      });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
