/**
 * Build-time geometry of the pilot and his gear, posed by glider-pilot.ts: a cocoon harness
 * (speedbag pod with its cockpit and instrument, seat shell over the foam back protector,
 * rear fairing, chest strap and carabiners, reserve handle), the pilot (jacket, open-face
 * helmet and sunglasses, thin gloves closed round the brake handles, trousers and boots),
 * the risers' hardware and a one-mesh pilot for the distant levels of detail. Built once and
 * shared by every glider; colour and roughness are per vertex (one material), so each posed
 * part is one draw.
 *
 * Frames: glider frame (x right, y up, z back, carabiners at the origin); torso frame
 * (origin between the hip joints, +y along the spine, −z the front), placed in the glider
 * frame by the pose (hip position, recline about x).
 *
 * The body is a 1.70 m pilot (segment lengths as fractions of the height after D. A. Winter,
 * Biomechanics and Motor Control of Human Movement: upper arm 0.186 H, forearm 0.146 H,
 * thigh 0.245 H, shank 0.246 H) posed so that its eyes are the first-person camera's
 * (world.ts EYE and EYE_STANDING); hands 19 cm long and 8.5 cm wide. The harness follows the
 * Advance Lightness 3 and Woody Valley pods: 40–48 cm of chest strap between the carabiners,
 * the seat 45–53 cm under them along the back (X-Rated 7: 47–53.5 cm), a reclined seat, the
 * legs in a speedbag to a foot plate, the cockpit on the speedbag over the knees. Postures
 * checked against photos of pilots in pods (Advance Impress 4 and Lightness 3, AirDesign
 * Sock, Neo Suspender, Supair Evo Lite 2 and Strike 2 on the take-off, Woody Valley Race),
 * embedded views and Ozone's glove sizes.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Geo = THREE.BufferGeometry;
export type V3 = readonly [number, number, number];

// ---------------------------------------------------------------------------------------
// Body and poses.

export const BODY = {
  /** Hip joints to the base of the neck along the spine; half the hip joints' spacing. */
  torso: 0.55,
  hipHalf: 0.085,
  thigh: 0.42,
  shin: 0.42,
  /** Ankle joint above the sole. */
  ankle: 0.066,
  upperArm: 0.31,
  forearm: 0.25,
  /** Wrist to the middle of the fist along the hand (the handle's grip, GRIP below). */
  grip: 0.0812,
} as const;

/** Base of the neck and the shoulder joints in the torso frame. */
export const NECK_T: V3 = [0, BODY.torso, 0.03];
export const SHOULDER_T: V3 = [0.185, 0.47, 0.035];
/** Eyes from the base of the neck, head upright: ~11 cm above it, ~7 cm in front of its axis. */
export const EYE_NECK: V3 = [0, 0.11, -0.07];
/** First-person eyes in the glider frame (world.ts EYE, EYE_STANDING): the body is posed around them. */
export const EYE_SEATED: V3 = [0, 0.32, 0.34];
export const EYE_STANDING: V3 = [0, 0.43, 0.03];
/**
 * Torso recline (rad, + = lying back) and head pitch (+ = tilted back): in the pod (the back
 * ~35° from the vertical, the head nearly upright, looking ahead: photos of pod harnesses in
 * flight), and standing on the take-off, leaning a little forward.
 */
export const SEATED = { recline: 0.61, head: 0.12 } as const;
export const STANDING = { recline: -0.21, head: -0.09 } as const;
/** Soles under the carabiners when standing (engine.ts keeps the carabiners 1.1 m above the ground). */
export const FEET_Y = -1.1;
/** Front of the seat, where the speedbag hangs from (torso frame), and the root of the rear fairing. */
export const POD_HINGE_T: V3 = [0, -0.06, -0.1];
export const FAIRING_HINGE_T: V3 = [0, -0.16, 0.2];

/**
 * Hip joints' midpoint (glider frame) of a pose: the body hangs so that its eyes are at
 * (0, eyeY, eyeZ) with this recline and head pitch.
 */
export function hipFor(eyeY: number, eyeZ: number, recline: number, head: number, out: THREE.Vector3): THREE.Vector3 {
  const c = Math.cos(recline);
  const s = Math.sin(recline);
  const ch = Math.cos(head);
  const sh = Math.sin(head);
  const ny = NECK_T[1] * c - NECK_T[2] * s;
  const nz = NECK_T[1] * s + NECK_T[2] * c;
  const ey = EYE_NECK[1] * ch - EYE_NECK[2] * sh;
  const ez = EYE_NECK[1] * sh + EYE_NECK[2] * ch;
  return out.set(0, eyeY - ny - ey, eyeZ - nz - ez);
}

/** A torso-frame point in the glider frame for a pose (hip, recline). */
export function torsoToGlider(p: V3 | THREE.Vector3, hip: THREE.Vector3, recline: number, out: THREE.Vector3): THREE.Vector3 {
  const x = 'x' in p ? p.x : p[0];
  const y = 'y' in p ? p.y : p[1];
  const z = 'z' in p ? p.z : p[2];
  const c = Math.cos(recline);
  const s = Math.sin(recline);
  return out.set(hip.x + x, hip.y + y * c - z * s, hip.z + y * s + z * c);
}

const HIP0 = hipFor(EYE_SEATED[1], EYE_SEATED[2], SEATED.recline, SEATED.head, new THREE.Vector3());
/** The speedbag's hinge in the glider frame when seated (its geometry is built around it). */
export const POD_HINGE_SEATED = torsoToGlider(POD_HINGE_T, HIP0, SEATED.recline, new THREE.Vector3());

// ---------------------------------------------------------------------------------------
// Colours.

export const C = {
  jacket: 0x2f6aa3,
  jacketDark: 0x1f3550,
  zip: 0x15171b,
  collar: 0x1b2433,
  strap: 0x17191d,
  buckle: 0x8f969f,
  harness: 0x30343b,
  harnessDark: 0x1b1d21,
  harnessPanel: 0x6a727d,
  podTop: 0x5d6570,
  piping: 0xe0662c,
  cockpit: 0x1a1c20,
  helmet: 0xf0efe9,
  helmetStripe: 0xc8322b,
  helmetTrim: 0x2a2c31,
  lens: 0x101318,
  skin: 0xc99678,
  buff: 0x23272e,
  glove: 0x2b2f36,
  gloveLeather: 0x4a4038,
  gloveKnuckle: 0x353a42,
  gloveCuff: 0x17191c,
  gloveStrap: 0x30353d,
  toggle: 0xd3352a,
  metal: 0xb7bec7,
  anodised: 0x3b7fc4,
  trousers: 0x30333a,
  boot: 0x5a4231,
  sole: 0x1c1c1e,
  reserve: 0xf2b316,
  plastic: 0x16171b,
} as const;

