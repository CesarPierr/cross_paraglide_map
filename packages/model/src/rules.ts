/**
 * Tunable constants of the conceptual wind model.
 *
 * Orders of magnitude follow classic mountain-meteorology references
 * (Whiteman 2000 "Mountain Meteorology"; Zardi & Whiteman 2013 "Diurnal
 * mountain wind systems") and French free-flight teaching material; see
 * docs/METHODOLOGIE.md for the derivation and sources.
 */
export const RULES = {
  /** Max anabatic (upslope) speed on a fully sunlit steep slope, m/s. Typical 1–4 m/s. */
  slopeBreezeMax: 3.0,
  /** e-folding thickness of the slope-breeze layer, m (tens to ~150 m). */
  slopeBreezeDepth: 140,
  /** Night katabatic speed, m/s. */
  katabaticMax: 1.6,
  /** Max up-valley speed in the largest valleys at the afternoon peak, m/s (≈ 25 km/h). */
  valleyBreezeMax: 7,
  /** Night down-valley speed relative to the day maximum. */
  valleyNightRatio: 0.4,
  /** Plain → mountain inflow at the foreland, m/s. */
  plainBreezeMax: 2.5,
  /** Lake breeze near shore, m/s. */
  lakeBreezeMax: 3,
  /** Sea breeze near the coast, m/s. */
  seaBreezeMax: 5,
  /** Synoptic speed (km/h) above which thermal breezes are mostly overridden. */
  synopticOverrideKmh: 35,
  /** Shelter angle range (deg) mapping to lee factor 0→1 (Winstral Sx). */
  leeAngle: [8, 22] as [number, number],
  /** Upwind search distance for shelter (cells ≈ 216 m). */
  shelterSteps: [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 17, 20, 24],
  /** Venturi speed-up at full confinement. */
  venturiGain: 0.45,
  /** Effective depth used to convert horizontal convergence into vertical speed, m. */
  convergenceDepth: 700,
  /** Solar-time schedule of the valley-breeze cycle (hours): [reversal AM, full, decline, reversal PM]. */
  valleySchedule: [9.5, 13, 16.5, 19.5] as [number, number, number, number],
  /** Lake/sea breeze schedule (solar hours). */
  waterSchedule: [9, 11.5, 17, 19.5] as [number, number, number, number],
};
