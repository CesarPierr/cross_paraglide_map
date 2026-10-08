/**
 * Rasterises known breezes (from the research atlas) onto the model grid, so
 * that local knowledge overrides the generic flow where it applies. Each cell
 * keeps the dominant breeze (highest influence) of three layers:
 * - `main`: regular valley-scale and regional breezes;
 * - `cond`: conditional ones (canicule, Lombarde…), which may share a corridor
 *   with a regular breeze blowing the other way and only take over when their
 *   condition holds;
 * - `thin`: slope and katabatic breezes, a layer of tens to a couple of hundred
 *   metres above the ground that can run under (or against) the valley wind,
 *   as the sources describe (a katabatic flow sliding under the lake breeze).
 */
import type { CuratedBreezeInput, CuratedHazardInput } from '@brises/shared';
import type { CuratedLayer, CuratedRaster } from './field';
import { smoothstep } from './raster';
import type { Terrain } from './terrain';

export type { CuratedBreezeInput, CuratedHazardInput };

/** Valley-scale kinds: follow the valley-wind profile, rasterised on the valley floor and lower slopes. */
const VALLEY_KINDS = new Set(['valley', 'downvalley', 'lake', 'pass-transfer']);
/** Thin near-ground kinds (third layer). */
const THIN_KINDS = new Set(['slope', 'katabatic']);

/** Vertical structure of a curated breeze, shared by the CPU model and the GPU engine. */
export const CuratedLayerKind = {
  /** Plain → mountain and regional flows: ~1 km thick, terrain following (Weissmann et al. 2005, S4). */
  Deep: 0,
  /** Valley-scale flows: follow the valley-wind profile (`valleyProfile`). */
  Valley: 1,
  /** Slope breezes: a layer of ~100–200 m above the ground (`RULES.curatedSlopeLayer`). */
  Slope: 2,
  /** Katabatic flows: a layer of a few tens of metres up to ~100 m (`RULES.curatedKatabaticLayer`). */
  Katabatic: 3,
} as const;

export function curatedLayerKind(kind: string): number {
  if (VALLEY_KINDS.has(kind)) return CuratedLayerKind.Valley;
  if (kind === 'slope') return CuratedLayerKind.Slope;
  if (kind === 'katabatic') return CuratedLayerKind.Katabatic;
  return CuratedLayerKind.Deep;
}

/** Corridor half-width (m) of a valley breeze; wider corridors are less specific. */
const SPECIFIC_RADIUS = 1700;

function emptyRaster(n: number): CuratedRaster & { score: Float32Array } {
  return { index: new Int16Array(n).fill(-1), weight: new Float32Array(n), tx: new Float32Array(n), ty: new Float32Array(n), score: new Float32Array(n) };
}

/** Effect of a documented hazard, as the GPU codes it (tB row, z). */
export const HazardEffect = { lee: 0, venturi: 1, turbulence: 2, wind: 3 } as const;

/** Documented hazards a cell can hold at once (GPU: tC2.z, tC2.w, tF.y, tF.z). */
export const HAZARD_SLOTS = 4;

/**
 * Rasterises the documented hazards as discs around their points, in up to
 * `HAZARD_SLOTS` layers: each hazard goes to the first layer where it overlaps no
 * other, so hazards sharing a place with different conditions (a lee by north and a
 * strong breeze by south at the same take-off) both stay. Beyond that, the highest
 * weight wins in the last layer.
 */
function rasterizeHazards(t: Terrain, hazards: CuratedHazardInput[]): { index: Int16Array; weight: Float32Array }[] {
  const { grid } = t;
  const { width: w, height: h, size: n } = grid;
  const slots = Array.from({ length: HAZARD_SLOTS }, () => ({ index: new Int16Array(n).fill(-1), weight: new Float32Array(n) }));
  const cell = grid.cellM[(h / 2) | 0];
  hazards.forEach((hz, hi) => {
    const R = Math.max(1.5, hz.radiusM / cell);
    const cells: [number, number][] = [];
    for (const [lon, lat] of hz.coords) {
      if (!grid.contains(lon, lat)) continue;
      const [cx, cy] = grid.toGrid(lon, lat);
      for (let j = Math.max(0, Math.floor(cy - R)); j <= Math.min(h - 1, Math.ceil(cy + R)); j++)
        for (let i = Math.max(0, Math.floor(cx - R)); i <= Math.min(w - 1, Math.ceil(cx + R)); i++) {
          const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
          // Full over the inner 60 % of the radius, fading to the edge; below 1 (GPU packing).
          if (d <= R) cells.push([j * w + i, Math.min(0.999, 1 - smoothstep(0.6 * R, R, d))]);
        }
    }
    const free = slots.findIndex((L) => cells.every(([k]) => L.index[k] < 0 || L.index[k] === hi));
    const L = slots[free >= 0 ? free : HAZARD_SLOTS - 1];
    for (const [k, wgt] of cells)
      if (wgt > L.weight[k]) {
        L.weight[k] = wgt;
        L.index[k] = hi;
      }
  });
  return slots;
}

