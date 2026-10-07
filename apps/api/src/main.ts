/** API server entry point: migrate, seed on first start, listen. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Atlas, FlyingSite } from '@brises/shared';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createDb } from './db/client';
import { migrate } from './db/migrate';
import { seedAtlas, seedSites } from './db/seed';

async function main() {
  const config = loadConfig();
  const db = await createDb(config.databaseUrl);
  await migrate(db, (m) => console.log(m));
  const [{ n }] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM massifs');
  // In development (`npm run dev:api` from apps/api) the atlas built for the web app is the default seed.
  const seedAtlasPath = process.env.SEED_ATLAS ?? (existsSync('../web/public/data/atlas.json') ? '../web/public/data/atlas.json' : undefined);
  const seedSitesPath = process.env.SEED_SITES ?? (existsSync('../web/public/data/sites-ffvl.json') ? '../web/public/data/sites-ffvl.json' : undefined);
  if (n === 0 && seedAtlasPath) {
    console.log(`seeding atlas from ${seedAtlasPath}`);
    await seedAtlas(db, JSON.parse(await readFile(seedAtlasPath, 'utf8')) as Atlas);
    if (seedSitesPath) await seedSites(db, JSON.parse(await readFile(seedSitesPath, 'utf8').catch(() => '[]')) as FlyingSite[]);
  }
  const { app } = await buildApp(config, db);
  const shutdown = async () => {
    await app.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
