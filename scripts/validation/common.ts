/**
 * Hindcast bench: paths, polite cached downloads, the shape of the prepared dataset.
 * Raw data stays under .cache/validation (gitignored). See docs/VALIDATION.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** The dataset is shared by all revisions: a worktree run points here through the environment. */
export const REPO = resolve(process.env.HINDCAST_REPO ?? process.cwd());
export const CACHE = join(REPO, '.cache/validation');
export const BUNDLE = join(CACHE, 'bench.json');
export const USER_AGENT = 'brises-des-alpes-hindcast/0.1 (public research bench; https://github.com/CesarPierr/cross_paraglide_map)';

/** Hours of the day scored, French legal time. */
export const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

export type Setting = 'fond' | 'pente' | 'sommet' | 'plaine' | 'balise';
export type DayClass = 'brise' | 'modere' | 'fort' | 'stable';

export interface BenchDay {
  date: string;
  klass: DayClass;
  /** Sector of the day's ridge wind (N, E, S, W…), or the case it was chosen for (bise, foehn, mistral…). */
  label: string;
  /** Ridge wind (km/h), cloud cover (0..1) and lapse rate (K/km): daytime means over the reference points. */
  ridgeKmh: number;
  ridgeFrom: number;
  cloud: number;
  lapse: number;
  /** Tuning fold (A) and hold-out fold (B), alternating inside each class. */
  fold: 'A' | 'B';
}

export interface BenchStation {
  id: string;
  name: string;
  source: 'mf' | 'pioupiou';
  lat: number;
  lon: number;
  /** Declared altitude of the station (m). */
  alti: number;
  /** DEM at the station's cell, valley floor and crest envelope (m), from the revision that prepared the bench. */
  zCell: number;
  floor: number;
  env: number;
  /** Height in the valley: (zCell − floor) / max(env − floor, 150). */
  rel: number;
  slopeDeg: number;
  tpi: number;
  valley: number;
  setting: Setting;
  massif: string;
  region: string;
  /** Hours with a valid observation among the selected days and hours. */
  coverage: number;
}

export interface Bundle {
  version: number;
  created: string;
  days: BenchDay[];
  stations: BenchStation[];
  /**
   * Per station, per day, per scored hour: observed mean wind (m/s, 10 m for Météo-France),
   * direction it blows from (deg), strongest gust of the hour (m/s). Null when missing.
   */
  obs: Record<string, Record<string, ([number, number, number | null] | null)[]>>;
  /** AROME 2.5 km 10 m wind at the station: [speed m/s, from deg] per hour. */
  arome: Record<string, Record<string, ([number, number] | null)[]>>;
  /** Fixed reference cell used for the "one sounding for the whole map" variant. */
  centre: { lat: number; lon: number };
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  ensureDir(dirname(path));
  writeFileSync(path, JSON.stringify(value));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Downloads once to `path` (text); retries a few times on overload, never on a refusal. */
export async function fetchTextCached(url: string, path: string, waitMs = 0): Promise<string> {
  if (existsSync(path)) return readFileSync(path, 'utf8');
  ensureDir(dirname(path));
  for (let attempt = 0; ; attempt++) {
    if (waitMs) await sleep(waitMs);
    let res: Response | null = null;
    try {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    } catch (e) {
      if (attempt >= 5) throw e;
    }
    if (res?.ok) {
      const text = await res.text();
      writeFileSync(path, text);
      return text;
    }
    if (res && res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url}: ${(await res.text()).slice(0, 300)}`);
    if (attempt >= 5) throw new Error(`${res?.status ?? 'network'} after retries: ${url}`);
    const pause = res?.status === 429 ? 70_000 : 5_000 * (attempt + 1);
    process.stderr.write(`  ${res?.status ?? 'network'}: pause ${pause / 1000} s\n`);
    await sleep(pause);
  }
}

export const round = (x: number, d = 2) => {
  const f = 10 ** d;
  return Math.round(x * f) / f;
};

/** Groups the selected days into windows of at most 14 days: the API weight does not grow below that. */
export function dayWindows(days: BenchDay[]): [string, string][] {
  const t = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;
  const sorted = days.map((d) => d.date).sort();
  const out: [string, string][] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (const d of sorted.slice(1)) {
    if (t(d) - t(start) < 14) end = d;
    else {
      out.push([start, end]);
      start = end = d;
    }
  }
  out.push([start, end]);
  return out;
}

/** The app's cell of the synoptic forecast: 0.25° (apps/api/src/services/weather.ts). */
export const soundingCell = (lat: number, lon: number): [number, number] => [Math.round(lat / 0.25) * 0.25, Math.round(lon / 0.25) * 0.25];
export const soundingPath = (la: number, lo: number, start: string, end: string) => join(CACHE, `om/sounding_${la.toFixed(2)}_${lo.toFixed(2)}_${start}_${end}.json`);
