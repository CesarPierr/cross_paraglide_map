import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { AppContext } from '../app';

/** preHandler of the moderation endpoints: Bearer ADMIN_TOKEN (disabled when it is empty). */
export const adminGuard = (ctx: AppContext) => async (req: FastifyRequest) => {
  const token = ctx.config.adminToken;
  const given = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const ok = token.length > 0 && given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));
  if (!ok) throw Object.assign(new Error('non autorisé'), { statusCode: 401 });
};