/** Roughness of the coatings (a value under 0.15 marks a metal: see gearMaterial). */
export const R = { fabric: 0.86, coated: 0.62, skin: 0.6, gloss: 0.3, lens: 0.16, metal: 0.08, plastic: 0.5 } as const;

// ---------------------------------------------------------------------------------------
// Helpers (build time only).

const M4 = new THREE.Matrix4();
const COLOR = new THREE.Color();

/** One colour and roughness on every vertex (RGBA: the alpha is the roughness). */
function paint(g: Geo, hex: number, rough: number): Geo {
  const n = g.getAttribute('position').count;
  COLOR.setHex(hex);
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    col[i * 4] = COLOR.r;
    col[i * 4 + 1] = COLOR.g;
    col[i * 4 + 2] = COLOR.b;
    col[i * 4 + 3] = rough;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return g;
}

/** Prepares a part for merging: indexed, no uv, transformed, normals, painted (unless `hex` < 0 and it has its colours). */
export function finish(g: Geo, hex: number, rough: number, m?: THREE.Matrix4): Geo {
  for (const a of ['uv', 'uv1', 'uv2']) if (g.getAttribute(a)) g.deleteAttribute(a);
  if (!g.index) {
    const n = g.getAttribute('position').count;
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(i);
    g.setIndex(idx);
  }
  if (m) g.applyMatrix4(m);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (hex >= 0 || !g.getAttribute('color')) paint(g, Math.max(0, hex), rough);
  return g;
}

export function at(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}

function ellipsoid(rx: number, ry: number, rz: number, hex: number, rough: number, m: THREE.Matrix4, ws = 14, hs = 10): Geo {
  return finish(new THREE.SphereGeometry(1, ws, hs), hex, rough, m.clone().multiply(M4.makeScale(rx, ry, rz)));
}

/** A tapered limb along +y from 0 to `len`, rounded ends (the far one `endCap` × r1 long). */
function limb(r0: number, r1: number, len: number, hex: number, rough: number, segs = 14, endCap = 0.9): Geo {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r0), Math.sin(a) * r0 * 0.9));
  }
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    // A slight bulge in the first half (muscle, sleeve), tapering to the end.
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * t + 0.08 * r0 * Math.sin(Math.PI * t), len * t));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r1), len + Math.sin(a) * r1 * endCap));
  }
  return finish(new THREE.LatheGeometry(pts, segs), hex, rough);
}

/** A thin tube along a polyline (piping, seams, straps' edges). */
function tube(pts: [number, number, number][], r: number, hex: number, rough: number, radial = 5): Geo {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return finish(new THREE.TubeGeometry(curve, Math.max(6, pts.length * 3), r, radial, false), hex, rough);
}

export function merge(geos: Geo[]): Geo {
  const g = mergeGeometries(geos, false);
  if (!g) throw new Error('glider: geometry merge failed');
  return g;
}

/** The mirror image in x (left from right), its triangles turned back outwards. */
function mirrorX(g: Geo): Geo {
  const m = g.clone();
  m.applyMatrix4(M4.makeScale(-1, 1, 1));
  const idx = m.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  return m;
}

function blend(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).getHex();
}

export interface Sec {
  /** Position along the loft's axis and the section's centre across it. */
  z: number;
  y: number;
  /** Half-width; half-heights above and below the centre (below defaults to above). */
  w: number;
  ht: number;
  hb?: number;
  /** Superellipse exponent of this section (2 ellipse, larger boxier). */
  ex?: number;
}
type Paint = (x: number, y: number, z: number, u: number) => number;

/**
 * A closed surface through superelliptic sections along z (ring: +x, then +y, then −x…),
 * wound outwards, smooth normals, colour per vertex from its place (u: 0 → 1 round the ring,
 * the upper half 0..0.5).
 */
export function loft(secs: Sec[], ring: number, ex: number, paintFn: Paint, rough: number, caps: [boolean, boolean] = [true, true]): Geo {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const push = (x: number, y: number, z: number, u: number) => {
    pos.push(x, y, z);
    COLOR.setHex(paintFn(x, y, z, u));
    col.push(COLOR.r, COLOR.g, COLOR.b, rough);
  };
  for (const s of secs) {
    const e = s.ex ?? ex;
    for (let k = 0; k < ring; k++) {
      const t = (k / ring) * Math.PI * 2;
      const ct = Math.cos(t);
      const st = Math.sin(t);
      const x = s.w * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / e);
      const yy = Math.sign(st) * Math.pow(Math.abs(st), 2 / e);
      push(x, s.y + (yy >= 0 ? s.ht : (s.hb ?? s.ht)) * yy, s.z, k / ring);
    }
  }
  // Sides wound outwards whichever way the sections run along z.
  const forward = secs[secs.length - 1].z > secs[0].z;
  for (let i = 0; i < secs.length - 1; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * ring + k;
      const b = i * ring + ((k + 1) % ring);
      if (forward) idx.push(a, b, a + ring, b, b + ring, a + ring);
      else idx.push(a, a + ring, b, b, a + ring, b + ring);
    }
  }
  for (const end of [0, 1]) {
    if (!caps[end]) continue;
    const i = end === 0 ? 0 : secs.length - 1;
    const s = secs[i];
    const ci = pos.length / 3;
    push(0, s.y, s.z, 0);
    // The cap at the larger z faces +z, the other −z.
    const plusZ = (end === 1) === forward;
    for (let k = 0; k < ring; k++) {
      const a = i * ring + k;
      const b = i * ring + ((k + 1) % ring);
      if (plusZ) idx.push(ci, a, b);
      else idx.push(ci, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A loft's section interpolated at a position along its axis. */
const lerpSec = (secs: Sec[], z: number) => {
  let i = 0;
  const up = secs[secs.length - 1].z > secs[0].z;
  while (i < secs.length - 2 && (up ? z > secs[i + 1].z : z < secs[i + 1].z)) i++;
  const a = secs[i];
  const b = secs[i + 1];
  const t = Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z)));
  return { y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, ht: a.ht + (b.ht - a.ht) * t, hb: (a.hb ?? a.ht) + ((b.hb ?? b.ht) - (a.hb ?? a.ht)) * t };
};

