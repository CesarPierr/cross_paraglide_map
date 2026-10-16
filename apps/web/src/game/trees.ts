/**
 * Forests in 3D near the ground: the wooded areas of the OpenFreeMap vector tiles
 * (landcover "wood"/"forest") around the pilot are planted with instanced trees — mostly
 * conifers with some broadleaves, sizes varying — standing on the fine terrain. Seen from
 * high up the orthophotos already show the trees, so they are only grown below ~600 m
 * above the ground, where relief and scale matter (take-off, landing, low passes).
 */
import type { Map as MlMap } from 'maplibre-gl';
import * as THREE from 'three';
import type { LocalFrame } from './geo';

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

  constructor(private max = 4000) {
    const needle = new THREE.MeshLambertMaterial({ color: 0x2d4a2b });
    const leaf = new THREE.MeshLambertMaterial({ color: 0x4f6b35 });
    const bark = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
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
    for (const m of [this.conifers, this.broad, this.trunks]) {
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
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
        if (kind < 0.72 && nc < this.max) {
          sc.set(h * (0.8 + 0.3 * hash(i + 3, j)), h * (0.8 + 0.3 * hash(i, j + 3)), h);
          this.conifers.setMatrixAt(nc++, m4.compose(p, q, sc));
        } else if (nb < this.max) {
          sc.set(h * 0.9, h * 0.9, h * 0.8);
          this.broad.setMatrixAt(nb++, m4.compose(p, q, sc));
        } else continue;
        if (nt < this.max * 2) this.trunks.setMatrixAt(nt++, m4.compose(p, q, sc));
      }
    }
    this.conifers.count = nc;
    this.broad.count = nb;
    this.trunks.count = nt;
    for (const m of [this.conifers, this.broad, this.trunks]) m.instanceMatrix.needsUpdate = true;
  }
}
