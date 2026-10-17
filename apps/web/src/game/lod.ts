/**
 * Tile detail for the game's free camera. MapLibre picks each tile's zoom from its distance
 * to the camera and from the angle it is seen at, assuming that the point the camera looks
 * at (the "centre") lies on the ground. The game's camera is at the pilot's eyes and its
 * centre ~1.2 km ahead in the air, so the camera's height above the centre stands for its
 * height above every tile. Near a level view that height vanishes: the imagery, whose
 * level-of-detail curve rewards grazing angles, then asks for its finest tiles out to the
 * horizon (10 000 IGN tiles at a pitch of 89°: the page freezes adding and dropping them),
 * while the terrain's own tiles, whose curve punishes grazing angles, collapse to a few
 * coarse ones (a blurry relief a few hundred metres from the pilot).
 *
 * Here the zoom follows the true distance only: each tile gets the zoom whose texels match
 * the screen's pixels at its distance from the eye (plus a bias per source), whatever the
 * angle of view. The vertical distance to a tile is not known to MapLibre's callback: the
 * eye's clearance above the relief around it stands for it (the height above the ground,
 * or less beside a slope), so a cliff 30 m from the wing is as sharp as the ground 30 m
 * below. No allocation per call; finite for any input.
 *
 * MapLibre only loads what the view's frustum holds: a head turned quickly, or a place never
 * seen, showed for up to a second the coarse tiles it had kept as parents (Sentinel-2 at
 * 25 m a texel stretched over the near slopes: a smooth, plastic green). A ring of tiles
 * (`TileRing`, `useTileRing`) keeps every direction loaded around the pilot by the same
 * distance law a few levels coarser (a few dozen tiles): the imagery of any direction is
 * there at once, only its finest detail still to come.
 */

/** What the zoom rule needs from the camera, updated by the world every frame. */
export interface LodState {
  /** Distance from the eye to MapLibre's centre (m): MapLibre's distances are in its units. */
  centerM: number;
  /** Distance from the eye to the nearest relief (m), the floor of every tile's distance. */
  clearanceM: number;
}

/** MapLibre's per-source tile zoom callback (see `CalculateTileZoomFunction`). */
export type TileZoomFn = (requestedCenterZoom: number, distanceToTile2D: number, distanceToTileZ: number, distanceToCenter3D: number, cameraVerticalFOV: number) => number;

/**
 * Zoom of a tile from its true distance. `requestedCenterZoom` is the zoom whose texels
 * match the screen's pixels at the centre's distance; each halving of the distance adds a
 * level. `bias` (levels) trades sharpness for tile count.
 */
export function lodByDistance(state: LodState, bias: number): TileZoomFn {
  return (requestedCenterZoom, distanceToTile2D, _distanceToTileZ, distanceToCenter3D) => {
    if (!(distanceToCenter3D > 0) || !Number.isFinite(requestedCenterZoom)) return Math.max(0, requestedCenterZoom + bias) || 0;
    const floor = (Math.max(1, state.clearanceM) / Math.max(1, state.centerM)) * distanceToCenter3D;
    const d = Math.hypot(Number.isFinite(distanceToTile2D) ? distanceToTile2D : 0, floor);
    return requestedCenterZoom + bias + Math.log2(distanceToCenter3D / d);
  };
}

/**
 * The eye's clearance from the relief: the smallest distance to the ground sampled under
 * the eye and on rings around it (3 radii × 8 directions), never more than the height above
 * the ground under the eye. `ground` returns null where the relief is not loaded yet.
 */
export function clearance(x: number, y: number, z: number, ground: (x: number, y: number) => number | null): number {
  const g0 = ground(x, y);
  let best = g0 === null ? 300 : Math.max(0.5, z - g0);
  for (const r of RINGS) {
    if (r > best) break;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const g = ground(x + Math.cos(a) * r, y + Math.sin(a) * r);
      if (g === null) continue;
      const d = Math.hypot(r, Math.max(0, z - g));
      if (d < best) best = d;
    }
  }
  return best;
}