/** A loft built along z with y the front offset, turned into the torso frame (z → +y, y → −z). */
function upright(g: Geo): Geo {
  g.applyMatrix4(M4.makeRotationX(-Math.PI / 2));
  return g;
}

// ---------------------------------------------------------------------------------------
// The one material: colour and roughness per vertex, metal under 0.15 of roughness.

let material: THREE.MeshStandardMaterial | null = null;
export function gearMaterial(): THREE.MeshStandardMaterial {
  if (material) return material;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vColor.rgb;')
      .replace('#include <roughnessmap_fragment>', 'float isMetal = 1.0 - step(0.15, vColor.a);\nfloat roughnessFactor = mix(vColor.a, 0.24 + vColor.a, isMetal);')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = 0.65 * isMetal;');
  };
  m.customProgramCacheKey = () => 'glider-gear';
  material = m;
  return m;
}

// ---------------------------------------------------------------------------------------
// The pilot.

/** Torso sections (z: height along the spine, y: front offset): jacket over a base layer. */
const TORSO: Sec[] = [
  { z: -0.12, y: -0.03, w: 0.135, ht: 0.085, hb: 0.1 },
  { z: -0.06, y: -0.025, w: 0.16, ht: 0.1, hb: 0.115 },
  { z: 0.02, y: -0.02, w: 0.166, ht: 0.105, hb: 0.115 },
  { z: 0.12, y: 0.0, w: 0.152, ht: 0.098, hb: 0.098 },
  { z: 0.22, y: 0.008, w: 0.158, ht: 0.106, hb: 0.098 },
  { z: 0.32, y: 0.012, w: 0.168, ht: 0.115, hb: 0.1 },
  { z: 0.4, y: 0.008, w: 0.178, ht: 0.114, hb: 0.104 },
  { z: 0.455, y: 0.0, w: 0.178, ht: 0.1, hb: 0.104 },
  { z: 0.495, y: -0.01, w: 0.152, ht: 0.084, hb: 0.095 },
  { z: 0.525, y: -0.02, w: 0.105, ht: 0.06, hb: 0.08 },
  { z: 0.548, y: -0.022, w: 0.072, ht: 0.05, hb: 0.064 },
  { z: 0.565, y: -0.022, w: 0.055, ht: 0.042, hb: 0.05 },
];

export function torsoGeometry(ring = 36): Geo {
  const g = loft(
    TORSO,
    ring,
    2.3,
    (x, _y, s, u) => {
      const ax = Math.abs(x);
      const front = u > 0.02 && u < 0.48;
      if (s < 0.03) return C.trousers;
      if (s > 0.535) return C.collar;
      if (front && ax < 0.007 && s > 0.05) return C.zip;
      if (ax > 0.128) return C.jacketDark;
      return s > 0.47 ? blend(C.jacket, C.jacketDark, 0.35) : C.jacket;
    },
    R.fabric,
  );
  upright(g);
  // Deltoids round the shoulders.
  const parts = [g, ...shoulderStraps()];
  for (const s of [-1, 1]) parts.push(ellipsoid(0.064, 0.07, 0.066, C.jacketDark, R.fabric, at(s * 0.178, SHOULDER_T[1] - 0.005, SHOULDER_T[2] - 0.005), 14, 10));
  return merge(parts);
}

/** A point of the torso's surface (loft coordinates: x, front offset, height) at lateral x, on its front or back. */
const SURF = [0, 0, 0];
function torsoSurface(x: number, s: number, front: boolean): number[] {
  const q = lerpSec(TORSO, s);
  const e = 2.3;
  const ct = Math.pow(Math.min(1, Math.abs(x) / q.w), e / 2);
  const yy = Math.pow(Math.sqrt(Math.max(0, 1 - ct * ct)), 2 / e);
  SURF[0] = x;
  SURF[1] = front ? q.y + q.ht * yy : q.y - q.hb * yy;
  SURF[2] = s;
  return SURF;
}
/** The harness's shoulder straps: where they leave the chest (torso frame), towards the carabiners. */
const STRAP_X = 0.075;
const STRAP_S0 = 0.22;
export const STRAP_CHEST_T: V3 = [STRAP_X, STRAP_S0, -(torsoSurface(STRAP_X, STRAP_S0, true)[1] + 0.0045)];

