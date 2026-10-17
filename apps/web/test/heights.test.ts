import { describe, expect, it } from 'vitest';
import { sampleTile, terrarium, tileXY } from '../src/game/heights';

describe('terrain heights from the terrain tiles', () => {
  it('decodes terrarium pixels', () => {
    // 131·256 + 232 + 128/256 − 32768 = 1000.5 m.
    expect(terrarium(128, 0, 0)).toBe(0);
    expect(terrarium(131, 232, 128)).toBeCloseTo(1000.5, 6);
  });

  it('finds the z14 tile of Saint-Hilaire-du-Touvet', () => {
    const [x, y] = tileXY(5.8908, 45.3103, 14);
    expect(Math.floor(x)).toBe(8460);
    expect(Math.floor(y)).toBe(5873);
  });

  it('interpolates between pixel centres and holds the edges', () => {
    const t = new Float32Array(256 * 256);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) t[j * 256 + i] = i * 10 + j;
    // Pixel (3, 5) has its centre at (3.5, 5.5).
    expect(sampleTile(t, 3.5, 5.5)).toBeCloseTo(35, 5);
    expect(sampleTile(t, 4, 5.5)).toBeCloseTo(40, 5);
    expect(sampleTile(t, 0, 0)).toBeCloseTo(0, 5);
    expect(sampleTile(t, 256, 256)).toBeCloseTo(255 * 10 + 255, 1);
  });
});
