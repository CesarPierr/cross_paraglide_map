import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app';

/** The whole knowledge base, pre-compressed, with ETag revalidation. */
export async function atlasRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get('/atlas', async (req, reply) => {
    const a = ctx.atlas();
    reply.header('ETag', a.etag).header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400').header('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === a.etag) return reply.code(304).send();
    const accept = String(req.headers['accept-encoding'] ?? '');
    reply.type('application/json; charset=utf-8');
    if (/\bbr\b/.test(accept)) return reply.header('Content-Encoding', 'br').send(a.br);
    if (/\bgzip\b/.test(accept)) return reply.header('Content-Encoding', 'gzip').send(a.gzip);
    return reply.send(a.raw);
  });

  app.get<{ Params: { id: string } }>('/massifs/:id', async (req, reply) => {
    const m = ctx.atlas().atlas.massifs.find((x) => x.id === req.params.id);
    if (!m) return reply.code(404).send({ error: 'massif inconnu' });
    reply.header('Cache-Control', 'public, max-age=300');
    return m;
  });
}
