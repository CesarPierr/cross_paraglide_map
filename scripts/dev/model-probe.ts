import { computeField, computeTimeContext, evalCell, makeWindContext, newCellResult, describeVector, type ModelParams } from '@brises/model';
import { analyseTerrain } from '@brises/model';
import { loadDem } from '@brises/model/node';

const { grid, elevation } = loadDem();
let t0 = performance.now();
const terrain = analyseTerrain(grid, elevation);
console.log('terrain', (performance.now() - t0).toFixed(0), 'ms');
const params: ModelParams = { year: 2026, month0: 6, day: 15, hour: Number(process.argv[2] ?? 15), synoptic: { fromDeg: Number(process.argv[3] ?? 0), speedKmh: Number(process.argv[4] ?? 0) }, height: { mode: 'agl', meters: 80 }, breezeScale: 1 };
t0 = performance.now();
const time = computeTimeContext(terrain, params);
console.log('time ctx', (performance.now() - t0).toFixed(0), 'ms', time.sun, time.solarHour.toFixed(2), 'valleyPhase', time.valleyPhase.toFixed(2));
const ctx = makeWindContext(terrain, time, params, null);
t0 = performance.now();
const res = computeField(ctx);
console.log('field', (performance.now() - t0).toFixed(0), 'ms');
const pts: [string, number, number][] = [
  ['Grésivaudan (Crolles)', 5.88, 45.27], ['Grenoble', 5.72, 45.19], ['Voreppe cluse', 5.63, 45.29], ['Chamonix', 6.87, 45.92], ['Sallanches', 6.63, 45.94],
  ['Tarentaise (Aime)', 6.65, 45.555], ['Maurienne (St-Michel)', 6.47, 45.22], ['Durance (Sisteron)', 5.94, 44.2], ['Durance (Embrun)', 6.49, 44.56], ['Drac (Monteynard)', 5.69, 44.96],
  ['Romanche (Bourg d\'Oisans)', 6.03, 45.06], ['Lac Annecy (Doussard)', 6.22, 45.78], ['Combe de Savoie', 6.12, 45.53], ['Chambéry cluse', 5.92, 45.6], ['Arve (Cluses)', 6.58, 46.06],
  ['St-Hilaire déco', 5.887, 45.3075], ['Chalvet', 6.58, 43.97], ['Nice coast', 7.2, 43.7],
];
const cell = newCellResult();
for (const [name, lon, lat] of pts) {
  const [x, y] = grid.toGrid(lon, lat);
  const k = Math.floor(y) * grid.width + Math.floor(x);
  evalCell(k, ctx, cell);
  const tot = describeVector(cell.total);
  const val = describeVector(cell.valley);
  console.log(name.padEnd(28), `z=${cell.elevation.toFixed(0)} lvl=${cell.valleyLevel.toFixed(2)} valley=${terrain.valley[k].toFixed(2)} drain=${terrain.drainKm2[k].toFixed(0)}km2`, `valleyBreeze ${val.from} ${val.speedKmh.toFixed(0)}`, `TOTAL ${tot.from} ${tot.speedKmh.toFixed(0)} km/h`, `lee=${cell.lee.toFixed(2)} dyn=${cell.dynamicLift.toFixed(2)} th=${cell.thermal.toFixed(2)} conv=${res.convergence[k].toFixed(2)}`);
}
