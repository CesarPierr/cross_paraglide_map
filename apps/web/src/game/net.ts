/**
 * Multiplayer client of the flight game: one WebSocket to the API's relay
 * (`/api/game/ws`, see `apps/api/src/routes/game.ts` and `@brises/shared`'s
 * `game-protocol.ts` for the wire format) that puts the pilot in a room, sends its glider's
 * state at most 10 times a second and keeps what the other pilots send.
 *
 * Remote gliders are drawn from `sample(id, now)`, which answers the state a peer had about
 * 150 ms ago, interpolated between the two snapshots around that instant: with updates every
 * 100 ms there is always a pair to blend, so the motion stays smooth despite network jitter.
 * Snapshots are placed on the server's clock (`at`), not on their arrival time, so the jitter
 * of the sender's own connection does not reach the picture; the offset between the two clocks
 * is tracked as the smallest observed delay. If a snapshot is late, the last known velocity
 * carries the position on for up to 250 ms, then the glider holds still.
 *
 * The connection heals itself: after it has been up once, a drop (network, server restart)
 * is retried with a growing delay and the room is joined again, with a new id; the peers
 * are reconciled (`peer-leave` for those gone, `peer-join` for the new ones). It does not
 * retry when retrying cannot help (room full, rate limit…) nor when the very first attempt
 * fails: `connect()` then rejects and the caller decides.
 */
import { cleanChat, FATAL_CLOSE_CODES, isRoomCode, MAX_CHAT_LENGTH, parseServerMessage, readPeerState, STATE_RATE_HZ, type PeerInfo, type PeerState } from '@brises/shared';

export type { PeerState } from '@brises/shared';

/** Same base as the data client: VITE_API_URL when the API lives elsewhere, `/api` behind the proxy. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

/** ws(s) address of the relay, resolved like the API calls (relative to the page) with http(s) turned into ws(s). */
export function gameSocketUrl(apiBase: string = API_BASE, baseURI: string = typeof document !== 'undefined' ? document.baseURI : 'http://localhost/'): string {
  const url = new URL(`${apiBase}/game/ws`, baseURI);
  if (url.protocol === 'https:') url.protocol = 'wss:';
  else if (url.protocol === 'http:') url.protocol = 'ws:';
  return url.href;
}

// No 0/O/1/I: codes get read out loud and typed by hand.
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A random room code to share (6 characters by default, 32^6 ≈ 10⁹ possibilities). */
export function randomRoomCode(length = 6): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('');
}

/** What a user typed → a code the relay accepts: upper case, letters and digits only ("ab-12 cd" → "AB12CD"). */
export const normalizeRoomCode = (text: string): string => text.toUpperCase().replace(/[^A-Z0-9]/g, '');

export interface Peer {
  readonly id: string;
  name: string;
  /** Latest snapshot received, as sent (not interpolated); null until the first one. */
  state: Readonly<PeerState> | null;
  /** Local clock (the `now` option) when it joined this client's view of the room. */
  joinedAt: number;
  /** Local clock of the latest snapshot, 0 if none yet. */
  updatedAt: number;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export type NetEvent =
  | { type: 'status'; status: ConnectionStatus }
  /** Joined (or re-joined) the room. `peers` are the pilots already there; each also gets its own `peer-join`. */
  | { type: 'joined'; id: string; room: string; peers: PeerInfo[]; reconnected: boolean }
  | { type: 'peer-join'; id: string; name: string }
  | { type: 'peer-leave'; id: string }
  /** `self` is true for this pilot's own line, echoed back by the relay. `at` is the local clock. */
  | { type: 'chat'; id: string; name: string; text: string; self: boolean; at: number }
  /** `fatal`: the connection is over and will not be retried. */
  | { type: 'error'; code: string; message: string; fatal: boolean };

export class MultiplayerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MultiplayerError';
  }
}

