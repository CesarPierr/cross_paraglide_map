/**
 * Reading of the layered air mass for the briefing: the forecast column of an hour, the
 * one-line synthesis of the air (« Instable, base 2 800 m, NO 20 km/h aux crêtes,
 * inversion 1 400 m à 9 h »), the values at the pilot's altitude, and what happens now in
 * the view (documented breezes, convergences and hazards whose conditions match).
 * Pure functions: unit-tested in apps/web/test/air-brief.test.ts.
 */
import {
  airFromSounding,
  compassFr,
  convectiveLayer,
  curatedActivity,
  hazardActivity,
  inversionAbove,
  packed,
  packedLapse,
  packedTemp,
  stabilityFactors,
  sunCloudFactor,
  windowActivity,
  airWindAt,
  type AirColumn,
  type ModelParams,
} from '@brises/model';
import type { Atlas, SynopticWind } from '@brises/shared';

/** Altitude rounded to 100 m, French digits (« 2 800 »). */
export const fmtAlt = (z: number) => (Math.round(z / 100) * 100).toLocaleString('fr-FR');

/** Low and mid cloud cover of a forecast hour, 0..1 (random overlap), or undefined. */
export function forecastCloud(h: Pick<SynopticWind, 'cloudCoverLow' | 'cloudCoverMid'>): number | undefined {
  if (h.cloudCoverLow === undefined && h.cloudCoverMid === undefined) return undefined;
  return 1 - (1 - (h.cloudCoverLow ?? 0) / 100) * (1 - (h.cloudCoverMid ?? 0) / 100);
}

/** The layered air mass of a forecast hour, or null when the forecast has no levels. */
export function forecastAir(h: SynopticWind): AirColumn | null {
  if (!h.profile || h.profile.length < 2) return null;
  return airFromSounding(h.profile, forecastCloud(h));
}

/** One word for the stability of the air, from the 850–700 hPa lapse rate (null: standard atmosphere). */
export function stabilityWord(lapse: number | null): string {
  if (lapse === null) return 'Standard';
  if (lapse < 3) return 'Très stable';
  if (lapse < 5) return 'Stable';
  if (lapse < 6) return 'Assez stable';
  if (lapse < 7) return 'Standard';
  if (lapse < 8) return 'Instable';
  return 'Très instable';
}

/** First morning inversion (6 h → 11 h) of the forecast day `prefix` (YYYY-MM-DD), over a ground. */
export function morningInversion(hours: SynopticWind[], prefix: string, groundM: number): { base: number; hour: number } | null {
  for (const h of hours) {
    if (!h.time.startsWith(prefix) || h.hour < 6 || h.hour > 11) continue;
    const air = forecastAir(h);
    const inv = air && inversionAbove(air, groundM, 3500);
    if (inv) return { base: inv.base, hour: h.hour };
  }
  return null;
}

export interface SynthesisInput {
  /** Layered air of the hour (null: the model's reference day). */
  air: AirColumn | null;
  lapseRate: number | null;
  /** Ground of the place read (m AMSL): probe, or centre of the view. */
  groundM: number;
  ridge: { fromDeg: number; kmh: number };
  /** Inversion of the morning, when the hour itself has none. */
  morning?: { base: number; hour: number } | null;
}

/** One line of briefing: stability, ceiling or cumulus base, ridge wind, inversion. */
export function airSynthesis(o: SynthesisInput): string {
  const parts: string[] = [stabilityWord(o.lapseRate)];
  if (o.air) {
    const cl = convectiveLayer(o.air, o.groundM);
    const cloud = o.air.cloud ?? 0;
    if (cloud >= 0.75) parts.push('ciel couvert');
    if (cl) {
      if (cl.depth < 150) parts.push('pas de thermique');
      else if (cl.cloudBase !== null) {
        let base = `base ${fmtAlt(cl.cloudBase)} m`;
        if (cl.cumulusTop !== null && cl.cumulusTop - cl.cloudBase > 3000) base += ' (surdéveloppements possibles)';
        parts.push(base);
      } else parts.push(`thermiques bleus jusqu’à ${fmtAlt(cl.ceiling)} m`);
    }
    if (cloud >= 0.4 && cloud < 0.75) parts.push('nuageux');
  }
  parts.push(o.ridge.kmh < 3 ? 'vent calme aux crêtes' : `${compassFr(o.ridge.fromDeg)} ${Math.round(o.ridge.kmh)} km/h aux crêtes`);
  const inv = o.air ? inversionAbove(o.air, o.groundM, 3500) : null;
  if (inv) parts.push(inv.base <= o.groundM + 50 ? `inversion au sol jusqu’à ${fmtAlt(inv.top)} m` : `inversion ${fmtAlt(inv.base)} m`);
  else if (o.morning) parts.push(`inversion ${fmtAlt(o.morning.base)} m à ${o.morning.hour} h`);
  return parts.join(', ');
}