/** Webbing lying on the jacket (torso frame): up the chest, over the shoulder, down the back. */
function shoulderStraps(): Geo[] {
  const out: Geo[] = [];
  const hw = 0.016;
  const path: [number, boolean][] = [
    [STRAP_S0, true],
    [0.28, true],
    [0.34, true],
    [0.4, true],
    [0.45, true],
    [0.49, true],
    [0.515, true],
    [0.534, true],
    [0.515, false],
    [0.49, false],
    [0.45, false],
    [0.4, false],
    [0.35, false],
  ];
  for (const sd of [-1, 1]) {
    const pos: number[] = [];
    const idx: number[] = [];
    path.forEach(([s, front], i) => {
      for (const e of [-hw, hw]) {
        const x = sd * STRAP_X + e;
        const p = torsoSurface(x, s, front);
        const y = p[1] + (front ? 0.0045 : -0.0045);
        // Loft coordinates → torso frame: (x, y, z) → (x, z, −y); over the top a little above.
        pos.push(x, s + (i === 7 ? 0.005 : 0), -y);
      }
      if (i > 0) {
        const a = (i - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    out.push(finish(g, C.strap, R.fabric));
  }
  return out;
}

/**
 * Head group (origin at the base of the neck, +y up the neck, −z the face): neck in a buff,
 * face, an open-face helmet (EN 966 shell over the ears and the nape), wrap-around
 * sunglasses, chin strap.
 */
export function headGeometry(detail = 1): Geo {
  const parts: Geo[] = [];
  parts.push(finish(new THREE.CylinderGeometry(0.05, 0.054, 0.11, Math.round(14 * detail), 1, true), C.buff, R.fabric, at(0, 0.035, 0.008)));
  parts.push(ellipsoid(0.072, 0.097, 0.092, C.skin, R.skin, at(0, 0.125, -0.004), Math.round(16 * detail), Math.round(12 * detail)));
  parts.push(ellipsoid(0.012, 0.019, 0.015, C.skin, R.skin, at(0, 0.097, -0.096, -0.2), 8, 6));
  // Shell: a cap tilted back so that the face stays open, a dark trim along its rim, a stripe.
  const shell = new THREE.SphereGeometry(1, Math.round(24 * detail), Math.round(12 * detail), 0, Math.PI * 2, 0, Math.PI * 0.6);
  const p = shell.getAttribute('position');
  COLOR.setHex(C.helmet);
  const col = new Float32Array(p.count * 4);
  const cs = new THREE.Color(C.helmetStripe);
  const ct = new THREE.Color(C.helmetTrim);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const x = p.getX(i);
    const c = y < Math.cos(Math.PI * 0.56) ? ct : Math.abs(x) < 0.16 && y > -0.1 ? cs : COLOR;
    col.set([c.r, c.g, c.b, R.gloss], i * 4);
  }
  shell.setAttribute('color', new THREE.BufferAttribute(col, 4));
  parts.push(finish(shell, -1, R.gloss, at(0, 0.142, 0.014, 0.42, 0, 0, 0.122, 0.128, 0.15)));
  // Sunglasses: a lens band wrapped round the face ~1.4 cm in front of it, temple to temple.
  const lens: number[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = -1.2 + (2.4 * i) / n;
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const r = 1 / Math.hypot(sa / 0.071, ca / 0.0905) + 0.014 - 0.006 * a * a;
    lens.push(sa * r, 0.094, -0.004 - ca * r, sa * r, 0.126, -0.004 - ca * r);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lens, 3));
  const li: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    li.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  lg.setIndex(li);
  parts.push(finish(lg, C.lens, R.lens));
  for (const s of [-1, 1])
    parts.push(
      tube(
        [
          [s * 0.07, 0.085, 0.012],
          [s * 0.058, 0.04, -0.03],
          [s * 0.025, 0.02, -0.06],
          [0, 0.017, -0.066],
        ],
        0.0035,
        C.strap,
        R.fabric,
        4,
      ),
    );
  return merge(parts);
}

export function upperArmGeometry(): Geo {
  return limb(0.054, 0.043, BODY.upperArm, C.jacket, R.fabric, 16);
}
/** The sleeve narrows to the wrist and ends flat there, inside the glove's cuff. */
export function forearmGeometry(): Geo {
  return limb(0.044, 0.031, BODY.forearm, C.jacket, R.fabric, 16, 0.2);
}

// ---------------------------------------------------------------------------------------
// The gloved hands.

/**
 * The fist's skeleton (left hand: origin at the wrist joint, +y along the hand, +z its back,
 * +x the thumb's side): a hand 19 cm long and 8.5 cm wide in a glove ~3 mm thick (Ozone Air
 * M/L: hands 19–20 cm long, 22–24 cm round), closed round the brake handle. Each finger: its
 * knuckle (MCP joint) across the top of the palm, its phalanges (m) and the flexion of its
 * three joints (deg): curled round a ~1.9 cm grip, the ring and little fingers the most, as
 * in a power grip; radii at the base and the tip, the glove included.
 */
export const FINGERS = [
  { x: 0.027, y: 0.096, r0: 0.0106, r1: 0.0091, len: [0.04, 0.025, 0.021], flex: [70, 86, 48] },
  { x: 0.008, y: 0.099, r0: 0.0108, r1: 0.0093, len: [0.045, 0.028, 0.022], flex: [74, 88, 50] },
  { x: -0.011, y: 0.096, r0: 0.0103, r1: 0.0088, len: [0.042, 0.027, 0.021], flex: [78, 88, 50] },
  { x: -0.029, y: 0.09, r0: 0.0093, r1: 0.008, len: [0.036, 0.022, 0.019], flex: [78, 82, 46] },
] as const;
/** The thumb from its base on the wrist to its tip, across the index and middle fingers; radii. */
const THUMB: V3[] = [
  [0.016, 0.018, -0.008],
  [0.037, 0.056, -0.03],
  [0.031, 0.071, -0.061],
  [0.009, 0.075, -0.066],
];
const THUMB_R = [0.0155, 0.0122, 0.0104, 0.0091];
/** The finger joints of a FINGERS entry (MCP, PIP, DIP, tip), in the glove frame. */
export function fingerJoints(f: (typeof FINGERS)[number]): THREE.Vector3[] {
  const out = [new THREE.Vector3(f.x, f.y, 0)];
  let phi = 0;
  for (let k = 0; k < 3; k++) {
    phi += (f.flex[k] * Math.PI) / 180;
    out.push(out[k].clone().add(new THREE.Vector3(0, f.len[k] * Math.cos(phi), -f.len[k] * Math.sin(phi))));
  }
  return out;
}
/**
 * The brake handle in the fist (glove frame): a rigid padded grip ~1.9 cm thick across the
 * palm under the fingers' first phalanges, its top on the thumb's side towards the line
 * (held like a stick, as on Advance's and Ozone's handles), a little lower under the little
 * finger; its axis at a given x.
 */
export const HANDLE_R = 0.0096;
const HANDLE_X: readonly [number, number] = [-0.058, 0.074];
export function handleAxis(x: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(x, 0.0812 + 0.1 * x, -0.0248 - 0.01 * x);
}
/** The grip's centre (the middle of the fist), and the swivel where the brake line leaves the handle (left glove frame). */
export const GRIP = handleAxis(0);
export const SWIVEL = handleAxis(HANDLE_X[1] + 0.024);

/**
 * A tube swept along a smooth path through `pts` (radius interpolated from point to point),
 * its start closed flat and its end rounded (a fingertip); `paint` gives each vertex its
 * colour index from its place along the path (t), its ring centre and its radial direction.
 */
function sweep(pts: V3[], radii: number[], segs: number, radial: number, paint: (t: number, c: THREE.Vector3, n: THREE.Vector3) => number, palette: readonly (readonly [number, number])[]): Geo {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
  const frames = curve.computeFrenetFrames(segs, false);
  // Radius at a parameter (by arc length): linear between the points' own parameters (the
  // curve passes through point i at t = i/(n−1)).
  const per = 24;
  const lens = curve.getLengths(per * (pts.length - 1));
  const at = pts.map((_, i) => lens[per * i] / lens[lens.length - 1]);
  const radius = (u: number) => {
    let i = 0;
    while (i < at.length - 2 && u > at[i + 1]) i++;
    const t = Math.min(1, Math.max(0, (u - at[i]) / Math.max(1e-6, at[i + 1] - at[i])));
    return radii[i] + (radii[i + 1] - radii[i]) * t;
  };
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const push = (p: THREE.Vector3, dir: THREE.Vector3, t: number) => {
    pos.push(p.x, p.y, p.z);
    const [hex, rough] = palette[paint(t, c, dir)];
    COLOR.setHex(hex);
    col.push(COLOR.r, COLOR.g, COLOR.b, rough);
  };
  const v = new THREE.Vector3();
  const ring = (centre: THREE.Vector3, N: THREE.Vector3, B: THREE.Vector3, r: number, t: number) => {
    c.copy(centre);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      n.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      push(v.copy(centre).addScaledVector(n, r), n, t);
    }
  };
  for (let i = 0; i <= segs; i++) ring(curve.getPointAt(i / segs), frames.normals[i], frames.binormals[i], radius(i / segs), i / segs);
  // Rounded end: rings closing over the last radius, then the tip.
  const end = curve.getPointAt(1);
  const T = frames.tangents[segs];
  const rEnd = radii[radii.length - 1];
  const caps = [0.5, 0.82];
  for (const s of caps) ring(v.copy(end).addScaledVector(T, rEnd * s).clone(), frames.normals[segs], frames.binormals[segs], rEnd * Math.sqrt(1 - s * s), 1);
  const rings = segs + 1 + caps.length;
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      idx.push(a, b, a + radial, b, b + radial, a + radial);
    }
  }
  const tip = pos.length / 3;
  c.copy(end);
  push(v.copy(end).addScaledVector(T, rEnd), T, 1);
  for (let j = 0; j < radial; j++) idx.push((rings - 1) * radial + j, (rings - 1) * radial + ((j + 1) % radial), tip);
  // Flat start (inside the palm).
  const base = pos.length / 3;
  c.copy(curve.getPointAt(0));
  push(c, v.copy(frames.tangents[0]).negate(), 0);
  for (let j = 0; j < radial; j++) idx.push(base, (j + 1) % radial, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A gloved fist closed round its brake handle (left hand; the right one is its mirror), in
 * the glove frame above. A thin glove: fabric back, leather palm and finger pads, the
 * index's side reinforced (line wear), a short cuff over the sleeve with its strap; the
 * fingers curled round the handle, the thumb over them. The handle (`handle`, default true):
 * red padded grip, black ends, the swivel the brake line is tied to.
 */
export function gloveGeometry(right: boolean, handle = true): Geo {
  // The fingers' palette: fabric, leather (colour, roughness).
  const P = [
    [C.glove, 0.82],
    [C.gloveLeather, 0.5],
  ] as const;
  const parts: Geo[] = [];
  const g0 = new THREE.Vector3();
  // Fingers: dorsal side fabric, the side towards the handle leather, the index's outer side leather too.
  FINGERS.forEach((f, i) => {
    const pts = fingerJoints(f).map((p) => [p.x, p.y, p.z] as [number, number, number]);
    parts.push(
      sweep(pts, [f.r0, f.r0 * 0.96, f.r1 * 1.02, f.r1], 9, 8, (_t, c, n) => {
        handleAxis(c.x, g0).sub(c);
        g0.x = 0;
        if (n.dot(g0.normalize()) > 0.3) return 1;
        if (i === 0 && n.x > 0.7) return 1;
        return 0;
      }, P),
    );
  });
  // Thumb: its pad (towards the fist) leather; the web between it and the index.
  const fistC = new THREE.Vector3(0.006, 0.086, -0.045);
  parts.push(sweep(THUMB, THUMB_R, 9, 8, (t, c, n) => (t > 0.3 && n.dot(g0.copy(fistC).sub(c).normalize()) > 0.2 ? 1 : 0), P));
  parts.push(ellipsoid(0.0105, 0.022, 0.011, C.glove, 0.82, at(0.032, 0.071, -0.013, 0.52), 10, 8));
  // Palm and back (a loft along the hand, built along z then stood up: loft y is the palm's side).
  const hand: Sec[] = [
    { z: 0.0, y: 0.0, w: 0.029, ht: 0.018, hb: 0.017 },
    { z: 0.022, y: 0.001, w: 0.034, ht: 0.022, hb: 0.0155 },
    { z: 0.045, y: 0.001, w: 0.04, ht: 0.023, hb: 0.0145 },
    { z: 0.062, y: 0.001, w: 0.0435, ht: 0.02, hb: 0.0145 },
    { z: 0.075, y: 0.001, w: 0.0452, ht: 0.0155, hb: 0.0145 },
    { z: 0.086, y: 0.0, w: 0.046, ht: 0.0135, hb: 0.015 },
    { z: 0.095, y: -0.001, w: 0.045, ht: 0.011, hb: 0.0135 },
    { z: 0.101, y: -0.002, w: 0.041, ht: 0.0075, hb: 0.0105 },
    { z: 0.105, y: -0.002, w: 0.032, ht: 0.004, hb: 0.006 },
    { z: 0.107, y: -0.002, w: 0.018, ht: 0.0015, hb: 0.002 },
  ];
  // Leather palm (smoother), fabric back with a knuckle panel.
  const back = loft(hand, 20, 2.6, (_x, y, s) => (y > lerpSec(hand, s).y + 0.004 ? C.gloveLeather : s > 0.084 ? C.gloveKnuckle : C.glove), 0.8);
  const bc = back.getAttribute('color');
  COLOR.setHex(C.gloveLeather);
  for (let i = 0; i < bc.count; i++) if (Math.abs(bc.getX(i) - COLOR.r) < 1e-6 && Math.abs(bc.getY(i) - COLOR.g) < 1e-6) bc.setW(i, 0.5);
  parts.push(upright(back));
  // Cuff: a short gauntlet over the sleeve, its strap across the back, narrowing into the hand.
  const cuff: Sec[] = [
    { z: -0.046, y: 0.0, w: 0.0355, ht: 0.0345 },
    { z: -0.044, y: 0.0, w: 0.0378, ht: 0.0366 },
    { z: -0.02, y: 0.0, w: 0.0364, ht: 0.0352 },
    { z: -0.004, y: 0.0, w: 0.0348, ht: 0.0334 },
    { z: 0.006, y: 0.0, w: 0.0334, ht: 0.0288 },
    { z: 0.016, y: 0.0, w: 0.0318, ht: 0.0215 },
  ];
  parts.push(upright(loft(cuff, 20, 2.2, (_x, y, s) => (s > -0.031 && s < -0.012 && y < -0.012 ? C.gloveStrap : C.gloveCuff), 0.8, [false, false])));
  if (handle) {
    // The handle along its axis: black ends, red padded grip; the swivel and its ring at the top.
    const a = handleAxis(HANDLE_X[0]);
    const b = handleAxis(HANDLE_X[1]);
    const d = b.clone().sub(a);
    const len = d.length();
    d.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    const grip = new THREE.CapsuleGeometry(HANDLE_R, len - 2 * HANDLE_R, 3, 12);
    const gp = grip.getAttribute('position');
    const gc = new Float32Array(gp.count * 4);
    const red = new THREE.Color(C.toggle);
    const blk = new THREE.Color(C.plastic);
    for (let i = 0; i < gp.count; i++) {
      // Along the handle from its bottom (−len/2) to its top (+len/2): black ends.
      const yy = gp.getY(i);
      const c = yy > len / 2 - 0.02 || yy < -len / 2 + 0.008 ? blk : red;
      gc.set([c.r, c.g, c.b, R.plastic], i * 4);
    }
    grip.setAttribute('color', new THREE.BufferAttribute(gc, 4));
    parts.push(finish(grip, -1, R.plastic, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))));
    parts.push(finish(new THREE.CylinderGeometry(0.0042, 0.0042, 0.012, 10), C.metal, R.metal, new THREE.Matrix4().compose(b.clone().addScaledVector(d, 0.009), q, new THREE.Vector3(1, 1, 1))));
    parts.push(finish(new THREE.TorusGeometry(0.005, 0.0012, 5, 10), C.metal, R.metal, new THREE.Matrix4().compose(b.clone().addScaledVector(d, 0.019), q, new THREE.Vector3(1, 1, 1))));
  }
  const g = merge(parts);
  return right ? mirrorX(g) : g;
}