const RINGS = [25, 70, 200];

/** A tile of a source's pyramid. */
export interface TileXYZ {
  z: number;
  x: number;
  y: number;
}

/**
 * The tiles of a disk around the eye, whatever the view: each at the zoom `zoomAt` gives for
 * the distance (m) of its nearest point to the eye, between `minZoom` and `maxZoom`. The eye
 * in mercator units (0..1), `unitM` metres per unit there. The tiles do not overlap and
 * together cover the disk; nearest first.
 */
export function diskTiles(ex: number, ey: number, unitM: number, zoomAt: (dM: number) => number, radiusM: number, minZoom: number, maxZoom: number): TileXYZ[] {
  const out: { t: TileXYZ; d: number }[] = [];
  if (!(unitM > 0) || !Number.isFinite(ex + ey)) return [];
  const r = radiusM / unitM;
  const n0 = 2 ** minZoom;
  const stack: TileXYZ[] = [];
  const lo = (v: number) => Math.max(0, Math.floor(v * n0));
  const hi = (v: number) => Math.min(n0 - 1, Math.floor(v * n0));
  for (let x = lo(ex - r); x <= hi(ex + r); x++) for (let y = lo(ey - r); y <= hi(ey + r); y++) stack.push({ z: minZoom, x, y });
  while (stack.length) {
    const t = stack.pop()!;
    const n = 2 ** t.z;
    const dx = Math.min(Math.max(ex, t.x / n), (t.x + 1) / n) - ex;
    const dy = Math.min(Math.max(ey, t.y / n), (t.y + 1) / n) - ey;
    const d = Math.hypot(dx, dy) * unitM;
    if (d > radiusM) continue;
    if (t.z >= maxZoom || t.z >= Math.floor(zoomAt(d))) {
      out.push({ t, d });
      continue;
    }
    for (let i = 0; i < 4; i++) stack.push({ z: t.z + 1, x: 2 * t.x + (i & 1), y: 2 * t.y + (i >> 1) });
  }
  return out.sort((a, b) => a.d - b.d).map((o) => o.t);
}

/**
 * Tiles of one source kept loaded all around the pilot (`useTileRing`): the distance law of
 * `lodByDistance` with `bias` levels (negative: coarser), within `radiusM`, coarser still if
 * that would take more than `maxTiles`.
 */
export class TileRing {
  /** The current tiles, nearest first (a new array when they change). */
  tiles: TileXYZ[] = [];
  private key = '';

  constructor(
    readonly bias: number,
    readonly minZoom: number,
    readonly maxZoom: number,
    readonly radiusM: number,
    readonly maxTiles: number,
  ) {}

  /**
   * Around the eye (mercator units, `unitM` metres per unit there), for the zoom whose texels
   * match the screen's pixels at the centre's distance (`centerZoom`, MapLibre's requested
   * zoom for this source's tile size). True when the tiles changed.
   */
  update(ex: number, ey: number, unitM: number, centerZoom: number, state: LodState): boolean {
    if (!Number.isFinite(centerZoom)) return false;
    const floor = Math.max(1, state.clearanceM);
    let tiles: TileXYZ[] = [];
    for (let coarser = 0; coarser < 6; coarser++) {
      const k = centerZoom + this.bias - coarser + Math.log2(Math.max(1, state.centerM));
      tiles = diskTiles(ex, ey, unitM, (d) => k - Math.log2(Math.hypot(d, floor)), this.radiusM, this.minZoom, this.maxZoom);
      if (tiles.length <= this.maxTiles) break;
    }
    const key = tiles.map((t) => `${t.z}/${t.x}/${t.y}`).join(' ');
    if (key === this.key) return false;
    this.key = key;
    this.tiles = tiles;
    return true;
  }
}

