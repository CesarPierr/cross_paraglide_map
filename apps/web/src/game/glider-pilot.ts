/**
 * The pilot and his gear, in the glider frame (x right, y up, z back, carabiners at the
 * origin): a cocoon harness (pod with its cockpit and instrument, seat, back protector and
 * rear fairing, reserve handle), the pilot (navy jacket with shoulder and chest straps,
 * helmet and sunglasses), arms placed by inverse kinematics on the brake handles (gloved
 * fists through the toggles, big ears: on the outer A lines), legs that stand and run on
 * the take-off and fold into the pod in flight, the speed bar under the feet. The risers
 * (webbing, maillons, brake pulleys and magnets, speed-system pulleys) live in the canopy
 * frame. Everything is posed every frame without allocation; geometries and materials
 * are shared by all gliders.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GliderState } from './flight';
import { Anchor, type LineSet } from './glider-lines';

type Geo = THREE.BufferGeometry;

// ---------------------------------------------------------------------------------------
// Geometry helpers (build time only).

const M4 = new THREE.Matrix4();
/** Prepares a part for merging: indexed, no uv, transformed, one colour (or its own if `color` < 0). */
function finish(g: Geo, color: number, m?: THREE.Matrix4): Geo {
  let geo = g;
  if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  if (geo.getAttribute('uv1')) geo.deleteAttribute('uv1');
  if (!geo.index) {
    const n = geo.getAttribute('position').count;
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(i);
    geo.setIndex(idx);
  }
  if (m) geo = geo.applyMatrix4(m);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  if (color < 0 && geo.getAttribute('color')) return geo;
  const n = geo.getAttribute('position').count;
  const c = new THREE.Color(color);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function at(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
}
function ellipsoid(rx: number, ry: number, rz: number, color: number, m: THREE.Matrix4, ws = 14, hs = 10): Geo {
  return finish(new THREE.SphereGeometry(1, ws, hs), color, m.clone().multiply(M4.makeScale(rx, ry, rz)));
}
/** A tapered limb from y = 0 to y = len with rounded ends. */
function limb(r0: number, r1: number, len: number, color: number, segs = 12): Geo {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r0, Math.sin(a) * r0 * 0.9));
  }
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    pts.push(new THREE.Vector2(r0 + (r1 - r0) * t, len * t));
  }
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r1), len + Math.sin(a) * r1 * 0.9));
  }
  return finish(new THREE.LatheGeometry(pts, segs), color);
}
interface Sec {
  z: number;
  y: number;
  w: number;
  h: number;
  /** Top of the section raised (a backrest), optional. */
  top?: number;
}
/** A loft along z through superelliptic sections (closed at the ends unless told); colour per vertex from its place. */
function loft(secs: Sec[], ring: number, ex: number, color: (x: number, y: number, z: number, u: number) => number, caps: [boolean, boolean] = [true, true]): Geo {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (const s of secs) {
    for (let k = 0; k < ring; k++) {
      const t = (k / ring) * Math.PI * 2;
      const ct = Math.cos(t);
      const st = Math.sin(t);
      const x = s.w * Math.sign(ct) * Math.pow(Math.abs(ct), 2 / ex);
      const yy = Math.sign(st) * Math.pow(Math.abs(st), 2 / ex);
      const y = s.y + (yy > 0 ? s.h + (s.top ?? 0) * yy * yy : s.h) * yy;
      pos.push(x, y, s.z);
      c.setHex(color(x, y, s.z, k / ring));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < secs.length - 1; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * ring + k;
      const b = i * ring + ((k + 1) % ring);
      const a2 = a + ring;
      const b2 = b + ring;
      idx.push(a, a2, b, b, a2, b2);
    }
  }
  for (const [i, flip] of [
    [0, true],
    [secs.length - 1, false],
  ] as const) {
    if (!caps[i === 0 ? 0 : 1]) continue;
    const s = secs[i];
    const ci = pos.length / 3;
    pos.push(0, s.y, s.z);
    c.setHex(color(0, s.y, s.z, 0));
    col.push(c.r, c.g, c.b);
    for (let k = 0; k < ring; k++) {
      const a = i * ring + k;
      const b = i * ring + ((k + 1) % ring);
      if (flip) idx.push(ci, a, b);
      else idx.push(ci, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** Hex colour between two others (build time). */
function blend(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), Math.min(1, Math.max(0, t))).getHex();
}
/** A thin tube along a polyline (piping, seams). */
function piping(pts: [number, number, number][], r: number, color: number): Geo {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return finish(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 6), r, 5, false), color);
}
function merge(geos: Geo[]): Geo {
  const g = mergeGeometries(geos, false);
  if (!g) throw new Error('glider: geometry merge failed');
  return g;
}

// ---------------------------------------------------------------------------------------
// Colours and shared materials.

const C = {
  jacket: 0x34507a,
  jacketPanel: 0x22344f,
  cuff: 0x1b1e24,
  strap: 0x15171b,
  buckle: 0x9aa1aa,
  harness: 0x1d1f24,
  harnessPanel: 0x343840,
  piping: 0xd5502c,
  helmet: 0xecebe6,
  helmetStripe: 0x2a2f39,
  visor: 0x14161b,
  skin: 0xcf9d7f,
  glove: 0x2b2e35,
  knuckle: 0x5a606b,
  toggle: 0xc4232c,
  metal: 0xb3bac3,
  boot: 0x3a2f27,
  trousers: 0x2a2d33,
  reserve: 0xf0b414,
  plastic: 0x16171b,
};

