/**
 * The canopy mesh: cells with their ballooning, the airfoil, closed tips and stabilos,
 * deformed on the GPU from a few uniforms (glider-shape.ts), its normals taken by finite
 * differences of the deformed surface. The fragment shader draws a modern design (two
 * colours, a swoosh, pinstripe, dark tips), the seams and the cell openings, lights the
 * coated ripstop (wrapped diffuse, satin sheen) and lets the sun through: seen from below
 * the wing glows with the colours of both skins, the ribs, seams and diagonal tapes inside
 * drawn as darker lines.
 */
import * as THREE from 'three';
import { HALF_SPAN, N_CELLS, WING_GLSL, newDeform, ribA, wingPoint } from './glider-shape';

export interface WingRes {
  /** Cells drawn (50 = every real cell) and columns per cell, points around the profile. */
  cells: number;
  seg: number;
  prof: number;
  balloon: boolean;
}

export const WING_HIGH: WingRes = { cells: N_CELLS, seg: 4, prof: 41, balloon: true };
export const WING_PHONE: WingRes = { cells: N_CELLS, seg: 2, prof: 29, balloon: true };
export const WING_LOW: WingRes = { cells: 20, seg: 1, prof: 15, balloon: false };
export const WING_MIN: WingRes = { cells: 10, seg: 1, prof: 9, balloon: false };

const cache = new Map<string, THREE.BufferGeometry>();

