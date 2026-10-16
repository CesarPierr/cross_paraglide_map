/**
 * Land cover of the model grid (ESA WorldCover 10 m 2021, scripts/build-landcover.ts): the
 * share of each cell covered by trees, bare ground or rock, snow and ice, and built-up
 * areas, and what it does to the heating of the ground (`RULES.surfaceHeating`).
 */
import { RULES } from './rules';

export interface Landcover {
  trees: Float32Array;
  bare: Float32Array;
  snow: Float32Array;
  built: Float32Array;
}

/**
 * Decodes the pixels of landcover.png (4 bytes per pixel, RGBA): four 6-bit shares packed
 * in the 24 bits of the RGB channels, trees, bare, snow and ice, built-up.
 */
export function unpackLandcover(rgba: ArrayLike<number>, n: number): Landcover {
  const trees = new Float32Array(n);
  const bare = new Float32Array(n);
  const snow = new Float32Array(n);
  const built = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const v = (rgba[k * 4] << 16) | (rgba[k * 4 + 1] << 8) | rgba[k * 4 + 2];
    trees[k] = ((v >> 18) & 63) / 63;
    bare[k] = ((v >> 12) & 63) / 63;
    snow[k] = ((v >> 6) & 63) / 63;
    built[k] = (v & 63) / 63;
  }
  return { trees, bare, snow, built };
}

/** The same pixels cropped to a window of the grid (columns i0..i1, rows j0..j1 of a grid `width` wide). */
export function cropPixels(rgba: ArrayLike<number>, width: number, i0: number, j0: number, i1: number, j1: number): Uint8ClampedArray {
  const w = i1 - i0;
  const out = new Uint8ClampedArray(w * (j1 - j0) * 4);
  for (let j = j0; j < j1; j++)
    for (let i = i0; i < i1; i++) {
      const s = (j * width + i) * 4;
      const d = ((j - j0) * w + (i - i0)) * 4;
      out[d] = rgba[s];
      out[d + 1] = rgba[s + 1];
      out[d + 2] = rgba[s + 2];
      out[d + 3] = 255;
    }
  return out;
}

/**
 * Heating efficiency of the ground of each cell (1 = the mean of the Alps' land): the
 * shares of the cell weighted by `RULES.surfaceHeating`, divided by its fixed mean over
 * the whole grid, so that the map and the game's window give the same value. Water and
 * missing land cover count 1 (lakes have no thermals anyway, `Terrain.water`).
 */
export function surfaceFactor(lc: Landcover | null, n: number): Float32Array {
  const out = new Float32Array(n).fill(1);
  if (!lc) return out;
  const w = RULES.surfaceHeating;
  for (let k = 0; k < n; k++) {
    const rest = Math.max(0, 1 - lc.trees[k] - lc.bare[k] - lc.snow[k] - lc.built[k]);
    out[k] = (lc.trees[k] * w.trees + lc.bare[k] * w.bare + lc.snow[k] * w.snow + lc.built[k] * w.built + rest * w.rest) / w.mean;
  }
  return out;
}
