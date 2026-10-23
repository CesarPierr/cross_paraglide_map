import { describe, expect, it } from 'vitest';
import { snowLine } from '../src/game/ground';

describe('seasonal snow line', () => {
  it('is low in winter and above the summer snowfields', () => {
    expect(snowLine(0, 15, 45.9)).toBeLessThan(1100);
    expect(snowLine(7, 15, 45.9)).toBeGreaterThan(3000);
  });

  it('adds no snow on the summer orthophotos, glaciers of the highest summits included', () => {
    for (const m of [6, 7, 8]) {
      expect(snowLine(m, 15, 45.9)).toBeGreaterThan(4808);
      expect(snowLine(m, 15, 44.9)).toBeGreaterThan(4102);
    }
  });

  it('rises through the spring and comes down in the autumn', () => {
    let prev = 0;
    for (let m = 1; m <= 6; m++) {
      const h = snowLine(m, 15, 45.9);
      expect(h).toBeGreaterThan(prev);
      prev = h;
    }
    expect(snowLine(10, 15, 45.9)).toBeLessThan(snowLine(9, 15, 45.9));
  });

  it('varies smoothly between the middles of the months', () => {
    expect(Math.abs(snowLine(3, 30, 45.9) - snowLine(4, 1, 45.9))).toBeLessThan(40);
  });

  it('is higher in the drier southern massifs', () => {
    expect(snowLine(1, 15, 44.3) - snowLine(1, 15, 45.9)).toBeGreaterThan(200);
  });
});
