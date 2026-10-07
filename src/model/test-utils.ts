/** Node-only helpers for tests and build scripts: load the baked DEM grid. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { Grid, type GridMeta } from './grid';

export function loadDem(root = process.cwd()): { grid: Grid; elevation: Float32Array } {
  const meta = JSON.parse(readFileSync(join(root, 'public/data/dem.json'), 'utf8')) as GridMeta;
  const png = PNG.sync.read(readFileSync(join(root, 'public/data/dem.png')));
  const grid = new Grid(meta);
  const elevation = new Float32Array(grid.size);
  for (let k = 0; k < grid.size; k++) elevation[k] = png.data[k * 4] * 256 + png.data[k * 4 + 1] - 32768;
  return { grid, elevation };
}
