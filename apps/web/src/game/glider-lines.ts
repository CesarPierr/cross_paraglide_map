/**
 * The suspension lines: a real cascade (upper galleries from the attachment tabs to the
 * middle lines, then to the main lines on the riser maillons; A red, B and C yellow, the
 * brakes orange, the stabilo line red), and the speed system under the harness. Drawn as
 * camera-facing ribbons whose width is the line's true diameter where it covers more than
 * a pixel (near the eye) and one anti-aliased pixel with a proportional opacity beyond, so
 * they look right from the risers to a pilot a kilometre away. The end points are
 * recomputed every frame from the deformed wing (glider-shape.ts), without allocation.
 *
 * Each line is a curve, not a polyline: a cubic (Hermite) from its two ends and their
 * tangents, evaluated on the GPU at LINE_PIECES points (one instance per line: the CPU
 * writes 15 numbers per line, whatever the subdivision), so a bowed line is smooth however
 * close the eye. A taut line is straight; a slack line's tangents carry its bow (the cubic
 * is then exactly the bow's parabola); along a slack cascade the tangents on either side of
 * a junction are pulled towards each other in proportion to the slack, so the cascade
 * hangs as one smooth curve, while taut lines keep the sharp angle their tensions make at
 * the knot.
 *
 * A line shorter than its rest length is slack: it bows back in the airflow (and a little
 * down), as a parabola whose arc keeps the rest length, and flutters; a long one also
 * snakes (an S across it). That happens to the lines of a folded part (collapse, big ears),
 * to the brake lines hands up (~10 cm of free travel before the trailing edge moves), and to
 * the speed lines with the bar released. A slack cascade's junctions drift back with them.
 * The bows are springs (~5 Hz for a line, ~3 Hz for a junction, lightly damped: a Dyneema
 * line of a millimetre weighs ~1 g/m and the air hardly damps it): a line pulled taut again
 * snaps straight past its course and twangs.
 * Each line is lit as a thin cylinder seen from the camera: bright when its lit side faces
 * the eye, dark against the sun or seen from below (lit by the ground).
 */
import * as THREE from 'three';
import { N_CELLS, ROWS, newDeform, ribA, wingPoint, type Vec3Like, type WingDeform } from './glider-shape';

/** Points of each line's curve on the GPU (near level; the far level's lines are straight). */
export const LINE_PIECES = 48;

/** Anchor points given by the riser and pilot model, per side (canopy frame). */
export const Anchor = { A: 0, A2: 1, B: 2, C: 3, Pulley: 4, Handle: 5, Bar: 6, HarnessPulley: 7, RiserPulley: 8 } as const;
export type Anchor = (typeof Anchor)[keyof typeof Anchor];
const N_ANCHORS = 9;

/** Anchors of the rest geometry (right side, canopy frame), for the lines' rest lengths. */
export const REST_ANCHORS: [number, number, number][] = [
  [0.238, 0.47, -0.074],
  [0.262, 0.462, -0.05],
  [0.248, 0.468, -0.012],
  [0.24, 0.462, 0.048],
  [0.252, 0.426, 0.072],
  [0.262, 0.315, 0.071],
  [0.17, -0.27, -0.6],
  [0.215, -0.2, -0.06],
  [0.214, 0.1, -0.03],
];

