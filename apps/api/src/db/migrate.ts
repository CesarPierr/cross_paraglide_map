/** Applies the numbered SQL files of ./migrations once each, in order. */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Db } from './client';

const DIR = new URL('./migrations/', import.meta.url);

/** Migrations are embedded at build time when available (single-file bundle). */
declare const __MIGRATIONS__: Record<string, string> | undefined;

async function migrationFiles(): Promise<[string, string][]> {
  if (typeof __MIGRATIONS__ !== 'undefined') return Object.entries(__MIGRATIONS__).sort(([a], [b]) => a.localeCompare(b));
  const dir = DIR.pathname;
  const names = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  return Promise.all(names.map(async (n) => [n, await readFile(join(dir, n), 'utf8')] as [string, string]));
}

export async function migrate(db: Db, log: (msg: string) => void = () => {}): Promise<string[]> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name));
  const applied: string[] = [];
  for (const [name, sql] of await migrationFiles()) {
    if (done.has(name)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    });
    log(`migration ${name} applied`);
    applied.push(name);
  }
  return applied;
}