export interface MultiplayerOptions {
  /** Full ws(s) address; by default `gameSocketUrl()`. */
  url?: string;
  /** 4–12 letters/digits; normalised to upper case. */
  room: string;
  name: string;
  /** How far in the past `sample` looks, ms. */
  delayMs?: number;
  /** Clock used by `sample(id, nowMs)` and for timing; `performance.now()` (the one of requestAnimationFrame) by default. */
  now?: () => number;
  /** Give up on a socket that has not joined after this long, ms. */
  connectTimeoutMs?: number;
}

const DEFAULT_DELAY_MS = 150;
const MAX_EXTRAPOLATION_MS = 250;
/** Snapshots kept per peer: 4 s at 10 Hz. */
const BUFFER_SIZE = 40;
/** Slightly under 100 ms so that a frame of jitter does not cost a whole update. */
const MIN_SEND_GAP_MS = 1000 / STATE_RATE_HZ - 5;
const PING_EVERY_MS = 5000;
const PONG_TIMEOUT_MS = 15_000;
const MAX_BACKOFF_MS = 8000;
const MAX_QUEUED_BYTES = 64 * 1024;
const OPEN = 1;
const TAU = Math.PI * 2;

const wrapAngle = (d: number) => d - TAU * Math.round(d / TAU);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const sameFrame = (a: PeerState, b: PeerState) => a.lon0 === b.lon0 && a.lat0 === b.lat0;

/** What a failed connection is called when the relay closed it with one of its own codes. */
const CLOSE_REASONS: Record<number, [string, string]> = {
  1008: ['rate-limit', 'too many messages sent'],
  1009: ['too-big', 'message too large'],
  4001: ['bad-join', 'the relay refused the room code or the join'],
  4002: ['room-full', 'the room is full'],
  4003: ['server-full', 'too many rooms are open, try again later'],
  4005: ['too-many-connections', 'too many connections from this address'],
};

interface Snapshot {
  /** Server clock, ms. */
  at: number;
  s: PeerState;
}

/** Timestamped snapshots of one peer, answering "where was it at server time t?". */
export class SnapshotBuffer {
  private readonly snaps: Snapshot[] = [];

  get length(): number {
    return this.snaps.length;
  }

  push(at: number, s: PeerState): void {
    const last = this.snaps[this.snaps.length - 1];
    // Timestamps come from one clock and one ordered stream; if the clock stepped back, keep the order anyway.
    if (last && at <= last.at) at = last.at + 1;
    this.snaps.push({ at, s });
    if (this.snaps.length > BUFFER_SIZE) this.snaps.shift();
  }

  /** Interpolated state at server time `t`; null if empty. Always a fresh object. */
  sample(t: number): PeerState | null {
    const n = this.snaps.length;
    if (n === 0) return null;
    const first = this.snaps[0];
    if (n === 1 || t <= first.at) return { ...first.s };
    const last = this.snaps[n - 1];
    if (t >= last.at) return extrapolate(this.snaps[n - 2], last, t);
    let i = n - 2;
    while (i > 0 && this.snaps[i].at > t) i--;
    const a = this.snaps[i];
    const b = this.snaps[i + 1];
    // A pilot that moved to another local frame between the two cannot be blended: switch at the midpoint.
    if (!sameFrame(a.s, b.s)) return { ...(t - a.at < b.at - t ? a.s : b.s) };
    const k = (t - a.at) / (b.at - a.at);
    return {
      x: lerp(a.s.x, b.s.x, k),
      y: lerp(a.s.y, b.s.y, k),
      z: lerp(a.s.z, b.s.z, k),
      heading: a.s.heading + wrapAngle(b.s.heading - a.s.heading) * k,
      bank: lerp(a.s.bank, b.s.bank, k),
      pitch: lerp(a.s.pitch, b.s.pitch, k),
      brakeL: lerp(a.s.brakeL, b.s.brakeL, k),
      brakeR: lerp(a.s.brakeR, b.s.brakeR, k),
      collapse: lerp(a.s.collapse, b.s.collapse, k),
      airspeed: lerp(a.s.airspeed, b.s.airspeed, k),
      vz: lerp(a.s.vz, b.s.vz, k),
      lon0: a.s.lon0,
      lat0: a.s.lat0,
    };
  }
}

