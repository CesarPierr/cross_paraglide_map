/**
 * Synoptic wind from the Open-Meteo forecast (Météo-France AROME/ARPEGE blend):
 * wind at 850 hPa (~1500 m) and 700 hPa (~3000 m), averaged as vectors to get
 * a ridge-level (~2200 m) wind. CORS-enabled, no key, CC BY 4.0.
 */
import { windFromDeg, windVector } from '../model/grid';

export interface ForecastHour {
  time: string;
  hour: number;
  fromDeg: number;
  speedKmh: number;
  w850: [number, number];
  w700: [number, number];
}

export async function fetchRidgeWind(lat: number, lon: number): Promise<ForecastHour[]> {
  const url =
    'https://api.open-meteo.com/v1/forecast?' +
    new URLSearchParams({
      latitude: lat.toFixed(3),
      longitude: lon.toFixed(3),
      hourly: 'wind_speed_850hPa,wind_direction_850hPa,wind_speed_700hPa,wind_direction_700hPa',
      models: 'meteofrance_seamless',
      wind_speed_unit: 'kmh',
      timezone: 'Europe/Paris',
      forecast_days: '3',
    }).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const j = (await res.json()) as {
    hourly: Record<string, (number | null)[]> & { time: string[] };
  };
  const h = j.hourly;
  const out: ForecastHour[] = [];
  h.time.forEach((t, i) => {
    const s8 = h.wind_speed_850hPa[i];
    const d8 = h.wind_direction_850hPa[i];
    const s7 = h.wind_speed_700hPa[i];
    const d7 = h.wind_direction_700hPa[i];
    if (s8 == null || d8 == null || s7 == null || d7 == null) return;
    const a = windVector(d8, s8);
    const b = windVector(d7, s7);
    const u = (a[0] + b[0]) / 2;
    const v = (a[1] + b[1]) / 2;
    out.push({ time: t, hour: Number(t.slice(11, 13)), fromDeg: Math.round(windFromDeg(u, v)), speedKmh: Math.round(Math.hypot(u, v)), w850: [d8, s8], w700: [d7, s7] });
  });
  return out;
}