interface WingRef {
  a: number;
  tw: number;
  kind: number;
  w: number;
}
interface Junction {
  kids: number[];
  anchor: number;
  side: number;
  f: number;
  /** Rest distance from the anchor to the kids' mean; the junction's drift (m) and its rate. */
  rest: number;
  off: number;
  offV: number;
}
/** How a line goes slack: from its rest length (kind 0), brake (1: free travel hands up), speed system (2: bar released). */
type Slack = 0 | 1 | 2;
interface Seg {
  p: number;
  q: number;
  width: number;
  floor: number;
  color: number;
  /** Pieces drawn (a bowed line is a polyline). */
  n: number;
  slack: Slack;
  /** Brake and speed lines: slack (m) with the hands up or the bar released. */
  free: number;
  side: number;
  /** The bow drawn (m) and its rate. */
  bow: number;
  bowV: number;
  /** Slack 0 (taut) … 1 (bowed), for the tangents' blend at the junctions. */
  slackK: number;
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
attribute vec3 aP0;
attribute vec3 aP1;
attribute vec3 aM0;
attribute vec3 aM1;
attribute vec3 aSnake;
attribute vec3 aColor;
attribute vec2 aWidth;
attribute vec2 aCorner;
attribute vec2 aT;
uniform vec2 uViewport;
uniform vec3 uEye;
varying vec3 vColor;
varying float vAlpha;
varying float vDist;
varying float vHalf;
varying vec3 vT;
varying vec3 vV;
// The line's curve at t: a cubic Hermite from its ends and tangents, plus the S of a long slack line.
vec3 lineAt(float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * aP0 + (t3 - 2.0 * t2 + t) * aM0 + (3.0 * t2 - 2.0 * t3) * aP1 + (t3 - t2) * aM1 + aSnake * sin(6.2831853 * t);
}
void main() {
  vec3 pa = lineAt(aT.x);
  vec3 pb = lineAt(aT.y);
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 ca = mvp * vec4(pa, 1.0);
  vec4 cb = mvp * vec4(pb, 1.0);
  // Clip the piece against the near plane before going to the screen.
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
  vT = mat3(modelViewMatrix) * (pb - pa);
  vec4 mv = modelViewMatrix * vec4(aCorner.x < 0.5 ? pa : pb, 1.0);
  vV = uEye - mv.xyz;
}
`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vDist;
varying float vHalf;
varying vec3 vT;
varying vec3 vV;
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
  vec3 U = vec3(0.0, 1.0, 0.0);
  vec3 skyC = vec3(0.35);
  vec3 gndC = vec3(0.2);
#if NUM_HEMI_LIGHTS > 0
  U = hemisphereLights[0].direction;
  skyC = hemisphereLights[0].skyColor;
  gndC = hemisphereLights[0].groundColor;
#endif
  // A thin cylinder seen from the eye: the half facing the camera is lit by the sun in
  // proportion to how much of it the sun sees, and by the sky or the ground below.
  vec3 T = normalize(vT);
  vec3 Lp = L - T * dot(L, T);
  vec3 Vp = vV - T * dot(vV, T);
  float vl = length(Vp);
  vec3 Vn = vl > 1e-6 ? Vp / vl : vec3(0.0, 0.0, 1.0);
  float ll = length(Lp);
  float sunSide = ll > 1e-4 ? 0.5 + 0.5 * dot(Lp / ll, Vn) : 0.5;
  float diff = ll * sunSide;
  vec3 hemi = mix(gndC, skyC, 0.5 + 0.5 * dot(Vn, U));
  vec3 col = vColor * RECIPROCAL_PI * (sunC * (0.9 * diff) + hemi * 1.05);
  gl_FragColor = vec4(col, a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}
`;

const tmpV4 = new THREE.Vector4();

/**
 * One implicit Euler step of a damped spring towards `target` (angular frequency w, damping
 * z): the new rate (the position then moves by rate × h). Stable whatever the step.
 */
function springV(x: number, v: number, target: number, w: number, z: number, h: number): number {
  return (v + h * w * w * (target - x)) / (1 + 2 * z * w * h + w * w * h * h);
}

/**
 * The camera's centre in the space before the projection (the null space of the
 * projection's rows x, y and w: the origin for a perspective camera, elsewhere for the
 * map's camera, whose projection includes its view).
 */
function eyeOf(p: THREE.Matrix4, out: THREE.Vector3): THREE.Vector3 {
  const e = p.elements;
  // Row r, column c is e[c * 4 + r]: rows x (r = 0), y (1), w (3).
  const d3 = (i: number, j: number, k: number) => e[i * 4] * (e[j * 4 + 1] * e[k * 4 + 3] - e[k * 4 + 1] * e[j * 4 + 3]) - e[j * 4] * (e[i * 4 + 1] * e[k * 4 + 3] - e[k * 4 + 1] * e[i * 4 + 3]) + e[k * 4] * (e[i * 4 + 1] * e[j * 4 + 3] - e[j * 4 + 1] * e[i * 4 + 3]);
  const x = d3(1, 2, 3);
  const y = -d3(0, 2, 3);
  const z = d3(0, 1, 3);
  const w = -d3(0, 1, 2);
  if (Math.abs(w) < 1e-12) return out.set(0, 0, 0);
  return out.set(x / w, y / w, z / w);
}

export function lineMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, { uViewport: { value: new THREE.Vector2(1280, 800) }, uEye: { value: new THREE.Vector3() } }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    lights: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
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
  private rest: Float32Array;
  /** Per line: the line continuing it below its lower end (a junction), −1 at an anchor. */
  private next: Int32Array;
  /** Per line (instance): ends, end tangents, the S of a long slack line (m). */
  private p0: Float32Array;
  private p1: Float32Array;
  private m0: Float32Array;
  private m1: Float32Array;
  private snake: Float32Array;
  /** Scratch of the junction pass: incoming tangent directions per line, and their weight. */
  private acc: Float32Array;
  private geo: THREE.InstancedBufferGeometry;
  private p: Vec3Like = { x: 0, y: 0, z: 0 };
  /** Cravat: the side whose tip is caught in the lines (0 none), the bundle, how hard it pulls 0..1. */
  private catchSide = 0;
  private catchK = 0;
  private catchP = new Float32Array(3);

