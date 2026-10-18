/**
 * Orthophoto tiles across the border (loaded by tiles-sw.js with importScripts, and by the tests).
 *
 * Outside France IGN's orthophotos have real imagery up to z12 only. From z13 the tiles of
 * foreign land are the blank white one or missing (tiles-sw.js answers both as missing, so
 * MapLibre draws the z12 imagery), but the tiles that straddle the border keep their half of
 * France in imagery and the rest in pure white (255, 255, 255): a white sheet along the border.
 * This file finds that white in a decoded tile and replaces it by the z12 ancestor's imagery,
 * stretched, which is what MapLibre shows on the tiles that lie wholly outside France.
 *
 * Only the tiles under the z12 tiles that the border crosses are looked at (BORDER_Z12, made by
 * scripts/dev/border-tiles.ts). White is not told by its colour alone, a glacier is as white as
 * the fill. The fill is flat to the bit (a JPEG block of one flat colour decodes to exactly 255,
 * and clipped snow seldom does), it reaches the tile's edge, and the z12 imagery shows something
 * else under it: white that the z12 imagery shows white too is left as it is. Where the fill is
 * only a few pixels wide along the tile's edge nothing is flat to the bit (the JPEG rings around
 * every pixel of it): such a strip is mended when it goes on from fill found as above.
 *
 * Pure functions on pixel arrays, no browser API: the service worker gives them the pixels.
 */
