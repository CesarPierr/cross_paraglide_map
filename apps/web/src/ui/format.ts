import { compassFr } from '@brises/model';

export const fmtHour = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}h${mm ? String(mm).padStart(2, '0') : ''}`;
};

export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const fmtDir = (deg: number) => `${compassFr(deg)} (${Math.round(deg)}°)`;

export { CATEGORY_LABELS, CONFIDENCE_LABELS, KIND_LABELS } from '@brises/shared';
