/**
 * Take-offs the game can start from: the atlas ones (documented, with their orientation)
 * and the FFVL ones inside the model's grid that the atlas does not already have. The
 * pilot starts in the air just off the take-off, facing out of it.
 */
import type { Atlas, FlyingSite } from '@brises/shared';

export interface Takeoff {
  id: string;
  name: string;
  massif: string;
  lon: number;
  lat: number;
  alt: number;
  /** Direction the take-off faces (deg from north), the way the pilot flies out. */
  facing: number;
  orientation: string;
}

const DIRS: Record<string, number> = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SSO: 202.5, SW: 225, SO: 225, WSW: 247.5, OSO: 247.5, W: 270, O: 270, WNW: 292.5, ONO: 292.5, NW: 315, NO: 315, NNW: 337.5, NNO: 337.5 };

/** Mean of the listed orientations ("E, SE, S, SW" → SSE). */
export function facingOf(orientations: string[]): number | null {
  let x = 0;
  let y = 0;
  for (const o of orientations) {
    const d = DIRS[o.trim().toUpperCase()];
    if (d === undefined) continue;
    x += Math.sin((d * Math.PI) / 180);
    y += Math.cos((d * Math.PI) / 180);
  }
  if (Math.hypot(x, y) < 1e-6) return null;
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

export function listTakeoffs(atlas: Atlas, ffvl: FlyingSite[], inGrid: (lon: number, lat: number) => boolean): Takeoff[] {
  const massifName = new Map(atlas.massifs.map((m) => [m.id, m.shortName ?? m.name]));
  const out: Takeoff[] = [];
  for (const f of atlas.features.takeoffs ?? []) {
    if (f.geometry.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    const d = f.properties.details ?? {};
    const alt = parseFloat((d.Altitude ?? '').replace(/\s/g, ''));
    const orient = (d.Orientation ?? '').split(/[,;/ ]+/).filter(Boolean);
    const facing = facingOf(orient);
    if (!Number.isFinite(alt) || facing === null || !inGrid(lon, lat)) continue;
    out.push({ id: f.properties.id, name: f.properties.name, massif: massifName.get(f.properties.massif) ?? f.properties.massif, lon, lat, alt, facing, orientation: orient.join(', ') });
  }
  for (const s of ffvl) {
    if (s.kind !== 'takeoff' || !s.altitude || !inGrid(s.lon, s.lat)) continue;
    const facing = facingOf(s.orientations ?? []);
    if (facing === null) continue;
    if (out.some((t) => Math.hypot((t.lon - s.lon) * 78, (t.lat - s.lat) * 111) < 0.4)) continue;
    out.push({ id: `ffvl-${s.id}`, name: s.name, massif: 'FFVL', lon: s.lon, lat: s.lat, alt: s.altitude, facing, orientation: (s.orientations ?? []).join(', ') });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Folds accents and case for the search box. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
