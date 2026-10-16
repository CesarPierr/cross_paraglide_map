/** Node-only helpers for tests and build scripts: load the baked DEM grid and its land cover. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { Grid, type GridMeta } from './grid';
import { unpackLandcover, type Landcover } from './landcover';

export function loadDem(root = process.cwd()): { grid: Grid; elevation: Float32Array; landcover: Landcover | null } {
  const meta = JSON.parse(readFileSync(join(root, 'apps/web/public/data/dem.json'), 'utf8')) as GridMeta;
  const png = PNG.sync.read(readFileSync(join(root, 'apps/web/public/data/dem.png')));
  const grid = new Grid(meta);
  const elevation = new Float32Array(grid.size);
  for (let k = 0; k < grid.size; k++) elevation[k] = png.data[k * 4] * 256 + png.data[k * 4 + 1] - 32768;
  // Land cover (scripts/build-landcover.ts), same grid; without it the ground is uniform.
  const lcFile = join(root, 'apps/web/public/data/landcover.png');
  const landcover = existsSync(lcFile) ? unpackLandcover(PNG.sync.read(readFileSync(lcFile)).data, grid.size) : null;
  return { grid, elevation, landcover };
}
