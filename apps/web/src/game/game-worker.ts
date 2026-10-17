/// <reference lib="webworker" />
/**
 * The site's wind model, run for the game: the same terrain analysis, documented breezes
 * and hazards as the map, queried at the pilot's position and altitude (wind, lift forced
 * by the relief and the slope breezes, turbulence, lee) and over a window around him
 * (thermal potential, to place the thermals).
 */
import { fetchGridPixels, landcoverUrl } from '../engine/grid-pixels';
import {
  analyseTerrain,
  computeTimeContext,
  cropPixels,
  unpackLandcover,
  evalCell,
  Grid,
  makeWindContext,
  newCellResult,
  rasterizeCurated,
  type CuratedBreezeInput,
  type CuratedHazardInput,
  type CuratedLayer,
  type GridMeta,
  type ModelParams,
  type Terrain,
  type TimeContext,
} from '@brises/model';

declare const self: DedicatedWorkerGlobalScope;

export type GameWorkerRequest =
  | { type: 'init'; id: number; demUrl: string; meta: GridMeta; breezes: CuratedBreezeInput[]; hazards: CuratedHazardInput[]; center: [number, number]; radiusM: number }
  | { type: 'time'; id: number; params: ModelParams }
  | { type: 'sample'; id: number; params: ModelParams; points: { lon: number; lat: number; alt: number }[] }
  | { type: 'winds'; id: number; params: ModelParams; lonLat: Float64Array; agl: number[] }
  | { type: 'potential'; id: number; params: ModelParams; bbox: [number, number, number, number]; aglM: number };

/** Air at one point, from the model. */
export interface ModelAir {
  /** Horizontal wind (m/s, east/north). */
  u: number;
  v: number;
  /** Vertical air speed forced by the relief: wind (synoptic and breezes) along the slope (m/s). */
  lift: number;
  turbulence: number;
  lee: number;
  /** Ground elevation of the model grid (m). */
  ground: number;
  /** Thermal potential 0..1 here. */
  thermal: number;
  hazard: string | null;
  /** Speed-up of the wind through a gap (0..1, already in u, v). */
  venturi: number;
  /** Vertical shear of the wind here (1/s): the valley breeze under the wind aloft, an inversion. */
  shear: number;
  /** Heating efficiency of the ground here (land cover; 1 = the mean of the Alps' land). */
  surface: number;
}

let terrain: Terrain | null = null;
let fullDem: { meta: GridMeta; raw: Float32Array; landcover: Uint8ClampedArray | null; url: string } | null = null;
let curated: CuratedLayer | null = null;
let time: { key: string; ctx: TimeContext } | null = null;

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

function timeContext(p: ModelParams): TimeContext {
  const key = `${p.year}-${p.month0}-${p.day}-${p.hour.toFixed(2)}`;
  if (!time || time.key !== key) time = { key, ctx: computeTimeContext(terrain!, p) };
  return time.ctx;
}

const cell = newCellResult();

/** Model at one point, bilinear over the four surrounding cells; with the shear over the 60 m above. */
function sampleAt(p: ModelParams, lon: number, lat: number, alt: number): ModelAir | null {
  const a = sampleOnce(p, lon, lat, alt);
  if (!a) return null;
  const b = sampleOnce(p, lon, lat, alt + 60);
  if (b) a.shear = Math.hypot(b.u - a.u, b.v - a.v) / 60;
  return a;
}

