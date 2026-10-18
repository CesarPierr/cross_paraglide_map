/**
 * Cross-fade of the imagery draped on the terrain (IGN orthophotos, Sentinel-2). On a flat map
 * MapLibre fades a finer raster tile in over the coarser one it replaces (`raster-fade-duration`),
 * the shader mixing the two textures; with 3D terrain it does not: the imagery is drawn into a
 * texture per terrain tile, kept until the tiles under it change, so a fade would freeze at its
 * first frame. A tile arriving under the pilot's eyes sharpened its whole square at once.
 *
 * Here MapLibre's own cross-fade is used under the terrain too:
 * - a tile that arrives (from the network or the out-of-view cache) where a coarser tile of the
 *   same source was drawn the frame before fades in from it: the arrival is drawn mixing its
 *   texture with the parent's (opaque all along: never the backdrop through it), the parent kept
 *   loaded meanwhile; a coarser tile that replaces finer ones drawn the frame before lets them
 *   fade out into it the same way, kept until then;
 * - MapLibre computes the fade while drawing into the terrain's textures (its rule skips it when
 *   the terrain is on);
 * - the terrain textures holding a fade are redrawn while it lasts, a few a frame in turn (a
 *   texture of 1024² px takes some 0.03 ms on an Apple GPU, more on a phone's), and all of them
 *   once at its end, so that none stays half-faded.
 * A tile arriving where nothing of its source was drawn (a place never seen) appears at once,
 * as before: it would otherwise fade from the backdrop. A lower source (Sentinel-2) does not
 * redraw the terrain textures an upper one (IGN) covers whole. Nothing is done, and nothing
 * allocated per frame, while no fade runs. The duration is the layers' `raster-fade-duration`.
 */

/** Duration (ms) of the cross-fade: the imagery layers' `raster-fade-duration` in the game. */
export const IMAGERY_FADE_MS = 300;

/** Canonical tile coordinates (MapLibre's `CanonicalTileID`). */
export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

/** True when two tiles of the same pyramid overlap (one holds the other, or they are the same). */
export function tilesOverlap(a: TileCoord, b: TileCoord): boolean {
  const dz = a.z - b.z;
  return dz >= 0 ? a.x >> dz === b.x && a.y >> dz === b.y : b.x >> -dz === a.x && b.y >> -dz === a.y;
}

/** The parts of MapLibre's internals the fade uses (not exported by MapLibre). */
interface FadeTileID {
  key: string;
  canonical: TileCoord;
}
interface FadeTile {
  tileID: FadeTileID;
  /** MapLibre's fade clock: when the tile's data came (or its fade started). */
  timeAdded: number;
  fadingParentID?: FadeTileID | null;
  /** 1: fading in over `fadingParentID`; 0: fading out into it. */
  fadingDirection?: number | null;
  fadingRole?: number | null;
  fadeOpacity: number;
  hasData(): boolean;
  isRenderable(symbolLayer?: boolean): boolean;
}
interface FadeTileManager {
  _rasterFadeDuration: number;
  /** Set by `update`: the map's terrain, or null. */
  terrain?: unknown;
  _inViewTiles: { getAllTiles(): FadeTile[]; getTileById(key: string): FadeTile | undefined };
  _outOfViewCache: { getAndRemove(id: FadeTileID): FadeTile | null | undefined };
  _updateRetainedTiles(ideal: FadeTileID[], zoom: number): Record<string, FadeTileID>;
  _tileLoaded(tile: FadeTile, id: string, previousState: string, hadData: boolean, result: unknown): void;
}
interface TerrainTile {
  tileID: FadeTileID;
  rttObjects: unknown[];
  releaseRTT(painter: unknown): void;
}
interface RenderToTexture {
  painter: unknown;
  _renderableTiles?: TerrainTile[];
  /** Per source, per terrain tile key: the source's tiles drawn into that terrain tile. */
  _coordsAscending?: Record<string, Record<string, FadeTileID[]> | undefined>;
  prepareForRender(style: unknown, zoom: number, isMoving: boolean): void;
}
interface FrameContext {
  isRenderingToTexture: boolean;
  terrain: unknown;
}
interface StyleLayer {
  type: string;
  source?: string;
}
interface Painter {
  renderToTexture?: RenderToTexture | null;
  renderLayer(painter: Painter, tileManager: unknown, layer: StyleLayer, coords: unknown, frame: FrameContext): void;
}
export interface FadeMap {
  painter?: unknown;
  style?: { tileManagers?: Record<string, unknown> };
  triggerRepaint(): void;
}

