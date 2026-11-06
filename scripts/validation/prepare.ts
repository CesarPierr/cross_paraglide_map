/**
 * Prepares the hindcast dataset once (.cache/validation/bench.json), shared by all the
 * revisions scored afterwards: days, observations, stations and their setting, AROME 10 m
 * at the stations, archived soundings. Every download is cached and paced.
 *
 * Sources and licences: docs/VALIDATION.md.
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { analyseTerrain, legalTimeToUtc } from '@brises/model';
import { loadDem } from '@brises/model/node';
import { SYNOPTIC_VARIABLES, type Atlas } from '@brises/shared';
import { BUNDLE, CACHE, HOURS, REPO, USER_AGENT, dayWindows, fetchTextCached, readJson, round, sleep, soundingCell, soundingPath, writeJson, type BenchDay, type BenchStation, type Bundle, type Setting } from './common';
import { OM_ARCHIVE, selectDays } from './select-days';

const DEPTS = ['01', '04', '05', '06', '26', '38', '73', '74', '84'];
const MF_URL = (d: string) => `https://meteofrance.s3.sbg.io.cloud.ovh.net/data/synchro_ftp/BASE/HOR/H_${d}_latest-2025-2026.csv.gz`;
/** Open-Meteo: weighted calls per minute (the free plan allows 600 per minute, 5000 per hour). */
const OM_WEIGHT_PER_MIN = 75;
/** A station must report at least this share of the scored hours. */
const MIN_COVERAGE = 0.7;
/**
 * Stations kept per region and setting, and their spacing (km): a few dozen well spread, the
 * floors of the big valleys (the main question of the bench) a little favoured.
 */
const CAP_PER_GROUP = 2;
const CAP_BIG_VALLEY = 3;
const BIG_VALLEY = 0.5;
const MIN_SPACING_KM = 8;
/** Balises read (Pioupiou), within 1 km of a documented take-off, and kept. */
const MAX_BALISES = 25;
const KEPT_BALISES = 10;

type RawObs = [number, number, number | null];
interface RawStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alti: number;
  series: Record<string, RawObs>;
}

const pad = (n: number) => String(n).padStart(2, '0');
const parts = (date: string) => ({ y: Number(date.slice(0, 4)), m: Number(date.slice(5, 7)) - 1, d: Number(date.slice(8, 10)) });

/** UTC key (YYYYMMDDHH) of each scored hour → day index and hour index. */
function utcIndex(days: BenchDay[]): Map<string, [string, number]> {
  const out = new Map<string, [string, number]>();
  for (const day of days) {
    const { y, m, d } = parts(day.date);
    HOURS.forEach((h, i) => {
      const u = legalTimeToUtc(y, m, d, h);
      out.set(`${u.getUTCFullYear()}${pad(u.getUTCMonth() + 1)}${pad(u.getUTCDate())}${pad(u.getUTCHours())}`, [day.date, i]);
    });
  }
  return out;
}

