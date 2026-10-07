/**
 * Fastify application: JSON API under /api for the map (knowledge base,
 * flying sites, contributions, shared forecast cache). Built by a factory so
 * the server and the tests mount exactly the same thing.
 */
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config';
import type { Db } from './db/client';
import { atlasRoutes } from './routes/atlas';
import { contributionRoutes } from './routes/contributions';
import { siteRoutes } from './routes/sites';
import { weatherRoutes } from './routes/weather';
import { loadAtlas, serializeAtlas, type SerializedAtlas } from './services/atlas';
import { QuotaMeter, UpstreamCache } from './services/cache';
import { DirectoryService } from './services/directories';
import { openMeteoRunProbe, WeatherService } from './services/weather';

export interface AppContext {
  config: Config;
  db: Db;
  atlas: () => SerializedAtlas;
  reloadAtlas: () => Promise<void>;
  weather: WeatherService;
  directories: DirectoryService;
  quota: QuotaMeter;
}

export interface AppOverrides {
  weather?: WeatherService;
  directories?: DirectoryService;
}

export async function buildApp(config: Config, db: Db, overrides: AppOverrides = {}): Promise<{ app: FastifyInstance; ctx: AppContext }> {
  const app = Fastify({
    logger: { level: config.logLevel },
    trustProxy: config.trustProxy,
    bodyLimit: 64 * 1024,
    ajv: { customOptions: { coerceTypes: true, removeAdditional: false } },
  });
  const cache = new UpstreamCache(db);
  const quota = new QuotaMeter(db, { 'open-meteo': config.weatherDailyBudget, osm: 2000, pge: 2000 });
  let serialized = await serializeAtlas(await loadAtlas(db));
  const ctx: AppContext = {
    config,
    db,
    atlas: () => serialized,
    reloadAtlas: async () => {
      serialized = await serializeAtlas(await loadAtlas(db));
    },
    weather: overrides.weather ?? new WeatherService(cache, quota, openMeteoRunProbe()),
    directories: overrides.directories ?? new DirectoryService(cache, quota),
    quota,
  };

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, { origin: config.corsOrigin === '*' ? true : config.corsOrigin, methods: ['GET', 'POST', 'PATCH'], maxAge: 86400 });
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });
  await app.register(compress, { threshold: 1024, encodings: ['br', 'gzip'] });

  await app.register(
    async (api) => {
      api.get('/health', async () => {
        await db.query('SELECT 1');
        return { ok: true, db: db.kind, atlas: serialized.atlas.stats };
      });
      api.get('/usage', async () => ctx.quota.usage());
      await atlasRoutes(api, ctx);
      await siteRoutes(api, ctx);
      await contributionRoutes(api, ctx);
      await weatherRoutes(api, ctx);
    },
    { prefix: '/api' },
  );

  // Hourly housekeeping of the upstream cache.
  const timer = setInterval(() => void cache.purge().catch(() => {}), 3600_000);
  timer.unref();
  app.addHook('onClose', async () => clearInterval(timer));
  return { app, ctx };
}
