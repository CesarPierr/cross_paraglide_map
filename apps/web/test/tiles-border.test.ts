import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** What public/tiles-border.js gives the service worker (a classic script: loaded here the same way, into a fake `self`). */
interface Border {
  FIRST_Z: number;
  LAST_Z: number;
  BORDER_Z12: Record<string, number[]>;
  parseTile(href: string): { z: number; x: number; y: number } | null;
  ancestorOf(z: number, x: number, y: number): { x: number; y: number };
  tileHref(href: string, z: number, x: number, y: number): string;
  isBorderTile(z: number, x: number, y: number): boolean;
  ancestorRows(anc: Uint8ClampedArray, z: number, x: number, y: number, w: number, h: number): (py: number) => Float32Array;
  fillFromAncestor(rgba: Uint8ClampedArray, anc: Uint8ClampedArray, z: number, x: number, y: number, w?: number, h?: number, info?: { regions?: { pixels: number; texels: number; gain: number }[] }): number;
  mayHoldFill(small: Uint8ClampedArray): boolean;
}
const source = readFileSync(new URL('../public/tiles-border.js', import.meta.url), 'utf8');
const scope: { TilesBorder?: Border } = {};
new Function('self', source)(scope);
const B = scope.TilesBorder!;

const N = 256;
const ign = (z: number, x: number, y: number, layer = 'ORTHOIMAGERY.ORTHOPHOTOS') => `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=normal&FORMAT=image%2Fjpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
const tileAt = (lon: number, lat: number, z: number) => {
  const n = 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return { z, x: Math.floor(((lon + 180) / 360) * n), y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n) };
};

describe('the tiles under the z12 tiles that the border crosses', () => {
  it('reads the tile of an orthophoto request, and nothing else', () => {
    expect(B.parseTile(ign(14, 8507, 5839))).toEqual({ z: 14, x: 8507, y: 5839 });
    expect(B.parseTile(ign(14, 8507, 5839, 'GEOGRAPHICALGRIDSYSTEMS.MAPS'))).toBeNull();
    expect(B.parseTile('https://example.org/14/8507/5839.png')).toBeNull();
  });

  it('puts the same request to another tile', () => {
    const a = B.ancestorOf(16, 34030, 23357);
    expect(a).toEqual({ x: 2126, y: 1459 });
    const href = B.tileHref(ign(16, 34030, 23357), 12, a.x, a.y);
    expect(href).toBe(ign(12, 2126, 1459));
    expect(B.parseTile(href)).toEqual({ z: 12, x: 2126, y: 1459 });
  });

  it('is asked for the levels where a tile can hold fill only', () => {
    expect(B.isBorderTile(12, 2126, 1459)).toBe(false);
    expect(B.isBorderTile(B.FIRST_Z, 4252, 2918)).toBe(true);
    expect(B.isBorderTile(16, 34030, 23357)).toBe(true);
    expect(B.isBorderTile(B.LAST_Z + 1, 2126 * 2 ** 9, 1459 * 2 ** 9)).toBe(false);
  });

  it('holds the border from the Jura to the Mediterranean', () => {
    // Passes and summits on the border, a tile of each level: no stretch of it left out.
    const border: [string, number, number][] = [
      ['Geneva, Gex', 6.0, 46.25],
      ['Saint-Gingolph, Lake Geneva', 6.806, 46.392],
      ['Col de Balme', 6.964, 46.019],
      ['Mont Dolent', 7.043, 45.924],
      ['Mont Blanc', 6.865, 45.833],
      ['Col du Petit-Saint-Bernard', 6.884, 45.68],
      ['Mont Cenis', 6.9, 45.25],
      ['Montgenevre', 6.723, 44.933],
      ['Col Agnel', 6.986, 44.696],
      ['Col de Larche', 6.9, 44.417],
      ['Col de Tende', 7.568, 44.148],
      ['Menton', 7.53, 43.785],
    ];
    for (const [name, lon, lat] of border) for (const z of [13, 15, 17]) expect(B.isBorderTile(...(Object.values(tileAt(lon, lat, z)) as [number, number, number])), `${name} at z${z}`).toBe(true);
  });

  it('leaves out the heart of the Alps and the plains', () => {
    // Saint-Hilaire (Chartreuse), Grenoble, Briançon's Cerces, Annecy, Digne: far from any border.
    for (const [lon, lat] of [[5.887, 45.308], [5.72, 45.19], [6.55, 44.95], [6.13, 45.9], [6.24, 44.09]]) expect(B.isBorderTile(...(Object.values(tileAt(lon, lat, 14)) as [number, number, number]))).toBe(false);
  });

  it('is a list of z12 tiles in the grid of the game, each once', () => {
    const rows = Object.entries(B.BORDER_Z12);
    expect(rows.length).toBeGreaterThan(40);
    let total = 0;
    for (const [y, xs] of rows) {
      expect(Number(y)).toBeGreaterThan(1400);
      expect(Number(y)).toBeLessThan(1520);
      expect(new Set(xs).size).toBe(xs.length);
      expect([...xs].sort((a, b) => a - b)).toEqual(xs);
      for (const x of xs) {
        expect(x).toBeGreaterThan(2090);
        expect(x).toBeLessThan(2150);
      }
      total += xs.length;
    }
    // The header of the generated block says what it holds (scripts/dev/border-tiles.ts).
    expect(source).toContain(`: ${total} tiles around a frontier of`);
  });
});

describe('the stretched z12 imagery under a tile', () => {
  /** A z12 tile whose colour grows with the column (R) and the row (G): bilinear stretching of it is exact. */
  const gradient = () => {
    const a = new Uint8ClampedArray(N * N * 4);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) a.set([x, y, 128, 255], (y * N + x) * 4);
    return a;
  };

  it('puts the tile where it lies in its ancestor, pixel centres on texel centres', () => {
    const anc = gradient();
    // z14: the tile is 64 texels wide in its ancestor; this one is the third column and the second row of the 4 x 4.
    const row = B.ancestorRows(anc, 14, 4 * 2126 + 2, 4 * 1459 + 1, N, N);
    const r = row(0);
    // Pixel 0 of the tile is at 128 + (0.5 / 256) * 64 - 0.5 in the ancestor's columns, and in its rows 64 + the same.
    expect(r[0]).toBeCloseTo(128 + (0.5 * 64) / 256 - 0.5, 3);
    expect(r[1]).toBeCloseTo(64 + (0.5 * 64) / 256 - 0.5, 3);
    expect(r[255 * 3]).toBeCloseTo(128 + (255.5 * 64) / 256 - 0.5, 3);
    expect(row(255)[1]).toBeCloseTo(64 + (255.5 * 64) / 256 - 0.5, 3);
  });

  it('holds the edge of the ancestor where the tile is at the edge of it', () => {
    const r = B.ancestorRows(gradient(), 13, 2 * 2126, 2 * 1459, N, N)(0);
    expect(r[0]).toBe(0);
    expect(r[1]).toBe(0);
  });
});

describe('mending the fill of a tile', () => {
  /** France: a texture of greens and browns, never near white (a pseudo-random one: the tests do not move). */
  const france = () => {
    const a = new Uint8ClampedArray(N * N * 4);
    let s = 12345;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < N * N; i++) a.set([40 + rnd() * 80, 70 + rnd() * 90, 30 + rnd() * 60, 255], i * 4);
    return a;
  };
  /** A tile with the fill (pure white) from column `edge` on, ringing around the boundary as the JPEG leaves it. */
  const across = (edge: number, ringing = true) => {
    const a = france();
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const o = (y * N + x) * 4;
        if (x >= edge) a.set([255, 255, 255, 255], o);
        else if (ringing && x >= edge - 2) a.set([a[o] + 70, a[o + 1] + 70, a[o + 2] + 70, 255], o);
        if (ringing && x >= edge && x < edge + 6) a[o + 2] = 252 + (y % 3 === 0 ? 0 : 1);
      }
    return a;
  };
  const uniform = (r: number, g: number, b: number) => {
    const a = new Uint8ClampedArray(N * N * 4);
    for (let i = 0; i < N * N; i++) a.set([r, g, b, 255], i * 4);
    return a;
  };
  const px = (a: Uint8ClampedArray, x: number, y: number) => [...a.slice((y * N + x) * 4, (y * N + x) * 4 + 3)];
  const whites = (a: Uint8ClampedArray) => {
    let n = 0;
    for (let i = 0; i < N * N; i++) if (a[i * 4] >= 249 && a[i * 4 + 1] >= 249 && a[i * 4 + 2] >= 249) n++;
    return n;
  };

  it('replaces the fill by the imagery of the ancestor, where the ancestor shows a forest', () => {
    for (const z of [13, 14, 16, 17]) {
      const tile = across(100);
      const before = new Uint8ClampedArray(tile);
      const changed = B.fillFromAncestor(tile, uniform(30, 90, 40), z, 2 ** (z - 12) * 2126 + 1, 2 ** (z - 12) * 1459, N, N);
      expect(changed, `z${z}`).toBeGreaterThan(156 * N * 0.9);
      expect(px(tile, 200, 128)).toEqual([30, 90, 40]);
      expect(px(tile, 255, 0)).toEqual([30, 90, 40]);
      // France is as it was, but for the pixels at the edge of the fill.
      for (const [x, y] of [[0, 0], [50, 100], [90, 200], [93, 255]]) expect(px(tile, x, y), `z${z} ${x},${y}`).toEqual(px(before, x, y));
      expect(whites(tile)).toBe(0);
    }
  });

  it('leaves no white outline: the ringing on both sides of the edge goes with the fill', () => {
    const tile = across(100, true);
    B.fillFromAncestor(tile, uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N);
    // Across the boundary (column 100): France's whitened pixels (98, 99) and the fill's (100..105) become the ancestor's colour or a mix with France.
    for (let x = 99; x <= 110; x++) {
      const [r, g, b] = px(tile, x, 128);
      expect(r < 200 && g < 200 && b < 200, `column ${x}`).toBe(true);
    }
    expect(px(tile, 120, 128)).toEqual([30, 90, 40]);
  });

  it('is a soft edge: a pixel or two of France, no more', () => {
    const tile = across(100, false);
    const before = new Uint8ClampedArray(tile);
    B.fillFromAncestor(tile, uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N);
    expect(px(tile, 96, 128)).toEqual(px(before, 96, 128));
    expect(px(tile, 97, 128)).not.toEqual(px(before, 97, 128)); // the soft edge begins three pixels before the fill
    expect(px(tile, 100, 128)[1]).toBeLessThan(120);
  });

  it('leaves the white that the ancestor shows white: a glacier is as white as the fill', () => {
    for (const anc of [uniform(255, 255, 255), uniform(246, 248, 250), uniform(236, 240, 244)]) {
      const tile = across(100);
      const before = new Uint8ClampedArray(tile);
      expect(B.fillFromAncestor(tile, anc, 14, 4 * 2126, 4 * 1459, N, N)).toBe(0);
      expect(tile).toEqual(before);
    }
  });

  it('mends where the ancestor is darker than the threshold, not below it', () => {
    const below: { regions?: { gain: number }[] } = {};
    expect(B.fillFromAncestor(across(100), uniform(240, 240, 240), 14, 4 * 2126, 4 * 1459, N, N, below)).toBe(0);
    expect(below.regions?.[0].gain).toBeGreaterThan(10);
    expect(below.regions?.[0].gain).toBeLessThan(20);
    const above: { regions?: { gain: number }[] } = {};
    expect(B.fillFromAncestor(across(100), uniform(225, 225, 225), 14, 4 * 2126, 4 * 1459, N, N, above)).toBeGreaterThan(0);
    expect(above.regions?.[0].gain).toBeGreaterThan(20);
    expect(above.regions?.[0].gain).toBeLessThan(40);
  });

  it('measures what the fill hides by what the ancestor holds besides the tile’s own pixels', () => {
    // A tile whose France is dark, the ancestor's texels at the boundary half dark: the half that is fill hides what is left.
    const info: { regions?: { gain: number; texels: number }[] } = {};
    B.fillFromAncestor(across(100), uniform(30, 90, 40), 16, 16 * 2126, 16 * 1459, N, N, info);
    expect(info.regions?.length).toBe(1);
    expect(info.regions?.[0].gain).toBeGreaterThan(150);
    expect(info.regions?.[0].texels).toBeGreaterThan(30);
  });

  it('leaves snow alone that is only nearly white, flat to the eye and not to the bit', () => {
    const tile = across(100, false);
    for (let i = 0; i < N * N; i++) if (tile[i * 4] === 255) tile.set([254 - (i % 3), 255 - (i % 2), 254, 255], i * 4);
    const before = new Uint8ClampedArray(tile);
    expect(B.fillFromAncestor(tile, uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N)).toBe(0);
    expect(tile).toEqual(before);
  });

  it('leaves a patch of white that does not reach the tile’s edge', () => {
    const tile = france();
    for (let y = 100; y < 160; y++) for (let x = 100; x < 160; x++) tile.set([255, 255, 255, 255], (y * N + x) * 4);
    const before = new Uint8ClampedArray(tile);
    expect(B.fillFromAncestor(tile, uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N)).toBe(0);
    expect(tile).toEqual(before);
  });

  it('leaves a white speck, a few pixels across, and mends a sliver along the edge', () => {
    const tile = france();
    for (let y = 0; y < 8; y++) for (let x = 248; x < N; x++) tile.set([255, 255, 255, 255], (y * N + x) * 4);
    const before = new Uint8ClampedArray(tile);
    expect(B.fillFromAncestor(tile, uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N)).toBe(0);
    expect(tile).toEqual(before);
    // A sliver six pixels wide along the whole edge is fill.
    expect(B.fillFromAncestor(across(250, false), uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N)).toBeGreaterThan(6 * N);
  });

  describe('a strip of fill along the edge of the tile', () => {
    /** Near white as a JPEG leaves a strip of fill with no block of its own: 251 to 255, a pixel here and there rung darker. */
    const ringing = (x: number, y: number): [number, number, number, number] => {
      const v = (x + y) % 37 === 0 ? 236 : Math.min(255, 251 + ((x * 3 + y * 5) % 5));
      return [v, v, v, 255];
    };
    /**
     * France, the fill over the top rows (a block of flat white, from column 60 on), and below it a strip along
     * the right edge, from row `from` to row `to`, `width(y)` pixels wide.
     */
    const withStrip = (width: (y: number) => number, from = 100, to = 200) => {
      const a = france();
      for (let y = 0; y < from; y++) for (let x = 60; x < N; x++) a.set([255, 255, 255, 255], (y * N + x) * 4);
      for (let y = from; y < to; y++) for (let x = N - width(y); x < N; x++) a.set(ringing(x, y), (y * N + x) * 4);
      return a;
    };
    const bright = (a: Uint8ClampedArray, x: number, y: number) => a[(y * N + x) * 4] >= 240 && a[(y * N + x) * 4 + 1] >= 240 && a[(y * N + x) * 4 + 2] >= 240;
    const anc = () => uniform(30, 90, 40);

    it('mends it along its whole length, though no window of flat white fits in it', () => {
      const tile = withStrip(() => 11);
      const before = new Uint8ClampedArray(tile);
      expect(B.fillFromAncestor(tile, anc(), 14, 4 * 2126, 4 * 1459, N, N)).toBeGreaterThan(20000);
      for (let y = 100; y < 200; y += 7) for (let x = N - 11; x < N; x++) expect(bright(tile, x, y), `${x},${y}`).toBe(false);
      // France beside it is as it was.
      for (let y = 110; y < 200; y += 9) expect(px(tile, 200, y)).toEqual(px(before, 200, y));
      expect(px(tile, 249, 150)).toEqual([30, 90, 40]);
    });

    it('follows a strip whose width changes slowly, the footprint’s boundary being slanted', () => {
      const tile = withStrip((y) => 6 + Math.floor((y - 100) / 12));
      B.fillFromAncestor(tile, anc(), 14, 4 * 2126, 4 * 1459, N, N);
      for (let y = 100; y < 200; y += 5) expect(bright(tile, N - 1, y), `row ${y}`).toBe(false);
    });

    it('leaves a strip that goes on after a step in its width, or is wider than a strip', () => {
      // Narrow, then wide: the boundary is not a straight line.
      const stepped = withStrip((y) => (y < 150 ? 10 : 20));
      B.fillFromAncestor(stepped, anc(), 14, 4 * 2126, 4 * 1459, N, N);
      expect(bright(stepped, N - 1, 120)).toBe(false);
      expect(bright(stepped, N - 1, 180)).toBe(true);
      // Wider than 24 pixels: bright ground (a snowfield) that happens to lie along the edge.
      const wide = withStrip(() => 40);
      B.fillFromAncestor(wide, anc(), 14, 4 * 2126, 4 * 1459, N, N);
      expect(bright(wide, N - 1, 150)).toBe(true);
    });

    it('does not follow the ragged edge of a snowfield from the fill', () => {
      let s = 7;
      const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      const tile = withStrip(() => 4 + Math.floor(rnd() * 16));
      B.fillFromAncestor(tile, anc(), 14, 4 * 2126, 4 * 1459, N, N);
      let left = 0;
      for (let y = 110; y < 200; y++) left += bright(tile, N - 1, y) ? 1 : 0;
      expect(left).toBeGreaterThan(70);
    });

    it('leaves a strip that has no fill beside it: nothing says it is fill', () => {
      const tile = france();
      for (let y = 0; y < N; y++) for (let x = N - 11; x < N; x++) tile.set(ringing(x, y), (y * N + x) * 4);
      const before = new Uint8ClampedArray(tile);
      expect(B.fillFromAncestor(tile, anc(), 14, 4 * 2126, 4 * 1459, N, N)).toBe(0);
      expect(tile).toEqual(before);
    });

    it('follows the strip along the other edges too', () => {
      // The same tile turned a quarter: the pixel (x, y) goes to (N - 1 - y, x), the strip lies along the bottom edge.
      const base = withStrip(() => 11);
      const turned = new Uint8ClampedArray(N * N * 4);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) turned.set(base.slice((y * N + x) * 4, (y * N + x) * 4 + 4), (x * N + (N - 1 - y)) * 4);
      B.fillFromAncestor(turned, anc(), 14, 4 * 2126, 4 * 1459, N, N);
      for (let row = 100; row < 200; row += 7) for (let x = N - 11; x < N; x++) expect(bright(turned, N - 1 - row, x), `${N - 1 - row},${x}`).toBe(false);
    });
  });

  it('leaves a tile with no white as it is, and the fill once mended is not mended again', () => {
    const none = france();
    const copy = new Uint8ClampedArray(none);
    expect(B.fillFromAncestor(none, uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N)).toBe(0);
    expect(none).toEqual(copy);
    const tile = across(100);
    expect(B.fillFromAncestor(tile, uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N)).toBeGreaterThan(0);
    const once = new Uint8ClampedArray(tile);
    expect(B.fillFromAncestor(tile, uniform(30, 90, 40), 14, 4 * 2126, 4 * 1459, N, N)).toBe(0);
    expect(tile).toEqual(once);
  });

  it('mends a corner of the tile, and the fill at the foot of it', () => {
    const tile = france();
    for (let y = 150; y < N; y++) for (let x = 0; x < N; x++) tile.set([255, 255, 255, 255], (y * N + x) * 4);
    for (let y = 0; y < 150; y++) for (let x = 200; x < N; x++) tile.set([255, 255, 255, 255], (y * N + x) * 4);
    expect(B.fillFromAncestor(tile, uniform(30, 90, 40), 15, 8 * 2126 + 3, 8 * 1459 + 5, N, N)).toBeGreaterThan(35000);
    expect(whites(tile)).toBe(0);
    expect(px(tile, 10, 10)).not.toEqual([30, 90, 40]);
  });

  it('draws the ancestor under the fill where the tile lies in it', () => {
    // The ancestor is a gradient: the colour of a pixel of the fill tells where it was taken.
    const anc = new Uint8ClampedArray(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) anc.set([20 + (x >> 2), 20 + (y >> 2), 30, 255], (y * N + x) * 4);
    const tile = across(100, false);
    B.fillFromAncestor(tile, anc, 14, 4 * 2126 + 2, 4 * 1459 + 1, N, N);
    // Pixel (200, 128) of the tile: column 128 + 200 / 4 = 178 of the ancestor, row 64 + 32 = 96.
    const [r, g] = px(tile, 200, 128);
    expect(r).toBeGreaterThan(20 + 178 / 4 - 3);
    expect(r).toBeLessThan(20 + 178 / 4 + 3);
    expect(g).toBeGreaterThan(20 + 96 / 4 - 3);
    expect(g).toBeLessThan(20 + 96 / 4 + 3);
  });
});

describe('sorting the tiles by a reduced copy', () => {
  const small = (whites: number) => {
    const a = new Uint8ClampedArray(64 * 64 * 4).fill(90);
    for (let i = 0; i < whites; i++) a.set([255, 255, 255, 255], i * 4);
    return a;
  };
  it('lets through the tiles that may hold white at their edge, and drops those that cannot', () => {
    expect(B.mayHoldFill(small(0))).toBe(false);
    expect(B.mayHoldFill(small(1))).toBe(false);
    expect(B.mayHoldFill(small(2))).toBe(true);
    expect(B.mayHoldFill(small(500))).toBe(true);
  });
  it('wants every channel white', () => {
    const a = new Uint8ClampedArray(64 * 64 * 4).fill(255);
    for (let i = 0; i < 64 * 64; i++) a[i * 4 + 2] = 200;
    expect(B.mayHoldFill(a)).toBe(false);
  });
  it('drops the tiles whose white lies inside, away from the edge: a fill reaches it', () => {
    const a = new Uint8ClampedArray(64 * 64 * 4).fill(90);
    for (let y = 10; y < 50; y++) for (let x = 10; x < 50; x++) a.set([255, 255, 255, 255], (y * 64 + x) * 4);
    expect(B.mayHoldFill(a)).toBe(false);
    // ... and lets through the white that reaches the last column, or the last row.
    for (let y = 20; y < 30; y++) a.set([255, 255, 255, 255], (y * 64 + 63) * 4);
    expect(B.mayHoldFill(a)).toBe(true);
    const b = new Uint8ClampedArray(64 * 64 * 4).fill(90);
    for (let x = 20; x < 30; x++) b.set([255, 255, 255, 255], (62 * 64 + x) * 4);
    expect(B.mayHoldFill(b, 64)).toBe(true);
  });
});
