import { describe, expect, it } from 'vitest';
import { newLaunch, type LaunchState } from '../src/game/launch';
import { explainLaunch, MIN_SHOW, newSchoolInput, School, type SchoolInput } from '../src/game/school';

/** Runs the school 10 times a second for `seconds`, the input changed by `f` each tick. */
function run(sc: School, s: SchoolInput, seconds: number, f?: (s: SchoolInput) => void) {
  const end = s.t + seconds;
  let tip = null;
  while (s.t < end - 1e-9) {
    s.t += 0.1;
    f?.(s);
    tip = sc.update(s);
  }
  return tip;
}

function onLaunch(patch: Partial<LaunchState> = {}): SchoolInput {
  const s = newSchoolInput();
  s.phase = 'launch';
  s.launch = { ...newLaunch('forward'), ...patch };
  s.headwind = 3;
  return s;
}

function flying(patch: Partial<SchoolInput> = {}): SchoolInput {
  return Object.assign(newSchoolInput(), { phase: 'air', z: 1500, agl: 600, top: 2600, vario: -1 }, patch);
}

describe('school on the take-off', () => {
  it('checks the wind, then asks to pull the A risers (Z)', () => {
    const sc = new School();
    const s = onLaunch();
    expect(run(sc, s, 0.5)?.id).toBe('l-wind');
    expect(sc.tip.text).toMatch(/de face à 11 km\/h/);
    const tip = run(sc, s, MIN_SHOW + 0.5);
    expect(tip?.id).toBe('l-go');
    expect(tip?.keys).toEqual(['Z']);
  });

  it('warns of a tail wind at once', () => {
    const sc = new School();
    const tip = run(sc, Object.assign(onLaunch(), { headwind: -2 }), 0.3);
    expect(tip?.id).toBe('l-tail');
    expect(tip?.level).toBe(2);
    expect(sc.takeChime()).toBe(true);
  });

  it('follows the inflation: a brake step overhead, the side that falls, the run', () => {
    const sc = new School();
    const s = onLaunch({ phase: 'running', theta: 1.3, thetaRate: 0.5 });
    expect(run(sc, s, 0.2)?.keys).toEqual(['2']);
    s.launch = { ...s.launch!, theta: 1.5, thetaRate: 0, phi: 0.3 };
    let tip = run(sc, s, MIN_SHOW + 0.2);
    expect(tip?.id).toBe('l-side');
    expect(tip?.side).toBe('L');
    expect(tip?.text).toMatch(/droite : frein gauche/);
    s.launch = { ...s.launch!, phi: 0, stable: 1 };
    tip = run(sc, s, MIN_SHOW + 0.2);
    expect(tip?.id).toBe('l-run');
    expect(tip?.keys).toEqual(['0', 'Z']);
  });

  it('says hands up just after the lift-off', () => {
    const sc = new School();
    expect(run(sc, flying({ sinceLiftoff: 1, agl: 30 }), 0.2)?.keys).toEqual(['0']);
  });

  it('explains each failure', () => {
    expect(explainLaunch('L’aile t’a dépassé : il fallait la temporiser au frein en arrivant au-dessus de toi.', 3)).toMatch(/touche 2/);
    expect(explainLaunch('L’aile est retombée derrière : il manquait de vitesse ou il y avait trop de frein.', 3)).toMatch(/sans frein pendant la montée/);
    expect(explainLaunch('L’aile est partie sur le côté : contre au frein opposé et place-toi dessous.', 3)).toMatch(/frein gauche, A/);
    expect(explainLaunch('L’aile est retombée derrière.', -2.5)).toMatch(/Le vent venait de l’arrière \(9 km\/h\)/);
    expect(explainLaunch('Décollage interrompu : voile affalée proprement (C ou freins à fond). Replace-la pour recommencer.', 3)).toMatch(/R pour la replacer/);
  });
});

