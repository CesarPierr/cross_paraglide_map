/**
 * Tile cache (service worker): map tiles are kept on the device and served from it first,
 * so a place already seen loads at once, across sessions and offline. Only the tile
 * servers are touched; the site's own files and data are never cached here.
 * IGN sends no caching headers at all and the elevation tiles only revalidation ones:
 * without this, every session downloaded the landscape again.
 */
const CACHE = 'brises-tiles-v1';
const MAX_ENTRIES = 15000;
const PRUNE_BATCH = 1500;
const HOSTS = ['data.geopf.fr', 's3.amazonaws.com', 'tiles.maps.eox.at', 'tiles.openfreemap.org', 'a.tile.opentopomap.org', 'b.tile.opentopomap.org', 'c.tile.opentopomap.org'];

function isTile(url) {
  if (!HOSTS.includes(url.hostname)) return false;
  if (url.hostname === 'data.geopf.fr') return url.searchParams.get('REQUEST') === 'GetTile';
  if (url.hostname === 's3.amazonaws.com') return url.pathname.startsWith('/elevation-tiles-prod/');
  return true;
}

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
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok && (res.type === 'cors' || res.type === 'basic')) {
        e.waitUntil(
          cache.put(e.request, res.clone()).then(() => {
            if (++inserts % 400 === 0) return prune(cache);
          }),
        );
      }
      return res;
    })(),
  );
});
