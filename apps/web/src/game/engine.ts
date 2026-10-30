/**
 * The game loop: reads the controls, flies the glider through the air (the site's model
 * for the wind, the fine relief's lift, rotors and gaps, the air mass for the thermals,
 * sink, clouds and gusts: see pilot-air.ts), handles the take-off and the landing's
 * run-out on the ground, moves the camera and feeds the HUD.
 */
import type { Atlas, AtlasFeature } from '@brises/shared';
import { legalTimeToUtc, RULES, sunPosition, type GridMeta, type ModelParams } from '@brises/model';
import { AirMass, makeRng, PROFILE_DZ, type Scenario } from './airmass';
import { AudioVario } from './audio';
import { newGlider, setAirspeed, step, WINGS, type AirSample, type Controls, type FlightEvent, type GliderState, type WingParams } from './flight';
import { GameModel } from './game-client';
import { landingStep, launchStep, newLanding, newLaunch, runOn, touchdown, type LandingState, type LaunchMode, type LaunchState } from './launch';
import { AiPilots } from './ai-pilots';
import { PilotAir } from './pilot-air';
import { advanceTask, distanceMadeGood, taskFromRoute, taskLength, type Task } from './task';
import { Grid } from '@brises/model';
import { fetchGridPixels } from '../engine/grid-pixels';
import { gridHeights, makeChallenge, type Challenge, type ChallengeKind, type ChallengeLevel } from './challenges';
import { explainLaunch, newSchoolInput, School, type SchoolInput } from './school';
import { Multiplayer, type NetEvent } from './net';
import type { ModelAir } from './game-worker';
import { LocalFrame } from './geo';
import { FlightLog, gpuName, logClientId } from './flight-log';
import { TrackRecorder, toIgc } from './igc';
import { GameWorld, type Head, type RenderQuality, type ViewMode } from './world';

import type { Takeoff } from './takeoffs';

/** Default take-off: Saint-Hilaire-du-Touvet, déco Sud. */
export const SAINT_HILAIRE: Takeoff = { id: 'default-saint-hilaire', name: 'Saint-Hilaire-du-Touvet : déco Sud', massif: 'Chartreuse', lon: 5.8908, lat: 45.3103, alt: 939, facing: 120, orientation: 'E, SE, S, SW' };

/** Where the flight starts: in the air just off the take-off, flying out of it. */
function spawnOf(t: Takeoff) {
  const h = (t.facing * Math.PI) / 180;
  return { x: Math.sin(h) * 250, y: Math.cos(h) * 250, z: t.alt + 80, heading: h };
}

export interface Hud {
  /** The brake step just asked for with the keys, shown a moment: which side. */
  brakeFlash: 'L' | 'R' | 'both' | null;
  alt: number;
  agl: number;
  vario: number;
  /** Mean climb over the last turn when circling (m/s), null otherwise. */
  climbAvg: number | null;
  airKmh: number;
  groundKmh: number;
  heading: number;
  windFrom: number;
  windKmh: number;
  brakeL: number;
  brakeR: number;
  speedbar: number;
  clock: string;
  flightS: number;
  distKm: number;
  maxAlt: number;
  ceiling: number;
  cloudBase: number | null;
  whiteout: number;
  hazard: string | null;
  incident: string | null;
  load: number;
  paused: boolean;
  view: ViewMode;
  showThermals: boolean;
  timeScale: number;
  wing: string;
  ears: boolean;
  /** Cross-country task: next point, distance (km), its bearing relative to the heading (deg), glide needed, progress. */
  task: { name: string; next: string; index: number; count: number; distKm: number; relBearing: number; glide: number | null; doneKm: number; totalKm: number; clock: string; goal: boolean } | null;
  /** Flying with friends: room, the other pilots (distance km, height difference m), last chat lines. */
  multi: { room: string; status: string; pilots: { name: string; distKm: number; dz: number }[]; chat: { name: string; text: string; self: boolean }[] } | null;
  /** On the take-off: wing elevation and side angle (deg), airspeed (km/h), what to do. */
  launch: { phase: string; theta: number; phi: number; airKmh: number; facingWing: boolean; mode: LaunchMode; hint: string } | null;
  /** Brake pressure in each hand (kg): rises with speed and travel, drops before a fold or a stall. */
  pressureL: number;
  pressureR: number;
  /** 0..1: how close the angle of attack is to a fold (the pressure going soft): a warning for active piloting. */
  pressureWarn: number;
  /** Weight shift in the harness, -1 (left) … 1 (right). */
  weight: number;
  /** After touchdown: run-out speed (km/h) and what to do. */
  landing: { speedKmh: number; hint: string } | null;
  /** Flying school: the advice shown, its keys, urgency (0..2), the brake side or direction (deg rel.) to show. */
  school: { id: string; text: string; keys: readonly string[]; level: number; side: 'L' | 'R' | null; arrow: number | null } | null;
  /** The challenge flown: its name, the chrono (from the take-off), and for the ceiling the altitude to reach. */
  challenge: { name: string; kind: ChallengeKind; clock: string; started: boolean; done: boolean; target: number | null; issues: string[] } | null;
}

/** Result of a challenge, for the end card and the records. */
export interface ChallengeResult {
  key: string;
  name: string;
  kind: ChallengeKind;
  success: boolean;
  /** Chrono from the take-off to the goal (s), null if not reached. */
  timeS: number | null;
  /** Course length (km; the height to climb for the ceiling, in m), distance made good (km). */
  lengthKm: number;
  madeKm: number;
  /** Mean speed over the course (km/h), or mean climb to the ceiling (m/s). */
  speed: number | null;
  /** Height gained to the ceiling (m). */
  gainM: number | null;
}

export interface FlightEnd {
  kind: 'landed' | 'hard' | 'crash' | 'launch';
  /** Cross-country task result. */
  task?: { name: string; goal: boolean; time: string | null; madeKm: number; totalKm: number; tagged: number; count: number };
  /** Why a take-off failed (with the school's explanation in school mode). */
  reason?: string;
  challenge?: ChallengeResult;
  vz: number;
  groundKmh: number;
  flightS: number;
  distKm: number;
  maxAlt: number;
  /** Height gained in all the climbs (m), best mean climb over a turn (m/s), when the cloud base (or the ceiling) was reached (s of flight), null if never. */
  gainM: number;
  bestClimb: number;
  ceilingS: number | null;
}

export interface NearbyInfo {
  id: string;
  lon: number;
  lat: number;
  category: string;
  name: string;
  description: string;
  distKm: number;
  bearing: number;
}