/** Past the newest snapshot: carry the position on at the last measured velocity, briefly. */
function extrapolate(prev: Snapshot | undefined, last: Snapshot, t: number): PeerState {
  const out = { ...last.s };
  if (!prev || !sameFrame(prev.s, last.s)) return out;
  const span = last.at - prev.at;
  if (span <= 0 || span > 500) return out;
  const ahead = Math.min(t - last.at, MAX_EXTRAPOLATION_MS);
  out.x += ((last.s.x - prev.s.x) / span) * ahead;
  out.y += ((last.s.y - prev.s.y) / span) * ahead;
  out.z += ((last.s.z - prev.s.z) / span) * ahead;
  return out;
}

export class Multiplayer {
  private readonly url: string;
  private readonly room: string;
  private readonly name: string;
  private readonly delayMs: number;
  private readonly clock: () => number;
  private readonly connectTimeoutMs: number;

  private ws: WebSocket | null = null;
  private status_: ConnectionStatus = 'idle';
  private selfId: string | null = null;
  private readonly peerMap = new Map<string, Peer>();
  private readonly buffers = new Map<string, SnapshotBuffer>();
  private readonly listeners = new Set<(e: NetEvent) => void>();

  /** local clock = server clock + offset, as seen by the fastest snapshot so far. */
  private offset: number | null = null;
  private rtt: number | null = null;
  private lastSent = -Infinity;
  private everJoined = false;
  private closedByUser = false;
  private attempt = 0;
  private lastError: { code: string; message: string } | null = null;
  private awaitingPongSince: number | null = null;
  private pending: { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: MultiplayerOptions) {
    this.url = opts.url ?? gameSocketUrl();
    this.room = normalizeRoomCode(opts.room);
    this.name = opts.name;
    this.delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
    this.clock = opts.now ?? (() => performance.now());
    this.connectTimeoutMs = opts.connectTimeoutMs ?? 8000;
  }

  /** This pilot's id in the room (changes if the connection is re-established), null when not joined. */
  get id(): string | null {
    return this.selfId;
  }

  get status(): ConnectionStatus {
    return this.status_;
  }

  /** Round trip to the relay, ms, measured every 5 s; null until the first answer. */
  get latencyMs(): number | null {
    return this.rtt;
  }

  /**
   * Opens the socket and joins the room. Resolves once joined; rejects (a `MultiplayerError` with a
   * `code`) when the relay cannot be reached, refuses the room, or `close()` is called meanwhile.
   */
  connect(): Promise<void> {
    if (this.status_ === 'open') return Promise.resolve();
    if (this.pending) return this.pending.promise;
    if (!isRoomCode(this.room)) return Promise.reject(new MultiplayerError('bad-room', 'the room code must be 4 to 12 letters or digits'));
    this.closedByUser = false;
    this.everJoined = false;
    this.attempt = 0;
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.pending = { promise, resolve, reject };
    this.open();
    return promise;
  }

  /** Sends this pilot's state; calls closer than 100 ms to the previous one are ignored, so it can be called every frame. */
  sendState(s: PeerState): void {
    const ws = this.ws;
    if (!ws || this.status_ !== 'open' || ws.readyState !== OPEN || ws.bufferedAmount > MAX_QUEUED_BYTES) return;
    const t = this.clock();
    if (t - this.lastSent < MIN_SEND_GAP_MS) return;
    // Only the 13 fields travel, whatever object the caller passes (a full glider state, say).
    const clean = readPeerState(s);
    if (!clean) return;
    this.lastSent = t;
    ws.send(JSON.stringify({ t: 'state', s: clean }));
  }

