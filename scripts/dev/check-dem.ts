import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const meta = JSON.parse(readFileSync('public/data/dem.json', 'utf8'));
const png = PNG.sync.read(readFileSync('public/data/dem.png'));
const z = meta.zoom, T = 256;
const at = (lon: number, lat: number) => {
  const px = ((lon + 180) / 360) * T * 2 ** z - meta.px0;
  const r = (lat * Math.PI) / 180;
  const py = ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * T * 2 ** z - meta.py0;
  const o = (Math.floor(py) * meta.width + Math.floor(px)) * 4;
  return png.data[o] * 256 + png.data[o + 1] - 32768;
};
for (const [n, lon, lat] of [['Grenoble', 5.7245, 45.1885], ['Mont Blanc', 6.8652, 45.8326], ['Lac Annecy', 6.19, 45.85], ['St-Hilaire', 5.8867, 45.3075], ['Barre des Ecrins', 6.3578, 44.9222], ['Nice mer', 7.3, 43.6]] as const) console.log(n, at(lon, lat));
