import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app';

const BBox = Type.Object({ bbox: Type.String({ pattern: '^-?\\d+(\\.\\d+)?(,-?\\d+(\\.\\d+)?){3}$' }) });

function parseBbox(s: string): [number, number, number, number] | null {
  const b = s.split(',').map(Number) as [number, number, number, number];
  if (b[0] >= b[2] || b[1] >= b[3] || (b[2] - b[0]) * (b[3] - b[1]) > 16) return null;
  return b;
}

export async function siteRoutes(app: FastifyInstance, ctx: AppContext) {
  /** Official sites stored in the database (FFVL import), by bounding box. */
  app.get<{ Querystring: { bbox: string } }>('/sites', { schema: { querystring: BBox } }, async (req, reply) => {
    const b = parseBbox(req.query.bbox);
    if (!b) return reply.code(400).send({ error: 'bbox invalide' });
    const rows = await ctx.db.query(
      `SELECT split_part(id, ':', 2) AS id, provider, kind, name, ST_X(geom) AS lon, ST_Y(geom) AS lat, altitude, orientations, description, url, status
       FROM sites WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326) LIMIT 2000`,
      b,
    );
    reply.header('Cache-Control', 'public, max-age=3600');
    return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null)));
  });

  /** Community directories through the shared cache. */
  app.get<{ Params: { provider: string }; Querystring: { bbox: string } }>(
    '/sites/external/:provider',
    { schema: { querystring: BBox, params: Type.Object({ provider: Type.Union([Type.Literal('osm'), Type.Literal('pge')]) }) } },
    async (req, reply) => {
      const b = parseBbox(req.query.bbox);
      if (!b) return reply.code(400).send({ error: 'bbox invalide' });
      try {
        const { sites, stale } = await ctx.directories.sites(req.params.provider, b);
        reply.header('Cache-Control', 'public, max-age=3600').header('X-Data-Stale', stale ? '1' : '0');
        return sites;
      } catch (err) {
        req.log.warn({ err }, 'directory unavailable');
        return reply.code(503).send({ error: 'annuaire indisponible' });
      }
    },
  );

  /** GeoJSON of published knowledge features in a bbox (for third-party reuse). */
  app.get<{ Querystring: { bbox: string; category?: string } }>(
    '/features',
    { schema: { querystring: Type.Object({ bbox: Type.String(), category: Type.Optional(Type.String({ maxLength: 20 })) }) } },
    async (req, reply) => {
      const b = parseBbox(req.query.bbox);
      if (!b) return reply.code(400).send({ error: 'bbox invalide' });
      const rows = await ctx.db.query<{ geom: string; props: unknown }>(
        `SELECT ST_AsGeoJSON(geom, 5) AS geom, props FROM features
         WHERE status = 'published' AND geom && ST_MakeEnvelope($1, $2, $3, $4, 4326) AND ($5::text IS NULL OR category = $5) LIMIT 5000`,
        [...b, req.query.category ?? null],
      );
      reply.header('Cache-Control', 'public, max-age=300');
      return { type: 'FeatureCollection', features: rows.map((r) => ({ type: 'Feature', geometry: JSON.parse(r.geom), properties: r.props })) };
    },
  );
}