describe('school in the air', () => {
  it('turns towards the wing that lifts as the lift starts', () => {
    const sc = new School();
    const tip = run(sc, flying({ vario: 1.4, tipLift: 0.4 }), 0.3);
    expect(tip?.id).toBe('th-in');
    expect(tip?.side).toBe('L');
    expect(tip?.text).toMatch(/aile gauche se soulève : tourne à gauche/);
    expect(sc.takeChime()).toBe(true);
  });

  it('uses the core’s place when the tips say nothing', () => {
    const sc = new School();
    const tip = run(sc, flying({ vario: 1.2, tipLift: 0, coreDist: 80, coreRel: 70 }), 0.3);
    expect(tip?.side).toBe('R');
    expect(tip?.text).toMatch(/cœur est sur ta droite/);
  });

  it('guides the bank and the recentring while circling', () => {
    const sc = new School();
    const s = flying({ vario: 0.5, bank: 0.2, turnRate: 0.25, climbAvg: 0.4 });
    expect(run(sc, s, 4)?.id).toBe('t-tight');
    expect(sc.tip.keys).toEqual(['E', 'F']);
    Object.assign(s, { bank: 0.6, bestDist: 60, bestRel: 120, vario: 0.2 });
    let tip = run(sc, s, MIN_SHOW + 0.2);
    expect(tip?.id).toBe('t-shift');
    expect(tip?.arrow).toBe(120);
    s.bestRel = 10;
    tip = run(sc, s, 1.1);
    expect(tip?.text).toMatch(/Maintenant : ouvre le virage/);
    expect(tip?.keys).toEqual(['D']);
  });

  it('says when the ceiling is reached and where the next thermal is', () => {
    const sc = new School();
    const tip = run(sc, flying({ z: 2500, top: 2600, vario: 0.8, bank: 0.6, turnRate: 0.3, nextDist: 1400, nextRel: -90 }), 4);
    expect(tip?.id).toBe('t-top');
    expect(tip?.text).toMatch(/Plafond \(≈ 2.600 m\).*1,4 km sur ta gauche/);
  });

  it('warns of too much brake first, with the chime', () => {
    const sc = new School();
    run(sc, flying({ vario: 1.4, tipLift: 0.4 }), 0.3);
    sc.takeChime();
    const tip = run(sc, flying({ brakeL: 0.75, brakeR: 0.75, vario: 1.4, tipLift: 0.4 }), 0.2);
    expect(tip?.id).toBe('s-brake');
    expect(tip?.text).toMatch(/75 %/);
    expect(sc.takeChime()).toBe(true);
  });

  it('turns away from the relief, on its lower side', () => {
    const sc = new School();
    const tip = run(sc, flying({ reliefAhead: true, reliefSide: 1 }), 0.2);
    expect(tip?.text).toMatch(/vire à droite/);
    expect(tip?.side).toBe('R');
  });

  it('flies the approach to the chosen field and calls the flare', () => {
    const sc = new School();
    const s = flying({ agl: 280, landName: 'Lumbin', landDist: 2500, landRel: 30, landHeight: 600 });
    expect(run(sc, s, 0.3)?.text).toMatch(/vise « Lumbin », 2,5 km devant à droite/);
    Object.assign(s, { landDist: 300, landHeight: 130, agl: 130 });
    expect(run(sc, s, MIN_SHOW + 0.2)?.id).toBe('a-down');
    Object.assign(s, { landDist: 50, landHeight: 20, agl: 20, windRel: 80, windSpeed: 3 });
    expect(run(sc, s, MIN_SHOW + 0.2)?.id).toBe('a-face');
    Object.assign(s, { agl: 3.2, landHeight: 3.2, vz: -1.2, windRel: 0 });
    const tip = run(sc, s, 0.2);
    expect(tip?.id).toBe('a-flare');
    expect(tip?.keys).toEqual(['9']);
  });
});

describe('school pacing', () => {
  it('shows one tip at a time, at least MIN_SHOW s, then lets it rest', () => {
    const sc = new School();
    const s = flying({ vario: 1.4, tipLift: 0.4 });
    run(sc, s, 0.3);
    const first = sc.tip;
    // A less urgent tip does not replace it before MIN_SHOW.
    Object.assign(s, { vario: 0.1, tipLift: 0, nextDist: 900, nextRel: 0 });
    run(sc, s, 1);
    expect(sc.tip.id).toBe('th-in');
    // The same object, changed in place.
    expect(sc.tip).toBe(first);
    // Gone after MIN_SHOW once nothing applies; the entry tip then waits its cooldown.
    Object.assign(s, { nextDist: NaN });
    expect(run(sc, s, MIN_SHOW)).toBeNull();
    Object.assign(s, { vario: 1.4, tipLift: 0.4 });
    expect(run(sc, s, 2)).toBeNull();
    expect(run(sc, s, 15)?.id).toBe('th-in');
  });

  it('costs microseconds per update', () => {
    const sc = new School();
    const s = flying({ vario: 0.5, bank: 0.6, turnRate: 0.3, climbAvg: 0.8, bestDist: 60, bestRel: 40 });
    const n = 20000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      s.t += 0.1;
      s.bestRel = (i * 7) % 360 - 180;
      sc.update(s);
    }
    expect(((performance.now() - t0) / n) * 1000).toBeLessThan(20);
  });
});
