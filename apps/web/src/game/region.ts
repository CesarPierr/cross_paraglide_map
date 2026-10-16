/**
 * The relief and the land cover of the whole region at the wind model's resolution (216 m),
 * from the model's own images (public/data/dem.png, landcover.png: ESA WorldCover 10 m 2021,
 * CC BY 4.0, scripts/build-landcover.ts), resampled around the pilot into small textures in
 * local metres (east/north): the relief beyond the terrain tiles MapLibre has loaded (the
 * mountains behind the camera still cast their shadows) and, for the terrain materials, the
 * share of each cell covered by trees, bare ground and rock, snow and ice, and buildings.
 * Resampled on the CPU (a few milliseconds) when the pilot has moved a quarter of the area.
 */
import * as THREE from 'three';
import { Grid, type GridMeta } from '@brises/model';
import { fetchGridPixels, landcoverUrl } from '../engine/grid-pixels';
import type { LocalFrame } from './geo';

export class RegionMaps {
  /** Elevation (m), R32F, 0 outside the grid; texel (i, j) at centre + ((i + 0.5)/n − 0.5)·2·half (east, north). */
  readonly height: THREE.DataTexture;
  /** Shares of trees, bare ground and rock, snow and ice, built-up (0..255), RGBA8. */
  readonly cover: THREE.DataTexture;
  /** Centre (local metres) and half size (m) of the textures. */
  readonly centre = { x: 0, y: 0 };
  ready = false;
  private dem: Uint8ClampedArray | null = null;
  private lc: Uint8ClampedArray | null = null;
  private grid: Grid;
  private h: Float32Array;
  private c: Uint8Array;
  /** Bumped when the textures change (the passes using them redo their work). */
  version = 0;

  constructor(
    private frame: LocalFrame,
    url: string,
    meta: GridMeta,
    readonly n = 512,
    readonly half = 80000,
  ) {
    this.grid = new Grid(meta);
    this.h = new Float32Array(n * n);
    this.c = new Uint8Array(n * n * 4);
    this.height = new THREE.DataTexture(this.h, n, n, THREE.RedFormat, THREE.FloatType);
    this.cover = new THREE.DataTexture(this.c, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
    for (const t of [this.height, this.cover]) {
      t.minFilter = THREE.NearestFilter;
      t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
    }
    this.cover.minFilter = THREE.LinearFilter;
    this.cover.magFilter = THREE.LinearFilter;
    void Promise.all([fetchGridPixels(url, meta), fetchGridPixels(landcoverUrl(url), meta)]).then(([d, l]) => {
      this.dem = d;
      this.lc = l;
    });
  }

  /** Resamples around (x, y) when the pilot has moved a quarter of the area (or the images just arrived). */
  update(x: number, y: number): boolean {
    if (!this.dem) return false;
    if (this.ready && Math.hypot(x - this.centre.x, y - this.centre.y) < this.half / 4) return false;
    // Snapped to whole texels so the shadows computed from it do not shimmer.
    const texel = (2 * this.half) / this.n;
    this.centre.x = Math.round(x / texel) * texel;
    this.centre.y = Math.round(y / texel) * texel;
    this.resample();
    this.ready = true;
    this.version++;
    return true;
  }

  private resample(): void {
    const { n, half, grid } = this;
    const dem = this.dem!;
    const lc = this.lc;
    const W = grid.width;
    const H = grid.height;
    const texel = (2 * half) / n;
    const gx = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [lon] = this.frame.toLngLat(this.centre.x - half + (i + 0.5) * texel, 0);
      gx[i] = grid.toGrid(lon, this.frame.lat0)[0] - 0.5;
    }
    const elev = (k: number) => dem[k * 4] * 256 + dem[k * 4 + 1] - 32768;
    const share = [0, 0, 0, 0];
    for (let j = 0; j < n; j++) {
      const [, lat] = this.frame.toLngLat(0, this.centre.y - half + (j + 0.5) * texel);
      const fy = grid.toGrid(this.frame.lon0, lat)[1] - 0.5;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      for (let i = 0; i < n; i++) {
        const o = j * n + i;
        const fx = gx[i];
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        if (x0 < 0 || y0 < 0 || x0 + 1 >= W || y0 + 1 >= H) {
          this.h[o] = 0;
          this.c[o * 4] = this.c[o * 4 + 1] = this.c[o * 4 + 2] = this.c[o * 4 + 3] = 0;
          continue;
        }
        const k00 = y0 * W + x0;
        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;
        this.h[o] = elev(k00) * w00 + elev(k00 + 1) * w10 + elev(k00 + W) * w01 + elev(k00 + W + 1) * w11;
        if (!lc) continue;
        share[0] = share[1] = share[2] = share[3] = 0;
        for (const [k, w] of [
          [k00, w00],
          [k00 + 1, w10],
          [k00 + W, w01],
          [k00 + W + 1, w11],
        ] as const) {
          const v = (lc[k * 4] << 16) | (lc[k * 4 + 1] << 8) | lc[k * 4 + 2];
          share[0] += ((v >> 18) & 63) * w;
          share[1] += ((v >> 12) & 63) * w;
          share[2] += ((v >> 6) & 63) * w;
          share[3] += (v & 63) * w;
        }
        for (let q = 0; q < 4; q++) this.c[o * 4 + q] = Math.round((share[q] * 255) / 63);
      }
    }
    this.height.needsUpdate = true;
    this.cover.needsUpdate = true;
  }

  /** Elevation (m) at a local point from the resampled grid (bilinear), null outside or before it is ready. */
  heightAt(x: number, y: number): number | null {
    if (!this.ready) return null;
    const texel = (2 * this.half) / this.n;
    const fx = (x - (this.centre.x - this.half)) / texel - 0.5;
    const fy = (y - (this.centre.y - this.half)) / texel - 0.5;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    if (i < 0 || j < 0 || i + 1 >= this.n || j + 1 >= this.n) return null;
    const tx = fx - i;
    const ty = fy - j;
    const h = this.h;
    const n = this.n;
    const a = h[j * n + i];
    const b = h[j * n + i + 1];
    const c = h[(j + 1) * n + i];
    const d = h[(j + 1) * n + i + 1];
    if (!a || !b || !c || !d) return null;
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  dispose(): void {
    this.height.dispose();
    this.cover.dispose();
  }
}
