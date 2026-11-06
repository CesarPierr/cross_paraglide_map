/**
 * Picks the bench days from the archived AROME forecast of 2025 at a few reference points.
 * The rule is deterministic and documented in docs/VALIDATION.md: fair-weather breeze days,
 * moderate winds by sector, strong winds (bise, foehn, westerly, mistral), stable winter days.
 */
import type { DayClass, BenchDay } from './common';
import { CACHE, fetchTextCached, round } from './common';
import { join } from 'node:path';

export const OM_ARCHIVE = 'https://historical-forecast-api.open-meteo.com/v1/forecast';
const YEAR = 2025;

/** Reference points: north, west, inner south, south. The 0.25° cells of the app. */
const REF = [
  { id: 'nord', lat: 45.75, lon: 6.5 },
  { id: 'ouest', lat: 45.0, lon: 5.75 },
  { id: 'sud-int', lat: 44.5, lon: 6.25 },
  { id: 'sud', lat: 43.75, lon: 6.5 },
];
const VARS = ['wind_speed_850hPa', 'wind_direction_850hPa', 'wind_speed_700hPa', 'wind_direction_700hPa', 'temperature_850hPa', 'temperature_700hPa', 'cloud_cover_low', 'cloud_cover_mid'];

interface Daily {
  date: string;
  month0: number;
  /** Per reference point: daytime mean of the ridge wind vector, speed (km/h), cloud (0..1), lapse (K/km). */
  pts: { kmh: number; from: number; cloud: number; lapse: number; maxKmh: number }[];
}

const RAD = Math.PI / 180;

async function dailyStats(): Promise<Daily[]> {
  const days = new Map<string, Daily>();
  for (let p = 0; p < REF.length; p++) {
    const r = REF[p];
    const url = `${OM_ARCHIVE}?latitude=${r.lat}&longitude=${r.lon}&start_date=${YEAR}-01-01&end_date=${YEAR}-12-31&hourly=${VARS.join(',')}&models=meteofrance_seamless&cell_selection=nearest&wind_speed_unit=kmh&timezone=GMT`;
    const text = await fetchTextCached(url, join(CACHE, `om/prescreen_${r.id}_${YEAR}.json`), 2000);
    const h = (JSON.parse(text) as { hourly: Record<string, (number | null)[]> & { time: string[] } }).hourly;
    const per = new Map<string, { u: number; v: number; s: number; m: number; c: number; l: number; n: number }>();
    h.time.forEach((t, i) => {
      // 06–17 UTC covers the scored local hours in every season, with no DST bookkeeping.
      const hour = Number(t.slice(11, 13));
      if (hour < 6 || hour > 17) return;
      const [s8, d8, s7, d7, t8, t7, cl, cm] = VARS.map((k) => h[k][i]);
      if (s8 == null || d8 == null || s7 == null || d7 == null || t8 == null || t7 == null) return;
      const u = (-Math.sin(d8 * RAD) * s8 - Math.sin(d7 * RAD) * s7) / 2;
      const v = (-Math.cos(d8 * RAD) * s8 - Math.cos(d7 * RAD) * s7) / 2;
      const key = t.slice(0, 10);
      const e = per.get(key) ?? { u: 0, v: 0, s: 0, m: 0, c: 0, l: 0, n: 0 };
      e.u += u;
      e.v += v;
      const sp = Math.hypot(u, v);
      e.s += sp;
      e.m = Math.max(e.m, sp);
      e.c += 1 - (1 - (cl ?? 0) / 100) * (1 - (cm ?? 0) / 100);
      e.l += (t8 - t7) / 1.555;
      e.n++;
      per.set(key, e);
    });
    for (const [date, e] of per) {
      if (e.n < 8) continue;
      const d = days.get(date) ?? { date, month0: Number(date.slice(5, 7)) - 1, pts: [] };
      d.pts[p] = { kmh: e.s / e.n, from: ((Math.atan2(-e.u, -e.v) / RAD) + 360) % 360, cloud: e.c / e.n, lapse: e.l / e.n, maxKmh: e.m };
      days.set(date, d);
    }
  }
  return [...days.values()].filter((d) => REF.every((_, i) => d.pts[i])).sort((a, b) => a.date.localeCompare(b.date));
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const angleDiff = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
};
function meanFrom(d: Daily, idx: number[] = [0, 1, 2, 3]): number {
  let u = 0;
  let v = 0;
  for (const i of idx) {
    u += -Math.sin(d.pts[i].from * RAD) * d.pts[i].kmh;
    v += -Math.cos(d.pts[i].from * RAD) * d.pts[i].kmh;
  }
  return ((Math.atan2(-u, -v) / RAD) + 360) % 360;
}
const allKmh = (d: Daily, idx: number[] = [0, 1, 2, 3]) => mean(idx.map((i) => d.pts[i].kmh));

