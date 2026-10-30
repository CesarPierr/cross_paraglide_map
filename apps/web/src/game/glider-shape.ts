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
 * the fabric crumpling) and draws the wrinkles the tension makes (line tabs, brake tabs,
 * slack fabric) in the fragment shader, where they cost nothing on the vertices.
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
}

/** Span stations of the canopy's dynamics (both tips included: 2 per ~1.4 m of span). */
export const DYN_N = 17;

export function newDeform(): WingDeform {
  const fab = new Float32Array(DYN_N * 4);
  for (let k = 0; k < DYN_N; k++) fab[k * 4] = 1;
  return { brake: [0, 0, 0, 0], foldL: [2, 2, 0, 0], foldR: [2, 2, 0, 0], misc: [0, 0, 0, 0], infl: [1, 0, 0, -100], up: [0, 1, 0], dyn: new Float32Array(DYN_N * 4), fab, air: [1, 0, 0, 0] };
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
  const folding = fold[2] > 0.001;
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
  // Soft cells: the pressure no longer holds the profile (below ~half the trim's).
  const soft = 1 - smooth(0.08, 0.6, pres);
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
  let dd = (c - 0.25) * ch;
  if (kind === 0) {
    const sv = Math.sin(Math.PI * v);
    hh += Math.sign(tw) * BAL * (tw >= 0 ? 1 : 0.6) * cw * sv * smooth(0.03, 0.15, c) * (1 - smooth(0.72, 1, c)) * defl * (0.2 + 0.8 * smooth(0.05, 0.7, pres));
    const te = Math.max(0, (c - 0.88) / 0.12);
    dd -= SCALLOP * sv * te * te;
    // A soft leading edge (the angle of attack near the fold, a lull, the pressure going):
    // the nose of each cell sinks in and wrinkles across the span before a collapse.
    const dn = Math.min(1, dent + 0.8 * soft);
    if (dn > 0.001) {
      const nose = smooth(0.0, 0.04, c) * (1 - smooth(0.12, 0.3, c));
      hh -= dn * nose * ch * (tw >= 0 ? 0.035 : -0.012) * (0.55 + 0.45 * sv);
    }
    // Slack fabric crumples.
    if (soft > 0.01) hh += soft * ch * 0.016 * noise(a * 1.2, c * 1.3, time * 0.8);
  }
  // Brake: the rear of the profile curls down, more towards the tips; the trailing edge is
  // pulled at the brake tabs (every second rib) and sags less between them.
  const br = sg < 0 ? d.brake[0] : d.brake[1];
  let f = Math.max(0, (c - 0.42) / 0.58);
  f *= f;
  let disp = BRAKE_DEF * br * clamp(alpha * 1.45, 0, 1) * f * Math.sqrt(ch / C0);
  if (disp > 0) {
    const kr = (Math.asin(Math.min(alpha * RIB_S, 1)) / RIB_K) * (N_CELLS / 2);
    disp *= 1 - 0.22 * smooth(0.8, 1, c) * (0.5 - 0.5 * Math.cos(Math.PI * kr));
  }
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
    const kr = (Math.asin(Math.min(alpha * RIB_S, 1)) / RIB_K) * (N_CELLS / 2);
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
float wFoldWeight;
float wSoft;
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
  float stall = uMisc.z;
  float spin = uMisc.w;
  float xs = (clamp(a, -1.0, 1.0) + 1.0) * ${f((DYN_N - 1) / 2)};
  int i0 = int(min(floor(xs), ${f(DYN_N - 2)}));
  vec4 dyn = mix(uDyn[i0], uDyn[i0 + 1], xs - float(i0));
  vec4 fab = mix(uFab[i0], uFab[i0 + 1], xs - float(i0));
  float soft = 1.0 - smoothstep(0.08, 0.6, fab.x);
  // Slack fabric for the fragment shader's crumpled wrinkles (also the empty cells on the ground).
  wSoft = max(soft, 1.0 - uInfl.x);
  float kr = asin(min(alpha * ${f(RIB_S)}, 1.0)) * ${f(N_CELLS / 2 / RIB_K)};
  float fill = uInfl.x;
  float defl = mix(0.08, 1.0, clamp(fill * 1.4 - c * 0.4 - 0.45 * alpha * alpha * (1.0 - fill), 0.0, 1.0)) * (1.0 - 0.45 * stall) * (1.0 - 0.5 * max(0.0, spin * sg) * alpha);
  if (folding) defl *= mix(1.0, 0.55, smoothstep(fe - 0.18, fe, alpha));
  float tk = ${f(THICK0)} * (1.0 - 0.35 * alpha * alpha);
  float hh = profileH(tw, tk) * ch * defl;
  if (soft > 0.0) hh *= 1.0 - soft * (tw >= 0.0 ? 0.2 : 0.55);
  if (kind > 0.5 && kind < 1.5) hh = mix(hh, camberLine(c) * ch * defl, w);
  float dd = (c - 0.25) * ch;
  if (kind < 0.5) {
#ifndef NO_BALLOON
    float sv = sin(${f(Math.PI)} * v);
    // (Each cell a little different: the panels' tension is never quite the same.)
    float cellVar = 0.9 + 0.2 * fract(sin(floor(kr) * 12.9898 + sg * 4.1) * 43758.5453);
    hh += sign(tw) * ${f(BAL)} * (tw >= 0.0 ? 1.0 : 0.6) * cw * sv * smoothstep(0.03, 0.15, c) * (1.0 - smoothstep(0.72, 1.0, c)) * defl * (0.2 + 0.8 * smoothstep(0.05, 0.7, fab.x)) * cellVar;
    float te = max(0.0, (c - 0.88) / 0.12);
    dd -= ${f(SCALLOP)} * sv * te * te;
    float dn = min(1.0, dyn.w + 0.8 * soft);
    if (dn > 0.001) {
      float nose = smoothstep(0.0, 0.04, c) * (1.0 - smoothstep(0.12, 0.3, c));
      hh -= dn * nose * ch * (tw >= 0.0 ? 0.035 : -0.012) * (0.55 + 0.45 * sv);
    }
#endif
    if (soft > 0.01) hh += soft * ch * 0.016 * crumpleN(a * 1.2, c * 1.3, time * 0.8);
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