/** Rest geometry of the canopy at a resolution (shared by every glider). */
export function wingGeometry(r: WingRes): THREE.BufferGeometry {
  const key = `${r.cells}/${r.seg}/${r.prof}/${r.balloon}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const half = r.cells / 2;
  const ribs: number[] = [];
  for (let i = 0; i <= r.cells; i++) {
    const k = ((i - half) / half) * (N_CELLS / 2);
    ribs.push(Math.sign(k) * ribA(Math.abs(k)));
  }
  const P = r.prof;
  const tws: number[] = [];
  for (let j = 0; j < P; j++) tws.push(Math.sin((Math.PI * (-1 + (2 * j) / (P - 1))) / 2));
  const aP: number[] = [];
  const aK: number[] = [];
  const idx: number[] = [];
  const vert = (a: number, tw: number, v: number, w: number, kind: number, cw: number) => {
    aP.push(a, tw, v, w);
    aK.push(kind, cw);
    return aP.length / 4 - 1;
  };
  // Upper and lower skins, one strip around the profile per column, ribs duplicated so
  // that each cell has its own crease.
  for (let i = 0; i < r.cells; i++) {
    const a0 = ribs[i];
    const a1 = ribs[i + 1];
    const cw = HALF_SPAN * Math.abs(a1 - a0);
    const base = aP.length / 4;
    for (let k = 0; k <= r.seg; k++) {
      const v = k / r.seg;
      for (let j = 0; j < P; j++) vert(a0 + (a1 - a0) * v, tws[j], v, 0, 0, cw);
    }
    for (let k = 0; k < r.seg; k++) {
      for (let j = 0; j < P - 1; j++) {
        const i00 = base + k * P + j;
        const i10 = i00 + P;
        idx.push(i00, i00 + 1, i10, i10, i00 + 1, i10 + 1);
      }
    }
  }
  // Tip closures and stabilos.
  for (const a of [-1, 1]) {
    const base = aP.length / 4;
    for (const w of [0, 1]) for (let j = 0; j < P; j++) vert(a, tws[j], 0, w, 1, 0);
    for (let j = 0; j < P - 1; j++) idx.push(base + j, base + j + 1, base + P + j, base + P + j, base + j + 1, base + P + j + 1);
    const sBase = aP.length / 4;
    const n = 9;
    for (let j = 0; j < n; j++) {
      const c = 0.08 + (0.84 * j) / (n - 1);
      for (const w of [0, 1]) vert(a * 0.999, -Math.sqrt(c), 0, w, 2, 0);
    }
    for (let j = 0; j < n - 1; j++) {
      const i0 = sBase + j * 2;
      idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  const n = aP.length / 4;
  const pos = new Float32Array(n * 3);
  const d = newDeform();
  const p = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < n; i++) {
    wingPoint(d, aP[i * 4], aP[i * 4 + 1], aP[i * 4 + 2], aP[i * 4 + 3], aK[i * 2], r.balloon ? aK[i * 2 + 1] : 0, p);
    pos[i * 3] = p.x;
    pos[i * 3 + 1] = p.y;
    pos[i * 3 + 2] = p.z;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(aP), 4));
  geo.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(aK), 2));
  geo.setIndex(idx);
  // The deformations stay within a few metres of the rest shape (laid out on the ground: behind).
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 2), 13);
  cache.set(key, geo);
  return geo;
}

const VERT = /* glsl */ `
attribute vec4 aP;
attribute vec2 aK;
varying vec4 vP;
varying float vKind;
varying vec3 vN;
varying vec3 vView;
varying float vFold;
${WING_GLSL}
void main() {
  float a = aP.x;
  float tw = aP.y;
  float v = aP.z;
  float w = aP.w;
  float kind = aK.x;
  float cw = aK.y;
  wFoldWeight = 0.0;
  vec3 P = wingPos(a, tw, v, w, kind, cw);
  vFold = wFoldWeight;
  vec3 n;
  float dt = 0.02;
  float st = tw + dt <= 1.0 ? 1.0 : -1.0;
  if (kind < 0.5) {
    // Finite differences across the cell (one-sided at the ribs: sharp creases) and along the profile.
    float dv = 0.15;
    float sv = v + dv <= 1.0 ? 1.0 : -1.0;
    vec3 Pv = wingPos(a + sv * dv * max(cw, 0.05) / ${HALF_SPAN.toFixed(3)}, tw, v + sv * dv, w, kind, cw);
    vec3 Pt = wingPos(a, tw + st * dt, v, w, kind, cw);
    n = cross((Pt - P) * st, (Pv - P) * sv);
  } else {
    float sw = w + 0.1 <= 1.0 ? 1.0 : -1.0;
    float t2 = kind > 1.5 ? -sqrt(min(1.0, tw * tw + 0.02)) : tw + st * dt;
    vec3 Pt = wingPos(a, t2, v, w, kind, cw);
    vec3 Pw = wingPos(a, tw, v, w + sw * 0.1, kind, cw);
    n = cross(Pt - P, (Pw - P) * sw);
  }
  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mv;
  vView = -mv.xyz;
  vN = normalize(normalMatrix * n);
  vP = aP;
  vKind = kind;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uMain;
uniform vec3 uSecond;
uniform vec3 uAccent;
uniform vec3 uUnder;
uniform float uTrans;
varying vec4 vP;
varying float vKind;
varying vec3 vN;
varying vec3 vView;
varying float vFold;
#include <common>
#include <lights_pars_begin>

// Anti-aliased step at 0 and band of half width h around 0 (fades out below a pixel).
float edgeAA(float d) {
  return clamp(d / (fwidth(d) + 1e-6) + 0.5, 0.0, 1.0);
}
float bandAA(float d, float h) {
  float fw = fwidth(d) + 1e-6;
  return clamp((h + 0.5 * fw - abs(d)) / fw, 0.0, 1.0) * min(1.0, 2.0 * h / fw);
}
vec3 designUpper(float al, float c) {
  vec3 col = uMain;
  float b1 = 0.95 - 0.78 * pow(al, 1.35);
  float b2 = b1 + 0.17 - 0.05 * al;
  col = mix(col, uSecond, edgeAA(c - b1) * edgeAA(b2 - c));
  col = mix(col, uAccent, bandAA(c - (b2 + 0.035), 0.009));
  col = mix(col, uSecond, edgeAA(0.05 - c));
  col = mix(col, uAccent, edgeAA(al - (0.935 + 0.03 * c)));
  return col;
}
vec3 designLower(float al, float c) {
  vec3 col = uUnder;
  col = mix(col, uMain, edgeAA(0.1 - c));
  col = mix(col, uMain, edgeAA(al - (0.72 + 0.1 * c)));
  col = mix(col, uAccent, edgeAA(al - 0.965));
  return col;
}

void main() {
  float a = vP.x;
  float al = abs(a);
  float tw = vP.y;
  float c = tw * tw;
  bool upper = tw >= 0.0;
  // Cells from the layout of the ribs (the same at every level of detail).
  float kr = asin(min(al * ${Math.sin(0.942).toFixed(6)}, 1.0)) / 0.942 * ${(N_CELLS / 2).toFixed(1)};
  float cell = floor(kr);
  float cv = kr - cell;
  float rd = min(cv, 1.0 - cv);
  vec3 colUp = designUpper(al, c);
  vec3 colLo = designLower(al, c);
  vec3 albedo = upper ? colUp : colLo;
  // Stabilo: the main colour, a dark band along its lower edge.
  if (vKind > 1.5) albedo = mix(uMain, uAccent, smoothstep(0.55, 0.7, vP.w));
  // Seams: along the ribs, across the panels.
  float seam = bandAA(rd, 0.012);
  if (upper) seam = max(seam, max(bandAA(c - 0.05, 0.003), max(bandAA(c - 0.33, 0.002), bandAA(c - 0.62, 0.002))));
  else seam = max(seam, max(bandAA(c - 0.1, 0.003), bandAA(c - 0.5, 0.002)));
  if (vKind > 0.5) seam = 0.0;
  albedo *= 1.0 - 0.3 * seam;
  // Cell openings under the nose (closed at the tips), with their reinforced lip.
  float open = 0.0;
  if (!upper && al < 0.86 && vKind < 0.5) {
    vec2 q = vec2((cv - 0.5) / 0.37, (-tw - 0.115) / 0.085);
    float sd = pow(pow(abs(q.x), 4.0) + pow(abs(q.y), 4.0), 0.25) - 1.0;
    open = clamp(-sd / (fwidth(sd) + 1e-4) + 0.5, 0.0, 1.0);
    albedo *= 1.0 - 0.35 * bandAA(sd, 0.09) * (1.0 - open);
  }

  vec3 N = normalize(vN);
  vec3 V = normalize(vView);
  if (vKind < 0.5) {
    if (!gl_FrontFacing) N = -N;
  } else if (dot(N, V) < 0.0) N = -N;
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
  // A folded part hangs under the open wing, in its shade.
  float shade = 1.0 - 0.5 * vFold;
  float ndl = dot(N, L);
  float ndu = dot(N, U);
  float diff = max(0.0, (ndl + 0.1) / 1.1) * shade;
  vec3 hemi = mix(gndC, skyC, 0.5 * ndu + 0.5);
  float ao = 0.76 + 0.24 * smoothstep(0.0, 0.3, rd);
  vec3 col = albedo * RECIPROCAL_PI * (sunC * diff + hemi * ao);
  // Satin sheen of the coated ripstop.
  vec3 Hv = normalize(L + V);
  float spec = pow(max(dot(N, Hv), 0.0), 32.0) * 0.07 * smoothstep(0.0, 0.25, ndl) * shade;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.05;
  col += sunC * spec + hemi * rim;
  // Light through both skins, the structure inside darker.
  float x = mod(cell, 2.0) > 0.5 ? cv : 1.0 - cv;
  float diag = max(max(bandAA(c - (0.11 + 0.1 * x), 0.004), bandAA(c - (0.37 - 0.12 * x), 0.004)), max(bandAA(c - (0.37 + 0.1 * x), 0.004), bandAA(c - (0.66 - 0.12 * x), 0.004)));
  // Thicker light path near the ribs, the cell glowing most in its middle.
  float tShade = (0.3 + 0.7 * smoothstep(0.0, 0.06, rd)) * (0.72 + 0.28 * sin(PI * cv)) * (1.0 - 0.22 * diag) * (1.0 - 0.5 * seam);
  float back = max(0.0, -ndl) * shade;
  float fwd = pow(max(0.0, dot(-V, L)), 8.0);
  vec3 tcol = colUp * colLo;
  col += tcol * (sunC * back * (1.0 + 1.6 * fwd) + skyC * max(0.0, -ndu) * 0.3) * uTrans * tShade;
  // The inside of a cell, seen through its opening: the upper skin lit through.
  if (open > 0.0) {
    vec3 inside = uMain * (sunC * (0.03 + 0.2 * max(0.0, dot(L, U))) + skyC * 0.05) * uTrans;
    col = mix(col, inside, open);
  }
  gl_FragColor = vec4(col, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}
`;

/** Uniforms shared by the levels of detail of one glider. */
export interface WingUniforms {
  uBrake: { value: THREE.Vector4 };
  uFoldL: { value: THREE.Vector4 };
  uFoldR: { value: THREE.Vector4 };
  uMisc: { value: THREE.Vector4 };
  uInfl: { value: THREE.Vector4 };
  uUp: { value: THREE.Vector3 };
  uFlex: { value: THREE.Vector4 };
  uMain: { value: THREE.Color };
  uSecond: { value: THREE.Color };
  uAccent: { value: THREE.Color };
  uUnder: { value: THREE.Color };
  uTrans: { value: number };
}

export function wingUniforms(colors: { main: number; stripe: number; under: number; accent?: number }): WingUniforms {
  return {
    uBrake: { value: new THREE.Vector4() },
    uFoldL: { value: new THREE.Vector4(2, 2, 0, 0) },
    uFoldR: { value: new THREE.Vector4(2, 2, 0, 0) },
    uMisc: { value: new THREE.Vector4() },
    uInfl: { value: new THREE.Vector4(1, 0, 0, -100) },
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    uFlex: { value: new THREE.Vector4() },
    uMain: { value: new THREE.Color(colors.main) },
    uSecond: { value: new THREE.Color(colors.stripe) },
    uAccent: { value: new THREE.Color(colors.accent ?? 0x23262e) },
    uUnder: { value: new THREE.Color(colors.under) },
    uTrans: { value: 0.32 },
  };
}

export function wingMaterial(u: WingUniforms, balloon: boolean): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    lights: true,
    side: THREE.DoubleSide,
    defines: balloon ? {} : { NO_BALLOON: '' },
  });
  // Shared objects: one write per frame updates every level.
  Object.assign(m.uniforms, u);
  return m;
}
