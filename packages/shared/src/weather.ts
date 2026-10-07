/**
 * Soaring indicators derived from a forecast sounding (pure functions, used
 * by the web app and the API).
 *
 * - Cumulus base (LCL): Espy's approximation, 125 m per °C of dew-point spread.
 * - Thermal top: dry-adiabatic parcel (9.8 °C/km) from the surface temperature
 *   plus a small superadiabatic excess, until it meets the environment
 *   temperature; above the LCL the parcel follows a moist lapse rate (~6 °C/km)
 *   and the thermal continues as a cloud.
 * - Thermal strength: Deardorff convective velocity scale w* ≈ (g/T · H · Q)^(1/3)
 *   with a sensible heat flux Q estimated from the season and cloud cover; a
 *   paraglider climbs at roughly w* − 1.1 m/s (sink rate).
 */
import type { ProfileLevel } from './providers';

export interface ThermalEstimate {
  /** Cumulus base (m AMSL), if the parcel reaches saturation before its top. */
  cloudBaseM: number | null;
  /** Top of the dry thermals or of the cloud (m AMSL). */
  thermalTopM: number;
  /** Usable height above the ground (m). */
  depthM: number;
  /** Mean environmental lapse rate in the convective layer (°C/km). */
  lapseRate: number;
  /** Convective velocity scale w* (m/s). */
  wStar: number;
  /** Expected average climb of a paraglider (m/s). */
  climb: number;
  quality: 'nul' | 'faible' | 'moyen' | 'bon' | 'fort';
  cumulus: boolean;
}

const DRY = 9.8; // °C/km
const MOIST = 6; // °C/km

/** Environment temperature at height z (m) by linear interpolation of the profile. */
export function envTemperature(profile: ProfileLevel[], z: number): number | null {
  const p = [...profile].sort((a, b) => a.heightM - b.heightM);
  if (!p.length || z < p[0].heightM - 500 || z > p[p.length - 1].heightM) return null;
  if (z <= p[0].heightM) return p[0].temperature + ((p[0].heightM - z) / 1000) * 6.5;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i];
    const b = p[i + 1];
    if (z >= a.heightM && z <= b.heightM) return a.temperature + ((z - a.heightM) / (b.heightM - a.heightM)) * (b.temperature - a.temperature);
  }
  return null;
}

export function estimateThermals(
  profile: ProfileLevel[],
  ground: { elevationM: number; temperature: number; dewpoint: number; cloudCover?: number; month0?: number },
): ThermalEstimate {
  const excess = 1.5; // °C, thermal parcel warmer than the 2 m air at the peak of the day
  const lcl = ground.elevationM + 125 * Math.max(0, ground.temperature - ground.dewpoint);
  let z = ground.elevationM;
  let tParcel = ground.temperature + excess;
  let top = ground.elevationM;
  const step = 25;
  for (; z < ground.elevationM + 6000; z += step) {
    const env = envTemperature(profile, z);
    if (env === null) break;
    if (tParcel <= env) break;
    top = z;
    tParcel -= ((z < lcl ? DRY : MOIST) * step) / 1000;
  }
  const cumulus = top > lcl + 50;
  const depth = Math.max(0, Math.min(top, cumulus ? lcl : top) - ground.elevationM);
  const envTop = envTemperature(profile, ground.elevationM + Math.max(depth, 100));
  const envBottom = envTemperature(profile, ground.elevationM);
  const lapseRate = envTop !== null && envBottom !== null && depth > 100 ? ((envBottom - envTop) / depth) * 1000 : 0;
  // Sensible heat flux: up to ~250 W/m² on a clear summer afternoon in the Alps.
  const season = ground.month0 === undefined ? 1 : Math.max(0.3, Math.sin(((ground.month0 + 0.5) / 12) * Math.PI));
  const q = 250 * season * (1 - 0.75 * ((ground.cloudCover ?? 0) / 100));
  const kinematic = q / (1.2 * 1005); // K·m/s
  const wStar = depth > 0 ? Math.cbrt((9.81 / (ground.temperature + 273.15)) * depth * kinematic) : 0;
  const climb = Math.max(0, wStar - 1.1);
  const quality = depth < 300 || climb < 0.3 ? 'nul' : climb < 1 ? 'faible' : climb < 2 ? 'moyen' : climb < 3 ? 'bon' : 'fort';
  return { cloudBaseM: cumulus ? Math.round(lcl) : null, thermalTopM: Math.round(cumulus ? lcl : top), depthM: Math.round(depth), lapseRate, wStar, climb, quality, cumulus };
}
