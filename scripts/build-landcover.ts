/**
 * Builds the land cover grid of the wind model from ESA WorldCover 10 m 2021 (v200),
 * aligned with the elevation grid (public/data/dem.json): for each cell, the share of its
 * surface (0..63) covered by trees (WorldCover class 10); bare or sparse vegetation, moss
 * and lichen (60, 100: rock, scree, dry ground); snow and ice (70: glaciers, permanent
 * snow); built-up (50). The rest is grass, shrubs, crops, wetland and water. The four
 * 6-bit shares are packed in the 24 bits of an opaque RGB pixel (an alpha channel would not
 * survive the browser's premultiplied decoding): see packages/model → unpackLandcover.
 * The model turns them into a heating efficiency of the ground (surfaceFactor).
 *
 * Source: ESA WorldCover 10 m 2021 v200, CC BY 4.0 — © ESA WorldCover project 2021 /
 * Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover
 * consortium. The four 3° tiles over the grid (≈ 330 MB) are downloaded once to
 * .cache/worldcover from the public bucket; the 2nd level of their internal overviews
 * (≈ 18 m) gives ≈ 140 samples per 216 m cell.
 *
 *   npm run data:landcover
 *
 * Output: apps/web/public/data/landcover.png (RGB, the size of dem.png).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromFile } from 'geotiff';
import { PNG } from 'pngjs';
import type { GridMeta } from '@brises/model';

const CACHE = join(process.cwd(), '.cache', 'worldcover');
const OUT = join(process.cwd(), 'apps', 'web', 'public', 'data', 'landcover.png');
const URL_BASE = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map';
/** Overview level read: 0 = 10 m, 1 ≈ 18 m (lat) × 13 m (lon at 45°N). */
const LEVEL = 1;
/** WorldCover class → channel: 0 trees, 1 bare/moss, 2 snow/ice, 3 built-up, 4 the rest. */
const CHANNEL = new Uint8Array(256).fill(4);
CHANNEL[10] = 0;
CHANNEL[60] = 1;
CHANNEL[100] = 1;
CHANNEL[70] = 2;
CHANNEL[50] = 3;

const tileName = (lat: number, lon: number) =>
  `ESA_WorldCover_10m_2021_v200_N${String(lat).padStart(2, '0')}E${String(lon).padStart(3, '0')}_Map.tif`;

async function main() {
  const meta = JSON.parse(readFileSync(join(process.cwd(), 'apps/web/public/data/dem.json'), 'utf8')) as GridMeta;
  const { width: W, height: H, px0, py0, zoom, tileSize } = meta;
  const worldPx = tileSize * 2 ** zoom;
  const lonOf = (px: number) => (px / worldPx) * 360 - 180;
  const latOf = (py: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / worldPx))) * 180) / Math.PI;
  const west = lonOf(px0);
  const east = lonOf(px0 + W);
  const north = latOf(py0);
  const south = latOf(py0 + H);
  console.log(`grille ${W}×${H} : ${west.toFixed(3)}–${east.toFixed(3)} °E, ${south.toFixed(3)}–${north.toFixed(3)} °N`);

  mkdirSync(CACHE, { recursive: true });
  const counts = new Uint32Array(W * H * 5);
  for (let lat = Math.floor(south / 3) * 3; lat < north; lat += 3) {
    for (let lon = Math.floor(west / 3) * 3; lon < east; lon += 3) {
      const file = join(CACHE, tileName(lat, lon));
      if (!existsSync(file)) {
        console.log(`téléchargement de ${tileName(lat, lon)}…`);
        execFileSync('curl', ['-sSf', '--retry', '4', '-o', file, `${URL_BASE}/${tileName(lat, lon)}`]);
      }
      const tif = await fromFile(file);
      const image = await tif.getImage(LEVEL);
      const full = await tif.getImage(0);
      const [ox, oy] = full.getOrigin();
      const iw = image.getWidth();
      const ih = image.getHeight();
      const resX = 3 / iw;
      const resY = 3 / ih;
      // Window of the tile over the grid.
      const c0 = Math.max(0, Math.floor((west - ox) / resX));
      const c1 = Math.min(iw, Math.ceil((east - ox) / resX));
      const r0 = Math.max(0, Math.floor((oy - north) / resY));
      const r1 = Math.min(ih, Math.ceil((oy - south) / resY));
      if (c1 <= c0 || r1 <= r0) continue;
      const t0 = Date.now();
      const STRIP = 1024;
      for (let rs = r0; rs < r1; rs += STRIP) {
        const re = Math.min(r1, rs + STRIP);
        const data = (await image.readRasters({ window: [c0, rs, c1, re], samples: [0], interleave: true })) as unknown as Uint8Array;
        const w = c1 - c0;
        for (let r = rs; r < re; r++) {
          const lat2 = oy - (r + 0.5) * resY;
          const y = Math.floor((((1 - Math.asinh(Math.tan((lat2 * Math.PI) / 180)) / Math.PI) / 2) * worldPx) - py0);
          if (y < 0 || y >= H) continue;
          const row = (r - rs) * w;
          // Grid column of each pixel: linear in longitude.
          const x0 = ((ox + (c0 + 0.5) * resX + 180) / 360) * worldPx - px0;
          const dx = (resX / 360) * worldPx;
          for (let c = 0; c < w; c++) {
            const v = data[row + c];
            if (v === 0) continue;
            const x = Math.floor(x0 + c * dx);
            if (x < 0 || x >= W) continue;
            counts[(y * W + x) * 5 + CHANNEL[v]]++;
          }
        }
      }
      console.log(`${tileName(lat, lon)} : fenêtre ${c1 - c0}×${r1 - r0}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    }
  }

  const png = new PNG({ width: W, height: H });
  let covered = 0;
  const share = [0, 0, 0, 0, 0];
  for (let k = 0; k < W * H; k++) {
    let total = 0;
    for (let c = 0; c < 5; c++) total += counts[k * 5 + c];
    if (total === 0) continue;
    covered++;
    const q = [0, 1, 2, 3].map((c) => Math.round((63 * counts[k * 5 + c]) / total));
    const v = (q[0] << 18) | (q[1] << 12) | (q[2] << 6) | q[3];
    png.data[k * 4] = v >> 16;
    png.data[k * 4 + 1] = (v >> 8) & 255;
    png.data[k * 4 + 2] = v & 255;
    for (let c = 0; c < 5; c++) share[c] += counts[k * 5 + c] / total;
  }
  for (let k = 0; k < W * H; k++) png.data[k * 4 + 3] = 255;
  writeFileSync(OUT, PNG.sync.write(png, { colorType: 2 }));
  const pct = (v: number) => `${((100 * v) / covered).toFixed(1)} %`;
  console.log(`${covered} mailles couvertes sur ${W * H} : arbres ${pct(share[0])}, roche et sol nu ${pct(share[1])}, neige et glace ${pct(share[2])}, bâti ${pct(share[3])}, reste ${pct(share[4])}`);
  console.log(`→ ${OUT}`);
}

await main();
