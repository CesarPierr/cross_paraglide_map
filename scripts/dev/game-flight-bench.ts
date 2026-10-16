/**
 * Bench of the game's flight physics and air, with acceptance targets (PASS/FAIL):
 * the wing (polar, brake and gust responses, flare, wind gradient, turns, spiral, EN 926-2
 * collapses and stalls, active piloting), the air (thermal crossing and circling, mass
 * balance, ring, life cycle, windward core, bubbles, lean, cloud base, shade, convergence,
 * ridge lift, rotor, venturi, turbulence) and the per-step cost of the engine's physics.
 *
 * Run: npx tsx scripts/dev/game-flight-bench.ts            (all, ≈ 20 s)
 *      … --only wing|air|day|perf    a part;   --verbose   traces
 */
import { AirMass, PROFILE_DZ, type Scenario } from '../../apps/web/src/game/airmass';
import { newGlider, polar, step, WINGS, type AirSample, type Controls, type GliderState, type WingParams } from '../../apps/web/src/game/flight';
import { LocalFrame } from '../../apps/web/src/game/geo';
import { landingStep, launchStep, newLanding, newLaunch, touchdown, type LaunchInput, type LaunchState } from '../../apps/web/src/game/launch';
import { PilotAir, ReliefFlow, surfaceFactor, type ModelAirLike } from '../../apps/web/src/game/pilot-air';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const verbose = args.includes('--verbose');
const want = (k: string) => !only || only === k;

const dt = 1 / 120;
const rng = () => 0.5;
const still: AirSample = { u: 0, v: 0, w: 0, turbulence: 0 };
const H = (l = 0, r = 0, bar = 0, extra: Partial<Controls> = {}): Controls => ({ brakeL: l, brakeR: r, speedbar: bar, ...extra });
const deg = (r: number) => (r * 180) / Math.PI;

