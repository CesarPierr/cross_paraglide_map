/**
 * What lives in the air around the pilot:
 * - thermal flows (when thermals are shown): translucent red streaks rising at the speed
 *   of the air inside the cores, following the lean of each column, so a thermal reads as
 *   a rising red stream, strong ones denser and brighter;
 * - vultures (now and then, more in the southern Alps) circling in strong thermals at,
 *   above or below the pilot's level, climbing with the thermal, gliding off when it dies.
 *   A griffon vulture: 2.6 m of broad "barn door" wings held in a shallow V, seven
 *   fingered primaries curling up, a pale band of underwing coverts against the dark
 *   flight feathers, tawny body, whitish head and ruff, short square tail; it soars with
 *   its wings flexing in the bumps and now and then gives a few slow, deep beats.
 */
import * as THREE from 'three';
import type { AirMass, ThermalSource } from './airmass';

const FLOW_VERT = /* glsl */ `
attribute vec3 aCorner;
attribute vec3 iPos;
attribute float iAlpha;
attribute float iSize;
uniform float uScale;
uniform vec2 uViewport;
varying float vAlpha;
varying vec2 vUv;
void main() {
  // A streak from the mote down along its trail (the air rises): screen-facing width.
  float len = 4.0 + iSize * 0.8;
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 ch = mvp * vec4(iPos, 1.0);
  vec4 ct = mvp * vec4(iPos - vec3(0.0, 0.0, len), 1.0);
  float dh = ch.z + ch.w;
  float dt = ct.z + ct.w;
  if (dh < 0.0 && dt < 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  if (dh < 0.0) ch = mix(ch, ct, dh / (dh - dt) + 1e-4);
  if (dt < 0.0) ct = mix(ct, ch, dt / (dt - dh) + 1e-4);
  vec2 sh = ch.xy / ch.w * 0.5 * uViewport;
  vec2 st = ct.xy / ct.w * 0.5 * uViewport;
  vec2 dir = sh - st;
  float l = length(dir);
  dir = l > 1e-3 ? dir / l : vec2(0.0, 1.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = aCorner.y > 0.5 ? ch : ct;
  float wpx = clamp(iSize * 0.32 * uScale / max(c.w, 1.0), 1.5, 22.0);
  // Extend a little beyond both ends for the rounded caps.
  vec2 off = nrm * aCorner.x * wpx * 0.5 + dir * (aCorner.y > 0.5 ? 1.0 : -1.0) * wpx * 0.5;
  c.xy += off * 2.0 / uViewport * c.w;
  gl_Position = c;
  vAlpha = iAlpha;
  vUv = vec2(aCorner.x, aCorner.y);
}`;
const FLOW_FRAG = /* glsl */ `
varying float vAlpha;
varying vec2 vUv;
void main() {
  // Soft across, a bright head and a fading tail.
  float across = exp(-vUv.x * vUv.x * 3.2);
  float along = smoothstep(0.0, 0.75, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y) * 0.6);
  float a = across * along * vAlpha;
  if (a < 0.004) discard;
  vec3 deep = vec3(0.92, 0.12, 0.08);
  vec3 hot = vec3(1.0, 0.62, 0.32);
  gl_FragColor = vec4(mix(deep, hot, across * vUv.y * min(1.0, vAlpha * 2.0)), a);
}`;

interface Mote {
  src: ThermalSource | null;
  z: number;
  ang: number;
  r: number;
  /** Column cached between evaluations (staggered over frames). */
  cx: number;
  cy: number;
  rc: number;
  w: number;
  top: number;
}

const vp = new THREE.Vector4();

export class ThermalFlows {
  readonly points: THREE.Mesh;
  private pos: Float32Array;
  private alpha: Float32Array;
  private size: Float32Array;
  private motes: Mote[] = [];
  private mat: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private near: ThermalSource[] = [];
  private nearT = -1e9;
  private frame = 0;

