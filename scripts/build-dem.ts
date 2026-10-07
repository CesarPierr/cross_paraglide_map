/**
 * Builds the coarse elevation grid used by the in-browser wind model.
 *
 * Source: AWS Open Data "Terrain Tiles" (Mapzen Terrarium encoding), the same
 * tiles MapLibre streams for the 3D terrain. We stitch the Web-Mercator tiles
 * covering the French Alps at a fixed zoom and crop them to the model bbox, so
 * that every grid cell is aligned with Web Mercator (needed to drape overlays
 * exactly and to sample the field from shaders).
 *
 * Output: public/data/dem.png (Terrarium RGB encoding, metre precision) and
 * public/data/dem.json (grid georeferencing).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { DEM_BBOX, DEM_ZOOM } from '../src/model/grid-config';

const TILE = 256;
const CACHE = join(process.cwd(), '.cache', 'terrarium');
const OUT_DIR = join(process.cwd(), 'public', 'data');

const lonToPx = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const latToPx = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * TILE * 2 ** z;
};

function fetchTile(z: number, x: number, y: number): PNG {
  const file = join(CACHE, `${z}-${x}-${y}.png`);
  if (!existsSync(file)) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    execFileSync('curl', ['-sSf', '--retry', '4', '-o', file, url]);
  }
  return PNG.sync.read(readFileSync(file));
}

function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const z = DEM_ZOOM;
  const [west, south, east, north] = DEM_BBOX;
  const px0 = Math.floor(lonToPx(west, z));
  const px1 = Math.ceil(lonToPx(east, z));
  const py0 = Math.floor(latToPx(north, z));
  const py1 = Math.ceil(latToPx(south, z));
  const width = px1 - px0;
  const height = py1 - py0;
  const elev = new Float32Array(width * height);

  const tx0 = Math.floor(px0 / TILE);
  const tx1 = Math.floor((px1 - 1) / TILE);
  const ty0 = Math.floor(py0 / TILE);
  const ty1 = Math.floor((py1 - 1) / TILE);
  console.log(`zoom ${z}: grid ${width}x${height}, tiles x ${tx0}-${tx1} y ${ty0}-${ty1}`);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const png = fetchTile(z, tx, ty);
      for (let j = 0; j < TILE; j++) {
        const gy = ty * TILE + j - py0;
        if (gy < 0 || gy >= height) continue;
        for (let i = 0; i < TILE; i++) {
          const gx = tx * TILE + i - px0;
          if (gx < 0 || gx >= width) continue;
          const o = (j * TILE + i) * 4;
          const d = png.data;
          elev[gy * width + gx] = d[o] * 256 + d[o + 1] + d[o + 2] / 256 - 32768;
        }
      }
    }
  }

  // Re-encode in Terrarium with metre precision (blue = 0 compresses far better).
  const out = new PNG({ width, height, colorType: 2 });
  let min = Infinity;
  let max = -Infinity;
  for (let k = 0; k < elev.length; k++) {
    const e = Math.max(-500, Math.round(elev[k]));
    min = Math.min(min, e);
    max = Math.max(max, e);
    const v = e + 32768;
    out.data[k * 4] = v >> 8;
    out.data[k * 4 + 1] = v & 255;
    out.data[k * 4 + 2] = 0;
    out.data[k * 4 + 3] = 255;
  }
  const buf = PNG.sync.write(out, { colorType: 2, deflateLevel: 9, filterType: -1 });
  writeFileSync(join(OUT_DIR, 'dem.png'), buf);
  const meta = {
    source: 'AWS Terrain Tiles (Terrarium), https://registry.opendata.aws/terrain-tiles/',
    zoom: z,
    tileSize: TILE,
    px0,
    py0,
    width,
    height,
    minElevation: min,
    maxElevation: max,
  };
  writeFileSync(join(OUT_DIR, 'dem.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(`wrote dem.png (${(buf.length / 1024).toFixed(0)} KiB)`, meta);
}

main();
