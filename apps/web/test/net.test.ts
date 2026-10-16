/**
 * The multiplayer client. Timing logic (interpolation clock, throttling, heartbeat, backoff) runs
 * against a scripted fake WebSocket under fake timers; the rest against the real relay of the API
 * on an ephemeral port, through Node's own WebSocket.
 */
import type { AddressInfo } from 'node:net';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerGameRelay, type RelayOptions } from '../../api/src/routes/game';
import { gameSocketUrl, Multiplayer, normalizeRoomCode, randomRoomCode, SnapshotBuffer, type NetEvent, type PeerState } from '../src/game/net';

const S: PeerState = { x: 0, y: 0, z: 1500, heading: 1, bank: 0, pitch: 0, brakeL: 0, brakeR: 0, collapse: 0, airspeed: 10, vz: -1, lon0: 6, lat0: 45 };
const at = (x: number, extra: Partial<PeerState> = {}): PeerState => ({ ...S, x, ...extra });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('addresses and room codes', () => {
  it('turns the API base into a ws(s) address resolved like the API calls', () => {
    expect(gameSocketUrl('/api', 'https://carte.example.org/jeu/')).toBe('wss://carte.example.org/api/game/ws');
    expect(gameSocketUrl('/api', 'http://localhost:5174/')).toBe('ws://localhost:5174/api/game/ws');
    expect(gameSocketUrl('https://api.example.com/v1', 'http://localhost/')).toBe('wss://api.example.com/v1/game/ws');
    expect(gameSocketUrl('api', 'https://carte.example.org/jeu/')).toBe('wss://carte.example.org/jeu/api/game/ws');
  });

  it('normalises typed codes and draws readable random ones', () => {
    expect(normalizeRoomCode(' ab-12 cd ')).toBe('AB12CD');
    for (let i = 0; i < 50; i++) expect(randomRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(randomRoomCode(12)).toHaveLength(12);
  });
});

describe('SnapshotBuffer', () => {
  it('answers null when empty and the only snapshot when alone', () => {
    const b = new SnapshotBuffer();
    expect(b.sample(1000)).toBeNull();
    b.push(1000, at(7));
    expect(b.sample(5000)).toEqual(at(7));
  });

  it('blends the two snapshots around the instant', () => {
    const b = new SnapshotBuffer();
    b.push(1000, at(0, { z: 1000, bank: -0.2, airspeed: 8 }));
    b.push(1100, at(10, { z: 1010, bank: 0.2, airspeed: 12 }));
    b.push(1200, at(30));
    const m = b.sample(1050)!;
    expect(m.x).toBeCloseTo(5);
    expect(m.z).toBeCloseTo(1005);
    expect(m.bank).toBeCloseTo(0);
    expect(m.airspeed).toBeCloseTo(10);
    expect(b.sample(1150)!.x).toBeCloseTo(20);
    expect(b.sample(900)!.x).toBe(0);
  });

  it('turns the heading the short way round', () => {
    const b = new SnapshotBuffer();
    b.push(0, at(0, { heading: 0.1 }));
    b.push(100, at(0, { heading: 2 * Math.PI - 0.1 }));
    const h = b.sample(50)!.heading;
    expect(Math.abs(Math.sin(h))).toBeLessThan(1e-9);
    expect(Math.cos(h)).toBeGreaterThan(0.99);
  });

  it('carries the position on at the last velocity for 250 ms, then holds', () => {
    const b = new SnapshotBuffer();
    b.push(1000, at(0));
    b.push(1100, at(10));
    expect(b.sample(1150)!.x).toBeCloseTo(15);
    expect(b.sample(1350)!.x).toBeCloseTo(35);
    expect(b.sample(9000)!.x).toBeCloseTo(35);
    // The other fields are held, not extrapolated.
    expect(b.sample(1200)!.heading).toBe(S.heading);
  });

  it('does not extrapolate from snapshots too far apart, nor blend across two local frames', () => {
    const slow = new SnapshotBuffer();
    slow.push(0, at(0));
    slow.push(2000, at(100));
    expect(slow.sample(2100)!.x).toBe(100);

    const moved = new SnapshotBuffer();
    moved.push(1000, at(5, { lon0: 6, lat0: 45 }));
    moved.push(1100, at(900, { lon0: 7, lat0: 46 }));
    expect(moved.sample(1030)).toMatchObject({ x: 5, lon0: 6 });
    expect(moved.sample(1070)).toMatchObject({ x: 900, lon0: 7 });
  });

  it('keeps the order if the clock steps back and bounds its memory', () => {
    const b = new SnapshotBuffer();
    b.push(1000, at(1));
    b.push(900, at(2));
    expect(b.sample(1001)!.x).toBe(2);
    for (let i = 0; i < 100; i++) b.push(2000 + i * 100, at(i));
    expect(b.length).toBe(40);
  });
});

/** Scripted stand-in for the browser's WebSocket: nothing happens until the test says so. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static last = () => FakeSocket.instances[FakeSocket.instances.length - 1];
  readyState = 0;
  bufferedAmount = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  frames() {
    return this.sent.map((s) => JSON.parse(s) as { t: string; [k: string]: unknown });
  }
}

const label = (e: NetEvent) => (e.type === 'status' ? `status:${e.status}` : e.type === 'error' ? `error:${e.code}:${e.fatal}` : e.type === 'joined' ? `joined:${e.id}:${e.reconnected}` : `${e.type}:${'id' in e ? e.id : ''}`);

describe('Multiplayer against a scripted socket', () => {
  beforeEach(() => {
    FakeSocket.instances.length = 0;
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.useFakeTimers();
    vi.setSystemTime(5000);
    // Full backoff delays, so they can be asserted exactly.
    vi.spyOn(Math, 'random').mockReturnValue(1);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function setup() {
    const m = new Multiplayer({ url: 'ws://fake/api/game/ws', room: 'room01', name: 'Me', now: () => Date.now() });
    const events: NetEvent[] = [];
    m.onEvent((e) => events.push(e));
    return { m, events };
  }

  async function joined(m: Multiplayer, peers: { id: string; name: string }[] = [], id = 'me1') {
    const p = m.connect();
    const sock = FakeSocket.last();
    sock.open();
    sock.receive({ t: 'joined', id, room: 'ROOM01', peers });
    await p;
    return sock;
  }

  it('joins with the normalised room and the name, and reports the room', async () => {
    const { m, events } = setup();
    const sock = await joined(m, [{ id: 'p1', name: 'Pat' }]);
    expect(sock.frames()[0]).toEqual({ t: 'join', room: 'ROOM01', name: 'Me' });
    expect(m.id).toBe('me1');
    expect(m.status).toBe('open');
    expect([...m.peers().keys()]).toEqual(['p1']);
    expect(events.map(label)).toEqual(['status:connecting', 'status:open', 'joined:me1:false', 'peer-join:p1']);
    m.close();
  });

  it('samples peers 150 ms in the past on the server clock', async () => {
    const { m } = setup();
    const sock = await joined(m, [{ id: 'p1', name: 'Pat' }]);
    expect(m.sample('p1', 5000)).toBeNull();
    // Server clock 4000 ms behind the local one (that includes the latency of the fastest packet).
    for (const [local, server, x] of [[5000, 1000, 0], [5100, 1100, 10], [5200, 1200, 20]] as const) {
      vi.setSystemTime(local);
      sock.receive({ t: 'state', id: 'p1', s: at(x), at: server });
    }
    expect(m.sample('p1', 5200)!.x).toBeCloseTo(5);
    expect(m.sample('p1', 5330)!.x).toBeCloseTo(18);
    expect(m.sample('p1', 5700)!.x).toBeCloseTo(45);
    expect(m.sample('nobody', 5200)).toBeNull();
    expect(m.peers().get('p1')).toMatchObject({ name: 'Pat', state: at(20), updatedAt: 5200 });
    // A packet that was faster than any before moves the offset at once.
    vi.setSystemTime(5290);
    sock.receive({ t: 'state', id: 'p1', s: at(30), at: 1300 });
    expect(m.sample('p1', 5440)!.x).toBeCloseTo(30);
    m.close();
  });

  it('ignores the state of a pilot it was not told about', async () => {
    const { m } = setup();
    const sock = await joined(m);
    sock.receive({ t: 'state', id: 'ghost', s: S, at: 1 });
    expect(m.peers().size).toBe(0);
    expect(m.sample('ghost', 5000)).toBeNull();
    m.close();
  });

  it('sends at most 10 states a second and only the 13 fields', async () => {
    const { m } = setup();
    const sock = await joined(m);
    const states = () => sock.frames().filter((f) => f.t === 'state');
    for (const t of [1000, 1050, 1094, 1095, 1100, 1190, 1200]) {
      vi.setSystemTime(t);
      m.sendState({ ...S, x: t, wing: { big: 'object' } } as PeerState);
    }
    expect(states().map((f) => (f.s as PeerState).x)).toEqual([1000, 1095, 1190]);
    expect(Object.keys(states()[0].s as object)).toHaveLength(13);

    vi.setSystemTime(2000);
    m.sendState({ ...S, x: NaN });
    expect(states()).toHaveLength(3);
    vi.setSystemTime(2001);
    m.sendState(S);
    expect(states()).toHaveLength(4);
    m.close();
  });

  it('sends nothing before the join or after close', async () => {
    const { m } = setup();
    m.sendState(S);
    m.sendChat('hello');
    const p = m.connect();
    const sock = FakeSocket.last();
    sock.open();
    m.sendState(S);
    m.sendChat('hello');
    expect(sock.frames().map((f) => f.t)).toEqual(['join']);
    sock.receive({ t: 'joined', id: 'me1', room: 'ROOM01', peers: [] });
    await p;
    m.close();
    vi.setSystemTime(9000);
    m.sendState(S);
    m.sendChat('bye');
    expect(sock.frames().map((f) => f.t)).toEqual(['join', 'ping']);
  });

  it('cleans and cuts chat lines, and flags its own in the echo', async () => {
    const { m, events } = setup();
    const sock = await joined(m);
    m.sendChat('  salut\u0007\n tout le monde ');
    m.sendChat('a'.repeat(300));
    m.sendChat('   ');
    const chats = sock.frames().filter((f) => f.t === 'chat');
    expect(chats[0]).toEqual({ t: 'chat', text: 'salut tout le monde' });
    expect((chats[1].text as string).length).toBe(200);
    expect(chats).toHaveLength(2);

    vi.setSystemTime(6000);
    sock.receive({ t: 'chat', id: 'me1', name: 'Me', text: 'salut' });
    sock.receive({ t: 'chat', id: 'p9', name: 'Pat', text: 'hello' });
    const lines = events.filter((e) => e.type === 'chat');
    expect(lines).toEqual([
      { type: 'chat', id: 'me1', name: 'Me', text: 'salut', self: true, at: 6000 },
      { type: 'chat', id: 'p9', name: 'Pat', text: 'hello', self: false, at: 6000 },
    ]);
    m.close();
  });

  it('forgets a pilot that leaves and survives garbage frames', async () => {
    const { m, events } = setup();
    const sock = await joined(m, [{ id: 'p1', name: 'Pat' }]);
    sock.receive({ t: 'peer-join', id: 'p2', name: 'Max' });
    sock.onmessage?.({ data: 'not json' });
    sock.onmessage?.({ data: new ArrayBuffer(4) });
    sock.receive({ t: 'state', id: 'p1', s: { x: 'nope' }, at: 1 });
    sock.receive({ t: 'peer-leave', id: 'p1' });
    expect([...m.peers().keys()]).toEqual(['p2']);
    expect(m.sample('p1', 5000)).toBeNull();
    expect(events.map(label).slice(-3)).toEqual(['peer-join:p1', 'peer-join:p2', 'peer-leave:p1']);
    m.close();
  });

  it('reconnects with a growing delay, then reconciles the room', async () => {
    const { m, events } = setup();
    const first = await joined(m, [{ id: 'p1', name: 'Pat' }, { id: 'p2', name: 'Max' }]);
    events.length = 0;
    first.drop(1006);
    expect(m.status).toBe('reconnecting');
    // The pilots stay on screen (frozen) while the link is down.
    expect(m.peers().size).toBe(2);

    vi.advanceTimersByTime(499);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.last().drop(1006); // the server is still down
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);

    const third = FakeSocket.last();
    third.open();
    expect(third.frames()[0]).toEqual({ t: 'join', room: 'ROOM01', name: 'Me' });
    third.receive({ t: 'joined', id: 'me2', room: 'ROOM01', peers: [{ id: 'p2', name: 'Max' }, { id: 'p3', name: 'Zoe' }] });
    expect(m.id).toBe('me2');
    expect(m.status).toBe('open');
    expect([...m.peers().keys()].sort()).toEqual(['p2', 'p3']);
    expect(events.map(label)).toEqual(['status:reconnecting', 'status:open', 'joined:me2:true', 'peer-leave:p1', 'peer-join:p3']);

    // The delay starts over after a successful join.
    third.drop(1006);
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(4);
    m.close();
  });

  it('gives up at once on a refusal that retrying cannot fix', async () => {
    const { m, events } = setup();
    const p = m.connect();
    const assertion = expect(p).rejects.toMatchObject({ code: 'room-full', name: 'MultiplayerError' });
    const sock = FakeSocket.last();
    sock.open();
    sock.receive({ t: 'error', code: 'room-full', message: 'the room is full' });
    sock.drop(4002);
    await assertion;
    expect(m.status).toBe('closed');
    expect(events.map(label)).toEqual(['status:connecting', 'status:closed', 'error:room-full:true']);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('drops the room and stops when the relay cuts a joined client off for good', async () => {
    const { m, events } = setup();
    const sock = await joined(m, [{ id: 'p1', name: 'Pat' }]);
    events.length = 0;
    sock.receive({ t: 'error', code: 'chat-rate', message: 'chat too fast' });
    sock.receive({ t: 'error', code: 'rate-limit', message: 'too many messages' });
    sock.drop(1008);
    expect(events.map(label)).toEqual(['error:chat-rate:false', 'peer-leave:p1', 'status:closed', 'error:rate-limit:true']);
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('rejects when the relay is unreachable at the first attempt, and can be tried again', async () => {
    const { m } = setup();
    const p = m.connect();
    const refused = expect(p).rejects.toMatchObject({ code: 'unreachable' });
    FakeSocket.last().drop(1006);
    await refused;
    expect(m.status).toBe('closed');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);

    const again = m.connect();
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.last().open();
    FakeSocket.last().receive({ t: 'joined', id: 'me1', room: 'ROOM01', peers: [] });
    await again;
    expect(m.status).toBe('open');
    m.close();
  });

  it('gives up on a socket that never opens', async () => {
    const { m } = setup();
    const p = m.connect();
    const timedOut = expect(p).rejects.toMatchObject({ code: 'unreachable' });
    vi.advanceTimersByTime(8000);
    await timedOut;
    expect(m.status).toBe('closed');
  });

  it('refuses an invalid room code without opening a socket', async () => {
    const m = new Multiplayer({ url: 'ws://fake/', room: 'x!', name: 'Me' });
    await expect(m.connect()).rejects.toMatchObject({ code: 'bad-room' });
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('close() ends a pending connect and leaves nothing running', async () => {
    const { m } = setup();
    const p = m.connect();
    const closed = expect(p).rejects.toMatchObject({ code: 'closed' });
    const sock = FakeSocket.last();
    m.close();
    await closed;
    sock.drop(1006); // late event of the old socket: ignored
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(m.status).toBe('closed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('measures the round trip and keeps a link that answers its pings', async () => {
    const { m } = setup();
    const sock = await joined(m);
    const answer = () => {
      const ping = sock.frames().filter((f) => f.t === 'ping').pop()!;
      vi.advanceTimersByTime(40);
      sock.receive({ t: 'pong', c: ping.c, at: 0 });
    };
    answer(); // the ping sent at the join
    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(4960); // next tick: a new ping
      answer();
    }
    expect(m.status).toBe('open');
    expect(m.latencyMs).toBe(40);
    expect(sock.frames().filter((f) => f.t === 'ping').length).toBeGreaterThanOrEqual(12);
    m.close();
  });

  it('abandons a link that stopped answering and reconnects', async () => {
    const { m } = setup();
    const sock = await joined(m);
    vi.advanceTimersByTime(15_000);
    expect(m.status).toBe('open');
    vi.advanceTimersByTime(5000);
    expect(m.status).toBe('reconnecting');
    expect(sock.readyState).toBe(3);
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);
    m.close();
  });

  it('survives a failing listener and lets one unsubscribe', async () => {
    const { m, events } = setup();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const off = m.onEvent(() => {
      throw new Error('boom');
    });
    await joined(m);
    expect(events.map(label)).toContain('status:open');
    expect(quiet).toHaveBeenCalled();
    off();
    quiet.mockClear();
    m.close();
    expect(quiet).not.toHaveBeenCalled();
  });
});

describe('Multiplayer against the real relay', () => {
  const apps: { close(): Promise<unknown> }[] = [];
  const clients: Multiplayer[] = [];
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    await Promise.all(apps.splice(0).map((a) => a.close().catch(() => {})));
  });

  async function relay(opts: RelayOptions = {}) {
    const app = Fastify({ logger: false });
    const handle = await registerGameRelay(app, opts);
    await app.listen({ port: 0, host: '127.0.0.1' });
    apps.push(app);
    return { app, handle, url: `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/game/ws` };
  }
  const client = (url: string, name: string, room = 'webtst') => {
    const m = new Multiplayer({ url, room, name });
    clients.push(m);
    return m;
  };
  async function until(cond: () => boolean, ms = 4000) {
    const end = Date.now() + ms;
    while (!cond()) {
      if (Date.now() > end) throw new Error('condition not met in time');
      await sleep(10);
    }
  }

  it('lets two pilots see each other, fly, talk and leave', async () => {
    const { url, handle } = await relay();
    const alice = client(url, 'Alice');
    const bob = client(url, 'Bob');
    const seen: NetEvent[] = [];
    bob.onEvent((e) => seen.push(e));
    await alice.connect();
    await bob.connect();
    await until(() => alice.peers().size === 1 && bob.peers().size === 1);
    expect(alice.peers().get(bob.id!)?.name).toBe('Bob');
    expect(handle.stats()).toEqual({ rooms: 1, clients: 2 });

    // Ten calls in a row: one state goes out.
    for (let i = 0; i < 10; i++) alice.sendState({ ...S, x: i });
    await until(() => bob.peers().get(alice.id!)?.state != null);
    await sleep(150);
    expect(bob.peers().get(alice.id!)!.state!.x).toBe(0);
    await sleep(110);
    alice.sendState({ ...S, x: 99 });
    await until(() => bob.peers().get(alice.id!)!.state!.x === 99);
    // Far in the future the sample is the held, extrapolated state; right now it is some older state.
    expect(bob.sample(alice.id!, performance.now() + 60_000)!.x).toBeGreaterThan(99);
    expect(bob.sample(alice.id!, performance.now())).not.toBeNull();

    alice.sendChat('salut Bob');
    await until(() => seen.some((e) => e.type === 'chat'));
    expect(seen.find((e) => e.type === 'chat')).toMatchObject({ id: alice.id, name: 'Alice', text: 'salut Bob', self: false });

    const aliceId = alice.id!;
    alice.close();
    await until(() => bob.peers().size === 0);
    expect(seen).toContainEqual({ type: 'peer-leave', id: aliceId });
    await until(() => handle.stats().clients === 1);
  });

  it('measures the latency with the relay', async () => {
    const { url } = await relay();
    const a = client(url, 'A');
    await a.connect();
    await until(() => a.latencyMs !== null);
    expect(a.latencyMs!).toBeLessThan(1000);
  });

  it('comes back by itself after the server drops every socket', async () => {
    const { app, url } = await relay();
    const a = client(url, 'A');
    const b = client(url, 'B');
    const log: NetEvent[] = [];
    a.onEvent((e) => log.push(e));
    await a.connect();
    await b.connect();
    await until(() => a.peers().size === 1);
    const oldId = a.id;

    for (const socket of app.websocketServer.clients) socket.terminate();
    await until(() => log.some((e) => e.type === 'status' && e.status === 'reconnecting'));
    await until(() => a.status === 'open' && b.status === 'open' && a.peers().size === 1 && b.peers().size === 1);
    expect(a.id).not.toBe(oldId);
    expect(log).toContainEqual(expect.objectContaining({ type: 'joined', reconnected: true }));
    expect(a.peers().has(b.id!)).toBe(true);
  });

  it('rejects, without retrying, when the room is full', async () => {
    const { url, handle } = await relay({ maxPerRoom: 1 });
    await client(url, 'First').connect();
    const second = client(url, 'Second');
    await expect(second.connect()).rejects.toMatchObject({ code: 'room-full' });
    expect(second.status).toBe('closed');
    await sleep(700);
    expect(handle.stats().clients).toBe(1);
  });

  it('rejects when nothing listens', async () => {
    const m = client('ws://127.0.0.1:1/api/game/ws', 'Lost');
    await expect(m.connect()).rejects.toMatchObject({ code: 'unreachable' });
    expect(m.status).toBe('closed');
  });
});
