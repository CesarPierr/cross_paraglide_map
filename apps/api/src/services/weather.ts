/**
 * Forecasts shared by all users: one upstream call per (rounded location,
 * model run), cached until the next run of the model is published.
 *
 * Expiry rule: Open-Meteo publishes per model the time the last run became
 * available and the update interval; an entry is valid until
 * `last availability + interval + grace`, clamped to [10 min, 3 h]. When the
 * run metadata is unreachable the entry lives 60 minutes.
 */
import {
  openMeteo,
  UpstreamHttpError,
  POINT_COST,
  PROFILE_MODEL_DOMAIN,
  type PointForecast,
  type SynopticWind,
  type WeatherProvider,
} from "@brises/shared";
import {
  QuotaExceededError,
  QuotaMeter,
  UpstreamCache,
  type Cached,
} from "./cache";

export interface ModelRun {
  /** Run identifier (initialisation time, ISO). */
  id: string;
  /** When the next run is expected to be available (ms). */
  nextAvailableAt: number;
}

export type RunProbe = (model: string) => Promise<ModelRun | null>;

const MIN_TTL = 10 * 60_000;
const MAX_TTL = 3 * 3600_000;
const FALLBACK_TTL = 60 * 60_000;
const GRACE = 10 * 60_000;
/** Model whose run cadence drives the expiry (AROME, the reference over the French Alps). */
export const REFERENCE_MODEL = PROFILE_MODEL_DOMAIN;

/** Reads Open-Meteo's model metadata (last run, update interval). */
export function openMeteoRunProbe(fetchImpl: typeof fetch = fetch): RunProbe {
  const cache = new Map<string, { at: number; run: ModelRun | null }>();
  return async (model) => {
    const hit = cache.get(model);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.run;
    let run: ModelRun | null = null;
    try {
      const res = await fetchImpl(
        `https://api.open-meteo.com/data/${model}/static/meta.json`,
      );
      if (res.ok) {
        const m = (await res.json()) as {
          last_run_initialisation_time?: number;
          last_run_availability_time?: number;
          update_interval_seconds?: number;
        };
        if (
          m.last_run_initialisation_time &&
          m.last_run_availability_time &&
          m.update_interval_seconds
        )
          run = {
            id: new Date(m.last_run_initialisation_time * 1000).toISOString(),
            nextAvailableAt:
              (m.last_run_availability_time + m.update_interval_seconds) * 1000,
          };
      }
    } catch {
      run = null;
    }
    cache.set(model, { at: Date.now(), run });
    return run;
  };
}

export function expiryFor(run: ModelRun | null, now: number): number {
  if (!run) return now + FALLBACK_TTL;
  return Math.min(
    now + MAX_TTL,
    Math.max(now + MIN_TTL, run.nextAvailableAt + GRACE),
  );
}

const round = (v: number, step: number) => Math.round(v / step) * step;

export class WeatherService {
  constructor(
    private cache: UpstreamCache,
    private quota: QuotaMeter,
    private probe: RunProbe,
    private provider: WeatherProvider = openMeteo,
  ) {}

  /** Ridge-level wind: smooth field, 0.25° (~25 km) sharing. 4 variables → 1 call. */
  synoptic(lat: number, lon: number): Promise<Cached<SynopticWind[]>> {
    const la = round(lat, 0.25);
    const lo = round(lon, 0.25);
    return this.cached(`wx:syn:${la.toFixed(2)}:${lo.toFixed(2)}`, 1, () =>
      this.provider.synoptic(la, lo),
    );
  }

  /** Soaring profile at a point: 0.02° (~2 km, the AROME mesh) sharing. */
  point(
    lat: number,
    lon: number,
  ): Promise<Cached<{ elevation: number; hours: PointForecast[] }>> {
    const la = round(lat, 0.02);
    const lo = round(lon, 0.02);
    return this.cached(
      `wx:pt:${la.toFixed(2)}:${lo.toFixed(2)}`,
      POINT_COST,
      () => this.provider.pointForecast!(la, lo),
    );
  }

  private async cached<T>(
    key: string,
    cost: number,
    fetcher: () => Promise<T>,
  ): Promise<Cached<T>> {
    const run = await this.probe(REFERENCE_MODEL);
    // Entries are tagged with the run they come from: a new run makes them obsolete at once,
    // but they remain the fallback if the upstream is down or rate limited.
    return this.cache.get<T>(
      key,
      async () => {
        await this.quota.consume("open-meteo", cost);
        let value: T;
        try {
          value = await fetcher();
        } catch (err) {
          // Upstream rate limit (shared IP…): serve stale meanwhile; a daily limit stops all calls until the UTC reset.
          if (err instanceof UpstreamHttpError && err.status === 429) {
            if (/daily/i.test(err.reason))
              await this.quota.exhaust("open-meteo");
            throw new QuotaExceededError("open-meteo");
          }
          throw err;
        }
        const now = Date.now();
        return {
          value,
          version: run?.id ?? null,
          expiresAt: expiryFor(run, now),
        };
      },
      Date.now(),
      run?.id ?? null,
    );
  }
}
