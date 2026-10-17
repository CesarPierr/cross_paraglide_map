/**
 * The other pilots of the day: virtual paragliders flying the same air as the player, as on
 * a busy site on a summer afternoon. They glide from thermal to thermal, circle in the lift
 * (a gaggle marks a thermal, as it does in real life), climb as that thermal lets them at the
 * radius they turn at, leave when it weakens or tops out, keep clear of the relief and land in
 * the valley when they run out of lift; far behind or landed, one takes off again near the
 * player. A kinematic model (no wing physics): straight glides at trim, circles of ~30 m at
 * ~34° of bank. Their climb comes from their thermal's column itself (AirMass.column), not
 * from the air mass's sampling cache, which stays the player's. Shown as the multiplayer's
 * peers (world.setPeers).
 */
import type { AirMass, ThermalSource } from './airmass';

const NAMES = ['Léa', 'Tom', 'Inès', 'Hugo', 'Chloé', 'Marc', 'Julie', 'Nico', 'Emma', 'Paul', 'Sarah', 'Yann', 'Clara', 'Théo', 'Manon', 'Lucas', 'Anaïs', 'Rémi'];
/** Trim speed and sinks of an EN-B (flight.ts polar), circle radius (m) and bank (rad). */
const V_TRIM = 10.4;
const SINK_GLIDE = 1.1;
const SINK_TURN = 1.35;
const R_TURN = 30;
const BANK = 0.6;

export interface AiView {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  bank: number;
  pitch: number;
  collapse: number;
  brakeL: number;
  brakeR: number;
}

interface Ai {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  bank: number;
  vz: number;
  mode: 'glide' | 'climb';
  src: ThermalSource | null;
  /** Turn direction and angle on the circle (climbing). */
  dir: number;
  theta: number;
  /** Time spent climbing too slowly, and since the last look for a thermal (s). */
  weak: number;
  think: number;
  landed: boolean;
}

export class AiPilots {
  private list: Ai[] = [];

  constructor(
    private air: AirMass,
    private ground: (x: number, y: number) => number | null,
    private rng: () => number,
  ) {}

  /** `n` pilots around (x, y): in the active thermals near the player, the others gliding. */
  populate(n: number, x: number, y: number, z: number, t: number): void {
    this.list = [];
    for (let i = 0; i < n; i++) {
      const a: Ai = { id: `ai-${i}`, name: NAMES[i % NAMES.length], x, y, z, heading: 0, bank: 0, vz: 0, mode: 'glide', src: null, dir: 1, theta: 0, weak: 0, think: 0, landed: false };
      this.place(a, x, y, z, t);
      this.list.push(a);
    }
  }

  /** Advances them by dt (s) at game time t; (px, py, pz): the player. */
  step(dt: number, t: number, px: number, py: number, pz: number): void {
    const [wu, wv] = this.air.windAloft();
    for (const a of this.list) {
      if (a.landed || Math.hypot(a.x - px, a.y - py) > 9000) {
        this.place(a, px, py, pz, t);
        continue;
      }
      a.think -= dt;
      const g = this.ground(a.x, a.y);
      const agl = g === null ? 500 : a.z - g;
      if (a.mode === 'climb' && a.src) {
        const col = this.air.column(a.src, a.z, t);
        if (!col) {
          this.leave(a);
        } else {
          // Around the core at the turn's radius: the core's lift there, minus the sink in the turn.
          a.theta += (a.dir * V_TRIM * 0.9 * dt) / R_TURN;
          const tx = col.cx + R_TURN * Math.cos(a.theta);
          const ty = col.cy + R_TURN * Math.sin(a.theta);
          // Slide onto the circle (the core drifts and leans with height).
          const k = Math.min(1, dt / 2);
          a.x += (tx - a.x) * k;
          a.y += (ty - a.y) * k;
          a.heading = Math.atan2(-Math.sin(a.theta) * a.dir, Math.cos(a.theta) * a.dir);
          // dir +1: the angle grows anticlockwise, a left turn (the glider's bank is + to the right).
          a.bank += (-a.dir * BANK - a.bank) * Math.min(1, dt / 1.5);
          const q = R_TURN / Math.max(20, col.rc);
          const w = col.w * Math.exp(-0.384 * q * q) - SINK_TURN;
          a.vz += (w - a.vz) * Math.min(1, dt / 3);
          a.weak = a.vz < 0.2 ? a.weak + dt : Math.max(0, a.weak - dt);
          if (a.weak > 20) this.leave(a);
        }
      } else {
        // Gliding: towards the chosen thermal, or on along the heading; away from the slope when low.
        if (a.think <= 0) {
          a.think = 3 + 3 * this.rng();
          if (!a.src) a.src = this.choose(a, t, px, py);
          if (agl < 140) a.heading = this.downhill(a);
        }
        let target = a.heading;
        if (a.src && agl >= 140) {
          const col = this.air.column(a.src, a.z, t);
          if (!col) a.src = null;
          else {
            target = Math.atan2(col.cx - a.x, col.cy - a.y);
            if (Math.hypot(col.cx - a.x, col.cy - a.y) < 45) {
              a.mode = 'climb';
              a.theta = Math.atan2(a.y - col.cy, a.x - col.cx);
              a.dir = this.rng() < 0.5 ? -1 : 1;
              a.weak = 0;
            }
          }
        }
        const d = Math.atan2(Math.sin(target - a.heading), Math.cos(target - a.heading));
        a.heading += Math.max(-0.35 * dt, Math.min(0.35 * dt, d));
        a.bank += (Math.max(-0.4, Math.min(0.4, d)) - a.bank) * Math.min(1, dt / 1.5);
        a.x += (Math.sin(a.heading) * V_TRIM + wu) * dt;
        a.y += (Math.cos(a.heading) * V_TRIM + wv) * dt;
        a.vz += (-SINK_GLIDE - a.vz) * Math.min(1, dt / 2);
      }
      a.z += a.vz * dt;
      if (g !== null && a.z < g + 2) a.landed = true;
    }
  }

