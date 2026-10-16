/**
 * Wire protocol of the multiplayer relay (`/api/game/ws`), shared by the API (which
 * validates everything it receives) and the game client (which only trusts what passes
 * the same checks). Frames are JSON text, at most 2 KB.
 *
 *   client → server  join {room, name} · state {s} (≤ 10 Hz) · chat {text} · ping {c}
 *   server → client  joined · peer-join · peer-leave · state · chat · pong · error
 *
 * The relay is dumb on purpose: it never simulates anything, it forwards a validated copy
 * of the sender's flight state to the other members of the room. Positions are metres in
 * the *sender's* local frame around (lon0, lat0); each receiver converts with those two
 * numbers if its own frame differs.
 */

/** 4–12 upper-case letters or digits; the code is the only "key" of a room. */
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,12}$/;
export const MAX_PEERS_PER_ROOM = 8;
export const MAX_NAME_LENGTH = 24;
export const MAX_CHAT_LENGTH = 200;
/** Largest frame the relay accepts, in bytes (a state frame is ~250 bytes). */
export const MAX_MESSAGE_BYTES = 2048;
/** Clients send at most this many states per second; the relay drops the surplus. */
export const STATE_RATE_HZ = 10;

/** Close codes the relay uses (4xxx are application-defined). */
export const CLOSE_CODES = {
  goingAway: 1001,
  rateLimit: 1008,
  tooBig: 1009,
  badJoin: 4001,
  roomFull: 4002,
  serverFull: 4003,
  joinTimeout: 4004,
  tooManyConnections: 4005,
} as const;

/** Closes after which reconnecting would only repeat the failure: the client gives up. */
export const FATAL_CLOSE_CODES: ReadonlySet<number> = new Set([
  CLOSE_CODES.rateLimit,
  CLOSE_CODES.tooBig,
  CLOSE_CODES.badJoin,
  CLOSE_CODES.roomFull,
  CLOSE_CODES.serverFull,
  CLOSE_CODES.tooManyConnections,
]);

export type GameErrorCode =
  | 'bad-message'
  | 'bad-room'
  | 'too-long'
  | 'not-joined'
  | 'already-joined'
  | 'room-full'
  | 'server-full'
  | 'too-many-connections'
  | 'chat-rate'
  | 'rate-limit'
  | 'join-timeout';

/** What a pilot broadcasts about its glider. Angles in radians, speeds in m/s, brakes/collapse 0..1. */
export interface PeerState {
  x: number;
  y: number;
  z: number;
  heading: number;
  bank: number;
  pitch: number;
  brakeL: number;
  brakeR: number;
  collapse: number;
  airspeed: number;
  vz: number;
  /** Origin of the local frame x/y are expressed in. */
  lon0: number;
  lat0: number;
}

export const PEER_STATE_KEYS = ['x', 'y', 'z', 'heading', 'bank', 'pitch', 'brakeL', 'brakeR', 'collapse', 'airspeed', 'vz', 'lon0', 'lat0'] as const satisfies readonly (keyof PeerState)[];

export interface PeerInfo {
  id: string;
  name: string;
}

export type ClientMessage =
  | { t: 'join'; room: string; name: string }
  | { t: 'state'; s: PeerState }
  | { t: 'chat'; text: string }
  | { t: 'ping'; c: number };

export type ServerMessage =
  | { t: 'joined'; id: string; room: string; peers: PeerInfo[] }
  | { t: 'peer-join'; id: string; name: string }
  | { t: 'peer-leave'; id: string }
  | { t: 'state'; id: string; s: PeerState; at: number }
  | { t: 'chat'; id: string; name: string; text: string }
  | { t: 'pong'; c: number; at: number }
  | { t: 'error'; code: GameErrorCode; message: string };

/** Anything beyond ±10 000 km is not a position in a local frame. */
const COORD_LIMIT = 1e7;

// Control characters and line/paragraph separators become spaces; lone surrogates and private-use code points are dropped.
const SPACING = /[\p{Cc}\u2028\u2029]/gu;
const DROPPED = /[\p{Cs}\p{Co}]/gu;
// Invisible format characters (zero-width, bidi overrides…). Chat keeps the joiners that emoji and
// Persian/Indic scripts need.
const FORMAT_ALL = /\p{Cf}/gu;
const FORMAT_KEEP_JOINERS = /(?![‌‍])\p{Cf}/gu;

