/**
 * Multiplayer relay of the flight game: a WebSocket endpoint (`/api/game/ws`) that groups
 * 2–8 pilots in a room (a 4–12 character code both sides agree on) and forwards each
 * pilot's flight state, chat lines and arrivals/departures to the others. The relay
 * simulates nothing and stores nothing: rooms live in memory, vanish when their last
 * pilot leaves, and no message content or room code is ever logged.
 *
 * The wire format and its validation live in `@brises/shared` (`game-protocol.ts`), so
 * the client applies the very same checks to what it receives.
 *
 * Abuse limits, all configurable for the tests: 8 pilots per room, 200 rooms, 16 sockets
 * per address, frames of at most 2 KB, a token bucket of 20 messages/s per socket (the
 * socket is closed beyond it), 20 states/s kept per sender, a chat budget of 5 lines then
 * 2 per second, a 10 s window to send `join`, a ping every 15 s that a live peer answers.
 * Slow readers lose state frames instead of making the server buffer them.
 */
import { randomBytes } from 'node:crypto';
import websocket from '@fastify/websocket';
import { CLOSE_CODES, MAX_MESSAGE_BYTES, MAX_PEERS_PER_ROOM, parseClientMessage, type GameErrorCode, type ServerMessage } from '@brises/shared';
import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';

export interface RelayOptions {
  /** Route of the socket (the API mounts it under /api). */
  path?: string;
  maxPerRoom?: number;
  maxRooms?: number;
  /** Simultaneous sockets from one address. */
  maxPerIp?: number;
  /** Per-socket budget: sustained messages per second and burst size. */
  messagesPerSecond?: number;
  burst?: number;
  heartbeatMs?: number;
  /** Time a fresh socket has to send `join` before it is closed. */
  joinTimeoutMs?: number;
  /** Origins allowed to open a socket (the CORS list); `'*'` accepts any. Requests without Origin pass. */
  allowedOrigins?: string[] | '*';
}

export interface GameRelay {
  stats(): { rooms: number; clients: number };
}

/** Refilling budget: `take()` is false once more than `perSecond` events/s are sustained. */
class Bucket {
  private tokens: number;
  private at = performance.now();
  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
  ) {
    this.tokens = capacity;
  }
  take(now = performance.now()): boolean {
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.at) / 1000) * this.perSecond);
    this.at = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

interface Client {
  socket: WebSocket;
  ip: string;
  id: string;
  name: string;
  room: Room | null;
  alive: boolean;
  released: boolean;
  messages: Bucket;
  chats: Bucket;
  lastStateAt: number;
  joinTimer: ReturnType<typeof setTimeout> | null;
}

interface Room {
  code: string;
  members: Map<string, Client>;
}

const OPEN = 1;
/** Above this much queued output a reader is too slow for state frames (they are superseded anyway). */
const SOFT_BACKLOG = 64 * 1024;
/** Above this the socket is cut: it is not reading at all. */
const HARD_BACKLOG = 1024 * 1024;
/** Two states closer than this from one sender are one too many (clients send every 100 ms). */
const MIN_STATE_GAP_MS = 50;

const MESSAGES: Record<GameErrorCode, string> = {
  'bad-message': 'message not understood',
  'bad-room': 'the room code must be 4 to 12 letters or digits (A-Z, 0-9)',
  'too-long': 'chat line too long',
  'not-joined': 'join a room first',
  'already-joined': 'already in a room',
  'room-full': 'the room is full',
  'server-full': 'too many rooms are open, try again later',
  'too-many-connections': 'too many connections from this address',
  'chat-rate': 'chat too fast',
  'rate-limit': 'too many messages',
  'join-timeout': 'no join received',
};