export function rasterizeCurated(t: Terrain, breezes: CuratedBreezeInput[], hazards: CuratedHazardInput[] = []): CuratedLayer {
  const { grid } = t;
  const { width: w, height: h, size: n } = grid;
  const main = emptyRaster(n);
  const cond = emptyRaster(n);
  const thin = emptyRaster(n);
  const cell = grid.cellM[(h / 2) | 0];

  breezes.forEach((b, bi) => {
    if (b.coords.length < 2) return;
    const pts = b.coords.map(([lon, lat]) => grid.toGrid(lon, lat));
    const R = Math.max(1.5, b.radiusM / cell);
    const valleyKind = VALLEY_KINDS.has(b.kind);
    const L = THIN_KINDS.has(b.kind) ? thin : b.condition ? cond : main;
    const specificity = Math.sqrt(SPECIFIC_RADIUS / Math.max(SPECIFIC_RADIUS, b.radiusM));
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, ay] = pts[s];
      const [bx, by] = pts[s + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) continue;
      const len = Math.sqrt(len2);
      // Flow direction in (east, north).
      const ux = dx / len;
      const uy = -dy / len;
      const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - R));
      const i1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + R));
      const j0 = Math.max(0, Math.floor(Math.min(ay, by) - R));
      const j1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + R));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const px = i + 0.5 - ax;
          const py = j + 0.5 - ay;
          const tt = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
          const ex = px - tt * dx;
          const ey = py - tt * dy;
          const d = Math.sqrt(ex * ex + ey * ey);
          if (d > R) continue;
          const k = j * w + i;
          let wgt = (1 - smoothstep(0.45 * R, R, d)) * b.strength;
          if (valleyKind) {
            const depth = Math.max(t.env[k] - t.floor[k], 150);
            const level = (t.z[k] - t.floor[k]) / depth;
            wgt *= 1 - smoothstep(0.3, 0.8, level);
          }
          // Fade in/out at the ends so the override blends with the generic field.
          if (s === 0) wgt *= smoothstep(-0.05, 0.25, tt);
          if (s === pts.length - 2) wgt *= 1 - smoothstep(0.75, 1.05, tt);
          // Capped below 1: the GPU packs the weight in the fractional part of the index.
          wgt = Math.min(wgt, 0.999);
          // The dominant breeze of a cell is chosen on the weight times the specificity
          // of the documentation: a side-valley breeze keeps its valley inside the wide
          // corridor (5–6 km) of a regional or plain → mountain breeze.
          const score = wgt * specificity;
          if (score > L.score[k]) {
            L.score[k] = score;
            L.weight[k] = wgt;
            L.index[k] = bi;
            L.tx[k] = ux;
            L.ty[k] = uy;
          }
        }
      }
    }
  });
  const strip = ({ index, weight, tx, ty }: CuratedRaster): CuratedRaster => ({ index, weight, tx, ty });
  return {
    main: strip(main),
    cond: strip(cond),
    thin: strip(thin),
    breezes: breezes.map(({ id, name, kind, speedMs, window, condition }) => ({ id, name, kind, speedMs, window, condition: condition ?? null })),
    hazardSlots: rasterizeHazards(t, hazards),
    hazards,
  };
}

/**
 * GPU layout of the three layers in two RGBA float textures: each layer is two
 * floats, `index + min(weight, 0.999)` (−1 when empty) and the flow direction
 * angle (atan2(ty, tx)). tC = main, cond; tC2 = thin, then the first two documented
 * hazard slots (`index + min(weight, 0.999)`, −1 when none). The terrain texture tF
 * holds the narrowing of the valleys and the two other slots (`packTerrainExtras`).
 */
export function packCuratedLayers(c: CuratedLayer): { tC: Float32Array; tC2: Float32Array } {
  const n = c.main.index.length;
  const tC = new Float32Array(n * 4);
  const tC2 = new Float32Array(n * 4);
  const put = (out: Float32Array, o: number, L: CuratedRaster, k: number) => {
    const idx = L.index[k];
    out[o] = idx >= 0 && L.weight[k] > 0 ? idx + Math.min(L.weight[k], 0.999) : -1;
    out[o + 1] = Math.atan2(L.ty[k], L.tx[k]);
  };
  for (let k = 0; k < n; k++) {
    put(tC, k * 4, c.main, k);
    put(tC, k * 4 + 2, c.cond, k);
    put(tC2, k * 4, c.thin, k);
    tC2[k * 4 + 2] = packHazard(c, 0, k);
    tC2[k * 4 + 3] = packHazard(c, 1, k);
  }
  return { tC, tC2 };
}

/** One documented hazard slot of a cell, packed as `index + min(weight, 0.999)` (−1 when none). */
function packHazard(c: CuratedLayer, slot: number, k: number): number {
  const L = c.hazardSlots?.[slot];
  return L && L.index[k] >= 0 && L.weight[k] > 0 ? L.index[k] + Math.min(L.weight[k], 0.999) : -1;
}

/** GPU texture tF: narrowing of the valleys (terrain.ts → valleyFunnel), then documented hazard slots 3 and 4. */
export function packTerrainExtras(t: Terrain, c: CuratedLayer): Float32Array {
  const n = t.funnel.length;
  const tF = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    tF[k * 4] = t.funnel[k];
    tF[k * 4 + 1] = packHazard(c, 2, k);
    tF[k * 4 + 2] = packHazard(c, 3, k);
  }
  return tF;
}
