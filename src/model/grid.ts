/**
 * Georeferencing of the wind-model grid.
 *
 * The grid is a crop of the Web-Mercator pixel space at a fixed zoom, so cell
 * (i, j) covers global pixel (px0 + i, py0 + j). Rows increase southwards.
 * Vectors in the model are stored as (u, v) = (east, north) in m/s.
 */
export interface GridMeta {
  zoom: number;
  tileSize: number;
  px0: number;
  py0: number;
  width: number;
  height: number;
}

export const EARTH_CIRCUMFERENCE = 40075016.686;

export class Grid {
  readonly width: number;
  readonly height: number;
  readonly size: number;
  /** Number of pixels spanning the whole world at this zoom. */
  readonly worldPx: number;
  /** Ground size of a cell (metres) for each row; cells are square on the ground. */
  readonly cellM: Float32Array;

  constructor(readonly meta: GridMeta) {
    this.width = meta.width;
    this.height = meta.height;
    this.size = meta.width * meta.height;
    this.worldPx = meta.tileSize * 2 ** meta.zoom;
    this.cellM = new Float32Array(meta.height);
    for (let j = 0; j < meta.height; j++) {
      const lat = this.rowLat(j + 0.5);
      this.cellM[j] = (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) / this.worldPx;
    }
  }

  /** Latitude of a (fractional) row coordinate, measured from the grid top edge. */
  rowLat(y: number): number {
    const my = (this.meta.py0 + y) / this.worldPx;
    return (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI;
  }

  colLon(x: number): number {
    return ((this.meta.px0 + x) / this.worldPx) * 360 - 180;
  }

  /** Fractional grid coordinates (cell centres at .5) of a lon/lat. */
  toGrid(lon: number, lat: number): [number, number] {
    const px = ((lon + 180) / 360) * this.worldPx;
    const r = (lat * Math.PI) / 180;
    const py = ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * this.worldPx;
    return [px - this.meta.px0, py - this.meta.py0];
  }

  /** Web-Mercator unit coordinates (0..1, MapLibre's MercatorCoordinate) of the grid bounds. */
  mercatorBounds(): [number, number, number, number] {
    const { px0, py0, width, height } = this.meta;
    return [px0 / this.worldPx, py0 / this.worldPx, (px0 + width) / this.worldPx, (py0 + height) / this.worldPx];
  }

  /** Corner coordinates as MapLibre image-source coordinates (TL, TR, BR, BL). */
  corners(): [[number, number], [number, number], [number, number], [number, number]] {
    const w = this.colLon(0);
    const e = this.colLon(this.width);
    const n = this.rowLat(0);
    const s = this.rowLat(this.height);
    return [
      [w, n],
      [e, n],
      [e, s],
      [w, s],
    ];
  }

  contains(lon: number, lat: number): boolean {
    const [x, y] = this.toGrid(lon, lat);
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
}

/** Bilinear sample of a scalar field at fractional grid coordinates (cell centres at .5). */
export function sampleBilinear(field: ArrayLike<number>, w: number, h: number, x: number, y: number): number {
  let fx = x - 0.5;
  let fy = y - 0.5;
  if (fx < 0) fx = 0;
  if (fy < 0) fy = 0;
  if (fx > w - 1.001) fx = w - 1.001;
  if (fy > h - 1.001) fy = h - 1.001;
  const i = fx | 0;
  const j = fy | 0;
  const tx = fx - i;
  const ty = fy - j;
  const o = j * w + i;
  const a = field[o];
  const b = field[o + 1];
  const c = field[o + w];
  const d = field[o + w + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** Meteorological convention: direction the wind blows FROM, degrees clockwise from north. */
export function windFromDeg(u: number, v: number): number {
  const deg = (Math.atan2(-u, -v) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** (u, v) of a wind of `speed` blowing from `fromDeg`. */
export function windVector(fromDeg: number, speed: number): [number, number] {
  const r = (fromDeg * Math.PI) / 180;
  return [-Math.sin(r) * speed, -Math.cos(r) * speed];
}

const COMPASS_FR = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

/** French 16-point compass label (O = ouest). */
export function compassFr(deg: number): string {
  return COMPASS_FR[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
