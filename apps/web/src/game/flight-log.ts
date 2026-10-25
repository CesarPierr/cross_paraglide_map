/**
 * The flight log (@brises/shared flight-log.ts): a row every half second of game time and the
 * flight's events, sent to the API every ~20 s and when the page goes away, so the problems
 * players meet can be replayed afterwards (scripts/dev/flight-logs.ts). Anonymous (a random id
 * per browser), off when the player says so in the menu. A failed send keeps its rows for the
 * next try (up to a quarter of an hour of them); the network never disturbs the game.
 */
import { FLIGHT_LOG_COLUMNS, FLIGHT_LOG_PERIOD_S, type FlightLogChunk, type FlightLogEvent, type FlightLogStart } from '@brises/shared';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';
/** Real seconds between two sends, rows per chunk at most, rows and events kept while the API is away. */
const SEND_EVERY_S = 20;
const CHUNK_ROWS = 120;
const MAX_ROWS = 1800;
const MAX_EVENTS = 400;

export interface LogTransport {
  /** Opens a log, resolves to its id. */
  open(start: FlightLogStart): Promise<string>;
  /** Sends a chunk: true once stored (or refused for good: the log is gone or closed). */
  send(id: string, chunk: FlightLogChunk, beacon: boolean): Promise<boolean>;
}

export const httpTransport: LogTransport = {
  async open(start) {
    const r = await fetch(`${API_BASE}/game/flights`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(start) });
    if (!r.ok) throw new Error(`journal de vol : ${r.status}`);
    return ((await r.json()) as { id: string }).id;
  },
  async send(id, chunk, beacon) {
    const url = `${API_BASE}/game/flights/${id}/chunks`;
    const body = JSON.stringify(chunk);
    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) return navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: body.length < 60000 });
    return r.ok || r.status === 404 || r.status === 409 || r.status === 400;
  },
};

/** The browser's random log id (kept across visits; a new one if storage is unavailable). */
export function logClientId(): string {
  const make = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
  try {
    const k = 'brises.game.logId';
    const v = localStorage.getItem(k);
    if (v && /^[a-z0-9]{8,32}$/.test(v)) return v;
    const n = make();
    localStorage.setItem(k, n);
    return n;
  } catch {
    return make();
  }
}

let gpu: string | null = null;
/** The GPU's name (once per page: it takes a WebGL context). */
export function gpuName(): string {
  if (gpu !== null) return gpu;
  gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    gpu = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).slice(0, 160) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    /* no GPU name */
  }
  return gpu;
}

/** Two decimals, one from 100 up: centimetres and hundredths are enough, the JSON stays small. */
const round = (v: number) => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100) : 0);

export class FlightLog {
  private id: string | null = null;
  private opening: Promise<void> | null = null;
  private failures = 0;
  private rows: number[][] = [];
  private events: FlightLogEvent[] = [];
  private endInfo: FlightLogChunk['end'] | null = null;
  private seq = 0;
  private sinceSend = 0;
  private sending: Promise<void> | null = null;
  private nextT = -Infinity;
  private t0 = NaN;
  /** Over: nothing more is recorded; the rest goes out with the next send. */
  done = false;

  constructor(
    private start: () => FlightLogStart,
    private transport: LogTransport = httpTransport,
  ) {}

  /** Game time `t` relative to the log's start. */
  private rel(t: number): number {
    if (!Number.isFinite(this.t0)) this.t0 = t;
    return round(t - this.t0);
  }

  /** True when a row is due at game time t. */
  due(t: number): boolean {
    return !this.done && t >= this.nextT;
  }

  /** A row: the values of FLIGHT_LOG_COLUMNS after `t`. */
  row(t: number, values: number[]): void {
    if (this.done) return;
    this.nextT = t + FLIGHT_LOG_PERIOD_S;
    const r = [this.rel(t)];
    for (let i = 0; i < values.length && i < FLIGHT_LOG_COLUMNS.length - 1; i++) r.push(round(values[i]));
    this.rows.push(r);
    if (this.rows.length > MAX_ROWS) this.rows.splice(0, this.rows.length - MAX_ROWS);
    if (!this.id && !this.opening) this.open();
  }

  event(t: number, kind: string, text?: string, data?: Record<string, number | string | boolean | null>): void {
    if (this.done) return;
    const e: FlightLogEvent = { t: this.rel(t), kind: kind.slice(0, 32) };
    if (text) e.text = text.slice(0, 300);
    if (data) e.data = data;
    this.events.push(e);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }

  /** The flight is over: its end, sent at once. */
  end(t: number, info: Record<string, number | string | boolean | null>): void {
    if (this.done) return;
    this.event(t, 'end', String(info.kind ?? ''));
    this.endInfo = info;
    this.done = true;
    void this.flush();
  }

  /** The page is going away: the end and what is left, by beacon. */
  close(t: number, info: Record<string, number | string | boolean | null>): void {
    if (this.done) return;
    this.event(t, 'end', String(info.kind ?? ''));
    this.endInfo = info;
    this.done = true;
    void this.flush(true);
  }

  /** Each frame: sends every SEND_EVERY_S real seconds. */
  tick(real: number): void {
    this.sinceSend += real;
    if (this.sinceSend >= SEND_EVERY_S) void this.flush();
  }

  private open(): void {
    if (this.failures >= 3) return;
    let start: FlightLogStart;
    try {
      start = this.start();
    } catch {
      this.failures = 3;
      return;
    }
    this.opening = this.transport
      .open(start)
      .then((id) => {
        this.id = id;
      })
      .catch(() => {
        this.failures++;
      })
      .finally(() => {
        this.opening = null;
      });
  }

  /** Sends what is waiting (by beacon when the page is going away); a send in progress is awaited, not doubled. */
  flush(beacon = false): Promise<void> {
    this.sinceSend = 0;
    if (this.sending && !beacon) return this.sending;
    const p = this.send(beacon).finally(() => {
      if (this.sending === p) this.sending = null;
    });
    if (!beacon) this.sending = p;
    return p;
  }

  private async send(beacon: boolean): Promise<void> {
    if (!this.id) {
      if (!this.opening && !beacon && this.rows.length) this.open();
      if (this.opening && !beacon) await this.opening;
      if (!this.id) return;
    }
    while (this.rows.length || this.events.length || this.endInfo) {
      const rows = this.rows.slice(0, CHUNK_ROWS);
      // The events up to the last row sent (all of them with the last chunk).
      const last = this.rows.length > CHUNK_ROWS ? rows[rows.length - 1][0] : Infinity;
      const nEv = this.events.findIndex((e) => e.t > last);
      const events = this.events.slice(0, nEv < 0 ? this.events.length : nEv);
      const final = rows.length === this.rows.length && events.length === this.events.length;
      const chunk: FlightLogChunk = { seq: this.seq, rows, events };
      if (final && this.endInfo) chunk.end = this.endInfo;
      const ok = await this.transport.send(this.id, chunk, beacon).catch(() => false);
      if (!ok) break;
      this.seq++;
      this.rows.splice(0, rows.length);
      this.events.splice(0, events.length);
      if (chunk.end) this.endInfo = null;
    }
  }
}
