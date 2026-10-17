/**
 * The game loop: reads the controls, flies the glider through the air (the site's model
 * for the wind, the fine relief's lift, rotors and gaps, the air mass for the thermals,
 * sink, clouds and gusts: see pilot-air.ts), handles the take-off and the landing's
 * run-out on the ground, moves the camera and feeds the HUD.
 */
import type { Atlas, AtlasFeature } from '@brises/shared';
import { legalTimeToUtc, RULES, sunPosition, type GridMeta, type ModelParams } from '@brises/model';
import { AirMass, PROFILE_DZ, type Scenario } from './airmass';
import { AudioVario } from './audio';
import { newGlider, setAirspeed, step, WINGS, type AirSample, type Controls, type FlightEvent, type GliderState, type WingParams } from './flight';
import { GameModel } from './game-client';
import { landingStep, launchStep, newLanding, newLaunch, runOn, touchdown, type LandingState, type LaunchMode, type LaunchState } from './launch';
import { PilotAir } from './pilot-air';
import { advanceTask, distanceMadeGood, taskFromRoute, taskLength, type Task } from './task';
import { Multiplayer, type NetEvent } from './net';
import type { ModelAir } from './game-worker';
import { LocalFrame } from './geo';
import { TrackRecorder, toIgc } from './igc';
import { GameWorld, type Head, type ViewMode } from './world';

import type { Takeoff } from './takeoffs';

/** Default take-off: Saint-Hilaire-du-Touvet, déco Sud. */
export const SAINT_HILAIRE: Takeoff = { id: 'default-saint-hilaire', name: 'Saint-Hilaire-du-Touvet : déco Sud', massif: 'Chartreuse', lon: 5.8908, lat: 45.3103, alt: 939, facing: 120, orientation: 'E, SE, S, SW' };

/** Where the flight starts: in the air just off the take-off, flying out of it. */
function spawnOf(t: Takeoff) {
  const h = (t.facing * Math.PI) / 180;
  return { x: Math.sin(h) * 250, y: Math.cos(h) * 250, z: t.alt + 80, heading: h };
}

export interface Hud {
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
}