  constructor(count: number) {
    const geo = new THREE.InstancedBufferGeometry();
    // One quad per mote: x across (−1..1), y along (0 tail … 1 head).
    geo.setAttribute('aCorner', new THREE.BufferAttribute(new Float32Array([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0]), 3));
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    this.pos = new Float32Array(count * 3);
    this.alpha = new Float32Array(count);
    this.size = new Float32Array(count);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iAlpha', new THREE.InstancedBufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('iSize', new THREE.InstancedBufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.instanceCount = count;
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: FLOW_VERT,
      fragmentShader: FLOW_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uScale: { value: 600 }, uViewport: { value: new THREE.Vector2(1280, 800) } },
    });
    this.points = new THREE.Mesh(geo, this.mat);
    this.points.frustumCulled = false;
    const view = this.mat.uniforms.uViewport.value as THREE.Vector2;
    this.points.onBeforeRender = (renderer) => {
      renderer.getCurrentViewport(vp);
      view.set(Math.max(1, vp.z), Math.max(1, vp.w));
    };
    for (let i = 0; i < count; i++) this.motes.push({ src: null, z: 0, ang: 0, r: 0, cx: 0, cy: 0, rc: 0, w: 0, top: 0 });
  }

  /** Pixels per metre at 1 m (viewport height / (2 tan(fov/2))). */
  setScale(px: number): void {
    this.mat.uniforms.uScale.value = px;
  }

  update(air: AirMass, px: number, py: number, pz: number, t: number, dt: number, visible: boolean): void {
    this.points.visible = visible;
    if (!visible) return;
    // Active thermals around the pilot (refreshed twice a second, the list reused).
    if (t - this.nearT > 0.5 || t < this.nearT) {
      this.nearT = t;
      this.near.length = 0;
      for (const s of air.sources) if (Math.abs(s.x - px) < 3500 && Math.abs(s.y - py) < 3500 && air.strength(s) > 0.4) this.near.push(s);
    }
    const near = this.near;
    // Each mote asks the air mass for its column every fourth frame, in turn.
    const phase = this.frame++ & 3;
    for (let k = 0; k < this.motes.length; k++) {
      const m = this.motes[k];
      if (m.src && (k & 3) === phase) {
        const c = air.column(m.src, m.z, t);
        if (c) {
          m.cx = c.cx;
          m.cy = c.cy;
          m.rc = c.rc;
          m.w = c.w;
          m.top = c.top;
        } else m.w = 0;
      }
      if (!m.src || m.w < 0.25 || m.z > m.top || Math.abs(m.z - pz) > 900) {
        // Respawn in a random active thermal, at a random height around the pilot.
        const s = near.length ? near[Math.floor(Math.random() * near.length)] : null;
        m.src = s;
        m.z = s ? Math.max(s.ground + 30, pz - 700 + Math.random() * 1300) : 0;
        m.ang = Math.random() * Math.PI * 2;
        m.r = Math.sqrt(Math.random());
        const c = s ? air.column(s, m.z, t) : null;
        if (!c || c.w < 0.25) {
          m.w = 0;
          this.alpha[k] = 0;
          continue;
        }
        m.cx = c.cx;
        m.cy = c.cy;
        m.rc = c.rc;
        m.w = c.w;
        m.top = c.top;
      }
      const rr = m.r * m.rc * 1.1;
      const local = m.w * Math.exp(-(m.r * m.r) * 1.2);
      m.z += local * dt;
      m.ang += dt * 0.08;
      this.pos[k * 3] = m.cx + Math.cos(m.ang) * rr;
      this.pos[k * 3 + 1] = m.cy + Math.sin(m.ang) * rr;
      this.pos[k * 3 + 2] = m.z;
      this.alpha[k] = Math.min(0.5, 0.05 + local * 0.1);
      this.size[k] = 6 + local * 2;
    }
    const g = this.geo;
    g.attributes.iPos.needsUpdate = true;
    g.attributes.iAlpha.needsUpdate = true;
    g.attributes.iSize.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------------------
// Griffon vulture.

const BROWN = 0x8f6a45;
const COVERT = 0x9d7b52;
const COVERT_DARK = 0x7a5b3c;
const FLIGHT = 0x2a221c;
const FLIGHT_GREY = 0x463d35;
const UNDER_PALE = 0xe2d4ae;
const UNDER_BAR = 0xa48f68;
const UNDER_DARK = 0x4a3827;
const HEAD = 0xebe3d3;
const BILL = 0xcfc19a;

interface Part {
  pos: number[];
  col: number[];
  idx: number[];
}
const newPart = (): Part => ({ pos: [], col: [], idx: [] });
const tmpC = new THREE.Color();
function pushV(p: Part, x: number, y: number, z: number, color: number): number {
  p.pos.push(x, y, z);
  tmpC.setHex(color);
  p.col.push(tmpC.r, tmpC.g, tmpC.b);
  return p.pos.length / 3 - 1;
}
/** A thin cambered surface (two skins) between a leading and a trailing edge, chord-wise colours per skin. */
function wingSurface(p: Part, nu: number, nv: number, edge: (u: number) => { x: number; yl: number; yt: number; z: number; th: number }, top: (u: number, c: number) => number, bottom: (u: number, c: number) => number): void {
  for (const side of [1, -1]) {
    const base = p.pos.length / 3;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const e = edge(u);
      for (let j = 0; j <= nv; j++) {
        const c = j / nv;
        const camber = 0.06 * Math.sin(Math.PI * Math.min(1, c * 1.1)) * (e.yl - e.yt);
        const half = e.th * Math.pow(1 - c, 1.5) * Math.sqrt(Math.max(c, 0.02)) * 2.2;
        pushV(p, e.x, e.yl + (e.yt - e.yl) * c, e.z + camber + side * half, side > 0 ? top(u, c) : bottom(u, c));
      }
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = base + i * (nv + 1) + j;
        const b = a + nv + 1;
        if (side > 0) p.idx.push(a, b, a + 1, a + 1, b, b + 1);
        else p.idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
}
function toGeometry(p: Part): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(p.col, 3));
  g.setIndex(p.idx);
  g.computeVertexNormals();
  return g;
}

