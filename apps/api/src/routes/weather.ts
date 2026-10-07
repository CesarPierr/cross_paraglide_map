import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { AppContext } from '../app';
import { QuotaExceededError, type Cached } from '../services/cache';

const LatLon = Type.Object({
  lat: Type.Number({ minimum: 42, maximum: 48 }),
  lon: Type.Number({ minimum: 3, maximum: 10 }),
});

function send<T>(reply: FastifyReply, r: Cached<T>) {
  const ttl = Math.max(0, Math.round((r.expiresAt - Date.now()) / 1000));
  return reply
    .header('Cache-Control', r.stale ? 'public, max-age=300' : `public, max-age=${ttl}`)
    .header('X-Data-Stale', r.stale ? '1' : '0')
    .header('X-Model-Run', r.version ?? 'unknown')
    .header('X-Fetched-At', new Date(r.fetchedAt).toISOString())
    .send(r.value);
}

export async function weatherRoutes(app: FastifyInstance, ctx: AppContext) {
  const handle = async <T>(reply: FastifyReply, job: () => Promise<Cached<T>>) => {
    try {
      return send(reply, await job());
    } catch (err) {
      if (err instanceof QuotaExceededError) return reply.code(503).header('Retry-After', '3600').send({ error: 'quota météo du jour atteint, réessayez plus tard' });
      reply.log.warn({ err }, 'weather upstream failed');
      return reply.code(502).send({ error: 'prévision indisponible' });
    }
  };
  app.get<{ Querystring: { lat: number; lon: number } }>('/weather/synoptic', { schema: { querystring: LatLon } }, (req, reply) =>
    handle(reply, () => ctx.weather.synoptic(req.query.lat, req.query.lon)),
  );
  app.get<{ Querystring: { lat: number; lon: number } }>('/weather/point', { schema: { querystring: LatLon } }, (req, reply) =>
    handle(reply, () => ctx.weather.point(req.query.lat, req.query.lon)),
  );
}
