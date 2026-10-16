/**
 * Forests in 3D near the ground: the wooded areas of the OpenFreeMap vector tiles
 * (landcover "wood"/"forest") around the pilot are planted with instanced trees — mostly
 * conifers with some broadleaves, sizes varying — standing on the fine terrain. Seen from
 * high up the orthophotos already show the trees, so they are only grown below ~600 m
 * above the ground, where relief and scale matter (take-off, landing, low passes).
 *
 * Their colours are those of real canopies (albedo ~0.05 for conifers, ~0.07 for
 * broadleaves in summer: as dark as the forests of the orthophotos around them), each tree
 * a little different; the broadleaves follow the season (bare in winter, fresh green in
 * spring, yellow and orange in autumn). They take the sun only where the ground does
 * (shadows of the mountains and of the clouds, ground.ts `sunlit`).
 */
import type { Map as MlMap } from 'maplibre-gl';
import * as THREE from 'three';
import type { LocalFrame } from './geo';
import { sunlit, type SunUniforms } from './ground';

/** Broadleaf crowns by month (linear albedo): bare twigs in winter, fresh in spring, autumn tints. */
const BROADLEAF: [number, number, number][] = [
  [0.06, 0.054, 0.045],
  [0.06, 0.054, 0.045],
  [0.058, 0.06, 0.042],
  [0.055, 0.11, 0.035],
  [0.05, 0.105, 0.033],
  [0.045, 0.088, 0.03],
  [0.045, 0.085, 0.03],
  [0.046, 0.082, 0.03],
  [0.05, 0.08, 0.03],
  [0.11, 0.08, 0.026],
  [0.08, 0.056, 0.032],
  [0.06, 0.054, 0.045],
];
const CONIFER: [number, number, number] = [0.024, 0.045, 0.024];

