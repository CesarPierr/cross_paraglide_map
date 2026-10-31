/**
 * Progressive disclosure of the atlas items (tiers from packages/shared/src/importance.ts):
 * which tiers the map draws at a zoom, for the readability the pilot chose.
 *
 * - « L'essentiel » (default): the essentials at massif scale, the secondary from zoom 11
 *   (a valley), the detail from 12.5 (a slope).
 * - « Détaillé »: essentials and secondary at once, the detail from 11.5.
 * - « Tout »: everything as soon as the points show.
 *
 * Hidden thermals are never lost: they gather in numbered bubbles that open on a tap.
 */
import type { Readability } from '../state/store';

type Tier = 1 | 2 | 3;

export const TIER_ZOOM: Record<Readability, Record<Tier, number>> = {
  essentiel: { 1: 0, 2: 11, 3: 12.5 },
  detaille: { 1: 0, 2: 0, 3: 11.5 },
  tout: { 1: 0, 2: 0, 3: 0 },
};

/** A phone shows the same zoom on a smaller screen, under a bigger finger: secondary items come a little later. */
export const PHONE_DELAY = 0.5;

/** Highest tier drawn at a zoom. */
export function maxTierAt(zoom: number, readability: Readability, phone = false): Tier {
  const z = TIER_ZOOM[readability];
  const d = phone ? PHONE_DELAY : 0;
  if (zoom >= z[3] + (z[3] ? d : 0)) return 3;
  if (zoom >= z[2] + (z[2] ? d : 0)) return 2;
  return 1;
}

/** Zoom from which a tier is drawn (to open a bubble of hidden items far enough). */
export function zoomForTier(tier: number, readability: Readability, phone = false): number {
  const z = TIER_ZOOM[readability][(Math.min(3, Math.max(1, tier)) as Tier)];
  return z ? z + (phone ? PHONE_DELAY : 0) : 0;
}

/** Items of a category drawn at massif scale, for the side panel's counts (« 4 sur la carte »). */
export function shownAtMassifScale(tiers: (number | undefined)[], readability: Readability, revealed: boolean): number {
  if (revealed || readability === 'tout') return tiers.length;
  const max = readability === 'detaille' ? 2 : 1;
  return tiers.filter((t) => (t ?? 2) <= max).length;
}

export const READABILITY_LABELS: Record<Readability, string> = { essentiel: 'L’essentiel', detaille: 'Détaillé', tout: 'Tout' };
