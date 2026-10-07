/** Shared colours of the map vocabulary (layers, legend, side sheet). */
export const BREEZE_COLORS: Record<string, string> = {
  valley: '#38bdf8',
  downvalley: '#818cf8',
  slope: '#fbbf24',
  'plain-to-mountain': '#2dd4bf',
  lake: '#7dd3fc',
  'pass-transfer': '#f472b6',
  regional: '#5eead4',
  katabatic: '#a5b4fc',
};

export const COLORS = {
  convergence: '#e879f9',
  takeoff: '#22c55e',
  takeoffCommunity: '#86efac',
  landing: '#3b82f6',
  landingCommunity: '#93c5fd',
  hazard: '#f59e0b',
  thermal: '#fb923c',
  soaring: '#14b8a6',
  route: '#fde68a',
};

/** Airspace colour by type (AIP families, FFVL protocols, protection and activity zones). */
export const AIRSPACE_COLORS: Record<string, string> = {
  P: '#ef4444',
  R: '#f97316',
  ZRT: '#f97316',
  RTBA: '#dc2626',
  D: '#f59e0b',
  Q: '#eab308',
  TSA: '#fb7185',
  TRA: '#fb7185',
  CBA: '#fb7185',
  CTR: '#3b82f6',
  TMA: '#6366f1',
  CTA: '#8b5cf6',
  LTA: '#a78bfa',
  RMZ: '#06b6d4',
  TMZ: '#06b6d4',
  'FFVL-Prot': '#22c55e',
  'FFVP-Prot': '#4ade80',
  PROTECT: '#a3e635',
  PRN: '#84cc16',
  SUR: '#bef264',
  AER: '#facc15',
  PJE: '#f472b6',
  VOL: '#38bdf8',
  TRPLA: '#e879f9',
  TRVL: '#e879f9',
  BAL: '#fda4af',
  AP: '#fde047',
};