let mats: {
  fabric: THREE.MeshStandardMaterial;
  gloss: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  web: THREE.MeshStandardMaterial;
} | null = null;

/** Woven webbing with its selvedges and bar-tacks (greyscale, tinted per riser). */
function webbingTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 512;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#bdbdbd';
  g.fillRect(0, 0, 32, 512);
  for (let y = 0; y < 512; y += 3) {
    g.fillStyle = y % 6 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
    g.fillRect(0, y, 32, 1);
  }
  for (let x = 0; x < 32; x += 4) {
    g.fillStyle = 'rgba(0,0,0,0.07)';
    g.fillRect(x, 0, 1, 512);
  }
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.fillRect(0, 0, 2, 512);
  g.fillRect(30, 0, 2, 512);
  // Bar-tacks (zigzag stitching) at the loops and the label.
  g.strokeStyle = 'rgba(245,245,245,0.85)';
  g.lineWidth = 1.2;
  for (const y0 of [8, 34, 380, 470, 496]) {
    g.beginPath();
    for (let i = 0; i <= 14; i++) g.lineTo(4 + (i % 2) * 24, y0 + i * 1.3);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(6, 300, 20, 46);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(9, 306, 14, 2);
  g.fillRect(9, 312, 10, 2);
  g.fillRect(9, 318, 13, 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function materials() {
  if (mats) return mats;
  mats = {
    fabric: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }),
    gloss: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.36, metalness: 0.35 }),
    web: new THREE.MeshStandardMaterial({ map: webbingTexture(), roughness: 0.85, metalness: 0 }),
  };
  return mats;
}

// ---------------------------------------------------------------------------------------
// Shapes.

/** The instrument on the cockpit, its screen turned towards the pilot's eyes. */
const INSTRUMENT = at(0, -0.085, -0.41, -0.5);

/** Pod (legs) from the nose to the seat, and the rear harness from the seat to the tail. */
const POD: Sec[] = [
  { z: -1.04, y: -0.385, w: 0.01, h: 0.01 },
  { z: -1.0, y: -0.388, w: 0.09, h: 0.085 },
  { z: -0.93, y: -0.388, w: 0.14, h: 0.125 },
  { z: -0.8, y: -0.378, w: 0.175, h: 0.15 },
  { z: -0.6, y: -0.355, w: 0.195, h: 0.165 },
  { z: -0.35, y: -0.322, w: 0.208, h: 0.172 },
  { z: -0.1, y: -0.29, w: 0.218, h: 0.178 },
  { z: 0.12, y: -0.265, w: 0.225, h: 0.185 },
];
/** Starts inside the pod's open end (no overlapping skins). */
const REAR: Sec[] = [
  { z: 0.06, y: -0.272, w: 0.21, h: 0.17 },
  { z: 0.26, y: -0.235, w: 0.236, h: 0.198, top: 0.03 },
  { z: 0.42, y: -0.17, w: 0.228, h: 0.195, top: 0.1 },
  { z: 0.56, y: -0.1, w: 0.198, h: 0.168, top: 0.08 },
  { z: 0.72, y: -0.05, w: 0.15, h: 0.13, top: 0.03 },
  { z: 0.88, y: -0.01, w: 0.085, h: 0.08 },
  { z: 0.99, y: 0.01, w: 0.01, h: 0.01 },
];
/** Dark fabric on top, a lighter grey belly (smooth, no smeared stripes). */
function harnessColor(y: number, cy: number, h: number): number {
  return blend(C.harness, C.harnessPanel, ((cy - y) / Math.max(0.05, h) - 0.1) * 1.6);
}
const lerpSec = (secs: Sec[], z: number) => {
  let i = 0;
  while (i < secs.length - 2 && z > secs[i + 1].z) i++;
  const a = secs[i];
  const b = secs[i + 1];
  const t = Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z)));
  return { y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
};
/** Orange piping along both sides of a loft, at its widest. */
function sidePiping(secs: Sec[], z0: number, z1: number): Geo[] {
  const out: Geo[] = [];
  for (const sd of [-1, 1]) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const z = z0 + ((z1 - z0) * i) / 12;
      const q = lerpSec(secs, z);
      pts.push([sd * (q.w + 0.002), q.y, z]);
    }
    out.push(piping(pts, 0.0045, C.piping));
  }
  return out;
}