export interface ImageryFadeOptions {
  /** Terrain textures redrawn per frame for the fades in progress (each one's end is always drawn). */
  maxRedraws?: number;
  /** MapLibre's clock (`now` from maplibre-gl); `performance.now` by default. */
  now?: () => number;
}

/** A fade in progress: `tile` drawn mixing its texture with `other`'s. */
interface Fade {
  source: number;
  tm: FadeTileManager;
  /** The tile drawn with the mix: the arrival (fading in), or a finer tile leaving (fading out). */
  tile: FadeTile;
  /** The tile whose texture is mixed in: the coarser one drawn before, or the arrival replacing `tile`. */
  other: FadeTile;
  /** Kept in view while the fade lasts: the coarser tile (in), the leaving tile (out). */
  keep: FadeTile;
  end: number;
  /** Ended or cancelled: not kept any longer, its terrain textures to draw once more. */
  over: boolean;
  /** Drawn at its end: forgotten at the next update. */
  done: boolean;
}

/**
 * Cross-fades the tiles of `sources` (source ids, listed from the top layer down) under the
 * terrain. Returns false, leaving MapLibre alone, when its internals are not the expected ones.
 */
export function useImageryFade(map: FadeMap, sources: readonly string[], options: ImageryFadeOptions = {}): boolean {
  const painter = map.painter as Painter | undefined;
  if (!painter || typeof painter.renderLayer !== 'function' || !isRtt(painter.renderToTexture)) return false;
  const managers: FadeTileManager[] = [];
  for (const id of sources) {
    const tm = map.style?.tileManagers?.[id] as FadeTileManager | undefined;
    if (
      !tm ||
      typeof tm._updateRetainedTiles !== 'function' ||
      typeof tm._tileLoaded !== 'function' ||
      typeof tm._rasterFadeDuration !== 'number' ||
      typeof tm._inViewTiles?.getAllTiles !== 'function' ||
      typeof tm._inViewTiles.getTileById !== 'function' ||
      typeof tm._outOfViewCache?.getAndRemove !== 'function'
    )
      return false;
    managers.push(tm);
  }
  const now = options.now ?? (() => performance.now());
  const maxRedraws = Math.max(0, options.maxRedraws ?? 4);
  const fades: Fade[] = [];
  const spare: Fade[] = [];
  /** Tiles that got their data since their source's last update, per source. */
  const pending: FadeTile[][] = managers.map(() => []);
  /** Time of each source's last update: a tile added later was not drawn yet. */
  const updatedAt = managers.map(() => -Infinity);
  /** The terrain tiles drawn at the last frame. */
  let drawn: TerrainTile[] | null = null;
  /** Per terrain tile of the frame, what the fades need of its texture (see `need`). */
  let needs = new Uint8Array(64);
  /** Where the round of the textures redrawn for the fades in progress goes on. */
  let turn = 0;

  // Arrivals: a tile's data from the network, or a tile back from the out-of-view cache.
  managers.forEach((tm, s) => {
    const loaded = tm._tileLoaded;
    tm._tileLoaded = function (this: FadeTileManager, tile, id, previousState, hadData, result) {
      loaded.call(this, tile, id, previousState, hadData, result);
      if (!hadData && tile.hasData() && pending[s].length < MAX_PENDING) pending[s].push(tile);
    };
    const cache = tm._outOfViewCache;
    const getAndRemove = cache.getAndRemove;
    cache.getAndRemove = function (this: typeof cache, id) {
      const tile = getAndRemove.call(this, id);
      if (tile?.hasData() && pending[s].length < MAX_PENDING) pending[s].push(tile);
      return tile;
    };
    const retained = tm._updateRetainedTiles;
    tm._updateRetainedTiles = function (this: FadeTileManager, ideal, zoom) {
      const retain = retained.call(this, ideal, zoom);
      update(s, this, retain);
      return retain;
    };
  });

  // MapLibre's raster drawing skips the fade when the terrain is on: hidden from it while it
  // draws these sources into the terrain's textures (only its fade rule and its choice of a
  // shader variant read it there, and the raster shader does not use the terrain's part).
  const renderLayer = painter.renderLayer;
  painter.renderLayer = function (this: Painter, p, tm, layer, coords, frame) {
    if (!frame.isRenderingToTexture || layer.type !== 'raster' || !layer.source || !sources.includes(layer.source)) return renderLayer.call(this, p, tm, layer, coords, frame);
    const terrain = frame.terrain;
    frame.terrain = null;
    try {
      renderLayer.call(this, p, tm, layer, coords, frame);
    } finally {
      frame.terrain = terrain;
    }
  };

  let hooked: RenderToTexture | null = null;
  const hookRtt = () => {
    const rtt = painter.renderToTexture;
    if (rtt === hooked || !isRtt(rtt)) return;
    hooked = rtt;
    const prepare = rtt.prepareForRender;
    rtt.prepareForRender = function (this: RenderToTexture, style, zoom, isMoving) {
      prepare.call(this, style, zoom, isMoving);
      const tiles = this._renderableTiles;
      drawn = Array.isArray(tiles) ? tiles : null;
      if (fades.length && drawn) redraw(this, drawn);
    };
  };
  hookRtt();

  function isManaged(t: FadeTile): boolean {
    return t.fadingParentID != null;
  }

  /** Was drawn at the last frame: in view with its data before the last update, and renderable. */
  function wasDrawn(t: FadeTile, since: number): boolean {
    return t.hasData() && t.timeAdded <= since && t.isRenderable(false);
  }

  /** Some terrain tile of the last frame holds part of `c`. */
  function seen(c: TileCoord): boolean {
    if (!drawn) return true;
    for (let i = 0; i < drawn.length; i++) if (tilesOverlap(drawn[i].tileID.canonical, c)) return true;
    return false;
  }

  function start(s: number, tm: FadeTileManager, tile: FadeTile, other: FadeTile, keep: FadeTile, t: number, direction: number, duration: number): void {
    const f = spare.pop() ?? ({} as Fade);
    f.source = s;
    f.tm = tm;
    f.tile = tile;
    f.other = other;
    f.keep = keep;
    f.end = t + duration;
    f.over = false;
    f.done = false;
    tile.fadingParentID = other.tileID;
    tile.fadingDirection = direction;
    tile.fadingRole = 0;
    // MapLibre's clock of the fade: the arrival's (in), the arrival's for the tiles leaving into it (out).
    (direction === 1 ? tile : other).timeAdded = t;
    fades.push(f);
  }

  function forget(i: number): void {
    const f = fades[i];
    if (f.tile.fadingParentID?.key === f.other.tileID.key) {
      f.tile.fadingParentID = null;
      f.tile.fadingDirection = null;
      f.tile.fadingRole = null;
      f.tile.fadeOpacity = 1;
    }
    fades[i] = fades[fades.length - 1];
    fades.length--;
    spare.push(f);
  }

  /** At a source's update (MapLibre's choice of its tiles): fades started, kept, ended. */
  function update(s: number, tm: FadeTileManager, retain: Record<string, FadeTileID>): void {
    hookRtt();
    const t = now();
    const since = updatedAt[s];
    updatedAt[s] = t;
    const inView = tm._inViewTiles;
    // Fades of this source: those drawn at their end forgotten; those whose tiles left cancelled
    // (and those whose leaving tile MapLibre wants again).
    for (let i = fades.length - 1; i >= 0; i--) {
      const f = fades[i];
      if (f.tm !== tm) continue;
      if (f.done) {
        forget(i);
        continue;
      }
      if (f.over) continue;
      const lost = inView.getTileById(f.tile.tileID.key) !== f.tile || inView.getTileById(f.other.tileID.key) !== f.other || !f.tile.hasData() || !f.other.hasData();
      const wanted = f.keep === f.tile && retain[f.tile.tileID.key] !== undefined;
      if (lost || wanted || !tm.terrain) {
        f.over = true;
        f.end = Math.min(f.end, t);
        if (wanted) {
          // Drawn as itself again.
          f.tile.fadingParentID = null;
          f.tile.fadingDirection = null;
          f.tile.fadeOpacity = 1;
        }
      }
    }
    const arrivals = pending[s];
    const duration = tm._rasterFadeDuration;
    if (arrivals.length && duration > 0 && tm.terrain) {
      // (MapLibre fades flat maps itself.) One look at the tiles in view for all the arrivals.
      const all = inView.getAllTiles();
      for (let k = 0; k < arrivals.length; k++) {
        const c = arrivals[k];
        if (inView.getTileById(c.tileID.key) !== c || !c.hasData() || isManaged(c) || !seen(c.tileID.canonical)) continue;
        const cc = c.tileID.canonical;
        let parent: FadeTile | null = null;
        for (let j = 0; j < all.length; j++) {
          const o = all[j];
          if (o === c || !wasDrawn(o, since)) continue;
          const oc = o.tileID.canonical;
          if (oc.z < cc.z) {
            if (tilesOverlap(cc, oc) && (!parent || oc.z > parent.tileID.canonical.z)) parent = o;
          } else if (oc.z > cc.z && tilesOverlap(oc, cc) && retain[o.tileID.key] === undefined && !isManaged(o) && seen(oc)) {
            // A finer tile drawn until now, dropped by MapLibre: it fades out into the arrival.
            start(s, tm, o, c, o, t, 0, duration);
          }
        }
        if (parent) start(s, tm, c, parent, parent, t, 1, duration);
      }
    }
    arrivals.length = 0;
    // The coarser tiles under the arrivals and the leaving ones stay until their fade is drawn out.
    for (let i = 0; i < fades.length; i++) {
      const f = fades[i];
      if (f.tm === tm && !f.over) retain[f.keep.tileID.key] = f.keep.tileID;
    }
  }

  /** `terrain` is covered whole by a tile of a source above `source`. */
  function hidden(rtt: RenderToTexture, terrain: TerrainTile, source: number): boolean {
    for (let s = 0; s < source; s++) {
      const coords = rtt._coordsAscending?.[sources[s]]?.[terrain.tileID.key];
      if (!coords) continue;
      for (let j = 0; j < coords.length; j++) if (coords[j].canonical.z <= terrain.tileID.canonical.z) return true;
    }
    return false;
  }

  /**
   * What terrain tile `terrain` needs for the fades: 2 its last drawing of a fade at its end (or
   * cancelled), 1 a fade in progress, 0 nothing.
   */
  function need(rtt: RenderToTexture, terrain: TerrainTile, t: number): number {
    let n = 0;
    for (let i = 0; i < fades.length; i++) {
      const f = fades[i];
      if (f.done || !tilesOverlap(terrain.tileID.canonical, f.tile.tileID.canonical) || (f.source > 0 && hidden(rtt, terrain, f.source))) continue;
      if (f.over || t >= f.end) return 2;
      n = 1;
    }
    return n;
  }

  /** Before MapLibre draws the terrain's textures: those holding a fade redrawn. */
  function redraw(rtt: RenderToTexture, tiles: TerrainTile[]): void {
    const t = now();
    if (needs.length < tiles.length) needs = new Uint8Array(tiles.length * 2);
    let running = 0;
    for (let i = 0; i < tiles.length; i++) {
      const terrain = tiles[i];
      // (A texture MapLibre redraws anyway needs nothing more.)
      const n = terrain.rttObjects.length ? need(rtt, terrain, t) : 0;
      needs[i] = n;
      if (n === 2) terrain.releaseRTT(rtt.painter);
      else if (n === 1) running++;
    }
    // The fades in progress, a few textures a frame in turn.
    if (running && maxRedraws > 0) {
      const first = turn % running;
      let k = 0;
      for (let i = 0; i < tiles.length; i++) {
        if (needs[i] !== 1) continue;
        if ((k++ - first + running) % running < maxRedraws) tiles[i].releaseRTT(rtt.painter);
      }
      turn = (first + maxRedraws) % running;
    }
    for (let i = 0; i < fades.length; i++) {
      const f = fades[i];
      if (f.over || t >= f.end) f.done = true;
    }
    map.triggerRepaint();
  }

  return true;
}

/** Arrivals waiting for their source's next update, at most (a source not updated drops the rest). */
const MAX_PENDING = 1024;

function isRtt(rtt: unknown): rtt is RenderToTexture {
  return !!rtt && typeof (rtt as RenderToTexture).prepareForRender === 'function';
}