/** Inner wing (shoulder → wrist, local x 0 … 0.52): broad, serrated secondaries. */
function armGeometry(): THREE.BufferGeometry {
  const p = newPart();
  wingSurface(
    p,
    14,
    8,
    (u) => {
      const x = u * 0.52;
      // Trailing edge bulging at the secondaries, each feather tip a small point.
      const serr = 0.018 * Math.abs(Math.sin((x / 0.052) * Math.PI));
      return { x, yl: 0.17 - 0.02 * u, yt: -0.43 - 0.05 * Math.sin(Math.PI * u) + serr, z: 0, th: 0.022 * (1 - 0.4 * u) };
    },
    (_u, c) => (c < 0.5 ? (c < 0.15 ? COVERT_DARK : COVERT) : FLIGHT),
    (u, c) => {
      if (c < 0.12) return UNDER_DARK;
      if (c < 0.38) return Math.sin(u * 40) > 0.35 ? UNDER_BAR : UNDER_PALE;
      return c < 0.55 ? FLIGHT_GREY : FLIGHT;
    },
  );
  return toGeometry(p);
}

/** Outer wing (wrist → tip, local x 0 … 0.42) and the seven fingered primaries. */
function handGeometry(): THREE.BufferGeometry {
  const p = newPart();
  wingSurface(
    p,
    8,
    7,
    (u) => {
      const x = u * 0.4;
      return { x, yl: 0.15 - 0.05 * u * u, yt: -0.4 + 0.12 * u, z: 0.01 * u, th: 0.016 * (1 - 0.5 * u) };
    },
    (_u, c) => (c < 0.32 ? COVERT_DARK : FLIGHT),
    (_u, c) => (c < 0.1 ? UNDER_DARK : FLIGHT),
  );
  // Primaries: narrow, spread like fingers, curling up at the tips.
  for (let f = 0; f < 7; f++) {
    const y0 = 0.1 - f * 0.055;
    const ang = 0.32 - f * 0.12;
    const len = 0.3 - Math.abs(f - 2.5) * 0.025;
    const base = p.pos.length / 3;
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = 0.026 * (1 - 0.65 * t);
      const x = 0.38 + Math.cos(ang) * len * t;
      const y = y0 + Math.sin(ang) * len * t;
      const z = 0.012 + 0.09 * t * t;
      for (const s of [-1, 1]) pushV(p, x - Math.sin(ang) * w * s, y + Math.cos(ang) * w * s, z, FLIGHT);
    }
    for (let i = 0; i < n; i++) {
      const a = base + i * 2;
      p.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  return toGeometry(p);
}

/** Body, ruff, head and bill, tail (bird heading +y, z up). */
function bodyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, color: number, m: THREE.Matrix4) => {
    g.deleteAttribute('uv');
    g.applyMatrix4(m);
    const n = g.getAttribute('position').count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  const M = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(sx, sy, sz));
  add(new THREE.SphereGeometry(1, 14, 10), BROWN, M(0, -0.02, 0, 0.13, 0.42, 0.11));
  add(new THREE.SphereGeometry(1, 12, 8), HEAD, M(0, 0.34, 0.025, 0.1, 0.075, 0.085));
  add(new THREE.SphereGeometry(1, 10, 8), HEAD, M(0, 0.45, 0.04, 0.052, 0.075, 0.055));
  add(new THREE.ConeGeometry(0.02, 0.07, 8), BILL, M(0, 0.53, 0.035, 1, 1, 1, -0.3));
  // Tail: short, square, slightly fanned.
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, -0.34, 0.01, 0.07, -0.34, 0.01, -0.15, -0.66, 0.0, 0.15, -0.66, 0.0, 0, -0.69, 0.0], 3));
  tail.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3]);
  tail.computeVertexNormals();
  tail.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(10), 2));
  add(tail, FLIGHT, new THREE.Matrix4());
  for (const g of parts) if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
  const merged = mergeParts(parts);
  return merged;
}
function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const g of parts) {
    const o = pos.length / 3;
    const P = g.getAttribute('position');
    const N = g.getAttribute('normal');
    const Cc = g.getAttribute('color');
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      col.push(Cc.getX(i), Cc.getY(i), Cc.getZ(i));
    }
    const I = g.index!;
    for (let i = 0; i < I.count; i++) idx.push(o + I.getX(i));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

