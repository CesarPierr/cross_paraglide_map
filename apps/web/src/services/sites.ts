/**
 * Site directories (take-offs / landings), all free and keyless:
 *
 * - FFVL official list (data.gouv.fr, Licence Ouverte), imported at build time
 *   by `npm run data:sites -- <file>` into public/data/sites-ffvl.json;
 * - OpenStreetMap (`free_flying:*`, `sport=free_flying`) through Overpass, ODbL;
 * - ParaglidingEarth community database (GeoJSON API).
 *
 * Browser-side providers fail soft: a directory that is down or refuses CORS
 * simply contributes nothing.
 */
import { parseOrientations, type FlyingSite, type SiteKind, type SiteProvider } from '@brises/shared';

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const FR: Record<string, string> = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SO', W: 'O', NW: 'NO' };

// ---------- FFVL (baked) ----------

let ffvlCache: Promise<FlyingSite[]> | null = null;

export const ffvlSites: SiteProvider = {
  id: 'ffvl',
  label: 'FFVL (sites officiels)',
  attribution: 'Sites © <a href="https://www.data.gouv.fr/datasets/la-liste-des-sites-de-pratique-de-vol-libre" target="_blank" rel="noopener">FFVL / data.gouv.fr</a>',
  minZoom: 6,
  async fetch(bbox) {
    ffvlCache ??= fetch('data/sites-ffvl.json')
      .then((r) => (r.ok ? (r.json() as Promise<FlyingSite[]>) : []))
      .catch(() => []);
    const [w, s, e, n] = bbox;
    return (await ffvlCache).filter((x) => x.lon >= w && x.lon <= e && x.lat >= s && x.lat <= n);
  },
};

// ---------- OpenStreetMap (Overpass) ----------

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function osmKind(tags: Record<string, string>): SiteKind {
  const site = tags['free_flying:site'] ?? '';
  if (/takeoff|toplanding/.test(site)) return 'takeoff';
  if (/landing/.test(site)) return 'landing';
  if (tags['free_flying:takeoff'] === 'yes') return 'takeoff';
  if (tags['free_flying:landing'] === 'yes') return 'landing';
  return 'site';
}

export const osmSites: SiteProvider = {
  id: 'osm',
  label: 'OpenStreetMap',
  attribution: 'Sites © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">contributeurs OpenStreetMap</a> (ODbL)',
  minZoom: 9,
  async fetch([w, s, e, n], signal) {
    const bbox = `${s},${w},${n},${e}`;
    const query = `[out:json][timeout:20];(nwr["free_flying:site"](${bbox});nwr["sport"="free_flying"](${bbox}););out center tags 400;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }), signal });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const j = (await res.json()) as { elements: OsmElement[] };
    return j.elements.flatMap((el): FlyingSite[] => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      if (lat === undefined || lon === undefined) return [];
      const ele = Number.parseFloat(tags.ele);
      return [
        {
          id: `${el.type}/${el.id}`,
          provider: 'osm',
          kind: osmKind(tags),
          name: tags.name ?? tags['name:fr'] ?? 'Site (OSM)',
          lon,
          lat,
          altitude: Number.isFinite(ele) ? ele : undefined,
          orientations: parseOrientations(tags['free_flying:site_orientation'] ?? tags['free_flying:takeoff:direction'] ?? tags.direction),
          description: tags.description,
          url: tags.website ?? tags.url ?? `https://www.openstreetmap.org/${el.type}/${el.id}`,
          status: /ffvl|fédération/i.test(tags.operator ?? '') ? 'official' : 'community',
        },
      ];
    });
  },
};

// ---------- ParaglidingEarth ----------

interface PgeFeature {
  id?: number | string;
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

const PGE_HOSTS = ['https://www.paraglidingearth.com', 'https://paragliding.earth'];

export const pgeSites: SiteProvider = {
  id: 'pge',
  label: 'ParaglidingEarth',
  attribution: 'Sites © <a href="https://www.paraglidingearth.com" target="_blank" rel="noopener">ParaglidingEarth</a>',
  minZoom: 8,
  async fetch([w, s, e, n], signal) {
    let lastError: unknown = null;
    for (const host of PGE_HOSTS) {
      try {
        const url = `${host}/api/geojson/getBoundingBoxSites.php?${new URLSearchParams({ north: String(n), south: String(s), east: String(e), west: String(w), limit: '300', style: 'detailled' })}`;
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`PGE ${res.status}`);
        const j = (await res.json()) as { features?: PgeFeature[] };
        return (j.features ?? []).flatMap((f): FlyingSite[] => {
          const p = f.properties ?? {};
          const c = f.geometry?.coordinates;
          if (!c) return [];
          const id = String(p.pge_site_id ?? f.id ?? `${c[0]},${c[1]}`);
          const orient = SECTORS.filter((k) => Number(p[k]) > 0).map((k) => FR[k]);
          const alt = Number(p.takeoff_altitude);
          const out: FlyingSite[] = [
            {
              id,
              provider: 'pge',
              kind: 'takeoff',
              name: String(p.name ?? 'Site'),
              lon: c[0],
              lat: c[1],
              altitude: Number.isFinite(alt) && alt > 0 ? alt : undefined,
              orientations: orient,
              description: typeof p.takeoff_description === 'string' ? p.takeoff_description : undefined,
              url: typeof p.pge_link === 'string' ? p.pge_link : `https://www.paraglidingearth.com/?site=${id}`,
              status: 'community',
            },
          ];
          const llat = Number(p.landing_lat);
          const llng = Number(p.landing_lng);
          if (Number.isFinite(llat) && Number.isFinite(llng) && llat && llng)
            out.push({ id: `${id}-l`, provider: 'pge', kind: 'landing', name: `Atterrissage – ${String(p.name ?? '')}`, lon: llng, lat: llat, status: 'community' });
          return out;
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        lastError = err;
      }
    }
    throw lastError ?? new Error('PGE indisponible');
  },
};

export const SITE_PROVIDERS: SiteProvider[] = [ffvlSites, osmSites, pgeSites];
