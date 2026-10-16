/**
 * The multiplayer relay, tested over real sockets: a bare Fastify instance with only the relay
 * (no database) listening on an ephemeral port, 2–9 `ws` clients, and once the complete app
 * (every plugin, in-memory database) to prove the route is mounted and survives their hooks.
 */
import type { AddressInfo } from 'node:net';
import { CLOSE_CODES, MAX_CHAT_LENGTH, MAX_MESSAGE_BYTES, MAX_NAME_LENGTH } from '@brises/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket, { type ClientOptions } from 'ws';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createDb } from '../src/db/client';
import { migrate } from '../src/db/migrate';
import { registerGameRelay, type RelayOptions } from '../src/routes/game';

interface Msg {
  t: string;
  id?: string;
  name?: string;
  text?: string;
  room?: string;
  code?: string;
  message?: string;
  peers?: { id: string; name: string }[];
  s?: Record<string, number>;
  at?: number;
  c?: number;
}

const STATE = { x: 120.5, y: -80, z: 1850, heading: 1.2, bank: 0.15, pitch: -0.05, brakeL: 0.1, brakeR: 0.3, collapse: 0, airspeed: 10.4, vz: -1.2, lon0: 6.1, lat0: 45.2 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isType = (t: string) => (m: Msg) => m.t === t;

async function until(cond: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('condition not met in time');
    await sleep(10);
  }
}

/** A socket with an inbox: `next` takes the first message matching a predicate, waiting if needed. */
class Client {
  readonly inbox: Msg[] = [];
  readonly closed: Promise<{ code: number; reason: string }>;
  id = '';
  private waiters: { pred: (m: Msg) => boolean; resolve: (m: Msg) => void }[] = [];

  private constructor(readonly ws: WebSocket) {
    ws.on('error', () => {});
    ws.on('message', (data, binary) => {
      if (binary) return;
      this.inbox.push(JSON.parse(data.toString()) as Msg);
      for (const w of [...this.waiters]) {
        const i = this.inbox.findIndex(w.pred);
        if (i < 0) continue;
        this.waiters.splice(this.waiters.indexOf(w), 1);
        w.resolve(this.inbox.splice(i, 1)[0]);
      }
    });
    this.closed = new Promise((resolve) => ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() })));
  }

  static open(url: string, opts?: ClientOptions): Promise<Client> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, opts);
      const c = new Client(ws);
      ws.once('open', () => resolve(c));
      ws.once('error', reject);
      clients.push(c);
    });
  }

  send(x: unknown): void {
    this.ws.send(typeof x === 'string' ? x : JSON.stringify(x));
  }

  next(pred: (m: Msg) => boolean = () => true, ms = 2000): Promise<Msg> {
    const i = this.inbox.findIndex(pred);
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no matching message in time')), ms);
      this.waiters.push({
        pred,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
    });
  }

  /** Waits a little and checks nothing matching arrived. */
  async none(pred: (m: Msg) => boolean, ms = 150): Promise<void> {
    await sleep(ms);
    expect(this.inbox.filter(pred)).toEqual([]);
  }

  /** Everything matching that arrives within `ms`. */
  async collect(pred: (m: Msg) => boolean, ms = 300): Promise<Msg[]> {
    await sleep(ms);
    return this.inbox.splice(0).filter(pred);
  }
}

const clients: Client[] = [];
const apps: { close(): Promise<unknown> }[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) c.ws.terminate();
  await Promise.all(apps.splice(0).map((a) => a.close().catch(() => {})));
});

async function start(opts: RelayOptions = {}, logger: FastifyServerOptions['logger'] = false) {
  const app = Fastify({ logger });
  const relay = await registerGameRelay(app, opts);
  await app.listen({ port: 0, host: '127.0.0.1' });
  apps.push(app);
  return { app, relay, url: `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/game/ws` };
}

async function join(url: string, room: string, name: string): Promise<Client> {
  const c = await Client.open(url);
  c.send({ t: 'join', room, name });
  const joined = await c.next(isType('joined'));
  c.id = joined.id!;
  return c;
}

