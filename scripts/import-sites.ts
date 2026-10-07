/**
 * Imports the official FFVL list of flying sites (data.gouv.fr dataset
 * "La liste des sites de pratique de Vol Libre", Licence Ouverte) into
 * public/data/sites-ffvl.json, keeping the Alps.
 *
 *   npm run data:sites -- path/to/file.(csv|json|geojson)
 *
 * Also reads the export of the official site sheets harvested in a browser
 * (`{ cols, rows }`, see .cache/research/ffvl_sites_alpes.json): those carry
 * the labelled facts of each sheet (dangers, aerology, restrictions, level).
 *
 * The column detection is tolerant (lat/latitude, lon/lng/longitude, nom/name,
 * numero with D = décollage / A = atterrissage, altitude, orientation…) so a
 * future export with renamed columns still imports.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FlyingSite, SiteKind } from '@brises/shared';
import { DEM_BBOX } from '@brises/model';
import { parseOrientations } from '@brises/shared';

type Row = Record<string, unknown>;

function parseCsv(text: string): Row[] {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i]?.trim()])));
}

function load(file: string): Row[] {
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  if (/\.csv$/i.test(file)) return parseCsv(text);
  const j = JSON.parse(text);
  if (Array.isArray(j)) return j;
  if (j.type === 'FeatureCollection')
    return (j.features as { geometry?: { coordinates?: number[] }; properties?: Row }[]).map((f) => ({
      ...f.properties,
      lon: f.geometry?.coordinates?.[0],
      lat: f.geometry?.coordinates?.[1],
    }));
  if (Array.isArray(j.cols) && Array.isArray(j.rows)) return (j.rows as unknown[][]).map((r) => Object.fromEntries((j.cols as string[]).map((c, i) => [c, r[i]])));
  const arr = Object.values(j).find(Array.isArray);
  return (arr as Row[]) ?? [];
}

function pick(row: Row, names: RegExp): unknown {
  const key = Object.keys(row).find((k) => names.test(k.toLowerCase()));
  return key ? row[key] : undefined;
}

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Labelled facts of a harvested FFVL sheet, in display order. */
const SHEET_FACTS: [string, string][] = [
  ['praticabilite', 'Praticabilité'],
  ['conventionnement', 'Conventionnement'],
  ['pratiques', 'Pratiques'],
  ['vents_favorables', 'Vents favorables'],
  ['vents_defavorables', 'Vents défavorables'],
  ['niveau', 'Niveau conseillé'],
  ['aerologie', 'Conditions idéales'],
  ['dangers', 'Dangers'],
  ['restrictions', 'Restrictions'],
  ['reglementation_aerienne', 'Réglementation aérienne'],
  ['gestionnaire', 'Gestionnaire'],
  ['commune', 'Commune'],
];

function kindOf(row: Row): SiteKind {
  const fn = String(row.fonctions ?? '').toLowerCase();
  if (fn) {
    if (/d[ée]co/.test(fn)) return 'takeoff';
    if (/atterro/.test(fn)) return 'landing';
  }
  const t = String(pick(row, /^(type|nature|categorie|catégorie|kind)$/) ?? '').toLowerCase();
  if (/d[ée]co|takeoff|d[ée]collage/.test(t)) return 'takeoff';
  if (/att|landing/.test(t)) return 'landing';
  const numero = String(pick(row, /^(numero|numéro|code)$/) ?? '');
  if (/^\d{2,3}D/i.test(numero)) return 'takeoff';
  if (/^\d{2,3}A/i.test(numero)) return 'landing';
  return 'site';
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: npm run data:sites -- <export FFVL .csv|.json|.geojson>');
    process.exit(1);
  }
  const rows = load(file);
  const [w, s, e, n] = DEM_BBOX;
  const out: FlyingSite[] = [];
  for (const row of rows) {
    const lat = num(pick(row, /^(lat|latitude|y)$/));
    const lon = num(pick(row, /^(lon|lng|long|longitude|x)$/));
    if (lat === undefined || lon === undefined || lon < w || lon > e || lat < s || lat > n) continue;
    const id = String(pick(row, /^(suid|numero|numéro|id)$/) ?? `${lon},${lat}`);
    const details = Object.fromEntries(SHEET_FACTS.map(([k, label]) => [label, String(row[k] ?? '').trim()]).filter(([, v]) => v));
    const harvested = 'praticabilite' in row;
    out.push({
      id,
      provider: 'ffvl',
      kind: kindOf(row),
      name: String(pick(row, /^(nom|name|toponyme|libelle|libellé|nom_site|site_nom|nom_terrain)$/) ?? 'Site FFVL'),
      lon: Math.round(lon * 1e5) / 1e5,
      lat: Math.round(lat * 1e5) / 1e5,
      altitude: num(pick(row, /^(alt|altitude|ele|elevation)$/)),
      orientations: parseOrientations(pick(row, /^(orientation|orientations|exposition|vents?|vents_favorables)$/)),
      description: (pick(row, /^(description|commentaire|remarques?)$/) as string | undefined) || undefined,
      url: (pick(row, /^(url|lien|fiche|link)$/) as string | undefined) || (harvested ? `https://federation.ffvl.fr/sites_pratique/voir/${id}` : undefined),
      status: 'official',
      ...(Object.keys(details).length ? { details } : {}),
    });
  }
  const target = join(process.cwd(), 'apps', 'web', 'public', 'data', 'sites-ffvl.json');
  writeFileSync(target, JSON.stringify(out));
  const counts = out.reduce<Record<string, number>>((a, x) => ((a[x.kind] = (a[x.kind] ?? 0) + 1), a), {});
  console.log(`${out.length} sites FFVL dans les Alpes →`, target, counts);
}

main();
