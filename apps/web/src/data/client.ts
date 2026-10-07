/**
 * Data access for the web app. The deployed site talks to the API (database
 * of local knowledge, flying sites, user contributions); a static fallback
 * (files baked into /data + pre-filled GitHub issues for contributions) keeps
 * the map usable without a server, e.g. for a static preview.
 */
import { inflateAtlas, openMeteo, type Atlas, type AtlasText, type ContributionInput, type FeedbackSummary, type FlyingSite, type PointForecast, type SiteProvider, type SynopticWind, type WeatherProvider } from '@brises/shared';
import type { GridMeta } from '@brises/model';
import { osmSites, pgeSites } from '@brises/shared';
import { ffvlSites } from '../services/sites';

export interface DataClient {
  readonly mode: 'api' | 'static';
  /** Light core of the atlas: enough for the map and the model. */
  atlas(): Promise<Atlas>;
  /** Text part (descriptions, notes, summaries, figures), merged after the first render. */
  atlasText(): Promise<AtlasText>;
  demMeta(): Promise<GridMeta>;
  demUrl(): string;
  siteProviders(): SiteProvider[];
  /** Forecast: through the API cache when deployed (shared quota), direct otherwise. */
  weather(): WeatherProvider;
  submitContribution(c: ContributionInput): Promise<{ id: string; url?: string }>;
  feedbackSummary(targetRef: string): Promise<FeedbackSummary | null>;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';
const REPO = 'CesarPierr/cross_paraglide_map';

const staticUrl = (path: string) => new URL(`data/${path}`, document.baseURI).href;

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

/** Contribution as a pre-filled GitHub issue (static mode): human readable + machine block. */
export function contributionIssueUrl(c: ContributionInput): string {
  const title = `[${c.kind}] ${c.title ?? c.targetRef ?? 'Contribution'}`.slice(0, 120);
  const body = [
    c.message,
    '',
    c.sourceUrl ? `Source : ${c.sourceUrl}` : '',
    '',
    '<!-- Données structurées (importables) — ne pas modifier -->',
    '```json',
    JSON.stringify({ ...c, email: undefined }, null, 2),
    '```',
  ].join('\n');
  return `https://github.com/${REPO}/issues/new?${new URLSearchParams({ title, body, labels: 'contribution' })}`;
}

class StaticClient implements DataClient {
  readonly mode = 'static' as const;
  atlas = () => json<Atlas>(staticUrl('atlas-core.json')).then(inflateAtlas);
  atlasText = () => json<AtlasText>(staticUrl('atlas-text.json'));
  demMeta = () => json<GridMeta>(staticUrl('dem.json'));
  demUrl = () => staticUrl('dem.png');
  siteProviders = () => [ffvlSites, osmSites, pgeSites];
  weather = () => openMeteo;
  async submitContribution(c: ContributionInput) {
    const url = contributionIssueUrl(c);
    window.open(url, '_blank', 'noopener');
    return { id: 'github', url };
  }
  feedbackSummary = async () => null;
}

/** Directory proxied and cached by the API (no CORS, shared cache). */
function apiSiteProvider(id: 'osm' | 'pge', base: SiteProvider): SiteProvider {
  return {
    ...base,
    async fetch([w, s, e, n], signal) {
      return json<FlyingSite[]>(`${API_BASE}/sites/external/${id}?bbox=${[w, s, e, n].join(',')}`, { signal });
    },
  };
}

class ApiClient implements DataClient {
  readonly mode = 'api' as const;
  atlas = () => json<Atlas>(`${API_BASE}/atlas`).then(inflateAtlas);
  atlasText = () => json<AtlasText>(`${API_BASE}/atlas/text`);
  demMeta = () => json<GridMeta>(staticUrl('dem.json'));
  demUrl = () => staticUrl('dem.png');
  siteProviders(): SiteProvider[] {
    const official: SiteProvider = {
      ...ffvlSites,
      fetch: ([w, s, e, n], signal) => json<FlyingSite[]>(`${API_BASE}/sites?bbox=${[w, s, e, n].join(',')}`, { signal }),
    };
    return [official, apiSiteProvider('osm', osmSites), apiSiteProvider('pge', pgeSites)];
  }
  private weatherProvider: WeatherProvider = {
    ...openMeteo,
    synoptic: (lat, lon, signal) => json<SynopticWind[]>(`${API_BASE}/weather/synoptic?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, { signal }),
    pointForecast: (lat, lon, signal) => json<{ elevation: number; hours: PointForecast[] }>(`${API_BASE}/weather/point?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, { signal }),
  };
  weather = () => this.weatherProvider;
  async submitContribution(c: ContributionInput) {
    return json<{ id: string }>(`${API_BASE}/contributions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(c),
    });
  }
  async feedbackSummary(targetRef: string) {
    try {
      return await json<FeedbackSummary>(`${API_BASE}/contributions/summary?targetRef=${encodeURIComponent(targetRef)}`);
    } catch {
      return null;
    }
  }
}

/** Uses the API when it answers quickly, otherwise the static files. */
export async function createDataClient(): Promise<DataClient> {
  if (import.meta.env.VITE_STATIC === 'true') return new StaticClient();
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
    window.clearTimeout(t);
    if (res.ok && (await res.json()).ok) return new ApiClient();
  } catch {
    /* no API: static mode */
  }
  return new StaticClient();
}
