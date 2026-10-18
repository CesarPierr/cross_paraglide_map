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
 * level, which has real imagery there, and the Sentinel-2 backdrop.
 *
 * The tiles across the border, France in imagery and the rest in that white, are mended
 * (tiles-border.js). Under the z12 tiles that the border crosses, a tile whose reduced copy holds
 * white is decoded and its fill replaced by the z12 imagery stretched, as MapLibre draws it under
 * the missing tiles; the result is kept in the cache, so the work is done once. A glacier is as
 * white as the fill: tiles-border.js tells them apart, and in doubt a tile is left as IGN sent it
 * (no ancestor to be had, no OffscreenCanvas, any error). Decoding and encoding are the browser's,
 * off this thread, which only goes over the pixels of the tiles that hold white (a few ms each).
 */
const CACHE = 'brises-tiles-v1';
const MAX_ENTRIES = 15000;
const PRUNE_BATCH = 1500;
const HOSTS = ['data.geopf.fr', 's3.amazonaws.com', 'elevation-tiles-prod.s3.amazonaws.com', 'tiles.maps.eox.at', 'tiles.openfreemap.org', 'a.tile.opentopomap.org', 'b.tile.opentopomap.org', 'c.tile.opentopomap.org'];
const BLANK_IGN = { bytes: 1651, sha256: '11c9176ec2896e0a2a5e945e47b0ee223686701c32aab229952b5f150e191bc5' };

/** The tile of the border zone (tiles-border.js), if the file is there and the browser can decode and encode images. */
try {
  importScripts('tiles-border.js');
} catch {
  /* the tiles are served as they come */
}
const BORDER = self.TilesBorder && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function' ? self.TilesBorder : null;
/** Header of a cached tile of the zone that has been looked at: the version of tiles-border.js, then 'clean' (nothing to mend) or 'mended'. */
const SEEN = 'x-border-fill';
const SIZE = 256;
/** Size of the reduced copy that tells which tiles hold no white at all. */
const SORT = 64;
const MAX_MENDING = 4;
const ANCESTOR_TIMEOUT_MS = 12000;
const ANCESTORS_KEPT = 24;

function isTile(url) {
  if (!HOSTS.includes(url.hostname)) return false;
  if (url.hostname === 'data.geopf.fr') return url.searchParams.get('REQUEST') === 'GetTile';
  if (url.hostname === 's3.amazonaws.com') return url.pathname.startsWith('/elevation-tiles-prod/');
  return true;
}

/** The tile of an orthophoto under a z12 tile that the border crosses, or null. */
function borderTile(url) {
  if (!BORDER || url.hostname !== 'data.geopf.fr') return null;
  const t = BORDER.parseTile(url.href);
  return t && BORDER.isBorderTile(t.z, t.x, t.y) ? t : null;
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

// ---- Mending the tiles across the border ---------------------------------------------------

/**
 * What it costs, for the page to ask (message { type: 'border-stats' }, answered on the port sent along, or to the sender).
 * Times in ms, summed over the tiles: of the whole stay in the worker (`totalMs`, the body and the ancestor waited for included),
 * and of the passes over pixels that hold the worker's own thread (`syncMs`); decoding and encoding are the browser's, off it.
 */
const stats = { zone: 0, sorted: 0, decoded: 0, mended: 0, noAncestor: 0, failed: 0, bodyMs: 0, sortMs: 0, decodeMs: 0, waitMs: 0, pixelsMs: 0, encodeMs: 0, syncMs: 0, totalMs: 0, maxMs: 0, bytesIn: 0, bytesOut: 0 };
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'border-stats') return;
  (e.ports[0] || e.source)?.postMessage({ type: 'border-stats', ...stats, ancestors: ancestors.size });
  if (e.data.reset) for (const k of Object.keys(stats)) stats[k] = 0;
});

const canvases = new Map();
/** Pixels of an image (RGBA), drawn in a canvas kept for its size: no await between the drawing and the reading. */
async function pixels(blob, size) {
  const bitmap = await createImageBitmap(blob, size === SIZE ? undefined : { resizeWidth: size, resizeHeight: size, resizeQuality: 'pixelated' });
  try {
    // A tile is 256 x 256 (anything else is not one); a reduced copy is drawn small here if the browser did not reduce it.
    if (size === SIZE && (bitmap.width !== SIZE || bitmap.height !== SIZE)) return null;
    let c = canvases.get(size);
    if (!c) canvases.set(size, (c = new OffscreenCanvas(size, size)));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const t0 = performance.now();
    ctx.imageSmoothingEnabled = size === SIZE;
    ctx.drawImage(bitmap, 0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    stats.syncMs += performance.now() - t0;
    return img;
  } finally {
    bitmap.close();
  }
}

/**
 * The z12 tiles asked for lately: the bytes of each (a promise, null where they could not be had) and, once wanted,
 * its pixels. A view across the border has a few of them under all its tiles.
 */
const ancestors = new Map();
/** The z12 tile under a tile of the zone; on its way as soon as it is asked for, while the tile itself still is. */
function ancestorEntry(href, t) {
  const a = BORDER.ancestorOf(t.z, t.x, t.y);
  const ahref = BORDER.tileHref(href, BORDER.ANCESTOR_Z, a.x, a.y);
  let entry = ancestors.get(ahref);
  if (entry) ancestors.delete(ahref); // the last used goes last
  else {
    entry = { href: ahref, blob: loadAncestor(ahref), pixels: null };
    // One that could not be had is not kept: the next tile tries again.
    entry.blob.then((blob) => !blob && forget(entry));
    if (ancestors.size >= ANCESTORS_KEPT) ancestors.delete(ancestors.keys().next().value);
  }
  ancestors.set(ahref, entry);
  return entry;
}
const forget = (entry) => ancestors.get(entry.href) === entry && ancestors.delete(entry.href);
const ancestorPixels = (entry) => (entry.pixels ??= entry.blob.then((blob) => (blob ? pixels(blob, SIZE) : null)).then((img) => img?.data ?? null, () => null));
async function loadAncestor(ahref) {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(ahref, { ignoreVary: true });
    if (hit) return await hit.blob();
    const res = await fetch(ahref, { signal: AbortSignal.timeout?.(ANCESTOR_TIMEOUT_MS) });
    if (!res.ok || res.type === 'opaque') return null;
    cache.put(ahref, res.clone()).catch(() => {});
    return await res.blob();
  } catch {
    return null;
  }
}

