/**
 * Imports the official FFVL list of flying sites (data.gouv.fr dataset
 * "La liste des sites de pratique de Vol Libre", Licence Ouverte) into
 * public/data/sites-ffvl.json, keeping the Alps.
 *
 *   npm run data:sites -- path/to/file.(csv|json|geojson)
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

function kindOf(row: Row): SiteKind {
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
    out.push({
      id,
      provider: 'ffvl',
      kind: kindOf(row),
      name: String(pick(row, /^(nom|name|toponyme|libelle|libellé|nom_site|site_nom|nom_terrain)$/) ?? 'Site FFVL'),
      lon: Math.round(lon * 1e5) / 1e5,
      lat: Math.round(lat * 1e5) / 1e5,
      altitude: num(pick(row, /^(alt|altitude|ele|elevation)$/)),
      orientations: parseOrientations(pick(row, /^(orientation|orientations|exposition|vents?)$/)),
      description: (pick(row, /^(description|commentaire|remarques?)$/) as string | undefined) || undefined,
      url: (pick(row, /^(url|lien|fiche|link)$/) as string | undefined) || undefined,
      status: 'official',
    });
  }
  const target = join(process.cwd(), 'apps', 'web', 'public', 'data', 'sites-ffvl.json');
  writeFileSync(target, JSON.stringify(out));
  const counts = out.reduce<Record<string, number>>((a, x) => ((a[x.kind] = (a[x.kind] ?? 0) + 1), a), {});
  console.log(`${out.length} sites FFVL dans les Alpes →`, target, counts);
}

main();
