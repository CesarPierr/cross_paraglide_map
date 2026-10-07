/** Loads (or reloads) the knowledge base: npm run seed -w @brises/api -- [atlas.json] [sites-ffvl.json] */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Atlas, FlyingSite } from '@brises/shared';
import { loadConfig } from '../config';
import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { seedAtlas, seedSites } from '../db/seed';

const root = resolve(import.meta.dirname, '../../../..');
const atlasPath = process.argv[2] ?? resolve(root, 'apps/web/public/data/atlas.json');
const sitesPath = process.argv[3] ?? resolve(root, 'apps/web/public/data/sites-ffvl.json');
const db = await createDb(loadConfig().databaseUrl);
await migrate(db, console.log);
const atlas = JSON.parse(await readFile(atlasPath, 'utf8')) as Atlas;
await seedAtlas(db, atlas);
console.log(`atlas: ${atlas.stats.massifs} massifs, ${atlas.stats.breezes} brises`);
const sites = JSON.parse(await readFile(sitesPath, 'utf8').catch(() => '[]')) as FlyingSite[];
await seedSites(db, sites);
console.log(`sites FFVL: ${sites.length}`);
await db.close();
