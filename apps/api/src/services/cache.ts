/**
 * Cache for upstream HTTP data (forecasts, external directories):
 * memory LRU → database → upstream, with
 * - per-entry expiry decided by the loader (e.g. "until the next model run"),
 * - request coalescing (concurrent identical misses share one upstream call),
 * - stale fallback when the upstream fails or the daily quota is spent.
 */
import type { Db } from '../db/client';

export interface Cached<T> {
  value: T;
  version: string | null;
  fetchedAt: number;
  expiresAt: number;
  stale: boolean;
}

export interface Loaded<T> {
  value: T;
  version: string | null;
  expiresAt: number;
}

export class UpstreamCache {
  private memory = new Map<string, Cached<unknown>>();
  private inflight = new Map<string, Promise<Cached<unknown>>>();

  constructor(
    private db: Db,
    private maxEntries = 5000,
  ) {}

  private remember(key: string, entry: Cached<unknown>): void {
    this.memory.delete(key);
    this.memory.set(key, entry);
    if (this.memory.size > this.maxEntries) this.memory.delete(this.memory.keys().next().value!);
  }

  private async fromDb<T>(key: string): Promise<Cached<T> | null> {
    const rows = await this.db.query<{ payload: T; version: string | null; fetched_at: Date | string; expires_at: Date | string }>(
      'SELECT payload, version, fetched_at, expires_at FROM http_cache WHERE key = $1',
      [key],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { value: r.payload, version: r.version, fetchedAt: new Date(r.fetched_at).getTime(), expiresAt: new Date(r.expires_at).getTime(), stale: false };
  }

  /**
   * Returns the cached value while it is fresh: not expired and, when `version`
   * is given, produced from that upstream version (e.g. the current model run).
   * An older entry is kept as fallback if the reload fails.
   */
  async get<T>(key: string, load: () => Promise<Loaded<T>>, now = Date.now(), version: string | null = null): Promise<Cached<T>> {
    const fresh = (e: Cached<unknown> | null | undefined) => !!e && e.expiresAt > now && (version === null || e.version === version);
    const mem = this.memory.get(key) as Cached<T> | undefined;
    if (fresh(mem)) return { ...mem!, stale: false };
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<Cached<T>>;
    const job = (async (): Promise<Cached<T>> => {
      const stored = mem ?? (await this.fromDb<T>(key));
      if (stored && fresh(stored)) {
        this.remember(key, stored);
        return stored;
      }
      try {
        const loaded = await load();
        const entry: Cached<T> = { value: loaded.value, version: loaded.version, fetchedAt: now, expiresAt: loaded.expiresAt, stale: false };
        this.remember(key, entry);
        await this.db.query(
          `INSERT INTO http_cache (key, version, fetched_at, expires_at, payload) VALUES ($1, $2, to_timestamp($3 / 1000.0), to_timestamp($4 / 1000.0), $5::jsonb)
           ON CONFLICT (key) DO UPDATE SET version = excluded.version, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at, payload = excluded.payload`,
          [key, loaded.version, now, loaded.expiresAt, JSON.stringify(loaded.value)],
        );
        return entry;
      } catch (err) {
        // Upstream down or quota spent: an outdated answer beats none, flagged as such.
        if (stored) return { ...stored, stale: true };
        throw err;
      }
    })();
    this.inflight.set(key, job as Promise<Cached<unknown>>);
    try {
      return await job;
    } finally {
      this.inflight.delete(key);
    }
  }

  /** Removes expired rows (run periodically). */
  async purge(olderThanHours = 48): Promise<void> {
    await this.db.query(`DELETE FROM http_cache WHERE expires_at < now() - make_interval(hours => $1)`, [olderThanHours]);
  }
}

export class QuotaExceededError extends Error {
  constructor(public provider: string) {
    super(`quota ${provider} atteint`);
  }
}

/** Weighted daily call counter per upstream provider, persisted so restarts do not reset it. */
export class QuotaMeter {
  private day = '';
  private used = new Map<string, number>();

  constructor(
    private db: Db,
    private budgets: Record<string, number>,
  ) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async load(provider: string): Promise<number> {
    const day = this.today();
    if (day !== this.day) {
      this.day = day;
      this.used.clear();
    }
    if (!this.used.has(provider)) {
      const rows = await this.db.query<{ calls: number }>('SELECT calls FROM api_usage WHERE day = $1 AND provider = $2', [day, provider]);
      this.used.set(provider, Number(rows[0]?.calls ?? 0));
    }
    return this.used.get(provider)!;
  }

  /** Reserves `cost` calls or throws QuotaExceededError. */
  async consume(provider: string, cost: number): Promise<void> {
    const used = await this.load(provider);
    const budget = this.budgets[provider] ?? Infinity;
    if (used + cost > budget) throw new QuotaExceededError(provider);
    this.used.set(provider, used + cost);
    await this.db.query(
      `INSERT INTO api_usage (day, provider, calls) VALUES ($1, $2, $3) ON CONFLICT (day, provider) DO UPDATE SET calls = api_usage.calls + excluded.calls`,
      [this.day, provider, cost],
    );
  }

  /** Marks the provider as spent for the rest of the UTC day (upstream answered 429). */
  async exhaust(provider: string): Promise<void> {
    const used = await this.load(provider);
    const budget = this.budgets[provider] ?? used;
    if (used < budget) await this.consume(provider, budget - used);
  }

  async usage(): Promise<Record<string, { used: number; budget: number }>> {
    const out: Record<string, { used: number; budget: number }> = {};
    for (const p of Object.keys(this.budgets)) out[p] = { used: await this.load(p), budget: this.budgets[p] };
    return out;
  }
}
