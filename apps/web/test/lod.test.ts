import { describe, expect, it } from 'vitest';
import { clearance, diskTiles, lodByDistance, ringLoaded, setTileCache, TileRing, useTileRing, type LodState, type TileXYZ } from '../src/game/lod';

const state: LodState = { centerM: 1200, clearanceM: 50 };
/** MapLibre's units: the centre 1200 m away is at 0.002 mercator units here. */
const dc = 0.002;
const m = (metres: number) => (metres / 1200) * dc;

describe('tile detail by true distance', () => {
  const zoom = lodByDistance(state, 0);

  it('gives the centre its own zoom and one level less per doubling of the distance', () => {
    expect(zoom(16, m(1200), m(10), dc, 66)).toBeCloseTo(16 + Math.log2(1200 / Math.hypot(1200, 50)), 6);
    const near = zoom(16, m(5000), 0, dc, 66);
    const far = zoom(16, m(10000), 0, dc, 66);
    expect(near - far).toBeCloseTo(1, 2);
  });

  it('does not depend on the angle of view (a level view asks for no more tiles)', () => {
    // The camera's height above MapLibre's centre vanishes when the view is level: it is ignored.
    for (const d of [0, 300, 3000, 30000, 300000]) expect(zoom(16, m(d), 0, dc, 66)).toBeCloseTo(zoom(16, m(d), m(500), dc, 66), 9);
  });

  it('is bounded near the eye by its clearance from the relief', () => {
    const max = 16 + Math.log2(1200 / 50);
    expect(zoom(16, 0, 0, dc, 66)).toBeCloseTo(max, 6);
    expect(zoom(16, m(10), 0, dc, 66)).toBeLessThanOrEqual(max);
  });

  it('stays finite for degenerate input', () => {
    for (const v of [zoom(16, 0, 0, 0, 66), zoom(16, NaN, NaN, dc, 66), zoom(16, Infinity, 0, dc, 66), zoom(NaN, 1, 1, 1, 66)]) expect(Number.isFinite(v)).toBe(true);
  });

  it('applies the bias of the source', () => {
    expect(lodByDistance(state, -1)(16, m(2000), 0, dc, 66)).toBeCloseTo(zoom(16, m(2000), 0, dc, 66) - 1, 9);
  });
});

describe('clearance from the relief', () => {
  it('is the height above flat ground', () => {
    expect(clearance(0, 0, 1300, () => 1000)).toBeCloseTo(300, 6);
  });

  it('is the distance to a slope beside the eye when it is nearer than the ground below', () => {
    // A wall rising 25 m east of the eye, the valley 300 m below.
    const g = (x: number) => (x > 20 ? 1400 : 1000);
    expect(clearance(0, 0, 1300, g)).toBeCloseTo(25, 6);
  });

  it('falls back to a default where the relief is not loaded', () => {
    expect(clearance(0, 0, 1300, () => null)).toBe(300);
  });
});

