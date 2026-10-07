import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { SerializedPart } from '../services/atlas';
import type { AppContext } from '../app';

/** The knowledge base in two parts, pre-compressed, with ETag revalidation. */
export async function atlasRoutes(app: FastifyInstance, ctx: AppContext) {
  const send = (part: SerializedPart, req: FastifyRequest, reply: FastifyReply) => {
    reply.header('ETag', part.etag).header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400').header('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === part.etag) return reply.code(304).send();
    const accept = String(req.headers['accept-encoding'] ?? '');
    reply.type('application/json; charset=utf-8');
    if (/\bbr\b/.test(accept)) return reply.header('Content-Encoding', 'br').send(part.br);
    if (/\bgzip\b/.test(accept)) return reply.header('Content-Encoding', 'gzip').send(part.gzip);
    return reply.send(part.raw);
  };
  /** Core: geometry, names and numbers — enough for the map and the wind model. */
  app.get('/atlas', async (req, reply) => send(ctx.atlas(), req, reply));
  /** Text: descriptions, source notes, summaries, figures — fetched right after the core. */
  app.get('/atlas/text', async (req, reply) => send(ctx.atlas().text, req, reply));

  app.get<{ Params: { id: string } }>('/massifs/:id', async (req, reply) => {
    const m = ctx.atlas().atlas.massifs.find((x) => x.id === req.params.id);
    if (!m) return reply.code(404).send({ error: 'massif inconnu' });
    reply.header('Cache-Control', 'public, max-age=300');
    return m;
  });
}
