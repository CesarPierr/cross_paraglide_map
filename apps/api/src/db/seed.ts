/**
 * Loads the compiled research atlas (scripts/build-data.ts output) and the
 * imported FFVL sites into the database. Idempotent: replaces the published
 * knowledge base, keeps user contributions and caches.
 */
import type { Atlas, FlyingSite } from '@brises/shared';
import type { Db } from './client';

const chunk = <T>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export async function seedAtlas(db: Db, atlas: Atlas): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.exec('DELETE FROM curated_breezes; DELETE FROM features; DELETE FROM massifs; DELETE FROM sources; DELETE FROM model_rules; DELETE FROM atlas_meta;');
    for (const part of chunk(Object.values(atlas.sources), 200))
      await tx.query(
        `INSERT INTO sources (id, title, url, publisher, type, notes)
         SELECT x->>'id', x->>'title', x->>'url', x->>'publisher', x->>'type', x->>'notes' FROM jsonb_array_elements($1::jsonb) x`,
        [JSON.stringify(part)],
      );
    const massifs = atlas.massifs.map((m, i) => ({ ...m, sort: i }));
    await tx.query(
      `INSERT INTO massifs (id, name, short_name, region, parent, summary, bbox, center, tips, synoptic, sources, sort)
       SELECT x->>'id', x->>'name', x->>'shortName', x->>'region', x->>'parent', coalesce(x->>'summary', ''),
              ST_MakeEnvelope((x->'bbox'->>0)::float8, (x->'bbox'->>1)::float8, (x->'bbox'->>2)::float8, (x->'bbox'->>3)::float8, 4326),
              ST_SetSRID(ST_MakePoint((x->'center'->>0)::float8, (x->'center'->>1)::float8), 4326),
              x->'tips', x->'synoptic', x->'sources', (x->>'sort')::int
       FROM jsonb_array_elements($1::jsonb) x`,
      [JSON.stringify(massifs)],
    );
    const features = Object.entries(atlas.features).flatMap(([category, list]) => list.map((f) => ({ category, num: f.id, geometry: f.geometry, props: f.properties })));
    for (const part of chunk(features, 150))
      await tx.query(
        `INSERT INTO features (id, num, category, massif_id, geom, props)
         SELECT x->'props'->>'id', (x->>'num')::int, x->>'category', x->'props'->>'massif',
                ST_SetSRID(ST_GeomFromGeoJSON(x->>'geometry'), 4326), x->'props'
         FROM jsonb_array_elements($1::jsonb) x`,
        [JSON.stringify(part)],
      );
    const curated = atlas.curated.map((c, i) => ({ id: c.id, sort: i, data: c }));
    for (const part of chunk(curated, 100))
      await tx.query(`INSERT INTO curated_breezes (id, sort, data) SELECT x->>'id', (x->>'sort')::int, x->'data' FROM jsonb_array_elements($1::jsonb) x`, [JSON.stringify(part)]);
    await tx.query(`INSERT INTO model_rules (id, data) SELECT x->>'id', x FROM jsonb_array_elements($1::jsonb) x`, [JSON.stringify(atlas.rules)]);
    await tx.query(`INSERT INTO atlas_meta (key, value) VALUES ('regions', $1::jsonb), ('generatedAt', $2::jsonb), ('figures', $3::jsonb), ('dossiers', $4::jsonb), ('outlines', $5::jsonb), ('tours', $6::jsonb), ('colors', $7::jsonb), ('hazards', $8::jsonb)`, [
      JSON.stringify(atlas.regions),
      JSON.stringify(atlas.generatedAt),
      JSON.stringify(atlas.figures ?? []),
      JSON.stringify(atlas.dossiers ?? {}),
      JSON.stringify(Object.fromEntries(atlas.massifs.filter((m) => m.outline).map((m) => [m.id, m.outline]))),
      JSON.stringify(atlas.tours ?? {}),
      JSON.stringify(Object.fromEntries(atlas.massifs.filter((m) => m.colorIndex !== undefined).map((m) => [m.id, m.colorIndex]))),
      JSON.stringify(atlas.curatedHazards ?? []),
    ]);
  });
}

export async function seedSites(db: Db, sites: FlyingSite[], provider = 'ffvl'): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.query('DELETE FROM sites WHERE provider = $1', [provider]);
    for (const part of chunk(sites, 300))
      await tx.query(
        `INSERT INTO sites (id, provider, kind, name, geom, altitude, orientations, description, url, status, details)
         SELECT x->>'provider' || ':' || (x->>'id'), x->>'provider', x->>'kind', x->>'name',
                ST_SetSRID(ST_MakePoint((x->>'lon')::float8, (x->>'lat')::float8), 4326),
                (x->>'altitude')::real, coalesce(x->'orientations', '[]'::jsonb), x->>'description', x->>'url', coalesce(x->>'status', 'official'),
                x->'details'
         FROM jsonb_array_elements($1::jsonb) x
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(part)],
      );
  });
}
