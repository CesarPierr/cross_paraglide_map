import { describe, expect, it } from 'vitest';
import { isClosedSite, statusFromFfvl, type Atlas } from '@brises/shared';
import { listTakeoffs } from '../src/game/takeoffs';

describe('a site status from the federation sheet', () => {
  it('reads closures, permissions and hang-glider sites', () => {
    expect(statusFromFfvl('ATTENTION : PRATIQUE STRICTEMENT INTERDITE SUR CE TERRAIN')).toBe('interdit');
    expect(statusFromFfvl('terrain temporairement non praticable pour le vol libre')).toBe('non-praticable');
    expect(statusFromFfvl('terrain ouvert à la pratique avec autorisation systématique à obtenir auprès du club')).toBe('autorisation');
    expect(statusFromFfvl('pratique interdite sur ce terrain sauf avec autorisation à obtenir auprès de : X')).toBe('autorisation');
    expect(statusFromFfvl('terrain ouvert à la pratique', 'delta')).toBe('delta');
    expect(statusFromFfvl('terrain ouvert à la pratique sauf durant la ou les périodes : 15 mai - 15 juillet (fenaison)')).toBe('saisonnier');
  });

  it('does not take a sheet without a real closure for one', () => {
    expect(statusFromFfvl('terrain ouvert à la pratique', 'parapente delta')).toBeUndefined();
    expect(statusFromFfvl('le terrain semble pratiqué mais aucune convention y autorise la pratique du vol libre')).toBeUndefined();
    for (const p of ['Néant', "Praticable toute l'année", "Pas d'interdiction connue.", '30 avril au 30 novembre ( speed riding et speed flying interdit)', 'Lorsque la manche à air est absente', ''])
      expect(statusFromFfvl(`terrain ouvert à la pratique sauf durant la ou les périodes : ${p}`)).toBeUndefined();
  });

  it('rules a place out only when no day would do', () => {
    expect(['interdit', 'non-praticable', 'non-confirme', 'delta'].every((s) => isClosedSite(s as never))).toBe(true);
    expect(isClosedSite('saisonnier')).toBe(false);
    expect(isClosedSite('autorisation')).toBe(false);
    expect(isClosedSite(undefined)).toBe(false);
  });
});

describe('the game take-off list', () => {
  const point = (id: string, status?: string) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [6, 45] },
    properties: { id, name: id, massif: 'm', category: 'takeoffs', status, details: { Altitude: '1500 m', Orientation: 'S' } },
  });
  it('leaves out the closed ones and keeps the seasonal ones', () => {
    const atlas = { massifs: [{ id: 'm', name: 'M' }], features: { takeoffs: [point('open'), point('closed', 'interdit'), point('delta', 'delta'), point('summer', 'saisonnier')] } } as unknown as Atlas;
    expect(listTakeoffs(atlas, [], () => true).map((t) => t.id)).toEqual(['open', 'summer']);
  });

  it('also leaves out the closed sites of the federation list', () => {
    const atlas = { massifs: [], features: {} } as unknown as Atlas;
    const site = (id: string, Praticabilité: string, Pratiques = 'parapente') => ({ id, provider: 'ffvl', kind: 'takeoff', name: id, lon: 6, lat: 45, altitude: 1500, orientations: ['S'], details: { Praticabilité, Pratiques } });
    const ffvl = [site('a', 'terrain ouvert à la pratique'), site('b', 'ATTENTION : PRATIQUE STRICTEMENT INTERDITE SUR CE TERRAIN'), site('c', 'terrain ouvert à la pratique', 'delta')];
    expect(listTakeoffs(atlas, ffvl as never, () => true).map((t) => t.name)).toEqual(['a']);
  });
});