/** The eye over the Grésivaudan (Saint-Hilaire), in mercator units, and metres per unit there. */
const lat = 45.31;
const ex = (5.89 + 180) / 360;
const ey = (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
const unitM = 40075016.686 * Math.cos((lat * Math.PI) / 180);
const holding = (tiles: TileXYZ[], x: number, y: number) => tiles.filter((t) => Math.floor(x * 2 ** t.z) === t.x && Math.floor(y * 2 ** t.z) === t.y);

describe('tiles all around the eye', () => {
  const zoomAt = (d: number) => 16 - Math.log2(Math.max(d, 50) / 1000);

  it('cover the disk once, without overlapping', () => {
    const tiles = diskTiles(ex, ey, unitM, zoomAt, 30000, 7, 18);
    for (let k = 0; k < 400; k++) {
      const a = k * 2.399;
      const r = 29000 * Math.sqrt((k + 0.5) / 400);
      expect(holding(tiles, ex + (Math.cos(a) * r) / unitM, ey + (Math.sin(a) * r) / unitM)).toHaveLength(1);
    }
  });

  it('are finer near the eye, coarser far away, nearest first', () => {
    const tiles = diskTiles(ex, ey, unitM, zoomAt, 30000, 7, 18);
    const under = holding(tiles, ex, ey)[0];
    expect(under.z).toBe(18);
    expect(tiles[0]).toEqual(under);
    const far = holding(tiles, ex + 25000 / unitM, ey)[0];
    expect(far.z).toBeLessThanOrEqual(11);
  });

  it('stay within the zoom range and are empty for a degenerate eye', () => {
    const tiles = diskTiles(ex, ey, unitM, () => 30, 5000, 7, 15);
    expect(Math.max(...tiles.map((t) => t.z))).toBe(15);
    expect(diskTiles(NaN, ey, unitM, zoomAt, 5000, 7, 15)).toEqual([]);
    expect(diskTiles(ex, ey, 0, zoomAt, 5000, 7, 15)).toEqual([]);
  });
});

describe('ring of tiles kept around the pilot', () => {
  const lod: LodState = { centerM: 1200, clearanceM: 300 };

  it('takes a few dozen tiles two levels under the view, and changes only when the eye moves', () => {
    const ring = new TileRing(-2, 7, 18, 80000, 120);
    expect(ring.update(ex, ey, unitM, 15.8, lod)).toBe(true);
    expect(ring.tiles.length).toBeGreaterThan(20);
    expect(ring.tiles.length).toBeLessThanOrEqual(120);
    // The view's own rule (bias 0) gives z17 under the eye 300 m above the ground; the ring z15.
    expect(holding(ring.tiles, ex, ey)[0].z).toBe(15);
    const before = ring.tiles;
    expect(ring.update(ex + 1 / unitM, ey, unitM, 15.8, lod)).toBe(false);
    expect(ring.tiles).toBe(before);
    expect(ring.update(ex + 3000 / unitM, ey, unitM, 15.8, lod)).toBe(true);
  });

  it('goes coarser rather than over its budget', () => {
    const ring = new TileRing(0, 7, 18, 80000, 60);
    ring.update(ex, ey, unitM, 15.8, { centerM: 1200, clearanceM: 30 });
    expect(ring.tiles.length).toBeLessThanOrEqual(60);
    expect(ring.tiles.length).toBeGreaterThan(10);
  });

  it('is added first to the ideal tiles of MapLibre, within the source bounds', () => {
    class Id {
      key: string;
      constructor(
        readonly overscaledZ: number,
        readonly wrap: number,
        readonly z: number,
        readonly x: number,
        readonly y: number,
      ) {
        this.key = `${z}/${x}/${y}`;
      }
    }
    const seen: string[][] = [];
    const tm = {
      _source: { hasTile: (id: Id) => id.z < 15 },
      _updateRetainedTiles(ideal: Id[]) {
        seen.push(ideal.map((t) => t.key));
        return {};
      },
    };
    const ring = new TileRing(-2, 7, 18, 80000, 120);
    ring.update(ex, ey, unitM, 15.8, lod);
    const map = { style: { tileManagers: { ign: tm } } };
    expect(useTileRing(map, 'ign', ring)).toBe(true);
    tm._updateRetainedTiles([new Id(17, 0, 17, 1, 2)]);
    const keys = seen[0];
    expect(keys[keys.length - 1]).toBe('17/1/2');
    expect(keys.length).toBe(1 + ring.tiles.filter((t) => t.z < 15).length);
    expect(keys.slice(0, -1).every((k) => Number(k.split('/')[0]) < 15)).toBe(true);
    expect(useTileRing({ style: { tileManagers: {} } }, 'ign', ring)).toBe(false);
  });

  it('tells how much of the ring MapLibre holds loaded, the tiles it never asked for aside', () => {
    const ring = new TileRing(-2, 7, 18, 80000, 120);
    ring.update(ex, ey, unitM, 15.8, lod);
    const tiles: { state: string; tileID: { canonical: TileXYZ } }[] = [];
    const map = { style: { tileManagers: { ign: { _inViewTiles: { getAllTiles: () => tiles } } } } };
    expect(ringLoaded(map, 'ign', ring)).toBe(0);
    // Half the ring asked for, half of that loaded (one given up), plus a view tile loading.
    const asked = ring.tiles.slice(0, Math.floor(ring.tiles.length / 2));
    asked.forEach((t, i) => tiles.push({ state: i % 2 ? 'loading' : i === 0 ? 'errored' : 'loaded', tileID: { canonical: t } }));
    tiles.push({ state: 'loading', tileID: { canonical: { z: 17, x: 1, y: 2 } } });
    expect(ringLoaded(map, 'ign', ring)).toBeCloseTo(Math.ceil(asked.length / 2) / asked.length, 6);
    for (const t of tiles) t.state = 'loaded';
    expect(ringLoaded(map, 'ign', ring)).toBe(1);
    expect(ringLoaded({ style: { tileManagers: {} } }, 'ign', ring)).toBe(1);
    expect(ringLoaded(map, 'ign', new TileRing(-2, 7, 18, 80000, 120))).toBe(1);
  });

  it('keeps more tiles of one source decoded out of view', () => {
    const tm = { _maxTileCacheSize: null as number | null, _maxTileCacheZoomLevels: 5 };
    expect(setTileCache({ style: { tileManagers: { ign: tm } } }, 'ign', 500)).toBe(true);
    expect(tm._maxTileCacheSize).toBe(500);
    expect(tm._maxTileCacheZoomLevels).toBeGreaterThan(100);
    expect(setTileCache({ style: { tileManagers: { ign: {} } } }, 'ign', 500)).toBe(false);
  });
});