/** An angle (rad) as degrees in -180 … 180. */
const relDeg = (a: number) => (((((a * 180) / Math.PI + 540) % 360) + 360) % 360) - 180;

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min ${String(sec).padStart(2, '0')} s`;
}

/** A press of a brake key: a tenth of the travel (ten steps from hands up to full brake). */
const BRAKE_STEP = 0.1;

const EVENT_TEXT: Record<FlightEvent, string> = {
  'collapse-left': 'Fermeture à gauche ! Contre au frein droit, pompe à gauche',
  'collapse-right': 'Fermeture à droite ! Contre au frein gauche, pompe à droite',
  frontal: 'Fermeture frontale ! Mains hautes puis temporise l’abattée',
  stall: 'Décrochage ! Relâche les freins (progressivement)',
  spin: 'Départ en vrille ! Relâche le frein intérieur',
  reopened: 'Aile réouverte',
  cravat: 'Cravate ! Contre au frein opposé, tire le stabilo du côté coincé (X) ou pompe franchement',
  'cravat-cleared': 'Cravate dégagée',
};

export class GameEngine {
  readonly frame: LocalFrame;
  readonly world: GameWorld;
  readonly air: AirMass;
  private model = new GameModel();
  private audio = new AudioVario();
  glider: GliderState;
  private controls: Controls = { brakeL: 0, brakeR: 0, speedbar: 0, ears: false, weight: 0 };
  /** The air at the pilot each step (model wind, relief, air mass, turbulence), and its buffer. */
  readonly pilotAir: PilotAir;
  private airSample: AirSample = { u: 0, v: 0, w: 0, turbulence: 0, wL: 0, wR: 0, agl: 100 };
  /** Weight shift asked by touch controls (the keys S/F add to it). */
  private weightInput = 0;
  /** Weight shift from the mouse cursor's place across the view (desktop), -1 … 1. */
  private mouseWeight = 0;
  /**
   * Where the hands go: the keys move them a step at a time (BRAKE_STEP), the touch sliders
   * anywhere; the hands then travel there in a fraction of a second (readKeys).
   */
  private brakeTarget = { L: 0, R: 0 };
  private attribTimer: ReturnType<typeof setTimeout> | undefined;
  /** Game times of the last relief refresh, shade update and wind-profile request. */
  private reliefT = -1e9;
  private reliefAt = { x: 1e12, y: 1e12 };
  private shadeT = 0;
  private profiling = false;
  /** Landing run-out on the ground, until the pilot stops. */
  private landing: LandingState | null = null;
  private touchKill = false;
  /** Vario as an instrument shows it: filtered over ~0.6 s. */
  private varioF = 0;
  /** The last minute of flight for the centring aid: position, vario and heading every 0.25 s of game time. */
  private trailBuf: { x: number; y: number; v: number; h: number }[] = [];
  private trailT = 0;
  /** The head looks a little down by default, as a pilot does. */
  head: Head = { yaw: 0, pitch: -0.12 };
  private keys = new Set<string>();
  private modelAir: ModelAir | null = null;
  private sampling = false;
  private hour: number;
  private gameT = 0;
  private flightS = 0;
  private start: { x: number; y: number };
  private spawn: { x: number; y: number; z: number; heading: number };
  /** Where the socks were placed (they are re-placed when the pilot goes far). */
  private socksAt = { x: 0, y: 0 };
  private maxAlt = 0;
  private incident: { text: string; until: number } | null = null;
  private whiteout = 0;
  private raf = 0;
  private last = 0;
  private timers = { sample: 0, viz: 0, hud: 0, sun: 0 };
  private ended = false;
  paused = false;
  /** Frames rendered a second at most (0: every display frame): a 120 Hz display need not double the work. */
  fpsCap = 60;
  showThermals: boolean;
  timeScale: number;
  private refreshing = false;
  private barByKey = false;
  readonly wing: WingParams;
  /** The flight track, one fix a second once in the air (IGC export). */
  readonly track = new TrackRecorder();
  /** All-up weight (kg). */
  readonly mass: number;
  private makeGlider(x: number, y: number, z: number, heading: number): GliderState {
    const g = newGlider(x, y, z, heading, this.wing);
    g.mass = this.mass;
    return g;
  }
  private sunInfo: { sunAzimuth: number; sunElevation: number } | null = null;
  /** On the ground at the take-off (inflation, run) until airborne; null in flight. */
  launch: LaunchState | null = null;
  readonly startMode: 'air' | LaunchMode;
  private liftoffT = -1e9;
  /** The other pilots of the day (ai-pilots.ts), when wanted. */
  private others: boolean;
  private ai: AiPilots | null = null;
  /** Game time of the last touch-and-go: the pilot runs on by himself for a moment. */
  private runOnT = -1e9;
  private touch = { go: false, turn: false };

  constructor(
    container: HTMLElement,
    readonly scenario: Scenario,
    private atlas: Atlas,
    private dem: { meta: GridMeta; url: string },
    readonly takeoff: Takeoff,
    private cb: { onHud: (h: Hud) => void; onStatus: (s: string | null) => void; onEnd: (e: FlightEnd) => void },
    opts: { view: ViewMode; showThermals: boolean; wing?: WingParams['id']; start?: 'air' | LaunchMode; mass?: number; routeId?: string | null; multi?: { room: string; name: string } | null; others?: boolean; school?: boolean; launchSlow?: number; challenge?: { kind: ChallengeKind; level: ChallengeLevel } | null; log?: boolean; quality?: RenderQuality; fpsCap?: number },
  ) {
    this.school = opts.school ? new School() : null;
    this.launchSlow = this.school ? Math.max(0.25, Math.min(1, opts.launchSlow ?? 1)) : 1;
    this.challengeOpt = opts.challenge ?? null;
    this.multi = opts.multi ?? null;
    this.others = opts.others ?? true;
    this.wing = WINGS[opts.wing ?? 'B'];
    this.mass = opts.mass ?? 95;
    this.startMode = opts.start ?? 'air';
    this.frame = new LocalFrame(takeoff.lon, takeoff.lat);
    // On the ground: standing at the take-off, carabiners ~1.1 m above the ground.
    this.spawn = this.startMode === 'air' ? spawnOf(takeoff) : { x: 0, y: 0, z: takeoff.alt + 1.1, heading: (takeoff.facing * Math.PI) / 180 };
    if (this.startMode !== 'air') this.launch = newLaunch(this.startMode);
    this.glider = this.makeGlider(this.spawn.x, this.spawn.y, this.spawn.z, this.spawn.heading);
    this.start = { x: this.spawn.x, y: this.spawn.y };
    this.world = new GameWorld(container, this.frame, this.spawn);
    this.world.setView(opts.view);
    this.fpsCap = opts.fpsCap ?? 60;
    this.world.fpsCap = this.fpsCap;
    this.world.setQuality(opts.quality ?? 'auto');
    // The model's grid also gives the landscape its distant relief and land cover; the date its snow.
    this.world.setRegion(dem.url, dem.meta);
    this.world.setSeason(scenario.month0, scenario.day);
    this.air = new AirMass(this.frame, scenario);
    this.pilotAir = new PilotAir(this.air, (x, y) => this.world.groundAt(x, y), (x, y) => this.world.coarseGroundAt(x, y));
    this.hour = scenario.hour;
    this.showThermals = opts.showThermals;
    this.timeScale = scenario.timeScale;
    const route = opts.routeId && !this.challengeOpt ? (atlas.features.routes ?? []).find((f) => f.properties.id === opts.routeId) : undefined;
    this.task = route ? taskFromRoute(route, this.frame) : null;
    this.logOptions = { wing: this.wing.id, mass: this.mass, start: this.startMode, view: opts.view, quality: this.world.quality, fpsCap: this.fpsCap, thermals: opts.showThermals, others: this.others, school: !!this.school, launchSlow: this.launchSlow, multi: !!this.multi, route: opts.routeId ?? null, challenge: this.challengeOpt ? `${this.challengeOpt.kind}:${this.challengeOpt.level}` : null };
    if (opts.log) {
      this.log = new FlightLog(() => this.logStart());
      window.addEventListener('error', this.onPageError);
      window.addEventListener('unhandledrejection', this.onRejection);
      window.addEventListener('pagehide', this.onPageHide);
      document.addEventListener('visibilitychange', this.onHide);
    }
  }

  /** The flight log (flight-log.ts), when the player lets it record; a new one after each restart. */
  private log: FlightLog | null = null;
  private logOptions: Record<string, number | string | boolean | null>;
  private logMsg = '';
  private logFps = { frames: 0, real: 0, fps: 60 };
  private onPageError = (e: ErrorEvent) => this.log?.event(this.gameT, 'error', `${e.message} (${(e.filename ?? '').split('/').pop()}:${e.lineno})`);
  private onRejection = (e: PromiseRejectionEvent) => this.log?.event(this.gameT, 'error', String(e.reason instanceof Error ? e.reason.message : e.reason));
  /** Hidden (another tab, the phone locked): what is waiting goes out; closed: the end too. */
  private onHide = () => {
    if (document.visibilityState === 'hidden') void this.log?.flush(true);
  };
  private onPageHide = () => {
    if (!this.log || this.log.done) return;
    this.log.row(this.gameT, this.logRow());
    this.log.close(this.gameT, { kind: 'closed', flightS: Math.round(this.flightS) });
  };

  private logStart() {
    const sc = this.scenario;
    return {
      client: logClientId(),
      build: String(import.meta.env.VITE_BUILD ?? 'dev').slice(0, 60),
      takeoffId: this.takeoff.id.slice(0, 200),
      takeoffName: this.takeoff.name.slice(0, 200),
      lon: this.frame.lon0,
      lat: this.frame.lat0,
      scenario: { month0: sc.month0, day: sc.day, hour: sc.hour, windFrom: sc.windFrom, windKmh: sc.windKmh, instability: sc.instability, humidity: sc.humidity, randomWeather: sc.randomWeather, timeScale: sc.timeScale, seed: sc.seed },
      options: this.logOptions,
      device: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio, ratio: this.world.ratio, touch: 'ontouchstart' in window, gpu: gpuName(), cores: navigator.hardwareConcurrency ?? null },
    };
  }

  /** A row of the flight log (FLIGHT_LOG_COLUMNS after t). */
  private logRow(): number[] {
    const g = this.glider;
    const a = this.airSample;
    const i = this.pilotAir.info;
    const deg = 180 / Math.PI;
    const ground = this.groundAt(g.x, g.y);
    const f = this.logFps;
    if (f.real > 0.2) {
      f.fps = f.frames / f.real;
      f.frames = 0;
      f.real = 0;
    }
    return [
      this.launch ? 1 : this.landing ? 2 : 0,
      g.x,
      g.y,
      g.z,
      g.z - ground,
      ((g.heading * deg) % 360 + 360) % 360,
      g.bank * deg,
      g.pitch * deg,
      g.airspeed,
      g.vz,
      this.varioF,
      g.brakeL,
      g.brakeR,
      g.weightShift,
      g.speedbar,
      g.ears,
      g.collapse.amount,
      g.collapse.frontal,
      g.stall,
      g.spin,
      a.u,
      a.v,
      a.w,
      i.relief,
      i.anabaticW,
      i.plume,
      i.thermal,
      i.gust,
      i.sigmaW,
      i.rotor,
      this.world.view === 'third' ? 1 : 0,
      f.fps,
    ];
  }

  /** The end of a flight in the log, with a last row at that moment. */
  private logEnd(info: Record<string, number | string | boolean | null>): void {
    if (!this.log || this.log.done) return;
    this.log.row(this.gameT, this.logRow());
    this.log.end(this.gameT, info);
  }

  /** Flying school (school.ts), when chosen; the time scale of the take-off in it (slow motion). */
  readonly school: School | null;
  private launchSlow: number;
  private schoolIn = newSchoolInput();
  private schoolT = 0;
  private senseT = { land: 0 };
  /** The scan of the thermal sources in progress (school): where it is, the best core and next thermal so far. */
  private scan = { k: 0, coreD: 600, coreX: NaN, coreY: NaN, coreW: 0, nextScore: 0, nextX: NaN, nextY: NaN };
  /** Where the core and the next thermal were found (local metres; NaN none): their direction follows the turns. */
  private coreAt = { x: NaN, y: NaN };
  private nextAt = { x: NaN, y: NaN };
  /** Left minus right tip lift (m/s), smoothed. */
  private tipLiftF = 0;
  /** The site's wind relative to the run on the take-off (m/s). */
  private launchWind = { head: NaN, cross: 0 };
  private reliefWarnT = -10;
  private reliefSide = 0;
  /** Landing fields documented around (local metres, altitude), for the school's approach. */
  private landings: { name: string; x: number; y: number; alt: number | null }[] = [];
  private landingPick: { name: string; x: number; y: number; alt: number } | null = null;

  /** The challenge asked for, the one generated (challenges.ts), its chrono and result. */
  private challengeOpt: { kind: ChallengeKind; level: ChallengeLevel } | null;
  challenge: Challenge | null = null;
  private chal = { startS: NaN, doneS: NaN, startAlt: 0 };
  /** Cost of the school and challenge logic (dev: ms summed, frames). */
  readonly logicCost = { ms: 0, frames: 0, maxMs: 0, slow: 0 };

  /** Cross-country task (a documented route), or null in free flight. */
  task: Task | null = null;
  /** Flying with friends: room and pilot name; the relay connection once open. */
  readonly multi: { room: string; name: string } | null;
  net: Multiplayer | null = null;
  chat: { name: string; text: string; self: boolean }[] = [];
  private netOff: (() => void) | null = null;

  private async connectMulti(): Promise<void> {
    if (!this.multi) return;
    const net = new Multiplayer({ room: this.multi.room, name: this.multi.name });
    this.net = net;
    this.netOff = net.onEvent((e: NetEvent) => {
      if (e.type === 'peer-join') this.incident = { text: `${e.name} a rejoint le salon`, until: this.flightS + 3 };
      else if (e.type === 'peer-leave') {
        const p = net.peers().get(e.id);
        this.incident = { text: `${p?.name ?? 'Un pilote'} a quitté le salon`, until: this.flightS + 3 };
      } else if (e.type === 'chat') this.chat = [...this.chat, { name: e.name, text: e.text, self: e.self }].slice(-6);
      else if (e.type === 'error' && e.fatal) this.incident = { text: `Multijoueur : ${e.message}`, until: this.flightS + 6 };
    });
    try {
      await net.connect();
    } catch (err) {
      this.incident = { text: `Multijoueur indisponible : ${err instanceof Error ? err.message : String(err)}`, until: this.flightS + 8 };
    }
  }

  sendChat(text: string): void {
    this.net?.sendChat(text);
  }

  /** The other pilots, interpolated, in this pilot's local frame. */
  /** The last minute of flight (oldest first) for the centring aid. */
  trail(): readonly { x: number; y: number; v: number; h: number }[] {
    return this.trailBuf;
  }

  /**
   * Mean climb (m/s) over the last full turn when circling, what a pilot's « moyenne » shows;
   * null when not turning (less than a half turn in the last 40 s).
   */
  climbAverage(): number | null {
    const b = this.trailBuf;
    let turn = 0;
    let sum = 0;
    let n = 0;
    for (let i = b.length - 1; i > 0 && n < 160; i--) {
      sum += b[i].v;
      n++;
      turn += Math.abs(Math.atan2(Math.sin(b[i].h - b[i - 1].h), Math.cos(b[i].h - b[i - 1].h)));
      if (turn >= 2 * Math.PI) return sum / n;
    }
    return turn >= Math.PI && n > 0 ? sum / n : null;
  }

  remotePilots(): { id: string; name: string; x: number; y: number; z: number; heading: number; bank: number; pitch: number; collapse: number; brakeL: number; brakeR: number }[] {
    const net = this.net;
    if (!net) return [];
    const now = performance.now();
    const out = [];
    for (const [id, p] of net.peers()) {
      const s = net.sample(id, now);
      if (!s) continue;
      const [lon, lat] = new LocalFrame(s.lon0, s.lat0).toLngLat(s.x, s.y);
      const [x, y] = this.frame.toXY(lon, lat);
      out.push({ id, name: p.name, x, y, z: s.z, heading: s.heading, bank: s.bank, pitch: s.pitch, collapse: s.collapse, brakeL: s.brakeL, brakeR: s.brakeR });
    }
    return out;
  }

  params(): ModelParams {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month0: this.scenario.month0,
      day: this.scenario.day,
      hour: Math.round(this.hour * 4) / 4,
      synoptic: { fromDeg: this.air.windFrom, speedKmh: this.air.windKmh },
      height: { mode: 'agl', meters: 50 },
      breezeScale: 1,
    };
  }

  private bbox(radiusM: number): [number, number, number, number] {
    const [w, s] = this.frame.toLngLat(this.glider.x - radiusM, this.glider.y - radiusM);
    const [e, n] = this.frame.toLngLat(this.glider.x + radiusM, this.glider.y + radiusM);
    return [w, s, e, n];
  }

  private pointsOf(cat: 'thermals' | 'takeoffs' | 'landings', radiusM: number): AtlasFeature[] {
    return (this.atlas.features[cat] ?? []).filter((f) => {
      if (f.geometry.type !== 'Point') return false;
      const [x, y] = this.frame.toXY(f.geometry.coordinates[0], f.geometry.coordinates[1]);
      return Math.hypot(x - this.glider.x, y - this.glider.y) < radiusM;
    });
  }

  async load(): Promise<void> {
    this.cb.onStatus('Analyse du relief et des brises documentées…');
    const t0 = performance.now();
    const { ms } = await this.initModel();
    if (import.meta.env.DEV) console.info(`[jeu] modèle prêt en ${Math.round(performance.now() - t0)} ms (worker ${Math.round(ms)} ms)`);
    // Never start inside the hill: at least 100 m above the model's ground under the spawn.
    const [lon, lat] = this.frame.toLngLat(this.spawn.x, this.spawn.y);
    const [under] = await this.model.sample(this.params(), [{ lon, lat, alt: 4000 }]);
    if (this.startMode === 'air' && under && this.spawn.z < under.ground + 100) this.spawn.z = under.ground + 100;
    this.glider.z = this.spawn.z;
    this.cb.onStatus('Soleil, thermiques et nuages du jour…');
    await this.refreshSun(true);
    this.air.convergences = (this.atlas.features.convergences ?? [])
      .filter((f) => f.geometry.type === 'LineString')
      .map((f) => ({
        name: f.properties.name,
        pts: (f.geometry.coordinates as [number, number][]).map(([lon, lat]) => this.frame.toXY(lon, lat)),
        start: f.properties.windowStart ?? 11.5,
        end: f.properties.windowEnd ?? 17.5,
      }));
    await this.placeSocks();
    if (this.challengeOpt) await this.prepareChallenge(this.challengeOpt.kind, this.challengeOpt.level);
    if (this.school) this.landings = this.landingFields();
    this.cb.onStatus('Chargement du paysage…');
    await this.world.ready;
    // The ground's heights around the start, for the collisions and the relief the wind meets.
    await this.world.heights.ready(this.spawn.x, this.spawn.y);
    this.applyAtmosphere();
    if (this.launch) {
      // Stand on the real ground (terrain tiles, finer than the take-off sheet's altitude).
      const g0 = this.world.groundAt(this.spawn.x, this.spawn.y);
      if (g0 !== null) this.spawn.z = g0 + 1.1;
      this.glider.z = this.spawn.z;
      this.world.glider.setInflation(this.launch.theta, 0, this.launch.facingWing, this.wingGround(this.spawn.heading));
      this.head = { yaw: 0, pitch: -0.05 };
    }
    // The start's view, the camera still, and the imagery all around (the world's ring of
    // tiles, lod.ts), so that turning the head later shows a loaded landscape. (A look all
    // around used to request it, the camera spinning behind the loading screen.)
    this.cb.onStatus('Chargement du paysage tout autour…');
    this.world.frameUpdate(this.glider, this.head);
    await this.world.imageryAround(4000);
    if (this.task) this.showTask(this.task);
    // A course the day makes hard (a high take-off under a low ceiling): said once, at the start.
    if (this.challenge && !this.challenge.ok) this.incident = { text: `Défi difficile aujourd’hui : ${this.challenge.issues[0]}`, until: 8 };
    this.cb.onStatus(null);
    void this.connectMulti();
    if (this.others) {
      // A busy site on a good day, a few pilots on a poor one.
      this.ai = new AiPilots(this.air, (x, y) => this.world.groundAt(x, y), makeRng(this.scenario.seed + 7919));
      const n = Math.max(3, Math.min(12, Math.round(3 + 9 * this.air.convection())));
      this.ai.populate(n, this.glider.x, this.glider.y, this.glider.z, this.gameT);
    }
    // The credits, shown in full while the landscape loads, fold into their (i) button once
    // flying: at once on a touch screen (they would cover the HUD of a small one), after a
    // few seconds on a computer.
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    this.attribTimer = setTimeout(() => this.world.collapseAttribution(), touch ? 0 : 8000);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  /**
   * The challenge from this take-off (challenges.ts): the ceiling needs nothing more; the
   * courses are generated on the model's grid of heights (the image the worker reads too,
   * from the browser's cache) and the day's ceiling and wind.
   */
  private async prepareChallenge(kind: ChallengeKind, level: ChallengeLevel): Promise<void> {
    this.cb.onStatus('Préparation du défi…');
    const t0 = performance.now();
    let ch: Challenge;
    if (kind === 'ceiling') ch = makeChallenge('ceiling', level, { heightAt: () => null }, { windFrom: 0, windKmh: 0, top: () => 0 });
    else {
      const px = await fetchGridPixels(this.dem.url, this.dem.meta);
      if (!px) throw new Error('relief du modèle indisponible pour placer les balises');
      const terrain = gridHeights(new Grid(this.dem.meta), (k) => px[k * 4] * 256 + px[k * 4 + 1] - 32768, (x, y) => this.frame.toLngLat(x, y));
      const air = this.air;
      const t1 = performance.now();
      ch = makeChallenge(kind, level, terrain, { windFrom: air.windFrom, windKmh: air.windKmh, top: (g) => Math.min(air.ceiling(g), air.cloudBase(g)) });
      if (import.meta.env.DEV) console.info(`[jeu] défi ${ch.name} : relief ${Math.round(t1 - t0)} ms, génération ${(performance.now() - t1).toFixed(1)} ms${ch.ok ? '' : ` (${ch.issues.join(' ; ')})`}`);
      // The turn points named after a documented place close to them, to find them on the map.
      const named = [...(this.atlas.features.takeoffs ?? []), ...(this.atlas.features.landings ?? []), ...(this.atlas.features.thermals ?? [])].filter((f) => f.geometry.type === 'Point');
      for (const p of ch.points.slice(1, -1)) {
        let best = 1500;
        let name = '';
        for (const f of named) {
          const [x, y] = this.frame.toXY(f.geometry.coordinates[0] as number, f.geometry.coordinates[1] as number);
          const d = Math.hypot(x - p.x, y - p.y);
          if (d < best) {
            best = d;
            name = f.properties.name.split(/[:(–]/)[0].trim();
          }
        }
        if (name) p.name = `${p.name} · ${name.length > 26 ? `${name.slice(0, 25)}…` : name}`;
      }
      this.task = { id: `challenge-${ch.key}`, name: ch.name, points: ch.points, next: 0, tags: [], legs: ch.points.slice(1).map((p, i) => Math.hypot(p.x - ch.points[i].x, p.y - ch.points[i].y)), goalT: null };
    }
    this.challenge = ch;
    this.chal = { startS: NaN, doneS: NaN, startAlt: this.takeoff.alt };
  }

  /**
   * The task's cylinders in the view. A challenge starts and ends at the take-off: once the
   * start is tagged, only the goal's cylinder stays there.
   */
  private showTask(t: Task): void {
    const k = this.challenge && t.next >= 1 ? 1 : 0;
    this.world.setTask(k ? t.points.slice(k) : t.points, t.next - k);
  }

  /** The documented landing fields within 60 km (their altitude from the sheet when given). */
  private landingFields(): { name: string; x: number; y: number; alt: number | null }[] {
    const out: { name: string; x: number; y: number; alt: number | null }[] = [];
    for (const f of this.atlas.features.landings ?? []) {
      if (f.geometry.type !== 'Point') continue;
      const [x, y] = this.frame.toXY(f.geometry.coordinates[0] as number, f.geometry.coordinates[1] as number);
      if (Math.hypot(x, y) > 60000) continue;
      const alt = parseFloat((f.properties.details?.Altitude ?? '').replace(/\s/g, ''));
      out.push({ name: f.properties.name.split(/[:(]/)[0].trim(), x, y, alt: Number.isFinite(alt) ? alt : null });
    }
    return out;
  }

  /** Model window around the pilot (radius in metres); re-initialised when he flies out of it. */
  private modelAt = { x: 0, y: 0 };
  private static MODEL_RADIUS = 45000;
  private reinit = false;
  private initModel(): Promise<{ ms: number }> {
    const g = this.glider;
    this.modelAt = { x: g.x, y: g.y };
    return this.model.init(this.dem.url, this.dem.meta, this.atlas.curated, this.atlas.curatedHazards ?? [], this.frame.toLngLat(g.x, g.y), GameEngine.MODEL_RADIUS);
  }

  private async refreshSun(place = false): Promise<void> {
    const gp = this.glider;
    if (!this.reinit && Math.hypot(gp.x - this.modelAt.x, gp.y - this.modelAt.y) > GameEngine.MODEL_RADIUS - 20000) {
      // Cross-country: the model's window follows the pilot.
      this.reinit = true;
      await this.initModel().finally(() => (this.reinit = false));
      place = true;
    }
    const p = this.params();
    const sun = await this.model.time(p);
    // The thermals' seasonal intensity (noon sun through the air mass, ground efficiency), as the map's model uses it.
    this.air.season = Math.max(0, Math.min(1, sun.thermalSeason ?? sun.season));
    this.air.hour = this.hour;
    this.sunInfo = sun;
    this.pilotAir.setSun(sun.sunAzimuth, sun.sunElevation);
    // The sun of the last two hours, for the heat the faces stored (the upslope breeze outlasts the sun).
    const [slon, slat] = this.frame.toLngLat(gp.x, gp.y);
    const past: { azimuth: number; elevation: number; weight: number }[] = [];
    const mem = RULES.thermalMemory;
    for (let k = 1; k <= 8; k++) {
      const age = (k * mem.window) / 8;
      const sp = sunPosition(legalTimeToUtc(p.year, p.month0, p.day, this.hour - age), slat, slon);
      past.push({ azimuth: sp.azimuth, elevation: sp.elevation, weight: Math.exp(-age / mem.tau) });
    }
    this.pilotAir.setSunPast(past);
    const grid = await this.model.potential(p, this.bbox(20000), 60);
    this.applyAtmosphere();
    // Gone far (cross-country): the thermals are placed again around the pilot.
    const g = this.glider;
    if (!place && Math.hypot(g.x - this.air.placedAt.x, g.y - this.air.placedAt.y) > 9000) place = true;
    if (place) {
      const known = this.pointsOf('thermals', 20000).map((f) => ({
        lon: (f.geometry.coordinates as [number, number])[0],
        lat: (f.geometry.coordinates as [number, number])[1],
        weight: f.properties.kk7P ?? (f.properties.origin === 'kk7' ? 0.8 : 0.6),
        name: f.properties.name,
      }));
      this.air.placeSources(grid, known, g.x, g.y);
    } else this.air.refreshPotential(grid);
    // The breezes changed with the hour: the thermals lean with the site's wind again.
    void this.requestProfiles();
    if (Math.hypot(g.x - this.socksAt.x, g.y - this.socksAt.y) > 9000) await this.placeSocks();
  }

  /**
   * The site's wind above the thermal sources within 15 km, at PROFILE_DZ heights: each
   * thermal leans with the layers it crosses (up a slope in the breeze, then with the wind
   * aloft), as the pilot drifts with the same wind.
   */
  private async requestProfiles(): Promise<void> {
    if (this.profiling) return;
    const g = this.glider;
    const near = this.air.sources.filter((s) => Math.abs(s.x - g.x) < 15000 && Math.abs(s.y - g.y) < 15000);
    if (!near.length) return;
    this.profiling = true;
    try {
      const lonLat = new Float64Array(near.length * 2);
      near.forEach((s, k) => {
        const [lon, lat] = this.frame.toLngLat(s.x, s.y);
        lonLat[2 * k] = lon;
        lonLat[2 * k + 1] = lat;
      });
      const { u, v } = await this.model.winds(this.params(), lonLat, PROFILE_DZ);
      this.air.setProfiles(
        near.map((s) => s.id),
        u,
        v,
      );
    } catch {
      // The model is being re-initialised: the thermals keep the wind aloft until next time.
    } finally {
      this.profiling = false;
    }
  }

  private async placeSocks(): Promise<void> {
    this.socksAt = { x: this.glider.x, y: this.glider.y };
    const spots = [...this.pointsOf('takeoffs', 15000), ...this.pointsOf('landings', 15000)];
    const pts = spots.map((f) => {
      const [lon, lat] = f.geometry.coordinates as [number, number];
      return { lon, lat, alt: 0 };
    });
    // Wind 10 m above the ground: first the ground, then the wind there.
    const ground = await this.model.sample(this.params(), pts.map((p) => ({ ...p, alt: 3000 })));
    const air = await this.model.sample(this.params(), pts.map((p, i) => ({ ...p, alt: (ground[i]?.ground ?? 0) + 10 })));
    this.world.setSocks(
      pts.map((p, i) => {
        const [x, y] = this.frame.toXY(p.lon, p.lat);
        return { x, y, ground: ground[i]?.ground ?? 0, u: air[i]?.u ?? 0, v: air[i]?.v ?? 0 };
      }),
    );
  }

  // --- Controls.
  keyDown(key: string): void {
    const k = key.toLowerCase();
    this.keys.add(k);
    this.audio.start();
    if (k === 'v') this.setView(this.world.view === 'first' ? 'third' : 'first');
    else if (k === 't') this.showThermals = !this.showThermals;
    else if (k === 'p' || k === 'escape') this.setPaused(!this.paused);
    else if (k === 'c') this.head = { yaw: 0, pitch: -0.12 };
    else if (k === 'm') this.audio.enabled = !this.audio.enabled;
    else if (k === 'o') this.controls.ears = !this.controls.ears;
    else if (k === 'r' && this.launch && (this.launch.phase === 'aborted' || this.launch.phase === 'ready')) this.relaunch();
    else if (k === '+' || k === '=') this.timeScale = Math.min(8, this.timeScale * 2);
    else if (k === '-') this.timeScale = Math.max(1, this.timeScale / 2);
    // Brakes a step at a time (a press, one step): A/Q left, E/D right; 0-9 both at once.
    else if (k === 'a') this.stepBrake('L', 1);
    else if (k === 'q') this.stepBrake('L', -1);
    else if (k === 'e') this.stepBrake('R', 1);
    else if (k === 'd') this.stepBrake('R', -1);
    else if (/^[0-9]$/.test(k)) {
      this.brakeTarget = { L: Number(k) * BRAKE_STEP, R: Number(k) * BRAKE_STEP };
      this.flashBrake('both');
    }
  }
  private stepBrake(side: 'L' | 'R', n: number): void {
    const t = this.brakeTarget;
    t[side] = Math.max(0, Math.min(1, Math.round((t[side] + n * BRAKE_STEP) / BRAKE_STEP) * BRAKE_STEP));
    this.flashBrake(side);
  }
  /** Where the brake keys have put the hands (0..1 each). */
  brakeSteps(): { L: number; R: number } {
    return this.brakeTarget;
  }
  /** The brake step just asked for, shown a moment (Hud.brakeFlash), and a click. */
  private flashBrake(side: 'L' | 'R' | 'both'): void {
    this.brakeFlash = { side, until: this.flightS + 1.3 };
    const t = this.brakeTarget;
    this.audio.tick(side === 'R' ? t.R : t.L);
  }
  private brakeFlash: { side: 'L' | 'R' | 'both'; until: number } | null = null;
  keyUp(key: string): void {
    this.keys.delete(key.toLowerCase());
  }
  /** Touch sliders: absolute brake position. */
  setBrake(side: 'L' | 'R', v: number): void {
    this.audio.start();
    if (side === 'L') this.controls.brakeL = v;
    else this.controls.brakeR = v;
    this.brakeTarget[side] = v;
  }
  /** Weight shift from the mouse (desktop): the cursor's place across the view, -1 … 1. */
  setMouseWeight(v: number): void {
    this.mouseWeight = Math.max(-1, Math.min(1, v));
  }
  setSpeedbar(v: number): void {
    this.controls.speedbar = v;
  }
  /** Weight shift in the harness, -1 (left) … 1 (right) (touch controls; keys S/F). */
  setWeight(v: number): void {
    this.weightInput = Math.max(-1, Math.min(1, v));
  }
  /** Touch controls on the take-off: run / pull the A risers, turn around, kill the wing (C risers). */
  setLaunchInput(go: boolean, turn: boolean, kill = false): void {
    this.touch = { go, turn };
    this.touchKill = kill;
  }
  toggleThermals(): void {
    this.showThermals = !this.showThermals;
  }
  toggleEars(): void {
    this.controls.ears = !this.controls.ears;
  }
  look(dyaw: number, dpitch: number): void {
    this.head.yaw = Math.max(-2.7, Math.min(2.7, this.head.yaw + dyaw));
    this.head.pitch = Math.max(-1.2, Math.min(1.35, this.head.pitch + dpitch));
  }
  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.world.setTopo(false);
  }
  /** Pause « point topo »: the map seen from above, topographic, with what the sources document around. */
  setTopo(on: boolean): void {
    if (on) this.paused = true;
    const g = this.glider;
    this.world.setTopo(on, { x: g.x, y: g.y, heading: g.heading }, on ? [...this.nearbyFeatures(15), ...this.taskFeatures()] : []);
  }
  get topo(): boolean {
    return this.world.topo;
  }
  setView(v: ViewMode): void {
    if (v !== this.world.view) this.log?.event(this.gameT, 'view', v);
    this.world.setView(v);
    this.head = { yaw: 0, pitch: v === 'first' ? -0.12 : 0 };
  }

  private readKeys(dt: number): void {
    const k = this.keys;
    // The hands travel to the brake steps asked for: a step in a few hundredths of a second,
    // hands up to full brake in 0.4 s (fast enough to dab them as the wing comes overhead).
    const rate = 2.5 * dt;
    const c = this.controls;
    c.brakeL += Math.max(-rate, Math.min(rate, this.brakeTarget.L - c.brakeL));
    c.brakeR += Math.max(-rate, Math.min(rate, this.brakeTarget.R - c.brakeR));
    c.stabilo = k.has('x');
    // Weight shift: the mouse, S leans left, F right, on top of the touch control.
    c.weight = Math.max(-1, Math.min(1, this.weightInput + this.mouseWeight + (k.has('f') ? 1 : 0) - (k.has('s') ? 1 : 0)));
    if (k.has(' ') && !this.launch) {
      c.speedbar = 1;
      this.barByKey = true;
    } else if (this.barByKey) {
      c.speedbar = 0;
      this.barByKey = false;
    }
    const look = 1.5 * dt;
    if (k.has('arrowleft')) this.look(-look, 0);
    if (k.has('arrowright')) this.look(look, 0);
    if (k.has('arrowup')) this.look(0, look * 0.8);
    if (k.has('arrowdown')) this.look(0, -look * 0.8);
  }

  // --- Air at the pilot.
  private requestSample(): void {
    if (this.sampling) return;
    this.sampling = true;
    const [lon, lat] = this.frame.toLngLat(this.glider.x, this.glider.y);
    this.model
      .sample(this.params(), [{ lon, lat, alt: this.glider.z }])
      .then(([a]) => {
        if (!a) return;
        // The pilot's air glides towards each sample (no steps in the wind every 0.2 s).
        this.modelAir = a;
        this.pilotAir.setModel(a);
        this.world.setSurfaceWind(a.u, a.v);
      })
      .catch(() => {})
      .finally(() => (this.sampling = false));
  }

  groundAt(x: number, y: number): number {
    return this.world.groundAt(x, y) ?? this.modelAir?.ground ?? 0;
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    // The frame cap: a display frame skipped is integrated with the next (half a 240 Hz tick
    // of slack, so a 60 Hz display's own frames all pass). Paused, the picture stands still:
    // a few frames a second keep the HUD alive, the GPU rests.
    if (this.fpsCap > 0 && now - this.last < 1000 / this.fpsCap - 1000 / 240) return;
    if (this.paused && !this.topo && now - this.last < 200) return;
    // A frame's timestamp can equal the previous one or precede the clock read at start:
    // no time has passed then.
    const real = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.readKeys(real);
    if (this.log) {
      this.logFps.frames++;
      this.logFps.real += real;
      this.log.tick(real);
    }
    if (!this.paused && !this.ended && real > 0) {
      // (School: the take-off may run in slow motion.)
      const dt = real * this.timeScale * (this.launch ? this.launchSlow : 1);
      this.gameT += dt;
      this.flightS += dt;
      this.hour += dt / 3600;
      this.air.hour = this.hour;
      this.air.evolve(dt);
      const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
      const h = dt / steps;
      const g = this.glider;
      const ground = this.groundAt(g.x, g.y);
      // The relief along the wind through the pilot (~10 times a second or every 15 m).
      if ((this.gameT - this.reliefT > 0.1 || Math.hypot(g.x - this.reliefAt.x, g.y - this.reliefAt.y) > 15) && this.modelAir) {
        this.reliefT = this.gameT;
        this.reliefAt = { x: g.x, y: g.y };
        this.pilotAir.update(g, ground);
      }
      // Shade on the thermal sources from the cumulus (about once a second).
      this.shadeT += dt;
      if (this.shadeT >= 1 && this.sunInfo) {
        this.air.updateShade(this.sunInfo.sunAzimuth, this.sunInfo.sunElevation, this.gameT, this.shadeT, g.x, g.y);
        this.shadeT = 0;
      }
      if (this.launch) this.groundStep(dt, steps);
      else if (this.landing) this.landingRun(dt, steps);
      else
        for (let i = 0; i < steps; i++) {
          const air = this.pilotAir.sample(g, ground, this.gameT, h, this.airSample);
          const events = step(g, this.controls, air, h, Math.random);
          if (!Number.isFinite(g.x + g.y + g.z + g.airspeed + g.vx + g.vy + g.vz)) {
            // Never leave the pilot in a broken state: back to the start.
            console.error('glider state not finite, restarting', { ...g });
            this.log?.event(this.gameT, 'error', 'glider state not finite, restarting');
            this.restart();
            break;
          }
          this.whiteout += (this.pilotAir.cloud - this.whiteout) * Math.min(1, h * 2);
          for (const e of events) {
            this.log?.event(this.gameT, e);
            this.incident = { text: EVENT_TEXT[e], until: this.flightS + (e === 'reopened' ? 2 : 5) };
            if (e !== 'reopened' && e !== 'cravat-cleared') this.audio.flap();
          }
          if (this.checkGround(this.groundAt(g.x, g.y))) break;
        }
      this.maxAlt = Math.max(this.maxAlt, g.z);
      if (!this.launch && !this.landing) this.terrainAhead();
      if (!this.launch && !this.landing) this.trackStats(g.x, g.y, g.z, dt);
      if (!this.launch && this.track.due(this.gameT)) {
        const [lon, lat] = this.frame.toLngLat(g.x, g.y);
        this.track.push(this.gameT, { hour: this.hour, lon, lat, alt: g.z });
      }
      if (this.log && !this.ended) {
        if (this.log.due(this.gameT)) this.log.row(this.gameT, this.logRow());
        // What the player is told (incidents, warnings, the school's messages).
        const msg = this.incident?.text ?? '';
        if (msg && msg !== this.logMsg) this.log.event(this.gameT, 'message', msg);
        this.logMsg = msg;
      }
      if (this.task && !this.launch && !this.landing) {
        const tagged = advanceTask(this.task, this.glider.x, this.glider.y, this.flightS);
        if (tagged) {
          this.showTask(this.task);
          const goal = this.task.goalT !== null;
          // A challenge's chrono runs from the start (the take-off's cylinder, left at the lift-off).
          const t0 = this.challenge ? (this.task.tags[0] ?? 0) : 0;
          this.incident = { text: goal ? `But atteint en ${fmtTime(this.flightS - t0)} !` : this.challenge && this.task.next === 1 ? `Chrono parti : ${this.challenge.name}` : `Balise validée : ${tagged.name}`, until: this.flightS + 4 };
          if (goal && this.challenge) {
            this.chal.doneS = this.flightS - t0;
            this.audio.chime();
          }
        }
      }
      const c0 = import.meta.env.DEV ? performance.now() : 0;
      if (this.challenge?.kind === 'ceiling') this.ceilingChallenge(dt);
      if (this.school) this.schoolStep(real);
      if (import.meta.env.DEV) {
        const ms = performance.now() - c0;
        this.logicCost.ms += ms;
        this.logicCost.frames++;
        this.logicCost.maxMs = Math.max(this.logicCost.maxMs, ms);
        if (ms > 0.25) this.logicCost.slow++;
      }
      this.varioF += (g.vz - this.varioF) * Math.min(1, dt / 0.6);
      const gl = this.glider;
      const onGround = !!this.launch || !!this.landing;
      if (!onGround) {
        this.trailT += dt;
        if (this.trailT >= 0.25) {
          this.trailT = 0;
          this.trailBuf.push({ x: gl.x, y: gl.y, v: this.varioF, h: gl.heading });
          if (this.trailBuf.length > 240) this.trailBuf.shift();
        }
      } else this.trailBuf.length = 0;
      this.audio.update(onGround ? 0 : this.varioF, real, this.launch ? this.launch.airspeed : gl.airspeed, Math.min(1, gl.collapse.amount * 1.5 + gl.collapse.frontal + gl.stall + gl.spin));
      this.timers.sample -= real;
      if (this.timers.sample <= 0) {
        this.timers.sample = 0.2;
        this.requestSample();
      }
      this.timers.sun -= dt;
      const far = Math.hypot(this.glider.x - this.modelAt.x, this.glider.y - this.modelAt.y) > GameEngine.MODEL_RADIUS - 20000;
      if ((this.timers.sun <= 0 || far) && !this.refreshing) {
        // The sun turns: the thermal potential of the slopes changes every few game minutes.
        this.timers.sun = 240;
        this.refreshing = true;
        void this.refreshSun().finally(() => (this.refreshing = false));
      }
    } else this.audio.update(0, real);
    this.timers.viz -= real;
    if (this.timers.viz <= 0) {
      this.timers.viz = 0.4;
      this.updateViz();
    }
    if (this.net) {
      const gs = this.glider;
      this.net.sendState({ x: gs.x, y: gs.y, z: gs.z, heading: gs.heading, bank: gs.bank, pitch: gs.pitch, brakeL: gs.brakeL, brakeR: gs.brakeR, collapse: gs.collapse.amount, airspeed: gs.airspeed, vz: gs.vz, lon0: this.frame.lon0, lat0: this.frame.lat0 });
    }
    this.world.setWind(...this.air.windAloft());
    const gdt = this.paused || this.ended ? 0 : real * this.timeScale;
    const gg = this.glider;
    this.world.flows.update(this.air, gg.x, gg.y, gg.z, this.gameT, gdt, this.showThermals);
    this.world.vultures.update(this.air, gg.x, gg.y, gg.z, this.gameT, gdt);
    if (this.ai && gdt > 0) for (let rem = gdt; rem > 1e-6; rem -= 0.1) this.ai.step(Math.min(0.1, rem), this.gameT, gg.x, gg.y, gg.z);
    if (this.net || this.ai) this.world.setPeers(this.ai ? [...this.remotePilots(), ...this.ai.views()] : this.remotePilots());
    this.world.frameUpdate(this.glider, this.head);
    this.timers.hud -= real;
    if (this.timers.hud <= 0) {
      this.timers.hud = 0.1;
      this.cb.onHud(this.hud());
    }
  };

  /** On the take-off: inflation, control, run, lift-off, abort (see launch.ts). */
  private groundStep(dt: number, steps: number): void {
    const L = this.launch!;
    const g = this.glider;
    const m = this.modelAir;
    const psi0 = this.spawn.heading;
    const u = m?.u ?? 0;
    const v = m?.v ?? 0;
    // The run follows the take-off's direction, steered by the brakes once running.
    const psi = psi0 + L.dir;
    const sx = Math.sin(psi);
    const sy = Math.cos(psi);
    // The site's wind at the take-off, relative to the run direction (a log profile: the wing is ~6 m up).
    const headwind = -(u * sx + v * sy);
    const crosswind = -(u * sy - v * sx);
    this.launchWind.head = headwind;
    this.launchWind.cross = crosswind;
    const here = this.groundAt(g.x, g.y);
    const ahead = this.groundAt(g.x + sx * 15, g.y + sy * 15);
    const slope = (here - ahead) / 15;
    const k = this.keys;
    const input = { go: k.has('z') || k.has('w') || this.touch.go || this.flightS - this.runOnT < 3, turn: k.has(' ') || this.touch.turn, kill: k.has('x') || this.touchKill, brakeL: this.controls.brakeL, brakeR: this.controls.brakeR };
    const h = dt / steps;
    for (let i = 0; i < steps; i++) launchStep(L, input, headwind, crosswind, slope, h);
    // Dragged by the wing: the pilot slides downwind.
    const back = L.drag;
    g.x += sx * (L.run - back) * dt;
    g.y += sy * (L.run - back) * dt;
    g.z = this.groundAt(g.x, g.y) + 1.1;
    g.heading = L.facingWing ? (psi + Math.PI) % (2 * Math.PI) : (psi + 2 * Math.PI) % (2 * Math.PI);
    g.brakeL = this.controls.brakeL;
    g.brakeR = this.controls.brakeR;
    g.airspeed = L.airspeed;
    g.vz = 0;
    g.vx = sx * L.run;
    g.vy = sy * L.run;
    this.world.glider.setInflation(L.theta, L.phi, L.facingWing, this.wingGround(psi));
    if (L.phase === 'airborne') {
      // Flying: the glider takes over at the airspeed reached, the wing overhead.
      const z = g.z + 0.3;
      this.glider = this.makeGlider(g.x, g.y, z, (psi + 2 * Math.PI) % (2 * Math.PI));
      setAirspeed(this.glider, Math.max(7, L.airspeed));
      this.glider.brakeL = this.controls.brakeL;
      this.glider.brakeR = this.controls.brakeR;
      this.launch = null;
      this.world.glider.setInflation(null);
      this.liftoffT = this.flightS;
      this.log?.event(this.gameT, 'liftoff', undefined, { airspeed: Math.round(L.airspeed * 10) / 10 });
      this.head = { yaw: 0, pitch: -0.12 };
      // (In school mode the school says it, with the key.)
      if (!this.school) this.incident = { text: 'Décollé ! Mains hautes, éloigne-toi du relief', until: this.flightS + 4 };
    } else if (L.phase === 'aborted' && !this.school) {
      this.incident = { text: `${L.failReason ?? 'Voile affalée.'} (R pour recommencer)`, until: this.flightS + 6 };
    } else if (L.phase === 'failed') {
      this.ended = true;
      const why = L.failReason ?? '';
      this.logEnd({ kind: 'launch', reason: why, flightS: Math.round(this.flightS) });
      this.cb.onEnd({ kind: 'launch', vz: 0, groundKmh: L.run * 3.6, flightS: this.flightS, distKm: 0, maxAlt: g.z, gainM: 0, bestClimb: 0, ceilingS: null, reason: this.school ? explainLaunch(why, this.launchWind.head) : why, challenge: this.challengeResult() });
    }
  }

  /** After an abort: back to the take-off's spot, the wing laid out again. */
  relaunch(): void {
    if (this.startMode === 'air') return;
    this.launch = newLaunch(this.startMode);
    const g = this.glider;
    g.x = this.spawn.x;
    g.y = this.spawn.y;
    g.z = this.groundAt(g.x, g.y) + 1.1;
    this.world.glider.setInflation(this.launch.theta, 0, this.launch.facingWing, this.wingGround(this.spawn.heading));
    this.incident = null;
  }

  /**
   * Height of the ground where the laid-out wing lies, ~6 m behind the pilot against the
   * run direction psi, relative to the carabiners: the wing rests on the real slope, not
   * on a flat ground 1.1 m under the pilot.
   */
  private wingGround(psi: number): number {
    const g = this.glider;
    const ground = this.groundAt(g.x - Math.sin(psi) * 6, g.y - Math.cos(psi) * 6);
    return Math.max(-6, Math.min(2, ground - g.z));
  }

  /**
   * Contact with the ground: the impact along the slope's normal and the speed along it
   * (see launch.ts touchdown); a fair contact goes on into the run-out. Returns true once
   * the glider is on the ground.
   */
  private checkGround(ground: number): boolean {
    const g = this.glider;
    // Just after lift-off the feet may still brush the slope: no landing for 2 s.
    if (this.flightS - this.liftoffT < 2 && g.z < ground + 0.5) {
      g.z = ground + 0.5;
      if (g.vz < 0) g.vz = 0;
      return false;
    }
    // The feet touch about a metre below the carabiners.
    if (g.z > ground + 0.9) return false;
    // The slope's normal from the fine terrain around the touchdown.
    const e = 3;
    const gx = (this.groundAt(g.x + e, g.y) - this.groundAt(g.x - e, g.y)) / (2 * e);
    const gy = (this.groundAt(g.x, g.y + e) - this.groundAt(g.x, g.y - e)) / (2 * e);
    const nl = Math.hypot(gx, gy, 1);
    const td = touchdown(g.vx, g.vy, g.vz, -gx / nl, -gy / nl, 1 / nl);
    const groundKmh = Math.hypot(g.vx, g.vy) * 3.6;
    g.z = ground + 1.1;
    // Just after lift-off, a light touch on a slope that keeps falling away, the wing still
    // flying and the pilot still facing down the take-off: no landing, he runs on until the
    // wing carries him again (what pilots do on a light-wind take-off: the wing leaves the
    // ground near its slowest and needs some height to reach its trim speed).
    const vh = Math.hypot(g.vx, g.vy);
    const slopeDown = -(gx * g.vx + gy * g.vy) / Math.max(0.1, vh);
    const off = Math.atan2(Math.sin(g.heading - this.spawn.heading), Math.cos(g.heading - this.spawn.heading));
    if (this.startMode !== 'air' && this.flightS - this.liftoffT < 10 && td.kind === null && slopeDown > 0.08 && g.airspeed > 5.5 && Math.abs(off) < 0.7) {
      this.launch = runOn(this.startMode, vh, g.airspeed, off);
      this.runOnT = this.flightS;
      this.incident = { text: 'Les pieds touchent : cours encore, la voile va te reprendre', until: this.flightS + 3 };
      return true;
    }
    // The feet brushing a slope while the wing flies (just after the take-off, soaring a face,
    // a turn close to the relief): a light touch along the slope, not into it, does not end
    // the flight wherever it happens; the pilot is pushed off along the slope and flies on.
    // Only lasting contact (dragged along the ground) or a real impact does.
    const slope = Math.acos(1 / nl);
    // (brushS: seconds of contact, forgotten as fast as they came; dragged along for 1.5 s, it ends.)
    const el = this.flightS - this.brushT;
    this.brushT = this.flightS;
    this.brushS = Math.max(0, this.brushS - el);
    if (slope > (15 * Math.PI) / 180 && td.impact < 1.5 && g.airspeed > 6.5 && g.collapse.amount < 0.3 && this.brushS < 1.5) {
      this.brushS += 2 * Math.min(el, 1 / 30);
      g.z = ground + 0.95;
      const vn = g.vx * (-gx / nl) + g.vy * (-gy / nl) + g.vz / nl;
      if (vn < 0) {
        g.vx -= (vn * -gx) / nl;
        g.vy -= (vn * -gy) / nl;
        g.vz -= vn / nl;
      }
      if (!this.incident || this.incident.until < this.flightS) this.incident = { text: 'Les pieds frôlent la pente : écarte-toi du relief', until: this.flightS + 2.5 };
      return false;
    }
    if (td.kind === 'crash' || td.kind === 'hard') {
      this.endFlight(td.kind, g.vz, groundKmh, td.reason);
      return true;
    }
    // Run it out along the ground, in the direction of the motion.
    const dir = Math.atan2(g.vx, g.vy);
    this.landing = newLanding(td.along, dir);
    this.landingVz = g.vz;
    this.landingKmh = groundKmh;
    return true;
  }
  /**
   * The relief ahead (a few times a second): where the path of the next 2 and 4 s meets the
   * ground, a warning. In the pilot's view the slope under and beside him is out of sight.
   */
  private terrainAhead(): void {
    if (this.flightS - this.aheadT < 0.25) return;
    this.aheadT = this.flightS;
    const g = this.glider;
    if (g.z - this.groundAt(g.x, g.y) < 3) return;
    for (const t of [2, 4]) {
      const clear = g.z + g.vz * t - this.groundAt(g.x + g.vx * t, g.y + g.vy * t);
      if (clear < (t === 2 ? 6 : 0)) {
        if (!this.incident || this.incident.until < this.flightS) this.incident = { text: 'Relief devant : vire ou écarte-toi', until: this.flightS + 1.5 };
        // The lower side, 150 m ahead and 50° off the path (the school says where to turn).
        const dir = Math.atan2(g.vx, g.vy);
        const gl = this.groundAt(g.x + Math.sin(dir - 0.87) * 150, g.y + Math.cos(dir - 0.87) * 150);
        const gr = this.groundAt(g.x + Math.sin(dir + 0.87) * 150, g.y + Math.cos(dir + 0.87) * 150);
        this.reliefWarnT = this.flightS;
        this.reliefSide = Math.abs(gl - gr) < 8 ? 0 : gl < gr ? -1 : 1;
        if (this.flightS - this.alertT > 1.2) {
          this.alertT = this.flightS;
          this.audio.groundAlert();
        }
        return;
      }
    }
  }
  private aheadT = 0;
  private alertT = -10;
  /** Feet brushing the slopes: time of the last contact and seconds of recent contact (checkGround). */
  private brushT = 0;
  private brushS = 0;
  private landingVz = 0;
  private landingKmh = 0;

  /** The run-out after touchdown: the pilot runs it out and kills the wing (see launch.ts landingStep). */
  private landingRun(dt: number, steps: number): void {
    const L = this.landing!;
    const g = this.glider;
    const m = this.modelAir;
    const sx = Math.sin(L.dir);
    const sy = Math.cos(L.dir);
    const headwind = -((m?.u ?? 0) * sx + (m?.v ?? 0) * sy) * 0.6;
    const here = this.groundAt(g.x, g.y);
    const ahead = this.groundAt(g.x + sx * 4, g.y + sy * 4);
    const k = this.keys;
    const brake = (this.controls.brakeL + this.controls.brakeR) / 2;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) landingStep(L, brake, k.has('x') || this.touchKill, headwind, (here - ahead) / 4, h);
    g.x += sx * L.v * dt;
    g.y += sy * L.v * dt;
    g.z = this.groundAt(g.x, g.y) + 1.1;
    g.vx = sx * L.v;
    g.vy = sy * L.v;
    g.vz = 0;
    g.airspeed = Math.max(0, L.v + headwind);
    g.brakeL = this.controls.brakeL;
    g.brakeR = this.controls.brakeR;
    const settle = Math.exp(-dt / 0.3);
    g.bank *= settle;
    g.pitch *= settle;
    this.world.glider.setInflation(L.theta, 0, false);
    if (L.phase === 'done') this.endFlight(L.kind, this.landingVz, this.landingKmh, L.reason);
  }

  /** Performance of the flight for the end card and the records. */
  private stats = { gain: 0, lastZ: NaN, best: 0, ceilingS: null as number | null, t: 0 };

  private trackStats(x: number, y: number, z: number, dt: number): void {
    const st = this.stats;
    // A jump of the position (restart, a test placing the glider) is not a climb.
    if (Number.isFinite(st.lastZ) && z > st.lastZ && z - st.lastZ < 20) st.gain += z - st.lastZ;
    st.lastZ = z;
    st.t += dt;
    if (st.t >= 0.5) {
      st.t = 0;
      const avg = this.climbAverage();
      if (avg !== null && avg > st.best) st.best = avg;
      if (st.ceilingS === null) {
        const ground = this.groundAt(x, y);
        const base = this.air.cloudBaseAt(x, y, ground);
        const top = Math.min(base, this.air.ceilingAt(x, y, ground));
        if (z > top - 100) st.ceilingS = this.flightS;
      }
    }
  }

  private endFlight(kind: FlightEnd['kind'], vz: number, groundKmh: number, reason: string): void {
    const g = this.glider;
    this.logEnd({ kind, reason, vz: Math.round(vz * 10) / 10, groundKmh: Math.round(groundKmh), flightS: Math.round(this.flightS), distKm: Math.round(this.distKm() * 100) / 100, maxAlt: Math.round(this.maxAlt) });
    this.ended = true;
    this.landing = null;
    this.audio.update(0, 0);
    const t = this.task;
    this.cb.onEnd({
      kind,
      vz,
      groundKmh,
      flightS: this.flightS,
      distKm: this.distKm(),
      maxAlt: this.maxAlt,
      gainM: this.stats.gain,
      bestClimb: this.stats.best,
      ceilingS: this.stats.ceilingS,
      reason: reason || undefined,
      task: t && !this.challenge ? { name: t.name, goal: t.goalT !== null, time: t.goalT !== null ? fmtTime(t.goalT) : null, madeKm: distanceMadeGood(t, g.x, g.y) / 1000, totalKm: taskLength(t) / 1000, tagged: t.next, count: t.points.length } : undefined,
      challenge: this.challengeResult(),
    });
  }

  /** The ceiling challenge: the chrono from the take-off to the day's top here (checked twice a second). */
  private ceilT = 0;
  private ceilTarget = NaN;
  private ceilingChallenge(dt: number): void {
    const c = this.chal;
    if (this.launch) return;
    if (!Number.isFinite(c.startS)) c.startS = this.flightS;
    this.ceilT -= dt;
    if (this.ceilT > 0 && Number.isFinite(this.ceilTarget)) return;
    this.ceilT = 0.5;
    this.ceilTarget = this.ceilingTarget();
    if (Number.isFinite(c.doneS) || this.landing) return;
    if (this.glider.z >= this.ceilTarget) {
      c.doneS = this.flightS - c.startS;
      this.incident = { text: `Plafond atteint en ${fmtTime(c.doneS)} !`, until: this.flightS + 5 };
      this.audio.chime();
    }
  }
  /**
   * Altitude to reach: 100 m under the day's top here (as the flight's stats count it), at least
   * 200 m above the take-off, but never above the top itself (a low day: then just under it, the
   * challenge said hard at the start).
   */
  private ceilingTarget(): number {
    const g = this.glider;
    const ground = this.groundAt(g.x, g.y);
    const top = Math.min(this.air.ceilingAt(g.x, g.y, ground), this.air.cloudBaseAt(g.x, g.y, ground));
    return Math.min(Math.max(top - 100, this.chal.startAlt + 200), top - 30);
  }

  private challengeResult(): ChallengeResult | undefined {
    const ch = this.challenge;
    if (!ch) return undefined;
    const done = Number.isFinite(this.chal.doneS);
    const timeS = done ? this.chal.doneS : null;
    if (ch.kind === 'ceiling') {
      const gain = (Number.isFinite(this.ceilTarget) ? this.ceilTarget : this.ceilingTarget()) - this.chal.startAlt;
      return { key: ch.key, name: ch.name, kind: ch.kind, success: done, timeS, lengthKm: 0, madeKm: 0, speed: done && timeS ? gain / timeS : null, gainM: gain };
    }
    const t = this.task;
    const g = this.glider;
    const made = t ? distanceMadeGood(t, g.x, g.y) / 1000 : 0;
    return { key: ch.key, name: ch.name, kind: ch.kind, success: done, timeS, lengthKm: ch.lengthM / 1000, madeKm: made, speed: done && timeS ? ch.lengthM / 1000 / (timeS / 3600) : null, gainM: null };
  }

  // --- Flying school: what it reads of the flight, ten times a second (school.ts).
  private schoolClock = 0;
  private schoolStep(real: number): void {
    const sc = this.school!;
    this.schoolClock += real;
    this.schoolT -= real;
    if (this.schoolT > 0) return;
    this.schoolT = 0.1;
    const s = this.schoolIn;
    const g = this.glider;
    const ground = this.groundAt(g.x, g.y);
    s.t = this.schoolClock;
    s.phase = this.launch ? 'launch' : this.landing ? 'landing' : 'air';
    s.launch = this.launch;
    s.headwind = this.modelAir ? this.launchWind.head : NaN;
    s.crosswind = this.launchWind.cross;
    s.sinceLiftoff = this.liftoffT > -1e8 ? this.flightS - this.liftoffT : NaN;
    s.z = g.z;
    s.agl = g.z - ground;
    s.vz = g.vz;
    s.vario = this.varioF;
    s.climbAvg = this.climbAverage() ?? NaN;
    s.bank = g.bank;
    s.turnRate = g.turnRate;
    s.airspeed = g.airspeed;
    s.brakeL = g.brakeL;
    s.brakeR = g.brakeR;
    s.stall = g.stall;
    s.spin = g.spin;
    s.collapse = g.collapse.amount;
    // The wing that lifts: the air at the tips, and its gusts as the wing feels them.
    const a = this.airSample;
    this.tipLiftF += ((a.wL ?? 0) - (a.wR ?? 0) + 0.5 * (g.tipHpL - g.tipHpR) - this.tipLiftF) * 0.15;
    s.tipLift = this.launch ? 0 : this.tipLiftF;
    s.top = Math.min(this.air.ceilingAt(g.x, g.y, ground), this.air.cloudBaseAt(g.x, g.y, ground));
    const m = this.modelAir;
    if (m) {
      s.windRel = relDeg(Math.atan2(-m.u, -m.v) - g.heading);
      s.windSpeed = Math.hypot(m.u, m.v);
    }
    s.reliefAhead = this.flightS - this.reliefWarnT < 1;
    s.reliefSide = this.reliefSide;
    if (s.phase === 'air') this.senseAir(s);
    sc.update(s);
    if (sc.takeChime()) this.audio.chime();
  }

  /** The best lift of the last turn, the core nearby, the next thermal and the landing field. */
  private senseAir(s: SchoolInput): void {
    const g = this.glider;
    const b = this.trailBuf;
    let wx = 0;
    let wy = 0;
    let ws = 0;
    for (let i = Math.max(0, b.length - 100); i < b.length; i++) {
      const v = b[i].v;
      if (v > 0.2) {
        wx += b[i].x * v;
        wy += b[i].y * v;
        ws += v;
      }
    }
    if (ws > 2) {
      s.bestDist = Math.hypot(wx / ws - g.x, wy / ws - g.y);
      s.bestRel = relDeg(Math.atan2(wx / ws - g.x, wy / ws - g.y) - g.heading);
    } else s.bestDist = NaN;
    const T = this.senseT;
    const now = this.schoolClock;
    // The thermals around, a slice of the sources at each reading (a full pass in < 1 s): the
    // core at the pilot's height within 600 m, and the next thermal, strong enough to climb in
    // (>= 1.2 m/s, the wing sinks ~1.1) and reached with a glide of 7 and 200 m to spare. (The
    // thermals lean with the wind: a wide box on their sources.)
    // Only while it serves: flying straight (lift met, the core's side; gliding on, the next one)
    // or at the ceiling; not while circling (the best of the turn comes from the track). (AirMass.
    // column makes a small object per thermal examined.)
    const src = this.air.sources;
    const S = this.scan;
    const wanted = Math.abs(g.turnRate) < 0.15 || g.z > s.top - 200;
    if (S.k === 0 && !wanted) {
      this.coreAt.x = NaN;
      this.nextAt.x = NaN;
    }
    const end = S.k === 0 && !wanted ? 0 : Math.min(src.length, S.k + 400);
    for (let k = S.k; k < end; k++) {
      const th = src[k];
      if (Math.abs(th.x - g.x) > 4500 || Math.abs(th.y - g.y) > 4500) continue;
      const c = this.air.columnShared(th, g.z, this.gameT);
      if (!c || c.w < 0.5) continue;
      const d = Math.hypot(c.cx - g.x, c.cy - g.y);
      if (d < S.coreD) {
        S.coreD = d;
        S.coreX = c.cx;
        S.coreY = c.cy;
        S.coreW = c.w;
      }
      if (c.w < 1.2 || d < 250 || g.z - (th.ground + 200) < d / 7) continue;
      const score = c.w / (1 + d / 1500);
      if (score > S.nextScore) {
        S.nextScore = score;
        S.nextX = c.cx;
        S.nextY = c.cy;
      }
    }
    S.k = end;
    if (end > 0 && end >= src.length) {
      this.coreAt.x = S.coreX;
      this.coreAt.y = S.coreY;
      s.coreW = S.coreW;
      this.nextAt.x = S.nextX;
      this.nextAt.y = S.nextY;
      S.k = 0;
      S.coreD = 600;
      S.coreX = NaN;
      S.nextScore = 0;
      S.nextX = NaN;
    }
    const ca = this.coreAt;
    s.coreDist = Number.isFinite(ca.x) ? Math.hypot(ca.x - g.x, ca.y - g.y) : NaN;
    if (Number.isFinite(ca.x)) s.coreRel = relDeg(Math.atan2(ca.x - g.x, ca.y - g.y) - g.heading);
    const na = this.nextAt;
    s.nextDist = Number.isFinite(na.x) ? Math.hypot(na.x - g.x, na.y - g.y) : NaN;
    if (Number.isFinite(na.x)) s.nextRel = relDeg(Math.atan2(na.x - g.x, na.y - g.y) - g.heading);
    if (now - T.land > 1) {
      // The landing field: the documented one needing the flattest glide within 12 km (kept unless another is clearly easier).
      T.land = now;
      let pick = this.landingPick;
      let need = pick ? Math.hypot(pick.x - g.x, pick.y - g.y) / Math.max(1, g.z - pick.alt) : Infinity;
      for (const l of this.landings) {
        const d = Math.hypot(l.x - g.x, l.y - g.y);
        if (d > 12000) continue;
        const alt = l.alt ?? this.world.groundAt(l.x, l.y);
        if (alt === null) continue;
        const n = d / Math.max(1, g.z - alt);
        if (n < need - 0.5) {
          need = n;
          pick = { name: l.name, x: l.x, y: l.y, alt };
        }
      }
      this.landingPick = pick;
    }
    const p = this.landingPick;
    if (p && Math.hypot(p.x - g.x, p.y - g.y) < 15000) {
      s.landName = p.name;
      s.landDist = Math.hypot(p.x - g.x, p.y - g.y);
      s.landRel = relDeg(Math.atan2(p.x - g.x, p.y - g.y) - g.heading);
      s.landHeight = g.z - p.alt;
    } else s.landDist = NaN;
  }

  private distKm(): number {
    return Math.hypot(this.glider.x - this.start.x, this.glider.y - this.start.y) / 1000;
  }

  private atmosphereT = 0;
  /** Share of the sky covered by cumulus around the pilot (0..1), for the light. */
  private cover = 0;
  private applyAtmosphere(): void {
    if (this.sunInfo) this.world.setAtmosphere(this.sunInfo.sunAzimuth, this.sunInfo.sunElevation, this.air.humidity, this.air.instability, this.cover);
  }

  private updateViz(): void {
    const g = this.glider;
    const clouds = this.air.clouds(g.x, g.y, this.gameT, 22000);
    this.world.setClouds(clouds);
    // A cloud's shadow and look count over a wider area than its body: ×3 on the covered area.
    let area = 0;
    for (const c of clouds) if (Math.hypot(c.x - g.x, c.y - g.y) < 10000) area += Math.PI * c.radius * c.radius * c.size;
    this.cover = Math.min(1, (3 * area) / (Math.PI * 1e8));
    if (performance.now() - this.atmosphereT > 10000) {
      this.atmosphereT = performance.now();
      this.applyAtmosphere();
    }
  }

  hud(): Hud {
    const g = this.glider;
    const ground = this.groundAt(g.x, g.y);
    const m = this.modelAir;
    const wind = m ? Math.hypot(m.u, m.v) : 0;
    const from = m ? ((Math.atan2(-m.u, -m.v) * 180) / Math.PI + 360) % 360 : 0;
    const hh = Math.floor(this.hour);
    const mm = Math.floor((this.hour - hh) * 60);
    const base = this.air.cloudBaseAt(g.x, g.y, ground);
    const ceiling = this.air.ceilingAt(g.x, g.y, ground);
    if (this.incident && this.flightS > this.incident.until) this.incident = null;
    return {
      alt: g.z,
      agl: g.z - ground,
      vario: this.varioF,
      climbAvg: this.climbAverage(),
      airKmh: g.airspeed * 3.6,
      groundKmh: Math.hypot(g.vx, g.vy) * 3.6,
      heading: ((g.heading * 180) / Math.PI + 360) % 360,
      windFrom: from,
      windKmh: wind * 3.6,
      brakeL: g.brakeL,
      brakeR: g.brakeR,
      speedbar: g.speedbar,
      clock: `${hh}h${String(mm).padStart(2, '0')}`,
      flightS: this.flightS,
      distKm: this.distKm(),
      maxAlt: this.maxAlt,
      ceiling,
      cloudBase: base < ceiling ? base : null,
      whiteout: this.whiteout,
      hazard: m?.hazard ?? null,
      incident: this.incident?.text ?? null,
      brakeFlash: this.brakeFlash && this.brakeFlash.until > this.flightS ? this.brakeFlash.side : null,
      load: g.load,
      paused: this.paused,
      view: this.world.view,
      showThermals: this.showThermals,
      timeScale: this.timeScale,
      wing: this.wing.id,
      ears: g.ears > 0.5,
      launch: this.launch ? this.launchHud(this.launch) : null,
      pressureL: g.pressureL,
      pressureR: g.pressureR,
      pressureWarn: this.launch || this.landing ? 0 : Math.max(0, Math.min(1, (4 - Math.min(g.marginL, g.marginR)) / 4)),
      weight: g.weightShift,
      landing: this.landing ? { speedKmh: Math.round(Math.abs(this.landing.v) * 3.6), hint: this.landing.theta > 0.8 ? 'Cours, puis freins à fond (ou X) pour affaler la voile' : 'Voile affalée' } : null,
      task: this.task ? this.taskHud(this.task) : null,
      school: this.school?.active ? { ...this.school.tip } : null,
      challenge: this.challenge ? this.challengeHud(this.challenge) : null,
      multi: this.multi
        ? {
            room: this.multi.room,
            status: this.net?.status ?? 'connecting',
            pilots: this.remotePilots().map((p) => ({ name: p.name, distKm: Math.hypot(p.x - g.x, p.y - g.y) / 1000, dz: p.z - g.z })),
            chat: this.chat,
          }
        : null,
    };
  }

  private challengeHud(ch: Challenge): NonNullable<Hud['challenge']> {
    const c = this.chal;
    const t0 = ch.kind === 'ceiling' ? c.startS : (this.task?.tags[0] ?? NaN);
    const started = Number.isFinite(t0);
    const done = Number.isFinite(c.doneS);
    const clock = fmtTime(done ? c.doneS : started ? this.flightS - t0 : 0);
    return { name: ch.name, kind: ch.kind, clock, started, done, target: ch.kind === 'ceiling' ? (Number.isFinite(this.ceilTarget) ? this.ceilTarget : this.ceilingTarget()) : null, issues: ch.issues };
  }

  private taskHud(t: Task) {
    const g = this.glider;
    const p = t.points[Math.min(t.next, t.points.length - 1)];
    const d = Math.max(0, Math.hypot(p.x - g.x, p.y - g.y) - (t.goalT === null ? p.r : 0));
    const brg = (Math.atan2(p.x - g.x, p.y - g.y) * 180) / Math.PI;
    const rel = ((brg - (g.heading * 180) / Math.PI + 540) % 360) - 180;
    // Arrival 150 m above the ground at the point.
    const groundAtP = this.world.groundAt(p.x, p.y);
    const height = g.z - ((groundAtP ?? this.groundAt(g.x, g.y)) + 150);
    return {
      name: t.name,
      next: p.name,
      index: Math.min(t.next + 1, t.points.length),
      count: t.points.length,
      distKm: d / 1000,
      relBearing: rel,
      glide: height > 10 ? d / height : null,
      doneKm: distanceMadeGood(t, g.x, g.y) / 1000,
      totalKm: taskLength(t) / 1000,
      clock: this.challenge ? fmtTime(t.goalT !== null ? t.goalT - (t.tags[0] ?? 0) : t.tags.length ? this.flightS - t.tags[0] : 0) : fmtTime(this.flightS),
      goal: t.goalT !== null,
    };
  }

  private launchHud(L: LaunchState) {
    const deg = (r: number) => Math.round((r * 180) / Math.PI);
    let hint: string;
    if (L.phase === 'aborted') hint = 'Voile affalée : R pour la replacer et recommencer';
    else if (L.drag > 0.3) hint = 'La voile te traîne : affale-la (X : les C, ou freins à fond)';
    else if (L.killing) hint = 'Tu affales la voile (C / freins à fond)';
    else if (L.wall) hint = 'Vent fort : la voile fait un mur, garde-la basse aux freins puis Z pour la monter';
    else if (L.phase === 'ready') hint = L.mode === 'forward' ? 'Face à la pente : Z pour courir et gonfler' : 'Face à ta voile : Z pour tirer les A (gonflage)';
    else if (L.theta < 1.1) hint = 'La voile monte… accompagne-la';
    else if (L.theta < 1.7 && L.thetaRate > 0.25) hint = 'Elle arrive au-dessus : un peu de frein (A et E) pour la temporiser';
    else if (Math.abs(L.phi) > 0.25) hint = L.phi > 0 ? 'Elle part à droite : frein gauche (A), place-toi dessous' : 'Elle part à gauche : frein droit (E), place-toi dessous';
    else if (L.facingWing) hint = 'Voile stable au-dessus : Espace pour te retourner';
    else hint = 'Voile stable : relâche les freins et cours (Z) jusqu’à décoller';
    return { phase: L.phase, theta: deg(L.theta), phi: deg(L.phi), airKmh: Math.round(L.airspeed * 3.6), facingWing: L.facingWing, mode: L.mode, hint };
  }

  /** The task's course and turn points as map features (category « task »), for the topo map. */
  private taskFeatures(): AtlasFeature[] {
    const t = this.task;
    if (!t) return [];
    const ll = t.points.map((p) => this.frame.toLngLat(p.x, p.y));
    const props = (id: string, name: string) => ({ id, category: 'task', massif: '', name, description: '', sources: '' });
    const out = [{ type: 'Feature', geometry: { type: 'LineString', coordinates: ll }, properties: props(`${t.id}-course`, '') }] as unknown as AtlasFeature[];
    t.points.forEach((p, i) => {
      // The goal is the start's place again: one marker.
      if (i === t.points.length - 1 && Math.hypot(p.x - t.points[0].x, p.y - t.points[0].y) < 1) return;
      out.push({ type: 'Feature', geometry: { type: 'Point', coordinates: ll[i] }, properties: props(`${t.id}-${i}`, p.name) } as unknown as AtlasFeature);
    });
    return out;
  }

  /** Atlas features around the pilot (for the topo map). */
  private nearbyFeatures(radiusKm: number): AtlasFeature[] {
    const g = this.glider;
    const out: AtlasFeature[] = [];
    for (const [cat, list] of Object.entries(this.atlas.features)) {
      if (cat === 'routes') continue;
      for (const f of list as AtlasFeature[]) {
        const c = f.geometry.type === 'Point' ? f.geometry.coordinates : f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
        const [x, y] = this.frame.toXY(c[0], c[1]);
        if (Math.hypot(x - g.x, y - g.y) < radiusKm * 1000) out.push(f);
      }
    }
    return out;
  }

  /** Documented knowledge around the pilot, for the pause screen. */
  nearby(radiusKm = 8): NearbyInfo[] {
    const out: NearbyInfo[] = [];
    const g = this.glider;
    for (const [cat, list] of Object.entries(this.atlas.features)) {
      for (const f of list as AtlasFeature[]) {
        const c = f.geometry.type === 'Point' ? f.geometry.coordinates : f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
        const [x, y] = this.frame.toXY(c[0], c[1]);
        const d = Math.hypot(x - g.x, y - g.y) / 1000;
        if (d > radiusKm || cat === 'routes') continue;
        out.push({ id: f.properties.id, lon: c[0], lat: c[1], category: cat, name: f.properties.name, description: f.properties.description ?? '', distKm: d, bearing: ((Math.atan2(x - g.x, y - g.y) * 180) / Math.PI + 360) % 360 });
      }
    }
    return out.sort((a, b) => a.distKm - b.distKm);
  }

  /** The flight so far in IGC format, or null before the take-off. */
  igc(pilot: string): string | null {
    if (this.track.fixes.length < 2) return null;
    return toIgc(this.track.fixes, { year: new Date().getFullYear(), month0: this.scenario.month0, day: this.scenario.day, pilot, glider: `Brises des Alpes EN-${this.wing.id}`, site: this.takeoff.name });
  }

  restart(): void {
    if (this.log) {
      this.logEnd({ kind: 'restart', flightS: Math.round(this.flightS) });
      this.log = new FlightLog(() => this.logStart());
    }
    this.track.clear();
    this.glider = this.makeGlider(this.spawn.x, this.spawn.y, this.spawn.z, this.spawn.heading);
    this.controls = { brakeL: 0, brakeR: 0, speedbar: 0, ears: false, weight: 0 };
    this.brakeTarget = { L: 0, R: 0 };
    this.landing = null;
    if (this.task) {
      this.task.next = 0;
      this.task.tags = [];
      this.task.goalT = null;
      this.showTask(this.task);
    }
    if (this.startMode !== 'air') {
      this.launch = newLaunch(this.startMode);
      this.world.glider.setInflation(this.launch.theta, 0, this.launch.facingWing);
      this.head = { yaw: 0, pitch: -0.05 };
    }
    this.flightS = 0;
    this.maxAlt = 0;
    this.liftoffT = -1e9;
    this.stats = { gain: 0, lastZ: NaN, best: 0, ceilingS: null, t: 0 };
    this.chal = { startS: NaN, doneS: NaN, startAlt: this.takeoff.alt };
    this.ceilTarget = NaN;
    this.school?.reset();
    this.landingPick = null;
    this.tipLiftF = 0;
    this.coreAt.x = NaN;
    this.nextAt.x = NaN;
    this.ended = false;
    this.paused = false;
    this.incident = null;
  }

  dispose(): void {
    this.logEnd({ kind: 'quit', flightS: Math.round(this.flightS) });
    window.removeEventListener('error', this.onPageError);
    window.removeEventListener('unhandledrejection', this.onRejection);
    window.removeEventListener('pagehide', this.onPageHide);
    document.removeEventListener('visibilitychange', this.onHide);
    cancelAnimationFrame(this.raf);
    clearTimeout(this.attribTimer);
    this.netOff?.();
    this.net?.close();
    this.audio.dispose();
    this.model.dispose();
    this.world.dispose();
  }
}