export async function registerGameRelay(app: FastifyInstance, opts: RelayOptions = {}): Promise<GameRelay> {
  const path = opts.path ?? '/api/game/ws';
  const maxPerRoom = opts.maxPerRoom ?? MAX_PEERS_PER_ROOM;
  const maxRooms = opts.maxRooms ?? 200;
  const maxPerIp = opts.maxPerIp ?? 16;
  const messagesPerSecond = opts.messagesPerSecond ?? 20;
  const burst = opts.burst ?? 20;
  const allowed = opts.allowedOrigins ?? '*';

  const rooms = new Map<string, Room>();
  const clients = new Set<Client>();
  const perIp = new Map<string, number>();

  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) {
        c.socket.terminate();
        continue;
      }
      c.alive = false;
      try {
        c.socket.ping();
      } catch {
        c.socket.terminate();
      }
    }
  }, opts.heartbeatMs ?? 15_000);
  heartbeat.unref();

  // Registered before the websocket plugin so it runs first: pilots hear "going away" (1001, the
  // client reconnects) rather than the plugin's bare close frame.
  app.addHook('preClose', async () => {
    clearInterval(heartbeat);
    for (const c of clients) c.socket.close(CLOSE_CODES.goingAway, 'restart');
    setTimeout(() => {
      for (const c of clients) c.socket.terminate();
    }, 2000).unref();
  });

  await app.register(websocket, {
    options: { maxPayload: MAX_MESSAGE_BYTES },
    // Routine network noise (resets, oversized frames) must not fill the error log.
    errorHandler: (err, socket, req) => {
      req.log.debug({ code: (err as NodeJS.ErrnoException).code }, 'game socket error');
      socket.terminate();
    },
  });

  const send = (c: Client, msg: ServerMessage) => {
    if (c.socket.readyState === OPEN) c.socket.send(JSON.stringify(msg));
  };

  /** One serialisation for the whole room; `droppable` frames skip readers that fall behind. */
  const broadcast = (room: Room, msg: ServerMessage, except?: Client, droppable = false) => {
    const frame = JSON.stringify(msg);
    for (const peer of room.members.values()) {
      if (peer === except || peer.socket.readyState !== OPEN) continue;
      const queued = peer.socket.bufferedAmount;
      if (queued > HARD_BACKLOG) peer.socket.terminate();
      else if (!droppable || queued <= SOFT_BACKLOG) peer.socket.send(frame);
    }
  };

  /** Takes the client out of its room (once) and tells the others. */
  const leave = (c: Client) => {
    const room = c.room;
    if (!room) return;
    c.room = null;
    room.members.delete(c.id);
    if (room.members.size === 0) rooms.delete(room.code);
    else broadcast(room, { t: 'peer-leave', id: c.id });
  };

  /** Final bookkeeping when the socket is gone. */
  const release = (c: Client) => {
    if (c.released) return;
    c.released = true;
    if (c.joinTimer) clearTimeout(c.joinTimer);
    leave(c);
    clients.delete(c);
    const n = (perIp.get(c.ip) ?? 1) - 1;
    if (n <= 0) perIp.delete(c.ip);
    else perIp.set(c.ip, n);
  };

  /** Reports the problem, takes the client out of the room at once and closes the socket. */
  const fail = (c: Client, code: GameErrorCode, closeCode: number) => {
    leave(c);
    send(c, { t: 'error', code, message: MESSAGES[code] });
    c.socket.close(closeCode, code);
  };

  const uniqueId = (room: Room) => {
    let id: string;
    do id = randomBytes(6).toString('base64url');
    while (room.members.has(id));
    return id;
  };

  const join = (c: Client, code: string, name: string) => {
    let room = rooms.get(code);
    if (!room) {
      if (rooms.size >= maxRooms) return fail(c, 'server-full', CLOSE_CODES.serverFull);
      room = { code, members: new Map() };
    } else if (room.members.size >= maxPerRoom) {
      return fail(c, 'room-full', CLOSE_CODES.roomFull);
    }
    if (c.joinTimer) clearTimeout(c.joinTimer);
    c.joinTimer = null;
    c.id = uniqueId(room);
    c.name = name || `Pilot ${c.id.slice(0, 4)}`;
    const peers = [...room.members.values()].map((p) => ({ id: p.id, name: p.name }));
    rooms.set(code, room);
    room.members.set(c.id, c);
    c.room = room;
    send(c, { t: 'joined', id: c.id, room: code, peers });
    broadcast(room, { t: 'peer-join', id: c.id, name: c.name }, c);
  };

  const onMessage = (c: Client, data: RawData, isBinary: boolean) => {
    if (c.released) return;
    c.alive = true;
    const now = performance.now();
    if (!c.messages.take(now)) return fail(c, 'rate-limit', CLOSE_CODES.rateLimit);
    if (isBinary) return;
    const buf = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
    if (buf.length > MAX_MESSAGE_BYTES) return c.socket.close(CLOSE_CODES.tooBig, 'too big');

    const m = parseClientMessage(buf.toString('utf8'));
    if (m.t === 'ping') return send(c, { t: 'pong', c: m.c, at: Date.now() });

    const room = c.room;
    if (!room) {
      // Before `join` nothing else is acceptable: a client that does not know the protocol is let go.
      if (m.t === 'join') return join(c, m.room, m.name);
      return fail(c, m.t === 'invalid' ? m.code : 'not-joined', CLOSE_CODES.badJoin);
    }
    switch (m.t) {
      case 'state':
        if (now - c.lastStateAt < MIN_STATE_GAP_MS) return;
        c.lastStateAt = now;
        return broadcast(room, { t: 'state', id: c.id, s: m.s, at: Date.now() }, c, true);
      case 'chat':
        if (!c.chats.take(now)) return send(c, { t: 'error', code: 'chat-rate', message: MESSAGES['chat-rate'] });
        // The sender gets its own line back: one source of truth for what everybody reads, in order.
        return broadcast(room, { t: 'chat', id: c.id, name: c.name, text: m.text });
      case 'join':
        return send(c, { t: 'error', code: 'already-joined', message: MESSAGES['already-joined'] });
      case 'invalid':
        return send(c, { t: 'error', code: m.code, message: MESSAGES[m.code] });
    }
  };

  const accept = (socket: WebSocket, ip: string) => {
    const open = perIp.get(ip) ?? 0;
    if (open >= maxPerIp) {
      socket.send(JSON.stringify({ t: 'error', code: 'too-many-connections', message: MESSAGES['too-many-connections'] } satisfies ServerMessage));
      socket.close(CLOSE_CODES.tooManyConnections, 'too many connections');
      return;
    }
    perIp.set(ip, open + 1);
    const c: Client = {
      socket,
      ip,
      id: '',
      name: '',
      room: null,
      alive: true,
      released: false,
      messages: new Bucket(burst, messagesPerSecond),
      chats: new Bucket(5, 2),
      lastStateAt: -Infinity,
      joinTimer: null,
    };
    clients.add(c);
    c.joinTimer = setTimeout(() => fail(c, 'join-timeout', CLOSE_CODES.joinTimeout), opts.joinTimeoutMs ?? 10_000);
    c.joinTimer.unref();
    socket.on('pong', () => (c.alive = true));
    socket.on('message', (data, isBinary) => onMessage(c, data, isBinary));
    socket.on('close', () => release(c));
  };

  app.get(
    path,
    {
      websocket: true,
      // Browsers always state their origin; refuse the ones the deployment does not list (same list as CORS).
      onRequest: async (req, reply) => {
        const origin = req.headers.origin;
        if (origin && allowed !== '*' && !allowed.includes(origin)) return reply.code(403).send({ error: 'origin not allowed' });
      },
    },
    (socket, req) => accept(socket, req.ip),
  );

  return { stats: () => ({ rooms: rooms.size, clients: clients.size }) };
}