export function thighGeometry(): Geo {
  return limb(0.074, 0.054, BODY.thigh, C.trousers, R.fabric, 14);
}
export function shinGeometry(): Geo {
  return limb(0.053, 0.04, BODY.shin, C.trousers, R.fabric, 14);
}

/** Boot: origin at the ankle joint, +y up the shin, −z to the toes (sole BODY.ankle below). */
export function bootGeometry(): Geo {
  const secs: Sec[] = [
    { z: 0.066, y: -0.034, w: 0.03, ht: 0.028, hb: 0.03 },
    { z: 0.052, y: -0.028, w: 0.044, ht: 0.06, hb: 0.038 },
    { z: 0.0, y: -0.028, w: 0.05, ht: 0.075, hb: 0.038 },
    { z: -0.07, y: -0.04, w: 0.053, ht: 0.05, hb: 0.026 },
    { z: -0.14, y: -0.046, w: 0.05, ht: 0.034, hb: 0.02 },
    { z: -0.188, y: -0.048, w: 0.04, ht: 0.022, hb: 0.018 },
    { z: -0.205, y: -0.049, w: 0.018, ht: 0.011, hb: 0.01 },
  ];
  const boot = loft(secs, 18, 2.6, (_x, y) => (y < -BODY.ankle + 0.012 ? C.sole : C.boot), 0.72);
  return merge([boot, finish(new THREE.CylinderGeometry(0.046, 0.05, 0.09, 14, 1, true), C.boot, 0.72, at(0, 0.03, 0.006))]);
}

