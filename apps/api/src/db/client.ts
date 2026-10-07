/**
 * Minimal database port: parameterised SQL in, plain rows out. Production
 * uses the `postgres` driver (pooled, prepared statements); development and
 * tests use PGlite (PostgreSQL + PostGIS compiled to WASM, in-process).
 */
import type postgresLib from 'postgres';
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs a multi-statement script (migrations). */
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly kind: 'postgres' | 'pglite';
}

export async function createDb(url: string): Promise<Db> {
  if (url.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { postgis } = await import('@electric-sql/pglite-postgis');
    const target = url.slice('pglite:'.length);
    const pg = await PGlite.create(target === 'memory' ? undefined : target, { extensions: { postgis } });
    const wrap = (q: { query: typeof pg.query; exec: typeof pg.exec }): Db => ({
      kind: 'pglite',
      async query<T>(sql: string, params: unknown[] = []) {
        return (await q.query<T>(sql, params)).rows;
      },
      async exec(sql: string) {
        await q.exec(sql);
      },
      transaction: (fn) => pg.transaction((tx) => fn(wrap(tx as unknown as typeof pg))),
      close: () => pg.close(),
    });
    return wrap(pg);
  }
  const { default: postgres } = await import('postgres');
  // Queries pass JSON as text (`$1::jsonb`, same as PGlite): keep strings as-is instead of
  // letting the driver JSON-encode them a second time into a scalar.
  const json = (oid: number) => ({ to: oid, from: [oid], serialize: (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x)), parse: (x: string) => JSON.parse(x) as unknown });
  const sql = postgres(url, { max: 10, idle_timeout: 30, prepare: true, onnotice: () => {}, types: { json: json(114), jsonb: json(3802) } });
  const wrap = (s: typeof sql | postgresLib.TransactionSql): Db => ({
    kind: 'postgres',
    async query<T>(text: string, params: unknown[] = []) {
      return (await s.unsafe(text, params as never[])) as unknown as T[];
    },
    async exec(text: string) {
      await s.unsafe(text);
    },
    transaction: <T>(fn: (tx: Db) => Promise<T>) => sql.begin((tx) => fn(wrap(tx))) as Promise<T>,
    close: () => sql.end({ timeout: 5 }),
  });
  return wrap(sql);
}
