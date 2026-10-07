import { createHash, timingSafeEqual } from 'node:crypto';
import { ContributionInput, ContributionStatus, FeedbackSummary } from '@brises/shared';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppContext } from '../app';

const PUBLIC_FIELDS = `id, kind, target_ref AS "targetRef", category, title, message, ST_AsGeoJSON(geom)::json AS geometry, details,
  source_url AS "sourceUrl", context, author, status, created_at AS "createdAt"`;

export async function contributionRoutes(app: FastifyInstance, ctx: AppContext) {
  const ipHash = (req: FastifyRequest) => createHash('sha256').update(`${ctx.config.ipSalt}:${req.ip}`).digest('hex').slice(0, 32);

  app.post<{ Body: ContributionInput }>(
    '/contributions',
    {
      schema: { body: ContributionInput, response: { 201: Type.Object({ id: Type.String() }) } },
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const c = req.body;
      const rows = await ctx.db.query<{ id: string }>(
        `INSERT INTO contributions (kind, target_ref, category, title, message, geom, details, source_url, context, author, email, ip_hash, user_agent)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($6), 4326) END,
                 $7::jsonb, $8, $9::jsonb, $10, $11, $12, $13)
         RETURNING id`,
        [
          c.kind,
          c.targetRef ?? null,
          c.category ?? null,
          c.title ?? null,
          c.message,
          c.geometry ? JSON.stringify(c.geometry) : null,
          c.details ? JSON.stringify(c.details) : null,
          c.sourceUrl ?? null,
          c.context ? JSON.stringify(c.context) : null,
          c.author ?? null,
          c.email ?? null,
          ipHash(req),
          String(req.headers['user-agent'] ?? '').slice(0, 300),
        ],
      );
      return reply.code(201).send({ id: rows[0].id });
    },
  );

  /** Public counters of quick feedback on one item (rejected entries excluded). */
  app.get<{ Querystring: { targetRef: string } }>(
    '/contributions/summary',
    { schema: { querystring: Type.Object({ targetRef: Type.String({ maxLength: 200 }) }), response: { 200: FeedbackSummary } } },
    async (req, reply) => {
      const rows = await ctx.db.query<{ kind: string; n: number }>(
        `SELECT kind, count(*)::int AS n FROM contributions WHERE target_ref = $1 AND status <> 'rejected' GROUP BY kind`,
        [req.query.targetRef],
      );
      const n = (k: string) => rows.find((r) => r.kind === k)?.n ?? 0;
      reply.header('Cache-Control', 'public, max-age=60');
      return { targetRef: req.query.targetRef, confirm: n('confirm'), dispute: n('dispute'), correct: n('correct'), comment: n('comment') };
    },
  );

  // ---------- Moderation (Bearer ADMIN_TOKEN) ----------
  const admin = async (req: FastifyRequest) => {
    const token = ctx.config.adminToken;
    const given = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const ok = token.length > 0 && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));
    if (!ok) throw Object.assign(new Error('non autorisé'), { statusCode: 401 });
  };

  app.get<{ Querystring: { status?: ContributionStatus; limit?: number } }>(
    '/admin/contributions',
    { preHandler: admin, schema: { querystring: Type.Object({ status: Type.Optional(ContributionStatus), limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })) }) } },
    async (req) =>
      ctx.db.query(`SELECT ${PUBLIC_FIELDS}, email FROM contributions WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT $2`, [
        req.query.status ?? null,
        req.query.limit ?? 100,
      ]),
  );

  app.patch<{ Params: { id: string }; Body: { status: ContributionStatus; reviewNote?: string } }>(
    '/admin/contributions/:id',
    {
      preHandler: admin,
      schema: {
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Object({ status: ContributionStatus, reviewNote: Type.Optional(Type.String({ maxLength: 1000 })) }, { additionalProperties: false }),
      },
    },
    async (req, reply) => {
      const rows = await ctx.db.query(`UPDATE contributions SET status = $2, review_note = $3, reviewed_at = now() WHERE id = $1 RETURNING id`, [
        req.params.id,
        req.body.status,
        req.body.reviewNote ?? null,
      ]);
      if (!rows.length) return reply.code(404).send({ error: 'introuvable' });
      return { ok: true };
    },
  );

  /** Accepted contributions in the atlas research format, for the data pipeline. */
  app.get('/admin/contributions/export', { preHandler: admin }, async () =>
    ctx.db.query(`SELECT ${PUBLIC_FIELDS} FROM contributions WHERE status = 'accepted' ORDER BY created_at`),
  );
}
