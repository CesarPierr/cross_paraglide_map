/**
 * Lee benchmark (development): documented lee/rotor hazards seen AT their place,
 * and take-offs facing the wind wrongly marked as lee or turbulent.
 *   npx tsx scripts/dev/lee-bench.ts
 */
import { readFileSync } from 'node:fs';
import type { Atlas } from '@brises/shared';
import { analyseTerrain, computeTimeContext, evalCell, makeWindContext, newCellResult, type ModelParams } from '@brises/model';
import { loadDem } from '@brises/model/node';
import { windFromText } from '../build-data';

const atlas = JSON.parse(readFileSync('apps/web/public/data/atlas.json', 'utf8')) as Atlas;
const { grid, elevation } = loadDem(process.cwd());
const terrain = analyseTerrain(grid, elevation);
const W = grid.width;
const cell = newCellResult();
const ctxs = new Map<string, ReturnType<typeof makeWindContext>>();
const ctxFor = (fromDeg: number, kmh: number) => {
  const key = `${fromDeg}-${kmh}`;
  if (!ctxs.has(key)) {
    const p: ModelParams = { year: 2026, month0: 6, day: 15, hour: 14, synoptic: { fromDeg, speedKmh: kmh }, height: { mode: 'agl', meters: 80 }, breezeScale: 1 };
    ctxs.set(key, makeWindContext(terrain, computeTimeContext(terrain, p), p, null));
  }
  return ctxs.get(key)!;
};
const near = (lon: number, lat: number, ctx: ReturnType<typeof ctxFor>, rM: number, f: 'max' | 'min' = 'max') => {
  const [x, y] = grid.toGrid(lon, lat);
  const i0 = Math.floor(x), j0 = Math.floor(y);
  const R = Math.ceil(rM / 216);
  let lee = f === 'max' ? 0 : 1, turb = f === 'max' ? 0 : 1;
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    if (Math.hypot(di, dj) * 216 > rM) continue;
    const o = evalCell((j0 + dj) * W + i0 + di, ctx, cell);
    if (o.underground) continue;
    lee = f === 'max' ? Math.max(lee, o.lee) : Math.min(lee, o.lee);
    turb = f === 'max' ? Math.max(turb, o.turbulence) : Math.min(turb, o.turbulence);
  }
  return { lee, turb };
};
// 1. Documented lee/rotor hazards, at their place (≈ 330 m).
let n = 0, ok = 0;
for (const f of atlas.features.hazards) {
  const p = f.properties;
  if (p.kind !== 'lee-rotor' || f.geometry.type !== 'Point') continue;
  const cond = p.details?.Conditions ?? '';
  const w = windFromText(cond);
  if (!w || !grid.contains(f.geometry.coordinates[0], f.geometry.coordinates[1])) continue;
  const t = cond.toLowerCase();
  const kmh = w.kmh ?? (/\bfort|rafale/.test(t) ? 40 : /faible|léger/.test(t) ? 15 : 30);
  const v = near(f.geometry.coordinates[0], f.geometry.coordinates[1], ctxFor(w.fromDeg, kmh), 330);
  n++;
  if (Math.max(v.lee, v.turb) >= 0.35) ok++;
}
// 2. Take-offs with the wind straight in (first documented orientation, 20 km/h): lee or turbulence at the take-off itself.
const DIR: Record<string, number> = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SSO: 202.5, SW: 225, SO: 225, WSW: 247.5, OSO: 247.5, W: 270, O: 270, WNW: 292.5, ONO: 292.5, NW: 315, NO: 315, NNW: 337.5, NNO: 337.5 };
let tn = 0, tbad = 0;
const bad: string[] = [];
for (const f of atlas.features.takeoffs) {
  const o = (f.properties.details?.Orientation ?? '').split(/[,;/ ]+/)[0]?.toUpperCase();
  if (!o || DIR[o] === undefined || f.geometry.type !== 'Point' || !grid.contains(f.geometry.coordinates[0], f.geometry.coordinates[1])) continue;
  const v = near(f.geometry.coordinates[0], f.geometry.coordinates[1], ctxFor(DIR[o], 20), 0);
  tn++;
  if (Math.max(v.lee, v.turb) >= 0.35) { tbad++; if (bad.length < 6) bad.push(`${f.properties.name.slice(0, 50)} (${o})`); }
}
// 3. Friend's controls: Montlambert stays safe by strong north; past the Colombier towards Annecy, lee by light south.
const mont = [20, 30, 35].map((k) => near(6.1047, 45.5531, ctxFor(0, k), 330).lee.toFixed(2));
console.log(`pièges sous le vent vus au point : ${ok}/${n} (${Math.round((100 * ok) / n)} %)`);
console.log(`décollages face au vent marqués sous le vent ou turbulents : ${tbad}/${tn} (${Math.round((100 * tbad) / tn)} %)${bad.length ? ' — ex. ' + bad.join(' ; ') : ''}`);
console.log(`Montlambert par nord 20/30/35 km/h, abri : ${mont.join(' / ')} (doit rester < 0,35)`);