describe('rooms', () => {
  it('puts pilots in a room and announces the newcomers', async () => {
    const { url } = await start();
    const alice = await Client.open(url);
    alice.send({ t: 'join', room: 'ALPS01', name: 'Alice' });
    const first = await alice.next(isType('joined'));
    expect(first).toMatchObject({ t: 'joined', room: 'ALPS01', peers: [] });
    alice.id = first.id!;

    const bob = await Client.open(url);
    bob.send({ t: 'join', room: 'ALPS01', name: 'Bob' });
    const second = await bob.next(isType('joined'));
    expect(second.peers).toEqual([{ id: alice.id, name: 'Alice' }]);
    bob.id = second.id!;

    expect(bob.id).not.toBe(alice.id);
    expect(await alice.next(isType('peer-join'))).toEqual({ t: 'peer-join', id: bob.id, name: 'Bob' });
    await bob.none(isType('peer-join'));
  });

  it('keeps rooms apart', async () => {
    const { url } = await start();
    const a = await join(url, 'ROOMAA', 'A');
    const b = await join(url, 'ROOMAA', 'B');
    const c = await join(url, 'ROOMBB', 'C');
    a.send({ t: 'state', s: STATE });
    a.send({ t: 'chat', text: 'hello' });
    await b.next(isType('state'));
    await c.none((m) => m.t !== 'joined', 200);
  });

  it('announces departures and forgets empty rooms', async () => {
    const { url, relay } = await start();
    const a = await join(url, 'LEAVE1', 'A');
    const b = await join(url, 'LEAVE1', 'B');
    expect(relay.stats()).toEqual({ rooms: 1, clients: 2 });
    b.ws.close();
    expect(await a.next(isType('peer-leave'))).toEqual({ t: 'peer-leave', id: b.id });
    await until(() => relay.stats().clients === 1);
    expect(relay.stats().rooms).toBe(1);
    a.ws.close();
    await until(() => relay.stats().rooms === 0);
    expect(relay.stats()).toEqual({ rooms: 0, clients: 0 });
  });

  it('refuses a ninth pilot and takes one again when somebody leaves', async () => {
    const { url, relay } = await start();
    const pilots: Client[] = [];
    for (let i = 0; i < 8; i++) pilots.push(await join(url, 'FULL01', `P${i}`));
    for (const p of pilots.slice(0, 7)) expect((await p.collect(isType('peer-join'), 50)).length).toBeGreaterThan(0);

    const ninth = await Client.open(url);
    ninth.send({ t: 'join', room: 'FULL01', name: 'Late' });
    expect(await ninth.next(isType('error'))).toMatchObject({ code: 'room-full' });
    expect((await ninth.closed).code).toBe(CLOSE_CODES.roomFull);
    await until(() => relay.stats().clients === 8);
    await pilots[0].none(isType('peer-join'));

    pilots[7].ws.close();
    await until(() => relay.stats().clients === 7);
    const again = await join(url, 'FULL01', 'Retry');
    expect(again.id).toBeTruthy();
  });

  it('stops creating rooms beyond the limit but lets existing ones fill', async () => {
    const { url, relay } = await start({ maxRooms: 2 });
    await join(url, 'ROOM01', 'A');
    const b = await join(url, 'ROOM02', 'B');
    const third = await Client.open(url);
    third.send({ t: 'join', room: 'ROOM03', name: 'C' });
    expect(await third.next(isType('error'))).toMatchObject({ code: 'server-full' });
    expect((await third.closed).code).toBe(CLOSE_CODES.serverFull);

    await join(url, 'ROOM01', 'A2');
    b.ws.close();
    await until(() => relay.stats().rooms === 1);
    await join(url, 'ROOM03', 'C2');
    expect(relay.stats().rooms).toBe(2);
  });

  it('limits the sockets of one address', async () => {
    const { url, relay } = await start({ maxPerIp: 2 });
    const a = await join(url, 'IPLIM1', 'A');
    await Client.open(url);
    const third = await Client.open(url);
    expect(await third.next(isType('error'))).toMatchObject({ code: 'too-many-connections' });
    expect((await third.closed).code).toBe(CLOSE_CODES.tooManyConnections);
    await sleep(50);
    expect(relay.stats().clients).toBe(2);
    a.ws.close();
    await until(() => relay.stats().clients === 1);
    const fourth = await join(url, 'IPLIM1', 'D');
    expect(fourth.id).toBeTruthy();
  });
});

