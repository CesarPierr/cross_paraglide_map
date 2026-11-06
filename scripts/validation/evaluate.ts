/**
 * Runs the model of this tree (whatever `@brises/model` resolves to) on the bench: for each
 * day, scored hour and station, builds the parameters as the app does from the archived
 * forecast and evaluates the CPU model at 10 m above the station's cell.
 *
 * - The conversion is the app's own: `openMeteo.synoptic` (packages/shared), fed through a
 *   local `fetch` with the cached archive, and `forecastAir` (apps/web/src/ui/air-brief.ts).
 * - Height: `{ mode: 'agl', meters: 10 }`. Near the ground the model has no surface layer of
 *   its own beyond the factor it applies to the synoptic part, so this is what it would show
 *   at 10 m (docs/VALIDATION.md).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyseTerrain, computeTimeContext, evalCell, makeWindContext, legalTimeToUtc, newCellResult, packAir, packedWind, rasterizeCurated, type AirColumn, type CuratedLayer, type ModelParams, type TimeContext } from '@brises/model';
import { loadDem } from '@brises/model/node';
import { openMeteo, type Atlas, type SynopticWind } from '@brises/shared';
import { forecastAir, forecastCloud } from '../../apps/web/src/ui/air-brief';
import { HOURS, dayWindows, readJson, soundingCell, soundingPath, type BenchDay, type Bundle } from './common';

/** Model variants. `layers` is the app; the others change only the inputs, never the code. */
export const VARIANTS = ['layers', 'ridge', 'centre', 'envelope', 'noBreeze', 'breeze50', 'calm', 'noAtlas', 'noHazard'] as const;
export type Variant = (typeof VARIANTS)[number];

/** Per sample: u, v of each variant, then the extras below. */
export const EXTRAS = ['airU', 'airV', 'synU', 'synV', 'lee', 'breezeWeight', 'ridgeKmh', 'ridgeFrom', 'cloud', 'lapse', 'belowGround'] as const;
export const CHANNELS = VARIANTS.length * 2 + EXTRAS.length;

export interface RunMeta {
  label: string;
  days: string[];
  stations: string[];
  hours: number[];
  variants: readonly string[];
  extras: readonly string[];
  /** Down-valley axis at each station's cell (east, north), from this revision's terrain. */
  axis: Record<string, [number, number]>;
  /** Env at each station's cell (m), and the AROME ground of its sounding cell (m). */
  env: Record<string, number>;
  groundM: Record<string, number>;
}

type OmResponse = { elevation: number; hourly: Record<string, (number | null)[]> & { time: string[] } };

const parts = (date: string) => ({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1, d: Number(date.slice(8, 10)) });
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The archive of one cell, re-labelled in French legal time as the live API would give it,
 * then read by the app's own provider. The archive is requested in UTC because Open-Meteo
 * applies one fixed offset to a whole response, the wrong one across a change of hour.
 */
async function appForecast(la: number, lo: number, days: BenchDay[], windows: [string, string][]): Promise<Map<string, SynopticWind>> {
  const utc = new Map<string, Record<string, number | null>>();
  let elevation = NaN;
  let keys: string[] = [];
  for (const [start, end] of windows) {
    const path = soundingPath(la, lo, start, end);
    if (!existsSync(path)) throw new Error(`Archive manquante : ${path} (lancer --prepare)`);
    const j = JSON.parse(readFileSync(path, 'utf8')) as OmResponse;
    elevation = j.elevation;
    keys = Object.keys(j.hourly).filter((k) => k !== 'time');
    j.hourly.time.forEach((t, i) => utc.set(t.slice(0, 13), Object.fromEntries(keys.map((k) => [k, j.hourly[k][i]]))));
  }
  const time: string[] = [];
  const hourly: Record<string, (number | null)[]> = Object.fromEntries(keys.map((k) => [k, []]));
  for (const day of days) {
    const { y, m, d } = parts(day.date);
    for (const h of HOURS) {
      const row = utc.get(legalTimeToUtc(y, m, d, h).toISOString().slice(0, 13));
      if (!row) continue;
      time.push(`${day.date}T${pad(h)}:00`);
      for (const k of keys) hourly[k].push(row[k] ?? null);
    }
  }
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ elevation, hourly: { ...hourly, time } }), { status: 200 })) as typeof fetch;
  try {
    const hours = await openMeteo.synoptic(la, lo);
    return new Map(hours.map((h) => [h.time.slice(0, 13), h]));
  } finally {
    globalThis.fetch = realFetch;
  }
}

/** The column whose wind, below the crest envelope of the cell, is the wind at the envelope (scale separation, emulated). */
function aboveEnvelope(air: AirColumn, env: number): AirColumn {
  const p = packAir(air);
  if (!p) return air;
  const [u, v] = packedWind(p, env);
  return { ...air, levels: air.levels.map((l) => (l.z < env ? { ...l, u, v } : l)) };
}

/** The same column without any wind: what the model's own breezes do alone. */
const windless = (air: AirColumn): AirColumn => ({ ...air, levels: air.levels.map((l) => ({ ...l, u: 0, v: 0 })) });

