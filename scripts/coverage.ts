/**
 * Coverage of the atlas against the official flying sites: for every FFVL
 * take-off open to practice, is there a documented climb (thermal or relaunch
 * point) and a documented breeze nearby? The gaps, sector by sector, are the
 * research to-do list.
 *
 *   npm run data:coverage   → docs/COUVERTURE.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Atlas, AtlasFeature, AtlasMassif } from '@brises/shared';

const ROOT = process.cwd();
const CLIMB_KM = 3;
const BREEZE_KM = 6;

type LngLat = [number, number];
const km = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * 111.32 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110.57);
const coordsOf = (f: AtlasFeature): LngLat[] => (f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates);
const nearest = (p: LngLat, list: AtlasFeature[]) => {
  let best = Infinity;
  let name = '';
  for (const f of list)
    for (const c of coordsOf(f)) {
      const d = km(p, c);
      if (d < best) {
        best = d;
        name = f.properties.name;
      }
    }
  return { d: best, name };
};

function inside(p: LngLat, ring: LngLat[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function sectorOf(p: LngLat, massifs: AtlasMassif[]): AtlasMassif | undefined {
  const sectors = massifs.filter((m) => m.id !== 'alpes-francaises');
  return sectors.find((m) => m.outline && inside(p, m.outline)) ?? sectors.sort((a, b) => km(p, a.center) - km(p, b.center))[0];
}

function main() {
  const atlas = JSON.parse(readFileSync(join(ROOT, 'apps/web/public/data/atlas.json'), 'utf8')) as Atlas;
  const ffvl = JSON.parse(readFileSync(join(ROOT, 'research_notes/Seconde passe 2026/sources/ffvl_sites_alpes.json'), 'utf8')) as { cols: string[]; rows: unknown[][] };
  const rows = ffvl.rows.map((r) => Object.fromEntries(ffvl.cols.map((c, i) => [c, r[i]]))) as Record<string, string | number>[];
  const takeoffs = rows.filter((r) => /d[ée]co/i.test(String(r.fonctions)) && !/interdit/i.test(String(r.praticabilite)));
  const bySector = new Map<string, { m: AtlasMassif; total: number; gaps: string[] }>();
  for (const t of takeoffs) {
    const p: LngLat = [Number(t.lon), Number(t.lat)];
    const m = sectorOf(p, atlas.massifs);
    if (!m) continue;
    const e = bySector.get(m.id) ?? { m, total: 0, gaps: [] };
    e.total++;
    const climb = nearest(p, atlas.features.thermals);
    const breeze = nearest(p, atlas.features.breezes);
    const missing = [climb.d > CLIMB_KM && `aucun thermique à moins de ${CLIMB_KM} km (le plus proche : ${climb.name}, ${climb.d.toFixed(1)} km)`, breeze.d > BREEZE_KM && `aucune brise à moins de ${BREEZE_KM} km`].filter(Boolean);
    if (missing.length) e.gaps.push(`${t.name} (FFVL ${t.id}, ${t.alt ?? '?'} m, vents ${t.vents_favorables || '?'}) : ${missing.join(' ; ')}`);
    bySector.set(m.id, e);
  }
  const list = [...bySector.values()].sort((a, b) => b.gaps.length / b.total - a.gaps.length / a.total);
  const covered = list.reduce((s, x) => s + x.total - x.gaps.length, 0);
  const total = list.reduce((s, x) => s + x.total, 0);
  const out = [
    '# Couverture de l’atlas par rapport aux décollages officiels',
    '',
    `Généré par \`npm run data:coverage\`. Pour chaque décollage FFVL ouvert à la pratique (${total}), l’atlas doit documenter un thermique ou point de relance à moins de ${CLIMB_KM} km et une brise à moins de ${BREEZE_KM} km. Couverts : **${covered}/${total} (${Math.round((covered / total) * 100)} %)**.`,
    '',
    '| Secteur | Décollages | Couverts | Taux |',
    '| --- | --- | --- | --- |',
    ...list.map((x) => `| ${x.m.shortName} (\`${x.m.id}\`) | ${x.total} | ${x.total - x.gaps.length} | ${Math.round(((x.total - x.gaps.length) / x.total) * 100)} % |`),
    '',
    '## Décollages sans aérologie documentée à proximité',
    '',
    ...list.filter((x) => x.gaps.length).flatMap((x) => [`### ${x.m.shortName}`, '', ...x.gaps.map((g) => `- ${g}`), '']),
  ];
  writeFileSync(join(ROOT, 'docs/COUVERTURE.md'), out.join('\n'));
  console.log(`couverture ${covered}/${total} → docs/COUVERTURE.md`);
}

main();
