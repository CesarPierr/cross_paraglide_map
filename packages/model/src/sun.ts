/**
 * Solar position (NOAA low-precision algorithm, ~0.5° accuracy) and French
 * legal-time helpers. Accurate enough to light slopes and pace the breezes.
 */
import { smoothstep } from './raster';

export interface SunPosition {
  /** Degrees clockwise from north. */
  azimuth: number;
  /** Degrees above the horizon. */
  elevation: number;
}

const RAD = Math.PI / 180;

export function sunPosition(dateUtc: Date, lat: number, lon: number): SunPosition {
  const jd = dateUtc.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24;
  const lst = gmst * 15 + lon;
  const H = (lst * RAD - ra) % (2 * Math.PI);
  const phi = lat * RAD;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { azimuth: ((az / RAD) % 360 + 360) % 360, elevation: el / RAD };
}

/** Last Sunday of a month (UTC date number). */
function lastSunday(year: number, month0: number): number {
  const last = new Date(Date.UTC(year, month0 + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/** Offset of French legal time from UTC (hours): +2 in summer time, +1 otherwise. */
export function franceUtcOffset(year: number, month0: number, day: number): number {
  const start = lastSunday(year, 2); // March
  const end = lastSunday(year, 9); // October
  if (month0 > 2 && month0 < 9) return 2;
  if (month0 === 2) return day >= start ? 2 : 1;
  if (month0 === 9) return day < end ? 2 : 1;
  return 1;
}

/** UTC Date for a French legal time given as decimal hours. */
export function legalTimeToUtc(year: number, month0: number, day: number, hours: number): Date {
  const offset = franceUtcOffset(year, month0, day);
  return new Date(Date.UTC(year, month0, day, 0, 0, 0) + (hours - offset) * 3600000);
}

/** Local mean solar time (decimal hours) for a UTC instant at longitude `lon`. */
export function solarTime(dateUtc: Date, lon: number): number {
  const h = dateUtc.getUTCHours() + dateUtc.getUTCMinutes() / 60 + dateUtc.getUTCSeconds() / 3600;
  return (((h + lon / 15) % 24) + 24) % 24;
}

/** Local solar time of sunrise (decimal hours) on a flat horizon. */
export function sunriseSolarHour(month0: number, day: number, lat: number): number {
  const doy = Math.floor((Date.UTC(2026, month0, day) - Date.UTC(2026, 0, 0)) / 86400000);
  const dec = 23.44 * Math.sin(((2 * Math.PI) / 365) * (doy - 81)) * RAD;
  const cosH0 = Math.max(-1, Math.min(1, -Math.tan(lat * RAD) * Math.tan(dec)));
  return 12 - Math.acos(cosH0) / RAD / 15;
}

/** Sun elevation at local solar noon (degrees), used as a seasonal intensity proxy. */
export function noonElevation(month0: number, day: number, lat: number): number {
  const doy = Math.floor((Date.UTC(2026, month0, day) - Date.UTC(2026, 0, 0)) / 86400000);
  const dec = 23.44 * Math.sin(((2 * Math.PI) / 365) * (doy - 81));
  return 90 - lat + dec;
}

/** Maximum number of sun positions sampled since sunrise (`sunSamples`); the GPU shader has the same array size. */
export const SUN_SAMPLES_MAX = 32;
/** Sampling step of the sun path since sunrise (hours). */
const SUN_SAMPLE_STEP = 0.5;

/**
 * Sun positions since sunrise, to integrate the sunshine received by each slope
 * (cumulative insolation, `TimeContext.sunHours`): midpoints of equal steps of at
 * most 0.5 h from sunrise (flat horizon) to the given legal time, at most
 * SUN_SAMPLES_MAX. Four floats per sample: unit vector to the sun (east, north, up)
 * and weight = step duration (h) × low-sun attenuation (same as the instantaneous
 * insolation). The CPU model and the GPU engine both use this array.
 */
export function sunSamples(year: number, month0: number, day: number, hour: number, lat: number, lon: number): Float32Array {
  const utc = legalTimeToUtc(year, month0, day, hour);
  const solar = solarTime(utc, lon);
  const span = solar - sunriseSolarHour(month0, day, lat);
  if (span <= 0) return new Float32Array(0);
  const n = Math.min(SUN_SAMPLES_MAX, Math.ceil(span / SUN_SAMPLE_STEP));
  const dt = span / n;
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const back = span - (i + 0.5) * dt;
    const s = sunPosition(new Date(utc.getTime() - back * 3600000), lat, lon);
    if (s.elevation <= -1) continue;
    const el = s.elevation * RAD;
    const az = s.azimuth * RAD;
    out[i * 4] = Math.sin(az) * Math.cos(el);
    out[i * 4 + 1] = Math.cos(az) * Math.cos(el);
    out[i * 4 + 2] = Math.sin(Math.max(el, 0.005));
    out[i * 4 + 3] = dt * smoothstep(-1, 12, s.elevation);
  }
  return out;
}
