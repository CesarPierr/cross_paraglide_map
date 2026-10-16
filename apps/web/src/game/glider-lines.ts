/**
 * The suspension lines: a real cascade (upper galleries from the attachment tabs to the
 * middle lines, then to the main lines on the riser maillons; A red, B and C yellow, the
 * brakes orange, the stabilo line red), and the speed system under the harness. Drawn as
 * camera-facing ribbons whose width is the line's true diameter where it covers more than
 * a pixel (near the eye) and one anti-aliased pixel with a proportional opacity beyond, so
 * they look right from the risers to a pilot a kilometre away. Positions are recomputed
 * every frame from the deformed wing (glider-shape.ts), without allocation.
 */
import * as THREE from 'three';
import { N_CELLS, ROWS, ribA, wingPoint, type Vec3Like, type WingDeform } from './glider-shape';

/** Anchor points given by the riser and pilot model, per side (canopy frame). */
export const Anchor = { A: 0, A2: 1, B: 2, C: 3, Pulley: 4, Handle: 5, Bar: 6, HarnessPulley: 7, RiserPulley: 8 } as const;
export type Anchor = (typeof Anchor)[keyof typeof Anchor];
const N_ANCHORS = 9;

interface WingRef {
  a: number;
  tw: number;
  kind: number;
  w: number;
}
interface Junction {
  kids: number[];
  anchor: number;
  f: number;
}
interface Seg {
  p: number;
  q: number;
  width: number;
  floor: number;
  color: number;
}

const COL = {
  A: 0xc8312b,
  Aup: 0xd8564a,
  B: 0xe2b322,
  Bup: 0xe9cf72,
  C: 0xcf9d1d,
  Cup: 0xe2c56e,
  brake: 0xee7a1c,
  brakeUp: 0xf2a04e,
  stab: 0xd8383f,
  speed: 0x26282c,
};

const VERT = /* glsl */ `
attribute vec3 aEnd;
attribute vec2 aCorner;
attribute vec3 aColor;
attribute vec2 aWidth;
uniform vec2 uViewport;
varying vec3 vColor;
varying float vAlpha;
varying float vDist;
varying float vHalf;
varying vec3 vT;
void main() {
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 ca = mvp * vec4(position, 1.0);
  vec4 cb = mvp * vec4(aEnd, 1.0);
  // Clip the segment against the near plane before going to the screen.
  float da = ca.z + ca.w;
  float db = cb.z + cb.w;
  if (da < 0.0 && db < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  if (da < 0.0) ca = mix(ca, cb, da / (da - db) + 1e-4);
  if (db < 0.0) cb = mix(cb, ca, db / (db - da) + 1e-4);
  vec2 sa = ca.xy / ca.w * 0.5 * uViewport;
  vec2 sb = cb.xy / cb.w * 0.5 * uViewport;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = aCorner.x < 0.5 ? ca : cb;
  // Pixels per metre at this depth, whatever the projection (also MapLibre's).
  vec3 r1 = vec3(mvp[0][1], mvp[1][1], mvp[2][1]);
  float wpx = aWidth.x * length(r1) * 0.5 * uViewport.y / max(c.w, 1e-4);
  vHalf = max(wpx, 1.0) * 0.5;
  vAlpha = max(min(1.0, wpx), aWidth.y);
  float ext = vHalf + 1.0;
  vDist = aCorner.y * ext;
  c.xy += nrm * (aCorner.y * ext * 2.0) / uViewport * c.w;
  gl_Position = c;
  vColor = aColor;
  vT = mat3(modelViewMatrix) * (aEnd - position);
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vDist;
varying float vHalf;
varying vec3 vT;
#include <common>
#include <lights_pars_begin>
void main() {
  float a = clamp(vHalf + 0.5 - abs(vDist), 0.0, 1.0) * vAlpha;
  if (a < 0.004) discard;
  vec3 L = vec3(0.0, 1.0, 0.0);
  vec3 sunC = vec3(0.0);
#if NUM_DIR_LIGHTS > 0
  L = directionalLights[0].direction;
  sunC = directionalLights[0].color;
#endif
  vec3 hemi = vec3(0.3);
#if NUM_HEMI_LIGHTS > 0
  hemi = 0.5 * (hemisphereLights[0].skyColor + hemisphereLights[0].groundColor);
#endif
  float tl = dot(normalize(vT), L);
  // A thin cylinder: lit as long as the sun is not along it.
  float diff = sqrt(max(0.0, 1.0 - tl * tl));
  vec3 col = vColor * RECIPROCAL_PI * (sunC * (0.15 + 0.7 * diff) + hemi * 1.1);
  gl_FragColor = vec4(col, a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}
`;

