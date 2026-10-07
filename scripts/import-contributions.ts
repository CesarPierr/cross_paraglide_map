/**
 * Turns accepted user contributions into a dataset following the research
 * contract (research_notes/Brises des Alpes françaises/_schema.md), so they
 * enter the atlas at the next `npm run data:build -- data/contributions`.
 *
 * Usage:
 *   npx tsx scripts/import-contributions.ts export.json          (file saved from the admin export)
 *   API_URL=https://… ADMIN_TOKEN=… npx tsx scripts/import-contributions.ts
 *
 * New phenomena are attached to the smallest massif whose box contains them;
 * corrections and comments are listed in data/contributions/a-traiter.md for
 * a manual edit of the source data.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Atlas, Contribution } from '@brises/shared';

const ROOT = process.cwd();
const OUT = join(ROOT, 'data', 'contributions');

type Item = Record<string, unknown>;
type Massif = { id: string; name: string; [k: string]: Item[] | string };

async function load(): Promise<Contribution[]> {
  const file = process.argv[2];
  if (file) return JSON.parse(readFileSync(file, 'utf8')) as Contribution[];
  const api = process.env.API_URL;
  if (!api || !process.env.ADMIN_TOKEN) throw new Error('fichier d’export ou API_URL + ADMIN_TOKEN requis');
  const res = await fetch(`${api.replace(/\/$/, '')}/api/admin/contributions/export`, { headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` } });
  if (!res.ok) throw new Error(`export ${res.status}`);
  return (await res.json()) as Contribution[];
}

const firstPoint = (c: Contribution): [number, number] | null =>
  c.geometry ? (c.geometry.type === 'Point' ? c.geometry.coordinates : c.geometry.coordinates[0]) : null;

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

const kmh = (s?: string) => {
  const n = s?.match(/\d+/g)?.map(Number) ?? [];
  return n.length ? { typical: n[0], max: n[n.length - 1] } : undefined;
};

async function main() {
  const atlas = JSON.parse(readFileSync(join(ROOT, 'apps/web/public/data/atlas.json'), 'utf8')) as Atlas;
  const contributions = await load();
  const massifs = new Map<string, Massif>();
  const sources: Item[] = [];
  const review: string[] = [];

  const massifOf = ([lon, lat]: [number, number]) =>
    atlas.massifs
      .filter((m) => lon >= m.bbox[0] && lon <= m.bbox[2] && lat >= m.bbox[1] && lat <= m.bbox[3])
      .sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]))[0];

  for (const c of contributions) {
    const p = firstPoint(c);
    if (c.kind !== 'new' || !p || !c.category || c.category === 'other') {
      if (c.kind !== 'confirm' && c.kind !== 'dispute')
        review.push(`- **${c.kind}** ${c.targetRef ?? c.category ?? ''} — ${c.title ?? ''}\n  ${c.message.replace(/\n/g, ' ')}${c.details ? `\n  détails : ${JSON.stringify(c.details)}` : ''}${c.sourceUrl ? `\n  source : ${c.sourceUrl}` : ''} (id ${c.id})`);
      continue;
    }
    const m = massifOf(p);
    if (!m) {
      review.push(`- **hors zone** ${c.title ?? ''} (${p.join(', ')}) — id ${c.id}`);
      continue;
    }
    const sid = `C${sources.length + 1}`;
    sources.push({
      id: sid,
      title: `Contribution ${c.author ? `de ${c.author}` : 'anonyme'} du ${c.createdAt.slice(0, 10)}`,
      url: c.sourceUrl,
      publisher: 'Contribution utilisateur (relue)',
      type: 'contribution',
      notes: c.sourceUrl ? 'Lien fourni par le contributeur' : undefined,
    });
    const entry = massifs.get(m.id) ?? { id: m.id, name: m.name };
    massifs.set(m.id, entry);
    const push = (key: string, item: Item) => ((entry[key] as Item[] | undefined) ?? (entry[key] = [] as Item[])).push(item);
    const d = c.details ?? {};
    const base = { id: `contrib-${slug(c.title ?? c.category)}-${c.id.slice(0, 6)}`, name: c.title ?? c.category, description: c.message, sources: [sid], confidence: 'low' };
    const [lon, lat] = p;
    const coords = c.geometry!.type === 'LineString' ? c.geometry!.coordinates : [p];
    switch (c.category) {
      case 'breeze':
        push('breezes', { ...base, kind: 'valley', waypoints: coords.map(([x, y]) => ({ lon: x, lat: y, coord_quality: 'source' })), hours: d.horaires, speed_kmh: kmh(d.force) });
        break;
      case 'convergence':
        push('convergences', { ...base, geometry: { type: 'LineString', coordinates: coords.length > 1 ? coords : [p, [lon + 0.01, lat]] }, when: d.horaires, mechanism: c.message });
        break;
      case 'hazard':
        push('hazards', { ...base, kind: 'other', lon, lat, radius_km: 1, conditions: [d.horaires, d.vents].filter(Boolean).join(' · ') });
        break;
      case 'thermal':
        push('thermal_spots', { ...base, lon, lat, best_hours: d.horaires });
        break;
      case 'soaring':
        push('soaring_spots', { ...base, lon, lat, wind_dirs: d.vents?.split(/[\s,/]+/).filter(Boolean) });
        break;
      case 'takeoff':
        push('takeoffs', { ...base, lon, lat, orientations: d.vents?.split(/[\s,/]+/).filter(Boolean) });
        break;
      case 'landing':
        push('landings', { ...base, lon, lat });
        break;
    }
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'contributions.json'), JSON.stringify({ topic: 'Contributions des pilotes', massifs: [...massifs.values()], sources }, null, 2));
  writeFileSync(join(OUT, 'a-traiter.md'), `# Contributions à reporter à la main\n\n${review.join('\n') || 'Aucune.'}\n`);
  console.log(`${sources.length} phénomènes ajoutés dans ${massifs.size} massifs, ${review.length} retours à traiter → ${OUT}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
