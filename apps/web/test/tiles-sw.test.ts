import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The service worker of the tile cache (public/tiles-sw.js), run here in a fake worker: a cache that is a map, a network
 * that is a function, and images that are raw pixels in a blob (the decoding and encoding of a real browser are not
 * what is under test, the sorting of the tiles and what is kept in the cache are).
 */
const swSource = readFileSync(new URL('../public/tiles-sw.js', import.meta.url), 'utf8');
const borderSource = readFileSync(new URL('../public/tiles-border.js', import.meta.url), 'utf8');

const border: { TilesBorder?: { VERSION: number } } = {};
new Function('self', borderSource)(border);
/** What the worker writes in the header of a tile it has looked at. */
const seen = (how: 'clean' | 'mended') => `${border.TilesBorder!.VERSION}:${how}`;

const N = 256;
const ign = (z: number, x: number, y: number) => `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image%2Fjpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;

/** "JPEG" of the fake browser: width, height (16 bits each), then the RGBA pixels. */
const encode = (rgba: Uint8ClampedArray, w = N, h = N) => {
  const bytes = new Uint8Array(4 + rgba.length);
  new DataView(bytes.buffer).setUint16(0, w, true);
  new DataView(bytes.buffer).setUint16(2, h, true);
  bytes.set(rgba, 4);
  return new Blob([bytes], { type: 'image/jpeg' });
};
const decode = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  return { w: view.getUint16(0, true), h: view.getUint16(2, true), rgba: new Uint8ClampedArray(bytes.buffer, 4) };
};

const forest = () => {
  const a = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) a.set([50 + (i % 41), 80 + (i % 53), 40 + (i % 29), 255], i * 4);
  return a;
};
/** France to the left of column `edge`, the fill to the right. */
const straddling = (edge = 100) => {
  const a = forest();
  for (let y = 0; y < N; y++) for (let x = edge; x < N; x++) a.set([255, 255, 255, 255], (y * N + x) * 4);
  return a;
};
const uniform = (r: number, g: number, b: number) => {
  const a = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) a.set([r, g, b, 255], i * 4);
  return a;
};
const whites = (a: Uint8ClampedArray) => {
  let n = 0;
  for (let i = 0; i < N * N; i++) if (a[i * 4] === 255 && a[i * 4 + 1] === 255 && a[i * 4 + 2] === 255) n++;
  return n;
};

interface FakeEvent {
  request: { method: string; url: string };
  response?: Promise<Response>;
  waits: Promise<unknown>[];
  respondWith(p: Promise<Response>): void;
  waitUntil(p: Promise<unknown>): void;
}

/**
 * A worker started with a network (`serve` answers a URL with the pixels of a tile, or null for an error), the border file or not,
 * and a browser that reduces an image when it is asked to or not (`reduces`).
 */
function boot(serve: (url: string) => Uint8ClampedArray | null, { border = true, reduces = true }: { border?: boolean; reduces?: boolean } = {}) {
  const handlers: Record<string, ((e: unknown) => void)[]> = {};
  const scope: Record<string, unknown> = { addEventListener: (type: string, f: (e: unknown) => void) => (handlers[type] ??= []).push(f), skipWaiting() {}, clients: { claim: async () => {} } };
  const store = new Map<string, Response>();
  const cache = {
    match: async (req: { url: string } | string) => store.get(typeof req === 'string' ? req : req.url)?.clone(),
    put: async (req: { url: string } | string, res: Response) => void store.set(typeof req === 'string' ? req : req.url, res),
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (req: { url: string }) => store.delete(req.url),
  };
  const calls: string[] = [];
  let decodes = 0;
  const fetchFake = async (req: { url: string } | string) => {
    const url = typeof req === 'string' ? req : req.url;
    calls.push(url);
    const px = serve(url);
    if (!px) throw new TypeError('network down');
    // What a page's CORS request to the tile server gets back.
    return Object.defineProperty(new Response(encode(px), { status: 200, headers: { 'content-type': 'image/jpeg' } }), 'type', { value: 'cors' });
  };
  const createImageBitmap = async (blob: Blob, opts?: { resizeWidth: number; resizeHeight: number }) => {
    decodes++;
    const img = await decode(blob);
    const w = (reduces && opts?.resizeWidth) || img.w;
    const h = (reduces && opts?.resizeHeight) || img.h;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const from = (Math.floor((y * img.h) / h) * img.w + Math.floor((x * img.w) / w)) * 4;
        rgba.set(img.rgba.subarray(from, from + 4), (y * w + x) * 4);
      }
    return { width: w, height: h, rgba, close() {} };
  };
  class FakeCanvas {
    data: Uint8ClampedArray;
    constructor(
      readonly width: number,
      readonly height: number,
    ) {
      this.data = new Uint8ClampedArray(width * height * 4);
    }
    getContext() {
      return {
        // The bitmap drawn over the whole canvas, by the nearest pixels.
        drawImage: (bitmap: { width: number; height: number; rgba: Uint8ClampedArray }) => {
          for (let y = 0; y < this.height; y++)
            for (let x = 0; x < this.width; x++) {
              const from = (Math.floor((y * bitmap.height) / this.height) * bitmap.width + Math.floor((x * bitmap.width) / this.width)) * 4;
              this.data.set(bitmap.rgba.subarray(from, from + 4), (y * this.width + x) * 4);
            }
        },
        getImageData: () => ({ data: new Uint8ClampedArray(this.data), width: this.width, height: this.height }),
        putImageData: (img: { data: Uint8ClampedArray }) => this.data.set(img.data),
      };
    }
    async convertToBlob() {
      return encode(this.data, this.width, this.height);
    }
  }
  scope.importScripts = (name: string) => {
    if (!border) throw new Error(`cannot load ${name}`);
    new Function('self', borderSource)(scope);
  };
  new Function('self', 'caches', 'fetch', 'importScripts', 'createImageBitmap', 'OffscreenCanvas', swSource)(scope, { open: async () => cache }, fetchFake, scope.importScripts, createImageBitmap, FakeCanvas);

  /** Asks the worker for a URL as a page would; resolves to its response (or null where the worker lets the request be). */
  const get = async (url: string, method = 'GET') => {
    const e: FakeEvent = {
      request: { method, url },
      waits: [],
      respondWith(p) {
        this.response = p;
      },
      waitUntil(p) {
        this.waits.push(p);
      },
    };
    for (const h of handlers.fetch) h(e);
    const res = await e.response;
    await Promise.all(e.waits);
    return res ?? null;
  };
  const stats = async () => {
    let out: Record<string, number> | undefined;
    for (const h of handlers.message) h({ data: { type: 'border-stats' }, ports: [{ postMessage: (m: Record<string, number>) => (out = m) }] });
    return out!;
  };
  return { get, store, calls, stats, decodes: () => decodes };
}

describe('the tile cache of the service worker', () => {
  const zoneTile = ign(13, 4250, 2902); // under the z12 tile (2125, 1451), which the border crosses
  const ancestorUrl = ign(12, 2125, 1451);
  const interiorTile = ign(13, 4220, 2960); // Dauphiné: far from any border

  it('lets requests that are not for tiles go by', async () => {
    const w = boot(() => forest());
    expect(await w.get('https://example.org/app.js')).toBeNull();
    expect(await w.get(zoneTile, 'POST')).toBeNull();
  });

  it('keeps the tiles of the other places as they are, with no marker and no asking for an ancestor', async () => {
    const w = boot(() => straddling());
    const res = (await w.get(interiorTile))!;
    expect(res.headers.get('x-border-fill')).toBeNull();
    expect(whites((await decode(await res.blob())).rgba)).toBeGreaterThan(0);
    expect(w.calls).toEqual([interiorTile]);
    expect(w.store.has(interiorTile)).toBe(true);
  });

  it('mends the fill of a tile of the zone, keeps it mended, and asks for the ancestor once', async () => {
    const w = boot((url) => (url === ancestorUrl ? uniform(30, 90, 40) : straddling()));
    const res = (await w.get(zoneTile))!;
    expect(res.status).toBe(200);
    expect(res.headers.get('x-border-fill')).toBe(seen('mended'));
    const px = (await decode(await res.blob())).rgba;
    expect(whites(px)).toBe(0);
    expect([...px.slice((128 * N + 200) * 4, (128 * N + 200) * 4 + 3)]).toEqual([30, 90, 40]);
    expect(w.store.get(zoneTile)!.headers.get('x-border-fill')).toBe(seen('mended'));
    // The next time it is served from the cache, with nothing decoded, nothing asked.
    const decodes = w.decodes();
    const again = (await w.get(zoneTile))!;
    expect(again.headers.get('x-border-fill')).toBe(seen('mended'));
    expect(w.decodes()).toBe(decodes);
    expect(w.calls.filter((u) => u === zoneTile)).toHaveLength(1);
    expect(w.calls.filter((u) => u === ancestorUrl)).toHaveLength(1);
    // Another tile under the same z12 tile uses the ancestor kept.
    await w.get(ign(14, 8500, 5804));
    expect(w.calls.filter((u) => u === ancestorUrl)).toHaveLength(1);
    const s = await w.stats();
    expect(s.mended).toBeGreaterThanOrEqual(1);
    expect(s.zone).toBeGreaterThanOrEqual(2);
  });

  it('keeps the other tiles of the zone as IGN sent them, marked as seen: those with no white at the first look, and the glaciers', async () => {
    const clean = boot(() => forest());
    const a = (await clean.get(zoneTile))!;
    expect(a.headers.get('x-border-fill')).toBe(seen('clean'));
    expect(await decode(await a.blob())).toEqual(await decode(encode(forest())));
    // Sorted out by the reduced copy: the tile was decoded small only, and no pixel of an ancestor was wanted.
    expect(await clean.stats()).toMatchObject({ zone: 1, sorted: 1, decoded: 0 });
    const glacier = boot((url) => (url === ancestorUrl ? uniform(250, 252, 255) : straddling()));
    const b = (await glacier.get(zoneTile))!;
    expect(b.headers.get('x-border-fill')).toBe(seen('clean'));
    expect(whites((await decode(await b.blob())).rgba)).toBeGreaterThan(0);
    expect((await glacier.stats()).mended).toBe(0);
  });

  it('gives the tile as it came, unmarked, when the ancestor cannot be had, and mends it when it is asked for again', async () => {
    let up = false;
    const w = boot((url) => (url === ancestorUrl ? (up ? uniform(30, 90, 40) : null) : straddling()));
    const first = (await w.get(zoneTile))!;
    expect(first.headers.get('x-border-fill')).toBeNull();
    expect(whites((await decode(await first.blob())).rgba)).toBeGreaterThan(0);
    expect(w.store.get(zoneTile)!.headers.get('x-border-fill')).toBeNull();
    expect((await w.stats()).noAncestor).toBe(1);
    up = true;
    const second = (await w.get(zoneTile))!;
    expect(second.headers.get('x-border-fill')).toBe(seen('mended'));
    expect(w.store.get(zoneTile)!.headers.get('x-border-fill')).toBe(seen('mended'));
    expect(whites((await decode(await second.blob())).rgba)).toBe(0);
  });

  it('mends the tiles that an earlier version kept as IGN sent them', async () => {
    const w = boot((url) => (url === ancestorUrl ? uniform(30, 90, 40) : straddling()));
    w.store.set(zoneTile, new Response(encode(straddling()), { status: 200, headers: { 'content-type': 'image/jpeg' } }));
    const res = (await w.get(zoneTile))!;
    expect(res.headers.get('x-border-fill')).toBe(seen('mended'));
    expect(w.calls).not.toContain(zoneTile);
    expect(w.store.get(zoneTile)!.headers.get('x-border-fill')).toBe(seen('mended'));
  });

  it('looks again at the tiles that were looked at by an older version of the detection', async () => {
    const w = boot((url) => (url === ancestorUrl ? uniform(30, 90, 40) : straddling()));
    w.store.set(zoneTile, new Response(encode(straddling()), { status: 200, headers: { 'content-type': 'image/jpeg', 'x-border-fill': '0:clean' } }));
    const res = (await w.get(zoneTile))!;
    expect(res.headers.get('x-border-fill')).toBe(seen('mended'));
    expect(w.store.get(zoneTile)!.headers.get('x-border-fill')).toBe(seen('mended'));
  });

  it('sorts the tiles by a reduced copy it makes itself when the browser does not reduce the image', async () => {
    const w = boot((url) => (url === ancestorUrl ? uniform(30, 90, 40) : straddling()), { reduces: false });
    expect((await w.get(zoneTile))!.headers.get('x-border-fill')).toBe(seen('mended'));
    const clean = boot(() => forest(), { reduces: false });
    expect((await clean.get(zoneTile))!.headers.get('x-border-fill')).toBe(seen('clean'));
    expect(await clean.stats()).toMatchObject({ sorted: 1, decoded: 0 });
  });

  it('serves the tiles as before where the border file is not there', async () => {
    const w = boot(() => straddling(), { border: false });
    const res = (await w.get(zoneTile))!;
    expect(res.headers.get('x-border-fill')).toBeNull();
    expect(whites((await decode(await res.blob())).rgba)).toBeGreaterThan(0);
    expect(w.calls).toEqual([zoneTile]);
  });

  it('answers the page that asks what it costs', async () => {
    const w = boot((url) => (url === ancestorUrl ? uniform(30, 90, 40) : straddling()));
    await w.get(zoneTile);
    const s = await w.stats();
    expect(s).toMatchObject({ type: 'border-stats', zone: 1, decoded: 1, mended: 1, failed: 0 });
    expect(s.bytesOut).toBeGreaterThan(0);
  });
});