(function (root) {
  'use strict';

  const SIZE = 256;
  /** Levels from which a tile can straddle the border: z12 and below are imagery everywhere. */
  const FIRST_Z = 13;
  /** Beyond it a tile would be smaller than a texel of its z12 ancestor (the layer ends at z18 anyway). */
  const LAST_Z = 20;
  const ANCESTOR_Z = 12;
  /** Raise it when what is found in a tile changes (the thresholds below, the list): the tiles kept as looked at are then looked at again. */
  const VERSION = 1;

  /* BEGIN GENERATED: BORDER_Z12 (scripts/dev/border-tiles.ts) */
  // z12 tiles ({y: [x...]}) holding a z13 tile with imagery within 2 tiles of one without: 195 tiles around a frontier of 514 z13 tiles,
  // in 4.65, 43.35 to 8.05, 46.70 (west, south, east, north).
  const BORDER_Z12 = {
    1445: [2118, 2119, 2120],
    1446: [2117, 2118, 2119],
    1447: [2117, 2118],
    1448: [2116, 2117, 2118],
    1449: [2116, 2117],
    1450: [2116, 2117, 2118, 2119, 2120, 2121, 2122, 2123, 2124, 2125],
    1451: [2117, 2118, 2119, 2120, 2121, 2122, 2124, 2125],
    1452: [2116, 2117, 2118, 2119, 2125, 2126],
    1453: [2115, 2116, 2117, 2118, 2119, 2125, 2126],
    1454: [2115, 2116, 2117, 2118, 2119, 2125, 2126],
    1455: [2115, 2116, 2117, 2118, 2125, 2126],
    1456: [2126, 2127],
    1457: [2126, 2127, 2128],
    1458: [2126, 2127, 2128],
    1459: [2125, 2126, 2127],
    1460: [2125, 2126],
    1461: [2125],
    1462: [2125, 2126, 2127],
    1463: [2126, 2127],
    1464: [2127],
    1465: [2127, 2128, 2129],
    1466: [2127, 2128, 2129],
    1467: [2128, 2129],
    1468: [2128, 2129],
    1469: [2126, 2127, 2128, 2129],
    1470: [2123, 2124, 2125, 2126, 2127, 2128],
    1471: [2123, 2124, 2125, 2126],
    1472: [2123, 2124],
    1473: [2123, 2124, 2125],
    1474: [2124, 2125],
    1475: [2124, 2125, 2126, 2127],
    1476: [2125, 2126, 2127, 2128],
    1477: [2127, 2128],
    1478: [2126, 2127, 2128],
    1479: [2126, 2127],
    1480: [2125, 2126, 2127],
    1481: [2125, 2126],
    1482: [2125, 2126, 2127],
    1483: [2126],
    1484: [2126, 2127],
    1485: [2126, 2127, 2128, 2129],
    1486: [2127, 2128, 2129, 2130, 2131, 2133, 2134, 2135],
    1487: [2129, 2130, 2131, 2132, 2133, 2134, 2135],
    1488: [2134, 2135],
    1489: [2133, 2134, 2135],
    1490: [2133, 2134, 2135],
    1491: [2133, 2134],
    1492: [2132, 2133],
    1493: [2131, 2132, 2133],
    1494: [2129, 2130, 2131],
    1495: [2128, 2129, 2130],
    1496: [2126, 2127, 2128, 2129],
    1497: [2126, 2127, 2128],
    1498: [2103, 2104, 2105, 2124, 2125, 2126],
    1499: [2100, 2101, 2102, 2103, 2104, 2105, 2123, 2124],
  };
  /* END GENERATED */

  let borderSet = null;
  const borderTiles = () => {
    if (!borderSet) {
      borderSet = new Set();
      for (const y of Object.keys(BORDER_Z12)) for (const x of BORDER_Z12[y]) borderSet.add(`${x}:${y}`);
    }
    return borderSet;
  };

  /** Tile of an IGN orthophoto WMTS URL ({z, x, y}), or null for anything else. */
  function parseTile(href) {
    if (!/[?&]LAYER=ORTHOIMAGERY\.ORTHOPHOTOS(?:&|$)/.test(href)) return null;
    const m = /[?&]TILEMATRIX=(\d+)&TILEROW=(\d+)&TILECOL=(\d+)(?:&|$)/.exec(href);
    return m ? { z: +m[1], x: +m[3], y: +m[2] } : null;
  }

  /** The z12 tile that holds a tile of level z >= 12. */
  function ancestorOf(z, x, y) {
    const shift = z - ANCESTOR_Z;
    return { x: x >> shift, y: y >> shift };
  }

  /** The same WMTS request for another tile. */
  function tileHref(href, z, x, y) {
    return href.replace(/TILEMATRIX=\d+/, `TILEMATRIX=${z}`).replace(/TILEROW=\d+/, `TILEROW=${y}`).replace(/TILECOL=\d+/, `TILECOL=${x}`);
  }

  /** True for the tiles under a z12 tile that the border crosses. */
  function isBorderTile(z, x, y) {
    if (z < FIRST_Z || z > LAST_Z) return false;
    const a = ancestorOf(z, x, y);
    return borderTiles().has(`${a.x}:${a.y}`);
  }

  // ---- Finding the fill ---------------------------------------------------------------------

  /** The fill is pure white; the JPEG rings a few levels around the edge of it, the pixels at NEAR and above. */
  const NEAR = 249;
  /** Radius (px) of the window that must be wholly white: a fill is a region, not a bright pixel. */
  const CORE_R = 2;
  /** Fewest pixels of a region (the windows' centres), and how far (px) from them the white reaches into the ringing. */
  const MIN_CORE = 40;
  const GROW = CORE_R + 12;
  /** Radius (px) of the soft edge: whole weight inside the fill and a pixel or two into France, whitened by the ringing. */
  const SOFT_R = 3;
  /** What the z12 imagery must show under a region to be worth a replacement: its texels' mean darkness (levels), over at least MIN_TEXELS of them. */
  const MIN_GAIN = 20;
  const MIN_TEXELS = 2;
  /** A strip of fill along the tile's edge: bright (every channel at least BAND_LEVEL), BAND_MIN to BAND_MAX pixels wide, its width changing by BAND_STEP at most from one pixel of the edge to the next. */
  const BAND_LEVEL = 240;
  const BAND_MIN = 3;
  const BAND_MAX = 24;
  const BAND_STEP = 2;

  /** Sums of a 0/1 mask over the (2r + 1)-pixel square around each pixel, the square clipped at the edges of the image. */
  function windowSums(src, w, h, r) {
    // Along the rows ...
    const rows = new Int32Array(w * h);
    const ps = new Int32Array(w + 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) ps[x + 1] = ps[x] + src[y * w + x];
      for (let x = 0; x < w; x++) rows[y * w + x] = ps[Math.min(w - 1, x + r) + 1] - ps[Math.max(0, x - r)];
    }
    // ... then down the columns, the window sliding one row at a time.
    const sums = new Int32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = y > 0 ? sums[(y - 1) * w + x] : 0;
        if (y === 0) for (let j = 0; j <= Math.min(h - 1, r); j++) s += rows[j * w + x];
        else {
          if (y + r < h) s += rows[(y + r) * w + x];
          if (y - r - 1 >= 0) s -= rows[(y - r - 1) * w + x];
        }
        sums[y * w + x] = s;
      }
    return sums;
  }

  /** Pixels of the square of radius r around i on an axis of length n. */
  const reach = (i, n, r) => Math.min(n - 1, i + r) - Math.max(0, i - r) + 1;

  /** A pixel is set when its whole square is (the outside of the image counting as set). */
  function erode(mask, w, h, r) {
    const sums = windowSums(mask, w, h, r);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const ry = reach(y, h, r);
      for (let x = 0; x < w; x++) out[y * w + x] = sums[y * w + x] === ry * reach(x, w, r) ? 1 : 0;
    }
    return out;
  }

  /** A pixel is set when any of its square is. */
  function dilate(mask, w, h, r) {
    const sums = windowSums(mask, w, h, r);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = sums[i] > 0 ? 1 : 0;
    return out;
  }

  /** The share of its square that is set, times `gain`, as 0..255. */
  function soften(mask, w, h, r, gain) {
    const sums = windowSums(mask, w, h, r);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const ry = reach(y, h, r);
      for (let x = 0; x < w; x++) out[y * w + x] = Math.min(255, (sums[y * w + x] * gain * 255) / (ry * reach(x, w, r)));
    }
    return out;
  }

  /**
   * Labels the 4-connected regions of a mask. Returns the label of each pixel (0 outside) and the
   * pixel count of each label (index 0 unused).
   */
  function label(mask, w, h) {
    const lab = new Int32Array(w * h);
    const parent = [0];
    const find = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    let next = 1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!mask[i]) continue;
        const left = x > 0 ? lab[i - 1] : 0;
        const up = y > 0 ? lab[i - w] : 0;
        if (!left && !up) {
          parent.push(next);
          lab[i] = next++;
        } else if (left && up) {
          const a = find(left);
          const b = find(up);
          if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
          lab[i] = Math.min(a, b);
        } else lab[i] = left || up;
      }
    const count = new Int32Array(next);
    for (let k = 0; k < w * h; k++) if (lab[k]) count[(lab[k] = find(lab[k]))]++;
    return { lab, count };
  }

  /**
   * Bilinear stretching of the z12 imagery under a tile of level z to w x h pixels, as the GPU
   * stretches the ancestor on the tiles MapLibre has no better imagery for. `anc` is the decoded
   * z12 tile (RGBA, SIZE x SIZE). Returns `row(py)`, the RGB of a row of the stretched image
   * (w * 3 floats, valid until the next call).
   */
  function ancestorRows(anc, z, x, y, w, h) {
    const f = 1 << (z - ANCESTOR_Z);
    const span = SIZE / f; // pixels of the ancestor under the tile
    const sx = (x & (f - 1)) * span;
    const sy = (y & (f - 1)) * span;
    const clamp = (v) => (v < 0 ? 0 : v > SIZE - 1 ? SIZE - 1 : v);
    const ia = new Int32Array(w);
    const ib = new Int32Array(w);
    const tx = new Float32Array(w);
    for (let px = 0; px < w; px++) {
      const u = sx + ((px + 0.5) * span) / w - 0.5;
      const fl = Math.floor(u);
      ia[px] = clamp(fl) * 4;
      ib[px] = clamp(fl + 1) * 4;
      tx[px] = u - fl;
    }
    // A row of the ancestor stretched across; the tile's rows between two of them blend the pair.
    const across = new Map();
    const stretched = (j) => {
      j = clamp(j);
      let r = across.get(j);
      if (!r) {
        r = new Float32Array(w * 3);
        const o = j * SIZE * 4;
        for (let p = 0; p < w; p++) for (let c = 0; c < 3; c++) r[p * 3 + c] = anc[o + ia[p] + c] * (1 - tx[p]) + anc[o + ib[p] + c] * tx[p];
        across.set(j, r);
      }
      return r;
    };
    const out = new Float32Array(w * 3);
    return (py) => {
      const v = sy + ((py + 0.5) * span) / h - 0.5;
      const j = Math.floor(v);
      const ty = v - j;
      const r0 = stretched(j);
      const r1 = stretched(j + 1);
      for (let i = 0; i < w * 3; i++) out[i] = r0[i] * (1 - ty) + r1[i] * ty;
      return out;
    };
  }

  const luma = (r, g, b) => (r * 77 + g * 151 + b * 28) >> 8;

  /**
   * Adds to `white` the strips of fill that go on along the tile's edge from the white found so far.
   * Where the footprint's boundary runs a few pixels from the tile's edge the fill is a strip too
   * narrow for a window of flat white (the JPEG rings around every pixel of it), and the growth
   * from the flat white stops 14 pixels along it. A strip is followed from the white along the edge
   * for as long as it stays bright, narrow and of a steady width: the footprint's boundary is a straight
   * line, the edge of a snowfield is not.
   */
  function addBands(rgba, w, h, white) {
    const bright = (p) => rgba[p * 4] >= BAND_LEVEL && rgba[p * 4 + 1] >= BAND_LEVEL && rgba[p * 4 + 2] >= BAND_LEVEL;
    // Each side of the tile: its length, and the pixel at a position along it and a depth from it.
    const sides = [
      [h, (i, k) => i * w + k],
      [h, (i, k) => i * w + (w - 1 - k)],
      [w, (i, k) => k * w + i],
      [w, (i, k) => (h - 1 - k) * w + i],
    ];
    for (const [length, at] of sides) {
      // The width of the bright run from the edge at each position, a lone pixel that rings darker not ending it.
      const width = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        let d = 0;
        for (let k = 0; k <= BAND_MAX; k++) {
          if (bright(at(i, k))) d = k + 1;
          else if (k > d) break;
        }
        width[i] = d;
      }
      for (const step of [1, -1]) {
        let last = 0; // width of the strip at the previous position; -1 right after the white found already, 0 when there is no strip
        for (let n = 0; n < length; n++) {
          const i = step > 0 ? n : length - 1 - n;
          if (white[at(i, 0)]) {
            last = -1;
            continue;
          }
          if (!last) continue;
          const d = width[i];
          if (d < BAND_MIN || d > BAND_MAX || (last > 0 && Math.abs(d - last) > BAND_STEP)) {
            last = 0;
            continue;
          }
          for (let k = 0; k < d; k++) white[at(i, k)] = 1;
          last = d;
        }
      }
    }
  }

  /**
   * Replaces the white fill of a decoded tile (`rgba`, w x h x 4, changed in place) by the stretched
   * imagery of its z12 ancestor (`anc`, the decoded ancestor tile). A tile with no fill is left as it
   * is. Returns the number of pixels changed. `info`, when given, receives what was found: the regions
   * of flat white that reach the tile's edge, with the ancestor's darkness under each.
   */
  function fillFromAncestor(rgba, anc, z, x, y, w = SIZE, h = SIZE, info = null) {
    const n = w * h;
    const solid = new Uint8Array(n);
    let any = 0;
    for (let i = 0; i < n; i++)
      if (rgba[i * 4] === 255 && rgba[i * 4 + 1] === 255 && rgba[i * 4 + 2] === 255) {
        solid[i] = 1;
        any++;
      }
    if (any < MIN_CORE) return 0;
    // The fill reaches the tile's edge: no white there, nothing to look for.
    let atEdge = false;
    for (let i = 0; i < w && !atEdge; i++) atEdge = solid[i] === 1 || solid[(h - 1) * w + i] === 1;
    for (let i = 0; i < h && !atEdge; i++) atEdge = solid[i * w] === 1 || solid[i * w + w - 1] === 1;
    if (!atEdge) return 0;
    const { lab, count } = label(erode(solid, w, h, CORE_R), w, h);
    // A region of fill reaches the tile's edge (the tile lies across the border); a patch of snow inside it does not.
    const eligible = new Uint8Array(count.length);
    for (let i = 0; i < w; i++) eligible[lab[i]] = eligible[lab[(h - 1) * w + i]] = 1;
    for (let i = 0; i < h; i++) eligible[lab[i * w]] = eligible[lab[i * w + w - 1]] = 1;
    let regions = 0;
    for (let l = 1; l < count.length; l++) {
      if (count[l] < MIN_CORE) eligible[l] = 0;
      regions += eligible[l];
    }
    if (!regions) return 0;
    // The white of the eligible regions: their reach through the near-white, up to the ringing around them.
    const whiteOf = () => {
      const seed = new Uint8Array(n);
      for (let p = 0; p < n; p++) if (lab[p] && eligible[lab[p]]) seed[p] = 1;
      const white = dilate(seed, w, h, GROW);
      for (let p = 0; p < n; p++) if (white[p] && (rgba[p * 4] < NEAR || rgba[p * 4 + 1] < NEAR || rgba[p * 4 + 2] < NEAR)) white[p] = 0;
      return { seed, white };
    };
    let set = whiteOf();
    // What the z12 imagery shows under each region. A texel of the ancestor is f x f pixels of the tile;
    // where a part of it is fill, what the ancestor holds besides what the tile's other pixels give is
    // what the fill hides. White that the z12 imagery shows white too (a glacier) hides nothing.
    const f = 1 << (z - ANCESTOR_Z);
    const span = SIZE / f;
    const sx = (x & (f - 1)) * span;
    const sy = (y & (f - 1)) * span;
    const texels = new Int32Array(count.length);
    const darkness = new Float64Array(count.length);
    for (let ky = 0; ky < span; ky++)
      for (let kx = 0; kx < span; kx++) {
        let inside = 0;
        let l = 0;
        for (let j = 0; j < f; j++)
          for (let i = 0; i < f; i++) {
            const p = (ky * f + j) * w + kx * f + i;
            if (set.white[p]) {
              inside++;
              if (!l && set.seed[p]) l = lab[p];
            }
          }
        if (!l || inside * 2 < f * f) continue;
        let others = 0;
        if (inside < f * f)
          for (let j = 0; j < f; j++)
            for (let i = 0; i < f; i++) {
              const p = (ky * f + j) * w + kx * f + i;
              if (!set.white[p]) others += luma(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]);
            }
        const share = inside / (f * f);
        const k = ((sy + ky) * SIZE + sx + kx) * 4;
        const shown = luma(anc[k], anc[k + 1], anc[k + 2]);
        const hidden = share < 1 ? (shown - (1 - share) * (others / (f * f - inside))) / share : shown;
        texels[l]++;
        darkness[l] += 255 - Math.min(255, Math.max(0, hidden));
      }
    let chosen = 0;
    if (info) info.regions = [];
    for (let l = 1; l < count.length; l++) {
      if (!eligible[l]) continue;
      const gain = texels[l] >= MIN_TEXELS ? darkness[l] / texels[l] : 0;
      if (info) info.regions.push({ pixels: count[l], texels: texels[l], gain });
      if (gain >= MIN_GAIN) chosen++;
      else eligible[l] = 0;
    }
    if (!chosen) return 0;
    if (chosen < regions) set = whiteOf();
    addBands(rgba, w, h, set.white);
    const alpha = soften(set.white, w, h, SOFT_R, 3);
    const row = ancestorRows(anc, z, x, y, w, h);
    let changed = 0;
    for (let py = 0; py < h; py++) {
      let up = null;
      for (let px = 0; px < w; px++) {
        const a = alpha[py * w + px];
        if (!a) continue;
        up ??= row(py);
        const d = (py * w + px) * 4;
        const k = px * 3;
        if (a === 255) {
          rgba[d] = up[k];
          rgba[d + 1] = up[k + 1];
          rgba[d + 2] = up[k + 2];
        } else {
          rgba[d] += ((up[k] - rgba[d]) * a) / 255;
          rgba[d + 1] += ((up[k + 1] - rgba[d + 1]) * a) / 255;
          rgba[d + 2] += ((up[k + 2] - rgba[d + 2]) * a) / 255;
        }
        changed++;
      }
    }
    return changed;
  }

  /**
   * Whether a reduced copy of a tile (RGBA, size x size, e.g. 64 x 64) holds white that could be fill:
   * the fill reaches the tile's edge, so at least two white pixels in the outer two rows and columns.
   * A tile that does not is returned as it is, without decoding it whole.
   */
  function mayHoldFill(small, size = Math.round(Math.sqrt(small.length / 4))) {
    let n = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (x >= 2 && x < size - 2 && y >= 2 && y < size - 2) continue;
        const i = (y * size + x) * 4;
        if (small[i] >= 254 && small[i + 1] >= 254 && small[i + 2] >= 254 && ++n >= 2) return true;
      }
    return false;
  }

  root.TilesBorder = { VERSION, SIZE, FIRST_Z, LAST_Z, ANCESTOR_Z, BORDER_Z12, parseTile, ancestorOf, tileHref, isBorderTile, ancestorRows, fillFromAncestor, mayHoldFill };
})(typeof self !== 'undefined' ? self : globalThis);
