/**
 * Pixels of an image of the model grid (dem.png, landcover.png) decoded in a worker, exact
 * (no premultiplied alpha, no colour management).
 */
import type { GridMeta } from '@brises/model';

/** RGBA pixels of a grid image, or null if it cannot be had (the model then does without). */
export async function fetchGridPixels(url: string, meta: GridMeta): Promise<Uint8ClampedArray | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, meta.width, meta.height).data;
  } catch {
    return null;
  }
}

/** The land cover image (scripts/build-landcover.ts), next to the elevation image. */
export const landcoverUrl = (demUrl: string) => demUrl.replace(/dem\.png/, 'landcover.png');