/** Takes the best-scored days (lowest score) under a minimum spacing with what is already taken. */
function pick(cands: Daily[], score: (d: Daily) => number, n: number, taken: Set<string>, spacing = 3): Daily[] {
  const out: Daily[] = [];
  const t = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
  for (const d of [...cands].sort((a, b) => score(a) - score(b) || a.date.localeCompare(b.date))) {
    if (out.length >= n) break;
    if ([...taken].some((x) => Math.abs(t(x) - t(d.date)) < spacing)) continue;
    out.push(d);
    taken.add(d.date);
  }
  return out;
}

export interface Selection {
  days: BenchDay[];
  /** How many days of the year each class offered. */
  offered: Record<string, number>;
}

export async function selectDays(scale = 1): Promise<Selection> {
  const all = await dailyStats();
  const taken = new Set<string>();
  const offered: Record<string, number> = {};
  const out: { d: Daily; klass: DayClass; label: string }[] = [];
  const take = (name: string, klass: DayClass, cands: Daily[], score: (d: Daily) => number, n: number) => {
    offered[name] = cands.length;
    for (const d of pick(cands, score, Math.max(1, Math.round(n * scale)), taken)) out.push({ d, klass, label: name });
  };

  // Fair-weather breeze days, April to September: weak ridge wind everywhere, little cloud.
  const breeze = all.filter((d) => d.month0 >= 3 && d.month0 <= 8 && d.pts.every((p) => p.kmh < 18 && p.cloud < 0.4) && allKmh(d) < 13);
  // Two per month so that the season is covered (spring lakes, midsummer).
  for (let m = 3; m <= 8; m++) {
    take(`brise-${String(m + 1).padStart(2, '0')}`, 'brise', breeze.filter((d) => d.month0 === m), (d) => allKmh(d) + 20 * mean(d.pts.map((p) => p.cloud)), 2);
  }
  // Moderate wind, by sector of the ridge wind over the four points.
  const sector = (d: Daily, c: number, tol = 45) => angleDiff(meanFrom(d), c) <= tol;
  const moderate = all.filter((d) => allKmh(d) >= 20 && allKmh(d) <= 35 && d.month0 >= 2 && d.month0 <= 9);
  const mid = (d: Daily) => Math.abs(allKmh(d) - 27);
  take('modere-nord', 'modere', moderate.filter((d) => sector(d, 0)), mid, 2);
  take('modere-sud', 'modere', moderate.filter((d) => sector(d, 180)), mid, 2);
  take('modere-ouest', 'modere', moderate.filter((d) => sector(d, 270)), mid, 2);
  // Strong wind: north/north-east (bise) in the north, south (foehn), west, mistral in the south.
  const north = [0, 1];
  const south = [2, 3];
  take(
    'bise',
    'fort',
    all.filter((d) => allKmh(d, north) >= 28 && angleDiff(meanFrom(d, north), 20) <= 40),
    (d) => -allKmh(d, north),
    2,
  );
  take(
    'foehn-sud',
    'fort',
    all.filter((d) => allKmh(d) >= 38 && sector(d, 180, 40)),
    (d) => -allKmh(d),
    2,
  );
  take(
    'ouest-fort',
    'fort',
    all.filter((d) => allKmh(d) >= 40 && sector(d, 280, 40)),
    (d) => -allKmh(d),
    2,
  );
  take(
    'mistral',
    'fort',
    all.filter((d) => allKmh(d, south) >= 40 && angleDiff(meanFrom(d, south), 340) <= 40),
    (d) => -allKmh(d, south),
    2,
  );
  // Stable winter days: weak wind, stable air, sun or not (cold pools, inversions).
  const stable = all.filter((d) => (d.month0 >= 10 || d.month0 <= 1) && allKmh(d) < 15 && mean(d.pts.map((p) => p.lapse)) < 4.5);
  take('stable-hiver', 'stable', stable, (d) => mean(d.pts.map((p) => p.lapse)) + allKmh(d) / 10, 4);

  const days: BenchDay[] = out
    .sort((a, b) => a.d.date.localeCompare(b.d.date))
    .map(({ d, klass, label }) => ({
      date: d.date,
      klass,
      label,
      ridgeKmh: round(allKmh(d), 1),
      ridgeFrom: Math.round(meanFrom(d)),
      cloud: round(mean(d.pts.map((p) => p.cloud))),
      lapse: round(mean(d.pts.map((p) => p.lapse)), 1),
      fold: 'A',
    }));
  // Folds alternate inside each class: A to tune, B kept as a hold-out.
  const count = new Map<string, number>();
  for (const d of days) {
    const n = count.get(d.klass) ?? 0;
    d.fold = n % 2 === 0 ? 'A' : 'B';
    count.set(d.klass, n + 1);
  }
  return { days, offered };
}
