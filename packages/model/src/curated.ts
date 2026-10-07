/**
 * Rasterises known breezes (from the research atlas) onto the model grid, so
 * that local knowledge overrides the generic valley/regional flow where it
 * applies. Each cell keeps the dominant breeze (highest influence).
 */
import type { CuratedBreezeInput } from '@brises/shared';
import type { CuratedLayer } from './field';
import { smoothstep } from './raster';
import type { Terrain } from './terrain';

export type { CuratedBreezeInput };

const VALLEY_KINDS = new Set(['valley', 'downvalley', 'lake', 'pass-transfer', 'katabatic']);

export function rasterizeCurated(t: Terrain, breezes: CuratedBreezeInput[]): CuratedLayer {
  const { grid } = t;
  const { width: w, height: h, size: n } = grid;
  const index = new Int16Array(n).fill(-1);
  const weight = new Float32Array(n);
  const tx = new Float32Array(n);
  const ty = new Float32Array(n);
  const cell = grid.cellM[(h / 2) | 0];

  breezes.forEach((b, bi) => {
    if (b.coords.length < 2) return;
    const pts = b.coords.map(([lon, lat]) => grid.toGrid(lon, lat));
    const R = Math.max(1.5, b.radiusM / cell);
    const valleyKind = VALLEY_KINDS.has(b.kind);
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
          if (wgt > weight[k]) {
            weight[k] = wgt;
            index[k] = bi;
            tx[k] = ux;
            ty[k] = uy;
          }
        }
      }
    }
  });
  return {
    index,
    weight,
    tx,
    ty,
    breezes: breezes.map(({ id, name, kind, speedMs, window }) => ({ id, name, kind, speedMs, window })),
  };
}