export interface FlightEnd {
  kind: 'landed' | 'hard' | 'crash' | 'launch';
  /** Cross-country task result. */
  task?: { name: string; goal: boolean; time: string | null; madeKm: number; totalKm: number; tagged: number; count: number };
  /** Why a take-off failed. */
  reason?: string;
  vz: number;
  groundKmh: number;
  flightS: number;
  distKm: number;
  maxAlt: number;
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

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min ${String(sec).padStart(2, '0')} s`;
}

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
    opts: { view: ViewMode; showThermals: boolean; wing?: WingParams['id']; start?: 'air' | LaunchMode; mass?: number; routeId?: string | null; multi?: { room: string; name: string } | null },
  ) {
    this.multi = opts.multi ?? null;
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
    // The model's grid also gives the landscape its distant relief and land cover; the date its snow.
    this.world.setRegion(dem.url, dem.meta);
    this.world.setSeason(scenario.month0, scenario.day);
    this.air = new AirMass(this.frame, scenario);
    this.pilotAir = new PilotAir(this.air, (x, y) => this.world.groundAt(x, y));
    this.hour = scenario.hour;
    this.showThermals = opts.showThermals;
    this.timeScale = scenario.timeScale;
    const route = opts.routeId ? (atlas.features.routes ?? []).find((f) => f.properties.id === opts.routeId) : undefined;
    this.task = route ? taskFromRoute(route, this.frame) : null;
  }

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
    this.cb.onStatus('Chargement du paysage…');
    await this.world.ready;
    // The ground's heights around the start, for the collisions and the relief the wind meets.
    await this.world.heights.ready(this.spawn.x, this.spawn.y);
    this.applyAtmosphere();
    // A look all around before the start: the tiles of every direction are requested and
    // cached, so turning the head later shows a loaded landscape.
    this.cb.onStatus('Préchargement du paysage tout autour…');
    for (let k = 0; k < 8; k++) {
      this.world.frameUpdate(this.glider, { yaw: (k * Math.PI) / 4, pitch: -0.25 });
      await new Promise((r) => setTimeout(r, 280));
    }
    if (this.launch) {
      // Stand on the real ground (terrain tiles, finer than the take-off sheet's altitude).
      const g0 = this.world.groundAt(this.spawn.x, this.spawn.y);
      if (g0 !== null) this.spawn.z = g0 + 1.1;
      this.glider.z = this.spawn.z;
      this.world.glider.setInflation(this.launch.theta, 0, this.launch.facingWing, this.wingGround(this.spawn.heading));
      this.head = { yaw: 0, pitch: -0.05 };
    }
    if (this.task) this.world.setTask(this.task.points, this.task.next);
    this.cb.onStatus(null);
    void this.connectMulti();
    // The credits, shown in full while the landscape loads, fold into their (i) button once
    // flying: at once on a touch screen (they would cover the HUD of a small one), after a
    // few seconds on a computer.
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    this.attribTimer = setTimeout(() => this.world.collapseAttribution(), touch ? 0 : 8000);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
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
  }
  keyUp(key: string): void {
    this.keys.delete(key.toLowerCase());
  }
  /** Touch sliders: absolute brake position. */
  setBrake(side: 'L' | 'R', v: number): void {
    this.audio.start();
    if (side === 'L') this.controls.brakeL = v;
    else this.controls.brakeR = v;
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
    this.world.setTopo(on, { x: g.x, y: g.y, heading: g.heading }, this.nearbyFeatures(15));
  }
  get topo(): boolean {
    return this.world.topo;
  }
  setView(v: ViewMode): void {
    this.world.setView(v);
    this.head = { yaw: 0, pitch: v === 'first' ? -0.12 : 0 };
  }

  private readKeys(dt: number): void {
    const k = this.keys;
    // Hands move fast enough to dab the brakes when the wing comes overhead at take-off.
    const rate = 1.5 * dt;
    const c = this.controls;
    if (k.has('a')) c.brakeL = Math.min(1, c.brakeL + rate);
    if (k.has('q')) c.brakeL = Math.max(0, c.brakeL - rate);
    if (k.has('e')) c.brakeR = Math.min(1, c.brakeR + rate);
    if (k.has('d')) c.brakeR = Math.max(0, c.brakeR - rate);
    c.stabilo = k.has('x');
    // Weight shift: S leans left, F right (on top of the touch control).
    c.weight = Math.max(-1, Math.min(1, this.weightInput + (k.has('f') ? 1 : 0) - (k.has('s') ? 1 : 0)));
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
    // A frame's timestamp can equal the previous one or precede the clock read at start:
    // no time has passed then.
    const real = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.readKeys(real);
    if (!this.paused && !this.ended && real > 0) {
      const dt = real * this.timeScale;
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
            this.restart();
            break;
          }
          this.whiteout += (this.pilotAir.cloud - this.whiteout) * Math.min(1, h * 2);
          for (const e of events) {
            this.incident = { text: EVENT_TEXT[e], until: this.flightS + (e === 'reopened' ? 2 : 5) };
            if (e !== 'reopened' && e !== 'cravat-cleared') this.audio.flap();
          }
          if (this.checkGround(this.groundAt(g.x, g.y))) break;
        }
      this.maxAlt = Math.max(this.maxAlt, g.z);
      if (!this.launch && this.track.due(this.gameT)) {
        const [lon, lat] = this.frame.toLngLat(g.x, g.y);
        this.track.push(this.gameT, { hour: this.hour, lon, lat, alt: g.z });
      }
      if (this.task && !this.launch && !this.landing) {
        const tagged = advanceTask(this.task, this.glider.x, this.glider.y, this.flightS);
        if (tagged) {
          this.world.setTask(this.task.points, this.task.next);
          const goal = this.task.goalT !== null;
          this.incident = { text: goal ? `But atteint en ${fmtTime(this.flightS)} !` : `Balise validée : ${tagged.name}`, until: this.flightS + 4 };
        }
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
    if (this.net) this.world.setPeers(this.remotePilots());
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
      this.head = { yaw: 0, pitch: -0.12 };
      this.incident = { text: 'Décollé ! Mains hautes, éloigne-toi du relief', until: this.flightS + 4 };
    } else if (L.phase === 'aborted') {
      this.incident = { text: `${L.failReason ?? 'Voile affalée.'} (R pour recommencer)`, until: this.flightS + 6 };
    } else if (L.phase === 'failed') {
      this.ended = true;
      this.cb.onEnd({ kind: 'launch', vz: 0, groundKmh: L.run * 3.6, flightS: this.flightS, distKm: 0, maxAlt: g.z, reason: L.failReason ?? '' });
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

  private endFlight(kind: FlightEnd['kind'], vz: number, groundKmh: number, reason: string): void {
    const g = this.glider;
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
      reason: reason || undefined,
      task: t ? { name: t.name, goal: t.goalT !== null, time: t.goalT !== null ? fmtTime(t.goalT) : null, madeKm: distanceMadeGood(t, g.x, g.y) / 1000, totalKm: taskLength(t) / 1000, tagged: t.next, count: t.points.length } : undefined,
    });
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
      clock: fmtTime(this.flightS),
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
    this.track.clear();
    this.glider = this.makeGlider(this.spawn.x, this.spawn.y, this.spawn.z, this.spawn.heading);
    this.controls = { brakeL: 0, brakeR: 0, speedbar: 0, ears: false, weight: 0 };
    this.landing = null;
    if (this.task) {
      this.task.next = 0;
      this.task.tags = [];
      this.task.goalT = null;
      this.world.setTask(this.task.points, 0);
    }
    if (this.startMode !== 'air') {
      this.launch = newLaunch(this.startMode);
      this.world.glider.setInflation(this.launch.theta, 0, this.launch.facingWing);
      this.head = { yaw: 0, pitch: -0.05 };
    }
    this.flightS = 0;
    this.maxAlt = 0;
    this.ended = false;
    this.paused = false;
    this.incident = null;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.attribTimer);
    this.netOff?.();
    this.net?.close();
    this.audio.dispose();
    this.model.dispose();
    this.world.dispose();
  }
}