function podGeometry(): Geo {
  const pod = loft(POD, 32, 2.6, (_x, y, z) => {
    const q = lerpSec(POD, z);
    return harnessColor(y, q.y, q.h);
  }, [true, false]);
  // Cockpit: a padded fabric box on the pod, sloping towards the pilot, with the instrument.
  const cockSecs: Sec[] = [
    { z: -0.165, y: 0, w: 0.12, h: 0.02 },
    { z: -0.15, y: 0, w: 0.145, h: 0.034 },
    { z: 0.0, y: 0, w: 0.15, h: 0.036 },
    { z: 0.15, y: 0, w: 0.145, h: 0.034 },
    { z: 0.165, y: 0, w: 0.12, h: 0.02 },
  ];
  const cockpit = loft(cockSecs, 24, 5, (_x, y) => (y > 0.03 ? C.harness : C.harnessPanel));
  cockpit.applyMatrix4(at(0, -0.135, -0.43, -0.32));
  const lip = piping(
    [
      [-0.15, -0.1, -0.29],
      [0, -0.098, -0.288],
      [0.15, -0.1, -0.29],
    ],
    0.006,
    C.piping,
  );
  const body = finish(new THREE.BoxGeometry(0.15, 0.1, 0.022), C.plastic, INSTRUMENT.clone());
  const bezel = finish(new THREE.BoxGeometry(0.158, 0.108, 0.012), C.harnessPanel, INSTRUMENT.clone().multiply(M4.makeTranslation(0, 0, -0.012)));
  const reserve = finish(new THREE.BoxGeometry(0.03, 0.03, 0.09), C.reserve, at(0.232, -0.2, -0.02, 0.1));
  const reserveTab = finish(new THREE.BoxGeometry(0.012, 0.05, 0.03), C.reserve, at(0.245, -0.18, -0.02));
  return merge([finish(pod, -1), finish(cockpit, -1), lip, body, bezel, reserve, reserveTab, ...sidePiping(POD, -0.97, 0.12)]);
}

function rearGeometry(): Geo {
  const rear = loft(REAR, 32, 2.6, (_x, y, z) => {
    const q = lerpSec(REAR, z);
    return harnessColor(y, q.y, q.h);
  }, [false, true]);
  // Main straps from the harness to the carabiners.
  const parts = [finish(rear, -1), ...sidePiping(REAR, 0.12, 0.9)];
  for (const s of [-1, 1]) parts.push(finish(new THREE.BoxGeometry(0.012, 0.2, 0.035), C.strap, at(s * 0.205, -0.1, 0.03, 0.15, 0, 0)));
  return merge(parts);
}

/** Torso along +y (pelvis at 0, neck at 0.47), front towards −z: jacket, zip, shoulder and chest straps. */
const TORSO_LEN = 0.47;
const TORSO: Sec[] = [
  { z: -0.05, y: 0, w: 0.13, h: 0.1 },
  { z: 0.0, y: 0, w: 0.15, h: 0.105 },
  { z: 0.12, y: 0, w: 0.155, h: 0.105 },
  { z: 0.245, y: 0, w: 0.16, h: 0.108 },
  { z: 0.252, y: 0, w: 0.161, h: 0.109 },
  { z: 0.288, y: 0, w: 0.164, h: 0.11 },
  { z: 0.295, y: 0, w: 0.165, h: 0.11 },
  { z: 0.34, y: 0, w: 0.175, h: 0.11 },
  { z: 0.41, y: 0, w: 0.168, h: 0.098 },
  { z: 0.45, y: 0, w: 0.085, h: 0.068 },
  { z: 0.49, y: 0, w: 0.06, h: 0.052 },
  { z: 0.5, y: 0, w: 0.03, h: 0.03 },
];
function torsoColor(x: number, yy: number, z: number): number {
  const front = yy > 0;
  if (z > 0.44) return C.jacketPanel;
  if (yy === 0 && Math.abs(x) < 1e-6) return C.jacket;
  if (front && z > 0.25 && z < 0.29) return Math.abs(x) < 0.028 ? C.buckle : C.strap;
  if (front && Math.abs(Math.abs(x) - 0.085) < 0.02 && z > 0.06) return C.strap;
  if (front && Math.abs(x) < 0.006) return C.cuff;
  if (z < 0.06) return C.strap;
  return Math.abs(x) > 0.125 ? C.jacketPanel : C.jacket;
}
/** The whole torso, or (first person) its lower part: the chest near the eyes would fill the view. */
function torsoGeometry(low = false): Geo {
  const secs = low ? TORSO.filter((s) => s.z <= 0.2) : TORSO;
  // Built along z with "y" the front/back axis, then turned: z → +y, +y (front) → −z.
  const g = loft(secs, 40, 2.2, torsoColor);
  g.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  g.computeVertexNormals();
  return g;
}

function headGeometry(): { helmet: Geo; face: Geo } {
  const helmet = new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
  const hm = at(0, 0.02, 0.01, -0.25, 0, 0, 0.128, 0.13, 0.152);
  const hg = finish(helmet, C.helmet, hm);
  // A stripe on the shell.
  const p = hg.getAttribute('position');
  const col = hg.getAttribute('color');
  const c = new THREE.Color(C.helmetStripe);
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 0.022) col.setXYZ(i, c.r, c.g, c.b);
  const glasses = finish(new THREE.BoxGeometry(0.15, 0.032, 0.02), C.visor, at(0, -0.012, -0.108));
  // Face in front, a dark buff round the back and the neck.
  const face = ellipsoid(0.083, 0.105, 0.095, C.skin, at(0, -0.035, -0.02));
  const fp = face.getAttribute('position');
  const fc = face.getAttribute('color');
  const dark = new THREE.Color(C.cuff);
  for (let i = 0; i < fp.count; i++) if (fp.getZ(i) > -0.05) fc.setXYZ(i, dark.r, dark.g, dark.b);
  const chin = finish(new THREE.BoxGeometry(0.012, 0.09, 0.012), C.strap, at(0.075, -0.06, -0.01));
  const chin2 = finish(new THREE.BoxGeometry(0.012, 0.09, 0.012), C.strap, at(-0.075, -0.06, -0.01));
  const off = new THREE.Matrix4().makeTranslation(0, 0.125, 0.04);
  return { helmet: merge([hg, glasses]).applyMatrix4(off), face: merge([face, chin, chin2]).applyMatrix4(off) };
}

