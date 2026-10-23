/**
 * The flying school (« mode école »): one short piece of advice at a time, the key to press
 * and a visual cue, read from the real state of the flight.
 * - On the take-off (launch.ts): check the wind on the slope, pull the A risers and run, a
 *   brake step or two as the wing comes overhead, the side that falls, run on to the lift-off,
 *   hands up; each failure explained (the wing falling back, overshooting, off to a side, a
 *   tail wind, an abort).
 * - In the air: the entry into a thermal and the side to turn to (the wing tip that lifts,
 *   the core's place), the bank (brake steps and weight shift), recentring on the best lift of
 *   the last turn, leaving the thermal, the ceiling, the next thermal within reach.
 * - Safety: too much brake (close to the stall), the relief ahead and the side to turn to, a
 *   landing field chosen and its approach (circuit in a U, final into the wind, flare at ~2 m).
 *
 * The engine fills a SchoolInput in place about ten times a second and calls update(); the
 * advice lives in one Tip object, changed in place (no allocation but the text when it
 * changes, at most once a second). A tip stays at least MIN_SHOW s unless a more urgent one
 * comes; once gone, the same tip waits its cooldown before coming back.
 */
import type { LaunchState } from './launch';

/** 0 information, 1 advice, 2 safety (shown at once, with a soft chime). */
export type TipLevel = 0 | 1 | 2;

export interface Tip {
  id: string;
  text: string;
  /** Keys to press, highlighted. */
  keys: readonly string[];
  level: TipLevel;
  /** A side to highlight (the brake to pull), or a direction to show (deg relative to the heading, + = right). */
  side: 'L' | 'R' | null;
  arrow: number | null;
}

/** What the school reads; NaN marks what is unknown or absent. */
export interface SchoolInput {
  /** Game time of the flight (s). */
  t: number;
  phase: 'launch' | 'air' | 'landing';
  launch: LaunchState | null;
  /** Site wind relative to the run (m/s): headwind (+ = from ahead), cross wind (+ = from the right). */
  headwind: number;
  crosswind: number;
  /** Seconds since the lift-off (NaN before). */
  sinceLiftoff: number;
  z: number;
  agl: number;
  vz: number;
  /** Vario filtered as shown (m/s), mean climb over the last turn (NaN when not circling). */
  vario: number;
  climbAvg: number;
  /** Bank (rad) and turn rate (rad/s, + = right). */
  bank: number;
  turnRate: number;
  airspeed: number;
  brakeL: number;
  brakeR: number;
  stall: number;
  spin: number;
  collapse: number;
  /** Vertical air at the left tip minus the right one (m/s, smoothed over ~1 s): the wing that lifts. */
  tipLift: number;
  /** Nearest thermal core at the pilot's height: distance (m), direction (deg rel.), lift (m/s). */
  coreDist: number;
  coreRel: number;
  coreW: number;
  /** Top of the day's climbs here (ceiling or cloud base, m). */
  top: number;
  /** Best lift of the last turn: distance (m) from the pilot, direction (deg rel.). */
  bestDist: number;
  bestRel: number;
  /** Next thermal within reach: distance (m), direction (deg rel.). */
  nextDist: number;
  nextRel: number;
  /** The path meets the relief within a few seconds; the lower side to turn to (-1 left, 1 right, 0 unknown). */
  reliefAhead: boolean;
  reliefSide: number;
  /** Landing field chosen: name, distance (m), direction (deg rel.), height above it (m). */
  landName: string;
  landDist: number;
  landRel: number;
  landHeight: number;
  /** Wind at the pilot: where it comes from (deg rel. to the heading), speed (m/s). */
  windRel: number;
  windSpeed: number;
}

export function newSchoolInput(): SchoolInput {
  return {
    t: 0,
    phase: 'air',
    launch: null,
    headwind: NaN,
    crosswind: 0,
    sinceLiftoff: NaN,
    z: 0,
    agl: 100,
    vz: 0,
    vario: 0,
    climbAvg: NaN,
    bank: 0,
    turnRate: 0,
    airspeed: 10,
    brakeL: 0,
    brakeR: 0,
    stall: 0,
    spin: 0,
    collapse: 0,
    tipLift: 0,
    coreDist: NaN,
    coreRel: 0,
    coreW: 0,
    top: 3000,
    bestDist: NaN,
    bestRel: 0,
    nextDist: NaN,
    nextRel: 0,
    reliefAhead: false,
    reliefSide: 0,
    landName: '',
    landDist: NaN,
    landRel: 0,
    landHeight: NaN,
    windRel: 0,
    windSpeed: 0,
  };
}