/** Streams the department file and keeps the wind of the selected hours; the raw .gz stays cached. */
async function readDepartment(dept: string, index: Map<string, [string, number]>, bbox: [number, number, number, number]): Promise<RawStation[]> {
  const dir = join(CACHE, 'mf');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `H_${dept}_latest-2025-2026.csv.gz`);
  if (!existsSync(path)) {
    process.stderr.write(`  téléchargement ${dept}\n`);
    const res = await fetch(MF_URL(dept), { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok || !res.body) throw new Error(`${res.status} ${MF_URL(dept)}`);
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(`${path}.part`));
    renameSync(`${path}.part`, path);
  }
  const lines = createInterface({ input: createReadStream(path).pipe(createGunzip()) });
  const stations = new Map<string, RawStation>();
  let col: Record<string, number> | null = null;
  for await (const line of lines) {
    const f = line.split(';');
    if (!col) {
      col = Object.fromEntries(f.map((name, i) => [name.trim(), i]));
      continue;
    }
    const key = f[col.AAAAMMJJHH];
    const hit = index.get(key);
    if (!hit) continue;
    const ff = f[col.FF];
    const dd = f[col.DD];
    if (ff === '' || dd === '' || ff === undefined || dd === undefined) continue;
    // Quality codes: 2 is "doubtful, being checked"; everything else is kept (0, 1, 9).
    if (f[col.QFF] === '2' || f[col.QDD] === '2') continue;
    const lat = Number(f[col.LAT]);
    const lon = Number(f[col.LON]);
    if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) continue;
    const id = f[col.NUM_POSTE].trim();
    let s = stations.get(id);
    if (!s) {
      s = { id, name: f[col.NOM_USUEL].trim(), lat, lon, alti: Number(f[col.ALTI]), series: {} };
      stations.set(id, s);
    }
    const fxi = f[col.FXI];
    s.series[`${hit[0]}|${hit[1]}`] = [Number(ff), Number(dd), fxi === '' || fxi === undefined ? null : Number(fxi)];
  }
  return [...stations.values()];
}

function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const kmBetween = (aLat: number, aLon: number, bLat: number, bLon: number) => Math.hypot((aLon - bLon) * 111.32 * Math.cos((aLat * Math.PI) / 180), (aLat - bLat) * 111.32);

/**
 * Setting of a station from the DEM at its cell (thresholds in docs/VALIDATION.md):
 * summit, col or plateau high in the relief; valley floor low in a deep relief; plain
 * when the relief around is low; slope otherwise.
 */
function classify(o: { rel: number; depth: number; slopeDeg: number; tpi: number }): Setting {
  if (o.depth < 300 && o.slopeDeg < 6) return 'plaine';
  if (o.rel >= 0.7 || o.tpi >= 100) return 'sommet';
  if (o.rel <= 0.25 && o.slopeDeg < 12) return 'fond';
  return 'pente';
}

async function omWeighted(url: string, path: string, weight: number): Promise<string> {
  if (existsSync(path)) return fetchTextCached(url, path);
  const started = Date.now();
  const text = await fetchTextCached(url, path);
  const budget = (weight / OM_WEIGHT_PER_MIN) * 60_000;
  const left = budget - (Date.now() - started);
  if (left > 0) await sleep(left);
  return text;
}

async function fetchSoundings(cells: [number, number][], windows: [string, string][]): Promise<void> {
  const weight = Math.max(1, SYNOPTIC_VARIABLES.length / 10);
  let done = 0;
  for (const [la, lo] of cells) {
    for (const [start, end] of windows) {
      const url = `${OM_ARCHIVE}?latitude=${la.toFixed(3)}&longitude=${lo.toFixed(3)}&start_date=${start}&end_date=${end}&hourly=${SYNOPTIC_VARIABLES.join(',')}&models=meteofrance_seamless&cell_selection=nearest&wind_speed_unit=kmh&timezone=GMT`;
      await omWeighted(url, soundingPath(la, lo, start, end), weight);
      if (++done % 50 === 0) process.stderr.write(`  sondages ${done}/${cells.length * windows.length}\n`);
    }
  }
}

type OmPoint = { elevation: number; hourly: { time: string[]; wind_speed_10m: (number | null)[]; wind_direction_10m: (number | null)[] } };

