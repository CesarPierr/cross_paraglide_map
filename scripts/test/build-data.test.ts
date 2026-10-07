import { describe, expect, it } from 'vitest';
import { cleanDescription, parseCondition, parseHours } from '../build-data';

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

describe('parseHours, second research pass wording', () => {
  it('ignores peak mentions and keeps the window', () => {
    expect(parseHours("fin de matinée – fin d'après-midi ; maximum vers 14h-17h (référence générale)", 'valley')).toEqual([11, 19]);
    expect(parseHours("fin de matinée à la nuit ; forte de 14h à 17h (été)", 'plain-to-mountain')).toEqual([11, 21]);
  });
  it('reads onsets given as ranges or periods', () => {
    expect(parseHours('dès 11h-12h en été (« à partir de 11h00, plus tôt si vent météo de N »)', 'valley')).toEqual([11, 19]);
    expect(parseHours('levée 11h-13h (parfois ~13h), max ~15h, faiblit 16h30-18h ; reprise possible ~17h', 'valley')).toEqual([11, 18]);
    expect(parseHours('dès 12h, parfois forte en milieu d’après-midi (été) ; calme le matin', 'valley')).toEqual([12, 19]);
    expect(parseHours('brise souvent très soutenue à partir de midi, voire plus tôt ; peut rester forte tard', 'valley')).toEqual([12, 19]);
    expect(parseHours('8h – fin de matinée / début d’après-midi', 'slope')).toEqual([8, 15]);
  });
  it('counts hours after sunrise', () => {
    expect(parseHours('dès le milieu de matinée (3 h après le lever du soleil) ; renforcement l’après-midi', 'slope')?.[0]).toBeCloseTo(8.8, 1);
  });
  it('reads the clause that describes the breeze itself', () => {
    expect(parseHours('descendante au petit matin ; ascendante dès la fin de matinée ; encore forte en milieu d’après-midi (août)', 'valley')).toEqual([11, 19]);
    expect(parseHours('matin : catabatique sous régime de nord ; après-midi : brise montante', 'valley')).toEqual([12.5, 18.5]);
    expect(parseHours('7h-9h (brise du matin), avant l’inversion vers les brises montantes de 12h', 'katabatic')).toEqual([7, 9]);
    expect(parseHours('fin de journée (soirée d’été), alors que la brise du lac souffle encore au-dessus', 'katabatic')).toEqual([17, 20.5]);
  });
});

describe('parseCondition', () => {
  it('recognises heatwave and wind conditions in the name or at the head of the hours', () => {
    expect(parseCondition({ name: 'Brise montante du Grésivaudan par forte chaleur (« faux vent du Sud » à Saint-Hilaire)', hours: 'après-midi' })?.regime).toBe('heatwave');
    expect(parseCondition({ name: 'Lombarde par le col du Mont-Cenis', hours: 'épisodique (flux d’E/SE)' })?.wind?.fromDeg).toBe(90);
    expect(parseCondition({ name: 'Flux d’est (flèche Lombarde n°5)', hours: 'situations d’E (Lombarde)' })?.wind?.fromDeg).toBe(90);
    expect(parseCondition({ name: 'Vent de S–SE descendant du col de Restefond', hours: 'après-midi' })?.wind?.fromDeg).toBeGreaterThan(150);
  });
  it('does not take a modulation or a side remark for a condition', () => {
    expect(parseCondition({ name: 'Brise de nord du Grésivaudan', hours: 'fin de matinée -> soir (été) ; renforcement en soirée par canicule' })).toBeNull();
    expect(parseCondition({ name: 'Brise montante de Haute-Maurienne', hours: 'dès ≈11h (été), plus tôt par vent de nord ; jusqu’en fin d’après-midi' })).toBeNull();
    expect(parseCondition({ name: 'Flux vers le col du Petit-Saint-Bernard (Séez → col) et flux inverse de foehn', hours: 'Non documenté en régime de brise' })).toBeNull();
    expect(parseCondition({ name: 'Écoulements descendants nocturnes/hivernaux vers Grenoble', hours: 'nuit et matin, surtout en hiver sous inversion' })).toBeNull();
  });
  it('uses the explicit field first', () => {
    expect(parseCondition({ name: 'x', hours: 'après-midi', condition: 'par vent de nord 20 km/h' })).toEqual({ label: 'par vent météo de nord (≥ 20 km/h)', wind: { fromDeg: 0, minKmh: 20 } });
    expect(parseCondition({ name: 'Lombarde', hours: '', condition: '' })).toBeNull();
    expect(parseCondition({ name: 'x', condition: 'quand la neige fond' })).toEqual({ label: 'si : quand la neige fond' });
  });
});