  constructor(detail: 'high' | 'low') {
    const high = detail === 'high';
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
    const ribsRow = high ? [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23] : [3, 11, 19];
    const ribsBrake = high ? [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24] : [8, 16, 24];
    for (const s of sides) {
      rowAtt.push(ROWS.map((c) => ribsRow.map((k) => att(s, k, c))));
      brakeAtt.push(ribsBrake.map((k) => att(s, Math.min(k, half), 1)));
      this.refs.push({ a: s * 0.999, tw: -Math.sqrt(0.5), kind: 2, w: 1 });
      stab.push(this.refs.length - 1);
    }
    this.anchor0 = this.refs.length;
    const anchor = (side: number, id: Anchor) => this.anchor0 + (side < 0 ? 0 : N_ANCHORS) + id;
    this.junction0 = this.anchor0 + 2 * N_ANCHORS;
    const junction = (kids: number[], anc: number, f: number, side: number) => {
      this.junctions.push({
        kids,
        anchor: anc,
        side,
        f,
        rest: 0,
        off: 0,
        offV: 0,
      });
      return this.junction0 + this.junctions.length - 1;
    };
    const seg = (side: number, p: number, q: number, width: number, floor: number, color: number, n: number, slack: Slack = 0, free = 0) =>
      this.segs.push({
        side,
        p,
        q,
        width,
        floor,
        color,
        n: high ? n : 1,
        slack,
        free,
        bow: 0,
        bowV: 0,
        slackK: 0,
      });
    sides.forEach((s, si) => {
      const rows = rowAtt[si];
      rows.forEach((ids, r) => {
        const colMain = r === 0 ? COL.A : r === 1 ? COL.B : COL.C;
        const colUp = r === 0 ? COL.Aup : r === 1 ? COL.Bup : COL.Cup;
        const ancOf = (i: number) => anchor(s, r === 0 ? (ribsRow[i] >= 17 ? Anchor.A2 : Anchor.A) : r === 1 ? Anchor.B : Anchor.C);
        if (!high) {
          ids.forEach((id, i) => seg(s, id, ancOf(i), 0.0018, 0.1, colMain, 1));
          return;
        }
        // Upper galleries join pairs of tabs, middle lines two pairs, the main lines go to the maillon.
        const upper: number[] = [];
        for (let g = 0; g < ids.length / 2; g++) upper.push(junction([ids[2 * g], ids[2 * g + 1]], ancOf(2 * g), 0.82, s));
        const middle: number[] = [];
        for (let h = 0; h < ids.length / 4; h++) middle.push(junction(ids.slice(4 * h, 4 * h + 4), ancOf(4 * h), 0.5, s));
        ids.forEach((id, i) => seg(s, id, upper[i >> 1], 0.0009, 0.12, colUp, 2));
        upper.forEach((u, g) => seg(s, u, middle[g >> 1], 0.0014, 0.18, colMain, 3));
        middle.forEach((m, h) => seg(s, m, ancOf(4 * h), r === 2 ? 0.0017 : 0.0019, 0.26, colMain, 4));
      });
      const bIds = brakeAtt[si];
      const pul = anchor(s, Anchor.Pulley);
      if (!high) {
        bIds.forEach((id) => seg(s, id, pul, 0.0018, 0.1, COL.brake, 1));
      } else {
        const upper: number[] = [];
        for (let g = 0; g < bIds.length; g += 2) upper.push(junction(bIds.slice(g, g + 2), pul, 0.86, s));
        const groups = [bIds.slice(0, 4), bIds.slice(4, 8), bIds.slice(8)];
        const middle = groups.map((ids) => junction(ids, pul, 0.62, s));
        const main = junction(bIds, pul, 0.36, s);
        bIds.forEach((id, i) => seg(s, id, upper[i >> 1], 0.0009, 0.12, COL.brakeUp, 2, 1, 0));
        upper.forEach((u, g) => seg(s, u, middle[Math.min(2, g >> 1)], 0.0013, 0.18, COL.brake, 2, 1, 0));
        middle.forEach((m) => seg(s, m, main, 0.0016, 0.22, COL.brake, 3, 1, 0));
        seg(s, main, pul, 0.0022, 0.3, COL.brake, 5, 1, 0.012);
        seg(s, stab[si], anchor(s, Anchor.B), 0.0012, 0.15, COL.stab, 3);
        seg(s, anchor(s, Anchor.Bar), anchor(s, Anchor.HarnessPulley), 0.003, 0.3, COL.speed, 3, 2, 0.05);
        seg(s, anchor(s, Anchor.HarnessPulley), anchor(s, Anchor.RiserPulley), 0.003, 0.3, COL.speed, 3, 2, 0.04);
      }
      seg(s, pul, anchor(s, Anchor.Handle), 0.0024, 0.35, COL.brake, 3, 1, 0.006);
    });
    const nSeg = this.segs.length;
    this.pts = new Float32Array((this.junction0 + this.junctions.length) * 3);
    this.rest = new Float32Array(nSeg);
    this.next = new Int32Array(nSeg).fill(-1);
    for (let i = 0; i < nSeg; i++) {
      const q = this.segs[i].q;
      if (q < this.junction0) continue;
      for (let k = 0; k < nSeg; k++) if (this.segs[k].p === q) this.next[i] = k;
    }
    this.p0 = new Float32Array(nSeg * 3);
    this.p1 = new Float32Array(nSeg * 3);
    this.m0 = new Float32Array(nSeg * 3);
    this.m1 = new Float32Array(nSeg * 3);
    this.snake = new Float32Array(nSeg * 3);
    this.acc = new Float32Array(nSeg * 4);
    // One instance per line; the base strip: LINE_PIECES pieces (one: a straight line far away), four corners each.
    const pieces = high ? LINE_PIECES : 1;
    const corner = new Float32Array(pieces * 8);
    const tt = new Float32Array(pieces * 8);
    const idx: number[] = [];
    for (let j = 0; j < pieces; j++) {
      for (let k = 0; k < 4; k++) {
        const v = j * 4 + k;
        corner[v * 2] = k >> 1;
        corner[v * 2 + 1] = k & 1 ? 1 : -1;
        tt[v * 2] = j / pieces;
        tt[v * 2 + 1] = (j + 1) / pieces;
      }
      const b = j * 4;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    const color = new Float32Array(nSeg * 3);
    const width = new Float32Array(nSeg * 2);
    const c = new THREE.Color();
    this.segs.forEach((s, i) => {
      c.setHex(s.color);
      color.set([c.r, c.g, c.b], i * 3);
      width[i * 2] = s.width;
      width[i * 2 + 1] = s.floor;
    });
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pieces * 12), 3));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    geo.setAttribute('aT', new THREE.BufferAttribute(tt, 2));
    const dyn = (a: Float32Array) => new THREE.InstancedBufferAttribute(a, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aP0', dyn(this.p0));
    geo.setAttribute('aP1', dyn(this.p1));
    geo.setAttribute('aM0', dyn(this.m0));
    geo.setAttribute('aM1', dyn(this.m1));
    geo.setAttribute('aSnake', dyn(this.snake));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
    geo.setAttribute('aWidth', new THREE.InstancedBufferAttribute(width, 2));
    geo.setIndex(idx);
    geo.instanceCount = nSeg;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 2), 13);
    this.geo = geo;
    const mat = lineMaterial();
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    const vp = mat.uniforms.uViewport.value as THREE.Vector2;
    const eye = mat.uniforms.uEye.value as THREE.Vector3;
    this.mesh.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getCurrentViewport(tmpV4);
      vp.set(Math.max(1, tmpV4.z), Math.max(1, tmpV4.w));
      eyeOf(camera.projectionMatrix, eye);
    };
    // Rest lengths: the flying wing, the risers at rest, hands up.
    for (const s of sides) REST_ANCHORS.forEach(([x, y, z], id) => this.setAnchor(s, id as Anchor, s * x, y, z));
    this.place(newDeform(), 0);
    for (const J of this.junctions) J.rest = this.spread(J);
    for (let i = 0; i < nSeg; i++) {
      const s = this.segs[i];
      this.rest[i] = Math.hypot(this.pts[s.q * 3] - this.pts[s.p * 3], this.pts[s.q * 3 + 1] - this.pts[s.p * 3 + 1], this.pts[s.q * 3 + 2] - this.pts[s.p * 3 + 2]);
    }
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

  /** An anchor as the rig last placed it (canopy frame), into `out`. */
  anchor(side: number, id: Anchor, out: Vec3Like): Vec3Like {
    const i = (this.anchor0 + (side < 0 ? 0 : N_ANCHORS) + id) * 3;
    out.x = this.pts[i];
    out.y = this.pts[i + 1];
    out.z = this.pts[i + 2];
    return out;
  }

  /**
   * A cravat: the tip of `side` caught in its lines at (x, y, z) (canopy frame), pulling
   * them with a strength 0..1 (0 or side 0: nothing caught). The cascade's junctions near
   * the bundle are dragged into it.
   */
  setCatch(side: number, x: number, y: number, z: number, k: number): void {
    this.catchSide = k > 0 ? side : 0;
    this.catchK = Math.max(0, Math.min(1, k));
    this.catchP[0] = x;
    this.catchP[1] = y;
    this.catchP[2] = z;
  }

  /** Distance from a junction's anchor to the mean of its kids (the points placed so far). */
  private spread(J: Junction): number {
    const pts = this.pts;
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
    return Math.hypot(mx / n - pts[a], my / n - pts[a + 1], mz / n - pts[a + 2]);
  }

  /** Last time seen (WingDeform.brake[3]) for the springs' step; NaN before the first update. */
  private time = NaN;

  /**
   * The attachment points on the deformed wing and the cascade's junctions; `h` (s) steps the
   * junctions' drift (0: placed at once where it settles).
   */
  private place(d: WingDeform, h: number): void {
    const pts = this.pts;
    // Loaded lines are stretched (~1 % at trim): a small shortening only relaxes them.
    const pre = 0.01 * Math.min(2, Math.max(0, d.air[0]));
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
      const ex = mx / n - pts[a];
      const ey = my / n - pts[a + 1];
      const ez = mz / n - pts[a + 2];
      pts[o] = pts[a] + J.f * ex;
      pts[o + 1] = pts[a + 1] + J.f * ey;
      pts[o + 2] = pts[a + 2] + J.f * ez;
      // A slack cascade: its lines no longer reach that far, the junction drifts back (and a
      // little down) in the airflow, as the apex of the two lines' triangle.
      if (J.rest > 0) {
        const D = Math.hypot(ex, ey, ez);
        const R = J.rest * (1 - pre);
        const target = D < R ? Math.min(0.8 * J.f * (1 - J.f) * Math.sqrt(R * R - D * D), 0.1 * J.rest) : 0;
        if (h > 0) {
          const hs = h / 2;
          for (let k = 0; k < 2; k++) {
            J.offV = springV(J.off, J.offV, target, 2 * Math.PI * 3, 0.3, hs);
            J.off += J.offV * hs;
          }
          J.off = Math.max(-0.05 * J.rest, J.off);
        } else {
          J.off = target;
          J.offV = 0;
        }
        if (Math.abs(J.off) > 1e-4 && D > 1e-3) {
          // Back and down, square to the anchor–kids axis, swaying a little.
          const inv = 1 / D;
          const tx = ex * inv;
          const ty = ey * inv;
          const tz = ez * inv;
          let dx = 0.3 * Math.sin(this.time * 2.3 + j * 1.9);
          let dy = -0.3;
          let dz = 1;
          const dt = dx * tx + dy * ty + dz * tz;
          dx -= dt * tx;
          dy -= dt * ty;
          dz -= dt * tz;
          const dl = Math.hypot(dx, dy, dz);
          if (dl > 1e-4) {
            const k = J.off / dl;
            pts[o] += dx * k;
            pts[o + 1] += dy * k;
            pts[o + 2] += dz * k;
          }
        }
      }
      // A cravat: the junctions of the caught side near the bundle are dragged towards it
      // (the fabric wrapped round the lines pulls them out of their course).
      if (J.side === this.catchSide && this.catchK > 0) {
        const cx = this.catchP[0] - pts[o];
        const cy = this.catchP[1] - pts[o + 1];
        const cz = this.catchP[2] - pts[o + 2];
        const w = this.catchK * 0.75 * Math.exp(-(cx * cx + cy * cy + cz * cz) / 1.6);
        pts[o] += cx * w;
        pts[o + 1] += cy * w;
        pts[o + 2] += cz * w;
      }
    }
  }

  /**
   * Recomputes the attachment points on the deformed wing, the cascade and the curves. The
   * springs step by the time elapsed since the last call (WingDeform.brake[3]); when it did
   * not move (a still picture, the tests) every bow is drawn where it settles.
   */
  update(d: WingDeform): void {
    const time = d.brake[3];
    const step = Number.isNaN(this.time) ? 0 : Math.min(0.1, Math.max(0, time - this.time));
    this.time = time;
    // Two implicit steps per frame for the springs: stable at any frame rate, ~1/120 s at 60 Hz.
    const nSub = step > 0 ? 2 : 0;
    const h = step / 2;
    this.place(d, step);
    const pre = 0.01 * Math.min(2, Math.max(0, d.air[0]));
    const pts = this.pts;
    const { p0, p1, m0, m1, snake } = this;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      const a = s.p * 3;
      const b = s.q * 3;
      const ax = pts[a];
      const ay = pts[a + 1];
      const az = pts[a + 2];
      const ex = pts[b] - ax;
      const ey = pts[b + 1] - ay;
      const ez = pts[b + 2] - az;
      // Bow of a slack line: the parabola whose arc is the rest length, back in the airflow.
      let sag = 0;
      let sn = 0;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let qx = 0;
      let qy = 0;
      let qz = 0;
      const L = Math.hypot(ex, ey, ez);
      if (s.n > 1) {
        let free: number;
        if (s.slack === 0) free = this.rest[i] * (1 - pre) - L;
        else if (s.slack === 1) {
          const br = s.side < 0 ? d.brake[0] : d.brake[1];
          const t = Math.min(1, br / 0.15);
          free = (s.free + 0.002 * L) * (1 - t * t * (3 - 2 * t));
        } else free = s.free * (1 - Math.min(1, d.brake[2] * 3));
        const ph = time * (7 + (i % 5)) + i * 1.7;
        let target = 0;
        if (free > 1e-4 && L > 1e-3) {
          target = Math.min(Math.sqrt((3 * L * free) / 8), 0.3 * L);
          // Fluttering: the bow breathes and swings a little.
          target *= 1 + 0.12 * Math.sin(ph);
        }
        // The bow follows as a spring: it grows as the line slackens, and a line pulled taut
        // snaps through straight and twangs.
        if (nSub) {
          for (let k = 0; k < nSub; k++) {
            s.bowV = springV(s.bow, s.bowV, target, 2 * Math.PI * 5, 0.22, h);
            s.bow += s.bowV * h;
          }
          s.bow = Math.max(-0.08 * L, Math.min(0.32 * L, s.bow));
        } else {
          s.bow = target;
          s.bowV = 0;
        }
        sag = Math.abs(s.bow) > 1e-4 ? s.bow : 0;
        if (sag !== 0 && L > 1e-3) {
          // A long slack line snakes: an S across its bow, waving.
          sn = s.n >= 3 ? 0.35 * Math.max(0, sag) * Math.sin(ph * 0.9 + i) : 0;
          const inv = 1 / L;
          const tx = ex * inv;
          const ty = ey * inv;
          const tz = ez * inv;
          // Back and a little down, square to the line, swinging sideways as it flutters.
          let dx = 0.25 * Math.sin(ph * 0.7);
          let dy = -0.3;
          let dz = 1;
          const dt = dx * tx + dy * ty + dz * tz;
          dx -= dt * tx;
          dy -= dt * ty;
          dz -= dt * tz;
          const dl = Math.hypot(dx, dy, dz);
          if (dl > 1e-4) {
            sx = (dx / dl) * sag;
            sy = (dy / dl) * sag;
            sz = (dz / dl) * sag;
            // Sideways: square to the line and to its bow.
            qx = (ty * dz - tz * dy) / dl;
            qy = (tz * dx - tx * dz) / dl;
            qz = (tx * dy - ty * dx) / dl;
          } else sag = 0;
        }
      }
      s.slackK = L > 1e-3 ? Math.min(1, Math.max(0, sag) / (0.06 * L)) : 0;
      const o = i * 3;
      p0[o] = ax;
      p0[o + 1] = ay;
      p0[o + 2] = az;
      p1[o] = ax + ex;
      p1[o + 1] = ay + ey;
      p1[o + 2] = az + ez;
      // The parabola P0 + E t + 4 S t (1 − t) as a cubic Hermite: tangents E ± 4 S.
      m0[o] = ex + 4 * sx;
      m0[o + 1] = ey + 4 * sy;
      m0[o + 2] = ez + 4 * sz;
      m1[o] = ex - 4 * sx;
      m1[o + 1] = ey - 4 * sy;
      m1[o + 2] = ez - 4 * sz;
      snake[o] = qx * sn;
      snake[o + 1] = qy * sn;
      snake[o + 2] = qz * sn;
    }
    this.smoothJunctions();
    const at = this.geo.attributes;
    at.aP0.needsUpdate = true;
    at.aP1.needsUpdate = true;
    at.aM0.needsUpdate = true;
    at.aM1.needsUpdate = true;
    at.aSnake.needsUpdate = true;
  }

  /**
   * Along a slack cascade, the tangents on both sides of a junction turn towards their
   * common direction (a slack line hangs smooth through its knot); taut lines keep their
   * angle (the knot balances their tensions). Weight: the slack of the lines meeting there.
   */
  private smoothJunctions(): void {
    const { m0, m1, next, acc, segs } = this;
    acc.fill(0);
    for (let i = 0; i < segs.length; i++) {
      const k = next[i];
      if (k < 0) continue;
      const wgt = Math.min(segs[i].slackK, segs[k].slackK);
      if (wgt <= 0) continue;
      const o = i * 3;
      const l = Math.hypot(m1[o], m1[o + 1], m1[o + 2]) || 1;
      acc[k * 4] += (m1[o] / l) * wgt;
      acc[k * 4 + 1] += (m1[o + 1] / l) * wgt;
      acc[k * 4 + 2] += (m1[o + 2] / l) * wgt;
      acc[k * 4 + 3] += wgt;
    }
    for (let k = 0; k < segs.length; k++) {
      const wsum = acc[k * 4 + 3];
      if (wsum <= 0) continue;
      const o = k * 3;
      const lk = Math.hypot(m0[o], m0[o + 1], m0[o + 2]) || 1;
      // The common direction: between the incoming lines' ends and this line's start.
      let bx = acc[k * 4] / wsum + m0[o] / lk;
      let by = acc[k * 4 + 1] / wsum + m0[o + 1] / lk;
      let bz = acc[k * 4 + 2] / wsum + m0[o + 2] / lk;
      const bl = Math.hypot(bx, by, bz) || 1;
      bx /= bl;
      by /= bl;
      bz /= bl;
      acc[k * 4] = bx;
      acc[k * 4 + 1] = by;
      acc[k * 4 + 2] = bz;
      const wk = 0.85 * Math.min(1, wsum / 1);
      m0[o] += (bx * lk - m0[o]) * wk;
      m0[o + 1] += (by * lk - m0[o + 1]) * wk;
      m0[o + 2] += (bz * lk - m0[o + 2]) * wk;
    }
    for (let i = 0; i < segs.length; i++) {
      const k = next[i];
      if (k < 0 || acc[k * 4 + 3] <= 0) continue;
      const wgt = 0.85 * Math.min(segs[i].slackK, segs[k].slackK);
      if (wgt <= 0) continue;
      const o = i * 3;
      const l = Math.hypot(m1[o], m1[o + 1], m1[o + 2]) || 1;
      m1[o] += (acc[k * 4] * l - m1[o]) * wgt;
      m1[o + 1] += (acc[k * 4 + 1] * l - m1[o + 1]) * wgt;
      m1[o + 2] += (acc[k * 4 + 2] * l - m1[o + 2]) * wgt;
    }
  }

  /** A point of line `i`'s curve at t (0 at its upper end … 1), as the GPU draws it. */
  curvePoint(i: number, t: number, out: Vec3Like): Vec3Like {
    const o = i * 3;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = 3 * t2 - 2 * t3;
    const h11 = t3 - t2;
    const sw = Math.sin(2 * Math.PI * t);
    const { p0, p1, m0, m1, snake } = this;
    out.x = h00 * p0[o] + h10 * m0[o] + h01 * p1[o] + h11 * m1[o] + snake[o] * sw;
    out.y = h00 * p0[o + 1] + h10 * m0[o + 1] + h01 * p1[o + 1] + h11 * m1[o + 1] + snake[o + 1] * sw;
    out.z = h00 * p0[o + 2] + h10 * m0[o + 2] + h01 * p1[o + 2] + h11 * m1[o + 2] + snake[o + 2] * sw;
    return out;
  }

  /** Every line's curve at `n` + 1 points (x, y, z, line after line): for the tests. */
  samples(n = LINE_PIECES): Float32Array {
    const out = new Float32Array(this.segs.length * (n + 1) * 3);
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0, o = 0; i < this.segs.length; i++)
      for (let j = 0; j <= n; j++, o += 3) {
        this.curvePoint(i, j / n, p);
        out[o] = p.x;
        out[o + 1] = p.y;
        out[o + 2] = p.z;
      }
    return out;
  }
}
