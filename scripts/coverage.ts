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

/** Beyond this distance from every sector outline, a take-off is outside the Alps the atlas covers (Jura, Bugey, lower Rhône…). */
const OUTSIDE_KM = 8;

function sectorOf(p: LngLat, massifs: AtlasMassif[]): AtlasMassif | undefined {
  const sectors = massifs.filter((m) => m.id !== 'alpes-francaises' && m.outline?.length);
  const within = sectors.find((m) => inside(p, m.outline!));
  if (within) return within;
  const edge = (m: AtlasMassif) => Math.min(...m.outline!.map((c) => km(p, c)));
  const near = sectors.map((m) => ({ m, d: edge(m) })).sort((a, b) => a.d - b.d)[0];
  return near && near.d <= OUTSIDE_KM ? near.m : undefined;
}

function main() {
  const atlas = JSON.parse(readFileSync(join(ROOT, 'apps/web/public/data/atlas.json'), 'utf8')) as Atlas;
  const ffvl = JSON.parse(readFileSync(join(ROOT, 'research_notes/Seconde passe 2026/sources/ffvl_sites_alpes.json'), 'utf8')) as { cols: string[]; rows: unknown[][] };
  const rows = ffvl.rows.map((r) => Object.fromEntries(ffvl.cols.map((c, i) => [c, r[i]]))) as Record<string, string | number>[];
  const takeoffs = rows.filter((r) => /d[ée]co/i.test(String(r.fonctions)) && !/interdit/i.test(String(r.praticabilite)));
  const bySector = new Map<string, { m: AtlasMassif; total: number; gaps: string[] }>();
  const outside: string[] = [];
  // Thermals described by texts; hotspots known only from GPS tracks (kk7) are counted apart.
  const documented = atlas.features.thermals.filter((f) => f.properties.origin !== 'kk7');
  const measured = atlas.features.thermals.filter((f) => f.properties.origin === 'kk7');
  let withTracks = 0;
  for (const t of takeoffs) {
    const p: LngLat = [Number(t.lon), Number(t.lat)];
    const m = sectorOf(p, atlas.massifs);
    if (!m) {
      outside.push(`${t.name} (FFVL ${t.id})`);
      continue;
    }
    const e = bySector.get(m.id) ?? { m, total: 0, gaps: [] };
    e.total++;
    const climb = nearest(p, documented);
    const hot = nearest(p, measured);
    if (climb.d > CLIMB_KM && hot.d <= CLIMB_KM) withTracks++;
    const breeze = nearest(p, atlas.features.breezes);
    const missing = [climb.d > CLIMB_KM && `aucun thermique décrit à moins de ${CLIMB_KM} km (le plus proche : ${climb.name}, ${climb.d.toFixed(1)} km)${hot.d <= CLIMB_KM ? ` — point chaud mesuré par les traces GPS à ${hot.d.toFixed(1)} km, à documenter` : ''}`, breeze.d > BREEZE_KM && `aucune brise à moins de ${BREEZE_KM} km`].filter(Boolean);
    if (missing.length) e.gaps.push(`${t.name} (FFVL ${t.id}, ${t.alt ?? '?'} m, vents ${t.vents_favorables || '?'}) : ${missing.join(' ; ')}`);
    bySector.set(m.id, e);
  }
  // Items whose text mentions a climb while no thermal is described within 1 km (how the Grand Ratz thermal was missed).
  const CLIMB_WORDS = /thermique|pompe|ascendance|plafond|ça monte|déclench|bulle/i;
  const NO_CLIMB = /pas de thermique|peu thermique|sans thermique/i;
  const textual: string[] = [];
  for (const cat of ['takeoffs', 'soaring', 'hazards', 'landings'] as const)
    for (const f of atlas.features[cat]) {
      if (f.geometry.type !== 'Point') continue;
      const text = `${f.properties.description} ${Object.values(f.properties.details ?? {}).join(' ')}`;
      const word = text.match(CLIMB_WORDS)?.[0];
      if (!word || NO_CLIMB.test(text) || nearest(f.geometry.coordinates, documented).d <= 1) continue;
      const hot = nearest(f.geometry.coordinates, measured);
      textual.push(`\`${f.properties.id}\` ${f.properties.name} (« ${word} »)${hot.d <= 1 ? ` — point chaud mesuré à ${Math.round(hot.d * 1000)} m` : ''}`);
    }
  const list = [...bySector.values()].sort((a, b) => b.gaps.length / b.total - a.gaps.length / a.total);
  const covered = list.reduce((s, x) => s + x.total - x.gaps.length, 0);
  const total = list.reduce((s, x) => s + x.total, 0);
  const out = [
    '# Couverture de l’atlas par rapport aux décollages officiels',
    '',
    `Généré par \`npm run data:coverage\`. Pour chaque décollage FFVL ouvert à la pratique (${total}), l’atlas doit documenter un thermique ou point de relance à moins de ${CLIMB_KM} km et une brise à moins de ${BREEZE_KM} km. Couverts : **${covered}/${total} (${Math.round((covered / total) * 100)} %)**. ${outside.length} décollages de la liste sont à plus de ${OUTSIDE_KM} km de tout secteur (Jura, Bugey, bas Rhône…) et ne sont pas comptés. Parmi les décollages sans thermique décrit, ${withTracks} ont un point chaud mesuré par les traces GPS (thermal.kk7.ch) à moins de ${CLIMB_KM} km.`,
    '',
    '| Secteur | Décollages | Couverts | Taux |',
    '| --- | --- | --- | --- |',
    ...list.map((x) => `| ${x.m.shortName} (\`${x.m.id}\`) | ${x.total} | ${x.total - x.gaps.length} | ${Math.round(((x.total - x.gaps.length) / x.total) * 100)} % |`),
    '',
    '## Décollages sans aérologie documentée à proximité',
    '',
    ...list.filter((x) => x.gaps.length).flatMap((x) => [`### ${x.m.shortName}`, '', ...x.gaps.map((g) => `- ${g}`), '']),
    `## Textes qui parlent d’un thermique sans thermique décrit à moins de 1 km (${textual.length})`,
    '',
    'Déco, soaring, piège ou atterrissage dont la description mentionne une ascendance : le thermique est à créer (position, déclencheur, heures) à partir du texte et des sources citées.',
    '',
    ...textual.sort().map((t) => `- ${t}`),
    '',
    '## Hors périmètre',
    '',
    outside.join(' · '),
    '',
  ];
  writeFileSync(join(ROOT, 'docs/COUVERTURE.md'), out.join('\n'));
  console.log(`couverture ${covered}/${total} → docs/COUVERTURE.md`);
}

main();
