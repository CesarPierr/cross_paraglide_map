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