describe('what is relayed', () => {
  it('forwards states to the others only, stamped by the server, with the 13 fields', async () => {
    const { url } = await start();
    const a = await join(url, 'STATE1', 'A');
    const b = await join(url, 'STATE1', 'B');
    const c = await join(url, 'STATE1', 'C');
    const before = Date.now();
    a.send({ t: 'state', s: { ...STATE, wing: { huge: 'x'.repeat(500) }, extra: 1 } });
    for (const peer of [b, c]) {
      const m = await peer.next(isType('state'));
      expect(m).toMatchObject({ t: 'state', id: a.id, s: STATE });
      expect(Object.keys(m.s!)).toHaveLength(13);
      expect(m.at!).toBeGreaterThanOrEqual(before);
      expect(m.at!).toBeLessThanOrEqual(Date.now());
    }
    await a.none(isType('state'));
  });

  it('keeps at most ~20 states per second from one sender', async () => {
    const { url } = await start();
    const a = await join(url, 'RATE01', 'A');
    const b = await join(url, 'RATE01', 'B');
    a.send({ t: 'state', s: STATE });
    a.send({ t: 'state', s: { ...STATE, x: 1 } });
    a.send({ t: 'state', s: { ...STATE, x: 2 } });
    expect((await b.collect(isType('state'), 150)).map((m) => m.s!.x)).toEqual([STATE.x]);
    a.send({ t: 'state', s: { ...STATE, x: 3 } });
    expect((await b.next(isType('state'))).s!.x).toBe(3);
  });

  it('broadcasts chat to everybody, sender included, cleaned', async () => {
    const { url } = await start();
    const a = await join(url, 'CHAT01', 'Alice');
    const b = await join(url, 'CHAT01', 'Bob');
    a.send({ t: 'chat', text: '  salut\u0007 tout\nle monde‮  ' });
    const expected = { t: 'chat', id: a.id, name: 'Alice', text: 'salut tout le monde' };
    expect(await b.next(isType('chat'))).toEqual(expected);
    expect(await a.next(isType('chat'))).toEqual(expected);
  });

  it('slows down a chat flood without disconnecting', async () => {
    const { url } = await start();
    const a = await join(url, 'CHAT02', 'A');
    const b = await join(url, 'CHAT02', 'B');
    for (let i = 0; i < 12; i++) a.send({ t: 'chat', text: `line ${i}` });
    const received = await b.collect(isType('chat'), 300);
    expect(received.length).toBeGreaterThanOrEqual(5);
    expect(received.length).toBeLessThan(12);
    expect((await a.collect(isType('error'), 10)).some((m) => m.code === 'chat-rate')).toBe(true);
    expect(a.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('answers pings with the server time, before and after joining', async () => {
    const { url } = await start();
    const c = await Client.open(url);
    c.send({ t: 'ping', c: 42 });
    const pong = await c.next(isType('pong'));
    expect(pong.c).toBe(42);
    expect(Math.abs(pong.at! - Date.now())).toBeLessThan(2000);
    c.send({ t: 'join', room: 'PING01', name: 'P' });
    await c.next(isType('joined'));
    c.send({ t: 'ping', c: 43 });
    expect((await c.next(isType('pong'))).c).toBe(43);
  });
});

describe('names', () => {
  it('cleans, cuts and defaults them', async () => {
    const { url } = await start();
    const watcher = await join(url, 'NAME01', 'Watcher');
    await join(url, 'NAME01', '  Jean\u0007‮  Dupont ');
    expect((await watcher.next(isType('peer-join'))).name).toBe('Jean Dupont');
    await join(url, 'NAME01', 'x'.repeat(100));
    expect((await watcher.next(isType('peer-join'))).name).toHaveLength(MAX_NAME_LENGTH);
    await join(url, 'NAME01', ' \u0007​ ');
    expect((await watcher.next(isType('peer-join'))).name).toMatch(/^Pilot \S{4}$/);
  });
});

describe('bad input', () => {
  it('lets go of a client that does not start with a valid join', async () => {
    const { url, relay } = await start();
    const cases: [unknown, string][] = [
      [{ t: 'join', room: 'abc', name: 'x' }, 'bad-room'],
      [{ t: 'join', room: 'alps01', name: 'x' }, 'bad-room'],
      [{ t: 'join', room: 'ABCDEFGHIJKLM', name: 'x' }, 'bad-room'],
      [{ t: 'join', room: 'ALPS01', name: 5 }, 'bad-message'],
      [{ t: 'state', s: STATE }, 'not-joined'],
      [{ t: 'chat', text: 'hi' }, 'not-joined'],
      ['garbage', 'bad-message'],
    ];
    for (const [frame, code] of cases) {
      const c = await Client.open(url);
      c.send(frame);
      expect(await c.next(isType('error'))).toMatchObject({ code });
      expect((await c.closed).code).toBe(CLOSE_CODES.badJoin);
    }
    await until(() => relay.stats().clients === 0);
    expect(relay.stats().rooms).toBe(0);
  });

  it('answers a malformed message with an error and carries on', async () => {
    const { url } = await start();
    const a = await join(url, 'BAD001', 'A');
    const b = await join(url, 'BAD001', 'B');
    const hugeNumber = JSON.stringify({ t: 'state', s: STATE }).replace('"x":120.5', '"x":1e999');
    const frames: [unknown, string][] = [
      ['not json', 'bad-message'],
      ['[1,2]', 'bad-message'],
      ['"text"', 'bad-message'],
      [{ t: 'warp' }, 'bad-message'],
      [{ t: 'state', s: { x: 1 } }, 'bad-message'],
      [{ t: 'state', s: { ...STATE, vz: 'fast' } }, 'bad-message'],
      [hugeNumber, 'bad-message'],
      [{ t: 'chat', text: '   ' }, 'bad-message'],
      [{ t: 'chat', text: 'x'.repeat(MAX_CHAT_LENGTH + 1) }, 'too-long'],
      [{ t: 'join', room: 'OTHER1', name: 'A' }, 'already-joined'],
    ];
    for (const [frame] of frames) a.send(frame);
    a.ws.send(Buffer.from([1, 2, 3]));
    const errors = await a.collect(isType('error'), 300);
    expect(errors.map((m) => m.code)).toEqual(frames.map(([, code]) => code));

    a.send({ t: 'chat', text: 'still here' });
    expect((await b.next(isType('chat'))).text).toBe('still here');
    expect(a.ws.readyState).toBe(WebSocket.OPEN);
    await b.none((m) => m.t === 'state' || m.t === 'peer-leave');
  });

  it('accepts a chat line of exactly 200 characters', async () => {
    const { url } = await start();
    const a = await join(url, 'BAD002', 'A');
    const b = await join(url, 'BAD002', 'B');
    a.send({ t: 'chat', text: 'é'.repeat(MAX_CHAT_LENGTH) });
    expect((await b.next(isType('chat'))).text).toHaveLength(MAX_CHAT_LENGTH);
  });

  it('closes a socket that sends an oversized frame', async () => {
    const { url, relay } = await start();
    const a = await join(url, 'BIG001', 'A');
    const b = await join(url, 'BIG001', 'B');
    a.ws.send(JSON.stringify({ t: 'chat', text: 'x', pad: 'y'.repeat(MAX_MESSAGE_BYTES) }));
    expect((await a.closed).code).toBe(CLOSE_CODES.tooBig);
    expect(await b.next(isType('peer-leave'))).toEqual({ t: 'peer-leave', id: a.id });
    await until(() => relay.stats().clients === 1);
  });

  it('closes a socket that floods, and tolerates a normal burst', async () => {
    const { url } = await start();
    const polite = await join(url, 'FLOOD1', 'Polite');
    for (let i = 0; i < 15; i++) polite.send({ t: 'ping', c: i });
    expect((await polite.collect(isType('pong'), 200)).length).toBe(15);
    expect(polite.ws.readyState).toBe(WebSocket.OPEN);

    const rude = await join(url, 'FLOOD1', 'Rude');
    for (let i = 0; i < 100; i++) rude.send({ t: 'ping', c: i });
    expect((await rude.closed).code).toBe(CLOSE_CODES.rateLimit);
    expect(await polite.next(isType('peer-leave'))).toEqual({ t: 'peer-leave', id: rude.id });
  });
});

describe('liveness', () => {
  it('closes sockets that stop answering pings and keeps the others', async () => {
    const { url, relay } = await start({ heartbeatMs: 60 });
    const alive = await join(url, 'BEAT01', 'Alive');
    const dead = await Client.open(url, { autoPong: false });
    dead.send({ t: 'join', room: 'BEAT01', name: 'Dead' });
    dead.id = (await dead.next(isType('joined'))).id!;

    expect((await dead.closed).code).toBe(1006);
    expect(await alive.next(isType('peer-leave'))).toEqual({ t: 'peer-leave', id: dead.id });
    await until(() => relay.stats().clients === 1);
    await sleep(250);
    expect(alive.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('closes sockets that never join, not the ones that do', async () => {
    const { url, relay } = await start({ joinTimeoutMs: 100 });
    const silent = await Client.open(url);
    const prompt = await join(url, 'LATE01', 'Prompt');
    expect(await silent.next(isType('error'))).toMatchObject({ code: 'join-timeout' });
    expect((await silent.closed).code).toBe(CLOSE_CODES.joinTimeout);
    await sleep(150);
    expect(prompt.ws.readyState).toBe(WebSocket.OPEN);
    expect(relay.stats().clients).toBe(1);
  });

  it('tells the pilots the server is going away when it shuts down', async () => {
    const { app, url } = await start();
    const pilot = await join(url, 'DOWN01', 'Pilot');
    await app.close();
    expect((await pilot.closed).code).toBe(CLOSE_CODES.goingAway);
  });
});

describe('origin', () => {
  it('only admits listed origins when a list is configured', async () => {
    const { url } = await start({ allowedOrigins: ['https://jeu.example'] });
    const ok = await Client.open(url, { origin: 'https://jeu.example' });
    ok.send({ t: 'ping', c: 1 });
    await ok.next(isType('pong'));
    await expect(Client.open(url, { origin: 'https://evil.example' })).rejects.toThrow(/403/);
    const noOrigin = await Client.open(url);
    noOrigin.send({ t: 'ping', c: 2 });
    await noOrigin.next(isType('pong'));
  });
});

describe('privacy', () => {
  it('logs neither what is said nor the rooms and names', async () => {
    const lines: string[] = [];
    const { url } = await start({}, { level: 'trace', stream: { write: (line: string) => void lines.push(line) } });
    const a = await join(url, 'LOGROOM7', 'LogNameAlice');
    const b = await join(url, 'LOGROOM7', 'LogNameBob');
    a.send({ t: 'chat', text: 'SECRET-CHAT-MARKER' });
    a.send({ t: 'state', s: { ...STATE, x: 987654.321 } });
    await b.next(isType('chat'));
    await b.next(isType('state'));
    a.send('{"t":"chat","text":"SECRET-BAD-JSON');
    a.ws.close();
    await b.next(isType('peer-leave'));
    const log = lines.join('');
    expect(log.length).toBeGreaterThan(0);
    for (const secret of ['SECRET-CHAT-MARKER', 'SECRET-BAD-JSON', '987654', 'LOGROOM7', 'LogNameAlice', 'LogNameBob']) expect(log).not.toContain(secret);
  });
});

describe('inside the complete app', () => {
  it('is mounted under /api next to the JSON routes and obeys the CORS list', async () => {
    const db = await createDb('pglite:memory');
    try {
      await migrate(db);
      const config = { ...loadConfig({}), logLevel: 'silent', corsOrigin: ['https://jeu.example'] };
      const { app } = await buildApp(config, db);
      apps.push(app);
      await app.listen({ port: 0, host: '127.0.0.1' });
      const base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;

      expect((await app.inject('/api/health')).statusCode).toBe(200);
      expect((await app.inject('/api/game/ws')).statusCode).toBe(404);

      const open = { origin: 'https://jeu.example' };
      const a = await Client.open(`ws://${base}/api/game/ws`, open);
      a.send({ t: 'join', room: 'APP001', name: 'A' });
      await a.next(isType('joined'));
      const b = await Client.open(`ws://${base}/api/game/ws`, open);
      b.send({ t: 'join', room: 'APP001', name: 'B' });
      await b.next(isType('joined'));
      a.send({ t: 'state', s: STATE });
      expect(await b.next(isType('state'))).toMatchObject({ s: STATE });
      b.send({ t: 'chat', text: 'bonjour' });
      expect(await a.next(isType('chat'))).toMatchObject({ name: 'B', text: 'bonjour' });

      await expect(Client.open(`ws://${base}/api/game/ws`, { origin: 'https://evil.example' })).rejects.toThrow(/403/);
      // Upgrading any other path is not a way in: the socket is closed.
      const stray = await Client.open(`ws://${base}/api/health`);
      expect((await stray.closed).code).toBeDefined();
    } finally {
      for (const c of clients.splice(0)) c.ws.terminate();
      await Promise.all(apps.splice(0).map((a) => a.close().catch(() => {})));
      await db.close();
    }
  });
});