async function fetchArome10m(stations: BenchStation[], days: BenchDay[], windows: [string, string][]): Promise<Bundle['arome']> {
  const out: Bundle['arome'] = {};
  const byId = new Map<string, OmPoint[]>();
  const CHUNK = 40;
  for (const [start, end] of windows) {
    for (let i = 0; i < stations.length; i += CHUNK) {
      const part = stations.slice(i, i + CHUNK);
      const url = `${OM_ARCHIVE}?latitude=${part.map((s) => s.lat.toFixed(4)).join(',')}&longitude=${part.map((s) => s.lon.toFixed(4)).join(',')}&start_date=${start}&end_date=${end}&hourly=wind_speed_10m,wind_direction_10m&models=meteofrance_arome_france&wind_speed_unit=ms&timezone=GMT`;
      const path = join(CACHE, `om/arome10m_${part[0].id}_${part.length}_${start}_${end}.json`);
      const parsed = JSON.parse(await omWeighted(url, path, part.length)) as OmPoint | OmPoint[];
      const list = Array.isArray(parsed) ? parsed : [parsed];
      list.forEach((p, k) => {
        const id = part[k].id;
        byId.set(id, [...(byId.get(id) ?? []), p]);
      });
    }
  }
  for (const s of stations) {
    const series = new Map<string, [number, number]>();
    for (const p of byId.get(s.id) ?? []) {
      p.hourly.time.forEach((t, i) => {
        const a = p.hourly.wind_speed_10m[i];
        const b = p.hourly.wind_direction_10m[i];
        if (a != null && b != null) series.set(t.slice(0, 13), [a, b]);
      });
    }
    out[s.id] = {};
    for (const day of days) {
      const { y, m, d } = parts(day.date);
      out[s.id][day.date] = HOURS.map((h) => series.get(legalTimeToUtc(y, m, d, h).toISOString().slice(0, 13)) ?? null);
    }
  }
  return out;
}

interface PiouMeta {
  id: number;
  meta?: { name?: string };
  location?: { latitude?: number | null; longitude?: number | null };
}

/** Pioupiou balises near documented take-offs: mean over the 10 minutes before the hour, like the 10 m standard. */
async function fetchBalises(days: BenchDay[], atlas: Atlas, contains: (lon: number, lat: number) => boolean): Promise<RawStation[]> {
  const text = await fetchTextCached('http://api.pioupiou.fr/v1/live-with-meta/all', join(CACHE, 'pioupiou/all.json'));
  const all = (JSON.parse(text) as { data: PiouMeta[] }).data;
  const takeoffs = atlas.features.takeoffs.map((f) => f.geometry.coordinates as number[]);
  const near = all.filter((s) => {
    const lat = s.location?.latitude;
    const lon = s.location?.longitude;
    if (lat == null || lon == null || !contains(lon, lat)) return false;
    return takeoffs.some(([tl, tb]) => kmBetween(lat, lon, tb, tl) < 1);
  });
  process.stderr.write(`  balises près d'un décollage : ${near.length}\n`);
  const fair = days.find((d) => d.klass === 'brise') ?? days[0];
  const out: RawStation[] = [];
  for (const s of near) {
    if (out.length >= MAX_BALISES) break;
    const lat = s.location!.latitude!;
    const lon = s.location!.longitude!;
    if (out.some((o) => kmBetween(lat, lon, o.lat, o.lon) < MIN_SPACING_KM)) continue;
    const raw: RawStation = { id: `P${s.id}`, name: s.meta?.name?.trim() || `Pioupiou ${s.id}`, lat, lon, alti: NaN, series: {} };
    // A first day tells whether the balise existed in 2025.
    const ordered = [fair, ...days.filter((d) => d !== fair)];
    let empty = false;
    for (const day of ordered) {
      if (empty) break;
      const { y, m, d } = parts(day.date);
      const start = legalTimeToUtc(y, m, d, HOURS[0] - 1).toISOString().slice(0, 16);
      const stop = legalTimeToUtc(y, m, d, HOURS[HOURS.length - 1]).toISOString().slice(0, 16);
      const url = `http://api.pioupiou.fr/v1/archive/${s.id}?start=${start}Z&stop=${stop}Z&format=json`;
      let rows: (string | number | null)[][] = [];
      try {
        rows = (JSON.parse(await fetchTextCached(url, join(CACHE, `pioupiou/${s.id}_${day.date}.json`), 700)) as { data?: (string | number | null)[][] }).data ?? [];
      } catch (e) {
        process.stderr.write(`  balise ${s.id}: ${e instanceof Error ? e.message : String(e)}\n`);
      }
      if (day === fair && rows.length === 0) {
        empty = true;
        continue;
      }
      HOURS.forEach((h, i) => {
        const end = legalTimeToUtc(y, m, d, h).getTime();
        const pick = rows.filter((r) => {
          const t = Date.parse(String(r[0]));
          // Same place only: a balise that moved measures something else.
          return t > end - 600_000 && t <= end && r[4] != null && r[6] != null && kmBetween(Number(r[1]), Number(r[2]), lat, lon) < 0.3;
        });
        if (!pick.length) return;
        const speed = pick.reduce((a, r) => a + Number(r[4]), 0) / pick.length / 3.6;
        const su = pick.reduce((a, r) => a + Math.sin((Number(r[6]) * Math.PI) / 180), 0);
        const cu = pick.reduce((a, r) => a + Math.cos((Number(r[6]) * Math.PI) / 180), 0);
        const gust = Math.max(...pick.map((r) => Number(r[5] ?? 0))) / 3.6;
        raw.series[`${day.date}|${i}`] = [round(speed, 2), Math.round(((Math.atan2(su, cu) * 180) / Math.PI + 360) % 360), round(gust, 2)];
      });
    }
    if (!empty) out.push(raw);
  }
  return out;
}