/**
 * Gloved fist through the brake toggle: local +y along the forearm (wrist at 0), +z the
 * back of the hand. Fingers curled round the toggle, thumb across them, Velcro cuff.
 */
function gloveGeometry(): Geo {
  const parts: Geo[] = [];
  parts.push(finish(new THREE.CylinderGeometry(0.037, 0.04, 0.05, 14, 1, true), C.cuff, at(0, 0.012, 0)));
  parts.push(finish(new THREE.BoxGeometry(0.03, 0.03, 0.006), C.knuckle, at(0, 0.014, 0.039)));
  parts.push(ellipsoid(0.044, 0.05, 0.022, C.glove, at(0, 0.066, 0.004)));
  parts.push(ellipsoid(0.035, 0.038, 0.007, C.knuckle, at(0, 0.07, 0.022)));
  // Knuckle ridge, then the fingers curling down into the palm.
  parts.push(finish(new THREE.CapsuleGeometry(0.0155, 0.07, 4, 10), C.glove, at(0, 0.106, 0.008, 0, 0, Math.PI / 2)));
  for (let i = 0; i < 4; i++) {
    const x = -0.03 + i * 0.02;
    parts.push(ellipsoid(0.0098, 0.013, 0.017, C.glove, at(x, 0.118, -0.014, 0.35)));
    parts.push(ellipsoid(0.0092, 0.016, 0.011, C.glove, at(x, 0.102, -0.03, -0.5)));
  }
  parts.push(ellipsoid(0.03, 0.012, 0.013, C.glove, at(0.004, 0.09, -0.036, 0, 0, 0.25)));
  // Toggle: a semi-rigid loop gripped in the fist, its swivel above.
  parts.push(finish(new THREE.TorusGeometry(0.04, 0.0072, 6, 22), C.toggle, at(0, 0.122, -0.014, 0, 0, 0, 1.38, 0.85, 1)));
  parts.push(ellipsoid(0.0065, 0.011, 0.0065, C.metal, at(0, 0.168, -0.014)));
  return merge(parts);
}

function cockpitScreenGeometry(): Geo {
  const g = new THREE.PlaneGeometry(0.13, 0.081);
  g.applyMatrix4(INSTRUMENT.clone().multiply(M4.makeTranslation(0, 0, 0.0116)));
  return g;
}

// ---------------------------------------------------------------------------------------
// Poses.

const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SEATED = {
  pelvis: V3(0, -0.2, 0.13),
  neckDir: V3(0, 0.415, 0.22).normalize(),
  shoulder: V3(0.185, 0.16, 0.305),
  hip: V3(0.1, -0.21, 0.1),
  thigh: 1.41,
  shin: 1.34,
};
const STANDING = {
  pelvis: V3(0, -0.15, 0.05),
  neckDir: V3(0, 0.995, 0.1).normalize(),
  shoulder: V3(0.185, 0.27, 0.075),
  hip: V3(0.1, -0.17, 0.05),
  thigh: 0.08,
  shin: -0.06,
};
const UPPER_ARM = 0.29;
const FOREARM = 0.31;
const THIGH = 0.44;
const SHIN = 0.43;

/** Riser layout (right side; x mirrored on the left): bottom loop and maillon. */
const RISERS = [
  { id: Anchor.A, color: 0xb8232a, bottom: V3(0.205, 0.015, -0.012), top: V3(0.238, 0.47, -0.074), bar: 0.14 },
  { id: Anchor.A2, color: 0xb8232a, bottom: V3(0.207, 0.015, -0.005), top: V3(0.262, 0.462, -0.05), bar: 0.14 },
  { id: Anchor.B, color: 0x1f2125, bottom: V3(0.207, 0.015, 0.004), top: V3(0.248, 0.468, -0.012), bar: 0.07 },
  { id: Anchor.C, color: 0x1f2125, bottom: V3(0.205, 0.015, 0.012), top: V3(0.24, 0.462, 0.048), bar: 0 },
] as const;
const PULLEY = V3(0.252, 0.426, 0.072);
const RISER_PULLEY = V3(0.214, 0.1, -0.03);
const HARNESS_PULLEY = V3(0.215, -0.2, -0.06);

