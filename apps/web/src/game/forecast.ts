/**
 * Weather of the day for the game: the forecast at the take-off (AROME/ARPEGE via the
 * site's API, as the map's forecast mode), hour by hour, turned into the game's air mass:
 * ridge-level wind, instability from the lapse rate between 850 and 700 hPa, humidity
 * from the height of the cumulus base above the ground.
 */
import type { PointForecast, SynopticWind } from '@brises/shared';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

export interface DayWeather {
  hour: number;
  windFrom: number;
  windKmh: number;
  /** Lapse rate 850–700 hPa (K/km), if forecast. */
  lapseRate: number | null;
  /** Cumulus base (m AMSL) and cloud cover (%), if forecast. */
  cloudBaseM: number | null;
  cloudCover: number | null;
  /** The game's air mass (airmass.ts → Scenario). */
  instability: number;
  humidity: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** 0 stable … 1 very unstable, from the lapse rate (K/km): 3 → 0.05, 6 → 0.5, 9 → 1. */
export const instabilityOf = (lapse: number | null) => (lapse === null ? 0.5 : clamp((lapse - 3) / 6, 0.05, 1));
/** 0 dry (blue thermals) … 1 low cumulus, from the cumulus base above the forecast ground (m). */
export const humidityOf = (baseAgl: number | null) => (baseAgl === null ? 0.5 : clamp(1.1 - baseAgl / 2500, 0, 1));

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { signal });
  if (!r.ok) throw new Error(`prévision indisponible (${r.status})`);
  return (await r.json()) as T;
}

/** Today's forecast hours at a place, from the morning to the evening. */
export async function fetchDayWeather(lat: number, lon: number, signal?: AbortSignal): Promise<DayWeather[]> {
  const q = `lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
  const [syn, point] = await Promise.all([
    get<SynopticWind[]>(`/weather/synoptic?${q}`, signal),
    get<{ elevation: number; hours: PointForecast[] }>(`/weather/point?${q}`, signal).catch(() => null),
  ]);
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const points = new Map((point?.hours ?? []).map((h) => [h.time, h]));
  return syn
    .filter((h) => h.time.startsWith(today) && h.hour >= 7 && h.hour <= 20)
    .map((h) => {
      const p = points.get(h.time);
      const base = p?.cloudBaseM ?? null;
      const lapse = h.lapseRate ?? null;
      return {
        hour: h.hour,
        windFrom: h.fromDeg,
        windKmh: h.speedKmh,
        lapseRate: lapse,
        cloudBaseM: base,
        cloudCover: p?.cloudCover ?? null,
        instability: instabilityOf(lapse),
        humidity: humidityOf(base !== null && point ? base - point.elevation : null),
      };
    });
}

/** The forecast hour nearest to a start time (decimal hours). */
export function weatherAt(list: DayWeather[], hour: number): DayWeather | undefined {
  let best: DayWeather | undefined;
  for (const w of list) if (!best || Math.abs(w.hour - hour) < Math.abs(best.hour - hour)) best = w;
  return best;
}