export async function prepare(opts: { balises: boolean; dry: boolean }): Promise<void> {
  const log = (m: string) => process.stderr.write(`${m}\n`);
  const { days, offered } = await selectDays();
  log(`Jours : ${days.length} ${JSON.stringify(offered)}`);
  const dem = loadDem(REPO);
  const terrain = analyseTerrain(dem.grid, dem.elevation, dem.landcover);
  const { grid } = terrain;
  const atlas = readJson<Atlas>(join(REPO, 'apps/web/public/data/atlas.json'));
  const index = utcIndex(days);
  const contains = (lon: number, lat: number) => grid.contains(lon, lat);
  const bbox: [number, number, number, number] = [grid.colLon(0), grid.rowLat(grid.height), grid.colLon(grid.width), grid.rowLat(0)];

  const rawFile = join(CACHE, 'obs-raw.json');
  let raw: RawStation[];
  if (existsSync(rawFile)) raw = readJson<RawStation[]>(rawFile);
  else {
    raw = [];
    for (const dept of DEPTS) {
      const part = await readDepartment(dept, index, bbox);
      log(`  dépt ${dept} : ${part.length} postes avec du vent`);
      raw.push(...part);
    }
    if (opts.balises) raw.push(...(await fetchBalises(days, atlas, contains)));
    writeJson(rawFile, raw);
  }
  const hoursTotal = days.length * HOURS.length;
  const massifs = atlas.massifs.filter((m) => m.outline);

  const described: { s: BenchStation; raw: RawStation }[] = [];
  for (const r of raw) {
    if (!contains(r.lon, r.lat)) continue;
    const coverage = Object.keys(r.series).length / hoursTotal;
    if (coverage < MIN_COVERAGE) continue;
    const [x, y] = grid.toGrid(r.lon, r.lat);
    const k = Math.floor(y) * grid.width + Math.floor(x);
    if (terrain.water[k]) continue;
    const zCell = terrain.z[k];
    const depth = terrain.env[k] - terrain.floor[k];
    const rel = (zCell - terrain.floor[k]) / Math.max(depth, 150);
    const slopeDeg = (Math.atan(Math.hypot(terrain.gx[k], terrain.gy[k])) * 180) / Math.PI;
    const tpi = terrain.tpi[k];
    const inside = massifs.find((m) => inRing(r.lon, r.lat, m.outline as unknown as number[][]));
    const nearest = [...massifs].sort((a, b) => kmBetween(r.lat, r.lon, a.center[1], a.center[0]) - kmBetween(r.lat, r.lon, b.center[1], b.center[0]))[0];
    const far = !inside && kmBetween(r.lat, r.lon, nearest.center[1], nearest.center[0]) > 30;
    const m = inside ?? nearest;
    const pioupiou = r.id.startsWith('P');
    described.push({
      raw: r,
      s: {
        id: r.id,
        name: r.name,
        source: pioupiou ? 'pioupiou' : 'mf',
        lat: r.lat,
        lon: r.lon,
        alti: Number.isFinite(r.alti) ? r.alti : Math.round(zCell),
        zCell: Math.round(zCell),
        floor: Math.round(terrain.floor[k]),
        env: Math.round(terrain.env[k]),
        rel: round(rel),
        slopeDeg: round(slopeDeg, 1),
        tpi: Math.round(tpi),
        valley: round(terrain.valley[k]),
        setting: pioupiou ? 'balise' : classify({ rel, depth, slopeDeg, tpi }),
        massif: far ? 'hors-secteur' : m.id,
        region: far ? 'Avant-pays' : (m.region ?? m.id),
        coverage: round(coverage),
      },
    });
  }
  // Balanced choice: best coverage first, spread in space, a cap per region and setting.
  const counts = new Map<string, number>();
  const chosen: BenchStation[] = [];
  for (const { s } of [...described].sort((a, b) => b.s.coverage - a.s.coverage || a.s.id.localeCompare(b.s.id))) {
    const big = s.setting === 'fond' && s.valley >= BIG_VALLEY;
    const key = s.setting === 'balise' ? 'balise' : `${s.region}|${s.setting}|${big}`;
    const cap = s.setting === 'balise' ? KEPT_BALISES : big ? CAP_BIG_VALLEY : CAP_PER_GROUP;
    if ((counts.get(key) ?? 0) >= cap) continue;
    if (Math.abs(s.alti - s.zCell) > 300) continue;
    if (chosen.some((o) => kmBetween(o.lat, o.lon, s.lat, s.lon) < MIN_SPACING_KM)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    chosen.push(s);
  }
  log(`Postes : ${raw.length} lus, ${described.length} assez complets, ${chosen.length} retenus`);

  writeJson(join(CACHE, 'stations.json'), chosen);
  if (opts.dry) {
    for (const s of [...chosen].sort((a, b) => a.setting.localeCompare(b.setting) || a.region.localeCompare(b.region))) log(`${s.setting}\t${s.region}\t${s.name}\t${s.alti} m (maille ${s.zCell})\trel ${s.rel} prof ${s.env - s.floor} pente ${s.slopeDeg} tpi ${s.tpi} vallée ${s.valley} couv ${s.coverage}`);
    log(`Par cadre : ${JSON.stringify(chosen.reduce<Record<string, number>>((a, s) => ((a[s.setting] = (a[s.setting] ?? 0) + 1), a), {}))}`);
    return;
  }
  const windows = dayWindows(days);
  const centre = { lat: 45.0, lon: 6.25 };
  const cells = new Map<string, [number, number]>();
  for (const s of chosen) {
    const c = soundingCell(s.lat, s.lon);
    cells.set(c.join(), c);
  }
  cells.set([centre.lat, centre.lon].join(), [centre.lat, centre.lon]);
  log(`Fenêtres de jours : ${windows.length}, cellules de sondage : ${cells.size}`);
  await fetchSoundings([...cells.values()], windows);
  const arome = await fetchArome10m(chosen, days, windows);

  const obs: Bundle['obs'] = {};
  for (const { s, raw: r } of described) {
    if (!chosen.includes(s)) continue;
    obs[s.id] = {};
    for (const d of days) obs[s.id][d.date] = HOURS.map((_, i) => r.series[`${d.date}|${i}`] ?? null);
  }
  const bundle: Bundle = { version: 1, created: new Date().toISOString(), days, stations: chosen, obs, arome, centre };
  writeJson(BUNDLE, bundle);
  log(`Écrit : ${BUNDLE}`);
}
