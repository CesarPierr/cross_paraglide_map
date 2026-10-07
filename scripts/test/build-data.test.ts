import { describe, expect, it } from 'vitest';
import { cleanDescription, parseHours } from '../build-data';

describe('parseHours', () => {
  it('reads explicit ranges', () => {
    expect(parseHours('12h-19h (été)', 'valley')).toEqual([12, 19]);
    expect(parseHours('≈13h30-19h un bon jour', 'valley')).toEqual([13.5, 19]);
  });
  it('spans every period mentioned', () => {
    expect(parseHours("fin de matinée à fin d'après-midi (été)", 'valley')).toEqual([11, 19]);
    expect(parseHours('après-midi (été)', 'valley')).toEqual([12.5, 18.5]);
    expect(parseHours('matinée (calme) à mi-journée', 'valley')).toEqual([8, 13]);
  });
  it('treats night breezes as crossing midnight', () => {
    expect(parseHours('nuit et matin', 'downvalley')).toEqual([20.5, 9.5]);
    expect(parseHours('dès 12h', 'valley')).toEqual([12, 19]);
  });
});

describe('cleanDescription', () => {
  it('moves research-method remarks out of the text', () => {
    const r = cleanDescription('Brise de nord forte. [Source lue via extrait uniquement.] Coordonnées: de mémoire.');
    expect(r.text).toBe('Brise de nord forte.');
    expect(r.note).toContain('Source lue');
    expect(r.note).toContain('Coordonnées');
  });
});