  /** What the world draws (world.setPeers). */
  views(): AiView[] {
    return this.list
      .filter((a) => !a.landed)
      .map((a) => {
        const inner = a.mode === 'climb' ? 0.4 : 0.1;
        const turnR = a.bank > 0.1;
        const turnL = a.bank < -0.1;
        return { id: a.id, name: a.name, x: a.x, y: a.y, z: a.z, heading: a.heading, bank: a.bank, pitch: 0, collapse: 0, brakeL: turnL ? inner : 0.12, brakeR: turnR ? inner : 0.12 };
      });
  }

  private leave(a: Ai): void {
    a.mode = 'glide';
    a.src = null;
    a.think = 0;
    a.weak = 0;
  }

  /** An active thermal at its height within reach, the stronger and nearer the likelier, staying around the player. */
  private choose(a: Ai, t: number, px: number, py: number): ThermalSource | null {
    let best: ThermalSource | null = null;
    let score = 0;
    for (const s of this.air.sources) {
      const d = Math.hypot(s.x - a.x, s.y - a.y);
      if (d > 4000 || Math.hypot(s.x - px, s.y - py) > 7000) continue;
      const col = this.air.column(s, a.z, t);
      if (!col || col.w < 1.6) continue;
      const v = (col.w / (1 + d / 1500)) * (0.6 + 0.8 * this.rng());
      if (v > score) {
        score = v;
        best = s;
      }
    }
    return best;
  }

  /** The lowest of eight directions 300 m away: where the valley is. */
  private downhill(a: Ai): number {
    let best = a.heading;
    let low = Infinity;
    for (let k = 0; k < 8; k++) {
      const h = (k * Math.PI) / 4;
      const g = this.ground(a.x + Math.sin(h) * 300, a.y + Math.cos(h) * 300);
      if (g !== null && g < low) {
        low = g;
        best = h;
      }
    }
    return best;
  }

  /** In an active thermal near the player (half within 1.5 km, half 1.5-4 km) when one is found, else gliding near his height. */
  private place(a: Ai, px: number, py: number, pz: number, t: number): void {
    const near = this.rng() < 0.5;
    const dMin = near ? 300 : 1500;
    const dMax = near ? 1500 : 4000;
    a.landed = false;
    a.mode = 'glide';
    a.src = null;
    a.weak = 0;
    a.think = this.rng() * 3;
    const cands: ThermalSource[] = [];
    for (const s of this.air.sources) {
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < dMin || d > dMax) continue;
      if (this.air.column(s, Math.max(pz, s.ground + 300), t)) cands.push(s);
    }
    if (cands.length) {
      const s = cands[Math.floor(this.rng() * cands.length)];
      const z = Math.max(s.ground + 300, pz + (this.rng() - 0.5) * 600);
      const col = this.air.column(s, z, t);
      if (col) {
        a.src = s;
        a.mode = 'climb';
        a.dir = this.rng() < 0.5 ? -1 : 1;
        a.theta = this.rng() * Math.PI * 2;
        a.x = col.cx + R_TURN * Math.cos(a.theta);
        a.y = col.cy + R_TURN * Math.sin(a.theta);
        a.z = z;
        a.vz = 0;
        a.bank = -a.dir * BANK;
        return;
      }
    }
    const ang = this.rng() * Math.PI * 2;
    const r = dMin + (dMax - dMin) * this.rng();
    a.x = px + Math.sin(ang) * r;
    a.y = py + Math.cos(ang) * r;
    const g = this.ground(a.x, a.y) ?? pz - 500;
    a.z = Math.max(g + 400, pz + (this.rng() - 0.5) * 400);
    a.heading = this.rng() * Math.PI * 2;
    a.vz = -SINK_GLIDE;
  }
}