function sampleOnce(p: ModelParams, lon: number, lat: number, alt: number): ModelAir | null {
  const t = terrain!;
  const grid = t.grid;
  if (!grid.contains(lon, lat)) return null;
  const params: ModelParams = { ...p, height: { mode: 'asl', meters: alt } };
  const ctx = makeWindContext(t, timeContext(p), params, curated);
  const [gx, gy] = grid.toGrid(lon, lat);
  const i0 = Math.max(0, Math.min(grid.width - 2, Math.floor(gx - 0.5)));
  const j0 = Math.max(0, Math.min(grid.height - 2, Math.floor(gy - 0.5)));
  const fx = Math.max(0, Math.min(1, gx - 0.5 - i0));
  const fy = Math.max(0, Math.min(1, gy - 0.5 - j0));
  const out: ModelAir = { u: 0, v: 0, lift: 0, turbulence: 0, lee: 0, ground: 0, thermal: 0, hazard: null, venturi: 0, shear: 0, surface: 0 };
  let best = 0;
  for (let dj = 0; dj < 2; dj++) {
    for (let di = 0; di < 2; di++) {
      const wgt = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy);
      const k = (j0 + dj) * grid.width + i0 + di;
      evalCell(k, ctx, cell);
      const hh = Math.max(cell.heightAgl, 5);
      out.u += cell.total[0] * wgt;
      out.v += cell.total[1] * wgt;
      // Air following the ground: whatever blows up the slope rises with it, fading with height.
      out.lift += (cell.total[0] * t.gx[k] + cell.total[1] * t.gy[k]) * Math.exp(-hh / 300) * wgt;
      out.turbulence += cell.turbulence * wgt;
      out.lee += cell.lee * wgt;
      out.ground += cell.elevation * wgt;
      out.thermal += cell.thermal * wgt;
      out.venturi += cell.venturi * wgt;
      out.surface += (t.surface?.[k] ?? 1) * wgt;
      if (cell.hazardIndex >= 0 && cell.hazardWeight * wgt > best) {
        best = cell.hazardWeight * wgt;
        out.hazard = curated?.hazards?.[cell.hazardIndex]?.name ?? null;
      }
    }
  }
  return out;
}

