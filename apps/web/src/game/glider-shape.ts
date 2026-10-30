/**
 * Shape of the canopy and its deformations, written twice on purpose: once in GLSL (the
 * wing is deformed on the GPU, every vertex every frame, for free) and once in JS (the
 * line attachment points, a few hundred per frame). Both follow the same steps with the
 * same constants; keep them in sync. Only the GPU adds the simulated fabric's offsets
 * (glider-wing.ts): they are zero on the ribs, where the lines are tied.
 *
 * Wing of a 25 m² EN-B: flat span 11.3 m (flat AR 5.1), projected span 9.1 m, 50 cells,
 * root chord 2.65 m and 0.84 m at the tips, airfoil ~15 % thick with a rounded nose and a
 * flat lower surface. Canopy frame = glider frame (x right, y up, z back, metres) with the
 * carabiners at the origin; the canopy group may be rotated about them on the ground.
 *
 * Parameters of a point: a (span, −1 left tip … +1 right tip, proportional to the arc
 * length), tw (profile, −1 lower trailing edge … 0 nose … +1 upper trailing edge, the
 * chord fraction being c = tw²), v (position across its cell, 0..1, for the ballooning),
 * w and kind (0 surface, 1 tip closure with w = 0 on the profile … 1 on the camber line,
 * 2 stabilo with w = depth below the tip).
 */

export const HALF_SPAN = 5.65;
export const N_CELLS = 50;
/** Anhedral φ(α) = PHI_T α^PHI_P: flat centre, tips curling down to ~90°. */
const PHI_T = 1.55;
const PHI_P = 2.3;
/** Height of the centre of the arc (quarter-chord line) above the carabiners. */
const ARC_TOP = 7.3;
/** Chord: C0 √(1 − CK α^PHI_P). */
export const C0 = 2.65;
const CK = 0.9;
/** Quarter-chord line: ZQ0 at the centre (the pilot under ~30 % of the chord), swept back to the tips. */
const ZQ0 = -0.18;
const SWEEP = 0.38;
/** Trim angle (rad, leading edge above the trailing edge) and its change with the speed bar. */
const TAU0 = 0.05;
const SB_PITCH = 0.085;
/** NACA-like profile: thickness parameter (≈15 % with the flat lower surface), camber. */
const THICK0 = 0.19;
const CAMBER = 0.035;
const CAMBER_P = 0.38;
/** Ballooning of the cells (share of the cell width) and recess of the trailing edge between ribs. */
const BAL = 0.075;
const SCALLOP = 0.035;
/** Trailing edge pulled down at full brake (m) and stabilo depth (m). */
const BRAKE_DEF = 0.5;
const STAB_D = 0.34;

// Arc of the quarter-chord line as series in q = α^PHI_P (exact integral of the anhedral).
const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
const CX = [0, 1, 2, 3].map((n) => ((-1) ** n * PHI_T ** (2 * n)) / (fact(2 * n) * (2 * n * PHI_P + 1)));
const CY = [0, 1, 2, 3].map((n) => ((-1) ** n * PHI_T ** (2 * n + 1)) / (fact(2 * n + 1) * ((2 * n + 1) * PHI_P + 1)));

/** Ribs: arc position of rib k (0 centre … 25 tip) per side, cells narrower towards the tips. */
const RIB_K = 0.942;
const RIB_S = Math.sin(RIB_K);
export function ribA(k: number): number {
  return Math.sin((RIB_K * k) / (N_CELLS / 2)) / RIB_S;
}
/** Arc position of rib k counted from the left tip (0 … N_CELLS), signed (−1 … +1). */
export function ribSigned(k: number): number {
  const r = k - N_CELLS / 2;
  return Math.sign(r) * ribA(Math.abs(r));
}

/**
 * Grid of the simulated fabric's offsets (scripts/blender: the cloth's shape minus this
 * one, per brake level): BASIS_COLS columns along the span, three per cell, the ribs on
 * every third; BASIS_ROWS points round the profile from the lower trailing edge by the nose
 * to the upper one (the trailing edge on the first and the last).
 */
export const BASIS_COLS = N_CELLS * 3 + 1;
export const BASIS_ROWS = 33;
export const BASIS_LEVELS = [0, 0.35, 0.7, 1] as const;
/** Profile parameter of a basis row, and the cell of a column with the position across it. */
export function basisTw(j: number): number {
  return Math.sin((Math.PI / 2) * (-1 + (2 * j) / (BASIS_ROWS - 1)));
}
export function basisColumn(i: number): { a: number; v: number; cw: number } {
  const k = Math.min(N_CELLS - 1, Math.floor(i / 3));
  const v = i / 3 - k;
  const a0 = ribSigned(k);
  const a1 = ribSigned(k + 1);
  return { a: a0 + (a1 - a0) * v, v, cw: HALF_SPAN * Math.abs(a1 - a0) };
}

/** Chord positions of the line rows (A, B, C) and the trailing edge. */
export const ROWS = [0.11, 0.37, 0.66] as const;

/**
 * Deformation state, also the shader's uniforms (same layout).
 *
 * How the fabric is made to live (the architecture, see also docs/JEU.md « Voile vivante »):
 * a full cloth simulation of a 50-cell canopy (two skins, ribs, ~20 000 nodes, self-contact
 * in a collapse) costs milliseconds per frame even on a GPU; the budget is ~0.1 ms of CPU and
 * ~0.35 ms of GPU per glider. The wing is therefore a reduced-order model, as the fabric's own
 * physics allows: ripstop of ~40 g/m² stretches < 1 % under the ram-air pressure (q·Cp ≈
 * 60–90 Pa at trim, q = ½ρV² ≈ 65 Pa at 38 km/h), so while the cells are pressurised the
 * shape is the cut's (the analytic shape below, plus the Blender cloth's offsets per brake
 * level for the ballooning and the scalloped trailing edge); everything that moves is
 * low-dimensional and lives along the span: per station (DYN_N) the section's heave, surge
 * and twist and the leading edge's dent (`dyn`), and the fabric's state (`fab`): the cells'
 * internal pressure (filled through the openings, spread by the cross-ports, lost where the
 * leading edge tucks), the trailing edge's flap, the folded part's own flapping and the depth
 * of a frontal tuck (glider.ts WingDynamics, a few dozen springs on the CPU). The shader turns
 * low pressure into soft cells (the lower skin rising, the ballooning gone, the nose sinking,
 * the fabric crumpling, each cell popping full at its own pressure) and draws the wrinkles the
 * tension makes (line tabs, brake tabs, slack fabric): as geometry on the near tier
 * (`wrinkleG`), by perturbing the normal beyond. A folded part is not shaped analytically
 * near the camera but simulated as cloth (glider.ts FlapCloth, with contact and its lines):
 * `sheet`, `cloth`, drawn by `clothPoint` / `clothPos`.
 */
export interface WingDeform {
  /** brakeL, brakeR, speedbar, time (s). */
  brake: [number, number, number, number];
  /** Per side: fold line at the leading edge and at the trailing edge (span |a|), fold angle (rad), crumple (m). */
  foldL: [number, number, number, number];
  foldR: [number, number, number, number];
  /** frontal 0..1, flutter amplitude (m), stall 0..1, spin 0..1 (signed by its side). */
  misc: [number, number, number, number];
  /** Ground: cell filling 0..1 (1 flying), section pitch (rad), flattening 0..1, ground height (canopy frame, < −50 = none). */
  infl: [number, number, number, number];
  /** Up direction of the glider frame in the canopy frame (for the ground). */
  up: [number, number, number];
  /**
   * The canopy's own motion (glider.ts WingDynamics), per span station a = −1 + 2i/(DYN_N − 1):
   * heave (m, along the section's up), surge (m, along the chord, + = back), twist (rad, + =
   * nose up, about the quarter chord) and the dent of a soft leading edge 0..1.
   */
  dyn: Float32Array;
  /**
   * The fabric's state at the same stations: internal pressure (share of the trim's, 1 =
   * pressurised, 0 = empty), trailing-edge flap (m, + = up along the section), the folded
   * part's flapping (rad, added to the fold angle) and the depth of a frontal tuck 0..1.
   */
  fab: Float32Array;
  /** Line tension (load factor), turbulence 0..1 (the fragment shader's wrinkles), unused, unused. */
  air: [number, number, number, number];
  /**
   * The folded parts' cloth (glider.ts FlapCloth), per side (0 left, 1 right) a grid of
   * SHEET_NU nodes from the fold line (u = 0) to the tip (u = 1) by SHEET_NC rows across the
   * chord (SHEET_ROWS: leading edge, A, B, C rows, trailing edge), each node two texels of
   * four numbers (the uSheet texture as it is): position (canopy frame, m) and crumple
   * amplitude (m); the sheet's normal (towards the upper skin) and the skins' gap (m).
   * Index: sheetIndex().
   */
  sheet: Float32Array;
  /** The cloth drawn for the left and the right fold (1) or the analytic fold (0); unused; unused. */
  cloth: [number, number, number, number];
}

