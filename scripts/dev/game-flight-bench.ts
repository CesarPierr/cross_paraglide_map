/**
 * Bench of the game's flight model: steady polar per brake position, response to a small
 * brake input, vario trace through a thermal and while circling in it.
 * Run: npx tsx scripts/dev/game-flight-bench.ts
 */
import { newGlider, step, WINGS, type AirSample, type Controls, type GliderState } from '../../apps/web/src/game/flight';

const still: AirSample = { u: 0, v: 0, w: 0, turbulence: 0 };
const dt = 1 / 120;
const rng = () => 0.5;

function run(s: GliderState, c: Controls, seconds: number, air: (s: GliderState, t: number) => AirSample = () => still, every = 0.5) {
  const out: { t: number; vz: number; v: number; bank: number; pitch: number }[] = [];
  let next = 0;
  for (let t = 0; t < seconds; t += dt) {
    step(s, c, air(s, t), dt, rng);
    if (t >= next) {
      out.push({ t, vz: s.vz, v: s.airspeed * 3.6, bank: (s.bank * 180) / Math.PI, pitch: (s.pitch * 180) / Math.PI });
      next += every;
    }
  }
  return out;
}

console.log('--- Polaire stabilisée (EN-B), 40 s par point');
for (const b of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
  const s = newGlider(0, 0, 3000, 0, WINGS.B);
  run(s, { brakeL: b, brakeR: b, speedbar: 0 }, 40);
  console.log(`frein ${Math.round(b * 100)} %: ${(s.airspeed * 3.6).toFixed(1)} km/h, chute ${(-s.vzAir).toFixed(2)} m/s, finesse ${(s.airspeed / -s.vzAir).toFixed(1)}`);
}

console.log('\n--- Petit coup de frein 20 % depuis le bras haut (trace vario)');
{
  const s = newGlider(0, 0, 3000, 0, WINGS.B);
  run(s, { brakeL: 0, brakeR: 0, speedbar: 0 }, 20);
  const tr = run(s, { brakeL: 0.2, brakeR: 0.2, speedbar: 0 }, 12, undefined, 0.5);
  console.log(tr.map((p) => `${p.t.toFixed(1)}s ${p.vz.toFixed(2)}`).join(' | '));
}

// --- With the game's air mass: one thermal on flat ground, July, unstable.
import { AirMass } from '../../apps/web/src/game/airmass';
import { LocalFrame } from '../../apps/web/src/game/geo';

function airMass(turb = 0.1) {
  const a = new AirMass(new LocalFrame(6, 45), { month0: 6, day: 15, hour: 14, windFrom: 0, windKmh: 0, instability: 0.75, humidity: 0.4, randomWeather: false, timeScale: 1, seed: 7 });
  a.season = 1;
  const n = 5;
  const lon = new Float32Array(n).map((_, i) => 5.99 + i * 0.005);
  const lat = new Float32Array(n).map((_, j) => 45.01 - j * 0.005);
  const fill = (v: number) => new Float32Array(n * n).fill(v);
  const thermal = fill(0.05);
  thermal[12] = 0.9;
  a.placeSources({ cols: n, rows: n, lon, lat, thermal, elevation: fill(500), aspect: fill(180), slope: fill(2), lee: fill(0) }, [], 0, 0);
  const src = a.sources[0];
  // Find a time when the thermal is active at 1500 m.
  let t0 = 0;
  for (; t0 < 2000; t0 += 10) if ((a.column(src, 1500, t0)?.w ?? 0) > 2) break;
  const col = a.column(src, 1500, t0)!;
  const airAt = (s: GliderState, t: number): AirSample => {
    const v = a.vertical(s.x, s.y, s.z, 500, t0 + t);
    const rx = Math.cos(s.heading) * 5;
    const ry = -Math.sin(s.heading) * 5;
    const I = turb + v.shear;
    const g = a.turbulenceAt(s.x, s.y, s.z, t0 + t, s.z - 500, I);
    return {
      u: g.u,
      v: g.v,
      w: v.w + g.w,
      turbulence: I,
      wL: a.vertical(s.x - rx, s.y - ry, s.z, 500, t0 + t).w + a.turbulenceAt(s.x - rx, s.y - ry, s.z, t0 + t, s.z - 500, I).w,
      wR: a.vertical(s.x + rx, s.y + ry, s.z, 500, t0 + t).w + a.turbulenceAt(s.x + rx, s.y + ry, s.z, t0 + t, s.z - 500, I).w,
    };
  };
  return { a, src, col, airAt, t0 };
}

