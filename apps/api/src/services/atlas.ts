/**
 * The knowledge base served to the map, assembled from the database once and
 * kept pre-serialised and pre-compressed in memory: a request costs a buffer
 * copy, not a query. Rebuilt when the data changes.
 */
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import type { Atlas, AtlasFeature, AtlasMassif, FeatureCategory } from '@brises/shared';
import type { Db } from '../db/client';

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

export interface SerializedAtlas {
  etag: string;
  raw: Buffer;
  br: Buffer;
  gzip: Buffer;
  atlas: Atlas;
}

const CATEGORIES: FeatureCategory[] = ['breezes', 'convergences', 'hazards', 'thermals', 'soaring', 'takeoffs', 'landings', 'routes'];

export async function loadAtlas(db: Db): Promise<Atlas> {
  const [sources, massifRows, featureRows, curatedRows, rules, meta] = await Promise.all([
    db.query<{ id: string; title: string; url: string | null; publisher: string | null; type: string | null; notes: string | null }>('SELECT * FROM sources'),
    db.query<{ id: string; name: string; short_name: string; region: string; parent: string | null; summary: string; bbox: string; center: string; tips: string[]; synoptic: AtlasMassif['synoptic']; sources: string[] }>(
      `SELECT id, name, short_name, region, parent, summary, ST_AsGeoJSON(ST_Envelope(bbox)) AS bbox, ST_AsGeoJSON(center) AS center, tips, synoptic, sources FROM massifs ORDER BY sort`,
    ),
    db.query<{ num: number; category: FeatureCategory; geom: string; props: AtlasFeature['properties'] }>(
      `SELECT num, category, ST_AsGeoJSON(geom, 5) AS geom, props FROM features WHERE status = 'published' ORDER BY num`,
    ),
    db.query<{ data: Atlas['curated'][number] }>('SELECT data FROM curated_breezes ORDER BY sort'),
    db.query<{ data: Atlas['rules'][number] }>('SELECT data FROM model_rules'),
    db.query<{ key: string; value: unknown }>('SELECT key, value FROM atlas_meta'),
  ]);
  const metaMap = Object.fromEntries(meta.map((m) => [m.key, m.value]));
  const features = Object.fromEntries(CATEGORIES.map((c) => [c, [] as AtlasFeature[]])) as Record<FeatureCategory, AtlasFeature[]>;
  for (const f of featureRows) features[f.category]?.push({ type: 'Feature', id: f.num, geometry: JSON.parse(f.geom), properties: f.props });
  const items = new Map<string, AtlasMassif['items']>();
  for (const [cat, list] of Object.entries(features) as [FeatureCategory, AtlasFeature[]][])
    for (const f of list) {
      const m = f.properties.massif;
      if (!items.has(m)) items.set(m, Object.fromEntries(CATEGORIES.map((c) => [c, [] as string[]])) as AtlasMassif['items']);
      items.get(m)![cat].push(f.properties.id);
    }
  const massifs: AtlasMassif[] = massifRows.map((m) => {
    const ring = (JSON.parse(m.bbox) as { coordinates: number[][][] }).coordinates[0];
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    return {
      id: m.id,
      name: m.name,
      shortName: m.short_name,
      region: m.region,
      parent: m.parent ?? undefined,
      summary: m.summary,
      bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      center: (JSON.parse(m.center) as { coordinates: [number, number] }).coordinates,
      tips: m.tips,
      synoptic: m.synoptic,
      items: items.get(m.id) ?? (Object.fromEntries(CATEGORIES.map((c) => [c, []])) as unknown as AtlasMassif['items']),
      sources: m.sources,
    };
  });
  return {
    generatedAt: String(metaMap.generatedAt ?? new Date().toISOString()),
    massifs,
    regions: (metaMap.regions as string[]) ?? [...new Set(massifs.map((m) => m.region))],
    sources: Object.fromEntries(sources.map((s) => [s.id, { id: s.id, title: s.title, url: s.url ?? undefined, publisher: s.publisher ?? undefined, type: s.type ?? undefined, notes: s.notes ?? undefined }])),
    features,
    curated: curatedRows.map((r) => r.data),
    rules: rules.map((r) => r.data),
    figures: (metaMap.figures as Atlas['figures']) ?? [],
    dossiers: (metaMap.dossiers as Atlas['dossiers']) ?? {},
    stats: { massifs: massifs.length, sources: sources.length, ...Object.fromEntries(CATEGORIES.map((c) => [c, features[c].length])) },
  };
}

export async function serializeAtlas(atlas: Atlas): Promise<SerializedAtlas> {
  const raw = Buffer.from(JSON.stringify(atlas));
  const [br, gzipped] = await Promise.all([brotli(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }), gz(raw, { level: 9 })]);
  return { etag: `"${createHash('sha1').update(raw).digest('base64url')}"`, raw, br, gzip: gzipped, atlas };
}