// ---------------------------------------------------------------------------------------
// The harness.

/**
 * Seat shell (torso frame; z: height along the spine, y: front offset): the seat under the
 * buttocks and the thighs' roots, the foam back protector below it, the side panels up to
 * the armpits, the back panel to the shoulder blades.
 */
const SHELL: Sec[] = [
  { z: -0.285, y: -0.07, w: 0.08, ht: 0.05, hb: 0.06 },
  { z: -0.25, y: -0.06, w: 0.15, ht: 0.1, hb: 0.13 },
  { z: -0.19, y: -0.045, w: 0.19, ht: 0.15, hb: 0.17 },
  { z: -0.12, y: -0.035, w: 0.208, ht: 0.172, hb: 0.19 },
  { z: -0.04, y: -0.04, w: 0.212, ht: 0.145, hb: 0.18 },
  { z: 0.06, y: -0.05, w: 0.208, ht: 0.13, hb: 0.12 },
  { z: 0.18, y: -0.04, w: 0.2, ht: 0.11, hb: 0.115 },
  { z: 0.3, y: -0.055, w: 0.19, ht: 0.08, hb: 0.095 },
  { z: 0.42, y: -0.075, w: 0.17, ht: 0.06, hb: 0.08 },
  { z: 0.48, y: -0.09, w: 0.14, ht: 0.04, hb: 0.06 },
  { z: 0.52, y: -0.1, w: 0.08, ht: 0.03, hb: 0.04 },
  { z: 0.54, y: -0.1, w: 0.03, ht: 0.01, hb: 0.015 },
];

/** Piping along both sides of a loft at its widest, between two positions on its axis. */
function sidePiping(secs: Sec[], z0: number, z1: number, inset = 0.003): Geo[] {
  const out: Geo[] = [];
  for (const sd of [-1, 1]) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 14; i++) {
      const z = z0 + ((z1 - z0) * i) / 14;
      const q = lerpSec(secs, z);
      pts.push([sd * (q.w + inset), q.y, z]);
    }
    out.push(tube(pts, 0.0042, C.piping, R.plastic, 4));
  }
  return out;
}

export function shellGeometry(ring = 36): Geo {
  const shell = loft(
    SHELL,
    ring,
    2.5,
    (x, y, s) => {
      const q = lerpSec(SHELL, s);
      const ax = Math.abs(x) / Math.max(0.02, q.w);
      // Below the seat: the protector's darker, scuffed bottom; the sides lighter panels.
      if (s < -0.15) return blend(C.harness, C.harnessDark, (-0.15 - s) / 0.08);
      if (ax > 0.82 && s < 0.36) return C.harnessPanel;
      return y > q.y ? C.harness : blend(C.harness, C.harnessDark, 0.4);
    },
    R.coated,
  );
  const parts = [shell, ...sidePiping(SHELL, -0.2, 0.36, 0.002)].map((p) => upright(p));
  // Reserve handle on the right of the seat (torso frame).
  parts.push(finish(new THREE.BoxGeometry(0.03, 0.07, 0.035), C.reserve, R.plastic, at(0.215, 0.02, -0.06)));
  parts.push(finish(new THREE.TorusGeometry(0.018, 0.005, 5, 12), C.reserve, R.plastic, at(0.226, 0.06, -0.06, 0, Math.PI / 2, 0)));
  return merge(parts);
}

