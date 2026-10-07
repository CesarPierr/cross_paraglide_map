/**
 * Open-Meteo forecast (free, keyless, CORS-enabled; CC BY 4.0 — attribution
 * "Weather data by Open-Meteo.com" required next to the data).
 *
 * - Synoptic input: wind at 850 hPa (~1500 m) and 700 hPa (~3000 m) from the
 *   Météo-France AROME/ARPEGE blend, averaged as vectors → ridge-level wind.
 * - Point forecast: temperature / dew point (cumulus base estimate), boundary
 *   layer height, CAPE, low clouds, freezing level.
 */
import type { PointForecast, ProfileLevel, SynopticWind, WeatherProvider } from './providers';

const API = 'https://api.open-meteo.com/v1/forecast';

/** Pressure levels of the sounding (≈ 500 m → 5500 m). */
export const PROFILE_LEVELS = [950, 900, 850, 800, 750, 700, 650, 600, 500];
const LEVEL_VARS = ['temperature', 'relative_humidity', 'wind_speed', 'wind_direction', 'geopotential_height'];
const SURFACE_VARS = ['temperature_2m', 'dew_point_2m', 'cape', 'boundary_layer_height', 'cloud_cover', 'cloud_cover_low', 'freezing_level_height', 'precipitation'];

const RAD = Math.PI / 180;
const windVector = (fromDeg: number, speed: number): [number, number] => [-Math.sin(fromDeg * RAD) * speed, -Math.cos(fromDeg * RAD) * speed];
const windFromDeg = (u: number, v: number) => ((Math.atan2(-u, -v) / RAD) + 360) % 360;

/** Magnus formula: dew point from temperature (°C) and relative humidity (%). */
export function dewpoint(t: number, rh: number): number {
  const a = 17.62;
  const b = 243.12;
  const g = Math.log(Math.max(rh, 1) / 100) + (a * t) / (b + t);
  return (b * g) / (a - g);
}

/** Variables of the point-forecast request; Open-Meteo bills ~1 call per 10 variables. */
export const POINT_VARIABLES = [...SURFACE_VARS, ...PROFILE_LEVELS.flatMap((l) => LEVEL_VARS.map((v) => `${v}_${l}hPa`))];

type Hourly = Record<string, (number | null)[]> & { time: string[] };

async function get(params: Record<string, string>, signal?: AbortSignal): Promise<{ hourly: Hourly; elevation: number }> {
  const res = await fetch(`${API}?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return (await res.json()) as { hourly: Hourly; elevation: number };
}

function ridgeWind(t: string, s8: number, d8: number, s7: number, d7: number): SynopticWind {
  const a = windVector(d8, s8);
  const b = windVector(d7, s7);
  const u = (a[0] + b[0]) / 2;
  const v = (a[1] + b[1]) / 2;
  return {
    time: t,
    hour: Number(t.slice(11, 13)),
    fromDeg: Math.round(windFromDeg(u, v)),
    speedKmh: Math.round(Math.hypot(u, v)),
    levels: { '850hPa': [d8, s8], '700hPa': [d7, s7] },
  };
}

const WIND_VARS = ['wind_speed_850hPa', 'wind_direction_850hPa', 'wind_speed_700hPa', 'wind_direction_700hPa'];

export const openMeteo: WeatherProvider = {
  id: 'open-meteo',
  label: 'Open-Meteo (AROME/ARPEGE)',
  attribution: '<a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather data by Open-Meteo.com</a>',

  async synoptic(lat, lon, signal) {
    const j = await get(
      {
        latitude: lat.toFixed(3),
        longitude: lon.toFixed(3),
        hourly: WIND_VARS.join(','),
        models: 'meteofrance_seamless',
        wind_speed_unit: 'kmh',
        timezone: 'Europe/Paris',
        forecast_days: '3',
      },
      signal,
    );
    const h = j.hourly;
    const out: SynopticWind[] = [];
    h.time.forEach((t, i) => {
      const [s8, d8, s7, d7] = WIND_VARS.map((k) => h[k][i]);
      if (s8 == null || d8 == null || s7 == null || d7 == null) return;
      out.push(ridgeWind(t, s8, d8, s7, d7));
    });
    return out;
  },

  async pointForecast(lat, lon, signal) {
    const vars = POINT_VARIABLES;
    const j = await get(
      {
        latitude: lat.toFixed(3),
        longitude: lon.toFixed(3),
        hourly: vars.join(','),
        wind_speed_unit: 'kmh',
        timezone: 'Europe/Paris',
        forecast_days: '3',
      },
      signal,
    );
    const h = j.hourly;
    const val = (k: string, i: number): number | undefined => h[k]?.[i] ?? undefined;
    const hours: PointForecast[] = h.time.map((t, i) => {
      const T = val('temperature_2m', i);
      const Td = val('dew_point_2m', i);
      const [s8, d8, s7, d7] = WIND_VARS.map((k) => val(k, i));
      return {
        time: t,
        hour: Number(t.slice(11, 13)),
        temperature2m: T,
        dewpoint2m: Td,
        // Espy's rule: ~125 m per °C of dew-point spread, above the model ground.
        cloudBaseM: T !== undefined && Td !== undefined ? Math.round(j.elevation + 125 * Math.max(0, T - Td)) : undefined,
        boundaryLayerM: val('boundary_layer_height', i),
        cape: val('cape', i),
        cloudCoverLow: val('cloud_cover_low', i),
        cloudCover: val('cloud_cover', i),
        precipitation: val('precipitation', i),
        freezingLevelM: val('freezing_level_height', i),
        profile: PROFILE_LEVELS.flatMap((l): ProfileLevel[] => {
          const T = val(`temperature_${l}hPa`, i);
          const rh = val(`relative_humidity_${l}hPa`, i);
          const ws = val(`wind_speed_${l}hPa`, i);
          const wd = val(`wind_direction_${l}hPa`, i);
          const z = val(`geopotential_height_${l}hPa`, i);
          if (T === undefined || ws === undefined || wd === undefined || z === undefined) return [];
          // Levels below the model ground are extrapolated: drop them.
          if (z < j.elevation - 30) return [];
          return [{ pressure: l, heightM: Math.round(z), temperature: T, dewpoint: rh !== undefined ? Math.round(dewpoint(T, rh) * 10) / 10 : undefined, windFromDeg: wd, windKmh: ws }];
        }),
        synoptic: s8 !== undefined && d8 !== undefined && s7 !== undefined && d7 !== undefined ? ridgeWind(t, s8, d8, s7, d7) : undefined,
      };
    });
    return { elevation: j.elevation, hours };
  },
};
