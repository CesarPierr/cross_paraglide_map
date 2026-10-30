/**
 * The canopy mesh: cells with their ballooning, the airfoil, closed tips and stabilos,
 * deformed on the GPU from a few uniforms (glider-shape.ts) and, near the camera, the
 * offsets of a cloth simulation of the skins (Blender, per brake level, loaded in the
 * background) and the folded parts' real-time cloth (a float texture), its normals taken by
 * finite differences of the deformed surface. Within NEAR_DIST (the pilot's view) a denser
 * mesh carries the fabric's wrinkles as geometry and the cell openings as holes (WING_NEAR,
 * nearRows); beyond, the fragment shader draws the wrinkles (line tabs, brake tabs, slack
 * fabric: `fabricH`, by perturbing the normal). It draws a modern design (two
 * colours, a swoosh, pinstripe, dark tips), the seams and the cell openings, lights the
 * coated ripstop (wrapped diffuse, satin sheen) and lets the sun through: seen from below
 * the wing glows with the colours of both skins, the ribs, seams and diagonal tapes inside
 * drawn as darker lines.
 */
import * as THREE from 'three';
import { BASIS_COLS, BASIS_LEVELS, BASIS_ROWS, DYN_N, HALF_SPAN, N_CELLS, SHEET_NC, SHEET_NU, WING_GLSL, newDeform, ribA, wingPoint } from './glider-shape';

export interface WingRes {
  /** Cells drawn (50 = every real cell) and columns per cell, points around the profile. */
  cells: number;
  seg: number;
  prof: number;
  balloon: boolean;
  /** The fabric's wrinkles in the fragment shader (line tabs, brake tabs, slack fabric). */
  wrinkles: boolean;
  /**
   * The near tier (the camera within NEAR_DIST: the pilot's own wing): rows packed at the line
   * tabs, the trailing edge and the nose (nearRows), the wrinkles' coarser part as geometry
   * (glider-shape.ts wrinkleG), the cell openings as holes.
   */
  near?: boolean;
}

/** The near tier within this distance of the camera (m): the pilot's view, the closest chase. */
export const NEAR_DIST = 14;
export const WING_NEAR: WingRes = { cells: N_CELLS, seg: 5, prof: 0, balloon: true, wrinkles: true, near: true };
export const WING_HIGH: WingRes = { cells: N_CELLS, seg: 4, prof: 41, balloon: true, wrinkles: true };
/** Phones: the cells' shape and motion, not the wrinkles (a fullscreen wing's pixels are the cost there). */
export const WING_PHONE: WingRes = { cells: N_CELLS, seg: 2, prof: 29, balloon: true, wrinkles: false };
export const WING_LOW: WingRes = { cells: 20, seg: 1, prof: 15, balloon: false, wrinkles: false };
export const WING_MIN: WingRes = { cells: 10, seg: 1, prof: 9, balloon: false, wrinkles: false };

const cache = new Map<string, THREE.BufferGeometry>();

/**
 * Profile rows of the near tier (tw, lower trailing edge … nose … upper trailing edge): ~3 cm
 * apart (at the root chord) round the A, B and C tabs of the lower skin, 4–5 cm at the
 * trailing edge, uniform in tw round the nose, 10–13 cm elsewhere: where the fabric's shape
 * changes over a few centimetres, not everywhere.
 */
export function nearRows(): number[] {
  const C0 = 2.65;
  const spacing = (c: number, upper: boolean): number => {
    let sp = upper ? 0.13 : 0.1;
    if (c > 0.78) sp = Math.min(sp, 0.04 + (1 - c) * 0.25);
    if (!upper) for (const t of [0.11, 0.37, 0.66]) sp = Math.min(sp, 0.03 + 0.6 * Math.max(0, Math.abs(c - t) * C0 - 0.03));
    return sp;
  };
  const skin = (upper: boolean): number[] => {
    const out: number[] = [];
    for (let c = 1; c > 0.045; c -= spacing(c, upper) / C0) out.push(Math.sqrt(c));
    return out;
  };
  const nose = [0.16, 0.12, 0.08, 0.04];
  const lower = skin(false).map((t) => -t);
  const upper = skin(true).reverse();
  return [...lower, ...nose.map((t) => -t), 0, ...nose.slice().reverse(), ...upper];
}