let pass = 0;
let fail = 0;
const failed: string[] = [];
function check(name: string, value: number, lo: number, hi: number, unit = '', digits = 1): void {
  const ok = value >= lo && value <= hi;
  if (ok) pass++;
  else {
    fail++;
    failed.push(name);
  }
  const range = `${Number.isFinite(lo) ? lo : '−∞'} … ${Number.isFinite(hi) ? hi : '+∞'}`;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${value.toFixed(digits)}${unit ? ' ' + unit : ''}  [${range}]`);
}
const section = (t: string) => console.log(`\n=== ${t}`);

/** Flies `seconds`; `c` and `air` may depend on time and state; `cb` sees each step. */
function fly(s: GliderState, c: Controls | ((t: number, s: GliderState) => Controls), seconds: number, air: AirSample | ((t: number, s: GliderState) => AirSample) = still, cb?: (s: GliderState, t: number, ev: string[]) => void): string[] {
  const all: string[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const ev = step(s, typeof c === 'function' ? c(t, s) : c, typeof air === 'function' ? air(t, s) : air, dt, rng);
    if (ev.length) all.push(...ev);
    cb?.(s, t, ev);
  }
  return all;
}
const turnOf = () => {
  let turned = 0;
  let last = NaN;
  return (h: number) => {
    if (Number.isFinite(last)) {
      let d = h - last;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      turned += d;
    }
    last = h;
    return turned;
  };
};
const hs = (s: GliderState, air: AirSample = still) => Math.hypot(s.vx - air.u, s.vy - air.v);

// ===================================================================== WING
if (want('wing')) {
  section('Polaire EN-B à 500 m (entrée progressive, 40 s par point)');
  const rows: string[] = [];
  let best = 0;
  let minSink = 9;
  let minSinkAt = 0;
  for (const b of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
    const s = newGlider(0, 0, 500, 0, WINGS.B);
    fly(s, (t) => H(Math.min(b, (t / 3) * b), Math.min(b, (t / 3) * b)), 40);
    const v = hs(s);
    const sink = -s.vzAir;
    rows.push(`${Math.round(b * 100)}%: ${(v * 3.6).toFixed(1)} km/h, ${sink.toFixed(2)} m/s, finesse ${(v / sink).toFixed(1)}, pression ${s.pressureL.toFixed(1)} kg`);
    best = Math.max(best, v / sink);
    if (sink < minSink) {
      minSink = sink;
      minSinkAt = b;
    }
    if (b === 0) check('vitesse bras hauts', v * 3.6, 36, 38, 'km/h');
    if (b === 0) check('pression bras hauts', s.pressureL, 0, 1, 'kg');
    if (b === 0.5) check('pression à 50 % (stabilisé)', s.pressureL, 3, 6, 'kg');
  }
  console.log('  ' + rows.join('\n  '));
  check('chute mini', minSink, 0.94, 1.02, 'm/s', 2);
  check('frein de la chute mini', minSinkAt, 0.15, 0.3, '', 2);
  check('finesse max', best, 9.5, 10.3, '', 2);
  {
    const s = newGlider(0, 0, 500, 0, WINGS.B);
    fly(s, H(0, 0, 1), 40);
    check('accélérateur à fond', hs(s) * 3.6, 48, 52, 'km/h');
    const lo = newGlider(0, 0, 500, 0);
    const hi = newGlider(0, 0, 3000, 0);
    fly(lo, H(), 30);
    fly(hi, H(), 30);
    check('vitesse vraie 3000 m / 500 m', hs(hi) / hs(lo), 1.09, 1.14, '', 3);
  }

  section('Réponse aux commandes');
  {
    const s = newGlider(0, 0, 500, 0);
    fly(s, H(), 20);
    let peak = -9;
    let lo = 9;
    let hi = -9;
    fly(s, H(0.2, 0.2), 15, still, (g, t) => {
      if (t < 3) peak = Math.max(peak, g.vz);
      if (t > 7) {
        lo = Math.min(lo, g.vz);
        hi = Math.max(hi, g.vz);
      }
    });
    check('coup de frein 20 % : ressource (vario au mieux)', peak, -0.75, -0.1, 'm/s', 2);
    check('… oscillation résiduelle après 7 s', hi - lo, 0, 0.2, 'm/s', 2);
  }
  {
    const s = newGlider(0, 0, 500, 0);
    fly(s, H(0.5, 0.5), 25);
    const v0 = hs(s);
    let pmax = 0;
    let vmax = 0;
    let vzmin = 9;
    let lo = 9;
    let hi = -9;
    fly(s, H(), 15, still, (g, t) => {
      pmax = Math.max(pmax, g.pitch);
      vmax = Math.max(vmax, hs(g));
      vzmin = Math.min(vzmin, g.vz);
      if (t > 8) {
        lo = Math.min(lo, g.vz);
        hi = Math.max(hi, g.vz);
      }
    });
    const trim = polar(0, 0).v;
    check('relâché 50 % → 0 : abattée', deg(pmax), 5, 20, '°');
    check('… survitesse', (vmax / trim - 1) * 100, 2, 15, '%');
    check('… plongée (vario)', vzmin, -3.5, -1.5, 'm/s');
    check('… amortie après 8 s (vario)', hi - lo, 0, 0.35, 'm/s', 2);
    void v0;
  }
  {
    // Active piloting damps the surge: brake as the wing comes ahead, release as it falls back.
    const surge = (active: boolean) => {
      const s = newGlider(0, 0, 500, 0);
      fly(s, H(0.5, 0.5), 25);
      let rms = 0;
      let n = 0;
      fly(
        s,
        (_t, g) => {
          const b = active ? Math.max(0, Math.min(0.6, 1.2 * g.pitchRate + 0.6 * g.pitch)) : 0;
          return H(b, b);
        },
        12,
        still,
        (g, t) => {
          if (t > 1.5) {
            rms += g.pitch * g.pitch;
            n++;
          }
        },
      );
      return Math.sqrt(rms / n);
    };
    const passive = surge(false);
    const act = surge(true);
    console.log(`  tangage efficace après relâché : passif ${deg(passive).toFixed(1)}°, actif ${deg(act).toFixed(1)}°`);
    check('pilotage actif : tangage (actif / passif)', act / passive, 0, 0.7, '', 2);
  }

  section('Arrondi (depuis bras hauts, freins à fond en 0,4 s)');
  {
    const s = newGlider(0, 0, 500, 0);
    fly(s, H(), 15);
    let vzmax = -9;
    let level = 0;
    let gmax = 0;
    let tStall = -1;
    const z0 = s.z;
    let zmax = -1e9;
    fly(
      s,
      (t) => H(Math.min(1, t / 0.4), Math.min(1, t / 0.4)),
      6,
      still,
      (g, t) => {
        vzmax = Math.max(vzmax, g.vz);
        if (g.vz > -0.3 && t < 3) level += dt;
        gmax = Math.max(gmax, g.load);
        zmax = Math.max(zmax, g.z - z0);
        if (tStall < 0 && g.stall > 0.5) tStall = t;
      },
    );
    check('ressource : vario max', vzmax, 0.3, 2, 'm/s');
    check('… palier (vario > −0,3)', level, 0.9, 2.5, 's');
    check('… facteur de charge max', gmax, 1.25, 2.1, 'g', 2);
    check('… décrochage si maintenu', tStall, 1.8, 5, 's');
  }

  section('Rafales (vol droit bras hauts, cap nord ; rafale à t = 1 s)');
  for (const [name, gu, gw, lo, hi] of [
    ['rafale de face +5 m/s', -5, 0, 1.5, 9],
    ['rafale arrière 5 m/s', 5, 0, -9, -1.5],
  ] as [string, number, number, number, number][]) {
    const ref = newGlider(0, 0, 1000, 0);
    fly(ref, H(), 15);
    const s = newGlider(0, 0, 1000, 0);
    let v0 = 0;
    let vJump = 0;
    fly(s, H(), 15, (t) => (t > 1 ? { u: 0, v: gu, w: gw, turbulence: 0 } : still), (g, t) => {
      if (t < 1) v0 = g.airspeed;
      if (t > 1 && t < 1 + 1.5 * dt) vJump = g.airspeed - v0;
    });
    check(`${name} : saut de vitesse air`, vJump, Math.sign(-gu) * 5 - 0.6, Math.sign(-gu) * 5 + 0.6, 'm/s', 2);
    check(`… altitude après 14 s / sans rafale`, s.z - ref.z, lo, hi, 'm');
  }
  {
    const s = newGlider(0, 0, 1000, 0);
    fly(s, H(), 10);
    const vz0 = s.vz;
    let t63 = -1;
    fly(s, H(), 3, (t) => (t > 0.5 ? { u: 0, v: 0, w: 2, turbulence: 0 } : still), (g, t) => {
      if (t > 0.5 && t63 < 0 && g.vz - vz0 > 0.63 * 2) t63 = t - 0.5;
    });
    check('ascendance +2 m/s : temps de réponse du vario (63 %)', t63, 0.12, 0.45, 's', 2);
  }

  section('Gradient de vent en finale (5 m/s à 10 m, nul au sol)');
  {
    // Log profile through 5 m/s at 10 m (z0 = 0.15 m, full wind at 60 m); final into the wind.
    const zr = 60;
    const z0 = 0.15;
    const Uref = 5 / surfaceFactor(10, z0, zr);
    const approach = (gradient: boolean) => {
      const s = newGlider(0, 0, 40, 0);
      const air = (_t: number, g: GliderState): AirSample => {
        const f = gradient ? surfaceFactor(Math.max(0, g.z), z0, zr) : surfaceFactor(10, z0, zr);
        return { u: 0, v: -Uref * f, w: 0, turbulence: 0, agl: g.z };
      };
      let va40 = 0;
      let vaLow = 99;
      fly(s, H(), 60, air, (g) => {
        if (g.z > 39 && g.z < 40) va40 = g.airspeed;
        if (g.z < 6 && g.z > 1) vaLow = Math.min(vaLow, g.airspeed);
      });
      // Re-run until the ground (z = 1 m) to read the touchdown.
      const s2 = newGlider(0, 0, 40, 0);
      let vzTd = 0;
      for (let t = 0; t < 90 && s2.z > 1; t += dt) {
        step(s2, H(), air(t, s2), dt, rng);
        vzTd = s2.vz;
      }
      return { loss: va40 - vaLow, vzTd };
    };
    const g = approach(true);
    const u = approach(false);
    console.log(`  perte de vitesse air sous 6 m : gradient ${g.loss.toFixed(2)} m/s, vent uniforme ${u.loss.toFixed(2)} m/s ; vario au contact ${g.vzTd.toFixed(2)} / ${u.vzTd.toFixed(2)} m/s`);
    check('gradient : perte de vitesse air non compensée', g.loss, 0.25, 3, 'm/s', 2);
    check('… chute au contact plus forte qu’en vent uniforme', u.vzTd - g.vzTd, 0.3, 2.5, 'm/s', 2);
  }

  section('Virages');
  {
    const s = newGlider(0, 0, 2000, 0);
    fly(s, H(0, 0.3), 20);
    check('frein int. 30 % : inclinaison', deg(s.bank), 18, 32, '°');
    check('… taux de virage', deg(s.turnRate), 14, 28, '°/s');
    const t = newGlider(0, 0, 2000, 0);
    fly(t, H(0.15, 0.5), 30);
    check('enroulement 15/50 % : inclinaison', deg(t.bank), 18, 32, '°');
    check('… chute', -t.vz, 1.1, 1.6, 'm/s', 2);
    check('… pas de vrille', t.spin, 0, 0.01, '', 2);
  }
  {
    // Weight shift: the weight leaves first, the wing answers the other way, then turns.
    const s = newGlider(0, 0, 2000, 0);
    fly(s, H(), 5);
    let minBank = 0;
    fly(s, (t) => H(0, 0, 0, { weight: Math.min(1, t / 0.4) }), 0.8, still, (g) => (minBank = Math.min(minBank, g.bank)));
    fly(s, H(0, 0, 0, { weight: 1 }), 8);
    check('sellette à droite : réponse initiale inverse', -deg(minBank), 0.5, 6, '°');
    check('… puis virage à droite', deg(s.turnRate), 6, 25, '°/s');
  }
  {
    const s = newGlider(0, 0, 2000, 0);
    fly(s, H(0.5, 0.5), 15);
    let skid = 0;
    fly(s, H(0.45, 0.75), 3, still, (g) => (skid = Math.max(skid, g.skid)));
    check('lent + frein int. profond : dérapage (virage à plat)', skid, 0.3, 1, '', 2);
  }

  section('Spirale (frein int. 75 % en 3 s, maintenu)');
  const spiral = (w: WingParams) => {
    const s = newGlider(0, 0, 3000, 0, w);
    let g = 0;
    let sink = 0;
    let rate = 0;
    let bank = 0;
    fly(s, (t) => H(0, Math.min(0.75, (t / 3) * 0.75)), 25, still, (x) => {
      g = Math.max(g, x.load);
      sink = Math.max(sink, -x.vz);
      rate = Math.max(rate, Math.abs(deg(x.turnRate)));
      bank = Math.max(bank, Math.abs(deg(x.bank)));
    });
    const tr = turnOf();
    tr(s.heading);
    let turned = 0;
    for (let t = 0; t < 40 && Math.abs(s.bank) > 0.35; t += dt) {
      step(s, H(), still, dt, rng);
      turned = tr(s.heading);
    }
    return { g, sink, rate, bank, exit: Math.abs(deg(turned)), spin: s.spin };
  };
  {
    const b = spiral(WINGS.B);
    const a = spiral(WINGS.A);
    const c = spiral(WINGS.C);
    console.log(`  A: ${a.bank.toFixed(0)}°, ${a.g.toFixed(1)} g, ${a.sink.toFixed(1)} m/s | B: ${b.bank.toFixed(0)}°, ${b.g.toFixed(1)} g, ${b.sink.toFixed(1)} m/s, ${b.rate.toFixed(0)}°/s, sortie ${b.exit.toFixed(0)}° | C: ${c.bank.toFixed(0)}°, ${c.g.toFixed(1)} g, ${c.sink.toFixed(1)} m/s, sortie ${c.exit.toFixed(0)}°`);
    check('EN-B : inclinaison', b.bank, 74, 82, '°');
    check('EN-B : facteur de charge', b.g, 3.2, 4.6, 'g', 2);
    check('EN-B : chute (rapports EN 12–19, réf. DHV 14)', b.sink, 12, 19, 'm/s');
    check('EN-B : taux de rotation', b.rate, 90, 145, '°/s', 0);
    check('EN-B : sortie spontanée mains hautes', b.exit, 0, 720, '°', 0);
    check('EN-A : ne s’engage pas (charge)', a.g, 0, 2.5, 'g', 2);
    check('EN-C : plus engagée que la B (chute)', c.sink - b.sink, 0.3, 8, 'm/s');
  }

  section('Fermetures (EN 926-2, mains hautes, 12 s)');
  const collapse = (w: WingParams, amount: number, counter = 0) => {
    const s = newGlider(0, 0, 1500, 0, w);
    s.collapse = { side: 1, amount: Math.min(amount, w.collapseMax), frontal: 0, cravat: 0, cravatSide: 0 };
    const tr = turnOf();
    let roll = 0;
    let turn = 0;
    const ev = fly(s, H(counter, 0), 12, still, (g) => {
      turn = tr(g.heading);
      roll = Math.max(roll, Math.abs(deg(g.bank)));
    });
    return { turn: Math.abs(deg(turn)), roll, ev };
  };
  {
    const a = collapse(WINGS.A, 0.5);
    const b = collapse(WINGS.B, 0.7);
    const c = collapse(WINGS.C, 0.75);
    console.log(`  A 50 % : ${a.turn.toFixed(0)}°, roulis ${a.roll.toFixed(0)}° | B 70 % : ${b.turn.toFixed(0)}°, ${b.roll.toFixed(0)}° | C 75 % : ${c.turn.toFixed(0)}°, ${c.roll.toFixed(0)}°`);
    check('EN-A 50 % : changement de cap', a.turn, 0, 90, '°', 0);
    check('EN-A 50 % : roulis', a.roll, 0, 15, '°', 0);
    check('EN-B 70 % : changement de cap', b.turn, 90, 180, '°', 0);
    check('EN-B 70 % : roulis', b.roll, 15, 45, '°', 0);
    check('EN-C 75 % : plus que la B, moins d’un tour', c.turn, b.turn, 360, '°', 0);
    const soft = collapse(WINGS.B, 0.5, 0.55);
    const hard = collapse(WINGS.B, 0.5, 0.97);
    check('fermeture 50 % + contre 55 % : pas de vrille', soft.ev.includes('spin') || soft.ev.includes('stall') ? 1 : 0, 0, 0, '', 0);
    check('fermeture 50 % + contre 97 % : vrille ou décrochage', hard.ev.includes('spin') || hard.ev.includes('stall') ? 1 : 0, 1, 1, '', 0);
  }
  {
    const s = newGlider(0, 0, 1500, 0, WINGS.B);
    s.collapse = { side: 0, amount: 0, frontal: 0.7, cravat: 0, cravatSide: 0 };
    let pmin = 0;
    let pmax = 0;
    let tReopen = -1;
    const tr = turnOf();
    let turn = 0;
    fly(s, H(), 10, still, (g, t, ev) => {
      if (tReopen < 0) pmin = Math.min(pmin, g.pitch);
      else pmax = Math.max(pmax, g.pitch);
      if (tReopen < 0 && ev.includes('reopened')) tReopen = t;
      turn = tr(g.heading);
    });
    check('frontale 70 % : bascule arrière', -deg(pmin), 5, 45, '°');
    check('… puis abattée à la réouverture', deg(pmax), 5, 45, '°');
    check('… réouverture spontanée', tReopen, 0.5, 5, 's');
    check('… cap conservé', Math.abs(deg(turn)), 0, 90, '°', 0);
  }

  section('Seuil de fermeture : rafale franche critique (montante puis descendante)');
  const critical = (w: WingParams, brake: number, bar: number) => {
    let lo = 0.1;
    let hi = 5;
    for (let k = 0; k < 18; k++) {
      const a = (lo + hi) / 2;
      const s = newGlider(0, 0, 2000, 0, w);
      fly(s, H(brake, brake, bar), 12);
      const ev = fly(s, H(brake, brake, bar), 2, (t) => ({ u: 0, v: 0, w: t < 1 ? a : -a, turbulence: 0 }));
      if (ev.some((e) => e.startsWith('collapse') || e === 'frontal')) hi = a;
      else lo = a;
    }
    return 2 * hi;
  };
  {
    check('EN-B bras hauts', critical(WINGS.B, 0, 0), 1.6, 2.4, 'm/s', 2);
    check('EN-B 35 % de frein (pression tenue)', critical(WINGS.B, 0.35, 0), 2.8, 9, 'm/s', 2);
    check('EN-B accélérateur à fond', critical(WINGS.B, 0, 1), 0.7, 1.4, 'm/s', 2);
    check('EN-A bras hauts', critical(WINGS.A, 0, 0), 2.4, 9, 'm/s', 2);
    check('EN-C bras hauts', critical(WINGS.C, 0, 0), 0.8, 1.8, 'm/s', 2);
  }

  section('Pilotage actif en air turbulent (10 min de vol droit, rafales franches)');
  {
    const a = new AirMass(new LocalFrame(6, 45), { month0: 6, day: 15, hour: 14, windFrom: 0, windKmh: 0, instability: 0.8, humidity: 0.4, randomWeather: false, timeScale: 1, seed: 11 });
    const tb = { u: 0, v: 0, w: 0 };
    const tbL = { u: 0, v: 0, w: 0 };
    const tbR = { u: 0, v: 0, w: 0 };
    const turb = (t: number, g: GliderState): AirSample => {
      const rx = Math.cos(g.heading) * 5;
      const ry = -Math.sin(g.heading) * 5;
      a.turbInto(g.x, g.y, g.z, t, 0.9, 1.0, 120, 80, 1.3, 8, tb);
      a.turbInto(g.x - rx, g.y - ry, g.z, t, 0, 1.0, 120, 80, 1.3, 8, tbL, true);
      a.turbInto(g.x + rx, g.y + ry, g.z, t, 0, 1.0, 120, 80, 1.3, 8, tbR, true);
      return { u: tb.u, v: tb.v, w: tb.w, wL: tbL.w, wR: tbR.w, turbulence: 0.6 };
    };
    const run = (mode: 'passive' | 'active' | 'bar') => {
      const s = newGlider(0, 0, 2000, 0);
      let pRef = 3;
      let b = 0;
      let n = 0;
      fly(
        s,
        (_t, g) => {
          if (mode === 'active') {
            // Keep the pressure: brake as it goes soft, damp the surges, back to ~15 % slowly.
            const p = Math.min(g.pressureL, g.pressureR);
            pRef += (p - pRef) * (dt / 1.5);
            const want = 0.15 + 0.6 * Math.max(0, (pRef - p) / Math.max(1, pRef)) + 0.5 * Math.max(0, g.pitchRate) + 0.3 * Math.max(0, g.pitch);
            b = Math.min(0.55, want);
            return H(b, b);
          }
          return mode === 'bar' ? H(0, 0, 1) : H();
        },
        600,
        turb,
        (_g, _t, ev) => {
          for (const e of ev) if (e.startsWith('collapse') || e === 'frontal') n++;
        },
      );
      return n;
    };
    const passive = run('passive');
    const active = run('active');
    const bar = run('bar');
    console.log(`  fermetures en 10 min : mains hautes ${passive}, pilotage actif ${active}, accélérateur ${bar}`);
    check('mains hautes : des fermetures', passive, 2, 200, '', 0);
    check('pilotage actif : au plus la moitié', active / Math.max(1, passive), 0, 0.5, '', 2);
    check('accélérateur : au moins 1,5 fois plus', bar / Math.max(1, passive), 1.5, 100, '', 2);
  }

  section('Décrochage, vrille');
  {
    const s = newGlider(0, 0, 2000, 0);
    let tStall = -1;
    fly(s, H(1, 1), 6, still, (g, t) => {
      if (tStall < 0 && g.stall > 0.5) tStall = t;
    });
    check('freins à fond tenus : décrochage', tStall, 1.5, 4.5, 's');
    check('… chute en décrochage', -s.vz, 4.5, 9, 'm/s');
    let pmax = 0;
    fly(s, H(), 8, still, (g) => (pmax = Math.max(pmax, g.pitch)));
    check('… abattée à la sortie (EN-B 30–60°)', deg(pmax), 25, 65, '°', 0);
    check('… récupéré', s.stall, 0, 0.05, '', 2);
  }
  {
    const s = newGlider(0, 0, 2000, 0);
    fly(s, H(0.5, 0.5), 15);
    let tSpin = -1;
    fly(s, H(0.1, 0.9), 4, still, (g, t) => {
      if (tSpin < 0 && g.spin > 0.5) tSpin = t;
    });
    check('lent puis frein int. 90 % / ext. relâché : vrille', tSpin, 0.2, 3, 's');
    let tStop = -1;
    fly(s, H(), 4, still, (g, t) => {
      if (tStop < 0 && g.spin < 0.05) tStop = t;
    });
    check('… mains hautes : arrêt de la vrille', tStop, 0, 1.6, 's');
  }

  section('Effet de sol (aile ~7 m au-dessus du pilote)');
  {
    const a = newGlider(0, 0, 500, 0);
    const b = newGlider(0, 0, 500, 0);
    fly(a, H(), 15, { u: 0, v: 0, w: 0, turbulence: 0, agl: 1 });
    fly(b, H(), 15, still);
    check('réduction de la chute à 1 m du sol', (1 - -a.vzAir / -b.vzAir) * 100, 0.05, 2, '%', 2);
  }

  section('Décollage et posé');
  {
    const runLaunch = (mode: 'forward' | 'reverse', head: number, cross: number, slope: number, input: (s: LaunchState) => LaunchInput) => {
      const s = newLaunch(mode);
      for (let t = 0; t < 25 && s.phase !== 'airborne' && s.phase !== 'failed' && s.phase !== 'aborted'; t += dt) launchStep(s, input(s), head, cross, slope, dt);
      return s;
    };
    const good = (s: LaunchState): LaunchInput => {
      const dab = s.theta > 1.15 && s.thetaRate > 0.2 ? 0.45 : 0.05;
      return { go: true, brakeL: dab, brakeR: dab, turn: s.theta > 1.3 };
    };
    check('face voile, vent 8 km/h, pente : décollé', runLaunch('forward', 2.2, 0, 0.3, good).phase === 'airborne' ? 1 : 0, 1, 1, '', 0);
    check('dos voile, vent 20 km/h : décollé', runLaunch('reverse', 5.5, 0, 0.25, good).phase === 'airborne' ? 1 : 0, 1, 1, '', 0);
    const strong = runLaunch('reverse', 9.5, 0, 0.2, () => ({ go: true, brakeL: 0.05, brakeR: 0.05, turn: false }));
    console.log(`  dos voile, vent 34 km/h sans contrôle : ${strong.phase} — ${strong.failReason}`);
    check('vent 34 km/h, voile montée sans contrôle : traîné ou arraché', strong.phase === 'failed' ? 1 : 0, 1, 1, '', 0);
    const wall = newLaunch('reverse');
    for (let t = 0; t < 4; t += dt) launchStep(wall, { go: false, brakeL: 0.2, brakeR: 0.2, turn: false }, 8, 0, 0.2, dt);
    check('vent 29 km/h, dos voile sans tirer : mur (voile basse, ouverte)', wall.theta, 0.2, 0.6, 'rad', 2);
    const killed = newLaunch('reverse');
    let k = 0;
    for (let t = 0; t < 12 && killed.phase !== 'aborted' && killed.phase !== 'failed'; t += dt) {
      k += dt;
      launchStep(killed, { go: k < 0.5, brakeL: 0.3, brakeR: 0.3, turn: false, kill: k > 0.5 }, 7.5, 0, 0.2, dt);
    }
    check('vent 27 km/h, voile montée puis affalée aux C : décollage interrompu proprement', killed.phase === 'aborted' ? 1 : 0, 1, 1, '', 0);
    const steer = newLaunch('forward');
    let running = 0;
    for (let t = 0; t < 8 && steer.phase !== 'airborne' && steer.phase !== 'failed' && running < 2; t += dt) {
      const g = good(steer);
      if (steer.phase === 'running') running += dt;
      launchStep(steer, { ...g, brakeR: g.brakeR + (steer.phase === 'running' ? 0.25 : 0) }, 2.2, 0, 0.05, dt);
    }
    check('course : 2 s de frein droit (+25 %) → la course tourne à droite', deg(steer.dir), 3, 30, '°');
  }
  {
    const flat = touchdown(2.5, 0, -0.8, 0, 0, 1);
    const uphill = touchdown(0, 9, -1.2, 0, -0.5, 0.866);
    check('contact à plat 0,8 m/s : posé à courir', flat.kind === null ? 1 : 0, 1, 1, '', 0);
    check('vent arrière dans une pente montante (9 m/s) : impact fort', uphill.impact, 4, 12, 'm/s');
    const run = (along: number, slopeDown: number, brake: number) => {
      const l = newLanding(along, 0);
      for (let t = 0; t < 10 && l.phase !== 'done'; t += dt) landingStep(l, t > 0.5 ? brake : 0, false, 0, slopeDown, dt);
      return l;
    };
    check('course à 4 m/s à plat, freins à fond : posé', run(4, 0, 1).kind === 'landed' ? 1 : 0, 1, 1, '', 0);
    check('course à 6 m/s en descente 25 % : chute', run(6, 0.25, 0.3).kind === 'hard' ? 1 : 0, 1, 1, '', 0);
  }
}

// ===================================================================== AIR
/** Air mass on flat ground (500 m) with one thermal source; `bump` makes the potential a smooth hill. */
function flatAir(opts: Partial<Scenario> = {}, smooth = true) {
  const a = new AirMass(new LocalFrame(6, 45), { month0: 6, day: 15, hour: 14, windFrom: 0, windKmh: 0, instability: 0.75, humidity: 0.4, randomWeather: false, timeScale: 1, seed: 7, ...opts });
  a.season = 1;
  const n = 21;
  const lon = new Float32Array(n).map((_, i) => 5.95 + i * 0.005);
  const lat = new Float32Array(n).map((_, j) => 45.05 - j * 0.005);
  const thermal = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) thermal[j * n + i] = smooth ? 0.6 + (i === 10 && j === 10 ? 0.05 : 0) : i === 10 && j === 10 ? 0.9 : 0.05;
  const fill = (v: number) => new Float32Array(n * n).fill(v);
  a.placeSources({ cols: n, rows: n, lon, lat, thermal, elevation: fill(500), aspect: fill(180), slope: fill(2), lee: fill(0) }, [], 0, 0);
  const src = a.sources.find((s) => Math.abs(s.x - a.frame.toXY(5.95 + 10 * 0.005, 45.05 - 10 * 0.005)[0]) < 300)!;
  for (const s of a.sources) if (s !== src) s.base = 0;
  src.base = 1;
  src.weight = 0.7;
  src.size = 0.71;
  src.cores = [{ off: 0.01, ang: 0, spin: 0, share: 1 }];
  return { a, src };
}

if (want('air')) {
  section('Thermique isolé (plaine, juillet, instable) : traversée et enroulement');
  {
    const { a, src } = flatAir();
    let t0 = 0;
    for (; t0 < 3000; t0 += 10) if ((a.column(src, 1500, t0)?.w ?? 0) > 2) break;
    const col = a.column(src, 1500, t0)!;
    const air = (t: number, s: GliderState): AirSample => {
      const v = a.vertical(s.x, s.y, s.z, 500, t0 + t);
      const rx = Math.cos(s.heading) * 5;
      const ry = -Math.sin(s.heading) * 5;
      return { u: v.u, v: v.v, w: v.w, turbulence: 0.05, wL: a.vertical(s.x - rx, s.y - ry, s.z, 500, t0 + t).w, wR: a.vertical(s.x + rx, s.y + ry, s.z, 500, t0 + t).w };
    };
    console.log(`  noyau ${col.w.toFixed(1)} m/s, rayon ${col.rc.toFixed(0)} m`);
    const s = newGlider(col.cx - 400, col.cy, 1500, Math.PI / 2);
    const tr: number[] = [];
    let k = 0;
    fly(s, H(0.15, 0.15), 80, air, (g) => {
      if (k++ % 60 === 0) tr.push(g.vz);
    });
    let flips = 0;
    for (let i = 2; i < tr.length; i++) if (Math.sign(tr[i] - tr[i - 1]) !== Math.sign(tr[i - 1] - tr[i - 2])) flips++;
    if (verbose) console.log('  ' + tr.map((v) => v.toFixed(1)).join(' '));
    check('traversée : changements de sens du vario (sur 160)', flips, 0, 14, '', 0);
    const c = newGlider(col.cx, col.cy - 15, 1500, Math.PI / 2);
    let sum = 0;
    let n = 0;
    fly(c, H(0.15, 0.5), 60, air, (g, t) => {
      if (t > 10) {
        sum += g.vz;
        n++;
      }
    });
    check('enroulement (frein int. 50 %) dans un noyau de 2,3 m/s', sum / n, 0.9, 1.6, 'm/s', 2);
    // Ring of sink (Allen): just outside the core.
    let ring = 0;
    for (let ang = 0; ang < 2 * Math.PI; ang += Math.PI / 8) ring = Math.min(ring, a.vertical(col.cx + Math.cos(ang) * 1.7 * col.rc, col.cy + Math.sin(ang) * 1.7 * col.rc, 1500, 500, t0).w);
    check('anneau descendant autour du noyau (Allen)', ring, -1.5, -0.1, 'm/s', 2);
    // Life cycle: share of time the column works at 1500 m, and bubbles of different strengths.
    let on = 0;
    let tot = 0;
    const peaks: number[] = [];
    let cur = 0;
    for (let t = 0; t < 20000; t += 10) {
      const w = a.column(src, 1500, t)?.w ?? 0;
      tot++;
      if (w > 0.3) {
        on++;
        cur = Math.max(cur, w);
      } else if (cur > 0) {
        peaks.push(cur);
        cur = 0;
      }
    }
    check('cycle de vie : part du temps active à 1500 m', on / tot, 0.25, 0.8, '', 2);
    check('… bulles d’intensités différentes (max/min des pics)', Math.max(...peaks) / Math.min(...peaks), 1.15, 3, '', 2);
  }
  {
    // Mass balance over a realistic window: a random-looking potential, many thermals.
    const frame = new LocalFrame(6, 45);
    const a = new AirMass(frame, { month0: 6, day: 15, hour: 14, windFrom: 0, windKmh: 0, instability: 0.75, humidity: 0.3, randomWeather: false, timeScale: 1, seed: 5 });
    a.season = 1;
    const n = 121;
    const [lonW, latS] = frame.toLngLat(-13000, -13000);
    const [lonE, latN] = frame.toLngLat(13000, 13000);
    const lon = new Float32Array(n).map((_, i) => lonW + ((lonE - lonW) * i) / (n - 1));
    const lat = new Float32Array(n).map((_, j) => latN - ((latN - latS) * j) / (n - 1));
    const thermal = new Float32Array(n * n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x = i / n;
        const y = j / n;
        thermal[j * n + i] = Math.max(0, 0.45 + 0.25 * Math.sin(x * 47) * Math.cos(y * 39) + 0.15 * Math.sin(x * 113 + y * 71));
      }
    const fill = (v: number) => new Float32Array(n * n).fill(v);
    a.placeSources({ cols: n, rows: n, lon, lat, thermal, elevation: fill(800), aspect: fill(180), slope: fill(5), lee: fill(0) }, [], 0, 0);
    const zi = a.ceilingAt(0, 0, 800);
    const z = 800 + 0.4 * (zi - 800);
    let sum = 0;
    let sum2 = 0;
    let k = 0;
    let up = 0;
    for (let x = -8000; x <= 8000; x += 40)
      for (let y = -8000; y <= 8000; y += 160) {
        const w = a.vertical(x, y, z, 800, 3000).w;
        sum += w;
        sum2 += w * w;
        if (w > 0) up++;
        k++;
      }
    console.log(`  ${a.sources.length} thermiques ; w moyen ${(sum / k).toFixed(3)} m/s, σ ${Math.sqrt(sum2 / k - (sum / k) ** 2).toFixed(2)} m/s, part montante ${((100 * up) / k).toFixed(0)} %`);
    check('conservation de la masse : w moyen sur 16 × 16 km à 0,4 zi', sum / k, -0.06, 0.06, 'm/s', 3);
  }
  {
    // Wind: windward core, bubble regime, lean with the site's profile, reversed under the inversion.
    const { a, src } = flatAir({ windFrom: 270, windKmh: 25 });
    let t0 = 0;
    for (; t0 < 3000; t0 += 10) if ((a.column(src, 1400, t0)?.w ?? 0) > 1.5) break;
    const col = a.column(src, 1400, t0)!;
    // Lift along the wind axis through the column: maximum upwind (west) of the axis' lean-only position.
    let best = -9;
    let bestX = 0;
    for (let dx = -300; dx <= 300; dx += 5) {
      const w = a.vertical(col.cx + dx, col.cy, 1400, 500, t0).w;
      if (w > best) {
        best = w;
        bestX = dx;
      }
    }
    let upSink = 0;
    let downSink = 0;
    for (let dx = 1.2 * col.rc; dx < 2.6 * col.rc; dx += 5) {
      upSink = Math.min(upSink, a.vertical(col.cx - dx, col.cy, 1400, 500, t0).w);
      downSink = Math.min(downSink, a.vertical(col.cx + dx, col.cy, 1400, 500, t0).w);
    }
    check('vent 25 km/h : cœur au vent du centre (m, < 0 = au vent)', bestX, -40, 15, 'm', 0);
    check('… descendance plus forte côté vent', downSink - upSink, 0.05, 3, 'm/s', 2);
    const strong = flatAir({ windFrom: 270, windKmh: 35 });
    let maxW = 0;
    let sumW = 0;
    let nW = 0;
    for (let t = 0; t < 1200; t += 2) {
      const c = strong.a.column(strong.src, 1200, t);
      if (!c) continue;
      const w = strong.a.vertical(c.cx, c.cy, 1200, 500, t).w;
      maxW = Math.max(maxW, w);
      sumW += Math.max(0, w);
      nW++;
    }
    check('vent 35 km/h : régime de bulles (max / moyenne de l’ascendance)', maxW / Math.max(0.01, sumW / Math.max(1, nW)), 1.8, 20, '', 2);
    // Lean with a valley breeze below and the opposite wind aloft.
    const { a: b, src: s2 } = flatAir({ windFrom: 270, windKmh: 20 });
    const nl = PROFILE_DZ.length;
    const u = new Float32Array(nl);
    const v = new Float32Array(nl);
    PROFILE_DZ.forEach((dz, i) => (u[i] = dz < 500 ? -3 : 5));
    b.setProfiles([s2.id], u, v);
    let lowX = 0;
    let highX = 0;
    for (let t = 0; t < 3000; t += 10) {
      const lo = b.column(s2, 500 + 350, t);
      const hi = b.column(s2, 500 + 1500, t);
      if (lo && hi) {
        lowX = lo.cx - s2.x;
        highX = hi.cx - s2.x;
        break;
      }
    }
    check('brise de vallée (vers l’ouest) sous le vent d’ouest : penche à l’ouest en bas', lowX, -900, -50, 'm', 0);
    check('… et vers l’est en haut', highX - lowX, 100, 5000, 'm', 0);
    // Reversed lean under the inversion: the column above 3/4 of the layer recedes.
    const r = flatAir({ windFrom: 270, windKmh: 20, humidity: 0 });
    const zi = r.a.ceilingAt(r.src.x, r.src.y, 500);
    let x75 = 0;
    let x95 = 0;
    for (let t = 0; t < 3000; t += 10) {
      const c1 = r.a.column(r.src, 500 + 0.75 * (zi - 500), t);
      const c2 = r.a.column(r.src, 500 + 0.95 * (zi - 500), t);
      if (c1 && c2) {
        x75 = c1.cx;
        x95 = c2.cx;
        break;
      }
    }
    check('inversion : le haut de la colonne revient contre le vent', x75 - x95, 20, 3000, 'm', 0);
  }
  {
    // Regional cloud base over relief, shade on the source.
    const frame = new LocalFrame(6, 45);
    const a = new AirMass(frame, { month0: 6, day: 15, hour: 14, windFrom: 0, windKmh: 0, instability: 0.8, humidity: 0.6, randomWeather: false, timeScale: 1, seed: 3 });
    a.season = 1;
    const n = 121;
    const [lonW, latS] = frame.toLngLat(-13000, -13000);
    const [lonE, latN] = frame.toLngLat(13000, 13000);
    const lon = new Float32Array(n).map((_, i) => lonW + ((lonE - lonW) * i) / (n - 1));
    const lat = new Float32Array(n).map((_, j) => latN - ((latN - latS) * j) / (n - 1));
    const elev = new Float32Array(n * n);
    const thermal = new Float32Array(n * n);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        elev[j * n + i] = 1200 + 800 * Math.sin(i / 6) * Math.cos(j / 7);
        thermal[j * n + i] = Math.max(0, 0.5 + 0.3 * Math.sin(i / 2.5) * Math.cos(j / 3.1));
      }
    const fill = (v: number) => new Float32Array(n * n).fill(v);
    a.placeSources({ cols: n, rows: n, lon, lat, thermal, elevation: elev, aspect: fill(180), slope: fill(10), lee: fill(0) }, [], 0, 0);
    const near = a.sources.filter((s) => Math.hypot(s.x, s.y) < 4000);
    const bases = near.map((s) => a.cloudBaseAt(s.x, s.y, s.ground));
    const grounds = near.map((s) => s.ground);
    console.log(`  ${near.length} sources à moins de 4 km : sol ${Math.min(...grounds).toFixed(0)}–${Math.max(...grounds).toFixed(0)} m, bases ${Math.min(...bases).toFixed(0)}–${Math.max(...bases).toFixed(0)} m`);
    check('base des cumulus régionale (écart sur 4 km)', Math.max(...bases) - Math.min(...bases), 0, 150, 'm', 0);
    // Shade: a cloud over the source for 10 min.
    const src = near[0];
    let t0 = 0;
    for (; t0 < 3000; t0 += 10) if ((a.column(src, src.ground + 150, t0)?.w ?? 0) > 0.8) break;
    const sunny = a.column(src, src.ground + 150, t0)?.w ?? 0;
    // Clouds list with one big cloud over the source, sun overhead.
    (a as unknown as { lastClouds: unknown[] }).lastClouds = [{ x: src.x, y: src.y, base: src.ground + 1500, top: src.ground + 3000, radius: 1500, size: 1, seed: 0 }];
    for (let t = 0; t < 360; t += 1) a.updateShade(180, 89, t0 + t - 360, 1, src.x, src.y);
    // Bubbles low in the column left the ground recently: they feel the shade first.
    const shaded = (a.column(src, src.ground + 150, t0)?.w ?? 0) / Math.max(0.01, sunny);
    check('ombre d’un cumulus : ascendance basse après 6 min (part)', shaded, 0, 0.45, '', 2);
  }
  {
    // Convergence: lift on the line and the breezes meeting across it.
    const { a } = flatAir({ windKmh: 0 }, true);
    a.convergences = [{ name: 'c', pts: [[-5000, 3000], [5000, 3000]], start: 10, end: 18 }];
    for (const s of a.sources) s.base = 0;
    const at = (y: number, z: number) => a.vertical(0, y, z, 500, 100);
    check('convergence : ascendance sur la ligne', at(3000, 900).w, 0.8, 3, 'm/s', 2);
    const north = at(3400, 700);
    const south = at(2600, 700);
    check('… bascule du vent en la traversant (Δ composante nord)', south.v - north.v, 1.2, 4, 'm/s', 2);
  }
  section('Relief fin : pente, crête, sous le vent, col');
  {
    // A 2D ridge across a west wind: windward slope 30°, crest at x = 0, 300 m high, steep lee.
    const ridge = (x: number) => {
      if (x < -520) return 1000;
      if (x < 0) return 1000 + 300 * (1 - (-x / 520) ** 1.5);
      if (x < 330) return 1300 - 300 * (x / 330);
      return 1000;
    };
    const ground = (x: number) => ridge(x);
    const flow = (x: number, z: number, U: number) => {
      const r = new ReliefFlow();
      const g = ground(x);
      r.update((px) => ground(px), x, 0, z, g, U, 0, 0);
      const o = { w: 0, du: 0 };
      r.flowAt(0, z - g + 12, o);
      const rot = { u: 0, w: 0, f: 0, block: 0, shear: 0 };
      r.rotorAt(0, z - g, rot);
      return { w: o.w * U * surfaceFactor(z - g, 0.15, 60), du: o.du, rot, sep: r.sep };
    };
    const U = 5.6;
    check('20 km/h : ascendance à 100 m en avant de la face, mi-hauteur', flow(-620, 1150, U).w, 0.8, 4, 'm/s', 2);
    check('… au-dessus de la crête (+200 m)', flow(-60, 1500, U).w, 0.3, 4, 'm/s', 2);
    check('… survitesse de crête (+30 m)', flow(0, 1330, U).du * 100, 15, 80, '%', 0);
    check('… descendance derrière la crête', flow(250, 1150, U).w, -4, -0.2, 'm/s', 2);
    const strong = flow(500, 1060, 9.7);
    check('35 km/h : rotor sous le vent (vent remontant près du sol, part de U)', -strong.rot.u, 0.15, 1, '', 2);
    check('… décollement détecté', strong.sep, 0.5, 1, '', 2);
    check('vent faible (12 km/h) : pas de décollement', flow(500, 1060, 3.3).sep, 0, 0.05, '', 2);
    // Gap 300 m wide between two 200 m walls across the wind.
    const gapGround = (_x: number, y: number) => (Math.abs(y) > 150 ? 1200 : 1000);
    const r = new ReliefFlow();
    r.update(gapGround, 0, 0, 1050, 1000, U, 0, 0);
    check('col de 300 m entre deux parois : venturi', (r.gap - 1) * 100, 15, 40, '%', 0);
  }
  {
    // Wind gradient and turbulence at the pilot (PilotAir with a flat terrain).
    const { a } = flatAir({ windFrom: 270, windKmh: 25 });
    for (const s of a.sources) s.base = 0;
    const pa = new PilotAir(a, () => 500);
    const model: ModelAirLike = { u: 7, v: 0, lift: 0, turbulence: 0, lee: 0, ground: 500, venturi: 0, shear: 0 };
    pa.setModel(model);
    const g = newGlider(0, 0, 510, Math.PI / 2);
    const out: AirSample = { u: 0, v: 0, w: 0, turbulence: 0 };
    pa.sample(g, 500, 100, dt, out);
    const unstable = pa.info.gradient;
    a.instability = 0.1;
    a.hour = 19.5;
    pa.sample(g, 500, 100, dt, out);
    const stable = pa.info.gradient;
    check('gradient : vent à 10 m, air instable (part du vent)', unstable, 0.7, 0.92, '', 2);
    check('… air stable (soir)', stable, 0.5, 0.78, '', 2);
    // Turbulence statistics along a 3 km straight line at 30 m and 300 m (mechanical, 25 km/h).
    a.instability = 0.05;
    a.hour = 8;
    const stats = (z: number) => {
      let s1 = 0;
      let s2 = 0;
      let n = 0;
      const gl = newGlider(0, 0, 500 + z, Math.PI / 2);
      for (let k = 0; k < 3000; k++) {
        gl.x = k;
        pa.sample(gl, 500, 50, dt, out);
        s1 += out.w;
        s2 += out.w * out.w;
        n++;
      }
      return { sd: Math.sqrt(s2 / n - (s1 / n) ** 2), model: pa.info.sigmaW };
    };
    const lo = stats(30);
    const hi = stats(300);
    console.log(`  σw mesuré / modèle : 30 m ${lo.sd.toFixed(2)} / ${lo.model.toFixed(2)} m/s, 300 m ${hi.sd.toFixed(2)} / ${hi.model.toFixed(2)} m/s`);
    check('turbulence mécanique : σw mesuré ≈ modèle (30 m)', lo.sd / lo.model, 0.6, 1.4, '', 2);
    check('… σw (Dryden ≈ 0,1 × vent à 6 m) à 30 m', lo.model, 0.25, 0.7, 'm/s', 2);
  }
}

// ===================================================================== DAY
if (want('day')) {
  section('Traversées de thermiques forts, jour instable (air composé : fond, anneau, bords, turbulence)');
  /** 40 straight crossings of a strong thermal (core ≈ 3 m/s) at 1500 m, through the core ± half a radius. */
  const crossings = (wing: WingParams, mode: 'passive' | 'active' | 'bar', inst: number) => {
    const { a, src } = flatAir({ instability: inst, windKmh: 0 });
    src.base = 1.25;
    let t0 = 0;
    for (; t0 < 6000; t0 += 10) if ((a.column(src, 1500, t0)?.w ?? 0) > (inst > 0.7 ? 2.6 : 1.6)) break;
    const pa = new PilotAir(a, () => 500);
    pa.setModel({ u: 0, v: 0, lift: 0, turbulence: 0, lee: 0, ground: 500, venturi: 0, shear: 0 });
    const out: AirSample = { u: 0, v: 0, w: 0, turbulence: 0 };
    let folds = 0;
    let wMax = 0;
    for (let k = 0; k < 40; k++) {
      const col = a.column(src, 1500, t0)!;
      const ang = (k * 2.39996) % (2 * Math.PI);
      const off = ((k % 5) / 4 - 0.5) * col.rc;
      const hx = Math.sin(ang);
      const hy = Math.cos(ang);
      const g = newGlider(col.cx - hx * 350 + hy * off, col.cy - hy * 350 - hx * off, 1500, ang, wing);
      let pRef = 2.5;
      for (let t = 0; t < 60; t += dt) {
        pa.sample(g, 500, t0 + t, dt, out);
        wMax = Math.max(wMax, out.w);
        let c: Controls;
        if (mode === 'active') {
          const p = Math.min(g.pressureL, g.pressureR);
          pRef += (p - pRef) * (dt / 1.5);
          const b = Math.min(0.55, 0.15 + 0.6 * Math.max(0, (pRef - p) / Math.max(1, pRef)) + 0.5 * Math.max(0, g.pitchRate) + 0.3 * Math.max(0, g.pitch));
          c = H(b, b);
        } else c = mode === 'bar' ? H(0, 0, 1) : H();
        const ev = step(g, c, out, dt, rng);
        g.z = 1500;
        for (const e of ev) if (e.startsWith('collapse') || e === 'frontal') folds++;
      }
    }
    return { folds, wMax };
  };
  const res: Record<string, number> = {};
  for (const inst of [0.45, 0.85])
    for (const [name, w, m] of [
      ['B', WINGS.B, 'passive'],
      ['Bact', WINGS.B, 'active'],
      ['Bbar', WINGS.B, 'bar'],
      ['C', WINGS.C, 'passive'],
    ] as [string, WingParams, 'passive' | 'active' | 'bar'][]) {
      const r = crossings(w, m, inst);
      res[`${name}${inst}`] = r.folds;
      if (name === 'B') console.log(`  instabilité ${inst} : ascendance max rencontrée ${r.wMax.toFixed(1)} m/s`);
    }
  console.log(`  fermetures sur 40 traversées — instabilité 0,45 : EN-B mains hautes ${res['B0.45']}, actif ${res['Bact0.45']}, barre ${res['Bbar0.45']}, EN-C ${res['C0.45']} | instabilité 0,85 : EN-B ${res['B0.85']}, actif ${res['Bact0.85']}, barre ${res['Bbar0.85']}, EN-C ${res['C0.85']}`);
  check('air moyen, EN-B mains hautes : (presque) jamais', res['B0.45'], 0, 2, '', 0);
  check('air instable, EN-B mains hautes : de temps en temps (sur 40)', res['B0.85'], 1, 14, '', 0);
  check('… pilotage actif : au plus la moitié', res['Bact0.85'], 0, Math.floor(res['B0.85'] / 2), '', 0);
  check('… accélérateur : bien plus', res['Bbar0.85'], 2 * res['B0.85'] + 2, 1000, '', 0);
  check('… EN-C : plus que l’EN-B', res['C0.85'], res['B0.85'] + 1, 1000, '', 0);
}

// ===================================================================== PERF
if (want('perf')) {
  section('Coût par pas (120 Hz) : air au centre et aux bouts d’aile + pas de vol');
  const frame = new LocalFrame(5.89, 45.31);
  const a = new AirMass(frame, { month0: 6, day: 15, hour: 14, windFrom: 270, windKmh: 15, instability: 0.7, humidity: 0.5, randomWeather: false, timeScale: 1, seed: 3 });
  a.season = 1;
  const n = 185;
  const [lonW, latS] = frame.toLngLat(-20000, -20000);
  const [lonE, latN] = frame.toLngLat(20000, 20000);
  const lon = new Float32Array(n).map((_, i) => lonW + ((lonE - lonW) * i) / (n - 1));
  const lat = new Float32Array(n).map((_, j) => latN - ((latN - latS) * j) / (n - 1));
  const thermal = new Float32Array(n * n);
  const elevation = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const y = j / n;
      thermal[j * n + i] = Math.max(0, 0.45 + 0.3 * Math.sin(x * 97) * Math.cos(y * 89) + 0.2 * Math.sin(x * 191 + y * 153));
      elevation[j * n + i] = 900 + 600 * Math.sin(x * 11) * Math.cos(y * 7);
    }
  const fill = (v: number) => new Float32Array(n * n).fill(v);
  a.placeSources({ cols: n, rows: n, lon, lat, thermal, elevation, aspect: fill(180), slope: fill(15), lee: fill(0.1) }, [], 0, 0);
  a.convergences = [{ name: 'c', pts: [[-3000, 2000], [0, 2500], [4000, 2600]], start: 11, end: 18 }];
  // Fine terrain: rolling ridges.
  const terrain = (x: number, y: number) => 900 + 250 * Math.sin(x / 700) * Math.cos(y / 900) + 60 * Math.sin(x / 90 + y / 130);
  const pa = new PilotAir(a, terrain);
  pa.setModel({ u: 3, v: 0.5, lift: 0.2, turbulence: 0.1, lee: 0.05, ground: 900, venturi: 0.1, shear: 0.01 });
  const g = newGlider(0, 0, 1800, 0.3, WINGS.B);
  const c = H(0.15, 0.3);
  const out: AirSample = { u: 0, v: 0, w: 0, turbulence: 0 };
  let t = 0;
  let reliefT = -1;
  const frameStep = () => {
    const ground = terrain(g.x, g.y);
    if (t - reliefT > 0.1) {
      reliefT = t;
      pa.update(g, ground);
    }
    pa.sample(g, ground, t, dt, out);
    step(g, c, out, dt, Math.random);
    t += dt;
  };
  for (let i = 0; i < 3000; i++) frameStep();
  const N = 24000;
  const heap0 = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) frameStep();
  const us = ((performance.now() - t0) / N) * 1000;
  const heap1 = process.memoryUsage().heapUsed;
  console.log(`  ${a.sources.length} thermiques dans la fenêtre ; ${us.toFixed(1)} µs par pas (moyenne sur ${N} pas, rafraîchissement du relief inclus) ; tas ${((heap1 - heap0) / 1024).toFixed(0)} kio`);
  check('coût par pas (portable)', us, 0, 150, 'µs', 1);
}

console.log(`\n${pass} PASS, ${fail} FAIL${fail ? ' : ' + failed.join(' ; ') : ''}`);
process.exitCode = fail ? 1 : 0;