/** Geometries shared by every glider's rig (built once). */
let sharedGeo: ReturnType<typeof buildShared> | null = null;
function buildShared() {
  const head = headGeometry();
  const hw: Geo[] = [];
  for (const s of [-1, 1]) {
    hw.push(finish(new THREE.CylinderGeometry(0.0075, 0.0075, 0.007, 14), C.metal, at(s * PULLEY.x, PULLEY.y, PULLEY.z, 0, 0, Math.PI / 2)));
    hw.push(finish(new THREE.TorusGeometry(0.0085, 0.0016, 6, 14), C.metal, at(s * PULLEY.x, PULLEY.y + 0.002, PULLEY.z, 0, Math.PI / 2, 0)));
    hw.push(finish(new THREE.CylinderGeometry(0.0048, 0.0048, 0.01, 10), C.plastic, at(s * PULLEY.x, PULLEY.y - 0.024, PULLEY.z - 0.002)));
    hw.push(finish(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 12), C.metal, at(s * RISER_PULLEY.x, RISER_PULLEY.y, RISER_PULLEY.z, 0, 0, Math.PI / 2)));
  }
  const strap = new THREE.BoxGeometry(0.0025, 1, 0.019);
  strap.translate(0, 0.5, 0);
  return {
    pod: podGeometry(),
    screen: cockpitScreenGeometry(),
    bar: merge([
      finish(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 10), C.metal, at(0, 0, 0, 0, 0, Math.PI / 2)),
      finish(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 10), C.plastic, at(-0.13, 0, 0, 0, 0, Math.PI / 2)),
      finish(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 10), C.plastic, at(0.13, 0, 0, 0, 0, Math.PI / 2)),
    ]),
    rear: rearGeometry(),
    torso: torsoGeometry(),
    torsoLow: torsoGeometry(true),
    helmet: head.helmet,
    face: head.face,
    thigh: limb(0.072, 0.058, THIGH, C.trousers),
    shin: limb(0.054, 0.045, SHIN, C.trousers),
    boot: merge([finish(new THREE.BoxGeometry(0.095, 0.1, 0.27), C.boot, at(0, -0.02, -0.07)), finish(new THREE.BoxGeometry(0.1, 0.025, 0.28), C.plastic, at(0, -0.075, -0.07))]),
    upper: limb(0.056, 0.046, UPPER_ARM, C.jacket, 18),
    fore: limb(0.046, 0.036, FOREARM - 0.07, C.jacket, 18),
    glove: gloveGeometry(),
    carab: merge(
      [-1, 1].flatMap((s) => [
        finish(new THREE.TorusGeometry(0.03, 0.0065, 8, 22), C.metal, at(s * 0.205, 0.0, 0.0, 0, Math.PI / 2, 0, 1, 1.45, 1)),
        finish(new THREE.CylinderGeometry(0.004, 0.004, 0.045, 6), C.buckle, at(s * 0.205, 0.0, -0.027)),
      ]),
    ),
    strap,
    maillon: finish(new THREE.TorusGeometry(0.011, 0.0028, 6, 3), C.metal, at(0, 0.008, 0, 0, Math.PI / 2, Math.PI / 2, 1, 1.3, 1)),
    hardware: merge(hw),
  };
}
function shared() {
  return (sharedGeo ??= buildShared());
}

// Scratch objects for the per-frame pose.
const tA = new THREE.Vector3();
const tB = new THREE.Vector3();
const tC = new THREE.Vector3();
const tD = new THREE.Vector3();
const tE = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const tQ = new THREE.Quaternion();
const qUp = new THREE.Quaternion();
const vUp = new THREE.Vector3();
const vPivot = new THREE.Vector3();
const tM = new THREE.Matrix4();
const tS = new THREE.Vector3(1, 1, 1);

const tBone = new THREE.Vector3();
/** Places a mesh built along +y from `a` towards `b`. */
function alignBone(o: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  tBone.subVectors(b, a).normalize();
  o.position.copy(a);
  o.quaternion.setFromUnitVectors(Y, tBone);
}

export interface RigInput {
  st: GliderState;
  /** 0 seated in the pod … 1 standing on the take-off. */
  stand: number;
  /** Running speed on the ground (m/s) and the time (s), for the stride. */
  run: number;
  time: number;
  dt: number;
  /** Glider frame → canopy frame (the canopy turns about the carabiners on the ground). */
  canopyInv: THREE.Quaternion;
}