self.onmessage = async (e: MessageEvent<GameWorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      const t0 = performance.now();
      if (!fullDem || fullDem.url !== msg.demUrl) {
        const [raw, landcover] = await Promise.all([decodeDem(msg.demUrl, msg.meta), fetchGridPixels(landcoverUrl(msg.demUrl), msg.meta)]);
        fullDem = { meta: msg.meta, raw, landcover, url: msg.demUrl };
      }
      // Only a window around the pilot: the sun's integration over the day (shadows) and
      // the terrain analysis cost in proportion to the cells, ~10× less than the whole Alps.
      const full = new Grid(fullDem.meta);
      const [cx, cy] = full.toGrid(msg.center[0], msg.center[1]);
      const cellM = (40075016.686 * Math.cos((msg.center[1] * Math.PI) / 180)) / full.worldPx;
      const half = Math.ceil(msg.radiusM / cellM);
      const i0 = Math.max(0, Math.floor(cx) - half);
      const j0 = Math.max(0, Math.floor(cy) - half);
      const i1 = Math.min(full.width, Math.floor(cx) + half);
      const j1 = Math.min(full.height, Math.floor(cy) + half);
      const meta: GridMeta = { ...fullDem.meta, px0: fullDem.meta.px0 + i0, py0: fullDem.meta.py0 + j0, width: i1 - i0, height: j1 - j0 };
      const raw = new Float32Array(meta.width * meta.height);
      for (let j = 0; j < meta.height; j++) raw.set(fullDem.raw.subarray((j0 + j) * full.width + i0, (j0 + j) * full.width + i1), j * meta.width);
      // The land cover of the same window: the ground's heating, as on the map.
      const lc = fullDem.landcover ? unpackLandcover(cropPixels(fullDem.landcover, full.width, i0, j0, i1, j1), meta.width * meta.height) : null;
      terrain = analyseTerrain(new Grid(meta), raw, lc);
      time = null;
      curated = rasterizeCurated(terrain, msg.breezes, msg.hazards);
      self.postMessage({ type: 'ready', id: msg.id, ms: performance.now() - t0 });
    } else if (msg.type === 'time') {
      if (!terrain) throw new Error('not initialised');
      const ctx = timeContext(msg.params);
      self.postMessage({ type: 'time', id: msg.id, sunElevation: ctx.sun.elevation, sunAzimuth: ctx.sun.azimuth, season: ctx.season, thermalSeason: ctx.thermalSeason, decline: ctx.thermalDecline });
    } else if (msg.type === 'sample') {
      if (!terrain) throw new Error('not initialised');
      const air = msg.points.map((q) => sampleAt(msg.params, q.lon, q.lat, q.alt));
      self.postMessage({ type: 'sample', id: msg.id, air });
    } else if (msg.type === 'winds') {
      // Wind only, nearest cell, at heights above the model's ground: the profiles above the
      // thermal sources (a few hundred points, one wind context per height).
      if (!terrain) throw new Error('not initialised');
      const t = terrain;
      const grid = t.grid;
      const np = msg.lonLat.length / 2;
      const nl = msg.agl.length;
      const u = new Float32Array(np * nl);
      const v = new Float32Array(np * nl);
      const cells = new Int32Array(np).fill(-1);
      for (let k = 0; k < np; k++) {
        const lon = msg.lonLat[2 * k];
        const lat = msg.lonLat[2 * k + 1];
        if (!grid.contains(lon, lat)) continue;
        const [gx, gy] = grid.toGrid(lon, lat);
        cells[k] = Math.max(0, Math.min(grid.height - 1, Math.floor(gy))) * grid.width + Math.max(0, Math.min(grid.width - 1, Math.floor(gx)));
      }
      for (let l = 0; l < nl; l++) {
        const ctx = makeWindContext(t, timeContext(msg.params), { ...msg.params, height: { mode: 'agl', meters: Math.max(5, msg.agl[l]) } }, curated);
        for (let k = 0; k < np; k++) {
          if (cells[k] < 0) continue;
          evalCell(cells[k], ctx, cell);
          u[k * nl + l] = cell.total[0];
          v[k * nl + l] = cell.total[1];
        }
      }
      self.postMessage({ type: 'winds', id: msg.id, u, v }, [u.buffer, v.buffer]);
    } else if (msg.type === 'potential') {
      if (!terrain) throw new Error('not initialised');
      const t = terrain;
      const grid = t.grid;
      const ctx = makeWindContext(t, timeContext(msg.params), { ...msg.params, height: { mode: 'agl', meters: msg.aglM } }, curated);
      const [w, s, east, n] = msg.bbox;
      const [x0, y1] = grid.toGrid(w, s);
      const [x1, y0] = grid.toGrid(east, n);
      const i0 = Math.max(0, Math.floor(x0));
      const i1 = Math.min(grid.width - 1, Math.ceil(x1));
      const j0 = Math.max(0, Math.floor(y0));
      const j1 = Math.min(grid.height - 1, Math.ceil(y1));
      const cols = i1 - i0 + 1;
      const rows = j1 - j0 + 1;
      const thermal = new Float32Array(cols * rows);
      const elevation = new Float32Array(cols * rows);
      const aspect = new Float32Array(cols * rows);
      const slope = new Float32Array(cols * rows);
      const lee = new Float32Array(cols * rows);
      const lon = new Float32Array(cols);
      const lat = new Float32Array(rows);
      for (let i = 0; i < cols; i++) lon[i] = grid.colLon(i0 + i + 0.5);
      for (let j = 0; j < rows; j++) lat[j] = grid.rowLat(j0 + j + 0.5);
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const k = (j0 + j) * grid.width + i0 + i;
          evalCell(k, ctx, cell);
          thermal[j * cols + i] = cell.thermal;
          elevation[j * cols + i] = cell.elevation;
          aspect[j * cols + i] = cell.aspectDeg;
          slope[j * cols + i] = cell.slopeDeg;
          lee[j * cols + i] = cell.lee;
        }
      }
      self.postMessage({ type: 'potential', id: msg.id, cols, rows, lon, lat, thermal, elevation, aspect, slope, lee }, [thermal.buffer, elevation.buffer, aspect.buffer, slope.buffer, lee.buffer, lon.buffer, lat.buffer]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
  }
};