/** Pilots' reading of a layer's lapse rate (K/km). */
export function layerWord(lapse: number): string {
  if (lapse <= 0.5) return 'inversion';
  if (lapse < 3) return 'couche stable';
  if (lapse < 6) return 'assez stable';
  if (lapse < 8.5) return 'instable';
  return 'brassée (adiabatique)';
}

export interface AtAltitude {
  /** Wind of the air mass at this altitude, before the relief. */
  wind: { fromDeg: number; kmh: number };
  /** Lapse rate (K/km) of the layer and its reading. */
  lapse: number;
  layer: string;
  temperature: number;
  /** Thermal ceiling over this ground, and its distance above (+) or below (−) the altitude. */
  ceiling: number;
  toCeiling: number;
  cloudBase: number | null;
  /** Next inversion above the altitude (base), if any below 4500 m. */
  inversion: number | null;
}

/** The layered air at an altitude z over a ground zg (probe). */
export function airAtAltitude(air: AirColumn, z: number, zg: number): AtAltitude | null {
  const p = packed(air);
  const cl = convectiveLayer(air, zg);
  const wind = airWindAt(air, z);
  if (!p || !cl || !wind) return null;
  const lapse = packedLapse(p, z);
  const inv = inversionAbove(air, z);
  return {
    wind,
    lapse,
    layer: layerWord(lapse),
    temperature: packedTemp(p, z),
    ceiling: cl.ceiling,
    toCeiling: cl.ceiling - z,
    cloudBase: cl.cloudBase,
    inversion: inv ? inv.base : null,
  };
}

export interface NowItem {
  /** Atlas feature id (opens its sheet). */
  id: string;
  kind: 'breeze' | 'convergence' | 'hazard';
  name: string;
  detail: string;
  weight: number;
}

const HAZARD_DETAIL: Record<string, string> = { lee: 'sous le vent, rotors', venturi: 'venturi', turbulence: 'turbulences', wind: 'brise forte' };

const inBox = (coords: [number, number][], b: [number, number, number, number]) => coords.some(([x, y]) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);

/**
 * Documented phenomena active now in the view: hazards whose conditions match the
 * simulated wind and hour, breezes in their hours and conditions (unless the wind aloft
 * or an overcast sky erases them), convergences in their hours when the breezes blow.
 */
export function happeningNow(atlas: Atlas, p: ModelParams, valleyPhase: number, bbox: [number, number, number, number]): NowItem[] {
  const out: NowItem[] = [];
  const kmh = p.synoptic.speedKmh;
  const sun = sunCloudFactor(p.air?.cloud);
  const override = stabilityFactors(p.lapseRate).overrideKmh;
  const seen = new Set<string>();
  const breezesOn = kmh < override && sun > 0.5;
  for (const h of atlas.curatedHazards ?? []) {
    const id = h.id.split('#')[0];
    if (seen.has(id) || !inBox(h.coords, bbox)) continue;
    // A breeze phenomenon (no wind cited) needs the sun, as the breezes do.
    if (h.fromDeg === undefined && !breezesOn) continue;
    const a = hazardActivity(h, p);
    if (a < 0.5) continue;
    seen.add(id);
    const detail = h.effect === 'wind' && h.targetKmh ? `brise forte ≈ ${h.targetKmh} km/h` : (HAZARD_DETAIL[h.effect] ?? 'danger');
    out.push({ id, kind: 'hazard', name: h.name, detail, weight: 2 + a });
  }
  for (const b of atlas.curated) {
    if (!inBox(b.coords, bbox)) continue;
    const windDriven = !!b.condition?.wind;
    if (!windDriven && !breezesOn) continue;
    const a = curatedActivity(b, p, valleyPhase) * (windDriven ? 1 : sun);
    if (a < 0.5) continue;
    const speed = Math.round(b.speedMs * 3.6);
    out.push({ id: b.id, kind: 'breeze', name: b.name, detail: `${speed} km/h${b.condition ? ` · ${b.condition.label}` : ''}`, weight: 1 + a * Math.min(1, speed / 30) });
  }
  if (breezesOn && valleyPhase > 0.2 && kmh < 25)
    for (const f of atlas.features.convergences) {
      const g = f.geometry;
      const coords = g.type === 'Point' ? [g.coordinates] : g.coordinates;
      if (!inBox(coords, bbox)) continue;
      const q = f.properties;
      const a = windowActivity(p.hour, q.windowStart !== undefined && q.windowEnd !== undefined ? [q.windowStart, q.windowEnd] : [12, 18]);
      if (a < 0.5) continue;
      out.push({ id: q.id, kind: 'convergence', name: q.name, detail: 'convergence', weight: 0.5 + 0.5 * a });
    }
  return out.sort((a, b) => b.weight - a.weight);
}