export class PilotRig {
  /** Head and helmet: hidden in first person (the camera is in it). */
  readonly pilot = new THREE.Group();
  /** Body, harness, arms, cockpit: in the glider frame. */
  readonly body = new THREE.Group();
  /** Risers and their hardware: in the canopy frame. */
  readonly risers = new THREE.Group();
  readonly instrument: THREE.Mesh | null = null;
  private lean = new THREE.Group();
  private torso: THREE.Mesh;
  private torsoLow: THREE.Mesh;
  private pod = new THREE.Group();
  /** Seat, back protector and rear fairing: hang behind the pilot when he stands. */
  private rear = new THREE.Group();
  private bar: THREE.Mesh;
  private legs: THREE.Mesh[] = [];
  private upper: THREE.Mesh[] = [];
  private fore: THREE.Mesh[] = [];
  private gloves: THREE.Mesh[] = [];
  private straps: THREE.InstancedMesh;
  private maillons: THREE.InstancedMesh;
  private hands = [new THREE.Vector3(), new THREE.Vector3()];
  private shoulder = new THREE.Vector3();
  private swivels = [new THREE.Vector3(), new THREE.Vector3()];
  private bob = 0;
  private bobV = 0;
  private lastVz = 0;
  private screen: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; next: number; vario: number } | null = null;

  constructor() {
    const m = materials();
    const G = shared();
    this.body.add(this.lean);
    // Harness: pod (with the cockpit) swinging from the seat, rear part with the back protector.
    const pod = new THREE.Mesh(G.pod, m.fabric);
    this.pod.add(pod);
    this.pod.position.set(0, -0.24, 0.1);
    pod.position.set(0, 0.24, -0.1);
    const screen = new THREE.Mesh(G.screen, new THREE.MeshBasicMaterial({ color: 0xc9cdc0, toneMapped: false }));
    pod.add(screen);
    this.instrument = screen;
    this.bar = new THREE.Mesh(G.bar, m.metal);
    this.pod.add(this.bar);
    const rear = new THREE.Mesh(G.rear, m.fabric);
    this.rear.position.set(0, -0.2, 0.12);
    rear.position.set(0, 0.2, -0.12);
    this.rear.add(rear);
    this.lean.add(this.pod, this.rear);
    this.torso = new THREE.Mesh(G.torso, m.fabric);
    this.torsoLow = new THREE.Mesh(G.torsoLow, m.fabric);
    this.lean.add(this.torso, this.torsoLow);
    this.pilot.add(new THREE.Mesh(G.helmet, m.gloss), new THREE.Mesh(G.face, m.fabric));
    this.lean.add(this.pilot);
    // Legs (seen standing on the take-off; in flight they are in the pod).
    for (let i = 0; i < 2; i++) {
      for (const g of [G.thigh, G.shin, G.boot]) {
        const mesh = new THREE.Mesh(g, m.fabric);
        this.legs.push(mesh);
        this.lean.add(mesh);
      }
    }
    // Arms and gloved hands (posed in the glider frame).
    for (let i = 0; i < 2; i++) {
      const u = new THREE.Mesh(G.upper, m.fabric);
      const f = new THREE.Mesh(G.fore, m.fabric);
      const gl = new THREE.Mesh(G.glove, m.fabric);
      this.upper.push(u);
      this.fore.push(f);
      this.gloves.push(gl);
      this.body.add(u, f, gl);
    }
    // Carabiners (oval, anodised) at the riser loops.
    this.body.add(new THREE.Mesh(G.carab, m.metal));
    // Risers: webbing (instanced, tinted per riser), maillons, pulleys and magnets.
    this.straps = new THREE.InstancedMesh(G.strap, m.web, 8);
    this.maillons = new THREE.InstancedMesh(G.maillon, m.metal, 8);
    const c = new THREE.Color();
    for (let s = 0; s < 2; s++) RISERS.forEach((r, i) => this.straps.setColorAt(s * 4 + i, c.setHex(r.color)));
    this.risers.add(this.straps, this.maillons, new THREE.Mesh(G.hardware, m.metal));
    for (const o of [this.straps, this.maillons]) o.frustumCulled = false;
  }

  /** Poses the rig and gives the line anchors (canopy frame) to `lines`. */
  update(inp: RigInput, lines: LineSet | null): void {
    const st = inp.st;
    const stand = inp.stand;
    const k = stand * stand * (3 - 2 * stand);
    const sb = st.speedbar || 0;
    const ears = st.ears || 0;
    const ws = st.weightShift || 0;
    // Body: leans into the turn, sinks under load and bounces in the turbulence.
    const dt = Math.max(1e-3, inp.dt);
    const vz = st.vz || 0;
    const acc = Math.max(-30, Math.min(30, (vz - this.lastVz) / dt));
    this.lastVz = vz;
    this.bobV += (-80 * this.bob - 9 * this.bobV - acc * 0.25 * (1 - k)) * dt;
    this.bob = Math.max(-0.05, Math.min(0.05, this.bob + this.bobV * dt));
    const load = Math.min(3, Math.max(0, (st.load || 1) - 1));
    this.lean.rotation.set(0, 0, -ws * 0.1 * (1 - k));
    this.lean.position.set(0, -0.025 * load + this.bob * 0.4, 0);
    // Pose between seated and standing.
    tB.lerpVectors(SEATED.pelvis, STANDING.pelvis, k);
    tC.lerpVectors(SEATED.neckDir, STANDING.neckDir, k).normalize();
    this.torso.position.copy(tB);
    this.torso.quaternion.setFromUnitVectors(Y, tC);
    this.torsoLow.position.copy(tB);
    this.torsoLow.quaternion.copy(this.torso.quaternion);
    // First person (head hidden): only the lower torso, the chest would fill the view.
    this.torso.visible = this.pilot.visible;
    this.torsoLow.visible = !this.pilot.visible;
    tD.copy(tB).addScaledVector(tC, TORSO_LEN);
    this.pilot.position.copy(tD);
    this.pilot.rotation.set(-0.15 * (1 - k) - 0.25 * k + 0.6 * this.bob, -0.3 * (st.bank || 0) * (1 - k), 0);
    // Pod: forward in flight (pitching a little with the bumps), hanging and short on the ground.
    this.pod.rotation.set(-1.25 * k + this.bob * 1.2, 0, 0);
    this.rear.rotation.set(1.05 * k, 0, 0);
    this.pod.scale.set(1, 1, 1 - 0.45 * k);
    this.pod.visible = true;
    // (In the pod group, whose origin is at the front of the seat.)
    this.bar.position.set(0, -0.22 - 0.04 * sb, -1.08 - 0.16 * sb);
    // Legs: standing (and running), folded into the pod in flight.
    const showLegs = k > 0.02;
    const stride = inp.run > 0.3 ? Math.sin(inp.time * (4 + inp.run * 1.2)) : 0;
    const amp = Math.min(1, inp.run / 3);
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1;
      const ph = s ? stride : -stride;
      const th = SEATED.thigh + (STANDING.thigh - SEATED.thigh) * k + 0.5 * amp * ph * k;
      const sh = SEATED.shin + (STANDING.shin - SEATED.shin) * k + (0.2 + 0.5 * Math.max(0, -ph)) * amp * k;
      tA.lerpVectors(SEATED.hip, STANDING.hip, k);
      tA.x *= sg;
      tE.set(0, -Math.cos(th), -Math.sin(th));
      tD.copy(tA).addScaledVector(tE, THIGH);
      const thighM = this.legs[s * 3];
      const shinM = this.legs[s * 3 + 1];
      const bootM = this.legs[s * 3 + 2];
      thighM.visible = shinM.visible = bootM.visible = showLegs;
      if (!showLegs) continue;
      thighM.position.copy(tA);
      thighM.quaternion.setFromUnitVectors(Y, tE);
      tE.set(0, -Math.cos(sh), -Math.sin(sh));
      shinM.position.copy(tD);
      shinM.quaternion.setFromUnitVectors(Y, tE);
      tD.addScaledVector(tE, SHIN);
      bootM.position.copy(tD);
      bootM.rotation.set(-sh * 0.3, 0, 0);
    }
    // Hands on the brake handles: up under the pulleys, down to the hips at full brake,
    // out on the outer A lines with big ears. On the take-off they hold the risers too and
    // go round the carabiners with them as the wing rises: behind the pilot, arms back, in
    // a forward launch; in front of him facing the wing. In flight the canopy frame is the
    // glider's and nothing turns.
    vUp.copy(Y).applyQuaternion(qUp.copy(inp.canopyInv).invert());
    qUp.setFromUnitVectors(Y, vUp);
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1;
      const b = Math.min(1, Math.max(0, (s ? st.brakeR : st.brakeL) || 0));
      const h = this.hands[s];
      const bulge = Math.sin(Math.PI * b);
      h.set(sg * (0.27 + 0.06 * b + 0.045 * bulge), 0.3 - 0.46 * b, 0.0 + 0.13 * b - 0.03 * bulge);
      if (ears > 0) h.lerp(tA.set(sg * 0.34, 0.25, -0.11), Math.min(1, ears * 1.5));
      vPivot.set(sg * 0.205, 0.015, 0);
      h.sub(vPivot).applyQuaternion(qUp).add(vPivot);
      // Shoulder in the glider frame (the body leans).
      const sh = this.shoulder;
      sh.lerpVectors(SEATED.shoulder, STANDING.shoulder, k);
      sh.x *= sg;
      sh.applyEuler(this.lean.rotation).add(this.lean.position);
      this.arm(s, sh, h);
    }
    if (lines) this.anchors(inp, lines, sb, ears);
  }

  private arm(s: number, sh: THREE.Vector3, hand: THREE.Vector3): void {
    const sg = s ? 1 : -1;
    // Two-bone IK, the elbow low and a little out, as pilots hold it.
    tB.subVectors(hand, sh);
    let d = tB.length();
    d = Math.min(UPPER_ARM + FOREARM - 1e-3, Math.max(0.12, d));
    tB.normalize();
    const cosA = (UPPER_ARM * UPPER_ARM + d * d - FOREARM * FOREARM) / (2 * UPPER_ARM * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    tC.set(sg * 0.45, -0.85, 0.25);
    tC.addScaledVector(tB, -tC.dot(tB)).normalize();
    tD.copy(sh).addScaledVector(tB, cosA * UPPER_ARM).addScaledVector(tC, sinA * UPPER_ARM);
    // Wrist: the forearm towards the grip, the fist beyond it.
    tE.copy(sh).addScaledVector(tB, d);
    alignBone(this.upper[s], sh, tD);
    alignBone(this.fore[s], tD, tE);
    const g = this.gloves[s];
    tA.subVectors(tE, tD).normalize();
    // Back of the hand: outwards and backwards, square to the forearm.
    tC.set(sg * 0.8, 0.15, 0.6);
    tC.addScaledVector(tA, -tC.dot(tA)).normalize();
    tB.crossVectors(tA, tC);
    tM.makeBasis(tB, tA, tC);
    g.quaternion.setFromRotationMatrix(tM);
    g.position.copy(tD).addScaledVector(tA, FOREARM - 0.095);
    // Brake line leaves the swivel above the fist.
    this.swivels[s].copy(g.position).addScaledVector(tA, 0.172).addScaledVector(tC, -0.014);
  }

  private anchors(inp: RigInput, lines: LineSet, sb: number, ears: number): void {
    const inv = inp.canopyInv;
    this.pod.updateMatrix();
    this.lean.updateMatrix();
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1;
      const side = s ? 1 : -1;
      for (let i = 0; i < RISERS.length; i++) {
        const r = RISERS[i];
        // The speed bar shortens the front risers.
        tA.set(sg * r.top.x, r.top.y, r.top.z);
        tB.set(sg * r.bottom.x, r.bottom.y, r.bottom.z);
        tC.subVectors(tA, tB);
        const len = tC.length();
        tC.multiplyScalar(1 / len);
        tA.copy(tB).addScaledVector(tC, len - r.bar * sb);
        // Instances: strap from its loop to the maillon, the maillon at the top.
        tQ.setFromUnitVectors(Y, tC);
        tS.set(1, len - r.bar * sb, 1);
        tM.compose(tB, tQ, tS);
        this.straps.setMatrixAt(s * 4 + i, tM);
        tS.set(1, 1, 1);
        tM.compose(tA, tQ, tS);
        this.maillons.setMatrixAt(s * 4 + i, tM);
        if (r.id === Anchor.A2 && ears > 0) {
          // Big ears: the outer A lines run to the hand pulling them.
          tD.copy(this.hands[s]).applyQuaternion(inv);
          tA.lerp(tD, Math.min(1, ears * 1.5));
        }
        lines.setAnchor(side, r.id, tA.x, tA.y, tA.z);
      }
      lines.setAnchor(side, Anchor.Pulley, sg * PULLEY.x, PULLEY.y, PULLEY.z);
      tA.copy(this.swivels[s]).applyQuaternion(inv);
      lines.setAnchor(side, Anchor.Handle, tA.x, tA.y, tA.z);
      // Speed system: bar ends → harness pulley → riser pulley.
      tA.set(sg * 0.17, 0, 0).add(this.bar.position).applyMatrix4(this.pod.matrix).applyMatrix4(this.lean.matrix).applyQuaternion(inv);
      lines.setAnchor(side, Anchor.Bar, tA.x, tA.y, tA.z);
      tA.set(sg * HARNESS_PULLEY.x, HARNESS_PULLEY.y, HARNESS_PULLEY.z).applyQuaternion(inv);
      lines.setAnchor(side, Anchor.HarnessPulley, tA.x, tA.y, tA.z);
      lines.setAnchor(side, Anchor.RiserPulley, sg * RISER_PULLEY.x, RISER_PULLEY.y - 0.1 * sb, RISER_PULLEY.z);
    }
    this.straps.instanceMatrix.needsUpdate = true;
    this.maillons.instanceMatrix.needsUpdate = true;
  }

  /** Cockpit instrument (altitude, vario, ground speed), redrawn twice a second when seen. */
  updateInstrument(st: GliderState, now: number, dt: number): void {
    const scr = this.instrument;
    if (!scr || typeof document === 'undefined') return;
    if (!this.screen) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 160;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.screen = { canvas, ctx, tex, next: 0, vario: 0 };
      const mat = scr.material as THREE.MeshBasicMaterial;
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    }
    const S = this.screen;
    S.vario += ((st.vz || 0) - S.vario) * Math.min(1, dt / 0.8);
    if (now < S.next) return;
    S.next = now + 500;
    const g = S.ctx;
    // E-ink look: light grey-green, black digits.
    g.fillStyle = '#c9cdbf';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#16181a';
    g.font = '600 15px system-ui, sans-serif';
    g.textBaseline = 'alphabetic';
    g.fillText('ALT m', 10, 22);
    g.fillText('VARIO m/s', 140, 22);
    g.font = '700 50px ui-monospace, Menlo, Consolas, monospace';
    g.fillText(String(Math.round(st.z || 0)), 8, 72);
    const v = S.vario;
    const vt = (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);
    g.font = '700 40px ui-monospace, Menlo, Consolas, monospace';
    g.fillText(vt, 136, 70);
    // Vario bar on the right edge.
    g.fillRect(244, 10, 2, 140);
    const hb = Math.max(-1, Math.min(1, v / 5)) * 68;
    g.fillRect(234, 80 - Math.max(0, hb), 10, Math.abs(hb));
    g.fillRect(230, 79, 18, 2);
    g.fillRect(8, 92, 222, 2);
    g.font = '600 15px system-ui, sans-serif';
    g.fillText('SOL km/h', 10, 116);
    g.fillText('AIR km/h', 140, 116);
    g.font = '700 30px ui-monospace, Menlo, Consolas, monospace';
    g.fillText(String(Math.round(Math.hypot(st.vx || 0, st.vy || 0) * 3.6)), 10, 148);
    g.fillText(String(Math.round((st.airspeed || 0) * 3.6)), 140, 148);
    S.tex.needsUpdate = true;
  }
}

