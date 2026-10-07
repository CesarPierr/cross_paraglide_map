/**
 * Bakes the airspaces relevant to free flight over the French Alps from the
 * FFVP (planeur-net) GeoJSON, which is compiled by volunteers from the AIP.
 * Not an official source: the app tells pilots to check SIA / NOTAM.
 *
 * Output: public/data/airspace.json (filtered to the model bbox, floors below FL125).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEM_BBOX } from '@brises/model';

const SRC = 'https://raw.githubusercontent.com/planeur-net/airspace/master/france.geojson';
const CACHE = join(process.cwd(), '.cache', 'france-airspace.geojson');
const OUT = join(process.cwd(), 'apps', 'web', 'public', 'data', 'airspace.json');

interface Limit {
  value: number;
  unit: 'FT' | 'FL' | 'M';
  referenceDatum: 'GND' | 'MSL' | 'STD';
}
type Ring = [number, number][];
interface Feature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
  properties: { id: string; name: string; class: string; type: string; upperCeiling: Limit; lowerCeiling: Limit; byNotam: boolean; frequency?: { value: string; name?: string } };
}

/** Altitude in metres (AMSL, or AGL when referenced to the ground). */
function metres(l: Limit): number {
  const ft = l.unit === 'FL' ? l.value * 100 : l.unit === 'M' ? l.value / 0.3048 : l.value;
  return Math.round(ft * 0.3048);
}

function label(l: Limit): string {
  if (l.referenceDatum === 'GND' && l.value === 0) return 'SOL';
  if (l.unit === 'FL') return `FL${String(l.value).padStart(3, '0')}`;
  const ref = l.referenceDatum === 'GND' ? 'ASFC' : 'AMSL';
  return `${l.value} ft ${ref} (≈${metres(l)} m)`;
}

function main() {
  mkdirSync(join(process.cwd(), '.cache'), { recursive: true });
  if (!existsSync(CACHE)) execFileSync('curl', ['-sSf', '--retry', '3', '-o', CACHE, SRC]);
  const fc = JSON.parse(readFileSync(CACHE, 'utf8')) as { features: Feature[] };
  const [w, s, e, n] = DEM_BBOX;
  const round = (r: Ring): Ring => r.map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
  const out = [];
  for (const f of fc.features) {
    const p = f.properties;
    if (p.type === 'AWY') continue;
    const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
    const pts = rings.flat();
    const minX = Math.min(...pts.map((q) => q[0]));
    const maxX = Math.max(...pts.map((q) => q[0]));
    const minY = Math.min(...pts.map((q) => q[1]));
    const maxY = Math.max(...pts.map((q) => q[1]));
    if (maxX < w || minX > e || maxY < s || minY > n) continue;
    const floor = metres(p.lowerCeiling);
    // Above FL125 nothing concerns paragliders.
    if (p.lowerCeiling.unit === 'FL' && p.lowerCeiling.value >= 125) continue;
    out.push({
      type: 'Feature',
      geometry:
        f.geometry.type === 'Polygon'
          ? { type: 'Polygon', coordinates: f.geometry.coordinates.map(round) }
          : { type: 'MultiPolygon', coordinates: f.geometry.coordinates.map((poly) => poly.map(round)) },
      properties: {
        id: p.id,
        name: p.name,
        class: p.class,
        type: p.type,
        floor: label(p.lowerCeiling),
        ceiling: label(p.upperCeiling),
        floorM: floor,
        floorRef: p.lowerCeiling.referenceDatum,
        ceilingM: metres(p.upperCeiling),
        notam: p.byNotam,
        frequency: p.frequency ? `${p.frequency.value}${p.frequency.name ? ` (${p.frequency.name})` : ''}` : '',
      },
    });
  }
  writeFileSync(
    OUT,
    JSON.stringify({
      type: 'FeatureCollection',
      source: 'FFVP / planeur-net (compilation bénévole de l’AIP, non officielle)',
      url: 'https://github.com/planeur-net/airspace',
      generatedAt: new Date().toISOString(),
      features: out,
    }),
  );
  console.log(`airspace: ${out.length} zones → ${OUT}`);
}

main();
