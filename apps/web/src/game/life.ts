/**
 * What lives in the air around the pilot:
 * - thermal flows (when thermals are shown): translucent red motes rising at the speed
 *   of the air inside the cores, following the lean of each column, so a thermal reads as
 *   a rising red stream, strong ones denser and brighter;
 * - vultures (now and then, more in the southern Alps) circling in strong thermals at,
 *   above or below the pilot's level, climbing with the thermal, gliding off when it dies.
 */
import * as THREE from 'three';
import type { AirMass, ThermalSource } from './airmass';

const FLOW_VERT = /* glsl */ `
attribute float aAlpha;
attribute float aSize;
uniform float uScale;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(gl_Position.w, 1.0), 1.5, 48.0);
  vAlpha = aAlpha;
}`;
const FLOW_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  // Soft, vertically stretched mote: reads as a rising streak.
  float d = length(vec2(c.x * 1.6, c.y * 0.8));
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(vec3(1.0, 0.22, 0.12), vec3(1.0, 0.62, 0.3), vAlpha), a);
}`;

interface Mote {
  src: ThermalSource | null;
  z: number;
  ang: number;
  r: number;
}

export class ThermalFlows {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private alpha: Float32Array;
  private size: Float32Array;
  private motes: Mote[] = [];
  private mat: THREE.ShaderMaterial;

  constructor(count: number) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(count * 3);
    this.alpha = new Float32Array(count);
    this.size = new Float32Array(count);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({ vertexShader: FLOW_VERT, fragmentShader: FLOW_FRAG, transparent: true, depthWrite: false, uniforms: { uScale: { value: 600 } } });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    for (let i = 0; i < count; i++) this.motes.push({ src: null, z: 0, ang: 0, r: 0 });
  }

  /** Pixels per metre at 1 m (viewport height / (2 tan(fov/2))). */
  setScale(px: number): void {
    this.mat.uniforms.uScale.value = px;
  }

  update(air: AirMass, px: number, py: number, pz: number, t: number, dt: number, visible: boolean): void {
    this.points.visible = visible;
    if (!visible) return;
    // Active thermals around the pilot, weighted by their strength.
    const near = air.sources.filter((s) => Math.abs(s.x - px) < 3500 && Math.abs(s.y - py) < 3500 && air.strength(s) > 0.4);
    let n = 0;
    for (const m of this.motes) {
      const k = n++;
      let c = m.src ? air.column(m.src, m.z, t) : null;
      if (!m.src || !c || c.w < 0.25 || m.z > c.top || Math.abs(m.z - pz) > 900) {
        // Respawn in a random active thermal, at a random height around the pilot.
        const s = near.length ? near[Math.floor(Math.random() * near.length)] : null;
        m.src = s;
        m.z = s ? Math.max(s.ground + 30, pz - 700 + Math.random() * 1300) : 0;
        m.ang = Math.random() * Math.PI * 2;
        m.r = Math.sqrt(Math.random());
        c = s ? air.column(s, m.z, t) : null;
        if (!c || c.w < 0.25) {
          this.alpha[k] = 0;
          continue;
        }
      }
      const rr = m.r * c.rc * 1.1;
      const local = c.w * Math.exp(-(m.r * m.r) * 1.2);
      m.z += local * dt;
      m.ang += dt * 0.08;
      this.pos[k * 3] = c.cx + Math.cos(m.ang) * rr;
      this.pos[k * 3 + 1] = c.cy + Math.sin(m.ang) * rr;
      this.pos[k * 3 + 2] = m.z;
      this.alpha[k] = Math.min(0.55, 0.06 + local * 0.11);
      this.size[k] = 7 + local * 2;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  }
}

/** A griffon vulture: ~2.7 m span, broad fingered wings, short tail, dark brown. */
function vultureMesh(): THREE.Group {
  const g = new THREE.Group();
  const brown = new THREE.MeshLambertMaterial({ color: 0x4a3626, side: THREE.DoubleSide });
  const pale = new THREE.MeshLambertMaterial({ color: 0xc9b38a });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.25);
  wingShape.lineTo(1.25, 0.28);
  // Fingered tip.
  for (let i = 0; i < 5; i++) {
    wingShape.lineTo(1.35 + i * 0.012, 0.22 - i * 0.12);
    wingShape.lineTo(1.25, 0.16 - i * 0.12);
  }
  wingShape.lineTo(1.1, -0.38);
  wingShape.lineTo(0, -0.32);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  for (const side of [-1, 1]) {
    // Frame: x right, y forward, z up (the world's east/north/up for a bird heading north).
    const w = new THREE.Mesh(wingGeo, brown);
    w.scale.set(side, 1, 1);
    w.name = side < 0 ? 'wingL' : 'wingR';
    g.add(w);
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 4, 8), brown);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), pale);
  head.position.set(0, 0.48, 0.02);
  g.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), brown);
  tail.rotation.z = Math.PI;
  tail.position.set(0, -0.48, 0);
  g.add(tail);
  return g;
}

interface Bird {
  mesh: THREE.Group;
  src: ThermalSource | null;
  x: number;
  y: number;
  z: number;
  ang: number;
  radius: number;
  dir: number;
  heading: number;
  flap: number;
  leaving: number;
}

export class Vultures {
  readonly group = new THREE.Group();
  private birds: Bird[] = [];
  private nextCheck = 0;

  constructor(
    /** 0 rare … 1 common (griffon vultures: southern Alps, Vercors, Baronnies). */
    private abundance: number,
  ) {}

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
            this.group.add(mesh);
            this.birds.push({ mesh, src: s, x: c.cx, y: c.cy, z: pz + (Math.random() - 0.4) * 220, ang: Math.random() * Math.PI * 2, radius: 22 + Math.random() * 18, dir: Math.random() < 0.5 ? -1 : 1, heading: 0, flap: 0, leaving: 0 });
          }
        }
      }
    }
    for (const b of [...this.birds]) {
      const c = b.src ? air.column(b.src, b.z, t) : null;
      const speed = 11.5;
      if (c && c.w > 0.6 && !b.leaving) {
        // Circling in the core, climbing with it (sink rate ~0.8 m/s while turning).
        b.ang += ((speed / b.radius) * dt) * b.dir;
        const tx = c.cx + Math.cos(b.ang) * b.radius;
        const ty = c.cy + Math.sin(b.ang) * b.radius;
        b.heading = Math.atan2(tx - b.x, ty - b.y);
        b.x = tx;
        b.y = ty;
        b.z += (c.w - 0.8) * dt;
        b.flap = Math.max(0, b.flap - dt);
        if (b.z > c.top - 50) b.leaving = 1;
      } else {
        // Thermal gone or top reached: glide off in a straight line, flapping now and then.
        b.leaving += dt;
        b.x += Math.sin(b.heading) * speed * 1.3 * dt;
        b.y += Math.cos(b.heading) * speed * 1.3 * dt;
        b.z -= 1.0 * dt;
        if (Math.random() < dt * 0.15) b.flap = 1.5;
        b.flap = Math.max(0, b.flap - dt);
      }
      const bank = b.leaving ? 0 : -0.45 * b.dir;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.set(0, 0, 0);
      b.mesh.rotateZ(-b.heading);
      b.mesh.rotateY(bank);
      const flapA = b.flap > 0 ? Math.sin(t * 9) * 0.5 : 0.08;
      b.mesh.getObjectByName('wingL')!.rotation.y = -flapA;
      b.mesh.getObjectByName('wingR')!.rotation.y = flapA;
      if (b.leaving > 60 || Math.hypot(b.x - px, b.y - py) > 5000) {
        this.group.remove(b.mesh);
        this.birds.splice(this.birds.indexOf(b), 1);
      }
    }
  }
}