const fmt = (tr: { t: number; vz: number }[]) => tr.map((p) => p.vz.toFixed(1)).join(' ');
const flips = (tr: { vz: number }[]) => {
  let n = 0;
  for (let i = 2; i < tr.length; i++) if (Math.sign(tr[i].vz - tr[i - 1].vz) !== Math.sign(tr[i - 1].vz - tr[i - 2].vz)) n++;
  return n;
};

{
  const { col, airAt, a } = airMass();
  console.log(`\n--- Thermique: noyau ${col.w.toFixed(1)} m/s, rayon ${col.rc.toFixed(0)} m, puits de fond ${a.vertical(5000, 5000, 1500, 500, 0).w.toFixed(2)} m/s`);
  const s = newGlider(col.cx - 400, col.cy, 1500, Math.PI / 2, WINGS.B);
  const tr = run(s, { brakeL: 0.15, brakeR: 0.15, speedbar: 0 }, 80, airAt, 0.5);
  console.log('Traversée en ligne droite (vario toutes les 0,5 s):\n' + fmt(tr));
  console.log(`changements de sens du vario: ${flips(tr)} sur ${tr.length} points`);
}
{
  const { col, airAt } = airMass();
  // Enter the core and circle with 35 % inside brake.
  const s = newGlider(col.cx, col.cy - 15, 1500, Math.PI / 2, WINGS.B);
  const tr = run(s, { brakeL: 0.15, brakeR: 0.5, speedbar: 0 }, 60, airAt, 0.5);
  const mean = tr.slice(20).reduce((a, p) => a + p.vz, 0) / (tr.length - 20);
  console.log(`\nEnroulement (frein int. 50 %): taux moyen ${mean.toFixed(2)} m/s, inclinaison ~${tr[tr.length - 1].bank.toFixed(0)}°\n` + fmt(tr));
  console.log(`changements de sens du vario: ${flips(tr)} sur ${tr.length} points`);
}

if (process.argv.includes('--track')) {
  const { col, airAt } = airMass();
  const s = newGlider(col.cx - 400, col.cy, 1500, Math.PI / 2, WINGS.B);
  for (let k = 0; k < 16; k++) {
    run(s, { brakeL: 0.15, brakeR: 0.15, speedbar: 0 }, 5, airAt, 5);
    console.log(`t=${(k + 1) * 5}s x=${(s.x - col.cx).toFixed(0)} y=${(s.y - col.cy).toFixed(0)} cap=${((s.heading * 180) / Math.PI).toFixed(0)} bank=${((s.bank * 180) / Math.PI).toFixed(0)} z=${s.z.toFixed(0)}`);
  }
}

if (process.argv.includes('--profile')) {
  const { col, a, src, t0 } = airMass();
  console.log('cores', JSON.stringify(src.cores), 'size', src.size.toFixed(2), 'weight', src.weight.toFixed(2));
  const line: string[] = [];
  for (let x = -500; x <= 500; x += 50) line.push(`${x}:${a.vertical(col.cx + x, col.cy, 1500, 500, t0).w.toFixed(1)}`);
  console.log(line.join(' '));
}

if (process.argv.includes('--spiral')) {
  for (const id of ['A', 'B', 'C'] as const) {
    const s = newGlider(0, 0, 3000, 0, WINGS[id]);
    let maxG = 0;
    let maxSink = 0;
    let maxRate = 0;
    let maxBank = 0;
    const dt = 1 / 120;
    for (let t = 0; t < 25; t += dt) {
      // Progressive entry: inside brake to 75 % over 3 s, held.
      const b = Math.min(0.75, (t / 3) * 0.75);
      step(s, { brakeL: 0, brakeR: b, speedbar: 0 }, still, dt, rng);
      maxG = Math.max(maxG, s.load);
      maxSink = Math.max(maxSink, -s.vz);
      maxRate = Math.max(maxRate, Math.abs((s.yawRate * 180) / Math.PI));
      maxBank = Math.max(maxBank, Math.abs((s.bank * 180) / Math.PI));
    }
    // Release: count the turn until the bank is back under 20°.
    let turned = 0;
    let last = s.heading;
    for (let t = 0; t < 30 && Math.abs(s.bank) > 0.35; t += dt) {
      step(s, { brakeL: 0, brakeR: 0, speedbar: 0 }, still, dt, rng);
      let d = s.heading - last;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      turned += d;
      last = s.heading;
    }
    console.log(`${id}: spirale ${maxBank.toFixed(0)}°, ${maxG.toFixed(1)} g, chute ${maxSink.toFixed(1)} m/s, ${maxRate.toFixed(0)}°/s ; sortie mains hautes en ${Math.abs((turned * 180) / Math.PI).toFixed(0)}°`);
  }
}