export async function evaluateShard(bundle: Bundle, shard: number, shards: number, label: string): Promise<{ data: Float32Array; meta: RunMeta }> {
  const { grid, elevation, landcover } = loadDem(process.cwd());
  const terrain = analyseTerrain(grid, elevation, landcover);
  const atlas = readJson<Atlas>(join(process.cwd(), 'apps/web/public/data/atlas.json'));
  const curated: CuratedLayer = rasterizeCurated(terrain, atlas.curated, atlas.curatedHazards ?? []);
  const breezesOnly: CuratedLayer = rasterizeCurated(terrain, atlas.curated);

  const { days, stations } = bundle;
  const windows = dayWindows(days);
  const forecasts = new Map<string, Map<string, SynopticWind>>();
  const forecastFor = async (la: number, lo: number) => {
    const key = [la, lo].join();
    if (!forecasts.has(key)) forecasts.set(key, await appForecast(la, lo, days, windows));
    return forecasts.get(key)!;
  };
  const centre = await forecastFor(bundle.centre.lat, bundle.centre.lon);
  for (const s of stations) await forecastFor(...soundingCell(s.lat, s.lon));

  const nS = stations.length;
  const nD = days.length;
  const nH = HOURS.length;
  const data = new Float32Array(nS * nD * nH * CHANNELS).fill(NaN);
  const axis: RunMeta['axis'] = {};
  const env: RunMeta['env'] = {};
  const groundM: RunMeta['groundM'] = {};
  const cells = stations.map((s) => {
    const [x, y] = grid.toGrid(s.lon, s.lat);
    const k = Math.floor(y) * grid.width + Math.floor(x);
    axis[s.id] = [terrain.axisX[k], terrain.axisY[k]];
    env[s.id] = terrain.env[k];
    return k;
  });
  const cell = newCellResult();
  const iV = (v: Variant) => VARIANTS.indexOf(v) * 2;
  const iX = (x: (typeof EXTRAS)[number]) => VARIANTS.length * 2 + EXTRAS.indexOf(x);

  for (let d = 0; d < nD; d++) {
    if (d % shards !== shard) continue;
    const day = days[d];
    const { y, m, d: dom } = parts(day.date);
    for (let h = 0; h < nH; h++) {
      const hour = HOURS[h];
      const base: ModelParams = { year: y, month0: m, day: dom, hour, synoptic: { fromDeg: 0, speedKmh: 0 }, height: { mode: 'agl', meters: 10 }, breezeScale: 1, heatwave: false };
      const time: TimeContext = computeTimeContext(terrain, base);
      const prefix = `${day.date}T${pad(hour)}`;
      const hc = centre.get(prefix);
      for (let s = 0; s < nS; s++) {
        const st = stations[s];
        const k = cells[s];
        const hs = forecasts.get(soundingCell(st.lat, st.lon).join())?.get(prefix);
        if (!hs) continue;
        const air = forecastAir(hs);
        const at = (s * nD + d) * nH * CHANNELS + h * CHANNELS;
        const synoptic = { fromDeg: hs.fromDeg, speedKmh: hs.speedKmh };
        const lapseRate = hs.lapseRate;
        const run = (v: Variant, p: Partial<ModelParams>, layer: CuratedLayer | null = curated) => {
          const ctx = makeWindContext(terrain, time, { ...base, synoptic, lapseRate, ...p }, layer);
          evalCell(k, ctx, cell);
          data[at + iV(v)] = cell.total[0];
          data[at + iV(v) + 1] = cell.total[1];
        };
        run('ridge', {});
        if (hc) {
          const airC = forecastAir(hc);
          run('centre', { synoptic: { fromDeg: hc.fromDeg, speedKmh: hc.speedKmh }, lapseRate: hc.lapseRate, air: airC ?? undefined });
        }
        if (air) {
          run('noBreeze', { air, breezeScale: 0 });
          run('breeze50', { air, breezeScale: 0.5 });
          run('calm', { air: windless(air), synoptic: { fromDeg: 0, speedKmh: 0 } });
          run('envelope', { air: aboveEnvelope(air, terrain.env[k]) });
          run('noAtlas', { air }, null);
          run('noHazard', { air }, breezesOnly);
          run('layers', { air });
          data[at + iX('airU')] = cell.airWind[0];
          data[at + iX('airV')] = cell.airWind[1];
          data[at + iX('synU')] = cell.synoptic[0];
          data[at + iX('synV')] = cell.synoptic[1];
          data[at + iX('lee')] = cell.lee;
          data[at + iX('breezeWeight')] = cell.breezeWeight;
        }
        data[at + iX('ridgeKmh')] = hs.speedKmh;
        data[at + iX('ridgeFrom')] = hs.fromDeg;
        data[at + iX('cloud')] = forecastCloud(hs) ?? 0;
        data[at + iX('lapse')] = hs.lapseRate ?? NaN;
        if (hs.groundM !== undefined) {
          groundM[st.id] = hs.groundM;
          data[at + iX('belowGround')] = terrain.z[k] + 10 < hs.groundM ? 1 : 0;
        }
      }
    }
    process.stderr.write(`  [${shard}] ${day.date}\n`);
  }
  return {
    data,
    meta: { label, days: days.map((d) => d.date), stations: stations.map((s) => s.id), hours: HOURS, variants: VARIANTS, extras: EXTRAS, axis, env, groundM },
  };
}

export function writeShard(path: string, data: Float32Array, meta: RunMeta): void {
  writeFileSync(`${path}.bin`, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  writeFileSync(`${path}.json`, JSON.stringify(meta));
}