let birdRes: { arm: THREE.BufferGeometry; hand: THREE.BufferGeometry; body: THREE.BufferGeometry; mat: THREE.Material } | null = null;
function birdResources() {
  if (!birdRes) birdRes = { arm: armGeometry(), hand: handGeometry(), body: bodyGeometry(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }) };
  return birdRes;
}

interface BirdMesh {
  root: THREE.Group;
  shoulders: THREE.Group[];
  wrists: THREE.Group[];
}

/** A griffon vulture (frame: x right, y forward, z up). */
function vultureMesh(): BirdMesh {
  const r = birdResources();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(r.body, r.mat));
  const shoulders: THREE.Group[] = [];
  const wrists: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.09, 0.04, 0.035);
    sh.scale.set(side, 1, 1);
    sh.add(new THREE.Mesh(r.arm, r.mat));
    const wr = new THREE.Group();
    wr.position.set(0.5, 0, 0);
    wr.add(new THREE.Mesh(r.hand, r.mat));
    sh.add(wr);
    root.add(sh);
    shoulders.push(sh);
    wrists.push(wr);
  }
  return { root, shoulders, wrists };
}

interface Bird {
  mesh: BirdMesh;
  src: ThermalSource | null;
  x: number;
  y: number;
  z: number;
  ang: number;
  radius: number;
  dir: number;
  heading: number;
  bank: number;
  flap: number;
  phase: number;
  leaving: number;
  seed: number;
}

export class Vultures {
  readonly group = new THREE.Group();
  private birds: Bird[] = [];
  private nextCheck = 0;

  constructor(
    /** 0 rare … 1 common (griffon vultures: southern Alps, Vercors, Baronnies). */
    private abundance: number,
  ) {}

  /** Number of birds in the air now. */
  get count(): number {
    return this.birds.length;
  }

  /** Puts a bird somewhere (for tests and screenshots): gliding straight at that heading. */
  place(x: number, y: number, z: number, heading: number, flap = 0): void {
    const mesh = vultureMesh();
    this.group.add(mesh.root);
    this.birds.push({ mesh, src: null, x, y, z, ang: 0, radius: 30, dir: 1, heading, bank: 0, flap, phase: 0, leaving: 1, seed: Math.random() * 100 });
  }

