/**
 * Bakes the airspaces relevant to free flight over the French Alps from the
 * POAFF dataset of Pascal Bazile ("Cartographies aériennes dédiées à la
 * pratique du Vol-libre", data.gouv.fr, Licence Ouverte 2.0). It is built from
 * the SIA / Eurocontrol data and completed with the FFVL and FFVP protocols,
 * the national parks and the wildlife protection zones (ZSM, rapaces).
 * Not an official source: the app tells pilots to check SIA / NOTAM.
 *
 *   npm run data:airspace            (downloads the latest Alps files)
 *   npm run data:airspace -- <date>  (a given release, e.g. 20250417)
 *
 * Output: public/data/airspace.json (filtered to the model bbox, floors below FL125).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEM_BBOX } from '@brises/model';

const BASE = 'http://pascal.bazile.free.fr/paraglidingFolder/divers/GPS/OpenAir-Format/files';
const CATALOG = `${BASE}/LastVersion_allExportDataset_poaff-fr.csv`;
const DATASET_URL = 'https://www.data.gouv.fr/datasets/cartographies-aeriennes-dediees-a-la-pratique-du-vol-libre';
const CACHE = join(process.cwd(), '.cache', 'airspace');
const OUT = join(process.cwd(), 'apps', 'web', 'public', 'data', 'airspace.json');

/** Families shown as separate toggles on the map. */
export type AirspaceGroup = 'regulated' | 'controlled' | 'protocol' | 'protect' | 'activity';

const GROUP_OF: Record<string, AirspaceGroup> = {
  P: 'regulated',
  R: 'regulated',
  D: 'regulated',
  ZRT: 'regulated',
  RTBA: 'regulated',
  TSA: 'regulated',
  TRA: 'regulated',
  CBA: 'regulated',
  Q: 'regulated',
  CTR: 'controlled',
  TMA: 'controlled',
  CTA: 'controlled',
  LTA: 'controlled',
  RMZ: 'controlled',
  TMZ: 'controlled',
  'FFVL-Prot': 'protocol',
  'FFVP-Prot': 'protocol',
  PROTECT: 'protect',
  PRN: 'protect',
  SUR: 'protect',
  AER: 'activity',
  PJE: 'activity',
  VOL: 'activity',
  TRPLA: 'activity',
  TRVL: 'activity',
  BAL: 'activity',
  AP: 'activity',
};

interface PoaffProps {
  nameV?: string;
  name?: string;
  class?: string;
  type: string;
  codeActivity?: string;
  lower?: string;
  upper?: string;
  lowerM?: number;
  upperM?: number;
  ordinalLowerM?: number;
  desc?: string;
  activationCode?: string;
  activationDesc?: string;
  seeNOTAM?: boolean | string;
  id?: string;
  GUId?: string;
}
type Ring = [number, number][];
interface Feature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
  properties: PoaffProps;
}

const ACTIVATION: Record<string, string> = {
  H24: 'permanente (H24)',
  HJ: 'de jour (HJ)',
  HN: 'de nuit (HN)',
  HX: 'horaires variables (HX)',
  NOTAM: 'par NOTAM',
};

/** "SFC", "FL055", "3609FT AMSL", "50FT AGL" → French label with metres. */
export function limitLabel(raw: string | undefined): { label: string; agl: boolean } {
  const s = (raw ?? '').trim().toUpperCase();
  if (!s || s === 'SFC' || s === 'GND') return { label: 'Sol', agl: true };
  const fl = /^FL\s*(\d+)/.exec(s);
  if (fl) return { label: `FL${fl[1].padStart(3, '0')} (≈${Math.round(Number(fl[1]) * 30.48)} m)`, agl: false };
  const ft = /^(\d+)\s*FT\s*(AMSL|MSL|AGL|ASFC|SFC|GND)?/.exec(s);
  if (ft) {
    const agl = /AGL|ASFC|SFC|GND/.test(ft[2] ?? '');
    const m = Math.round(Number(ft[1]) * 0.3048);
    return { label: agl ? `${ft[1]} ft sol (≈${m} m/sol)` : `${ft[1]} ft (≈${m} m)`, agl };
  }
  const m = /^(\d+)\s*M\s*(AGL|AMSL)?/.exec(s);
  if (m) return { label: m[2] === 'AGL' ? `${m[1]} m/sol` : `${m[1]} m`, agl: m[2] === 'AGL' };
  return { label: s, agl: false };
}

function cleanName(p: PoaffProps): string {
  return (p.nameV ?? p.name ?? p.id ?? '')
    .replace(/^PROTECT\s+/, '')
    .replace(/\s+Upper\([^)]*\)/, '')
    .trim();
}

