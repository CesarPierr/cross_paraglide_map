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
  /** e-folding thickness of the slope-breeze layer, m (20–200 m: Zardi & Whiteman 2013, S3; rule `epaisseur-couches`). */
  slopeBreezeDepth: 140,
  /** Night katabatic speed, m/s. */
  katabaticMax: 1.6,
  /** Max up-valley speed in the largest valleys at the afternoon peak, m/s (≈ 25 km/h). */
  valleyBreezeMax: 7,
  /** Night down-valley speed relative to the day maximum. */
  valleyNightRatio: 0.4,
  /**
   * Vertical profile of the along-valley wind, as fractions ζ of the valley depth
   * (height above the valley floor / (crest envelope − floor), see `valleyProfile`).
   * - Full speed from the floor up to `valleyProfile[0]` = 0.3 D: the jet sits a few
   *   hundred metres above the floor (Zardi & Whiteman 2013, S3 of
   *   synoptic_convergences_xc.json; S1: core of the valley breeze 200–500 m thick,
   *   i.e. ≈ 0.3 of the ~1.8 km deep Grésivaudan).
   * - Decreasing to 0 at `valleyProfile[1]` = 1.0 D, the crest height: the up-valley
   *   wind fills the valley up to about ridge-top height (Zardi & Whiteman 2013). The
   *   speed is halved at ≈ 0.65 D, the middle of the 50–80 % "plafond" hypothesis of
   *   the model rule `epaisseur-couches`.
   */
  valleyProfile: [0.3, 1.0] as [number, number],
  /**
   * Weak return flow (antiwind) above the valley wind, as a fraction of its peak
   * speed. Zardi & Whiteman 2013 describe it as much weaker than the valley wind and
   * often masked by the synoptic flow: 0.15 is an assumption (order of magnitude).
   */
  valleyAntiwind: 0.15,
  /** ζ where the antiwind ramps in (from, full) and fades out (from, gone): above the crest, below ≈ 1.7 D. */
  valleyAntiwindZone: [0.9, 1.2, 1.3, 1.7] as [number, number, number, number],
  /**
   * Height above ground (m) over which a documented (curated) slope breeze keeps
   * its full weight, then fades out: pilots report slope breezes 100–200 m thick
   * (S1, model rule `cycle-brise-pente`: "parapente 100–200 m"). Full up to 100 m,
   * half at 200 m, gone at 300 m; above, the generic valley/regional flow takes over.
   */
  curatedSlopeLayer: [100, 300] as [number, number],
  /**
   * e-folding height (m above ground) of documented plain → mountain and regional
   * breezes: the inflow towards the Alps fills the lowest ~1 000 m and more in the
   * afternoon (Weissmann et al. 2005, S4; rule `aspiration-plaine-montagne`).
   */
  curatedDeepDepth: 1200,
  /**
   * Corridor weight × activity of a documented valley/plain breeze above which the
   * generic valley wind takes the documented direction (sense along the axis). Below,
   * a linear transition (assumption: the outer part of the corridor, d ≳ 0.8 R).
   */
  curatedAlignWeight: 0.4,
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
