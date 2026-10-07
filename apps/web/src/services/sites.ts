/**
 * Site directories (take-offs / landings), all free and keyless:
 *
 * - FFVL official site sheets (coordinates, winds, dangers, aerology), imported at
 *   build time by `npm run data:sites -- <file>` into public/data/sites-ffvl.json;
 * - OpenStreetMap (`free_flying:*`, `sport=free_flying`) through Overpass, ODbL;
 * - ParaglidingEarth community database (GeoJSON API).
 *
 * Browser-side providers fail soft: a directory that is down or refuses CORS
 * simply contributes nothing.
 */
import type { FlyingSite, SiteProvider } from '@brises/shared';

// ---------- FFVL (baked) ----------

let ffvlCache: Promise<FlyingSite[]> | null = null;

export const ffvlSites: SiteProvider = {
  id: 'ffvl',
  label: 'FFVL (sites officiels)',
  attribution: 'Sites © <a href="https://federation.ffvl.fr/" target="_blank" rel="noopener">FFVL</a>, fiches des terrains de pratique',
  minZoom: 6,
  async fetch(bbox) {
    ffvlCache ??= fetch('data/sites-ffvl.json')
      .then((r) => (r.ok ? (r.json() as Promise<FlyingSite[]>) : []))
      .catch(() => []);
    const [w, s, e, n] = bbox;
    return (await ffvlCache).filter((x) => x.lon >= w && x.lon <= e && x.lat >= s && x.lat <= n);
  },
};

export { osmSites, pgeSites } from '@brises/shared';