type Ring = [number, number][];

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function hash(i: number, j: number): number {
  let h = (Math.imul(i, 374761393) ^ Math.imul(j, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Forest {
  readonly group = new THREE.Group();
  private conifers: THREE.InstancedMesh;
  private broad: THREE.InstancedMesh;
  private trunks: THREE.InstancedMesh;
  private plantedAt = { x: 1e12, y: 1e12 };
  private busy = false;

  private month0 = 6;

  constructor(
    private max = 4000,
    sun?: SunUniforms,
  ) {
    // White materials: the colour of each tree is its instance colour (albedo, linear).
    const needle = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const leaf = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const bark = new THREE.MeshLambertMaterial();
    bark.color.setRGB(0.07, 0.05, 0.035, THREE.LinearSRGBColorSpace);
    if (sun) for (const m of [needle, leaf, bark]) sunlit(m, sun);
    // Unit shapes (1 m tall), scaled per tree; z up.
    const cone = new THREE.ConeGeometry(0.28, 0.85, 7);
    cone.rotateX(Math.PI / 2);
    cone.translate(0, 0, 0.55);
    const crown = new THREE.IcosahedronGeometry(0.33, 1);
    crown.scale(1, 1, 0.9);
    crown.translate(0, 0, 0.62);
    const trunk = new THREE.CylinderGeometry(0.03, 0.04, 0.3, 5);
    trunk.rotateX(Math.PI / 2);
    trunk.translate(0, 0, 0.15);
    this.conifers = new THREE.InstancedMesh(cone, needle, max);
    this.broad = new THREE.InstancedMesh(crown, leaf, max);
    this.trunks = new THREE.InstancedMesh(trunk, bark, max * 2);
    // Instance colours allocated once (setColorAt fills them).
    for (const m of [this.conifers, this.broad]) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (const m of [this.conifers, this.broad, this.trunks]) {
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
  }

  /** The scenario's month: the broadleaves' colour (re-planted with it). */
  setSeason(month0: number): void {
    this.month0 = ((month0 % 12) + 12) % 12;
    this.plantedAt = { x: 1e12, y: 1e12 };
  }

  /** Re-plants around the pilot when he moved ~200 m (low down only). */
  update(map: MlMap, frame: LocalFrame, x: number, y: number, agl: number): void {
    this.group.visible = agl < 650;
    if (!this.group.visible || this.busy || Math.hypot(x - this.plantedAt.x, y - this.plantedAt.y) < 200) return;
    this.busy = true;
    try {
      this.plant(map, frame, x, y);
      this.plantedAt = { x, y };
    } finally {
      this.busy = false;
    }
  }

  private plant(map: MlMap, frame: LocalFrame, cx: number, cy: number): void {
    if (!map.getSource('ofm')) return;
    let feats: GeoJSON.Feature[];
    try {
      feats = map.querySourceFeatures('ofm', { sourceLayer: 'landcover', filter: ['match', ['get', 'class'], ['wood', 'forest'], true, false] }) as GeoJSON.Feature[];
    } catch {
      return;
    }
    const R = 650;
    const rings: { ring: Ring; holes: Ring[] }[] = [];
    for (const f of feats) {
      const g = f.geometry;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const p of polys) {
        const ring = (p[0] as [number, number][]).map(([lon, lat]) => frame.toXY(lon, lat));
        // Skip polygons far from the pilot.
        if (!ring.some(([px, py]) => Math.abs(px - cx) < R * 3 && Math.abs(py - cy) < R * 3)) continue;
        rings.push({ ring, holes: p.slice(1).map((h) => (h as [number, number][]).map(([lon, lat]) => frame.toXY(lon, lat))) });
      }
    }
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const col = new THREE.Color();
    const bl = BROADLEAF[this.month0];
    const autumn = this.month0 === 9 || this.month0 === 10;
    let nc = 0;
    let nb = 0;
    let nt = 0;
    const step = 14;
    const i0 = Math.floor((cx - R) / step);
    const j0 = Math.floor((cy - R) / step);
    for (let i = i0; i < i0 + (2 * R) / step; i++) {
      for (let j = j0; j < j0 + (2 * R) / step; j++) {
        if (nc >= this.max && nb >= this.max) break;
        // Jittered grid, stable per cell (trees don't move when re-planting).
        const x = (i + hash(i, j)) * step;
        const y = (j + hash(j, i * 3 + 1)) * step;
        if (Math.hypot(x - cx, y - cy) > R) continue;
        const inside = rings.some((r) => inRing(x, y, r.ring) && !r.holes.some((h) => inRing(x, y, h)));
        if (!inside) continue;
        const z = map.queryTerrainElevation(frame.toLngLat(x, y));
        if (z === null) continue;
        const kind = hash(i * 7, j * 11);
        const h = 12 + 16 * hash(i * 13, j * 5);
        p.set(x, y, z - 0.5);
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), hash(i, j * 17) * Math.PI * 2);
        // Each tree a little darker or lighter, greener or yellower.
        const shade = 0.75 + 0.5 * hash(i * 5 + 1, j * 3 + 2);
        const tint = hash(i * 3 + 7, j * 7 + 1) - 0.5;
        if (kind < 0.72 && nc < this.max) {
          sc.set(h * (0.8 + 0.3 * hash(i + 3, j)), h * (0.8 + 0.3 * hash(i, j + 3)), h);
          col.setRGB(CONIFER[0] * shade * (1 + 0.3 * tint), CONIFER[1] * shade, CONIFER[2] * shade * (1 - 0.2 * tint), THREE.LinearSRGBColorSpace);
          this.conifers.setColorAt(nc, col);
          this.conifers.setMatrixAt(nc++, m4.compose(p, q, sc));
        } else if (nb < this.max) {
          sc.set(h * 0.9, h * 0.9, h * 0.8);
          // In autumn the trees turn one by one: some still green, most yellow, a few red.
          const turn = autumn ? hash(i * 11 + 5, j * 13 + 3) : 0;
          const c = !autumn ? bl : turn < 0.25 ? BROADLEAF[8] : turn < 0.85 ? bl : [0.13, 0.05, 0.025];
          col.setRGB(c[0] * shade * (1 + 0.25 * tint), c[1] * shade, c[2] * shade, THREE.LinearSRGBColorSpace);
          this.broad.setColorAt(nb, col);
          this.broad.setMatrixAt(nb++, m4.compose(p, q, sc));
        } else continue;
        if (nt < this.max * 2) this.trunks.setMatrixAt(nt++, m4.compose(p, q, sc));
      }
    }
    this.conifers.count = nc;
    this.broad.count = nb;
    this.trunks.count = nt;
    for (const m of [this.conifers, this.broad, this.trunks]) m.instanceMatrix.needsUpdate = true;
    for (const m of [this.conifers, this.broad]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}
