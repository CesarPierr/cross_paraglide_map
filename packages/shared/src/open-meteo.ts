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

/** Pressure levels of the sounding (≈ 500 m → 5500 m), all available in AROME 2.5 km. */
export const PROFILE_LEVELS = [950, 900, 850, 800, 750, 700, 650, 600, 550, 500];
const LEVEL_VARS = ['temperature', 'dew_point', 'wind_speed', 'wind_direction', 'geopotential_height'];
const SURFACE_VARS = ['temperature_2m', 'dew_point_2m', 'cape', 'cloud_cover', 'cloud_cover_low', 'precipitation'];
/** AROME has the best vertical profile over the Alps (24 levels, every 3 h); boundary-layer height only exists in IFS / GFS. */
export const PROFILE_MODEL = 'meteofrance_arome_france';
export const BLH_MODEL = 'ecmwf_ifs';
/** Open-Meteo `meta.json` domain of the profile model (used to detect new runs). */
export const PROFILE_MODEL_DOMAIN = 'meteofrance_arome_france0025';

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

/** Variables of the point-forecast request. */
export const POINT_VARIABLES = [...SURFACE_VARS, ...PROFILE_LEVELS.flatMap((l) => LEVEL_VARS.map((v) => `${v}_${l}hPa`))];
const BLH_VARIABLES = ['boundary_layer_height', 'freezing_level_height'];

/** Open-Meteo cost of one location: max(1, variables × models / 10) per request. */
export const callCost = (variables: number) => Math.max(1, variables / 10);
/** Weighted calls of one point forecast (profile request + boundary-layer request). */
export const POINT_COST = callCost(POINT_VARIABLES.length) + callCost(BLH_VARIABLES.length);

/** Upstream HTTP failure; 429 means Open-Meteo's own per-IP limit is reached (minute, hour or day). */
export class UpstreamHttpError extends Error {
  constructor(
    public status: number,
    /** Open-Meteo's explanation, e.g. "Daily API request limit exceeded…". */
    public reason = '',
  ) {
    super(`Open-Meteo ${status} ${reason}`.trim());
  }
}

type Hourly = Record<string, (number | null)[]> & { time: string[] };

async function get(params: Record<string, string>, signal?: AbortSignal): Promise<{ hourly: Hourly; elevation: number }> {
  const res = await fetch(`${API}?${new URLSearchParams(params)}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { reason?: string } | null;
    throw new UpstreamHttpError(res.status, body?.reason ?? '');
  }
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
        cell_selection: 'nearest',
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
    const common = { latitude: lat.toFixed(3), longitude: lon.toFixed(3), wind_speed_unit: 'kmh', timezone: 'Europe/Paris', forecast_days: '2' };
    const [j, b] = await Promise.all([
      get({ ...common, models: PROFILE_MODEL, hourly: POINT_VARIABLES.join(',') }, signal),
      get({ ...common, models: BLH_MODEL, hourly: BLH_VARIABLES.join(',') }, signal).catch(() => null),
    ]);
    const h = j.hourly;
    const val = (k: string, i: number): number | undefined => h[k]?.[i] ?? undefined;
    const blh = new Map<string, { bl?: number; fz?: number }>();
    b?.hourly.time.forEach((t, i) => blh.set(t, { bl: b.hourly.boundary_layer_height?.[i] ?? undefined, fz: b.hourly.freezing_level_height?.[i] ?? undefined }));
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
        boundaryLayerM: blh.get(t)?.bl,
        cape: val('cape', i),
        cloudCoverLow: val('cloud_cover_low', i),
        cloudCover: val('cloud_cover', i),
        precipitation: val('precipitation', i),
        freezingLevelM: blh.get(t)?.fz,
        profile: PROFILE_LEVELS.flatMap((l): ProfileLevel[] => {
          const Tl = val(`temperature_${l}hPa`, i);
          const tdl = val(`dew_point_${l}hPa`, i);
          const ws = val(`wind_speed_${l}hPa`, i);
          const wd = val(`wind_direction_${l}hPa`, i);
          const z = val(`geopotential_height_${l}hPa`, i);
          if (Tl === undefined || ws === undefined || wd === undefined || z === undefined) return [];
          // Levels below the model ground are extrapolated: drop them.
          if (z < j.elevation - 30) return [];
          return [{ pressure: l, heightM: Math.round(z), temperature: Tl, dewpoint: tdl, windFromDeg: wd, windKmh: ws }];
        }),
        synoptic: s8 !== undefined && d8 !== undefined && s7 !== undefined && d7 !== undefined ? ridgeWind(t, s8, d8, s7, d7) : undefined,
      };
    });
    return { elevation: j.elevation, hours };
  },
};
