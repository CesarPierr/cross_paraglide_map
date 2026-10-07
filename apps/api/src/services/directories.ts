/**
 * Server-side proxy for community site directories (OSM Overpass,
 * ParaglidingEarth): avoids browser CORS issues and shares one cached answer
 * per 0.5° tile between all users. Sites change slowly: 24 h cache.
 */
import { osmSites, pgeSites, type FlyingSite, type SiteProvider } from '@brises/shared';
import { QuotaMeter, UpstreamCache } from './cache';

const TTL = 24 * 3600_000;
const TILE = 0.5;

export const DIRECTORIES: Record<string, SiteProvider> = { osm: osmSites, pge: pgeSites };

export class DirectoryService {
  constructor(
    private cache: UpstreamCache,
    private quota: QuotaMeter,
    private providers: Record<string, SiteProvider> = DIRECTORIES,
  ) {}

  async sites(providerId: string, bbox: [number, number, number, number]): Promise<{ sites: FlyingSite[]; stale: boolean }> {
    const p = this.providers[providerId];
    if (!p) throw new Error('unknown provider');
    const [w, s, e, n] = bbox;
    const tiles: [number, number][] = [];
    for (let x = Math.floor(w / TILE); x <= Math.floor(e / TILE); x++) for (let y = Math.floor(s / TILE); y <= Math.floor(n / TILE); y++) tiles.push([x, y]);
    if (tiles.length > 16) throw new Error('bbox too large');
    let stale = false;
    const all = await Promise.all(
      tiles.map(async ([x, y]) => {
        const r = await this.cache.get<FlyingSite[]>(`dir:${providerId}:${x}:${y}`, async () => {
          await this.quota.consume(providerId, 1);
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 20_000);
          try {
            const value = await p.fetch([x * TILE, y * TILE, (x + 1) * TILE, (y + 1) * TILE], ctrl.signal);
            return { value, version: null, expiresAt: Date.now() + TTL };
          } finally {
            clearTimeout(timer);
          }
        });
        stale ||= r.stale;
        return r.value;
      }),
    );
    const seen = new Set<string>();
    const sites = all.flat().filter((site) => {
      if (seen.has(site.id) || site.lon < w || site.lon > e || site.lat < s || site.lat > n) return false;
      seen.add(site.id);
      return true;
    });
    return { sites, stale };
  }
}