/** The parts of MapLibre's tile manager (an internal) and its tile ids that `useTileRing` uses. */
interface RingTileId {
  key: string;
}
interface RingTileManager {
  _updateRetainedTiles(ideal: RingTileId[], zoom: number): Record<string, RingTileId>;
  _source: { hasTile?(id: RingTileId): boolean };
  _inViewTiles?: { getAllTiles(): { tileID: RingTileId }[] };
}
type RingTileIdClass = new (overscaledZ: number, wrap: number, z: number, x: number, y: number) => RingTileId;

/**
 * Makes a source's tile manager keep `ring`'s tiles with the view's own: they are added to
 * its ideal tiles (first, so that a new place's coarse tiles are requested before the view's
 * fine ones), loaded, kept and drawn wherever the finer tiles are still missing. Returns
 * false, leaving MapLibre alone, when its internals are not the expected ones.
 */
export function useTileRing(map: { style?: { tileManagers?: Record<string, unknown> } }, sourceId: string, ring: TileRing): boolean {
  const tm = map.style?.tileManagers?.[sourceId] as RingTileManager | undefined;
  if (!tm || typeof tm._updateRetainedTiles !== 'function' || !tm._source) return false;
  const original = tm._updateRetainedTiles;
  // MapLibre's tile id class, taken from the first id seen (not exported).
  let Id: RingTileIdClass | null = null;
  let builtFor: TileXYZ[] | null = null;
  let ids: RingTileId[] = [];
  tm._updateRetainedTiles = function (this: RingTileManager, ideal: RingTileId[], zoom: number) {
    Id ??= ((ideal[0] ?? this._inViewTiles?.getAllTiles()[0]?.tileID)?.constructor as RingTileIdClass | undefined) ?? null;
    if (Id && builtFor !== ring.tiles) {
      builtFor = ring.tiles;
      ids = ring.tiles.map((t) => new Id!(t.z, 0, t.z, t.x, t.y)).filter((id) => !this._source.hasTile || this._source.hasTile(id));
    }
    // (A ring tile that is also one of the view's is simply listed twice: MapLibre keys them.)
    return original.call(this, ids.length ? ids.concat(ideal) : ideal, zoom);
  };
  return true;
}

/**
 * Share (0..1) of `ring`'s tiles that a source patched by `useTileRing` holds with their data
 * (or given up: missing on the server). Tiles it does not hold (out of the source's bounds, or
 * not asked for yet) do not count; 0 before any is held, 1 for an empty ring or when MapLibre's
 * internals are not the expected ones (nothing to wait for).
 */
export function ringLoaded(map: { style?: { tileManagers?: Record<string, unknown> } }, sourceId: string, ring: TileRing): number {
  const tm = map.style?.tileManagers?.[sourceId] as { _inViewTiles?: { getAllTiles?(): { state: string; tileID: { canonical: TileXYZ } }[] } } | undefined;
  const all = tm?._inViewTiles?.getAllTiles?.();
  if (!Array.isArray(all) || !ring.tiles.length) return 1;
  const held = new Map<string, boolean>();
  for (const t of all) {
    const c = t.tileID.canonical;
    held.set(`${c.z}/${c.x}/${c.y}`, t.state === 'loaded' || t.state === 'reloading' || t.state === 'expired' || t.state === 'errored');
  }
  let n = 0;
  let done = 0;
  for (const t of ring.tiles) {
    const h = held.get(`${t.z}/${t.x}/${t.y}`);
    if (h === undefined) continue;
    n++;
    if (h) done++;
  }
  return n ? done / n : 0;
}

/**
 * Number of tiles of one source MapLibre keeps decoded (on the GPU) once out of view. Its own
 * cap is the screen's tile count times five zoom levels (150 tiles on a 1280×800 window,
 * whatever the map's `maxTileCacheSize`): about one view, so the tiles of a thermal's other
 * side were already gone when the turn came back to them. Returns false when MapLibre's
 * internals are not the expected ones.
 */