/**
 * Rear fairing, built in the glider frame of the seated pose (a wedge behind the reclined
 * back, its top from the shoulder blades to a tail ~0.6 m behind them), then carried into
 * its hinge's frame on the back of the seat.
 */
export function fairingGeometry(ring = 28, details = true): Geo {
  // (z, top, bottom, half-width): the top tucked under the back of the seat shell, then
  // nearly level from the shoulder blades and rounding down to the tail; the bottom rising
  // from the protector: a teardrop seen from the side.
  const S: [number, number, number, number][] = [
    [0.13, -0.42, -0.49, 0.14],
    [0.19, -0.3, -0.5, 0.168],
    [0.27, -0.15, -0.485, 0.18],
    [0.36, -0.02, -0.455, 0.178],
    [0.45, 0.045, -0.415, 0.17],
    [0.55, 0.05, -0.37, 0.158],
    [0.65, 0.035, -0.32, 0.138],
    [0.74, 0.005, -0.265, 0.11],
    [0.82, -0.035, -0.21, 0.077],
    [0.88, -0.07, -0.165, 0.045],
    [0.915, -0.1, -0.135, 0.02],
    [0.928, -0.115, -0.122, 0.006],
  ];
  const secs: Sec[] = S.map(([z, top, bot, w]) => ({ z, y: (top + bot) / 2, w, ht: (top - bot) / 2 }));
  const g = loft(secs, ring, 2.25, (_x, y, z, u) => {
    const q = lerpSec(secs, z);
    if (u > 0.08 && u < 0.42 && z > 0.42) return C.podTop;
    return y < q.y - 0.4 * q.ht ? C.harnessDark : C.harness;
  }, R.coated);
  const parts = details ? [g, ...sidePiping(secs, 0.3, 0.86, 0.001)] : [g];
  const out = merge(parts);
  // Seated glider frame → torso frame → the hinge's frame.
  out.applyMatrix4(M4.makeTranslation(-HIP0.x, -HIP0.y, -HIP0.z));
  out.applyMatrix4(M4.makeRotationX(-SEATED.recline));
  out.applyMatrix4(M4.makeTranslation(-FAIRING_HINGE_T[0], -FAIRING_HINGE_T[1], -FAIRING_HINGE_T[2]));
  return out;
}

/**
 * The speedbag (pod) round the legs, from under the seat to the foot plate, built in the
 * seated glider frame then carried to its hinge at the front of the seat; on top, over the
 * knees, the cockpit (a padded deck tilted towards the pilot) and the flight instrument.
 */
const POD: Sec[] = [
  { z: 0.04, y: -0.245, w: 0.17, ht: 0.085 },
  { z: -0.06, y: -0.232, w: 0.205, ht: 0.105, hb: 0.098 },
  { z: -0.18, y: -0.215, w: 0.212, ht: 0.115, hb: 0.098 },
  { z: -0.3, y: -0.2, w: 0.21, ht: 0.122, hb: 0.096 },
  { z: -0.42, y: -0.2, w: 0.205, ht: 0.12, hb: 0.1 },
  { z: -0.54, y: -0.228, w: 0.196, ht: 0.108, hb: 0.108 },
  { z: -0.66, y: -0.268, w: 0.185, ht: 0.1, hb: 0.118 },
  { z: -0.77, y: -0.293, w: 0.17, ht: 0.095, hb: 0.115 },
  { z: -0.86, y: -0.303, w: 0.146, ht: 0.085, hb: 0.1 },
  { z: -0.93, y: -0.308, w: 0.106, ht: 0.066, hb: 0.076 },
  { z: -0.975, y: -0.31, w: 0.056, ht: 0.036, hb: 0.041 },
  { z: -0.996, y: -0.31, w: 0.012, ht: 0.008, hb: 0.009 },
];
/**
 * Cockpit: a padded wedge on the speedbag over the knees (seated glider frame), its top
 * rising towards the front at ~39° so that it faces the reclined pilot's eyes.
 */
const DECK_Z0 = -0.315;
const DECK_SLOPE = 0.8;
const deckTop = (z: number) => -0.08 + (DECK_Z0 - z) * DECK_SLOPE;
const DECK_N = new THREE.Vector3(0, 1, DECK_SLOPE).normalize();
/** The instrument on the deck (seated glider frame): its screen (+z) along the deck's normal. */
export const INSTRUMENT_SEATED = at(0, deckTop(-0.4) + 0.013 * DECK_N.y, -0.4 + 0.013 * DECK_N.z, -Math.atan2(DECK_N.y, DECK_N.z));
const TO_POD = new THREE.Matrix4().makeTranslation(-POD_HINGE_SEATED.x, -POD_HINGE_SEATED.y, -POD_HINGE_SEATED.z);
/** Where the speed lines leave the pod (pod frame, right side). */
export const POD_SPEED_EXIT = new THREE.Vector3(0.175, -0.265, -0.7).applyMatrix4(TO_POD);

export function podGeometry(ring = 36, details = true): Geo {
  const pod = loft(
    POD,
    ring,
    2.4,
    (x, y, z) => {
      const q = lerpSec(POD, z);
      const up = (y - q.y) / Math.max(0.03, q.ht);
      if (up > 0.55 && Math.abs(x) < 0.82 * q.w) return C.podTop;
      return up < -0.45 ? C.harnessDark : C.harness;
    },
    R.coated,
  );
  const parts = details ? [pod, ...sidePiping(POD, -0.9, -0.08, 0.001)] : [pod];
  // Cockpit: a wedge (flat bottom sunk in the pod, top sloping up towards the front), piping along its back edge.
  const deck: Sec[] = [
    [-0.302, 0.12, -0.092],
    [DECK_Z0, 0.148, deckTop(DECK_Z0)],
    [-0.36, 0.153, deckTop(-0.36)],
    [-0.42, 0.155, deckTop(-0.42)],
    [-0.475, 0.152, deckTop(-0.475)],
    [-0.5, 0.142, deckTop(-0.5) - 0.006],
    [-0.512, 0.11, deckTop(-0.5) - 0.03],
  ].map(([z, w, top]) => ({ z, w, y: (top - 0.132) / 2, ht: (top + 0.132) / 2, ex: 4 }));
  parts.push(loft(deck, details ? 28 : 8, 4, (_x, y) => (y > -0.09 ? C.cockpit : C.harness), R.coated));
  if (!details) {
    const g = merge(parts);
    g.applyMatrix4(TO_POD);
    return g;
  }
  parts.push(
    tube(
      [
        [-0.146, deckTop(DECK_Z0) + 0.002, DECK_Z0 + 0.004],
        [0, deckTop(DECK_Z0) + 0.004, DECK_Z0 + 0.006],
        [0.146, deckTop(DECK_Z0) + 0.002, DECK_Z0 + 0.004],
      ],
      0.0055,
      C.piping,
      R.plastic,
      5,
    ),
  );
  // Instrument: body and bezel (its screen is a separate textured plane).
  parts.push(finish(new THREE.BoxGeometry(0.15, 0.1, 0.024), C.plastic, R.plastic, INSTRUMENT_SEATED.clone()));
  parts.push(finish(new THREE.BoxGeometry(0.158, 0.108, 0.012), C.cockpit, R.coated, INSTRUMENT_SEATED.clone().multiply(M4.makeTranslation(0, 0, -0.012))));
  const g = merge(parts);
  g.applyMatrix4(TO_POD);
  return g;
}

