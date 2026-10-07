/** Helpers for flying-site directories. */

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const FR: Record<string, string> = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SO', W: 'O', NW: 'NO' };

/** "NW;N", "N-NE", "nord-ouest", "O, SO" → ['NO', 'N', …] (French sector labels). */
export function parseOrientations(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const t = raw
    .toUpperCase()
    .replace(/OUEST/g, 'W')
    .replace(/NORD/g, 'N')
    .replace(/SUD/g, 'S')
    .replace(/EST/g, 'E')
    .replace(/-/g, '')
    .replace(/\bO\b/g, 'W')
    .replace(/SO\b/g, 'SW')
    .replace(/NO\b/g, 'NW');
  const out = new Set<string>();
  for (const token of t.split(/[^A-Z]+/)) if (SECTORS.includes(token)) out.add(FR[token]);
  return [...out];
}