/**
 * A distant pilot (other players beyond ~150 m): harness, body, helmet and risers in one
 * mesh, hands at mid-brake.
 */
let lowGeo: Geo | null = null;
export function lowPilotGeometry(): Geo {
  if (lowGeo) return lowGeo;
  const parts: Geo[] = [];
  parts.push(finish(loft(POD.filter((_, i) => i % 2 === 0).concat([POD[POD.length - 1]]), 10, 2.4, () => C.harness), C.harness));
  parts.push(finish(loft(REAR.filter((_, i) => i % 2 === 0).concat([REAR[REAR.length - 1]]), 10, 2.4, () => C.harness), C.harness));
  parts.push(ellipsoid(0.17, 0.25, 0.12, C.jacket, at(0, 0.0, 0.24, -0.48), 8, 6));
  parts.push(ellipsoid(0.13, 0.13, 0.15, C.helmet, at(0, 0.34, 0.41), 8, 6));
  for (const s of [-1, 1]) {
    parts.push(finish(new THREE.BoxGeometry(0.06, 0.32, 0.06), C.jacket, at(s * 0.25, 0.06, 0.12, 0.6, 0, s * 0.2)));
    parts.push(finish(new THREE.BoxGeometry(0.03, 0.47, 0.03), C.strap, at(s * 0.225, 0.235, -0.01, 0, 0, -s * 0.05)));
  }
  lowGeo = merge(parts);
  return lowGeo;
}

export function lowPilotMaterial(): THREE.Material {
  return materials().fabric;
}