  /** Says something to the room (cleaned, cut at 200 characters). The relay echoes it back to everybody, sender included. */
  sendChat(text: string): void {
    const ws = this.ws;
    const line = cleanChat(text);
    if (!ws || this.status_ !== 'open' || ws.readyState !== OPEN || !line) return;
    ws.send(JSON.stringify({ t: 'chat', text: Array.from(line).slice(0, MAX_CHAT_LENGTH).join('') }));
  }

  /** The other pilots of the room by id, with their latest raw snapshot. Live map: read it, do not change it. */
  peers(): Map<string, Peer> {
    return this.peerMap;
  }

  /** State of peer `id` as it was `delayMs` before `nowMs` (same clock as the `now` option), interpolated; null if unknown. */
  sample(id: string, nowMs: number): PeerState | null {
    const buf = this.buffers.get(id);
    if (!buf || this.offset === null) return null;
    return buf.sample(nowMs - this.delayMs - this.offset);
  }

  /** Subscribes to connection, room and chat events; returns the function that unsubscribes. */
  onEvent(cb: (e: NetEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Leaves the room and stops reconnecting. Pending `connect()` rejects. */
  close(): void {
    this.closedByUser = true;
    this.clearTimers();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      try {
        ws.close(1000);
      } catch {
        /* already closed */
      }
    }
    this.selfId = null;
    this.peerMap.clear();
    this.buffers.clear();
    this.settle(new MultiplayerError('closed', 'closed'));
    this.setStatus('closed');
  }

  // --- connection ---------------------------------------------------------------------------

  private open(): void {
    this.setStatus(this.everJoined ? 'reconnecting' : 'connecting');
    this.lastError = null;
    this.awaitingPongSince = null;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.onClosed(1006);
      return;
    }
    this.ws = ws;
    this.connectTimer = setTimeout(() => this.abandon(ws), this.connectTimeoutMs);
    ws.onopen = () => {
      if (this.ws === ws) ws.send(JSON.stringify({ t: 'join', room: this.room, name: this.name }));
    };
    ws.onmessage = (e) => {
      if (this.ws === ws && typeof e.data === 'string') this.onFrame(e.data);
    };
    ws.onerror = () => {
      /* the close that follows carries the outcome */
    };
    ws.onclose = (e) => {
      if (this.ws === ws) this.onClosed(e.code);
    };
  }

