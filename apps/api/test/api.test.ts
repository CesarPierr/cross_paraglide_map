import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import type { Atlas, FlyingSite, PointForecast, SiteProvider, SynopticWind, WeatherProvider } from '@brises/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp, type AppContext } from '../src/app';
import { loadConfig } from '../src/config';
import { createDb, type Db } from '../src/db/client';
import { migrate } from '../src/db/migrate';
import { seedAtlas, seedSites } from '../src/db/seed';
import { QuotaMeter, UpstreamCache } from '../src/services/cache';
import { DirectoryService } from '../src/services/directories';
import { expiryFor, WeatherService, type ModelRun } from '../src/services/weather';

const atlas = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../web/public/data/atlas.json'), 'utf8')) as Atlas;

// Controllable fake upstreams.
let run: ModelRun | null = { id: '2026-07-15T06:00:00.000Z', nextAvailableAt: Date.now() + 2 * 3600_000 };
let upstreamCalls = 0;
let upstreamFails = false;
const fakeWeather: WeatherProvider = {
  id: 'fake',
  label: 'fake',
  attribution: '',
  async synoptic(): Promise<SynopticWind[]> {
    upstreamCalls++;
    if (upstreamFails) throw new Error('down');
    return [{ time: '2026-07-15T15:00', hour: 15, fromDeg: 315, speedKmh: 12 }];
  },
  async pointForecast(): Promise<{ elevation: number; hours: PointForecast[] }> {
    upstreamCalls++;
    return { elevation: 1000, hours: [{ time: '2026-07-15T15:00', hour: 15, temperature2m: 24, dewpoint2m: 10 }] };
  },
};
const fakeDirectory: SiteProvider = {
  id: 'osm',
  label: 'OSM',
  attribution: '',
  minZoom: 0,
  async fetch([w, s]): Promise<FlyingSite[]> {
    return [{ id: `n${w}${s}`, provider: 'osm', kind: 'takeoff', name: 'Déco test', lon: w + 0.1, lat: s + 0.1, status: 'community' }];
  },
};

let db: Db;
let app: FastifyInstance;
let ctx: AppContext;
let quota: QuotaMeter;

beforeAll(async () => {
  db = await createDb('pglite:memory');
  await migrate(db);
  await seedAtlas(db, atlas);
  await seedSites(db, [
    { id: '38D001A', provider: 'ffvl', kind: 'takeoff', name: 'Saint-Hilaire Sud', lon: 5.8867, lat: 45.3075, altitude: 975, orientations: ['O', 'SO'], status: 'official' },
    { id: '38A001A', provider: 'ffvl', kind: 'landing', name: 'Lumbin', lon: 5.913, lat: 45.305, altitude: 240, status: 'official' },
  ]);
  const config = { ...loadConfig({}), adminToken: 'secret-token', logLevel: 'silent', weatherDailyBudget: 20 };
  const cache = new UpstreamCache(db);
  quota = new QuotaMeter(db, { 'open-meteo': 20, osm: 100, pge: 100 });
  const weather = new WeatherService(cache, quota, async () => run, fakeWeather);
  const directories = new DirectoryService(cache, quota, { osm: fakeDirectory });
  ({ app, ctx } = await buildApp(config, db, { weather, directories }));
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await db?.close();
});

describe('health & atlas', () => {
  it('reports a healthy database', async () => {
    const r = await app.inject('/api/health');
    expect(r.statusCode).toBe(200);
    expect(r.json().ok).toBe(true);
  });

  it('serves the atlas pre-compressed and identical to the seed', async () => {
    const r = await app.inject({ url: '/api/atlas', headers: { 'accept-encoding': 'br, gzip' } });
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-encoding']).toBe('br');
    const body = JSON.parse(brotliDecompressSync(r.rawPayload).toString()) as Atlas;
    expect(body.stats.massifs).toBe(atlas.stats.massifs);
    expect(body.stats.breezes).toBe(atlas.stats.breezes);
    expect(body.curated.length).toBe(atlas.curated.length);
    const m = body.massifs.find((x) => x.id === 'chartreuse')!;
    expect(m.items.breezes.length).toBe(atlas.massifs.find((x) => x.id === 'chartreuse')!.items.breezes.length);
    const again = await app.inject({ url: '/api/atlas', headers: { 'if-none-match': String(r.headers.etag) } });
    expect(again.statusCode).toBe(304);
  });

  it('answers spatial queries with PostGIS', async () => {
    const r = await app.inject('/api/features?bbox=5.7,45.15,6.1,45.5&category=breezes');
    expect(r.statusCode).toBe(200);
    expect(r.json().features.length).toBeGreaterThan(0);
    const sites = await app.inject('/api/sites?bbox=5.8,45.2,6,45.4');
    expect(sites.json().map((s: FlyingSite) => s.name)).toEqual(expect.arrayContaining(['Saint-Hilaire Sud', 'Lumbin']));
    expect((await app.inject('/api/sites?bbox=0,0,10,10')).statusCode).toBe(400);
  });

  it('proxies community directories through the shared cache', async () => {
    const r = await app.inject('/api/sites/external/osm?bbox=5.6,45.1,5.9,45.4');
    expect(r.statusCode).toBe(200);
    expect(r.json().length).toBeGreaterThan(0);
  });
});

