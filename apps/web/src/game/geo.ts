/** Local flat frame around an origin: metres east (x) and north (y). Accurate to < 0.1 % over ±40 km. */
export const EARTH_R = 6371008.8;

export class LocalFrame {
  readonly kx: number;
  readonly ky: number;
  constructor(
    readonly lon0: number,
    readonly lat0: number,
  ) {
    this.ky = (Math.PI / 180) * EARTH_R;
    this.kx = this.ky * Math.cos((lat0 * Math.PI) / 180);
  }
  toXY(lon: number, lat: number): [number, number] {
    return [(lon - this.lon0) * this.kx, (lat - this.lat0) * this.ky];
  }
  toLngLat(x: number, y: number): [number, number] {
    return [this.lon0 + x / this.kx, this.lat0 + y / this.ky];
  }
}

/** Distance from point (px, py) to segment a–b, all in metres. */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
