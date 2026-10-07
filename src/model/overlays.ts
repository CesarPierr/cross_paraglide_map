/**
 * Colour ramps that turn model fields into RGBA overlays draped on the terrain.
 */
import type { FieldResult } from './field';
import { clamp, smoothstep } from './raster';

export type OverlayMode = 'none' | 'exposure' | 'thermal' | 'convergence' | 'lift' | 'speed';

export function renderOverlay(mode: OverlayMode, f: FieldResult, gKmh: number, out: Uint8ClampedArray): void {
  const n = f.thermal.length;
  out.fill(0);
  if (mode === 'none') return;
  const windOn = smoothstep(3, 15, gKmh);
  for (let k = 0; k < n; k++) {
    const o = k * 4;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    if (mode === 'exposure') {
      const lift = f.dynamic[k];
      const lee = f.lee[k] * windOn;
      const ven = f.venturi[k] * smoothstep(10, 30, gKmh);
      if (lee > 0.05) {
        // Lee / rotor risk: red.
        r = 235;
        g = 64;
        b = 52;
        a = 0.62 * lee * (0.5 + 0.5 * smoothstep(10, 30, gKmh));
      } else if (lift > 0.25) {
        // Windward, air forced upwards: green (soaring band).
        const s = smoothstep(0.25, 2.5, lift);
        r = 40 + 30 * (1 - s);
        g = 210;
        b = 110;
        a = 0.2 + 0.5 * s;
      }
      if (ven > 0.15 && ven * 0.6 > a) {
        r = 255;
        g = 170;
        b = 30;
        a = 0.6 * ven;
      }
    } else if (mode === 'thermal') {
      const t = f.thermal[k];
      if (t > 0.08) {
        const s = smoothstep(0.08, 0.9, t);
        // yellow → orange → red
        r = 255;
        g = Math.round(230 - 170 * s);
        b = Math.round(60 * (1 - s));
        a = 0.12 + 0.55 * s;
      }
    } else if (mode === 'convergence') {
      const c = f.convergence[k];
      if (c > 0.12) {
        const s = smoothstep(0.12, 1.4, c);
        r = 214;
        g = 60 + 40 * (1 - s);
        b = 255;
        a = 0.15 + 0.65 * s;
      } else if (c < -0.25) {
        const s = smoothstep(0.25, 1.5, -c);
        r = 60;
        g = 120;
        b = 230;
        a = 0.35 * s;
      }
    } else if (mode === 'speed') {
      const kmh = Math.hypot(f.field[k * 4], f.field[k * 4 + 1]) * 3.6;
      const s = smoothstep(3, 40, kmh);
      r = Math.round(60 + 180 * s);
      g = Math.round(140 + 60 * (1 - Math.abs(s - 0.5) * 2));
      b = Math.round(240 * (1 - s));
      a = 0.2 + 0.4 * s;
    } else if (mode === 'lift') {
      const lift = f.thermal[k] * 2.5 + Math.max(f.dynamic[k], -1.5) + clamp(f.convergence[k], -1.5, 2.5);
      if (lift > 0.3) {
        const s = smoothstep(0.3, 3.5, lift);
        r = Math.round(80 + 175 * s);
        g = Math.round(220 - 60 * s);
        b = 60;
        a = 0.15 + 0.6 * s;
      } else if (lift < -0.4) {
        const s = smoothstep(0.4, 2, -lift);
        r = 50;
        g = 110;
        b = 235;
        a = 0.45 * s;
      }
    }
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = Math.round(clamp(a, 0, 1) * 255);
  }
}