describe('contributions', () => {
  const ref = 'atlas:chartreuse/test';
  it('validates and stores contributions', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/api/contributions',
      payload: { kind: 'new', category: 'breeze', title: 'Brise test', message: 'Observée le 12 juillet', geometry: { type: 'LineString', coordinates: [[5.9, 45.3], [5.8, 45.25]] } },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().id).toMatch(/^[0-9a-f-]{36}$/);
    const bad = await app.inject({ method: 'POST', url: '/api/contributions', payload: { kind: 'new' } });
    expect(bad.statusCode).toBe(400);
    const extra = await app.inject({ method: 'POST', url: '/api/contributions', payload: { kind: 'comment', message: 'ok', isAdmin: true } });
    expect(extra.statusCode).toBe(400);
  });

  it('counts quick feedback and lets moderators reject', async () => {
    await app.inject({ method: 'POST', url: '/api/contributions', payload: { kind: 'confirm', targetRef: ref, message: 'Observé conforme.' } });
    await app.inject({ method: 'POST', url: '/api/contributions', payload: { kind: 'confirm', targetRef: ref, message: 'Observé conforme.' } });
    const d = await app.inject({ method: 'POST', url: '/api/contributions', payload: { kind: 'dispute', targetRef: ref, message: 'Pas observé.' } });
    let s = (await app.inject(`/api/contributions/summary?targetRef=${encodeURIComponent(ref)}`)).json();
    expect(s).toMatchObject({ confirm: 2, dispute: 1 });
    expect((await app.inject('/api/admin/contributions')).statusCode).toBe(401);
    const auth = { authorization: 'Bearer secret-token' };
    const list = await app.inject({ url: '/api/admin/contributions?status=pending', headers: auth });
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBeGreaterThanOrEqual(4);
    const patch = await app.inject({ method: 'PATCH', url: `/api/admin/contributions/${d.json().id}`, headers: auth, payload: { status: 'rejected' } });
    expect(patch.statusCode).toBe(200);
    s = (await app.inject(`/api/contributions/summary?targetRef=${encodeURIComponent(ref)}`)).json();
    expect(s.dispute).toBe(0);
  });
});

describe('weather cache', () => {
  it('expires with the next model run, clamped', () => {
    const now = Date.now();
    expect(expiryFor(null, now)).toBe(now + 3600_000);
    expect(expiryFor({ id: 'x', nextAvailableAt: now + 5 * 60_000 }, now)).toBe(now + 15 * 60_000);
    expect(expiryFor({ id: 'x', nextAvailableAt: now + 24 * 3600_000 }, now)).toBe(now + 3 * 3600_000);
  });

  it('shares one upstream call per location and model run', async () => {
    upstreamCalls = 0;
    const a = await app.inject('/api/weather/synoptic?lat=45.31&lon=5.91');
    const b = await app.inject('/api/weather/synoptic?lat=45.33&lon=5.94'); // same 0.25° cell
    expect(a.statusCode).toBe(200);
    expect(b.json()).toEqual(a.json());
    expect(upstreamCalls).toBe(1);
    expect(Number(String(a.headers['cache-control']).match(/max-age=(\d+)/)![1])).toBeGreaterThan(3600);
    expect(a.headers['x-model-run']).toBe(run!.id);
    // A new run is published: the cached answer is obsolete.
    run = { id: '2026-07-15T09:00:00.000Z', nextAvailableAt: Date.now() + 3 * 3600_000 };
    await app.inject('/api/weather/synoptic?lat=45.31&lon=5.91');
    expect(upstreamCalls).toBe(2);
    // Next run published but the upstream is down: the previous answer is served, flagged stale.
    run = { id: '2026-07-15T12:00:00.000Z', nextAvailableAt: Date.now() + 3 * 3600_000 };
    upstreamFails = true;
    const stale = await app.inject('/api/weather/synoptic?lat=45.31&lon=5.91');
    upstreamFails = false;
    expect(stale.statusCode).toBe(200);
    expect(stale.headers['x-data-stale']).toBe('1');
    expect(stale.json()).toEqual(a.json());
  });

  it('coalesces concurrent identical requests', async () => {
    upstreamCalls = 0;
    await Promise.all(Array.from({ length: 5 }, () => app.inject('/api/weather/point?lat=45.1&lon=6.1')));
    expect(upstreamCalls).toBe(1);
  });

  it('refuses politely when the daily budget is spent and nothing is cached', async () => {
    const usage = await quota.usage();
    expect(usage['open-meteo'].used).toBeGreaterThan(0);
    // Drain the remaining budget.
    let status = 200;
    for (let i = 0; i < 30 && status === 200; i++) status = (await app.inject(`/api/weather/point?lat=${(44 + i * 0.1).toFixed(2)}&lon=6.5`)).statusCode;
    expect(status).toBe(503);
    expect(ctx.config.weatherDailyBudget).toBe(20);
  });
});

describe('upstream rate limit', () => {
  it('stops calling Open-Meteo for the day after a daily 429', async () => {
    const { UpstreamHttpError } = await import('@brises/shared');
    const db2 = await createDb('pglite:memory');
    await migrate(db2);
    const q = new QuotaMeter(db2, { 'open-meteo': 1000 });
    let calls = 0;
    const limited: WeatherProvider = {
      ...fakeWeather,
      async synoptic() {
        calls++;
        throw new UpstreamHttpError(429, 'Daily API request limit exceeded. Please try again tomorrow.');
      },
    };
    const svc = new WeatherService(new UpstreamCache(db2), q, async () => null, limited);
    await expect(svc.synoptic(45, 6)).rejects.toThrow(/quota/);
    await expect(svc.synoptic(44, 6)).rejects.toThrow(/quota/);
    expect(calls).toBe(1);
    expect((await q.usage())['open-meteo'].used).toBe(1000);
    await db2.close();
  }, 60_000);
});
