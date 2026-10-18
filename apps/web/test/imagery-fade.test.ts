import { describe, expect, it } from 'vitest';
import { tilesOverlap, useImageryFade, type TileCoord } from '../src/game/imagery-fade';

// A small stand-in for MapLibre's internals: raster tile managers (tiles in view, out-of-view
// cache, retained tiles), the terrain's textures (render to texture) and the painter.

class Id {
  key: string;
  canonical: TileCoord;
  constructor(z: number, x: number, y: number) {
    this.key = `${z}/${x}/${y}`;
    this.canonical = { z, x, y };
  }
}

class Tile {
  timeAdded = 0;
  fadingParentID: Id | null = null;
  fadingDirection: number | null = null;
  fadingRole: number | null = null;
  fadeOpacity = 1;
  state = 'loading';
  constructor(public tileID: Id) {}
  hasData() {
    return this.state === 'loaded';
  }
  isRenderable() {
    return this.hasData();
  }
}

class Manager {
  _rasterFadeDuration = 300;
  terrain: unknown = {};
  tiles = new Map<string, Tile>();
  cache = new Map<string, Tile>();
  /** Tiles MapLibre itself keeps besides the ideal ones (fallback parents, loaded children). */
  extra: string[] = [];
  _inViewTiles = {
    getAllTiles: () => [...this.tiles.values()],
    getTileById: (key: string) => this.tiles.get(key),
  };
  _outOfViewCache = {
    getAndRemove: (id: Id) => {
      const t = this.cache.get(id.key);
      this.cache.delete(id.key);
      return t ?? null;
    },
  };
  constructor(public clock: { t: number }) {}
  _updateRetainedTiles(ideal: Id[]): Record<string, Id> {
    const retain: Record<string, Id> = {};
    for (const id of ideal) {
      if (!this.tiles.has(id.key)) {
        const back = this._outOfViewCache.getAndRemove(id);
        if (back) back.timeAdded = this.clock.t;
        this.tiles.set(id.key, back ?? new Tile(id));
      }
      retain[id.key] = id;
    }
    for (const key of this.extra) if (this.tiles.has(key)) retain[key] = this.tiles.get(key)!.tileID;
    return retain;
  }
  _tileLoaded(tile: Tile) {
    tile.state = 'loaded';
    tile.timeAdded = this.clock.t;
  }
  /** MapLibre's update: ideal tiles, then the tiles not retained leave for the cache. */
  update(ideal: Id[]) {
    const retain = this._updateRetainedTiles(ideal);
    for (const [key, t] of [...this.tiles]) {
      if (retain[key]) continue;
      this.tiles.delete(key);
      if (t.hasData()) this.cache.set(key, t);
    }
  }
  /** A tile's data arrives from the network. */
  load(id: Id) {
    const t = this.tiles.get(id.key)!;
    this._tileLoaded(t, id.key, 'loading', false, null);
  }
}

class TerrainTile {
  rttObjects: unknown[] = [{}];
  released = 0;
  constructor(public tileID: Id) {}
  releaseRTT() {
    if (this.rttObjects.length) this.released++;
    this.rttObjects.length = 0;
  }
}

function setup(sources = ['ign']) {
  const clock = { t: 1000 };
  const managers: Record<string, Manager> = {};
  for (const s of sources) managers[s] = new Manager(clock);
  const terrain: TerrainTile[] = [];
  const rtt = {
    painter: {},
    _renderableTiles: terrain,
    _coordsAscending: {} as Record<string, Record<string, Id[]>>,
    prepareForRender() {},
  };
  const drawnLayers: { layer: string; terrain: unknown }[] = [];
  const painter = {
    renderToTexture: rtt,
    renderLayer(_p: unknown, _tm: unknown, layer: { id?: string; type: string; source?: string }, _coords: unknown, frame: { terrain: unknown }) {
      drawnLayers.push({ layer: layer.id ?? layer.type, terrain: frame.terrain });
    },
  };
  let repaints = 0;
  const map = { painter, style: { tileManagers: managers as Record<string, unknown> }, triggerRepaint: () => repaints++ };
  return {
    clock,
    managers,
    terrain,
    rtt,
    painter,
    map,
    drawnLayers,
    repaints: () => repaints,
    /** One frame: the sources' updates, then the terrain's textures (those released are redrawn). */
    frame(dt: number, ideal: Record<string, Id[]>) {
      clock.t += dt;
      for (const s of sources) managers[s].update(ideal[s] ?? []);
      rtt.prepareForRender();
      for (const t of terrain) if (!t.rttObjects.length) t.rttObjects.push({});
    },
  };
}