/** At most MAX_MENDING tiles at once through the decoding and the pass over the pixels: each holds a megabyte or two. A slot is handed on to the next in line. */
let mending = 0;
const mendingQueue = [];
async function mendingSlot() {
  if (mending >= MAX_MENDING) await new Promise((r) => mendingQueue.push(r));
  else mending++;
}
function mendingDone() {
  const next = mendingQueue.shift();
  if (next) next();
  else mending--;
}

/** A tile of the zone to keep, with what was found of it in a header. */
const kept = (blob, how) => new Response(blob, { status: 200, headers: { 'content-type': blob.type || 'image/jpeg', [SEEN]: `${BORDER.VERSION}:${how}` } });
const lookedAt = (res) => res.headers.get(SEEN)?.startsWith(`${BORDER.VERSION}:`);

/**
 * The tile with its white fill mended, as a response to keep: 'clean' when there is nothing to mend,
 * or null when it could not be told (the tile is then returned as it came, and looked at again next time).
 */
async function mend(res, href, t) {
  stats.zone++;
  const t0 = performance.now();
  const blob = await res.clone().blob();
  stats.bytesIn += blob.size;
  const t1 = performance.now();
  stats.bodyMs += t1 - t0;
  // The common case, and nearly free: a reduced copy with no white pixel at its edge is a tile with no fill.
  let sorted;
  try {
    const small = await pixels(blob, SORT);
    const ts = performance.now();
    sorted = !small || !BORDER.mayHoldFill(small.data, SORT);
    stats.syncMs += performance.now() - ts;
  } catch {
    sorted = false;
  }
  stats.sortMs += performance.now() - t1;
  if (sorted) {
    stats.sorted++;
    return kept(blob, 'clean');
  }
  // The ancestor is waited for without a slot, so that a slow one does not hold the others up.
  const entry = ancestorEntry(href, t);
  const t2 = performance.now();
  const ancestor = await ancestorPixels(entry);
  stats.waitMs += performance.now() - t2;
  if (!ancestor) {
    stats.noAncestor++;
    forget(entry);
    return null;
  }
  await mendingSlot();
  try {
    const t3 = performance.now();
    const tile = await pixels(blob, SIZE);
    stats.decodeMs += performance.now() - t3;
    if (!tile) return null;
    const t4 = performance.now();
    const changed = BORDER.fillFromAncestor(tile.data, ancestor, t.z, t.x, t.y, SIZE, SIZE);
    const t5 = performance.now();
    stats.pixelsMs += t5 - t4;
    stats.syncMs += t5 - t4;
    stats.decoded++;
    if (!changed) return kept(blob, 'clean');
    const canvas = canvases.get(SIZE);
    canvas.getContext('2d').putImageData(tile, 0, 0);
    stats.syncMs += performance.now() - t5;
    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    stats.encodeMs += performance.now() - t5;
    stats.mended++;
    stats.bytesOut += out.size;
    return kept(out, 'mended');
  } finally {
    mendingDone();
  }
}

/** The response to give for a tile of the zone: mended or seen to be clean, or the tile as it came if that could not be told. */
async function mended(res, url, t) {
  const t0 = performance.now();
  try {
    const out = await mend(res, url.href, t);
    if (out) return out;
  } catch {
    stats.failed++;
  } finally {
    const dt = performance.now() - t0;
    stats.totalMs += dt;
    if (dt > stats.maxMs) stats.maxMs = dt;
  }
  return res;
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
      const t = borderTile(url);
      if (hit) {
        if (await isBlank(url, hit)) return missing();
        if (!t || lookedAt(hit)) return hit;
        // Kept before this was done, or not looked at: once.
        const out = await mended(hit, url, t);
        if (out !== hit) e.waitUntil(cache.put(e.request, out.clone()).catch(() => {}));
        return out;
      }
      // The z12 tile that its fill would be mended with is asked for at once, as the tile is.
      if (t) ancestorEntry(url.href, t);
      const res = await fetch(e.request);
      if (res.ok && (res.type === 'cors' || res.type === 'basic')) {
        const blank = await isBlank(url, res);
        const out = t && !blank ? await mended(res, url, t) : res;
        e.waitUntil(
          cache.put(e.request, out.clone()).then(() => {
            if (++inserts % 400 === 0) return prune(cache);
          }),
        );
        return blank ? missing() : out;
      }
      return (await isBlank(url, res)) ? missing() : res;
    })(),
  );
});
