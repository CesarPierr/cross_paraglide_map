/**
 * Tile cache (service worker): map tiles are kept on the device and served from it first,
 * so a place already seen loads at once, across sessions and offline. Only the tile
 * servers are touched; the site's own files and data are never cached here.
 * IGN sends no caching headers at all and the elevation tiles only revalidation ones:
 * without this, every session downloaded the landscape again.
 *
 * Outside France, IGN's orthophotos answer the finer levels with a blank white tile (always
 * the same 1651 bytes) or nothing (404): the blank tile, drawn, is a flat white sheet over
 * Switzerland or Italy. It is answered as missing instead: MapLibre then draws the coarser
 * level, which has real imagery there, and the Sentinel-2 backdrop. (The tiles across the
 * border, France in imagery and the rest white, stay as they are: their white cannot be told
 * by its pixels from a glacier's.)
 */
const CACHE = 'brises-tiles-v1';
const MAX_ENTRIES = 15000;
const PRUNE_BATCH = 1500;
const HOSTS = ['data.geopf.fr', 's3.amazonaws.com', 'elevation-tiles-prod.s3.amazonaws.com', 'tiles.maps.eox.at', 'tiles.openfreemap.org', 'a.tile.opentopomap.org', 'b.tile.opentopomap.org', 'c.tile.opentopomap.org'];
const BLANK_IGN = { bytes: 1651, sha256: '11c9176ec2896e0a2a5e945e47b0ee223686701c32aab229952b5f150e191bc5' };

function isTile(url) {
  if (!HOSTS.includes(url.hostname)) return false;
  if (url.hostname === 'data.geopf.fr') return url.searchParams.get('REQUEST') === 'GetTile';
  if (url.hostname === 's3.amazonaws.com') return url.pathname.startsWith('/elevation-tiles-prod/');
  return true;
}

/** IGN's blank tile (outside France), told by its size, then its bytes. */
async function isBlank(url, res) {
  if (url.hostname !== 'data.geopf.fr' || !res.ok || res.headers.get('content-length') !== String(BLANK_IGN.bytes)) return false;
  const buf = await res.clone().arrayBuffer();
  if (buf.byteLength !== BLANK_IGN.bytes) return false;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('') === BLANK_IGN.sha256;
}

const missing = () => new Response(null, { status: 404, statusText: 'Not Found' });

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

let inserts = 0;
async function prune(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  // Oldest first: Cache Storage keeps insertion order.
  await Promise.all(keys.slice(0, keys.length - MAX_ENTRIES + PRUNE_BATCH).map((k) => cache.delete(k)));
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  let url;
  try {
    url = new URL(e.request.url);
  } catch {
    return;
  }
  if (!isTile(url)) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(e.request, { ignoreVary: true });
      if (hit) return (await isBlank(url, hit)) ? missing() : hit;
      const res = await fetch(e.request);
      if (res.ok && (res.type === 'cors' || res.type === 'basic')) {
        e.waitUntil(
          cache.put(e.request, res.clone()).then(() => {
            if (++inserts % 400 === 0) return prune(cache);
          }),
        );
      }
      return (await isBlank(url, res)) ? missing() : res;
    })(),
  );
});
