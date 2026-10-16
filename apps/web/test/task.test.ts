import { describe, expect, it } from 'vitest';
import type { AtlasFeature } from '@brises/shared';
import { LocalFrame } from '../src/game/geo';
import { advanceTask, distanceMadeGood, taskFromRoute, taskLength } from '../src/game/task';

const frame = new LocalFrame(6, 45);
const route = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [frame.toLngLat(0, 0), frame.toLngLat(10000, 0), frame.toLngLat(10000, 10000)] },
  properties: { id: 'r', category: 'routes', massif: 'm', name: 'Test', description: '', sources: '', details: { Points: 'Start - Déco (position estimée) → B1 - Col → Goal - Atterro' } },
} as unknown as AtlasFeature;

describe('cross-country task', () => {
  it('reads the turn points and their names', () => {
    const t = taskFromRoute(route, frame)!;
    expect(t.points.map((p) => p.name)).toEqual(['Start - Déco', 'B1 - Col', 'Goal - Atterro']);
    expect(taskLength(t)).toBeCloseTo(20000, -1);
  });

  it('tags cylinders in order and scores the distance made good', () => {
    const t = taskFromRoute(route, frame)!;
    expect(advanceTask(t, 9800, 0, 10)).toBeNull();
    expect(advanceTask(t, 100, 0, 12)?.name).toBe('Start - Déco');
    expect(distanceMadeGood(t, 5000, 0)).toBeCloseTo(5400, -1);
    expect(advanceTask(t, 9800, 100, 400)?.name).toBe('B1 - Col');
    expect(advanceTask(t, 10000, 9700, 900)?.name).toBe('Goal - Atterro');
    expect(t.goalT).toBe(900);
    expect(distanceMadeGood(t, 0, 0)).toBeCloseTo(20000, -1);
  });
});