/** Minimum time a tip stays (s), unless a more urgent one comes. */
export const MIN_SHOW = 3.5;
/** On the take-off the steps follow the wing at once (an inflation takes a few seconds). */
export const MIN_SHOW_LAUNCH = 0.8;

const DEG = 180 / Math.PI;
const KEYS = {
  none: [] as readonly string[],
  z: ['Z'],
  two: ['2'],
  zero: ['0'],
  three: ['3'],
  nine: ['9'],
  x: ['X'],
  r: ['R'],
  space: ['Espace'],
  zeroZ: ['0', 'Z'],
  left: ['A'],
  right: ['E'],
  turnL: ['A', 'S'],
  turnR: ['E', 'F'],
  openL: ['Q'],
  openR: ['D'],
} as const;

const kmh = (ms: number) => Math.round(Math.abs(ms) * 3.6);
// (Formatters made once: toLocaleString builds one at each call.)
const ONE = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const INT = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const km = (m: number) => ONE.format(m / 1000);
const round50 = (m: number) => INT.format(Math.round(m / 50) * 50);
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${ONE.format(Math.abs(v))}`;
/** A direction relative to the heading in words. */
function where(rel: number): string {
  const a = Math.abs(rel);
  if (a < 25) return 'droit devant';
  if (a > 150) return 'derrière toi';
  const side = rel > 0 ? 'droite' : 'gauche';
  return a < 70 ? `devant à ${side}` : a < 115 ? `sur ta ${side}` : `derrière à ${side}`;
}
/** Where the wind comes from, in words (deg relative to the heading). */
function windWords(rel: number): string {
  const a = Math.abs(rel);
  if (a < 30) return 'de face';
  if (a > 150) return 'de dos';
  return rel > 0 ? 'de la droite' : 'de la gauche';
}

type Make = (s: SchoolInput) => string;

const M_land_run: Make = () => 'Posé ! Cours pour t’arrêter, puis affale la voile : X (ou freins à fond).';
const M_l_abort: Make = (q) => explainLaunch(q.launch?.failReason ?? 'Voile affalée.', q.headwind);
const M_l_drag: Make = () => 'La voile te traîne : affale-la tout de suite (X : les C, ou freins à fond).';
const M_l_read: Make = () => 'Regarde la manche à air : le vent arrive…';
const M_l_tail: Make = (q) => `Vent arrière (${kmh(q.headwind)} km/h) : ne décolle pas. Attends que la brise rentre de face, ou choisis un autre déco.`;
const M_l_wind: Make = (q) => {
          const head = kmh(q.headwind);
          const cross = Math.abs(q.crosswind) > 1.2 && Math.abs(q.crosswind) > 0.5 * q.headwind ? ` Vent de travers ${q.crosswind > 0 ? 'de la droite' : 'de la gauche'} : la voile partira ${q.crosswind > 0 ? 'à gauche' : 'à droite'}, prépare le frein ${q.crosswind > 0 ? 'droit' : 'gauche'}.` : '';
          const strong = q.headwind > 5.5 && q.launch?.mode === 'forward' ? ' Vent fort : face voile serait plus sûr (menu).' : '';
          return `Étape 1 — le vent : ${head < 3 ? 'presque nul' : `de face à ${head} km/h`}, la flèche bleue et la manche le montrent.${cross}${strong}`;
        };
const M_l_go: Make = (q) => (q.launch?.mode === 'reverse' ? 'Étape 2 — face à ta voile : maintiens Z pour tirer les A, elle monte.' : 'Étape 2 — maintiens Z : tu tires les A en avançant, bras en arrière, freins relâchés.');
const M_l_kill: Make = () => 'Tu affales la voile (C ou freins à fond) : décollage interrompu.';
const M_l_wall: Make = () => 'Vent fort : la voile fait un mur. Garde-la basse (2 à 3 paliers), puis Z pour la monter sous contrôle.';
const M_l_side: Make = (q) => `Étape 4 — elle tombe à ${(q.launch?.phi ?? 0) > 0 ? 'droite : frein gauche (A)' : 'gauche : frein droit (E)'}, et place-toi sous son centre.`;
const M_l_brake: Make = () => 'Trop de frein pendant la montée : la voile ne monte pas. Relâche (0) et avance.';
const M_l_rise: Make = () => 'La voile monte : garde Z, avance franchement, ne freine pas encore.';
const M_l_dab: Make = () => 'Étape 3 — elle arrive au-dessus : un ou deux paliers de frein (touche 2) pour l’arrêter.';
const M_l_turn: Make = () => 'Voile stable au-dessus : Espace pour te retourner face à la pente.';
const M_l_over: Make = () => 'Elle passe devant : freine un peu plus (2 à 3) pour la remettre au-dessus.';
const M_l_run: Make = () => 'Étape 5 — voile stable : relâche les freins (0 ou 1) et cours (Z) jusqu’à ce qu’elle t’emporte.';
const M_l_air: Make = () => 'Décollé ! Mains hautes (0), assieds-toi dans la sellette et éloigne-toi du relief.';
const M_s_brake: Make = (q) => `Trop de frein (${Math.round(Math.max(q.brakeL, q.brakeR) * 100)} %) : tu approches du décrochage. Remonte les mains (touche 3, ou Q / D).`;
const M_s_relief: Make = (q) => (q.reliefSide ? `Relief devant : vire à ${q.reliefSide > 0 ? 'droite' : 'gauche'}, c’est plus bas de ce côté.` : 'Relief devant : vire vers la vallée, loin de la pente.');
const M_a_flare: Make = () => 'Arrondi : freins à fond (9), maintenant !';
const M_a_face: Make = (q) => `Finale : tourne face au vent (il vient ${windWords(q.windRel)}), ailes à plat.`;
const M_a_final: Make = () => 'Finale face au vent : mains hautes (0) pour garder de la vitesse, l’arrondi viendra vers 2 m.';
const M_a_field: Make = () => 'Pas d’atterrissage connu à portée : choisis un pré dégagé, plat et sans lignes, et pose-toi face au vent.';
const M_a_far: Make = (q) => `L’atterro « ${q.landName} » est trop loin (finesse ${Math.round(q.landDist / Math.max(1, q.landHeight))}) : choisis un pré dégagé plus proche, face au vent.`;
const M_a_go: Make = (q) => `Atterrissage : vise « ${q.landName} », ${km(q.landDist)} km ${where(q.landRel)} (finesse ${Math.max(1, Math.round(q.landDist / Math.max(1, q.landHeight)))}). Arrive avec de la marge.`;
const M_a_lose: Make = (q) => `Au-dessus de l’atterro avec ${round50(q.landHeight)} m : perds l’altitude en huit à côté du terrain, sous le vent, pas au-dessus.`;
const M_a_down: Make = () => 'Prise de terrain en U : longe le terrain vent dans le dos (vent arrière), à 100–150 m, le terrain sur le côté.';
const M_a_base: Make = () => 'Étape de base : vire de 90°, en travers du vent, puis encore 90° pour la finale face au vent.';
const M_t_top: Make = (q) => `Plafond (≈ ${round50(q.top)} m) : quitte le thermique mains hautes${Number.isFinite(q.nextDist) ? ` et file vers le suivant, ${km(q.nextDist)} km ${where(q.nextRel)}` : ''}.`;
const M_th_in: Make = (q) => {
          const lifts = Math.abs(q.tipLift) > 0.15;
          const left = lifts ? q.tipLift > 0 : q.coreRel < 0;
          return `Ça monte ! ${lifts ? `L’aile ${left ? 'gauche' : 'droite'} se soulève` : `Le cœur est ${where(q.coreRel)}`} : tourne à ${left ? 'gauche' : 'droite'} (${left ? 'A et S' : 'E et F'}).`;
        };
const M_th_in2: Make = () => 'Ça monte ! Compte deux secondes puis tourne du côté qui monte le plus.';
const M_t_out: Make = (q) => (Number.isFinite(q.bestDist) ? `Tu sors du thermique : le meilleur était ${where(q.bestRel)}, recentre-toi ou va chercher le suivant.` : 'Tu sors du thermique : élargis un tour pour le retrouver, ou va chercher le suivant.');
const M_t_steep: Make = (q) => `Trop incliné (${Math.round(Math.abs(q.bank) * DEG)}°) : relâche un peu le frein intérieur (${q.turnRate > 0 ? 'D' : 'Q'}), tu perds de la hauteur.`;
const M_t_tight: Make = (q) => `Serre ton virage : 4 à 5 paliers de frein intérieur (${q.turnRate > 0 ? 'E' : 'A'}) et la sellette dedans (${q.turnRate > 0 ? 'F' : 'S'}), vers 30–40° d’inclinaison.`;
const M_t_shift: Make = (q) => (Math.abs(q.bestRel) < 30 ? `Maintenant : ouvre le virage 2–3 s (relâche ${q.turnRate > 0 ? 'D' : 'Q'}) vers le meilleur, puis resserre.` : `Décale ton cercle vers le meilleur (${where(q.bestRel)}) : quand tu y fais face, ouvre 2–3 s puis resserre.`);
const M_t_good: Make = (q) => `Bien centré : ${signed(q.climbAvg)} m/s de moyenne sur le tour, garde ce cercle.`;
const M_t_next: Make = (q) => `Thermique probable à ${km(q.nextDist)} km, ${where(q.nextRel)} : vise le relief au soleil, sous les cumulus.`;

/**
 * Why a take-off failed and what to do instead, from launch.ts's reason (and the wind then).
 * Returns the reason followed by the school's explanation.
 */
export function explainLaunch(reason: string, headwind: number): string {
  let why: string;
  if (/dépassé/.test(reason)) why = 'La voile a pris de la vitesse en montant et a continué devant toi. Dès qu’elle passe la verticale (vers 60–70°), freine d’un ou deux paliers (touche 2), puis relâche quand elle s’arrête au-dessus de ta tête.';
  else if (/retombée/.test(reason)) why = 'Elle est retombée faute d’air : avance plus franchement en gardant Z, sans frein pendant la montée, et continue de courir quand elle arrive au-dessus.';
  else if (/côté/.test(reason)) why = 'Une moitié de l’aile s’est chargée plus que l’autre. Freine du côté opposé à celui où elle part (elle part à droite : frein gauche, A) et déplace-toi sous son centre avant de courir.';
  else if (/Traîné/.test(reason)) why = 'En vent fort la voile tire plus que tes pieds ne tiennent : garde-la basse aux freins (en mur, face voile) et affale-la tout de suite (X) si elle t’emmène.';
  else if (/Arraché/.test(reason)) why = 'Face voile en vent fort, une aile au-dessus de la tête soulève le pilote : retourne-toi (Espace) dès qu’elle est stable, ou monte-la moins vite depuis le mur.';
  else if (/Bout du déco/.test(reason)) why = 'Tu as couru sans que la voile soit stable au-dessus de toi : arrête-la d’un palier de frein, place-toi sous elle, puis seulement engage la course.';
  else if (/interrompu/.test(reason)) why = 'Bon réflexe : affaler (X ou freins à fond) quand le gonflage n’est pas propre. R pour la replacer.';
  else why = 'Reprends calmement : vent de face, gonflage franc, un palier de frein au-dessus, course jusqu’au décollage.';
  if (Number.isFinite(headwind) && headwind < -0.5) why += ` Le vent venait de l’arrière (${kmh(headwind)} km/h) : la voile ne peut pas monter proprement ; attends une brise de face ou change de déco.`;
  return `${reason} ${why}`;
}

export class School {
  /** The tip shown (changed in place); `active` false when there is none. */
  readonly tip: Tip = { id: '', text: '', keys: KEYS.none, level: 0, side: null, arrow: null };
  active = false;
  private shownAt = -1e9;
  private textAt = -1e9;
  private make: Make | null = null;
  private gone = new Map<string, number>();
  private chime = false;
  // The candidate the rules fill.
  private cId = '';
  private cLevel: TipLevel = 0;
  private cKeys: readonly string[] = KEYS.none;
  private cSide: 'L' | 'R' | null = null;
  private cArrow: number | null = null;
  private cMake: Make | null = null;
  private cCool = 12;
  private cUrgent = false;
  private cooldownOf = new Map<string, number>();
  // Memory of the flight.
  private circlingT = 0;
  private lastT = NaN;
  private climbedT = -1e9;
  private bestClimb = 0;
  private sinkT = 0;
  private cruiseT = 0;
  private approach = false;
  private windChecked = -1;

  /** True once after a tip that deserves the chime appeared. */
  takeChime(): boolean {
    const c = this.chime;
    this.chime = false;
    return c;
  }

  /** The tip with this id may appear (not cooling down after its last showing). */
  private ready(id: string): boolean {
    if (this.active && this.tip.id === id) return true;
    const g = this.gone.get(id);
    return g === undefined || this.lastT - g >= (this.cooldownOf.get(id) ?? 0);
  }

  /** Fills the candidate (false when it is cooling down). `urgent`: it replaces a tip of its level after 1 s (the lift does not wait). */
  private set(id: string, level: TipLevel, keys: readonly string[], make: Make, cool = 12, side: 'L' | 'R' | null = null, arrow: number | null = null, urgent = false): boolean {
    if (!this.ready(id)) return false;
    this.cUrgent = urgent;
    this.cId = id;
    this.cLevel = level;
    this.cKeys = keys;
    this.cMake = make;
    this.cCool = cool;
    this.cSide = side;
    this.cArrow = arrow;
    return true;
  }

  /** Reads the flight (about 10 times a second); returns the tip shown, or null. */
  update(s: SchoolInput): Tip | null {
    const dt = Number.isFinite(this.lastT) ? Math.max(0, Math.min(1, s.t - this.lastT)) : 0;
    this.lastT = s.t;
    this.remember(s, dt);
    const has = this.pick(s);
    const tip = this.tip;
    if (has) {
      if (this.active && tip.id === this.cId) {
        tip.side = this.cSide;
        tip.arrow = this.cArrow;
        tip.keys = this.cKeys;
        if (this.make !== this.cMake || s.t - this.textAt >= 1) {
          this.make = this.cMake;
          tip.text = this.cMake!(s);
          this.textAt = s.t;
        }
      } else if (!this.active || this.cLevel > tip.level || s.t - this.shownAt >= (s.phase === 'launch' ? MIN_SHOW_LAUNCH : this.cUrgent && this.cLevel === tip.level ? 1 : MIN_SHOW)) {
        if (this.active) this.gone.set(tip.id, s.t);
        this.cooldownOf.set(this.cId, this.cCool);
        tip.id = this.cId;
        tip.level = this.cLevel;
        tip.keys = this.cKeys;
        tip.side = this.cSide;
        tip.arrow = this.cArrow;
        this.make = this.cMake;
        tip.text = this.cMake!(s);
        this.textAt = s.t;
        this.shownAt = s.t;
        if (this.cLevel === 2 || (this.cLevel === 1 && this.cId.startsWith('th-'))) this.chime = true;
        this.active = true;
      }
    } else if (this.active && s.t - this.shownAt >= (s.phase === 'launch' ? MIN_SHOW_LAUNCH : MIN_SHOW)) {
      this.gone.set(tip.id, s.t);
      this.active = false;
    }
    return this.active ? tip : null;
  }

  /** Forget the flight (restart). */
  reset(): void {
    this.active = false;
    this.gone.clear();
    this.cooldownOf.clear();
    this.lastT = NaN;
    this.circlingT = 0;
    this.climbedT = -1e9;
    this.bestClimb = 0;
    this.sinkT = 0;
    this.cruiseT = 0;
    this.approach = false;
    this.windChecked = -1;
  }

  private remember(s: SchoolInput, dt: number): void {
    if (s.phase !== 'air') {
      this.circlingT = 0;
      this.cruiseT = 0;
      this.sinkT = 0;
      if (s.phase === 'launch') this.approach = false;
      return;
    }
    const turning = Math.abs(s.turnRate) > 0.12 && Math.abs(s.bank) > 0.17;
    this.circlingT = turning ? this.circlingT + dt : Math.max(0, this.circlingT - 2 * dt);
    this.cruiseT = turning ? 0 : this.cruiseT + dt;
    if (Number.isFinite(s.climbAvg) && s.climbAvg > 0.4) {
      this.climbedT = s.t;
      this.bestClimb = Math.max(this.bestClimb * 0.999, s.climbAvg);
    }
    this.sinkT = s.vario < -0.7 ? this.sinkT + dt : 0;
    // The approach: low, not climbing, a field chosen; it holds until a real climb.
    // The approach: the glide to the chosen field getting short (finesse 6 with 250 m to spare),
    // or low over it; with no field known, low and sinking a while after the take-off.
    const known = Number.isFinite(s.landDist);
    const low = (known ? s.landHeight < s.landDist / 6 + 250 || (s.landHeight < 400 && s.landDist < 1500) : s.agl < 150 && !(s.sinceLiftoff < 60) && this.sinkT > 5) || (s.agl < 60 && s.vario < 0 && !(s.sinceLiftoff < 20));
    if (low && !(s.vario > 0.6 && s.agl > 120)) this.approach = true;
    else if ((known ? s.landHeight > s.landDist / 6 + 450 : s.agl > 400) || (Number.isFinite(s.climbAvg) && s.climbAvg > 0.6)) this.approach = false;
  }

  /** The most important tip that applies now (into the candidate fields). */
  private pick(s: SchoolInput): boolean {
    if (s.phase === 'launch') return this.launchTips(s);
    if (s.phase === 'landing') return this.set('land-run', 1, KEYS.x, M_land_run, 30);
    return this.safety(s) || this.afterLiftoff(s) || this.landingTips(s) || this.thermalTips(s);
  }

  // --- Take-off.

  private launchTips(s: SchoolInput): boolean {
    const L = s.launch;
    if (!L) return false;
    // Both hands (one brake deep alone is the side correction).
    const b = (s.brakeL + s.brakeR) / 2;
    if (L.phase === 'aborted') return this.set('l-abort', 1, KEYS.r, M_l_abort, 0);
    if (L.drag > 0.3) return this.set('l-drag', 2, KEYS.x, M_l_drag, 0);
    if (L.phase === 'ready') {
      if (!Number.isFinite(s.headwind)) return this.set('l-read', 0, KEYS.none, M_l_read, 0);
      if (this.windChecked < 0) this.windChecked = s.t;
      if (s.headwind < -0.5) return this.set('l-tail', 2, KEYS.none, M_l_tail, 0);
      if (s.t - this.windChecked < MIN_SHOW)
        return this.set('l-wind', 1, KEYS.none, M_l_wind, 0);
      return this.set('l-go', 1, KEYS.z, M_l_go, 0);
    }
    if (L.killing) return this.set('l-kill', 0, KEYS.x, M_l_kill, 0);
    if (L.wall) return this.set('l-wall', 1, KEYS.z, M_l_wall, 0);
    if (Math.abs(L.phi) > 0.2) {
      const right = L.phi > 0;
      return this.set('l-side', 1, right ? KEYS.left : KEYS.right, M_l_side, 0, right ? 'L' : 'R');
    }
    if (L.theta < 1.0 && b > 0.3) return this.set('l-brake', 1, KEYS.zero, M_l_brake, 0);
    if (L.theta < 0.9) return this.set('l-rise', 0, KEYS.z, M_l_rise, 0);
    if (L.theta < 1.75 && L.thetaRate > 0.2 && b < 0.15) return this.set('l-dab', 1, KEYS.two, M_l_dab, 0);
    if (L.facingWing) return this.set('l-turn', 1, KEYS.space, M_l_turn, 0);
    if (L.stable < 0.5 && L.theta > 1.75) return this.set('l-over', 1, KEYS.two, M_l_over, 0);
    return this.set('l-run', 1, KEYS.zeroZ, M_l_run, 0);
  }

  private afterLiftoff(s: SchoolInput): boolean {
    if (!(s.sinceLiftoff < 6)) return false;
    return this.set('l-air', 1, KEYS.zero, M_l_air, 60);
  }

  // --- Safety.

  private safety(s: SchoolInput): boolean {
    const deep = Math.max(s.brakeL, s.brakeR);
    if (deep >= 0.7 && s.agl > 15 && s.stall < 0.1 && s.spin < 0.1)
      return this.set('s-brake', 2, KEYS.three, M_s_brake, 6);
    if (s.reliefAhead) {
      const side = s.reliefSide > 0 ? 'R' : s.reliefSide < 0 ? 'L' : null;
      return this.set('s-relief', 2, side === 'R' ? KEYS.turnR : side === 'L' ? KEYS.turnL : KEYS.none, M_s_relief, 4, side);
    }
    return false;
  }

  // --- Landing.

  private landingTips(s: SchoolInput): boolean {
    if (!this.approach) return false;
    const known = Number.isFinite(s.landDist);
    // The flare: feet about 2 m above the ground (the carabiners ~1 m higher), anticipating the reaction.
    if (s.agl + Math.min(0, s.vz) * 0.4 < 3.6 && s.agl > 1) return this.set('a-flare', 2, KEYS.nine, M_a_flare, 5);
    if (s.agl < 45 && s.agl > 4) {
      if (s.windSpeed > 1.5 && Math.abs(s.windRel) > 35) return this.set('a-face', 2, s.windRel > 0 ? KEYS.turnR : KEYS.turnL, M_a_face, 4, null, s.windRel);
      return this.set('a-final', 1, KEYS.zero, M_a_final, 20, null, s.windRel);
    }
    if (!known) return this.set('a-field', 1, KEYS.none, M_a_field, 40);
    const glide = s.landDist / Math.max(1, s.landHeight);
    if (s.landDist > 700) {
      if (glide > 7) return this.set('a-far', 2, KEYS.none, M_a_far, 20, null, s.landRel);
      return this.set('a-go', 1, KEYS.none, M_a_go, 25, null, s.landRel);
    }
    if (s.landHeight > 180) return this.set('a-lose', 1, KEYS.none, M_a_lose, 25, null, s.landRel);
    if (s.landHeight > 90) return this.set('a-down', 1, KEYS.none, M_a_down, 25, null, s.landRel);
    return this.set('a-base', 1, KEYS.none, M_a_base, 25, null, s.windRel);
  }

  // --- Thermals.

  private thermalTips(s: SchoolInput): boolean {
    const circling = this.circlingT > 3;
    const avg = s.climbAvg;
    const right = s.turnRate > 0;
    if (s.z > s.top - 150 && (circling || s.vario > 0.3))
      return this.set('t-top', 1, KEYS.zero, M_t_top, 90, null, Number.isFinite(s.nextDist) ? s.nextRel : null);
    // Entering lift while gliding: turn towards the wing that lifts (or the core).
    if (!circling && s.vario > 0.7 && s.agl > 60) {
      let side: 'L' | 'R' | null = null;
      if (Math.abs(s.tipLift) > 0.15) side = s.tipLift > 0 ? 'L' : 'R';
      else if (s.coreDist < 220 && Math.abs(s.coreRel) > 15) side = s.coreRel > 0 ? 'R' : 'L';
      if (side)
        return this.set('th-in', 1, side === 'L' ? KEYS.turnL : KEYS.turnR, M_th_in, 15, side, Number.isFinite(s.coreDist) ? s.coreRel : null, true);
      return this.set('th-in', 1, KEYS.none, M_th_in2, 15, null, null, true);
    }
    if (circling) {
      const bank = Math.abs(s.bank) * DEG;
      // Leaving the thermal: sinking for a while after climbing.
      if (this.sinkT > 4 && s.t - this.climbedT < 40)
        return this.set('t-out', 1, KEYS.none, M_t_out, 20, null, Number.isFinite(s.bestDist) ? s.bestRel : null);
      if (bank > 55) return this.set('t-steep', 1, right ? KEYS.openR : KEYS.openL, M_t_steep, 10, right ? 'R' : 'L');
      if (bank < 18 && s.vario > -0.3) return this.set('t-tight', 1, right ? KEYS.turnR : KEYS.turnL, M_t_tight, 12, right ? 'R' : 'L');
      if (Number.isFinite(avg) && Number.isFinite(s.bestDist) && s.bestDist > 35 && s.vario < Math.max(0.5, avg + 0.3))
        return this.set('t-shift', 1, Math.abs(s.bestRel) < 30 ? (right ? KEYS.openR : KEYS.openL) : KEYS.none, M_t_shift, 15, null, s.bestRel);
      if (Number.isFinite(avg) && avg > 1) return this.set('t-good', 0, KEYS.none, M_t_good, 45);
      return false;
    }
    // Gliding without lift: the next thermal within reach.
    if (this.cruiseT > 6 && s.vario < 0.3 && s.agl > 200 && Number.isFinite(s.nextDist))
      return this.set('t-next', 0, KEYS.none, M_t_next, 25, null, s.nextRel);
    return false;
  }
}