  update(air: AirMass, px: number, py: number, pz: number, t: number, dt: number): void {
    // Now and then a few birds join a strong thermal near the pilot.
    if (t > this.nextCheck) {
      this.nextCheck = t + 40 + Math.random() * 60;
      if (this.birds.length < 4 && Math.random() < 0.25 + 0.5 * this.abundance) {
        const cands = air.sources.filter((s) => Math.hypot(s.x - px, s.y - py) < 1800 && air.strength(s) > 1.6);
        const s = cands[Math.floor(Math.random() * cands.length)];
        const c = s ? air.column(s, pz, t) : null;
        if (s && c && c.w > 1) {
          const k = 1 + Math.floor(Math.random() * Math.min(3, 4 - this.birds.length));
          for (let i = 0; i < k; i++) {
            const mesh = vultureMesh();
            this.group.add(mesh.root);
            this.birds.push({ mesh, src: s, x: c.cx, y: c.cy, z: pz + (Math.random() - 0.4) * 220, ang: Math.random() * Math.PI * 2, radius: 22 + Math.random() * 18, dir: Math.random() < 0.5 ? -1 : 1, heading: 0, bank: 0, flap: 0, phase: 0, leaving: 0, seed: Math.random() * 100 });
          }
        }
      }
    }
    for (let i = this.birds.length - 1; i >= 0; i--) {
      const b = this.birds[i];
      const c = b.src ? air.column(b.src, b.z, t) : null;
      const speed = 11.5;
      let bankTarget = 0;
      if (c && c.w > 0.6 && !b.leaving) {
        // Circling in the core, climbing with it (sink rate ~0.8 m/s while turning).
        b.ang += ((speed / b.radius) * dt) * b.dir;
        const tx = c.cx + Math.cos(b.ang) * b.radius;
        const ty = c.cy + Math.sin(b.ang) * b.radius;
        if (dt > 0) b.heading = Math.atan2(tx - b.x, ty - b.y);
        b.x = tx;
        b.y = ty;
        b.z += (c.w - 0.8) * dt;
        bankTarget = -Math.atan((speed * speed) / (9.81 * b.radius)) * b.dir;
        if (b.z > c.top - 50) b.leaving = 1;
        // A few beats when the core weakens.
        if (c.w < 1.1 && b.flap <= 0 && Math.random() < dt * 0.05) b.flap = 2;
      } else {
        // Thermal gone or top reached: glide off in a straight line, flapping now and then.
        b.leaving += dt;
        b.x += Math.sin(b.heading) * speed * 1.3 * dt;
        b.y += Math.cos(b.heading) * speed * 1.3 * dt;
        b.z -= 1.0 * dt;
        if (b.flap <= 0 && Math.random() < dt * 0.03) b.flap = 1.6;
      }
      b.bank += (bankTarget - b.bank) * Math.min(1, dt * 1.5);
      b.flap = Math.max(0, b.flap - dt);
      const m = b.mesh;
      m.root.position.set(b.x, b.y, b.z);
      m.root.rotation.set(0, 0, 0);
      m.root.rotateZ(-b.heading);
      m.root.rotateY(b.bank);
      // Wings: shallow V and primaries up when soaring, flexing in the bumps; slow deep
      // beats (~1.7 Hz), the hand lagging the arm.
      const beat = Math.min(1, b.flap * 2) * Math.min(1, b.flap);
      b.phase += dt * Math.PI * 2 * 1.7;
      const flex = 0.035 * Math.sin(t * 2.3 + b.seed) + 0.02 * Math.sin(t * 5.1 + b.seed * 1.7);
      const arm = 0.07 + flex + beat * 0.42 * Math.sin(b.phase);
      const hand = 0.06 + flex * 1.5 + beat * 0.25 * Math.sin(b.phase - 0.7);
      // (The left wing is mirrored: the same lift is the opposite rotation.)
      m.shoulders[0].rotation.y = arm;
      m.shoulders[1].rotation.y = -arm;
      m.wrists[0].rotation.y = -hand;
      m.wrists[1].rotation.y = -hand;
      if (b.leaving > 60 || Math.hypot(b.x - px, b.y - py) > 5000) {
        this.group.remove(m.root);
        this.birds.splice(i, 1);
      }
    }
  }
}