  /** A socket that stopped answering: let go of it without waiting for the browser to notice. */
  private abandon(ws: WebSocket): void {
    if (this.ws !== ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    this.onClosed(1006);
  }

  private onClosed(code: number): void {
    this.clearTimers();
    this.ws = null;
    this.selfId = null;
    this.rtt = null;
    if (this.closedByUser) return;
    const fatal = FATAL_CLOSE_CODES.has(code);
    if (fatal || !this.everJoined) {
      const [reason, message] = CLOSE_REASONS[code] ?? ['unreachable', 'the multiplayer server cannot be reached'];
      const err = this.lastError ?? { code: reason, message };
      // A fatal end takes the whole room with it: tell the view so it can drop the gliders.
      for (const id of [...this.peerMap.keys()]) this.dropPeer(id);
      this.settle(new MultiplayerError(err.code, err.message));
      this.setStatus('closed');
      if (fatal) this.emit({ type: 'error', code: err.code, message: err.message, fatal: true });
      return;
    }
    // Was up, now is not: try again, from 0.5 s up to 8 s apart, with some jitter so a restarted
    // server is not hit by every client at the same moment.
    this.setStatus('reconnecting');
    const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempt++) * (0.5 + Math.random() / 2);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  private clearTimers(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.connectTimer = this.retryTimer = this.pingTimer = null;
  }

  /** Every 5 s: one ping, and if the previous one is still unanswered after 15 s the link is dead. */
  private heartbeat(ws: WebSocket): void {
    if (this.ws !== ws) return;
    const now = this.clock();
    if (this.awaitingPongSince === null) {
      this.awaitingPongSince = now;
      if (ws.readyState === OPEN) ws.send(JSON.stringify({ t: 'ping', c: now }));
    } else if (now - this.awaitingPongSince > PONG_TIMEOUT_MS) {
      this.abandon(ws);
    }
  }

  // --- incoming -----------------------------------------------------------------------------

  private onFrame(text: string): void {
    this.awaitingPongSince = null;
    const m = parseServerMessage(text);
    if (!m) return;
    switch (m.t) {
      case 'joined': {
        const ws = this.ws;
        if (!ws) return;
        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = null;
        const reconnected = this.everJoined;
        this.everJoined = true;
        this.attempt = 0;
        this.selfId = m.id;
        // A re-joined room may be served by another process: its clock is not the one we measured.
        this.offset = null;
        this.setStatus('open');
        this.emit({ type: 'joined', id: m.id, room: m.room, peers: m.peers, reconnected });
        const present = new Set(m.peers.map((p) => p.id));
        for (const id of [...this.peerMap.keys()]) if (!present.has(id)) this.dropPeer(id);
        for (const p of m.peers) this.addPeer(p.id, p.name);
        this.pingTimer = setInterval(() => this.heartbeat(ws), PING_EVERY_MS);
        this.heartbeat(ws);
        this.settle(null);
        return;
      }
      case 'peer-join':
        this.addPeer(m.id, m.name);
        return;
      case 'peer-leave':
        this.dropPeer(m.id);
        return;
      case 'state': {
        const peer = this.peerMap.get(m.id);
        if (!peer) return;
        const recv = this.clock();
        const delay = recv - m.at;
        // The fastest snapshot defines the offset; it then drifts up slowly (clock drift, a slower route).
        if (this.offset === null || delay < this.offset) this.offset = delay;
        else this.offset += (delay - this.offset) * 0.005;
        peer.state = m.s;
        peer.updatedAt = recv;
        this.buffers.get(m.id)?.push(m.at, m.s);
        return;
      }
      case 'chat':
        this.emit({ type: 'chat', id: m.id, name: m.name, text: m.text, self: m.id === this.selfId, at: this.clock() });
        return;
      case 'pong': {
        const rtt = this.clock() - m.c;
        if (rtt >= 0 && rtt < 60_000) this.rtt = rtt;
        return;
      }
      case 'error':
        this.lastError = { code: m.code, message: m.message };
        // Before the join, or when the relay is about to cut us off, the close handler reports it.
        if (this.status_ === 'open' && m.code !== 'rate-limit') this.emit({ type: 'error', code: m.code, message: m.message, fatal: false });
        return;
    }
  }

  private addPeer(id: string, name: string): void {
    if (id === this.selfId) return;
    const known = this.peerMap.get(id);
    if (known) {
      known.name = name;
      return;
    }
    this.peerMap.set(id, { id, name, state: null, joinedAt: this.clock(), updatedAt: 0 });
    this.buffers.set(id, new SnapshotBuffer());
    this.emit({ type: 'peer-join', id, name });
  }

  private dropPeer(id: string): void {
    this.buffers.delete(id);
    if (this.peerMap.delete(id)) this.emit({ type: 'peer-leave', id });
  }

  // --- plumbing -----------------------------------------------------------------------------

  /** Resolves (null) or rejects the promise `connect()` handed out. */
  private settle(err: Error | null): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    if (err) p.reject(err);
    else p.resolve();
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.status_) return;
    this.status_ = status;
    this.emit({ type: 'status', status });
  }

  private emit(e: NetEvent): void {
    for (const cb of [...this.listeners]) {
      try {
        cb(e);
      } catch (err) {
        console.error('[multiplayer] listener failed', err);
      }
    }
  }
}
