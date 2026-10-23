/**
 * Check of the game's challenges (apps/web/src/game/challenges.ts) on every take-off of the
 * atlas: for each take-off, each challenge and each level, on several kinds of day, the
 * generated course must keep every rule (validateChallenge: turn points inside the playable
 * grid, over flyable relief, under the day's ceiling; exact distances; FAI rule; the course
 * closing at the take-off). Prints the counts, the failures and why, and the generation time.
 *
 *   npx tsx scripts/dev/challenges-check.ts [apiBase]     (default http://localhost:8080)
 *   … --verbose    every failure
 *   … --all        the game's whole list: the atlas take-offs and the FFVL ones it adds
 */
import { readFileSync } from 'node:fs';
import { loadDem } from '@brises/model/node';
import { inflateAtlas, mergeAtlasText, type Atlas, type AtlasText, type FlyingSite } from '@brises/shared';
import { AirMass, type Scenario } from '../../apps/web/src/game/airmass';
import { CHALLENGE_KM, gridHeights, makeChallenge, validateChallenge, type ChallengeDay, type ChallengeKind, type ChallengeLevel } from '../../apps/web/src/game/challenges';
import { LocalFrame } from '../../apps/web/src/game/geo';
import { listTakeoffs } from '../../apps/web/src/game/takeoffs';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const api = args.find((a) => a.startsWith('http')) ?? 'http://localhost:8080';

// As the game reads it: the core, then its text (the sheets' altitude and orientation).
const atlas = mergeAtlasText(inflateAtlas((await (await fetch(`${api}/api/atlas`)).json()) as Atlas), (await (await fetch(`${api}/api/atlas/text`)).json()) as AtlasText);
const { grid, elevation } = loadDem();
/** Name and place of each take-off: the atlas ones, or the game's list (as GameApp builds it). */
let takeoffs: { name: string; lon: number; lat: number }[] = (atlas.features.takeoffs ?? []).filter((f) => f.geometry.type === 'Point').map((f) => ({ name: f.properties.name, lon: f.geometry.coordinates[0] as number, lat: f.geometry.coordinates[1] as number }));
if (args.includes('--all')) {
  const ffvl = JSON.parse(readFileSync('apps/web/public/data/sites-ffvl.json', 'utf8')) as FlyingSite[];
  const inGrid = (lon: number, lat: number) => {
    const [x, y] = grid.toGrid(lon, lat);
    return x > 20 && y > 20 && x < grid.width - 20 && y < grid.height - 20;
  };
  takeoffs = listTakeoffs(atlas, ffvl, inGrid);
}

/** Days: the season's thermals, the air mass, humidity (cloud base), the synoptic wind. */
const DAYS: { name: string; season: number; hour: number; instability: number; humidity: number; windFrom: number; windKmh: number }[] = [
  { name: 'été, 14 h, bonne journée', season: 0.9, hour: 14, instability: 0.6, humidity: 0.5, windFrom: 270, windKmh: 10 },
  { name: 'printemps, 12 h, faible, base basse', season: 0.55, hour: 12, instability: 0.3, humidity: 0.7, windFrom: 0, windKmh: 8 },
  { name: 'été, vent de sud-ouest 25 km/h', season: 0.85, hour: 15, instability: 0.5, humidity: 0.4, windFrom: 225, windKmh: 25 },
];

const KINDS: { kind: ChallengeKind; levels: ChallengeLevel[] }[] = [
  { kind: 'outreturn', levels: [0, 1, 2] },
  { kind: 'fai', levels: [0, 1, 2] },
];

let total = 0;
let failed = 0;
let maxMs = 0;
let sumMs = 0;
let outside = 0;
for (const d of DAYS) {
  console.log(`\n=== ${d.name}`);
  const fails = new Map<string, string[]>();
  let lowCeiling = 0;
  let n = 0;
  for (const f of takeoffs) {
    const { lon, lat } = f;
    const frame = new LocalFrame(lon, lat);
    const terrain = gridHeights(grid, (k) => elevation[k], (x, y) => frame.toLngLat(x, y));
    if (terrain.heightAt(0, 0) === null) {
      if (d === DAYS[0]) {
        outside++;
        console.log(`  hors de la grille jouable (pas dans le jeu) : ${f.name}`);
      }
      continue;
    }
    n++;
    const scenario: Scenario = { month0: 6, day: 15, hour: d.hour, windFrom: d.windFrom, windKmh: d.windKmh, instability: d.instability, humidity: d.humidity, randomWeather: false, timeScale: 1, seed: 1 };
    const air = new AirMass(frame, scenario);
    air.season = d.season;
    const day: ChallengeDay = { windFrom: d.windFrom, windKmh: d.windKmh, top: (g) => Math.min(air.ceiling(g), air.cloudBase(g)) };
    // The ceiling challenge: the day's top over the take-off's region, against its altitude.
    const alt = terrain.heightAt(0, 0)!;
    let reg = 0;
    let rn = 0;
    for (let j = -2; j <= 2; j++)
      for (let i = -2; i <= 2; i++) {
        const h = terrain.heightAt(i * 2000, j * 2000);
        if (h !== null) {
          reg += h;
          rn++;
        }
      }
    if (day.top(reg / rn) - 100 < alt + 150) lowCeiling++;
    for (const { kind, levels } of KINDS)
      for (const level of levels) {
        const t0 = performance.now();
        const ch = makeChallenge(kind, level, terrain, day);
        const ms = performance.now() - t0;
        sumMs += ms;
        maxMs = Math.max(maxMs, ms);
        total++;
        // Checked again here, independently of the generator's own verdict.
        const issues = validateChallenge(ch, terrain, day);
        if (issues.length || !ch.ok) {
          failed++;
          const key = `${kind} ${kind === 'outreturn' ? CHALLENGE_KM.outreturn[level] : CHALLENGE_KM.fai[level]} km`;
          const l = fails.get(key) ?? [];
          l.push(`${f.name} (${Math.round(alt)} m) : ${(issues.length ? issues : ch.issues).join(' ; ')}`);
          fails.set(key, l);
        }
      }
  }
  console.log(`  ${n} décos jouables × 6 défis`);
  for (const { kind, levels } of KINDS)
    for (const level of levels) {
      const key = `${kind} ${kind === 'outreturn' ? CHALLENGE_KM.outreturn[level] : CHALLENGE_KM.fai[level]} km`;
      const l = fails.get(key) ?? [];
      console.log(`  ${key.padEnd(16)} ${n - l.length}/${n} valides${l.length ? ` — ${l.length} échecs` : ''}`);
      for (const s of verbose ? l : l.slice(0, 5)) console.log(`      ${s}`);
      if (!verbose && l.length > 5) console.log(`      … (${l.length - 5} autres, --verbose)`);
    }
  console.log(`  défi plafond : plafond du jour à moins de 250 m au-dessus du déco sur ${lowCeiling}/${n} décos (défi signalé dur au départ, le but juste sous le plafond)`);
}
console.log(`\n${takeoffs.length} décos ${args.includes('--all') ? 'dans la liste du jeu' : "dans l'atlas"}, ${outside} hors de la grille jouable ; ${total} défis générés, ${failed} échecs.`);
console.log(`Génération : ${(sumMs / total).toFixed(2)} ms en moyenne, ${maxMs.toFixed(1)} ms au plus.`);
process.exit(failed ? 1 : 0);
