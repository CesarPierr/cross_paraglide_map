/**
 * Probe: how much the heading and the attitude of a glider flown hands up, straight, move in
 * realistic air (turbulence, thermals, a breeze change). Diagnostic for the flight model.
 *
 * Run: npx tsx scripts/dev/heading-probe.ts
 */
import { AirMass } from '../../apps/web/src/game/airmass';
import { newGlider, step, type AirSample, type GliderState } from '../../apps/web/src/game/flight';
import { LocalFrame } from '../../apps/web/src/game/geo';

const dt = 1 / 120;
const deg = (r: number) => (r * 180) / Math.PI;
const wrap = (a: number) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function stats(name: string, air: (t: number, g: GliderState) => AirSample, seconds = 300) {
  seed = 1;
  const g = newGlider(0, 0, 2000, 0);
  const h0 = g.heading;
  let maxDev = 0;
  let sum2 = 0;
  let n = 0;
  let maxRate = 0;
  let maxBank = 0;
  let sumBank2 = 0;
  let maxSwing = 0;
  let minSwing = 0;
  const win: number[] = [];
  let drift30 = 0;
  let folds = 0;
  for (let t = 0; t < seconds; t += dt) {
    const ev = step(g, { brakeL: 0, brakeR: 0, speedbar: 0 }, air(t, g), dt, rng);
    for (const e of ev) if (e.startsWith('collapse') || e === 'frontal') folds++;
    if (t < 5) continue;
    const dev = wrap(g.heading - h0);
    maxDev = Math.max(maxDev, Math.abs(dev));
    sum2 += dev * dev;
    n++;
    maxRate = Math.max(maxRate, Math.abs(g.turnRate));
    maxBank = Math.max(maxBank, Math.abs(g.bank));
    sumBank2 += g.bank * g.bank;
    maxSwing = Math.max(maxSwing, g.swing);
    minSwing = Math.min(minSwing, g.swing);
    win.push(g.heading);
  }
  // Largest heading change over any 10 s window.
  const k = Math.round(10 / dt);
  for (let i = k; i < win.length; i += 12) drift30 = Math.max(drift30, Math.abs(deg(wrap(win[i] - win[i - k]))));
  console.log(
    `${name.padEnd(36)} cap rms ${deg(Math.sqrt(sum2 / n)).toFixed(1).padStart(6)}° max ${deg(maxDev).toFixed(0).padStart(4)}°  max Δcap/10 s ${drift30.toFixed(0).padStart(4)}°  taux max ${deg(maxRate).toFixed(1).padStart(5)}°/s  roulis rms ${deg(Math.sqrt(sumBank2 / n)).toFixed(1)}° max ${deg(maxBank).toFixed(1)}°  tangage ${deg(minSwing).toFixed(1)}…${deg(maxSwing).toFixed(1)}°  fermetures ${folds}`,
  );
}

const a = new AirMass(new LocalFrame(6, 45), { month0: 6, day: 15, hour: 14, windFrom: 0, windKmh: 0, instability: 0.75, humidity: 0.4, randomWeather: false, timeScale: 1, seed: 11 });
const tb = { u: 0, v: 0, w: 0 };
const tbL = { u: 0, v: 0, w: 0 };
const tbR = { u: 0, v: 0, w: 0 };
const turb = (sigU: number, sigW: number, sigX: number, horiz = true, vert = true, tips = true) => (t: number, g: GliderState): AirSample => {
  const rx = Math.cos(g.heading) * 5;
  const ry = -Math.sin(g.heading) * 5;
  a.turbInto(g.x, g.y, g.z, t, sigU, sigW, 120, 80, sigX, 8, tb);
  a.turbInto(g.x - rx, g.y - ry, g.z, t, 0, sigW, 120, 80, sigX, 8, tbL, true);
  a.turbInto(g.x + rx, g.y + ry, g.z, t, 0, sigW, 120, 80, sigX, 8, tbR, true);
  const w = vert ? tb.w : 0;
  return { u: horiz ? tb.u : 0, v: horiz ? tb.v : 0, w, wL: tips ? tbL.w : w, wR: tips ? tbR.w : w, turbulence: Math.hypot(sigW, sigX) / 1.6 };
};
stats('air calme', () => ({ u: 0, v: 0, w: 0, turbulence: 0 }));
for (const [su, sw, sx] of [[0.5, 0.5, 0.3], [0.9, 1.0, 0.6], [1.3, 1.3, 1.0]]) {
  stats(`turb σu ${su} σw ${sw} σx ${sx} (tout)`, turb(su, sw, sx));
  stats(`  … horizontale seule`, turb(su, sw, sx, true, false, false));
  stats(`  … verticale + bouts d'aile`, turb(su, sw, sx, false, true, true));
  stats(`  … verticale sans bouts d'aile`, turb(su, sw, sx, false, true, false));
}
// A breeze that turns: a step of 3 m/s across the track at t = 20 s.
stats('rafale latérale 3 m/s (échelon)', (t) => ({ u: t > 20 ? 3 : 0, v: 0, w: 0, turbulence: 0 }), 60);
stats('brise latérale 3 m/s sur 10 s', (t) => ({ u: 3 * Math.min(1, Math.max(0, (t - 20) / 10)), v: 0, w: 0, turbulence: 0 }), 60);
// Thermal field of a strong day, no wind.
const day = new AirMass(new LocalFrame(6, 45), { month0: 6, day: 15, hour: 14, windFrom: 0, windKmh: 0, instability: 0.8, humidity: 0.4, randomWeather: false, timeScale: 1, seed: 7 });
day.season = 1;
const n = 41;
const lon = new Float32Array(n).map((_, i) => 5.9 + i * 0.005);
const lat = new Float32Array(n).map((_, j) => 45.1 - j * 0.005);
const th = new Float32Array(n * n).map(() => 0.7);
const fill = (v: number) => new Float32Array(n * n).fill(v);
day.placeSources({ cols: n, rows: n, lon, lat, thermal: th, elevation: fill(500), aspect: fill(180), slope: fill(2), lee: fill(0) }, [], 0, 0);
const [cx, cy] = day.frame.toXY(6.0, 45.0);
const thermals = (t: number, g: GliderState): AirSample => {
  const x = g.x + cx - 1500;
  const y = g.y + cy - 1500;
  const v = day.vertical(x, y, 1400, 500, 3000 + t);
  const rx = Math.cos(g.heading) * 5;
  const ry = -Math.sin(g.heading) * 5;
  return { u: v.u, v: v.v, w: v.w, turbulence: 0.2, wL: day.vertical(x - rx, y - ry, 1400, 500, 3000 + t).w, wR: day.vertical(x + rx, y + ry, 1400, 500, 3000 + t).w };
};
stats('champ de thermiques (sans turbulence)', thermals, 300);