/** Nodes of a folded part's cloth along the span (fold line … tip) and its rows across the chord. */
export const SHEET_NU = 12;
/**
 * Node i of the span sits at u = (i / (SHEET_NU − 1))^SHEET_UP from the fold line: closer
 * together at the crease, where the fabric turns over (and leaves the open wing) within a few
 * decimetres.
 */
export const SHEET_UP = 1.5;
/** Width (share of the half span) over which the open wing pinches to its camber line at a cloth's crease. */
export const PINCH_W = 0.2;
export const SHEET_ROWS = [0, 0.11, 0.37, 0.66, 1] as const;
export const SHEET_NC = SHEET_ROWS.length;
/** Offset in WingDeform.sheet of node (i along the span, j across the chord) of side s (0 left, 1 right), texel k (0 position, 1 normal). */
export function sheetIndex(s: number, i: number, j: number, k: number): number {
  return (((s * SHEET_NC + j) * 2 + k) * SHEET_NU + i) * 4;
}

/** Span stations of the canopy's dynamics (both tips included: 2 per ~1.4 m of span). */
export const DYN_N = 17;

export function newDeform(): WingDeform {
  const fab = new Float32Array(DYN_N * 4);
  for (let k = 0; k < DYN_N; k++) fab[k * 4] = 1;
  return {
    brake: [0, 0, 0, 0],
    foldL: [2, 2, 0, 0],
    foldR: [2, 2, 0, 0],
    misc: [0, 0, 0, 0],
    infl: [1, 0, 0, -100],
    up: [0, 1, 0],
    dyn: new Float32Array(DYN_N * 4),
    fab,
    air: [1, 0, 0, 0],
    sheet: new Float32Array(2 * SHEET_NU * SHEET_NC * 8),
    cloth: [0, 0, 0, 0],
  };
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function camberLine(c: number): number {
  return c < CAMBER_P ? (CAMBER / (CAMBER_P * CAMBER_P)) * (2 * CAMBER_P * c - c * c) : (CAMBER / ((1 - CAMBER_P) * (1 - CAMBER_P))) * (1 - 2 * CAMBER_P + 2 * CAMBER_P * c - c * c);
}
/** Profile height (share of the chord) at tw (c = tw²) for a thickness parameter t. */
function profile(tw: number, t: number): number {
  const c = tw * tw;
  const sc = Math.abs(tw);
  const yt = 5 * t * (0.2969 * sc - 0.126 * c - 0.3516 * c * c + 0.2843 * c * c * c - 0.1036 * c * c * c * c);
  const yc = camberLine(c);
  return tw >= 0 ? yc + yt : yc - mix(1, 0.55, smooth(0, 0.12, c)) * yt;
}
/** Crumpled fabric: warped sines, irregular and slowly moving (−1..1). */
function noise(a: number, c: number, t: number): number {
  return 0.55 * Math.sin(a * 13.1 + c * 3.7 + t * 3.1 + 1.3 * Math.sin(c * 5.3 + t * 1.7)) * Math.sin(c * 7.9 - t * 1.9 + a * 5) + 0.3 * Math.sin(a * 31.7 - c * 11.3 + t * 5.3) + 0.15 * Math.sin(a * 71.3 + c * 23.9 + t * 9.1);
}

// Scratch frame of the JS version (no allocation per call).
const F = { ax: 0, ay: 0, tx: 0, ty: 0, nx: 0, ny: 0 };
function frame(a: number, alpha: number, q: number): void {
  const sg = a < 0 ? -1 : 1;
  const phi = PHI_T * q * sg;
  F.tx = Math.cos(phi);
  F.ty = -Math.sin(phi);
  F.nx = Math.sin(phi);
  F.ny = Math.cos(phi);
  const q2 = q * q;
  F.ax = sg * HALF_SPAN * alpha * (CX[0] + q2 * (CX[1] + q2 * (CX[2] + q2 * CX[3])));
  F.ay = ARC_TOP - HALF_SPAN * alpha * q * (CY[0] + q2 * (CY[1] + q2 * (CY[2] + q2 * CY[3])));
}
const stabDepth = (c: number) => STAB_D * Math.pow(Math.max(0, 1 - Math.abs(c - 0.5) / 0.42), 0.8);
const chordOf = (q: number) => C0 * Math.sqrt(Math.max(0.02, 1 - CK * q));
const zqOf = (alpha: number, q: number) => ZQ0 + SWEEP * alpha * q;

/** Row coordinate (0 … SHEET_NC − 1) of a chord position on the cloth's rows. */
export function sheetRow(c: number): number {
  for (let j = 0; j < SHEET_NC - 1; j++) if (c <= SHEET_ROWS[j + 1]) return j + Math.max(0, c - SHEET_ROWS[j]) / (SHEET_ROWS[j + 1] - SHEET_ROWS[j]);
  return SHEET_NC - 1;
}

/** Catmull-Rom weights at t (and their derivatives). */
const WX = new Float64Array(4);
const DX = new Float64Array(4);
const WY = new Float64Array(4);
function crw(t: number, w: Float64Array, dw: Float64Array | null): void {
  const t2 = t * t;
  const t3 = t2 * t;
  w[0] = -0.5 * t3 + t2 - 0.5 * t;
  w[1] = 1.5 * t3 - 2.5 * t2 + 1;
  w[2] = -1.5 * t3 + 2 * t2 + 0.5 * t;
  w[3] = 0.5 * t3 - 0.5 * t2;
  if (dw) {
    dw[0] = -1.5 * t2 + 2 * t - 0.5;
    dw[1] = 4.5 * t2 - 5 * t;
    dw[2] = -4.5 * t2 + 4 * t + 0.5;
    dw[3] = 1.5 * t2 - t;
  }
}

/** A point of a cloth sheet (sheetSample): position, crumple amplitude, unit normal, skins' gap, ∂position/∂u. */
export const SH = {
  x: 0,
  y: 0,
  z: 0,
  cr: 0,
  nx: 0,
  ny: 1,
  nz: 0,
  th: 0,
  ux: 0,
  uy: 0,
  uz: 0,
};

/**
 * The cloth of side `s` at (u along the span from the fold line, c along the chord): a
 * bicubic (Catmull-Rom) through the nodes, into SH. JS twin of `sheetAt` in WING_GLSL.
 */
export function sheetSample(sheet: Float32Array, s: number, u: number, c: number): typeof SH {
  const uq = Math.pow(clamp(u, 0, 1), 1 / SHEET_UP);
  const xs = uq * (SHEET_NU - 1);
  const i1 = Math.min(SHEET_NU - 2, Math.floor(xs));
  const ys = sheetRow(clamp(c, 0, 1));
  const j1 = Math.min(SHEET_NC - 2, Math.floor(ys));
  crw(xs - i1, WX, DX);
  crw(ys - j1, WY, null);
  let x = 0;
  let y = 0;
  let z = 0;
  let cr = 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let th = 0;
  let ux = 0;
  let uy = 0;
  let uz = 0;
  for (let dj = 0; dj < 4; dj++) {
    const j = Math.min(SHEET_NC - 1, Math.max(0, j1 - 1 + dj));
    for (let di = 0; di < 4; di++) {
      const i = Math.min(SHEET_NU - 1, Math.max(0, i1 - 1 + di));
      const w = WX[di] * WY[dj];
      const wd = DX[di] * WY[dj];
      const o = sheetIndex(s, i, j, 0);
      const on = o + SHEET_NU * 4;
      x += w * sheet[o];
      y += w * sheet[o + 1];
      z += w * sheet[o + 2];
      cr += w * sheet[o + 3];
      nx += w * sheet[on];
      ny += w * sheet[on + 1];
      nz += w * sheet[on + 2];
      th += w * sheet[on + 3];
      ux += wd * sheet[o];
      uy += wd * sheet[o + 1];
      uz += wd * sheet[o + 2];
    }
  }
  const nl = Math.hypot(nx, ny, nz) || 1;
  SH.x = x;
  SH.y = y;
  SH.z = z;
  SH.cr = Math.max(0, cr);
  SH.nx = nx / nl;
  SH.ny = ny / nl;
  SH.nz = nz / nl;
  SH.th = Math.max(0, th);
  // d/du = d/dxs · dxs/du, dxs/du = (SHEET_NU − 1) uq^(1 − SHEET_UP) / SHEET_UP.
  const k = ((SHEET_NU - 1) * Math.pow(Math.max(uq, 0.02), 1 - SHEET_UP)) / SHEET_UP;
  SH.ux = ux * k;
  SH.uy = uy * k;
  SH.uz = uz * k;
  return SH;
}

/**
 * The quarter-chord arc at span a (−1 … 1): point (ax, ay), tangent towards increasing a
 * (tx, ty; |dA/da| = HALF_SPAN), the section's up (nx, ny), chord and quarter-chord z, for
 * the cloth's contact with the open wing.
 */
export const ARC = {
  ax: 0,
  ay: 0,
  tx: 1,
  ty: 0,
  nx: 0,
  ny: 1,
  ch: C0,
  zq: ZQ0,
  tk: THICK0,
};
/** The same, tabulated (ARC_N samples over −1 … 1, linear between: within a millimetre), for the cloth's many queries. */
const ARC_N = 513;
const ARC_TAB = (() => {
  const t = new Float32Array(ARC_N * 9);
  for (let k = 0; k < ARC_N; k++) {
    const a = -1 + (2 * k) / (ARC_N - 1);
    const alpha = Math.min(Math.abs(a), 1);
    const q = Math.pow(alpha, PHI_P);
    frame(a === 0 ? 1e-9 : a, alpha, q);
    t.set([F.ax, F.ay, F.tx, F.ty, F.nx, F.ny, chordOf(q), zqOf(alpha, q), THICK0 * (1 - 0.35 * alpha * alpha)], k * 9);
  }
  return t;
})();
export function arcAt(a: number): typeof ARC {
  const xs = (clamp(a, -1, 1) + 1) * 0.5 * (ARC_N - 1);
  const k = Math.min(ARC_N - 2, Math.floor(xs));
  const f = xs - k;
  const t = ARC_TAB;
  const o = k * 9;
  ARC.ax = t[o] + (t[o + 9] - t[o]) * f;
  ARC.ay = t[o + 1] + (t[o + 10] - t[o + 1]) * f;
  ARC.tx = t[o + 2] + (t[o + 11] - t[o + 2]) * f;
  ARC.ty = t[o + 3] + (t[o + 12] - t[o + 3]) * f;
  ARC.nx = t[o + 4] + (t[o + 13] - t[o + 4]) * f;
  ARC.ny = t[o + 5] + (t[o + 14] - t[o + 5]) * f;
  ARC.ch = t[o + 6] + (t[o + 15] - t[o + 6]) * f;
  ARC.zq = t[o + 7] + (t[o + 16] - t[o + 7]) * f;
  ARC.tk = t[o + 8] + (t[o + 17] - t[o + 8]) * f;
  return ARC;
}
/** The span a whose section plane holds (x, y) (canopy frame), by Newton steps from `a0`. */
export function arcSolve(x: number, y: number, a0: number, steps = 2): number {
  let a = clamp(a0, -1, 1);
  for (let k = 0; k < steps; k++) {
    arcAt(a);
    a = clamp(a + ((x - ARC.ax) * ARC.tx + (y - ARC.ay) * ARC.ty) / HALF_SPAN, -1, 1);
  }
  arcAt(a);
  return a;
}
/**
 * Heights (m, along the section's up from the quarter-chord arc) of the flying wing's lower
 * and upper skins at (a, c), with the brake and the span's heave: the open wing the cloth of
 * a folded part may not enter (an approximation of wingPoint: no ballooning, trim pitch).
 */
export const SKIN = { lo: 0, up: 0 };
export function intactSkins(d: WingDeform, a: number, c: number): typeof SKIN {
  const alpha = Math.min(Math.abs(a), 1);
  arcAt(a);
  const ch = ARC.ch;
  const tk = ARC.tk;
  const sq = Math.sqrt(clamp(c, 0, 1));
  const br = a < 0 ? d.brake[0] : d.brake[1];
  let f = Math.max(0, (c - 0.42) / 0.58);
  f *= f;
  const disp = BRAKE_DEF * br * clamp(alpha * 1.45, 0, 1) * f * Math.sqrt(ch / C0);
  const xs = (clamp(a, -1, 1) + 1) * 0.5 * (DYN_N - 1);
  const i0 = Math.min(DYN_N - 2, Math.floor(xs)) * 4;
  const heave = mix(d.dyn[i0], d.dyn[i0 + 4], xs - i0 / 4);
  let lo = profile(-sq, tk) * ch;
  let up = profile(sq, tk) * ch;
  // Pinched at a cloth's crease (as wingPoint draws it).
  for (let s = 0; s < 2; s++) {
    const fs = s ? d.foldR : d.foldL;
    if (d.cloth[s] <= 0 || fs[2] <= 0.001) continue;
    const pin = 1 - 0.92 * smooth(mix(fs[0], fs[1], c) - PINCH_W, mix(fs[0], fs[1], c), s ? a : -a);
    const cam = camberLine(c) * ch;
    lo = cam + (lo - cam) * pin;
    up = cam + (up - cam) * pin;
  }
  SKIN.lo = lo - disp + heave;
  SKIN.up = up - disp + heave;
  return SKIN;
}

const CT0 = Math.cos(TAU0);
const ST0 = Math.sin(TAU0);
/** The open wing's camber line at (a, c) flying at trim, nothing else: the cloth's rest shape (a point of wingPoint's frame). */
export function restPoint(a: number, c: number, out: Vec3Like): Vec3Like {
  arcAt(a);
  const ch = ARC.ch;
  const hh = camberLine(c) * ch;
  const dd = (c - 0.25) * ch;
  const k = hh * CT0 - dd * ST0;
  out.x = ARC.ax + ARC.nx * k;
  out.y = ARC.ay + ARC.ny * k;
  out.z = ARC.zq + dd * CT0 + hh * ST0;
  return out;
}

/** Pressure share at which a cell pops full (each its own: their fabric and cross-ports differ a little). */
const popAt = (kr: number, sg: number) => 0.28 + 0.24 * ((Math.floor(kr) * 0.618034 + sg * 0.31 + 10) % 1);

/**
 * A point of a folded part drawn by its cloth (JS twin of `clothPos` in WING_GLSL): the
 * sheet at (u, c), the two skins pressed together on either side of it (their gap, a few
 * centimetres where air is left), both crumpled alike into pleats as far as the cloth is
 * compressed; no pleat on the crease itself. The stabilo hangs from the tip's edge.
 */
function clothPoint(d: WingDeform, s: number, m: number, fe: number, a: number, tw: number, w: number, kind: number, out: Vec3Like): Vec3Like {
  const c = tw * tw;
  const u = clamp((m - fe) / Math.max(1e-3, 1 - fe), 0, 1);
  const S = sheetSample(d.sheet, s, u, c);
  const time = d.brake[3];
  let off = 0;
  if (kind !== 2) {
    const X = a * HALF_SPAN;
    const ramp = smooth(0, 0.1, u);
    const pleat = S.cr * ramp * (0.65 * Math.sin(X * 11.4 + c * 2 + time * 1.7 + 1.6 * Math.sin(X * 3.7 - c * 3.1 + time * 0.9)) + 0.55 * noise(a, c, time));
    const gap = 0.5 * S.th * (1 - (kind === 1 ? w : 0)) * (1 + 0.6 * noise(a * 2.1 + 1.3, c * 1.7, time * 0.5));
    off = pleat + (tw >= 0 ? gap : -gap);
  }
  let px = S.x + S.nx * off;
  let py = S.y + S.ny * off;
  let pz = S.z + S.nz * off;
  if (kind === 2) {
    const ul = Math.hypot(S.ux, S.uy, S.uz) || 1;
    const sd = stabDepth(c) * w;
    px += ((S.ux / ul) * 0.878 - S.nx * 0.479) * sd;
    py += ((S.uy / ul) * 0.878 - S.ny * 0.479) * sd;
    pz += ((S.uz / ul) * 0.878 - S.nz * 0.479) * sd;
  }
  out.x = px;
  out.y = py;
  out.z = pz;
  return out;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Deformed position of a wing point in the canopy frame (JS twin of `wingPos` in
 * WING_GLSL), written into `out` without allocating.
 */
export function wingPoint(d: WingDeform, a: number, tw: number, v: number, w: number, kind: number, cw: number, out: Vec3Like): Vec3Like {
  const sg = a < 0 ? -1 : 1;
  const alpha = Math.min(Math.abs(a), 1);
  const q = Math.pow(alpha, PHI_P);
  const ch = chordOf(q);
  const c = tw * tw;
  const time = d.brake[3];
  const fold = sg < 0 ? d.foldL : d.foldR;
  const fe = mix(fold[0], fold[1], c);
  // A folded part drawn by its cloth (glider.ts FlapCloth); a big fold reaches past the centre.
  // Elsewhere the open wing pinches to its camber line along the cloth's fold line (the crease).
  let pinch = 1;
  let clothOwn = false;
  for (let s = 0; s < 2; s++) {
    const fs = s ? d.foldR : d.foldL;
    if (d.cloth[s] <= 0 || fs[2] <= 0.001) continue;
    const m = s ? a : -a;
    const fes = mix(fs[0], fs[1], c);
    if (m > fes && fes < 1) return clothPoint(d, s, m, fes, a, tw, w, kind, out);
    pinch = Math.min(pinch, 1 - 0.92 * smooth(fes - PINCH_W, fes, m));
    if ((s ? 1 : -1) === sg) clothOwn = true;
  }
  const folding = fold[2] > 0.001 && !clothOwn;
  const stall = d.misc[2];
  const spin = d.misc[3];
  // The canopy's own motion at this span station (linear between the stations).
  const xs = (clamp(a, -1, 1) + 1) * 0.5 * (DYN_N - 1);
  const i0 = Math.min(DYN_N - 2, Math.floor(xs)) * 4;
  const fs = xs - i0 / 4;
  const dy = d.dyn;
  const heave = mix(dy[i0], dy[i0 + 4], fs);
  const surge = mix(dy[i0 + 1], dy[i0 + 5], fs);
  const twist = mix(dy[i0 + 2], dy[i0 + 6], fs);
  const dent = mix(dy[i0 + 3], dy[i0 + 7], fs);
  const fb = d.fab;
  const pres = mix(fb[i0], fb[i0 + 4], fs);
  const teFlap = mix(fb[i0 + 1], fb[i0 + 5], fs);
  const flap = mix(fb[i0 + 2], fb[i0 + 6], fs);
  const fr = clamp(mix(fb[i0 + 3], fb[i0 + 7], fs), 0, 1);
  // Soft cells: the pressure no longer holds the profile (below ~half the trim's). Each cell
  // pops full at its own pressure, the ribs (which the lines hold) following the stations.
  const kr = (Math.asin(Math.min(alpha * RIB_S, 1)) / RIB_K) * (N_CELLS / 2);
  let soft = 1 - smooth(0.08, 0.6, pres);
  if (kind === 0 && v > 0 && v < 1) {
    const pa = popAt(kr, sg);
    soft = mix(soft, 1 - smooth(pa - 0.06, pa + 0.06, pres), Math.sin(Math.PI * v));
  }
  // Deflation: on the ground before the cells fill (leading edge first, the centre before
  // the tips), in a stall, on the inner side of a spin, next to a collapsed part.
  const fill = d.infl[0];
  let defl = mix(0.08, 1, clamp(fill * 1.4 - c * 0.4 - 0.45 * alpha * alpha * (1 - fill), 0, 1)) * (1 - 0.45 * stall) * (1 - 0.5 * Math.max(0, spin * sg) * alpha);
  if (folding) defl *= mix(1, 0.55, smooth(fe - 0.18, fe, alpha));
  let hh = profile(tw, THICK0 * (1 - 0.35 * alpha * alpha)) * ch * defl;
  // Losing its pressure, the cell flattens: the lower skin rises towards the upper one, held
  // up by the suction over it.
  if (soft > 0) hh *= 1 - soft * (tw >= 0 ? 0.2 : 0.55);
  if (kind === 1) hh = mix(hh, camberLine(c) * ch * defl, w);
  if (pinch < 1) hh = mix(camberLine(c) * ch * defl, hh, pinch);
  let dd = (c - 0.25) * ch;
  if (kind === 0) {
    const sv = Math.sin(Math.PI * v);
    hh += Math.sign(tw) * BAL * (tw >= 0 ? 1 : 0.6) * cw * sv * smooth(0.03, 0.15, c) * (1 - smooth(0.72, 1, c)) * defl * (0.2 + 0.8 * smooth(0.05, 0.7, pres)) * pinch;
    const te = Math.max(0, (c - 0.88) / 0.12);
    dd -= SCALLOP * sv * te * te;
    // A soft leading edge (the angle of attack near the fold, a lull, the pressure going):
    // the nose of each cell sinks in and wrinkles across the span before a collapse.
    const dn = Math.min(1, dent + 0.8 * soft);
    if (dn > 0.001) {
      const nose = smooth(0.0, 0.04, c) * (1 - smooth(0.12, 0.3, c));
      hh -= dn * nose * ch * (tw >= 0 ? 0.035 : -0.012) * (0.55 + 0.45 * sv);
    }
    // Slack fabric crumples, behind the nose: the rods sewn into the leading edge (nylon,
    // ~15 % of the chord) keep its curve.
    if (soft > 0.01) hh += soft * ch * 0.016 * noise(a * 1.2, c * 1.3, time * 0.8) * smooth(0.03, 0.16, c);
  }
  // Brake: the rear of the profile curls down, more towards the tips; the trailing edge is
  // pulled at the brake tabs (every second rib) and sags less between them.
  const br = sg < 0 ? d.brake[0] : d.brake[1];
  let f = Math.max(0, (c - 0.42) / 0.58);
  f *= f;
  let disp = BRAKE_DEF * br * clamp(alpha * 1.45, 0, 1) * f * Math.sqrt(ch / C0);
  if (disp > 0) disp *= 1 - 0.22 * smooth(0.8, 1, c) * (0.5 - 0.5 * Math.cos(Math.PI * kr));
  hh -= disp;
  dd -= (0.5 * disp * disp) / (0.58 * ch);
  // The trailing edge's own flap: the rear of the section bends about ~55 % of the chord.
  const tf = Math.max(0, (c - 0.55) / 0.45);
  hh += teFlap * tf * tf;
  // Frontal (its depth at this station): the front of the profile tucks under, deeper in the centre.
  if (fr > 0.001) {
    const cf = 0.12 + 0.36 * fr * (1 - 0.45 * alpha * alpha);
    if (c < cf) {
      const ddf = (cf - 0.25) * ch;
      const hhf = profile(-Math.sqrt(cf), THICK0 * (1 - 0.35 * alpha * alpha)) * ch * defl;
      const psi = fr * 2.7;
      const wF = 0.35;
      const k = psi / wF;
      const u = ddf - dd;
      const s = Math.min(u, wF);
      let wv = (hh - hhf) * mix(1, 0.45, Math.min(1, u / wF)) + noise(a, c, time) * fr * 0.05;
      const th = s * k;
      const rest = Math.max(0, u - wF);
      dd = ddf - Math.sin(th) / k - rest * Math.cos(psi) - wv * Math.sin(th);
      wv = hhf - (1 - Math.cos(th)) / k - rest * Math.sin(psi) + wv * Math.cos(th);
      hh = wv;
    }
  }
  // On the ground: the sections lie along the lines (flat behind the pilot) until they fly.
  const gam = d.infl[1];
  if (gam !== 0) {
    const ddA = (ROWS[0] - 0.25) * ch;
    const hhA = profile(-Math.sqrt(ROWS[0]), THICK0) * ch * defl;
    const x = dd - ddA;
    const y = hh - hhA;
    const cg = Math.cos(gam);
    const sgm = Math.sin(gam);
    dd = ddA + x * cg - y * sgm;
    hh = hhA + x * sgm + y * cg;
  }
  // Section frame on the arc; the speed bar pitches the section down about the C row.
  const tau = TAU0 - SB_PITCH * d.brake[2];
  const ct = Math.cos(tau);
  const st = Math.sin(tau);
  const ct0 = Math.cos(TAU0);
  const st0 = Math.sin(TAU0);
  let px: number, py: number, pz: number;
  let hx: number, hy: number, hz: number;
  if (folding && alpha > fe) {
    // Folded part: bent under the wing around the fold line, deflated and crumpled.
    const ae = sg * fe;
    const alE = Math.min(Math.abs(ae), 1);
    const qE = Math.pow(alE, PHI_P);
    frame(ae, alE, qE);
    const chE = chordOf(qE);
    const dX = -F.nx * st;
    const dY = -F.ny * st;
    const dZ = ct;
    hx = F.nx * ct;
    hy = F.ny * ct;
    hz = st;
    const piv = (0.66 - 0.25) * chE;
    const ox = F.ax + (-F.nx * st0 - dX) * piv;
    const oy = F.ay + (-F.ny * st0 - dY) * piv;
    const oz = zqOf(alE, qE) + (ct0 - dZ) * piv;
    const tox = sg * F.tx;
    const toy = sg * F.ty;
    // Arc length from the fold line, the folded fabric bunched up (more the more it crumples).
    const sb = (alpha - fe) * HALF_SPAN * (0.82 - 1.5 * fold[3]);
    // The fold's angle and the folded part's own flapping at this station.
    const psi = Math.max(0.002, fold[2] + flap);
    const wB = 0.4;
    const k = psi / wB;
    const th = Math.min(sb, wB) * k;
    const s1 = Math.sin(th) / k;
    const c1 = (1 - Math.cos(th)) / k;
    let cx = tox * s1 - hx * c1;
    let cy = toy * s1 - hy * c1;
    let cz = -hz * c1;
    if (sb > wB) {
      const r = sb - wB;
      cx += (tox * Math.cos(psi) - hx * Math.sin(psi)) * r;
      cy += (toy * Math.cos(psi) - hy * Math.sin(psi)) * r;
      cz += -hz * Math.sin(psi) * r;
    }
    const nx = hx * Math.cos(th) + tox * Math.sin(th);
    const ny = hy * Math.cos(th) + toy * Math.sin(th);
    const nz = hz * Math.cos(th);
    const ramp = Math.min(1, sb / wB);
    // The folded fabric bunches into pleats across the flap (~0.55 m apart, moving) and its
    // rear trails back in the wake, more the further out.
    const hf = hh * mix(1, 0.35, ramp) + fold[3] * (noise(a, c, time) + 0.9 * Math.sin(sb * 11.4 + c * 2 + time * 1.7 + 1.6 * Math.sin(sb * 3.7 - c * 3.1 + time * 0.9))) * ramp;
    const dz2 = dd + zqOf(alpha, q) - zqOf(alE, qE) + 0.3 * Math.min(1, sb / 1.5) * c * ramp;
    px = ox + cx + nx * hf + dX * dz2;
    py = oy + cy + ny * hf + dY * dz2;
    pz = oz + cz + nz * hf + dZ * dz2;
    if (kind === 2) {
      const sd = stabDepth(c) * w;
      px -= nx * sd;
      py -= ny * sd;
      pz -= nz * sd;
    }
  } else {
    frame(a, alpha, q);
    const dX = -F.nx * st;
    const dY = -F.ny * st;
    const dZ = ct;
    hx = F.nx * ct;
    hy = F.ny * ct;
    hz = st;
    const piv = (0.66 - 0.25) * ch;
    px = F.ax + (-F.nx * st0 - dX) * piv + dX * dd + hx * hh;
    py = F.ay + (-F.ny * st0 - dY) * piv + dY * dd + hy * hh;
    pz = zqOf(alpha, q) + (ct0 - dZ) * piv + dZ * dd + hz * hh;
    if (kind === 2) {
      // Stabilo: a fin continuing the tip down towards the lines.
      const sd = stabDepth(c) * w;
      px += (sg * F.tx * 0.878 - hx * 0.479) * sd;
      py += (sg * F.ty * 0.878 - hy * 0.479) * sd;
      pz += -hz * 0.479 * sd;
    }
  }
  // The stabilo, a fin of fabric under the tip, swings with the trailing edge and trails a surge.
  if (kind === 2) {
    const ws = w * w;
    px += hx * teFlap * 1.8 * ws;
    py += hy * teFlap * 1.8 * ws;
    pz += hz * teFlap * 1.8 * ws + 0.3 * surge * ws;
  }
  // The canopy's own motion: the section heaves along its up, surges along its chord and
  // twists about its quarter chord.
  const hd = heave - dd * twist;
  px += hx * hd + -F.nx * st * surge;
  py += hy * hd + -F.ny * st * surge;
  pz += hz * hd + ct * surge;
  // Stall: the tips come forward (horseshoe), the span shrinks, the fabric flaps.
  if (stall > 0.001) {
    pz += stall * (0.5 - 1.6 * alpha * alpha);
    px *= 1 - 0.2 * stall * alpha * alpha;
    const n = stall * 0.16 * noise(a * 0.7, c, time * 1.3);
    px += hx * n;
    py += hy * n;
    pz += hz * n;
  }
  // Spin: the wing yaws, the inner side going back.
  if (spin !== 0) {
    const b = -spin * 0.4;
    const x = px * Math.cos(b) + pz * Math.sin(b);
    pz = -px * Math.sin(b) + pz * Math.cos(b);
    px = x;
  }
  // Trailing edge flutter, held at the brake tabs (every second rib), free between them.
  let fl = 0;
  if (c > 0.75) {
    const sk = Math.sin((Math.PI / 2) * kr);
    fl = d.misc[1] * Math.sin(time * 19 + a * 27 + c * 6) * smooth(0.75, 1, c) * (0.35 + 0.65 * sk * sk);
  }
  px += hx * fl;
  py += hy * fl;
  pz += hz * fl;
  // Ground: nothing below it; laid flat before the inflation.
  const gy = d.infl[3];
  if (gy > -50) {
    const ux = d.up[0];
    const uy = d.up[1];
    const uz = d.up[2];
    const yW = ux * px + uy * py + uz * pz;
    let y2 = Math.max(yW, gy + 0.01);
    y2 = mix(y2, gy + 0.01 + (tw > 0 ? 0.03 : 0.0), d.infl[2]);
    const dy = y2 - yW;
    px += ux * dy;
    py += uy * dy;
    pz += uz * dy;
  }
  out.x = px;
  out.y = py;
  out.z = pz;
  return out;
}

const f = (n: number) => {
  const s = n.toString();
  return s.includes('.') || s.includes('e') ? s : `${s}.0`;
};

/** GLSL twin of wingPoint: `vec3 wingPos(float a, float tw, float v, float w, float kind, float cw)`. */
export const WING_GLSL = /* glsl */ `
uniform vec4 uBrake;
uniform vec4 uFoldL;
uniform vec4 uFoldR;
uniform vec4 uMisc;
uniform vec4 uInfl;
uniform vec3 uUp;
uniform vec4 uDyn[${DYN_N}];
uniform vec4 uFab[${DYN_N}];
uniform sampler2D uBasis;
uniform vec4 uBasisScale;
uniform float uBasisOn;
uniform sampler2D uSheet;
uniform vec4 uCloth;
float wFoldWeight;
float wSoft;
float wWrinkle;
#ifndef NO_BALLOON
// The cloth simulation's offsets from this shape (scripts/blender/canopy-sim.py), at a brake
// level (the four simulated ones linearly between); zero on the ribs and the line tabs.
vec3 basisAt(float sg, float kr, float tw, float br) {
  float x = (${f((BASIS_COLS - 1) / 2)} + sg * kr * 3.0 + 0.5) / ${f(BASIS_COLS)};
  float row = (asin(clamp(tw, -1.0, 1.0)) * ${f(2 / Math.PI)} + 1.0) * ${f((BASIS_ROWS - 1) / 2)} + 0.5;
  float b = clamp(br, 0.0, 1.0);
  float lp = b < ${f(BASIS_LEVELS[1])} ? b / ${f(BASIS_LEVELS[1])} : b < ${f(BASIS_LEVELS[2])} ? 1.0 + (b - ${f(BASIS_LEVELS[1])}) / ${f(BASIS_LEVELS[2] - BASIS_LEVELS[1])} : 2.0 + (b - ${f(BASIS_LEVELS[2])}) / ${f(BASIS_LEVELS[3] - BASIS_LEVELS[2])};
  float l0 = min(floor(lp), 2.0);
  vec4 s0 = vec4(equal(vec4(l0), vec4(0.0, 1.0, 2.0, 3.0)));
  vec4 s1 = vec4(equal(vec4(l0 + 1.0), vec4(0.0, 1.0, 2.0, 3.0)));
  vec3 o0 = (texture2D(uBasis, vec2(x, (l0 * ${f(BASIS_ROWS)} + row) / ${f(BASIS_ROWS * BASIS_LEVELS.length)})).xyz * 255.0 - 128.0) * (dot(uBasisScale, s0) / 127.0);
  vec3 o1 = (texture2D(uBasis, vec2(x, ((l0 + 1.0) * ${f(BASIS_ROWS)} + row) / ${f(BASIS_ROWS * BASIS_LEVELS.length)})).xyz * 255.0 - 128.0) * (dot(uBasisScale, s1) / 127.0);
  return mix(o0, o1, lp - l0);
}
#endif
float camberLine(float c) {
  return c < ${f(CAMBER_P)} ? ${f(CAMBER / (CAMBER_P * CAMBER_P))} * (${f(2 * CAMBER_P)} * c - c * c) : ${f(CAMBER / ((1 - CAMBER_P) * (1 - CAMBER_P)))} * (${f(1 - 2 * CAMBER_P)} + ${f(2 * CAMBER_P)} * c - c * c);
}
float profileH(float tw, float t) {
  float c = tw * tw;
  float sc = abs(tw);
  float yt = 5.0 * t * (0.2969 * sc - 0.126 * c - 0.3516 * c * c + 0.2843 * c * c * c - 0.1036 * c * c * c * c);
  float yc = camberLine(c);
  return tw >= 0.0 ? yc + yt : yc - mix(1.0, 0.55, smoothstep(0.0, 0.12, c)) * yt;
}
float crumpleN(float a, float c, float t) {
  return 0.55 * sin(a * 13.1 + c * 3.7 + t * 3.1 + 1.3 * sin(c * 5.3 + t * 1.7)) * sin(c * 7.9 - t * 1.9 + a * 5.0) + 0.3 * sin(a * 31.7 - c * 11.3 + t * 5.3) + 0.15 * sin(a * 71.3 + c * 23.9 + t * 9.1);
}
void arcFrame(float a, float alpha, float q, out vec2 A, out vec2 T, out vec2 N) {
  float sg = a < 0.0 ? -1.0 : 1.0;
  float phi = ${f(PHI_T)} * q * sg;
  T = vec2(cos(phi), -sin(phi));
  N = vec2(sin(phi), cos(phi));
  float q2 = q * q;
  A = vec2(sg * ${f(HALF_SPAN)} * alpha * (${f(CX[0])} + q2 * (${f(CX[1])} + q2 * (${f(CX[2])} + q2 * ${f(CX[3])}))),
           ${f(ARC_TOP)} - ${f(HALF_SPAN)} * alpha * q * (${f(CY[0])} + q2 * (${f(CY[1])} + q2 * (${f(CY[2])} + q2 * ${f(CY[3])}))));
}
float stabDepth(float c) { return ${f(STAB_D)} * pow(max(0.0, 1.0 - abs(c - 0.5) / 0.42), 0.8); }
float chordOf(float q) { return ${f(C0)} * sqrt(max(0.02, 1.0 - ${f(CK)} * q)); }
float chordAt(float a) { return chordOf(pow(min(abs(a), 1.0), ${f(PHI_P)})); }
float zqOf(float alpha, float q) { return ${f(ZQ0)} + ${f(SWEEP)} * alpha * q; }
#ifndef NO_CLOTH
// The folded parts' cloth (WingDeform.sheet): node (i, j) of side s, texel k (0 position, 1 normal).
vec4 sheetTexel(float s, float i, float j, float k) {
  return texture2D(uSheet, vec2((i + 0.5) / ${f(SHEET_NU)}, ((s * ${f(SHEET_NC)} + j) * 2.0 + k + 0.5) / ${f(SHEET_NC * 4)}));
}
float sheetRowOf(float c) {
  return c <= ${f(SHEET_ROWS[1])} ? c / ${f(SHEET_ROWS[1])} : c <= ${f(SHEET_ROWS[2])} ? 1.0 + (c - ${f(SHEET_ROWS[1])}) / ${f(SHEET_ROWS[2] - SHEET_ROWS[1])} : c <= ${f(SHEET_ROWS[3])} ? 2.0 + (c - ${f(SHEET_ROWS[2])}) / ${f(SHEET_ROWS[3] - SHEET_ROWS[2])} : 3.0 + (c - ${f(SHEET_ROWS[3])}) / ${f(SHEET_ROWS[4] - SHEET_ROWS[3])};
}
vec4 crw(float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return vec4(-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2);
}
vec4 crwD(float t) {
  float t2 = t * t;
  return vec4(-1.5 * t2 + 2.0 * t - 0.5, 4.5 * t2 - 5.0 * t, -4.5 * t2 + 4.0 * t + 0.5, 1.5 * t2 - t);
}
// Bicubic (Catmull-Rom) through the nodes: position and crumple (P), normal and the skins' gap (N), d(position)/du (U).
void sheetAt(float s, float u, float c, out vec4 P, out vec4 N, out vec3 U) {
  float uq = pow(clamp(u, 0.0, 1.0), ${f(1 / SHEET_UP)});
  float xs = uq * ${f(SHEET_NU - 1)};
  float i1 = min(${f(SHEET_NU - 2)}, floor(xs));
  float ys = sheetRowOf(clamp(c, 0.0, 1.0));
  float j1 = min(${f(SHEET_NC - 2)}, floor(ys));
  vec4 wx = crw(xs - i1);
  vec4 dx = crwD(xs - i1);
  vec4 wy = crw(ys - j1);
  P = vec4(0.0);
  N = vec4(0.0);
  U = vec3(0.0);
  for (int dj = 0; dj < 4; dj++) {
    float j = clamp(j1 - 1.0 + float(dj), 0.0, ${f(SHEET_NC - 1)});
    float wj = dj == 0 ? wy.x : dj == 1 ? wy.y : dj == 2 ? wy.z : wy.w;
    for (int di = 0; di < 4; di++) {
      float i = clamp(i1 - 1.0 + float(di), 0.0, ${f(SHEET_NU - 1)});
      float wi = di == 0 ? wx.x : di == 1 ? wx.y : di == 2 ? wx.z : wx.w;
      float di_ = di == 0 ? dx.x : di == 1 ? dx.y : di == 2 ? dx.z : dx.w;
      vec4 tp = sheetTexel(s, i, j, 0.0);
      P += tp * (wi * wj);
      N += sheetTexel(s, i, j, 1.0) * (wi * wj);
      U += tp.xyz * (di_ * wj);
    }
  }
  N.xyz = normalize(N.xyz);
  U *= ${f(SHEET_NU - 1)} * pow(max(uq, 0.02), ${f(1 - SHEET_UP)}) / ${f(SHEET_UP)};
}
// A folded part drawn by its cloth (JS twin: clothPoint): the two skins pressed together on
// either side of the sheet, crumpled alike into pleats as far as it is compressed.
vec3 clothPos(float s, float m, float fe, float a, float tw, float w, float kind) {
  float c = tw * tw;
  float u = clamp((m - fe) / max(1e-3, 1.0 - fe), 0.0, 1.0);
  vec4 P;
  vec4 N;
  vec3 U;
  sheetAt(s, u, c, P, N, U);
  float time = uBrake.w;
  vec3 pos = P.xyz;
  if (kind < 1.5) {
    float X = a * ${f(HALF_SPAN)};
    float ramp = smoothstep(0.0, 0.1, u);
    float pleat = max(0.0, P.w) * ramp * (0.65 * sin(X * 11.4 + c * 2.0 + time * 1.7 + 1.6 * sin(X * 3.7 - c * 3.1 + time * 0.9)) + 0.55 * crumpleN(a, c, time));
    float gap = 0.5 * max(0.0, N.w) * (1.0 - (kind > 0.5 ? w : 0.0)) * (1.0 + 0.6 * crumpleN(a * 2.1 + 1.3, c * 1.7, time * 0.5));
    pos += N.xyz * (pleat + (tw >= 0.0 ? gap : -gap));
  } else {
    pos += (normalize(U) * 0.878 - N.xyz * 0.479) * stabDepth(c) * w;
  }
  wFoldWeight = max(wFoldWeight, smoothstep(0.0, 0.15, u));
  wSoft = 1.0;
  return pos;
}
#endif
#ifdef NEAR
uniform vec4 uAir;
float bump2(float x2, float w2) {
  float t = max(0.0, 1.0 - x2 / w2);
  return t * t;
}
/**
 * The tension wrinkles as geometry (the near mesh only, its rows ~3 cm apart at the line
 * tabs): the part of the fragment shader's fabric height (glider-wing.ts fabricH) its
 * vertices can carry, as a height along the skin's outward normal (m): the cone under each
 * line tab of the lower skin, the fan of creases at the brake tabs, the slack fabric's
 * coarser crumple. The finer ridges stay in the fragment shader.
 */
float wrinkleG(float a, float c, float tw, float kr, float ch, float soft, float br) {
  float cwm = ${f((HALF_SPAN * RIB_K) / ((N_CELLS / 2) * RIB_S))} * cos(${f(RIB_K / (N_CELLS / 2))} * kr);
  float h = 0.0;
  if (tw < 0.0 && kr < 24.0) {
    float dx = (kr - (2.0 * floor(kr * 0.5) + 1.0)) * cwm;
    float d1 = c - ${f(ROWS[0])};
    float d2 = c - ${f(ROWS[1])};
    float d3 = c - ${f(ROWS[2])};
    float dc = abs(d1) < abs(d2) ? d1 : d2;
    dc = abs(d3) < abs(dc) ? d3 : dc;
    vec2 q = vec2(dx, dc * ch * 0.75);
    float r2 = dot(q, q);
    if (r2 < 0.12) {
      // The cone pulled by the line, and creases from it along the diagonal tapes inside
      // (one cell across, ~0.1 chord along) and along the rib (tension-field theory: a
      // membrane pulled at a point wrinkles along the pull), ~5 cm wide.
      vec2 dg = normalize(vec2(cwm, 0.1 * ch));
      vec2 aq = abs(q);
      float along = dot(aq, dg);
      float perp = dg.x * aq.y - dg.y * aq.x;
      float rid = bump2(perp * perp, 0.0006) * smoothstep(0.01, 0.05, along) * bump2(along * along, 0.11);
      rid += 0.7 * bump2(q.x * q.x, 0.0005) * smoothstep(0.01, 0.04, aq.y) * bump2(aq.y * aq.y, 0.07);
      h += clamp(uAir.x, 0.0, 2.5) * (1.0 - soft) * (0.0022 * rid - 0.005 * bump2(r2, 0.006));
    }
  }
  if (br > 0.01 && c > 0.35) {
    float dx = (kr - 2.0 * floor(kr * 0.5 + 0.5)) * cwm;
    float dy = (1.0 - c) * ch;
    float r = length(vec2(dx, dy));
    h += br * 0.006 * sin(6.0 * atan(dx, dy + 0.03)) * smoothstep(0.02, 0.15, r) * bump2(r * r, 2.0);
  }
  if (soft > 0.01) {
    float X = a * ${f(HALF_SPAN)};
    float Y = c * ch;
    float t = uBrake.w;
    h += soft * 0.004 * sin(X * 41.0 + Y * 13.0 + 2.0 * sin(Y * 23.0 + t * 2.1)) * sin(Y * 37.0 - X * 17.0 + t * 1.3) * smoothstep(0.03, 0.16, c);
  }
  return h;
}
#endif
vec3 wingPos(float a, float tw, float v, float w, float kind, float cw) {
  float sg = a < 0.0 ? -1.0 : 1.0;
  float alpha = min(abs(a), 1.0);
  float q = pow(alpha, ${f(PHI_P)});
  float ch = chordOf(q);
  float c = tw * tw;
  float time = uBrake.w;
  vec4 fold = sg < 0.0 ? uFoldL : uFoldR;
  float fe = mix(fold.x, fold.y, c);
  bool folding = fold.z > 0.001;
  float pinch = 1.0;
#ifndef NO_CLOTH
  // A folded part drawn by its cloth (a big fold reaches past the centre); the open wing
  // pinched to its camber line along the cloth's fold line (the crease).
  if (uCloth.x > 0.0 && uFoldL.z > 0.001) {
    float fes = mix(uFoldL.x, uFoldL.y, c);
    if (-a > fes && fes < 1.0) return clothPos(0.0, -a, fes, a, tw, w, kind);
    pinch = min(pinch, 1.0 - 0.92 * smoothstep(fes - ${f(PINCH_W)}, fes, -a));
    if (sg < 0.0) folding = false;
  }
  if (uCloth.y > 0.0 && uFoldR.z > 0.001) {
    float fes = mix(uFoldR.x, uFoldR.y, c);
    if (a > fes && fes < 1.0) return clothPos(1.0, a, fes, a, tw, w, kind);
    pinch = min(pinch, 1.0 - 0.92 * smoothstep(fes - ${f(PINCH_W)}, fes, a));
    if (sg > 0.0) folding = false;
  }
#endif
  float stall = uMisc.z;
  float spin = uMisc.w;
  float xs = (clamp(a, -1.0, 1.0) + 1.0) * ${f((DYN_N - 1) / 2)};
  int i0 = int(min(floor(xs), ${f(DYN_N - 2)}));
  vec4 dyn = mix(uDyn[i0], uDyn[i0 + 1], xs - float(i0));
  vec4 fab = mix(uFab[i0], uFab[i0 + 1], xs - float(i0));
  float kr = asin(min(alpha * ${f(RIB_S)}, 1.0)) * ${f(N_CELLS / 2 / RIB_K)};
  float soft = 1.0 - smoothstep(0.08, 0.6, fab.x);
  // Each cell pops full at its own pressure; the ribs (the lines hold them) follow the stations.
  if (kind < 0.5) {
    float pa = 0.28 + 0.24 * fract(floor(kr) * 0.618034 + sg * 0.31 + 10.0);
    soft = mix(soft, 1.0 - smoothstep(pa - 0.06, pa + 0.06, fab.x), sin(${f(Math.PI)} * v));
  }
  // Slack fabric for the fragment shader's crumpled wrinkles (also the empty cells on the ground).
  wSoft = max(soft, 1.0 - uInfl.x);
  float fill = uInfl.x;
  float defl = mix(0.08, 1.0, clamp(fill * 1.4 - c * 0.4 - 0.45 * alpha * alpha * (1.0 - fill), 0.0, 1.0)) * (1.0 - 0.45 * stall) * (1.0 - 0.5 * max(0.0, spin * sg) * alpha);
  if (folding) defl *= mix(1.0, 0.55, smoothstep(fe - 0.18, fe, alpha));
  float tk = ${f(THICK0)} * (1.0 - 0.35 * alpha * alpha);
  float hh = profileH(tw, tk) * ch * defl;
  if (soft > 0.0) hh *= 1.0 - soft * (tw >= 0.0 ? 0.2 : 0.55);
  if (kind > 0.5 && kind < 1.5) hh = mix(hh, camberLine(c) * ch * defl, w);
  if (pinch < 1.0) hh = mix(camberLine(c) * ch * defl, hh, pinch);
  float dd = (c - 0.25) * ch;
  if (kind < 0.5) {
#ifndef NO_BALLOON
    float sv = sin(${f(Math.PI)} * v);
    // (Each cell a little different: the panels' tension is never quite the same.)
    float cellVar = 0.9 + 0.2 * fract(sin(floor(kr) * 12.9898 + sg * 4.1) * 43758.5453);
    hh += sign(tw) * ${f(BAL)} * (tw >= 0.0 ? 1.0 : 0.6) * cw * sv * smoothstep(0.03, 0.15, c) * (1.0 - smoothstep(0.72, 1.0, c)) * defl * (0.2 + 0.8 * smoothstep(0.05, 0.7, fab.x)) * cellVar * pinch;
    float te = max(0.0, (c - 0.88) / 0.12);
    dd -= ${f(SCALLOP)} * sv * te * te;
    float dn = min(1.0, dyn.w + 0.8 * soft);
    if (dn > 0.001) {
      float nose = smoothstep(0.0, 0.04, c) * (1.0 - smoothstep(0.12, 0.3, c));
      hh -= dn * nose * ch * (tw >= 0.0 ? 0.035 : -0.012) * (0.55 + 0.45 * sv);
    }
#ifdef NEAR
    // The cell openings are holes: the fabric inside the reinforced lip goes into the cell.
    if (tw < 0.0 && alpha < 0.86) {
      vec2 qo = vec2((v - 0.5) / 0.37, (-tw - 0.115) / 0.085);
      qo *= qo;
      float rec = (1.0 - smoothstep(-0.4, 0.0, sqrt(sqrt(qo.x * qo.x + qo.y * qo.y)) - 1.0)) * 0.018 * ch * (1.0 - soft);
      hh += rec;
      dd += rec;
    }
#endif
#endif
    // (The rods in the leading edge keep the nose's curve.)
    if (soft > 0.01) hh += soft * ch * 0.016 * crumpleN(a * 1.2, c * 1.3, time * 0.8) * smoothstep(0.03, 0.16, c);
  }
  float br = sg < 0.0 ? uBrake.x : uBrake.y;
  float f = max(0.0, (c - 0.42) / 0.58);
  f *= f;
  float disp = ${f(BRAKE_DEF)} * br * clamp(alpha * 1.45, 0.0, 1.0) * f * sqrt(ch / ${f(C0)});
  if (disp > 0.0) disp *= 1.0 - 0.22 * smoothstep(0.8, 1.0, c) * (0.5 - 0.5 * cos(${f(Math.PI)} * kr));
  hh -= disp;
  dd -= 0.5 * disp * disp / (0.58 * ch);
  float tf = max(0.0, (c - 0.55) / 0.45);
  hh += fab.y * tf * tf;
  float fr = clamp(fab.w, 0.0, 1.0);
  if (fr > 0.001) {
    float cf = 0.12 + 0.36 * fr * (1.0 - 0.45 * alpha * alpha);
    if (c < cf) {
      float ddf = (cf - 0.25) * ch;
      float hhf = profileH(-sqrt(cf), tk) * ch * defl;
      float psi = fr * 2.7;
      float wF = 0.35;
      float k = psi / wF;
      float u = ddf - dd;
      float s = min(u, wF);
      float wv = (hh - hhf) * mix(1.0, 0.45, min(1.0, u / wF)) + crumpleN(a, c, time) * fr * 0.05;
      float th = s * k;
      float rest = max(0.0, u - wF);
      dd = ddf - sin(th) / k - rest * cos(psi) - wv * sin(th);
      hh = hhf - (1.0 - cos(th)) / k - rest * sin(psi) + wv * cos(th);
      wFoldWeight = max(wFoldWeight, min(1.0, u / wF));
    }
  }
  float gam = uInfl.y;
  if (gam != 0.0) {
    float ddA = ${f((ROWS[0] - 0.25))} * ch;
    float hhA = profileH(${f(-Math.sqrt(ROWS[0]))}, ${f(THICK0)}) * ch * defl;
    float x = dd - ddA;
    float y = hh - hhA;
    float cg = cos(gam);
    float sgm = sin(gam);
    dd = ddA + x * cg - y * sgm;
    hh = hhA + x * sgm + y * cg;
  }
  float tau = ${f(TAU0)} - ${f(SB_PITCH)} * uBrake.z;
  float ct = cos(tau);
  float st = sin(tau);
  float ct0 = ${f(Math.cos(TAU0))};
  float st0 = ${f(Math.sin(TAU0))};
  vec3 P;
  vec3 H;
  vec2 A, T, N;
  if (folding && alpha > fe) {
    float ae = sg * fe;
    float alE = min(abs(ae), 1.0);
    float qE = pow(alE, ${f(PHI_P)});
    arcFrame(ae, alE, qE, A, T, N);
    float chE = chordOf(qE);
    vec3 D = vec3(-N.x * st, -N.y * st, ct);
    H = vec3(N.x * ct, N.y * ct, st);
    float piv = 0.41 * chE;
    vec3 O = vec3(A.x + (-N.x * st0 - D.x) * piv, A.y + (-N.y * st0 - D.y) * piv, zqOf(alE, qE) + (ct0 - D.z) * piv);
    vec3 To = vec3(sg * T, 0.0);
    float sb = (alpha - fe) * ${f(HALF_SPAN)} * (0.82 - 1.5 * fold.w);
    float psi = max(0.002, fold.z + fab.z);
    float wB = 0.4;
    float k = psi / wB;
    float th = min(sb, wB) * k;
    vec3 cv = To * (sin(th) / k) - H * ((1.0 - cos(th)) / k);
    if (sb > wB) cv += (To * cos(psi) - H * sin(psi)) * (sb - wB);
    vec3 nr = H * cos(th) + To * sin(th);
    float ramp = min(1.0, sb / wB);
    float hf = hh * mix(1.0, 0.35, ramp) + fold.w * (crumpleN(a, c, time) + 0.9 * sin(sb * 11.4 + c * 2.0 + time * 1.7 + 1.6 * sin(sb * 3.7 - c * 3.1 + time * 0.9))) * ramp;
    P = O + cv + nr * hf + D * (dd + zqOf(alpha, q) - zqOf(alE, qE) + 0.3 * min(1.0, sb / 1.5) * c * ramp);
    if (kind > 1.5) P -= nr * stabDepth(c) * w;
    wFoldWeight = max(wFoldWeight, ramp);
  } else {
    arcFrame(a, alpha, q, A, T, N);
    vec3 D = vec3(-N.x * st, -N.y * st, ct);
    H = vec3(N.x * ct, N.y * ct, st);
    float piv = 0.41 * ch;
    P = vec3(A.x + (-N.x * st0 - D.x) * piv, A.y + (-N.y * st0 - D.y) * piv, zqOf(alpha, q) + (ct0 - D.z) * piv) + D * dd + H * hh;
#ifndef NO_BALLOON
    // The simulated fabric, on the flying wing only (not folded, tucked, stalled or on the ground).
    if (kind < 0.5 && uBasisOn > 0.0) {
      float wB = uBasisOn * smoothstep(0.85, 1.0, uInfl.x) * (1.0 - stall) * (1.0 - min(1.0, fr * 3.0));
      if (folding) wB *= 1.0 - smoothstep(fe - 0.25, fe, alpha);
      if (wB > 0.0) P += basisAt(sg, kr, tw, br) * wB;
    }
#endif
#ifdef NEAR
    if (kind < 0.5) {
      wWrinkle = wrinkleG(a, c, tw, kr, ch, max(soft, folding ? smoothstep(fe - 0.25, fe, alpha) : 0.0), br);
      P += H * (sign(tw) * wWrinkle);
    }
#endif
    if (kind > 1.5) P += (vec3(sg * T, 0.0) * 0.878 - H * 0.479) * stabDepth(c) * w;
  }
  if (kind > 1.5) P += (H * (fab.y * 1.8) + vec3(0.0, 0.0, 0.3 * dyn.y)) * (w * w);
  P += H * (dyn.x - dd * dyn.z) + vec3(-N.x * st, -N.y * st, ct) * dyn.y;
  if (stall > 0.001) {
    P.z += stall * (0.5 - 1.6 * alpha * alpha);
    P.x *= 1.0 - 0.2 * stall * alpha * alpha;
    P += H * (stall * 0.16 * crumpleN(a * 0.7, c, time * 1.3));
  }
  if (spin != 0.0) {
    float b = -spin * 0.4;
    float x = P.x * cos(b) + P.z * sin(b);
    P.z = -P.x * sin(b) + P.z * cos(b);
    P.x = x;
  }
  if (c > 0.75) {
    float sk = sin(${f(Math.PI / 2)} * kr);
    P += H * (uMisc.y * sin(time * 19.0 + a * 27.0 + c * 6.0) * smoothstep(0.75, 1.0, c) * (0.35 + 0.65 * sk * sk));
  }
  float gy = uInfl.w;
  if (gy > -50.0) {
    float yW = dot(uUp, P);
    float y2 = max(yW, gy + 0.01);
    y2 = mix(y2, gy + 0.01 + (tw > 0.0 ? 0.03 : 0.0), uInfl.z);
    P += uUp * (y2 - yW);
  }
  return P;
}
`;
