/**
 * The ground's height around the pilot from the terrain tiles themselves (AWS Terrain
 * Tiles, terrarium: the relief MapLibre draws), fetched and decoded here at z14 around the
 * glider whatever the camera looks at. Collisions, the height above the ground and the
 * relief the wind meets must not depend on what is drawn: MapLibre answers 0 (sea level),
 * or a coarse parent tile's height hundreds of metres off, where no tile of the view
 * covers the point, and the ground then jumped under the glider (a crash with the HUD
 * showing hundreds of metres of clearance). The tiles come from the service worker's
 * cache once seen.
 */
import { TERRAIN_TILES } from '../map/style';
import type { LocalFrame } from './geo';

/** Zoom of the tiles read (the terrain source's maxzoom: ~7 m per pixel here). */
export const HEIGHTS_ZOOM = 14;
/**
 * The same tiles by the bucket's own host name: S3 speaks HTTP/1.1 only, six connections per
 * host, and MapLibre's relief (by the path-style name) no longer waits behind these.
 */
const HEIGHTS_TILES = TERRAIN_TILES.replace('https://s3.amazonaws.com/elevation-tiles-prod/', 'https://elevation-tiles-prod.s3.amazonaws.com/');
const N = 256;
/** Tiles kept (7 × 7 around the pilot, ~12 MB). */
const CAP = 49;
const MAX_LOADING = 4;

/** Fractional tile coordinates of a point at zoom z (Web Mercator). */
export function tileXY(lon: number, lat: number, z: number): [number, number] {
  const n = 2 ** z;
  const phi = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n];
}

/** Terrarium encoding: height (m) of a pixel. */
export function terrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Bilinear height in a decoded tile at fractional pixel (px, py) measured from its corner. */
export function sampleTile(t: Float32Array, px: number, py: number): number {
  const x = Math.min(N - 1.001, Math.max(0, px - 0.5));
  const y = Math.min(N - 1.001, Math.max(0, py - 0.5));
  const i = Math.floor(x);
  const j = Math.floor(y);
  const ax = x - i;
  const ay = y - j;
  const k = j * N + i;
  return (t[k] * (1 - ax) + t[k + 1] * ax) * (1 - ay) + (t[k + N] * (1 - ax) + t[k + N + 1] * ax) * ay;
}

export class TerrainHeights {
  /** Decoded tiles by "x/y" (null while loading), most recently used last. */
  private tiles = new Map<string, Float32Array | null>();
  private loading = 0;
  private queue: [number, number][] = [];
  private centre = '';
  /** When a tile last failed (asked again 10 s later). */
  private failed = new Map<string, number>();

  constructor(private frame: LocalFrame) {}

  /** Height (m) at local x, y, or null while its tile is not loaded (it is asked for). */
  at(x: number, y: number): number | null {
    const [lon, lat] = this.frame.toLngLat(x, y);
    const [fx, fy] = tileXY(lon, lat, HEIGHTS_ZOOM);
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    const key = `${tx}/${ty}`;
    const t = this.tiles.get(key);
    if (t === undefined) {
      this.request(tx, ty);
      return null;
    }
    if (t === null) return null;
    return sampleTile(t, (fx - tx) * N, (fy - ty) * N);
  }

  /** Asks for the 5 × 5 tiles around a point (~8 km across), nearest first; call as the pilot moves. */
  around(x: number, y: number): void {
    const [lon, lat] = this.frame.toLngLat(x, y);
    const [fx, fy] = tileXY(lon, lat, HEIGHTS_ZOOM);
    const tx = Math.floor(fx);
    const ty = Math.floor(fy);
    const key = `${tx}/${ty}`;
    if (key === this.centre) return;
    this.centre = key;
    const ring: [number, number, number][] = [];
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) ring.push([tx + di, ty + dj, di * di + dj * dj]);
    ring.sort((a, b) => a[2] - b[2]);
    for (const [i, j] of ring) this.request(i, j);
  }

  /** Resolves once the 3 × 3 tiles around a point are loaded (or failed), or after `timeoutMs`. */
  async ready(x: number, y: number, timeoutMs = 6000): Promise<void> {
    this.around(x, y);
    const [lon, lat] = this.frame.toLngLat(x, y);
    const [fx, fy] = tileXY(lon, lat, HEIGHTS_ZOOM);
    const keys: string[] = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) keys.push(`${Math.floor(fx) + di}/${Math.floor(fy) + dj}`);
    const t0 = performance.now();
    while (keys.some((k) => this.tiles.get(k) === null) && performance.now() - t0 < timeoutMs) await new Promise((r) => setTimeout(r, 50));
  }

  private request(tx: number, ty: number): void {
    const key = `${tx}/${ty}`;
    if (this.tiles.has(key)) {
      // Most recently used last.
      const t = this.tiles.get(key)!;
      this.tiles.delete(key);
      this.tiles.set(key, t);
      return;
    }
    if (performance.now() - (this.failed.get(key) ?? -1e9) < 10000) return;
    this.tiles.set(key, null);
    this.queue.push([tx, ty]);
    this.pump();
    // Forget the oldest decoded tiles beyond the cap.
    for (const [k, v] of this.tiles) {
      if (this.tiles.size <= CAP) break;
      if (v !== null) this.tiles.delete(k);
    }
  }

  private pump(): void {
    while (this.loading < MAX_LOADING && this.queue.length) {
      const [tx, ty] = this.queue.shift()!;
      this.loading++;
      void this.load(tx, ty).finally(() => {
        this.loading--;
        this.pump();
      });
    }
  }

  private async load(tx: number, ty: number): Promise<void> {
    const key = `${tx}/${ty}`;
    try {
      const url = HEIGHTS_TILES.replace('{z}', String(HEIGHTS_ZOOM)).replace('{x}', String(tx)).replace('{y}', String(ty));
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
      const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(N, N) : Object.assign(document.createElement('canvas'), { width: N, height: N });
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
      if (!ctx) throw new Error('2d');
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      const px = ctx.getImageData(0, 0, N, N).data;
      const h = new Float32Array(N * N);
      for (let k = 0; k < N * N; k++) h[k] = terrarium(px[k * 4], px[k * 4 + 1], px[k * 4 + 2]);
      if (this.tiles.has(key)) this.tiles.set(key, h);
    } catch {
      // Asked again a little later.
      this.tiles.delete(key);
      this.failed.set(key, performance.now());
    }
  }
}
