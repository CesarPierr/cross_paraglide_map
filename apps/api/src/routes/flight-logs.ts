/**
 * Flight logs of the game (@brises/shared flight-log.ts): the game opens a log when a flight
 * starts and sends its rows and events in chunks (every ~20 s, and when the page closes);
 * moderation reads them back (local network only, Bearer ADMIN_TOKEN) for
 * scripts/dev/flight-logs.ts. No address and no name are stored; logs go after 180 days.
 */
import { FlightLogChunk, FlightLogStart } from '@brises/shared';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app';
import type { Db } from '../db/client';
import { adminGuard } from './admin';

/** A log takes chunks for this long after it opened, and this many at most (~16 h at one per 20 s). */
const OPEN_HOURS = 12;
const MAX_CHUNKS = 3000;
export const FLIGHT_LOG_DAYS = 180;

const Id = Type.Object({ id: Type.String({ format: 'uuid' }) });

export async function purgeFlightLogs(db: Db): Promise<void> {
  await db.query(`DELETE FROM game_flights WHERE created_at < now() - make_interval(days => $1)`, [FLIGHT_LOG_DAYS]);
}

export async function flightLogRoutes(app: FastifyInstance, ctx: AppContext) {
  app.post<{ Body: FlightLogStart }>(
    '/game/flights',
    { schema: { body: FlightLogStart, response: { 201: Type.Object({ id: Type.String() }) } }, config: { rateLimit: { max: 60, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const b = req.body;
      const rows = await ctx.db.query<{ id: string }>(
        `INSERT INTO game_flights (client, build, takeoff_id, takeoff_name, lon, lat, scenario, options, device, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10) RETURNING id`,
        [b.client, b.build, b.takeoffId, b.takeoffName, b.lon, b.lat, JSON.stringify(b.scenario), JSON.stringify(b.options), JSON.stringify(b.device), String(req.headers['user-agent'] ?? '').slice(0, 300)],
      );
      return reply.code(201).send({ id: rows[0].id });
    },
  );

  app.post<{ Params: { id: string }; Body: FlightLogChunk }>(
    '/game/flights/:id/chunks',
    { schema: { params: Id, body: FlightLogChunk }, config: { rateLimit: { max: 600, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const { id } = req.params;
      const c = req.body;
      const done = await ctx.db.transaction(async (tx) => {
        const f = await tx.query<{ ok: boolean }>(
          `SELECT created_at > now() - make_interval(hours => $2) AND chunks < $3 AS ok FROM game_flights WHERE id = $1 FOR UPDATE`,
          [id, OPEN_HOURS, MAX_CHUNKS],
        );
        if (!f.length) return 'missing';
        if (!f[0].ok) return 'closed';
        const ins = await tx.query(`INSERT INTO game_flight_chunks (flight_id, seq, rows, events) VALUES ($1, $2, $3::jsonb, $4::jsonb) ON CONFLICT DO NOTHING RETURNING seq`, [
          id,
          c.seq,
          JSON.stringify(c.rows),
          JSON.stringify(c.events),
        ]);
        if (ins.length)
          await tx.query(
            `UPDATE game_flights SET updated_at = now(), chunks = chunks + 1, samples = samples + $2, events = events + $3, ended = COALESCE($4::jsonb, ended) WHERE id = $1`,
            [id, c.rows.length, c.events.length, c.end ? JSON.stringify(c.end) : null],
          );
        return 'ok';
      });
      if (done === 'missing') return reply.code(404).send({ error: 'introuvable' });
      if (done === 'closed') return reply.code(409).send({ error: 'journal fermé' });
      return reply.code(204).send();
    },
  );

  // ---------- Moderation (Bearer ADMIN_TOKEN, local network) ----------
  const admin = adminGuard(ctx);
  const FIELDS = `id, created_at AS "createdAt", updated_at AS "updatedAt", client, build, takeoff_id AS "takeoffId", takeoff_name AS "takeoffName",
    lon, lat, scenario, options, device, user_agent AS "userAgent", ended, chunks, samples, events`;

  app.get<{ Querystring: { limit?: number; client?: string; takeoff?: string; since?: string } }>(
    '/admin/game/flights',
    {
      preHandler: admin,
      schema: {
        querystring: Type.Object({
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
          client: Type.Optional(Type.String({ maxLength: 32 })),
          takeoff: Type.Optional(Type.String({ maxLength: 200 })),
          since: Type.Optional(Type.String({ format: 'date-time' })),
        }),
      },
    },
    async (req) =>
      ctx.db.query(
        `SELECT ${FIELDS} FROM game_flights
         WHERE ($1::text IS NULL OR client = $1) AND ($2::text IS NULL OR takeoff_id LIKE '%' || $2 || '%') AND ($3::timestamptz IS NULL OR created_at >= $3)
         ORDER BY created_at DESC LIMIT $4`,
        [req.query.client ?? null, req.query.takeoff ?? null, req.query.since ?? null, req.query.limit ?? 100],
      ),
  );

  app.get<{ Params: { id: string } }>('/admin/game/flights/:id', { preHandler: admin, schema: { params: Id } }, async (req, reply) => {
    const f = await ctx.db.query(`SELECT ${FIELDS} FROM game_flights WHERE id = $1`, [req.params.id]);
    if (!f.length) return reply.code(404).send({ error: 'introuvable' });
    const chunks = await ctx.db.query<{ seq: number; rows: number[][]; events: unknown[] }>(`SELECT seq, rows, events FROM game_flight_chunks WHERE flight_id = $1 ORDER BY seq`, [req.params.id]);
    return { ...f[0], rows: chunks.flatMap((c) => c.rows), log: chunks.flatMap((c) => c.events) };
  });
}