/** Rest geometry of the canopy at a resolution (shared by every glider). */
export function wingGeometry(r: WingRes): THREE.BufferGeometry {
  const key = `${r.cells}/${r.seg}/${r.prof}/${r.balloon}/${!!r.near}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const half = r.cells / 2;
  const ribs: number[] = [];
  for (let i = 0; i <= r.cells; i++) {
    const k = ((i - half) / half) * (N_CELLS / 2);
    ribs.push(Math.sign(k) * ribA(Math.abs(k)));
  }
  const tws: number[] = [];
  if (r.near) tws.push(...nearRows());
  else for (let j = 0; j < r.prof; j++) tws.push(Math.sin((Math.PI * (-1 + (2 * j) / (r.prof - 1))) / 2));
  const P = tws.length;
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
varying float vSoft;
varying float vCh;
varying float vKr;
varying float vWr;
${WING_GLSL}
void main() {
  float a = aP.x;
  float tw = aP.y;
  float v = aP.z;
  float w = aP.w;
  float kind = aK.x;
  float cw = aK.y;
  wFoldWeight = 0.0;
  wSoft = 0.0;
  wWrinkle = 0.0;
  vec3 P = wingPos(a, tw, v, w, kind, cw);
  vFold = wFoldWeight;
  vSoft = wSoft;
  vWr = wWrinkle;
  vCh = chordAt(a);
  vKr = asin(min(abs(a) * ${Math.sin(0.942).toFixed(6)}, 1.0)) / 0.942 * ${(N_CELLS / 2).toFixed(1)};
  vec3 n;
#ifdef NEAR
  // (Steps short of the wrinkles' size: the normal of the displaced surface itself.)
  float dt = 0.008;
  float dv = 0.06;
#else
  float dt = 0.02;
  float dv = 0.15;
#endif
  float st = tw + dt <= 1.0 ? 1.0 : -1.0;
  if (kind < 0.5) {
    // Finite differences across the cell (one-sided at the ribs: sharp creases) and along the profile.
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
uniform vec4 uBrake;
uniform vec4 uAir;
varying vec4 vP;
varying float vKind;
varying vec3 vN;
varying vec3 vView;
varying float vFold;
varying float vSoft;
varying float vCh;
varying float vKr;
varying float vWr;
#include <common>
#include <lights_pars_begin>

/**
 * What the tension does to the fabric, as a height (m) along the skin's normal, drawn by
 * perturbing the normal (no vertex could carry wrinkles a few centimetres apart). A membrane
 * pulled at a point wrinkles along the pull and buckles across it (tension-field theory):
 * - under every line tab of the lower skin (A, B, C rows on every second rib) a small cone
 *   pulled down towards the line and creases running from it along the diagonal tapes inside
 *   (towards the neighbouring ribs) and along the rib, deeper with the load;
 * - at the brake tabs on the trailing edge a fan of creases running forwards, with the brake;
 * - where the cells lose their pressure (a collapse, a frontal, the take-off) and on a folded
 *   part, the slack fabric crumples, and shivers.
 * kr: position in ribs from the centre; cv: position across the cell.
 */
// Smooth bumps with compact support (cheaper than exp): 1 at 0, 0 beyond w.
float bump2(float x2, float w2) {
  float t = max(0.0, 1.0 - x2 / w2);
  return t * t;
}
float fabricH(float a, float c, bool upper, float kr, float kind, float pm) {
  float ch = vCh;
  float cw = ${(HALF_SPAN * 0.942 / ((N_CELLS / 2) * Math.sin(0.942))).toFixed(6)} * cos(${(0.942 / (N_CELLS / 2)).toFixed(6)} * kr);
  float h = 0.0;
  float load = clamp(uAir.x, 0.0, 2.5);
  float sl = max(vSoft, vFold);
  if (!upper && kind < 0.5 && kr < 24.0) {
    float dx = (kr - (2.0 * floor(kr * 0.5) + 1.0)) * cw;
    float d1 = c - 0.11;
    float d2 = c - 0.37;
    float d3 = c - 0.66;
    float dc = abs(d1) < abs(d2) ? d1 : d2;
    dc = abs(d3) < abs(dc) ? d3 : dc;
    vec2 q = vec2(dx, dc * ch * 0.75);
    float r2 = dot(q, q);
    if (r2 < 0.12) {
      // Ridges along rays from the tab: the diagonals (one cell across, ~0.1 chord along) and the rib.
      vec2 dg = normalize(vec2(cw, 0.1 * ch));
      vec2 aq = abs(q);
      float along = dot(aq, dg);
      float perp = dg.x * aq.y - dg.y * aq.x;
      float rid = bump2(perp * perp, 0.00025) * smoothstep(0.01, 0.035, along) * bump2(along * along, 0.11);
      rid += 0.7 * bump2(q.x * q.x, 0.00016) * smoothstep(0.01, 0.03, aq.y) * bump2(aq.y * aq.y, 0.07);
      h += load * (1.0 - sl) * (0.0022 * rid - 0.005 * bump2(r2, 0.006));
    }
  }
  float br = a < 0.0 ? uBrake.x : uBrake.y;
  if (br > 0.01 && c > 0.35 && kind < 0.5) {
    float dx = (kr - 2.0 * floor(kr * 0.5 + 0.5)) * cw;
    float dy = (1.0 - c) * ch;
    float r = length(vec2(dx, dy));
    float th = atan(dx, dy + 0.03);
    h += br * 0.006 * sin(6.0 * th) * smoothstep(0.02, 0.15, r) * bump2(r * r, 2.0);
  }
  if (sl > 0.01) {
    float X = a * ${HALF_SPAN.toFixed(2)};
    float Y = c * ch;
    float t = uBrake.w;
    // Each octave faded out before it is finer than ~4 pixels (no glitter on a far or grazing fold).
    float o1 = 1.0 - smoothstep(0.08, 0.25, pm * 7.0);
    float o2 = 1.0 - smoothstep(0.08, 0.25, pm * 17.0);
    h += sl * 0.004 * (o1 * sin(X * 41.0 + Y * 13.0 + 2.0 * sin(Y * 23.0 + t * 2.1)) * sin(Y * 37.0 - X * 17.0 + t * 1.3) + o2 * 0.45 * sin(X * 83.0 - Y * 61.0 + t * 3.7));
  }
  return h;
}

/** The normal of the surface displaced by a height h (Mikkelsen's surface gradient, from screen derivatives). */
vec3 bumped(vec3 N, vec3 p, float h) {
  vec3 sx = dFdx(p);
  vec3 sy = dFdy(p);
  vec3 r1 = cross(sy, N);
  vec3 r2 = cross(N, sx);
  float det = dot(sx, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * N - g);
}

// Anti-aliased step at 0 and band of half width h around 0 (fades out below a pixel), given
// the derivative's width fw (shared: the bands along the chord all take fwidth(c), those
// along the span fwidth(|a|); a dozen fwidth and divisions fewer per pixel).
float edgeW(float d, float fw) {
  return clamp(d / fw + 0.5, 0.0, 1.0);
}
float bandW(float d, float h, float fw) {
  return clamp((h + 0.5 * fw - abs(d)) / fw, 0.0, 1.0) * min(1.0, 2.0 * h / fw);
}
vec3 designUpper(float al, float c, float fc, float fa) {
  vec3 col = uMain;
  float b1 = 0.95 - 0.78 * pow(al, 1.35);
  float b2 = b1 + 0.17 - 0.05 * al;
  float fb = fc + fa;
  col = mix(col, uSecond, edgeW(c - b1, fb) * edgeW(b2 - c, fb));
  col = mix(col, uAccent, bandW(c - (b2 + 0.035), 0.009, fb));
  col = mix(col, uSecond, edgeW(0.05 - c, fc));
  col = mix(col, uAccent, edgeW(al - (0.935 + 0.03 * c), fa + 0.03 * fc));
  return col;
}
vec3 designLower(float al, float c, float fc, float fa) {
  vec3 col = uUnder;
  col = mix(col, uMain, edgeW(0.1 - c, fc));
  col = mix(col, uMain, edgeW(al - (0.72 + 0.1 * c), fa + 0.1 * fc));
  col = mix(col, uAccent, edgeW(al - 0.965, fa));
  return col;
}

void main() {
  float a = vP.x;
  float al = abs(a);
  float tw = vP.y;
  float c = tw * tw;
  bool upper = tw >= 0.0;
  // Cells from the layout of the ribs (the same at every level of detail; interpolated from the vertices).
  float kr = vKr;
  float cell = floor(kr);
  float cv = kr - cell;
  float rd = min(cv, 1.0 - cv);
  float fc = fwidth(c) + 1e-6;
  float fa = fwidth(al) + 1e-6;
  float fr = fwidth(kr) + 1e-6;
  vec3 colUp = designUpper(al, c, fc, fa);
  vec3 colLo = designLower(al, c, fc, fa);
  vec3 albedo = upper ? colUp : colLo;
  // Stabilo: the main colour, a dark band along its lower edge.
  if (vKind > 1.5) albedo = mix(uMain, uAccent, smoothstep(0.55, 0.7, vP.w));
  // Seams: along the ribs, across the panels.
  float seam = bandW(rd, 0.012, fr);
  if (upper) seam = max(seam, max(bandW(c - 0.05, 0.003, fc), max(bandW(c - 0.33, 0.002, fc), bandW(c - 0.62, 0.002, fc))));
  else seam = max(seam, max(bandW(c - 0.1, 0.003, fc), bandW(c - 0.5, 0.002, fc)));
  if (vKind > 0.5) seam = 0.0;
  albedo *= 1.0 - 0.3 * seam;
  // Cell openings under the nose (closed at the tips), with their reinforced lip.
  float open = 0.0;
  if (!upper && al < 0.86 && vKind < 0.5) {
    vec2 q = vec2((cv - 0.5) / 0.37, (-tw - 0.115) / 0.085);
    q *= q;
    float sd = sqrt(sqrt(q.x * q.x + q.y * q.y)) - 1.0;
    float fs = fwidth(sd) + 1e-4;
    // (Shut on a folded part, pinched on empty cells: the lips pressed together.)
    open = clamp(-sd / fs + 0.5, 0.0, 1.0) * (1.0 - vFold) * (1.0 - 0.7 * vSoft);
    albedo *= 1.0 - 0.35 * bandW(sd, 0.09, fs) * (1.0 - open);
  }

  vec3 N = normalize(vN);
  vec3 V = normalize(vView);
  if (vKind < 0.5) {
    if (!gl_FrontFacing) N = -N;
  } else if (dot(N, V) < 0.0) N = -N;
  // The fabric's wrinkles, faded out where a cell is only a few pixels wide (the screen
  // derivatives taken here, outside any branch: metres per pixel along the span and the chord).
#if defined(NEAR)
  // The near mesh carries the wrinkles (glider-shape.ts wrinkleG), its normals those of the
  // displaced surface: nothing per pixel but their shade in the creases.
  float fh = vWr;
#elif defined(NO_WRINKLES)
  float fh = 0.0;
#else
  float fine = 1.0 - smoothstep(0.06, 0.25, fr);
  float pm = max(fwidth(a * ${HALF_SPAN.toFixed(2)}), fwidth(c * vCh));
  float fh = fine > 0.0 ? fabricH(a, c, upper, kr, vKind, pm) * fine : 0.0;
  N = bumped(N, -vView, fh);
#endif
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
  // Creases: more fabric across the light, a little shade in the folds.
  float crease = 1.0 - clamp(abs(fh) * 55.0, 0.0, 0.35);
  float ao = (0.76 + 0.24 * smoothstep(0.0, 0.3, rd)) * (0.85 + 0.15 * crease);
  vec3 col = albedo * RECIPROCAL_PI * (sunC * diff + hemi * ao);
  // Satin sheen of the coated ripstop.
  vec3 Hv = normalize(L + V);
  float spec = pow(max(dot(N, Hv), 0.0), 32.0) * 0.07 * smoothstep(0.0, 0.25, ndl) * shade;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.05;
  col += sunC * spec + hemi * rim;
  // Light through both skins, the structure inside darker.
  float x = mod(cell, 2.0) > 0.5 ? cv : 1.0 - cv;
  float fd = fc + 0.12 * fr;
  float diag = max(max(bandW(c - (0.11 + 0.1 * x), 0.004, fd), bandW(c - (0.37 - 0.12 * x), 0.004, fd)), max(bandW(c - (0.37 + 0.1 * x), 0.004, fd), bandW(c - (0.66 - 0.12 * x), 0.004, fd)));
  // Thicker light path near the ribs, the cell glowing most in its middle.
  float tShade = (0.3 + 0.7 * smoothstep(0.0, 0.06, rd)) * (0.72 + 0.28 * sin(PI * cv)) * (1.0 - 0.22 * diag) * (1.0 - 0.5 * seam) * crease;
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

/**
 * The cloth simulation's offsets (public/data/canopy-basis.bin, scripts/blender/canopy-sim.py):
 * loaded once in the background, shared by every glider, off until it is there (and where it
 * cannot load). A texture of BASIS_COLS × (BASIS_ROWS × levels) texels, the offsets in RGB
 * (signed bytes + 128), a scale per level.
 */
const basis = {
  uBasis: { value: new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) as THREE.Texture },
  uBasisScale: { value: new THREE.Vector4() },
  uBasisOn: { value: 0 },
};
basis.uBasis.value.needsUpdate = true;
let basisAsked = false;

/** Reads the basis file; null when it does not match the grid this build expects. */
export function parseBasis(buf: ArrayBuffer): { tex: THREE.DataTexture; scale: number[] } | null {
  const dv = new DataView(buf);
  if (buf.byteLength < 12 || dv.getUint32(0, false) !== 0x434e4231) return null;
  const cols = dv.getUint16(4, true);
  const rows = dv.getUint16(6, true);
  const levels = dv.getUint16(8, true);
  if (cols !== BASIS_COLS || rows !== BASIS_ROWS || levels !== BASIS_LEVELS.length) return null;
  const scale: number[] = [];
  for (let l = 0; l < levels; l++) {
    if (Math.abs(dv.getFloat32(12 + 4 * l, true) - BASIS_LEVELS[l]) > 1e-3) return null;
    scale.push(dv.getFloat32(12 + 4 * (levels + l), true));
  }
  const o = 12 + 8 * levels;
  if (buf.byteLength < o + levels * cols * rows * 3) return null;
  const src = new Int8Array(buf, o, levels * cols * rows * 3);
  const px = new Uint8Array(cols * rows * levels * 4);
  for (let l = 0; l < levels; l++)
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const s = ((l * cols + i) * rows + j) * 3;
        const t = ((l * rows + j) * cols + i) * 4;
        px[t] = src[s] + 128;
        px[t + 1] = src[s + 1] + 128;
        px[t + 2] = src[s + 2] + 128;
        px[t + 3] = 255;
      }
  const tex = new THREE.DataTexture(px, cols, rows * levels, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { tex, scale };
}

function loadBasis(): void {
  if (basisAsked || typeof document === 'undefined' || typeof fetch === 'undefined') return;
  basisAsked = true;
  fetch(new URL('data/canopy-basis.bin', document.baseURI).href)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((buf) => {
      const b = buf ? parseBasis(buf) : null;
      if (!b) return;
      basis.uBasis.value = b.tex;
      basis.uBasisScale.value.fromArray(b.scale);
      basis.uBasisOn.value = 1;
    })
    .catch(() => {});
}

/** A glider's cloth texture: SHEET_NU × (SHEET_NC × 4) texels of four floats (WingDeform.sheet), read with nearest filtering. */
function sheetTexture(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Float32Array(SHEET_NU * SHEET_NC * 4 * 4), SHEET_NU, SHEET_NC * 4, THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Uniforms shared by the levels of detail of one glider. */
export interface WingUniforms {
  uBrake: { value: THREE.Vector4 };
  uFoldL: { value: THREE.Vector4 };
  uFoldR: { value: THREE.Vector4 };
  uMisc: { value: THREE.Vector4 };
  uInfl: { value: THREE.Vector4 };
  uUp: { value: THREE.Vector3 };
  /** The canopy's own motion per span station (WingDeform.dyn). */
  uDyn: { value: Float32Array };
  /** The fabric's state per span station (WingDeform.fab) and the air (WingDeform.air). */
  uFab: { value: Float32Array };
  uAir: { value: THREE.Vector4 };
  /** The folded parts' cloth (WingDeform.sheet as a float texture) and which side draws it (WingDeform.cloth). */
  uSheet: { value: THREE.DataTexture };
  uCloth: { value: THREE.Vector4 };
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
    uDyn: { value: new Float32Array(DYN_N * 4) },
    uFab: { value: newDeform().fab },
    uAir: { value: new THREE.Vector4(1, 0, 0, 0) },
    uSheet: { value: sheetTexture() },
    uCloth: { value: new THREE.Vector4() },
    uMain: { value: new THREE.Color(colors.main) },
    uSecond: { value: new THREE.Color(colors.stripe) },
    uAccent: { value: new THREE.Color(colors.accent ?? 0x23262e) },
    uUnder: { value: new THREE.Color(colors.under) },
    uTrans: { value: 0.32 },
  };
}

export function wingMaterial(u: WingUniforms, balloon: boolean, wrinkles = false, near = false): THREE.ShaderMaterial {
  const defines: Record<string, string> = {};
  if (near) defines.NEAR = '';
  // (Far away: no cloth, the analytic fold as before.)
  if (!balloon) {
    defines.NO_BALLOON = '';
    defines.NO_CLOTH = '';
  }
  if (!wrinkles) defines.NO_WRINKLES = '';
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    lights: true,
    side: THREE.DoubleSide,
    defines,
  });
  // Shared objects: one write per frame updates every level (the basis: every glider).
  Object.assign(m.uniforms, u, basis);
  loadBasis();
  return m;
}