function latestRelease(): string {
  const csv = join(CACHE, 'catalog.csv');
  execFileSync('curl', ['-sSf', '--retry', '3', '-o', csv, CATALOG]);
  const dates = [...readFileSync(csv, 'latin1').matchAll(/(\d{8})_ff-FrenchAlps\.geojson/g)].map((x) => x[1]).sort();
  if (!dates.length) throw new Error('aucune version ff-FrenchAlps dans le catalogue POAFF');
  return dates[dates.length - 1];
}

function fetchCached(name: string): Feature[] {
  const file = join(CACHE, name);
  if (!existsSync(file)) execFileSync('curl', ['-sSf', '--retry', '3', '-o', file, `${BASE}/${name}`]);
  return (JSON.parse(readFileSync(file, 'utf8')) as { features: Feature[] }).features;
}

function main() {
  mkdirSync(CACHE, { recursive: true });
  const release = process.argv[2] ?? latestRelease();
  const features = [...fetchCached(`${release}_ff-FrenchAlps.geojson`), ...fetchCached(`${release}_ff-FrenchAlps-wrn.geojson`)];
  const [w, s, e, n] = DEM_BBOX;
  const round = (r: Ring): Ring => r.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
  const seen = new Set<string>();
  const out = [];
  for (const f of features) {
    const p = f.properties;
    const group = GROUP_OF[p.type];
    if (!group) continue;
    const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
    const pts = rings.flat();
    const minX = Math.min(...pts.map((q) => q[0]));
    const maxX = Math.max(...pts.map((q) => q[0]));
    const minY = Math.min(...pts.map((q) => q[1]));
    const maxY = Math.max(...pts.map((q) => q[1]));
    if (maxX < w || minX > e || maxY < s || minY > n) continue;
    // Above FL125 nothing concerns paragliders.
    const floorM = p.ordinalLowerM ?? p.lowerM ?? 0;
    if (/^FL/i.test(p.lower ?? '') && floorM >= 3800) continue;
    let id = p.GUId ?? p.id ?? cleanName(p);
    for (let k = 2; seen.has(id); k++) id = `${p.GUId ?? p.id}-${k}`;
    seen.add(id);
    const floor = limitLabel(p.lower);
    const ceiling = limitLabel(p.upper);
    const text = `${p.desc ?? ''} ${p.activationDesc ?? ''}`;
    const protocol = /https?:\/\/\S+?\.pdf/i.exec(text)?.[0];
    const notam = p.seeNOTAM === true || p.seeNOTAM === 'true' || /see\s*notam/i.test(p.nameV ?? '') || /NOTAM/.test(p.activationDesc ?? '');
    out.push({
      type: 'Feature',
      geometry:
        f.geometry.type === 'Polygon'
          ? { type: 'Polygon', coordinates: f.geometry.coordinates.map(round) }
          : { type: 'MultiPolygon', coordinates: f.geometry.coordinates.map((poly) => poly.map(round)) },
      properties: {
        id,
        name: cleanName(p),
        group,
        type: p.type,
        class: p.class ?? '',
        activity: p.codeActivity ?? '',
        floor: floor.label,
        ceiling: ceiling.label,
        floorM: Math.round(floorM),
        floorAgl: floor.agl,
        ceilingM: Math.round(p.upperM ?? 0),
        activation: [ACTIVATION[p.activationCode ?? ''] ?? p.activationCode, p.activationDesc?.replace(/\s*-\s*\(Protocole\)\s*\S+/, '')].filter(Boolean).join(' · ').slice(0, 400),
        desc: (p.desc ?? '').replace(/^\(c\)\s*/, '').slice(0, 600),
        notam,
        ...(protocol ? { protocol } : {}),
      },
    });
  }
  const counts = out.reduce<Record<string, number>>((a, x) => ((a[x.properties.group] = (a[x.properties.group] ?? 0) + 1), a), {});
  writeFileSync(
    OUT,
    JSON.stringify({
      type: 'FeatureCollection',
      source: 'POAFF, Pascal Bazile : cartographie aérienne dédiée au vol libre (SIA, Eurocontrol, protocoles FFVL/FFVP, zones de protection)',
      url: DATASET_URL,
      license: 'Licence Ouverte 2.0',
      release,
      generatedAt: new Date().toISOString(),
      features: out,
    }),
  );
  console.log(`airspace ${release}: ${out.length} zones`, counts, '→', OUT);
}

if (process.argv[1]?.endsWith('build-airspace.ts')) main();
