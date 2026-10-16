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
  /**
   * Glacier wind: over a melting glacier the air cooled by the ice flows down the slope day
   * and night (Oerlemans & Grisogono 2002: 2–6 m/s, a jet a few metres above the ice, a
   * layer of a few tens of metres, persistent on summer afternoons). Where the snow-and-ice
   * share of a cell goes from `share[0]` to `share[1]`, the slope breeze turns into this
   * downslope flow of `speed` (m/s), with an e-folding thickness of `depth` (m). It gathers
   * speed over the length of the ice, so it is full from ≈ 10° of slope (a slope breeze
   * needs ≈ 27°).
   */
  glacierWind: { speed: 3, depth: 60, share: [0.2, 0.6] as [number, number] },
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
   * Same for documented katabatic flows: full up to 50 m, gone at 150 m. Downslope
   * flows are 3–100 m thick with their maximum within 1–15 m of the ground (S3,
   * rule `cycle-brise-pente`); the Taillefer–Charbon flow under the Annecy lake
   * breeze is described as 50–100 m thick.
   */
  curatedKatabaticLayer: [50, 150] as [number, number],
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
  /**
   * Conditional breezes "par vent de X": full when the simulated synoptic wind is
   * within ±45° of X (the sector named by the source, one octant each side), gone
   * beyond ±70° (assumption). Speed: from 60 % to 100 % of the condition's minimum,
   * itself 10 km/h by default (below, régime de brise pur: rule `seuils-synoptique-vs-brise`, S8).
   */
  conditionSector: [45, 70] as [number, number],
  /**
   * Months (0 = January) where "en hiver / sous inversion" breezes are simulated:
   * November to February, the season of persistent inversions in the Grenoble
   * valleys (Largeron & Staquet 2016, S37 of the research notes).
   */
  winterMonths: [10, 11, 0, 1],
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
  /**
   * Share of the height above ground at which the shelter angle is taken: the lee and
   * its rotor hug the slope behind a crest. Check: `npx tsx scripts/dev/lee-bench.ts`
   * (documented lee hazards at their place; take-offs facing the wind; Montlambert by
   * strong north stays out of the lee, as flown).
   */
  leeHeightShare: 0.25,
  /**
   * Narrowing of the valleys (terrain.ts → valleyFunnel): speed-up of the valley wind
   * (width elsewhere / width here)^exponent, at most `max`. Mass conservation would give
   * an exponent of 1 for a constant depth; the flow also thickens in a verrou, hence less.
   * Check: `npm run model:check` (strong breezes reported at verrous and goulets; documented
   * breeze speeds kept within their range).
   */
  funnelExponent: 0.7,
  funnelMax: 1.5,
  /** Upwind search distance for shelter (cells ≈ 216 m). */
  shelterSteps: [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 17, 20, 24],
  /** Venturi speed-up at full confinement. */
  venturiGain: 0.45,
  /** Effective depth used to convert horizontal convergence into vertical speed, m. */
  convergenceDepth: 700,
  /** Solar-time schedule of the valley-breeze cycle (hours): [reversal AM, full, decline, reversal PM]. */
  valleySchedule: [9.5, 13, 16.5, 19.5] as [number, number, number, number],
  /**
   * Thermal onset of a slope, in hours of full sun received since sunrise
   * (`TimeContext.sunHours`: integral of cos(incidence) × low-sun attenuation): none
   * below E0, fully developed at E1. Faces light up in turn (east in the morning,
   * west in the afternoon, flat floors in between).
   * - E0 = 1 h: a 30° east face receives 1 h of full-sun equivalent about 2 h after
   *   sunrise, the end of the calm phase of the Saint-Hilaire sheet ("du lever du
   *   soleil à 2 h après : calme ; … dès 3 h d'ensoleillement : thermiques").
   * - E1 = 3 h: the same face is fully developed 4.5 h after sunrise, the middle of
   *   the 3.5–5 h after sunrise it takes the sun to break the nocturnal inversion of
   *   an Alpine valley (Whiteman 2000, Mountain Meteorology, ch. on valley inversion
   *   breakup; order of magnitude).
   * Check: `npm run model:check`, explicit documented onsets.
   */
  thermalSunHours: [1, 3] as [number, number],
  /**
   * Morning cold pool of the valleys (`coldPoolBurial`). The night's cold air fills the
   * bottom of each valley; the sun must break this inversion before thermals rise out
   * of it, 3.5–5 h after sunrise (Whiteman 2000, Mountain Meteorology, valley inversion
   * breakup), while the slopes above it only have a thin surface inversion to warm
   * (the Saint-Hilaire calibration of `thermalSunHours`, a cliff ≈ 500 m above the floor).
   * - Depth: `coldPoolShare` of the valley depth (crest envelope − floor), within
   *   `coldPoolDepth` (m), after a 9 h summer night; a longer night deepens it
   *   (× night / 9 h, at most × 1.5, `nightFactor`). Summer nocturnal inversions of
   *   Alpine valleys are a few hundred metres deep (order of magnitude).
   * - A synoptic wind mixes it away: full below `coldPoolWindKmh[0]`, gone above
   *   `coldPoolWindKmh[1]` (assumption: a wind that reaches the floor).
   * - A cell is fully in the pool up to half its depth, out of it above its top; in
   *   the pool it needs `coldPoolSunHours` instead of `thermalSunHours`: a flat floor
   *   then shows its first thermal column ≈ 5–6 h after sunrise in July (Montlambert,
   *   Combe de Savoie: « dès le début d'après-midi »).
   * Check: `npm run model:check`, explicit documented onsets.
   */
  coldPoolShare: 0.35,
  coldPoolDepth: [100, 500] as [number, number],
  coldPoolWindKmh: [10, 30] as [number, number],
  coldPoolSunHours: [2, 4] as [number, number],
  /**
   * Heat stored by the ground and the vegetation (thermal inertia). The thermal drive
   * is max(direct sun, `share` × recent sunshine), the recent sunshine being the mean
   * insolation, with cast shadows, of the last `window` hours weighted by
   * exp(−age / `tau`) (`TimeContext.sunRecent`). Thermals outlast the sun by about an
   * hour on a face that goes into the shade, and a gentle lift remains over the faces
   * sunlit in the evening: the « restitution du soir » of 82 atlas features (Saint-Gervais
   * « quand le versant Bettex et le village passent à l'ombre », Aiguebelette « vers
   * 18h-19h jusqu'à la tombée de la nuit »). Values are assumptions of the right order
   * (surface heat flux lagging the radiation by ≈ 1 h).
   * Cast shadows are marched only for the samples of a sun lower than `shadowBelowDeg`:
   * above, they change the recent sunshine by less than 0.002 on average over the grid
   * (a few deep gorges excepted), and skipping them keeps the insolation pass light while
   * the time bar plays.
   */
  thermalMemory: { tau: 1, window: 2, share: 0.5, shadowBelowDeg: 25 },
  /**
   * Seasonal intensity of the thermals (`thermalSeasonFactor`), apart from the breezes'
   * `season`. The incidence of the low sun on each slope is already in the insolation;
   * what the season adds is (1) the longer path of the noon sun through the atmosphere,
   * a direct-beam transmittance `transmittance` per air mass (clear sky, 0.7–0.8) relative
   * to the midsummer noon sun (`refNoonDeg`), and (2) a lower efficiency of cold ground
   * under more frequent inversions, down to `winterEfficiency` when the noon sun is
   * lowest (assumption, order of magnitude). A steep south face keeps ≈ 0.7 of its summer
   * drive in February and October, as the documented winter thermals of the Riviera
   * (Gourdon, Courmettes, Mont Gros) and the October ones of the Tournette and Aussois
   * require; the breezes' factor would leave them ≈ 0.3, below any thermal column.
   * Check: `npm run model:check` (thermals tested in the season of their sheet).
   */
  thermalSeason: { transmittance: 0.75, refNoonDeg: 66, winterEfficiency: 0.75 },
  /**
   * Thermals in the lee of a relief are torn apart by the rotor and the sinking air:
   * the thermal potential loses up to `leeThermalCut` of its value where the lee is full,
   * as the synoptic wind rises from `leeThermalWindKmh[0]` to `[1]` (the game's air mass
   * does the same, `torn`). Pilots describe these thermals as broken and unusable rather
   * than absent (assumption on the share).
   */
  /**
   * Heating of the air by the ground, by land cover (ESA WorldCover 2021, `surfaceFactor`),
   * relative to grass. The sensible heat flux depends on the albedo, the moisture (Bowen
   * ratio) and the heat capacity of the surface: bare rock, scree, dry ground (Bowen ratio
   * 2–5) and built-up areas (impervious, dark) heat the air more than grass (≈ 0.5–1);
   * forests absorb a lot but transpire and store the heat (≈ 0.3–1), so their thermals are
   * weaker by day and they give it back in the evening; snow and ice reflect most of the
   * sun and stay at 0 °C: no thermals over glaciers. Orders of magnitude (assumptions),
   * consistent with what pilots say (rocks, scree, villages and fields trigger, forests and
   * snow do not). `mean`: the mean of the weighted shares over the land of the whole grid,
   * so that the factor averages 1 and the thermal calibration stays.
   */
  surfaceHeating: { trees: 0.8, bare: 1.25, snow: 0.1, built: 1.25, rest: 1, mean: 0.909 },
  leeThermalCut: 0.6,
  /**
   * Stability of the air between 850 and 700 hPa (≈ 1 500 → 3 000 m), from the forecast
   * (`ModelParams.lapseRate`, K/km); `lapseStandard` (standard atmosphere) when the wind is
   * set by hand. Pilots' rule of thumb: below ≈ 5 K/km the air is stable (weak, low
   * thermals, breezes left alone under a wind aloft), above ≈ 7 it is unstable (strong
   * thermals, the wind aloft mixes down into the valleys).
   * - Thermals × (1 + `lapseThermal` × (Γ − standard)), within `lapseThermalRange`.
   * - The synoptic wind takes over the breezes from `synopticOverrideKmh` ×
   *   (1 − `lapseOverride` × (Γ − standard)), within `lapseOverrideRange`.
   * The slopes are assumptions of the right order, for the forecast mode only.
   */
  /**
   * A face turned to the synoptic wind is not sheltered like a valley floor: the air is
   * forced up it. The height-in-the-valley reduction of the synoptic wind fades out as the
   * slope the wind climbs (m/m) goes from `windwardExposure[0]` to `[1]` (≈ 3° to 17°),
   * unless the face is in the lee of another relief. Check: soaring spots of the atlas
   * under their documented wind (`model:check`, soaring).
   */
  windwardExposure: [0.05, 0.3] as [number, number],
  /**
   * Dynamic lift by scales: the vertical speed U·∇z forced by the slope (gradient smoothed
   * over ≈ 0.2 km), the ridge (`ridgeBlur` cells, ≈ 0.5 km) and the massif (`massBlur`,
   * ≈ 1.2 km), each part fading with the height above ground over `heights` (m): in
   * potential flow the perturbation of a relief of half-width a fades over ≈ a. The parts
   * are differences of scales (slope − ridge, ridge − massif, massif), so a uniform slope
   * counts once. Check: soaring spots of the atlas under their documented wind.
   */
  dynamicLiftScales: { ridgeBlur: 3.5, massBlur: 8, heights: [350, 700, 1500] as [number, number, number] },
  lapseStandard: 6.5,
  lapseThermal: 0.18,
  lapseThermalRange: [0.4, 1.3] as [number, number],
  lapseOverride: 0.1,
  lapseOverrideRange: [0.7, 1.4] as [number, number],
  leeThermalWindKmh: [10, 30] as [number, number],
  /**
   * Afternoon land–water temperature contrast by month (January first), relative to July,
   * which drives the lake and sea breezes on top of the sunshine (`season`): the water
   * lags the land by one to two months, so the breeze is strongest in spring and early
   * summer, while the lake is still cold, and fades in autumn, when it is warm (orders of
   * magnitude from the surface temperatures of the Savoy lakes, ≈ 10 °C in April, 23 °C in
   * August). Mirrored in apps/web/src/gpu (engine.ts → timeState).
   */
  waterContrast: [0.3, 0.6, 1.2, 1.3, 1.3, 1.2, 1.0, 0.9, 0.6, 0.45, 0.25, 0.2],
  /** Lake/sea breeze schedule (solar hours). */
  waterSchedule: [9, 11.5, 17, 19.5] as [number, number, number, number],
};