export function setTileCache(map: { style?: { tileManagers?: Record<string, unknown> } }, sourceId: string, tiles: number): boolean {
  const tm = map.style?.tileManagers?.[sourceId] as { _maxTileCacheSize?: number | null; _maxTileCacheZoomLevels?: number | null } | undefined;
  if (!tm || !('_maxTileCacheSize' in tm) || !('_maxTileCacheZoomLevels' in tm)) return false;
  tm._maxTileCacheSize = tiles;
  // The cap by the screen's size no longer binds.
  tm._maxTileCacheZoomLevels = 1000;
  return true;
}

/** The parts of MapLibre's terrain tile manager (an internal) that the patch below uses. */
interface RttTile {
  releaseRTT(painter: unknown): void;
}
interface RttTileId {
  key: string;
  terrainRttPosMatrix32f?: Float32Array;
}
interface TerrainTiles {
  tileManager: { update(transform: unknown, terrain: unknown): void; map: { painter: unknown }; _inViewTiles?: { getAllTiles(): object[] } };
  update(transform: unknown, terrain: unknown): boolean;
  _renderableTilesKeys: string[];
  _tiles: Record<string, RttTile>;
  _lastTilesetChange: number;
  tileSize: number;
  minzoom: number;
  maxzoom: number;
}

/**
 * The terrain's own tiles (its mesh and the texture the imagery is drawn into) chosen by
 * `zoom` too. MapLibre selects them with its default rule and offers no setting for it: the
 * terrain tile manager's update is replaced by the same steps with the rule passed, and
 * at most `maxZoom` (a texel of ~0.2 m at z17 is finer than the finest orthophoto). Returns
 * false, leaving MapLibre alone, when its internals are not the expected ones.
 */
export function useTerrainTileZoom(map: { coveringTiles(options: object): RttTileId[]; terrain?: unknown }, zoom: TileZoomFn, maxZoom = 17): boolean {
  const ttm = (map.terrain as { tileManager?: TerrainTiles } | null | undefined)?.tileManager;
  if (!ttm || typeof ttm.update !== 'function' || typeof ttm.tileManager?.update !== 'function' || !ttm._tiles || !Array.isArray(ttm._renderableTilesKeys)) return false;
  const original = ttm.update;
  const keep = new Set<string>();
  // The class of MapLibre's tiles, taken from the first one that exists (not exported).
  let Tile: (new (id: RttTileId, size: number) => RttTile) | null = null;
  // MapLibre's tile-local orthographic matrix for the textures (mat4.ortho(0, 8192, 8192, 0, 0, 1)).
  const ortho = [2 / 8192, 0, 0, 0, 0, -2 / 8192, 0, 0, 0, 0, -2, 0, -1, 1, -1, 1];
  ttm.update = function (this: TerrainTiles, transform: unknown, terrain: unknown): boolean {
    if (!Tile) {
      // A tile of the same class to build the new ones from (none before the first tiles exist).
      let sample: object | undefined;
      for (const key in this._tiles) {
        sample = this._tiles[key];
        break;
      }
      sample ??= this.tileManager._inViewTiles?.getAllTiles()[0];
      if (!sample) return original.call(this, transform, terrain);
      Tile = sample.constructor as new (id: RttTileId, size: number) => RttTile;
    }
    this.tileManager.update(transform, terrain);
    this._renderableTilesKeys.length = 0;
    keep.clear();
    let changed = false;
    for (const id of map.coveringTiles({ tileSize: this.tileSize, minzoom: this.minzoom, maxzoom: Math.min(this.maxzoom, maxZoom), reparseOverscaled: false, terrain, calculateTileZoom: zoom })) {
      keep.add(id.key);
      this._renderableTilesKeys.push(id.key);
      if (!this._tiles[id.key]) {
        id.terrainRttPosMatrix32f = new Float32Array(ortho);
        this._tiles[id.key] = new Tile(id, this.tileSize);
        this._lastTilesetChange = performance.now();
        changed = true;
      }
    }
    for (const key in this._tiles) {
      if (keep.has(key)) continue;
      this._tiles[key].releaseRTT(this.tileManager.map.painter);
      delete this._tiles[key];
      changed = true;
    }
    return changed;
  };
  return true;
}