const z15 = new Id(15, 100, 200);
const z17 = new Id(17, 401, 802);
const z16 = new Id(16, 200, 401);

describe('cross-fade of the imagery under the terrain', () => {
  it('tells overlapping tiles', () => {
    expect(tilesOverlap({ z: 15, x: 100, y: 200 }, { z: 17, x: 401, y: 802 })).toBe(true);
    expect(tilesOverlap({ z: 17, x: 401, y: 802 }, { z: 15, x: 100, y: 200 })).toBe(true);
    expect(tilesOverlap({ z: 17, x: 405, y: 802 }, { z: 15, x: 100, y: 200 })).toBe(false);
    expect(tilesOverlap({ z: 15, x: 100, y: 200 }, { z: 15, x: 100, y: 200 })).toBe(true);
  });

  it('fades a finer tile in over the coarser one drawn before, kept until the fade is drawn out', () => {
    const w = setup();
    const ign = w.managers.ign;
    w.terrain.push(new TerrainTile(z15));
    expect(useImageryFade(w.map, ['ign'], { now: () => w.clock.t })).toBe(true);
    // The coarse tile, drawn for a while.
    w.frame(16, { ign: [z15] });
    ign.load(z15);
    w.frame(16, { ign: [z15] });
    w.frame(16, { ign: [z15] });
    // The view now wants the finer tile; the coarse one stays as its fallback while it loads.
    ign.extra = [z15.key];
    w.frame(16, { ign: [z17] });
    ign.extra = [];
    ign.load(z17);
    const parent = ign.tiles.get(z15.key)!;
    const child = ign.tiles.get(z17.key)!;
    w.frame(16, { ign: [z17] });
    const start = w.clock.t;
    expect(child.fadingParentID).toBe(parent.tileID);
    expect(child.fadingDirection).toBe(1);
    expect(child.timeAdded).toBe(start);
    // MapLibre no longer wants the coarse tile: kept for the fade, its texture redrawn every frame.
    const t = w.terrain[0];
    for (let i = 0; i < 10; i++) {
      const before = t.released;
      w.frame(25, { ign: [z17] });
      expect(ign.tiles.get(z15.key)).toBe(parent);
      expect(t.released).toBe(before + 1);
    }
    // The end drawn once (300 ms after the start), then the coarse tile and the fade let go.
    while (w.clock.t < start + 300) w.frame(25, { ign: [z17] });
    const drawnAtEnd = t.released;
    w.frame(16, { ign: [z17] });
    expect(child.fadingParentID).toBeNull();
    expect(ign.tiles.has(z15.key)).toBe(false);
    w.frame(16, { ign: [z17] });
    expect(t.released).toBe(drawnAtEnd);
    expect(child.fadeOpacity).toBe(1);
  });

  it('does not fade a tile where nothing of its source was drawn, nor out of sight', () => {
    const w = setup();
    const ign = w.managers.ign;
    w.terrain.push(new TerrainTile(z15));
    useImageryFade(w.map, ['ign'], { now: () => w.clock.t });
    // Nothing drawn before: the tile appears at once (it would fade from the backdrop).
    w.frame(16, { ign: [z17] });
    ign.load(z17);
    w.frame(16, { ign: [z17] });
    expect(ign.tiles.get(z17.key)!.fadingParentID).toBeNull();
    // A coarse tile drawn, a finer one arriving under no terrain tile of the last frame.
    const far = new Id(15, 300, 300);
    const farChild = new Id(16, 600, 600);
    w.frame(16, { ign: [far] });
    ign.load(far);
    w.frame(16, { ign: [far] });
    ign.extra = [far.key];
    w.frame(16, { ign: [farChild] });
    ign.load(farChild);
    w.frame(16, { ign: [farChild] });
    expect(ign.tiles.get(farChild.key)!.fadingParentID).toBeNull();
    expect(w.terrain[0].released).toBe(0);
  });

  it('lets finer tiles drawn until now fade out into a coarser tile that replaces them', () => {
    const w = setup();
    const ign = w.managers.ign;
    w.terrain.push(new TerrainTile(z15));
    useImageryFade(w.map, ['ign'], { now: () => w.clock.t });
    // The finer tile drawn; then the view wants the coarser one, the finer one kept while it loads.
    w.frame(16, { ign: [z16] });
    ign.load(z16);
    w.frame(16, { ign: [z16] });
    w.frame(16, { ign: [z16] });
    ign.extra = [z16.key];
    w.frame(16, { ign: [z15] });
    ign.extra = [];
    ign.load(z15);
    w.frame(16, { ign: [z15] });
    const fine = ign.tiles.get(z16.key)!;
    const coarse = ign.tiles.get(z15.key)!;
    expect(fine.fadingParentID).toBe(coarse.tileID);
    expect(fine.fadingDirection).toBe(0);
    // MapLibre's fade clock of the leaving tile is the arrival's.
    expect(coarse.timeAdded).toBe(w.clock.t);
    const start = w.clock.t;
    while (w.clock.t < start + 300) {
      w.frame(25, { ign: [z15] });
      if (w.clock.t < start + 300) expect(ign.tiles.get(z16.key)).toBe(fine);
    }
    w.frame(16, { ign: [z15] });
    expect(ign.tiles.has(z16.key)).toBe(false);
    expect(fine.fadingParentID).toBeNull();
  });

  it('fades a tile back from the out-of-view cache too, and stops a fade whose tiles left', () => {
    const w = setup();
    const ign = w.managers.ign;
    w.terrain.push(new TerrainTile(z15));
    useImageryFade(w.map, ['ign'], { now: () => w.clock.t });
    w.frame(16, { ign: [z15, z17] });
    ign.load(z15);
    ign.load(z17);
    w.frame(16, { ign: [z15, z17] });
    // The finer tile leaves for the cache, then comes back over the coarse one.
    w.frame(16, { ign: [z15] });
    expect(ign.cache.has(z17.key)).toBe(true);
    w.frame(16, { ign: [z15] });
    w.frame(16, { ign: [z15, z17] });
    const child = ign.tiles.get(z17.key)!;
    expect(child.fadingParentID?.key).toBe(z15.key);
    // It leaves again mid-fade: the fade ends there, its texture drawn once more.
    const t = w.terrain[0];
    w.frame(16, { ign: [z15] });
    const released = t.released;
    w.frame(16, { ign: [z15] });
    expect(t.released).toBe(released + 1);
    w.frame(16, { ign: [z15] });
    w.frame(16, { ign: [z15] });
    expect(t.released).toBe(released + 1);
  });

  it('redraws a few terrain textures a frame in turn, and all of them at the end', () => {
    const w = setup();
    const ign = w.managers.ign;
    // Eight terrain tiles, each over a coarse tile drawn before.
    const coarse = Array.from({ length: 8 }, (_, i) => new Id(15, 100 + i, 200));
    const fine = coarse.map((c) => new Id(17, c.canonical.x * 4 + 1, c.canonical.y * 4 + 2));
    for (const c of coarse) w.terrain.push(new TerrainTile(c));
    useImageryFade(w.map, ['ign'], { now: () => w.clock.t, maxRedraws: 3 });
    w.frame(16, { ign: coarse });
    for (const c of coarse) ign.load(c);
    w.frame(16, { ign: coarse });
    w.frame(16, { ign: [...coarse, ...fine] });
    for (const f of fine) ign.load(f);
    w.frame(16, { ign: [...coarse, ...fine] });
    const start = w.clock.t;
    const counts = w.terrain.map((t) => t.released);
    let frames = 0;
    while (w.clock.t + 16 < start + 300) {
      const before = w.terrain.reduce((a, t) => a + t.released, 0);
      w.frame(16, { ign: [...coarse, ...fine] });
      frames++;
      expect(w.terrain.reduce((a, t) => a + t.released, 0) - before).toBe(3);
    }
    // Each texture redrawn in turn (8 textures, 3 a frame).
    for (let i = 0; i < 8; i++) expect(w.terrain[i].released - counts[i]).toBeGreaterThanOrEqual(Math.floor((frames * 3) / 8));
    // Then all of them at the end, once.
    const before = w.terrain.map((t) => t.released);
    w.frame(16, { ign: [...coarse, ...fine] });
    w.frame(16, { ign: [...coarse, ...fine] });
    for (let i = 0; i < 8; i++) expect(w.terrain[i].released - before[i]).toBe(1);
    const repaints = w.repaints();
    w.frame(16, { ign: [...coarse, ...fine] });
    expect(w.repaints()).toBe(repaints);
  });

  it('does not redraw for a lower source where an upper one covers the terrain tile whole', () => {
    const w = setup(['ign', 's2']);
    const s2 = w.managers.s2;
    const t = new TerrainTile(z15);
    w.terrain.push(t);
    useImageryFade(w.map, ['ign', 's2'], { now: () => w.clock.t });
    const s2Coarse = new Id(11, 6, 12);
    const s2Fine = new Id(12, 12, 25);
    w.frame(16, { s2: [s2Coarse] });
    s2.load(s2Coarse);
    w.frame(16, { s2: [s2Coarse] });
    s2.extra = [s2Coarse.key];
    w.frame(16, { s2: [s2Fine] });
    s2.extra = [];
    s2.load(s2Fine);
    // IGN draws a tile holding the terrain tile whole into its texture.
    w.rtt._coordsAscending = { ign: { [z15.key]: [z15] } };
    w.frame(16, { s2: [s2Fine] });
    expect(s2.tiles.get(s2Fine.key)!.fadingParentID?.key).toBe(s2Coarse.key);
    for (let i = 0; i < 20; i++) w.frame(25, { s2: [s2Fine] });
    expect(t.released).toBe(0);
  });

  it('has MapLibre compute the fade while it draws these sources into the terrain textures', () => {
    const w = setup(['ign']);
    useImageryFade(w.map, ['ign'], { now: () => w.clock.t });
    const terrain = { name: 'terrain' };
    const frame = { isRenderingToTexture: true, terrain };
    const p = w.painter;
    p.renderLayer(p, null, { id: 'bm-ign', type: 'raster', source: 'ign' }, [], frame);
    p.renderLayer(p, null, { id: 'bm-topo', type: 'raster', source: 'topo' }, [], frame);
    p.renderLayer(p, null, { id: 'hillshade', type: 'hillshade', source: 'ign' }, [], frame);
    frame.isRenderingToTexture = false;
    p.renderLayer(p, null, { id: 'bm-ign', type: 'raster', source: 'ign' }, [], frame);
    expect(w.drawnLayers).toEqual([
      { layer: 'bm-ign', terrain: null },
      { layer: 'bm-topo', terrain },
      { layer: 'hillshade', terrain },
      { layer: 'bm-ign', terrain },
    ]);
    expect(frame.terrain).toBe(terrain);
  });

  it('does nothing while no fade runs, and nothing with a duration of 0', () => {
    const w = setup();
    const ign = w.managers.ign;
    ign._rasterFadeDuration = 0;
    w.terrain.push(new TerrainTile(z15));
    useImageryFade(w.map, ['ign'], { now: () => w.clock.t });
    w.frame(16, { ign: [z15] });
    ign.load(z15);
    w.frame(16, { ign: [z15] });
    ign.extra = [z15.key];
    w.frame(16, { ign: [z17] });
    ign.load(z17);
    for (let i = 0; i < 5; i++) w.frame(16, { ign: [z17] });
    expect(ign.tiles.get(z17.key)!.fadingParentID).toBeNull();
    expect(w.terrain[0].released).toBe(0);
    expect(w.repaints()).toBe(0);
  });

  it('leaves MapLibre alone when its internals are not the expected ones', () => {
    const w = setup();
    // (A MapLibre whose tile manager lost its method.)
    (w.managers.ign as unknown as Record<string, unknown>)._tileLoaded = undefined;
    const update = w.managers.ign._updateRetainedTiles;
    const render = w.painter.renderLayer;
    expect(useImageryFade(w.map, ['ign'])).toBe(false);
    expect(w.managers.ign._updateRetainedTiles).toBe(update);
    expect(w.painter.renderLayer).toBe(render);
    expect(useImageryFade({ triggerRepaint() {} }, ['ign'])).toBe(false);
    expect(useImageryFade(setup().map, ['missing'])).toBe(false);
  });
});