function clean(text: string, joiners: boolean): string {
  return text
    .replace(SPACING, ' ')
    .replace(DROPPED, '')
    .replace(joiners ? FORMAT_KEEP_JOINERS : FORMAT_ALL, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

const truncate = (text: string, max: number) => {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join('').trimEnd() : text;
};

/** Display name: no control or invisible characters, single spaces, at most 24 characters. */
export function cleanName(value: unknown): string | null {
  return typeof value === 'string' ? truncate(clean(value, false), MAX_NAME_LENGTH) : null;
}

/** Chat line: same cleaning as names; `null` when it is not a string, '' when nothing is left. */
export function cleanChat(value: unknown): string | null {
  return typeof value === 'string' ? clean(value, true) : null;
}

export const isRoomCode = (value: unknown): value is string => typeof value === 'string' && ROOM_CODE_PATTERN.test(value);

/** A fresh copy holding only the 13 state fields, or `null` if one is missing, not finite or absurd. */
export function readPeerState(value: unknown): PeerState | null {
  if (typeof value !== 'object' || value === null) return null;
  const src = value as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of PEER_STATE_KEYS) {
    const n = src[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > COORD_LIMIT) return null;
    out[key] = n;
  }
  if (Math.abs(out.lat0) > 90 || Math.abs(out.lon0) > 180) return null;
  return out as unknown as PeerState;
}

export type InvalidMessage = { t: 'invalid'; code: GameErrorCode };

function parseJson(text: string): Record<string, unknown> | null {
  if (text.length > MAX_MESSAGE_BYTES) return null;
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const invalid = (code: GameErrorCode = 'bad-message'): InvalidMessage => ({ t: 'invalid', code });

/** Parses and sanitises one client frame; never throws. */
export function parseClientMessage(text: string): ClientMessage | InvalidMessage {
  const m = parseJson(text);
  if (!m) return invalid();
  switch (m.t) {
    case 'join': {
      if (!isRoomCode(m.room)) return invalid('bad-room');
      const name = cleanName(m.name);
      return name === null ? invalid() : { t: 'join', room: m.room, name };
    }
    case 'state': {
      const s = readPeerState(m.s);
      return s ? { t: 'state', s } : invalid();
    }
    case 'chat': {
      const line = cleanChat(m.text);
      if (line === null || line === '') return invalid();
      return Array.from(line).length > MAX_CHAT_LENGTH ? invalid('too-long') : { t: 'chat', text: line };
    }
    case 'ping':
      return typeof m.c === 'number' && Number.isFinite(m.c) ? { t: 'ping', c: m.c } : invalid();
    default:
      return invalid();
  }
}

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 32;

/** Parses one server frame on the client side; `null` for anything this version does not understand. */
export function parseServerMessage(text: string): ServerMessage | null {
  const m = parseJson(text);
  if (!m) return null;
  switch (m.t) {
    case 'joined': {
      if (!isId(m.id) || !isRoomCode(m.room) || !Array.isArray(m.peers)) return null;
      const peers: PeerInfo[] = [];
      for (const p of m.peers as Record<string, unknown>[]) {
        const name = cleanName(p?.name);
        if (!isId(p?.id) || name === null) return null;
        peers.push({ id: p.id as string, name });
      }
      return { t: 'joined', id: m.id, room: m.room, peers };
    }
    case 'peer-join': {
      const name = cleanName(m.name);
      return isId(m.id) && name !== null ? { t: 'peer-join', id: m.id, name } : null;
    }
    case 'peer-leave':
      return isId(m.id) ? { t: 'peer-leave', id: m.id } : null;
    case 'state': {
      const s = readPeerState(m.s);
      return isId(m.id) && s && typeof m.at === 'number' && Number.isFinite(m.at) ? { t: 'state', id: m.id, s, at: m.at } : null;
    }
    case 'chat': {
      const name = cleanName(m.name);
      const line = cleanChat(m.text);
      return isId(m.id) && name !== null && line ? { t: 'chat', id: m.id, name, text: line } : null;
    }
    case 'pong':
      return typeof m.c === 'number' && typeof m.at === 'number' ? { t: 'pong', c: m.c, at: m.at } : null;
    case 'error':
      return typeof m.code === 'string' ? { t: 'error', code: m.code as GameErrorCode, message: typeof m.message === 'string' ? m.message.slice(0, 200) : '' } : null;
    default:
      return null;
  }
}
