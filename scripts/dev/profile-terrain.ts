import { blur, extremumFilter } from '../../src/model/raster';
import { loadDem } from '../../src/model/test-utils';
const { grid, elevation } = loadDem();
const w = grid.width, h = grid.height;
let t = performance.now();
const lap = (l: string) => { const n = performance.now(); console.log(l, (n - t).toFixed(0), 'ms'); t = n; };
blur(elevation, w, h, 7); lap('blur r7');
blur(elevation, w, h, 60); lap('blur r60');
extremumFilter(elevation, w, h, 12, true); lap('max r12');