/** The instrument's screen (pod frame), facing the pilot. */
export function screenGeometry(): Geo {
  const g = new THREE.PlaneGeometry(0.132, 0.083);
  g.applyMatrix4(INSTRUMENT_SEATED.clone().multiply(M4.makeTranslation(0, 0, 0.0125)));
  g.applyMatrix4(TO_POD);
  return g;
}

/** Carabiners (anodised, at the hang points) and the chest strap with its buckle between them, glider frame. */
export const CARABINER_X = 0.21;
export function carabinerGeometry(): Geo {
  const parts: Geo[] = [];
  for (const s of [-1, 1]) {
    parts.push(finish(new THREE.TorusGeometry(0.03, 0.0062, 8, 26), C.anodised, R.metal, at(s * CARABINER_X, 0.0, 0.0, 0, Math.PI / 2, 0, 1, 1.45, 1)));
    parts.push(finish(new THREE.CylinderGeometry(0.0042, 0.0042, 0.05, 6), C.metal, R.metal, at(s * CARABINER_X, -0.004, -0.028)));
  }
  const strap = new THREE.BoxGeometry(2 * CARABINER_X - 0.03, 0.026, 0.004);
  parts.push(finish(strap, C.strap, R.fabric, at(0, -0.03, 0.006)));
  parts.push(finish(new THREE.BoxGeometry(0.05, 0.034, 0.012), C.buckle, R.metal, at(0, -0.03, 0.004)));
  return merge(parts);
}

/** A unit strap (webbing) along +y from 0 to 1, for instanced risers and harness straps. */
export function strapGeometry(width: number, thick: number): Geo {
  const g = new THREE.BoxGeometry(thick, 1, width);
  g.translate(0, 0.5, 0);
  return g;
}

/** Delta maillon with its rubber keeper (instanced, at the top of each riser). */
export function maillonGeometry(): Geo {
  return merge([
    finish(new THREE.TorusGeometry(0.011, 0.0026, 6, 3), C.metal, R.metal, at(0, 0.012, 0, 0, Math.PI / 2, Math.PI / 2, 1, 1.25, 1)),
    finish(new THREE.CylinderGeometry(0.004, 0.0055, 0.012, 8), C.plastic, R.plastic, at(0, 0.024, 0)),
  ]);
}

// ---------------------------------------------------------------------------------------
// The distant pilot.

/**
 * A seated pilot in one mesh (glider frame), hands at a light brake (as the posed rig at ~30 %:
 * elbows low at the harness's sides, fists at the chin), risers: other pilots beyond ~150 m.
 */
const LOW_ELBOW = new THREE.Vector3(0.275, -0.135, 0.22);
const LOW_HAND = new THREE.Vector3(0.305, 0.145, 0.068);
let lowGeo: Geo | null = null;
export function lowPilotGeometry(): Geo {
  if (lowGeo) return lowGeo;
  const T = new THREE.Matrix4().compose(HIP0, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), SEATED.recline), new THREE.Vector3(1, 1, 1));
  const parts: Geo[] = [];
  const pick = (secs: Sec[]) => secs.filter((_, i) => i % 2 === 0 || i === secs.length - 1);
  parts.push(upright(loft(pick(TORSO), 8, 2.3, () => C.jacket, R.fabric)).applyMatrix4(T));
  parts.push(upright(loft(pick(SHELL), 8, 2.5, () => C.harness, R.coated)).applyMatrix4(T));
  parts.push(podGeometry(8, false).applyMatrix4(new THREE.Matrix4().makeTranslation(POD_HINGE_SEATED.x, POD_HINGE_SEATED.y, POD_HINGE_SEATED.z)));
  const fair = fairingGeometry(8, false);
  fair.applyMatrix4(M4.makeTranslation(FAIRING_HINGE_T[0], FAIRING_HINGE_T[1], FAIRING_HINGE_T[2]));
  fair.applyMatrix4(T);
  parts.push(fair);
  const neck = torsoToGlider(NECK_T, HIP0, SEATED.recline, new THREE.Vector3());
  parts.push(ellipsoid(0.125, 0.13, 0.15, C.helmet, R.gloss, at(neck.x, neck.y + 0.14, neck.z + 0.01), 8, 6));
  const bone = (a: THREE.Vector3, b: THREE.Vector3, w: number, hex: number) => {
    const d = b.clone().sub(a);
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()), new THREE.Vector3(1, 1, 1));
    return finish(new THREE.BoxGeometry(w, d.length(), w), hex, R.fabric, m);
  };
  for (const s of [-1, 1]) {
    const sh = torsoToGlider([s * SHOULDER_T[0], SHOULDER_T[1], SHOULDER_T[2]], HIP0, SEATED.recline, new THREE.Vector3());
    const elbow = LOW_ELBOW.clone().setX(s * LOW_ELBOW.x);
    const hand = LOW_HAND.clone().setX(s * LOW_HAND.x);
    parts.push(bone(sh, elbow, 0.08, C.jacket), bone(elbow, hand, 0.065, C.jacket));
    parts.push(finish(new THREE.BoxGeometry(0.075, 0.1, 0.07), C.glove, R.fabric, at(hand.x, hand.y, hand.z)));
    parts.push(finish(new THREE.BoxGeometry(0.02, 0.47, 0.03), C.strap, R.fabric, at(s * 0.225, 0.25, -0.01, 0, 0, -s * 0.05)));
  }
  lowGeo = merge(parts.map((p) => (p.getAttribute('color')?.itemSize === 4 ? p : paint(p, C.harness, R.coated))));
  return lowGeo;
}