const tmpV2 = new THREE.Vector4();

export function lineMaterial(): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, { uViewport: { value: new THREE.Vector2(1280, 800) } }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    lights: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return m;
}

export class LineSet {
  readonly mesh: THREE.Mesh;
  private refs: WingRef[] = [];
  private junctions: Junction[] = [];
  private segs: Seg[] = [];
  /** Points: wing attachments, then anchors (both sides), then junctions. */
  private pts: Float32Array;
  private anchor0: number;
  private junction0: number;
  private pos: Float32Array;
  private end: Float32Array;
  private geo: THREE.BufferGeometry;
  private p: Vec3Like = { x: 0, y: 0, z: 0 };

  constructor(detail: 'high' | 'low') {
    const half = N_CELLS / 2;
    const att = (side: number, k: number, c: number) => {
      this.refs.push({ a: side * ribA(k), tw: -Math.sqrt(c), kind: 0, w: 0 });
      return this.refs.length - 1;
    };
    const sides = [-1, 1];
    // Wing attachment points first (their indices are fixed below).
    const rowAtt: number[][][] = [];
    const brakeAtt: number[][] = [];
    const stab: number[] = [];
    const ribsRow = detail === 'high' ? [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23] : [3, 11, 19];
    const ribsBrake = detail === 'high' ? [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] : [8, 16, 24];
    for (const s of sides) {
      rowAtt.push(ROWS.map((c) => ribsRow.map((k) => att(s, k, c))));
      brakeAtt.push(ribsBrake.map((k) => att(s, Math.min(k, half), 1)));
      this.refs.push({ a: s * 0.999, tw: -Math.sqrt(0.5), kind: 2, w: 1 });
      stab.push(this.refs.length - 1);
    }
    this.anchor0 = this.refs.length;
    const anchor = (side: number, id: Anchor) => this.anchor0 + (side < 0 ? 0 : N_ANCHORS) + id;
    this.junction0 = this.anchor0 + 2 * N_ANCHORS;
    const junction = (kids: number[], anc: number, f: number) => {
      this.junctions.push({ kids, anchor: anc, f });
      return this.junction0 + this.junctions.length - 1;
    };
    const seg = (p: number, q: number, width: number, floor: number, color: number) => this.segs.push({ p, q, width, floor, color });
    sides.forEach((s, si) => {
      const rows = rowAtt[si];
      rows.forEach((ids, r) => {
        const colMain = r === 0 ? COL.A : r === 1 ? COL.B : COL.C;
        const colUp = r === 0 ? COL.Aup : r === 1 ? COL.Bup : COL.Cup;
        const ancOf = (i: number) => anchor(s, r === 0 ? (ribsRow[i] >= 17 ? Anchor.A2 : Anchor.A) : r === 1 ? Anchor.B : Anchor.C);
        if (detail === 'low') {
          ids.forEach((id, i) => seg(id, ancOf(i), 0.0018, 0.1, colMain));
          return;
        }
        // Upper galleries join pairs of tabs, middle lines two pairs, the main lines go to the maillon.
        const upper: number[] = [];
        for (let g = 0; g < ids.length / 2; g++) upper.push(junction([ids[2 * g], ids[2 * g + 1]], ancOf(2 * g), 0.82));
        const middle: number[] = [];
        for (let h = 0; h < ids.length / 4; h++) middle.push(junction(ids.slice(4 * h, 4 * h + 4), ancOf(4 * h), 0.5));
        ids.forEach((id, i) => seg(id, upper[i >> 1], 0.0009, 0.12, colUp));
        upper.forEach((u, g) => seg(u, middle[g >> 1], 0.0014, 0.18, colMain));
        middle.forEach((m, h) => seg(m, ancOf(4 * h), r === 2 ? 0.0017 : 0.0019, 0.26, colMain));
      });
      const bIds = brakeAtt[si];
      const pul = anchor(s, Anchor.Pulley);
      if (detail === 'low') {
        bIds.forEach((id) => seg(id, pul, 0.0018, 0.1, COL.brake));
      } else {
        const upper: number[] = [];
        for (let g = 0; g < bIds.length; g += 2) upper.push(junction(bIds.slice(g, g + 2), pul, 0.86));
        const groups = [bIds.slice(0, 4), bIds.slice(4, 8), bIds.slice(8)];
        const middle = groups.map((ids) => junction(ids, pul, 0.62));
        const main = junction(bIds, pul, 0.36);
        bIds.forEach((id, i) => seg(id, upper[i >> 1], 0.0009, 0.12, COL.brakeUp));
        upper.forEach((u, g) => seg(u, middle[Math.min(2, g >> 1)], 0.0013, 0.18, COL.brake));
        middle.forEach((m) => seg(m, main, 0.0016, 0.22, COL.brake));
        seg(main, pul, 0.0022, 0.3, COL.brake);
        seg(stab[si], anchor(s, Anchor.B), 0.0012, 0.15, COL.stab);
        seg(anchor(s, Anchor.Bar), anchor(s, Anchor.HarnessPulley), 0.003, 0.3, COL.speed);
        seg(anchor(s, Anchor.HarnessPulley), anchor(s, Anchor.RiserPulley), 0.003, 0.3, COL.speed);
      }
      seg(pul, anchor(s, Anchor.Handle), 0.0024, 0.35, COL.brake);
    });
    this.pts = new Float32Array((this.junction0 + this.junctions.length) * 3);
    // Ribbon geometry: four corners per segment.
    const n = this.segs.length;
    this.pos = new Float32Array(n * 12);
    this.end = new Float32Array(n * 12);
    const corner = new Float32Array(n * 8);
    const color = new Float32Array(n * 12);
    const width = new Float32Array(n * 8);
    const idx: number[] = [];
    const c = new THREE.Color();
    this.segs.forEach((s, i) => {
      c.setHex(s.color);
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        corner[v * 2] = k >> 1;
        corner[v * 2 + 1] = k & 1 ? 1 : -1;
        color.set([c.r, c.g, c.b], v * 3);
        width[v * 2] = s.width;
        width[v * 2 + 1] = s.floor;
      }
      const b = i * 4;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(this.end, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    geo.setAttribute('aWidth', new THREE.BufferAttribute(width, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 2), 13);
    this.geo = geo;
    const mat = lineMaterial();
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    const vp = mat.uniforms.uViewport.value as THREE.Vector2;
    this.mesh.onBeforeRender = (renderer) => {
      renderer.getCurrentViewport(tmpV2);
      vp.set(Math.max(1, tmpV2.z), Math.max(1, tmpV2.w));
    };
  }

  get segmentCount(): number {
    return this.segs.length;
  }

  setAnchor(side: number, id: Anchor, x: number, y: number, z: number): void {
    const i = (this.anchor0 + (side < 0 ? 0 : N_ANCHORS) + id) * 3;
    this.pts[i] = x;
    this.pts[i + 1] = y;
    this.pts[i + 2] = z;
  }

  /** Recomputes the attachment points on the deformed wing, the cascade and the ribbons. */
  update(d: WingDeform): void {
    const pts = this.pts;
    const p = this.p;
    for (let i = 0; i < this.refs.length; i++) {
      const r = this.refs[i];
      wingPoint(d, r.a, r.tw, 0, r.w, r.kind, 0, p);
      pts[i * 3] = p.x;
      pts[i * 3 + 1] = p.y;
      pts[i * 3 + 2] = p.z;
    }
    for (let j = 0; j < this.junctions.length; j++) {
      const J = this.junctions[j];
      let mx = 0;
      let my = 0;
      let mz = 0;
      for (let k = 0; k < J.kids.length; k++) {
        const q = J.kids[k] * 3;
        mx += pts[q];
        my += pts[q + 1];
        mz += pts[q + 2];
      }
      const n = J.kids.length;
      const a = J.anchor * 3;
      const o = (this.junction0 + j) * 3;
      pts[o] = pts[a] + J.f * (mx / n - pts[a]);
      pts[o + 1] = pts[a + 1] + J.f * (my / n - pts[a + 1]);
      pts[o + 2] = pts[a + 2] + J.f * (mz / n - pts[a + 2]);
    }
    const pos = this.pos;
    const end = this.end;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      const a = s.p * 3;
      const b = s.q * 3;
      for (let k = 0; k < 4; k++) {
        const o = (i * 4 + k) * 3;
        pos[o] = pts[a];
        pos[o + 1] = pts[a + 1];
        pos[o + 2] = pts[a + 2];
        end[o] = pts[b];
        end[o + 1] = pts[b + 1];
        end[o + 2] = pts[b + 2];
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aEnd.needsUpdate = true;
  }
}
