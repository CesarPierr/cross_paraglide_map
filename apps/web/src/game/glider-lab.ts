/**
 * Development bench for the paraglider and the vultures, outside the game: the glider in
 * front of a plain sky with the game's kind of light (sun + sky/ground hemisphere), a
 * first-person camera at the pilot's eyes (same place and head angles as world.ts), a chase
 * camera, other pilots and vultures, the state editable from the console or a test through
 * window.__lab. Not imported by the app; load it from the dev server (any page of it):
 *
 *   await import('/src/game/glider-lab.ts').then((m) => m.startLab())
 *
 * Frame: three.js y up = the glider frame (x right, y up, z back); the vultures, which live
 * in the game's east/north/up frame, are turned into it.
 */
import * as THREE from 'three';
import type { AirMass } from './airmass';
import { newGlider, type GliderState } from './flight';
import { buildGlider, type GliderModel } from './glider';
import { ThermalFlows, Vultures } from './life';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 zenith = vec3(0.16, 0.36, 0.72);
  vec3 horizon = vec3(0.72, 0.82, 0.92);
  vec3 ground = vec3(0.30, 0.33, 0.26);
  vec3 col = h > 0.0 ? mix(horizon, zenith, pow(h, 0.55)) : mix(horizon * 0.8, ground, smoothstep(0.0, 0.08, -h));
  float s = max(0.0, dot(d, normalize(uSun)));
  col += vec3(1.0, 0.95, 0.85) * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.35);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface Lab {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  glider: GliderModel;
  state: GliderState;
  vultures: Vultures;
  /** Sun direction (towards the sun) from azimuth (deg, 0 = ahead of the glider, + = right) and elevation (deg). */
  sun(azimuth: number, elevation: number): void;
  /** First person: head yaw (+ right) and pitch (+ up), as in the game. */
  first(yaw?: number, pitch?: number, fov?: number): void;
  /** Chase/orbit camera: azimuth (0 = from behind, + = from the right), elevation (rad), distance (m), target height. */
  orbit(yaw: number, el: number, dist: number, targetY?: number, fov?: number): void;
  /** Free camera: from a point towards another (lab frame). */
  look(px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov?: number): void;
  ground(y: number | null): void;
  /** A thermal 300 m ahead drawn as rising red streaks (or none). */
  thermal(on: boolean): void;
  peer(x: number, y: number, z: number, heading?: number, main?: number): GliderModel;
  render(): void;
  stats(): { levels: { distance: number; tris: number; verts: number; draws: number }[]; updateMs: number };
}

export function startLab(width = innerWidth, height = innerHeight): Lab {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  Object.assign(renderer.domElement.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999' });
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(66, width / height, 0.03, 4000);
  const sunDir = new THREE.Vector3(0.3, 0.8, -0.4).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, uniforms: { uSun: { value: sunDir } } }));
  scene.add(sky);
  const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.4);
  const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x5f6450, 1.15);
  hemi.position.set(0, 1, 0);
  scene.add(sunLight, hemi);
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: 0x6f7a4e }));
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.visible = false;
  scene.add(groundMesh);
  const glider = buildGlider();
  scene.add(glider.root);
  const state = newGlider(0, 0, 1500, 0);
  const vultures = new Vultures(1);
  // Game frame (east, north, up) → lab frame (x, y up, z back): heading north = −z.
  vultures.group.rotation.x = -Math.PI / 2;
  scene.add(vultures.group);
  const air = { sources: [], strength: () => 0, column: () => null } as unknown as AirMass;
  // A leaning thermal 300 m ahead (game frame: east, north, up), 3 m/s in the core.
  const flows = new ThermalFlows(1500);
  flows.points.rotation.x = -Math.PI / 2;
  scene.add(flows.points);
  let showFlows = false;
  const src = { x: 40, y: 300, ground: -900 };
  const thermalAir = {
    sources: [src],
    strength: () => 3,
    column: (_s: unknown, z: number) => (z < 700 ? { cx: src.x + (z + 900) * 0.06, cy: src.y, rc: 55, w: 3 * Math.min(1, (z + 900) / 300), top: 700 } : null),
  } as unknown as AirMass;
  const peers: GliderModel[] = [];
  let t = 0;
  const lab: Lab = {
    renderer,
    scene,
    camera,
    glider,
    state,
    vultures,
    sun(az, el) {
      const a = (az * Math.PI) / 180;
      const e = (el * Math.PI) / 180;
      sunDir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
      sunLight.position.copy(sunDir);
    },
    first(yaw = 0, pitch = -0.12, fov = 66) {
      camera.fov = fov;
      camera.position.set(0, 0.32, 0.34);
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, -yaw, 0, 'YXZ'));
      camera.updateProjectionMatrix();
      glider.pilot.visible = false;
    },
    orbit(yaw, el, dist, targetY = 3.5, fov = 66) {
      camera.fov = fov;
      camera.position.set(Math.sin(yaw) * Math.cos(el) * dist, targetY + Math.sin(el) * dist, Math.cos(yaw) * Math.cos(el) * dist);
      camera.lookAt(0, targetY, 0);
      camera.updateProjectionMatrix();
      glider.pilot.visible = true;
    },
    look(px, py, pz, tx, ty, tz, fov = 40) {
      camera.fov = fov;
      camera.position.set(px, py, pz);
      camera.lookAt(tx, ty, tz);
      camera.updateProjectionMatrix();
      glider.pilot.visible = true;
    },
    thermal(on) {
      showFlows = on;
    },
    ground(y) {
      groundMesh.visible = y !== null;
      if (y !== null) groundMesh.position.y = y;
    },
    peer(x, y, z, heading = 0, main = 0x2f8fd6) {
      const m = buildGlider({ main, stripe: 0xf4f1ea, under: 0xb8b2aa });
      m.root.position.set(x, y, z);
      m.root.rotation.y = -heading;
      scene.add(m.root);
      peers.push(m);
      return m;
    },
    render() {
      t += 1 / 30;
      glider.update(state);
      for (const p of peers) p.update(state);
      vultures.update(air, 0, 0, 0, t, 1 / 30);
      flows.setScale(height / (2 * Math.tan((camera.fov * Math.PI) / 360)));
      flows.update(thermalAir, 0, 0, 0, t, 1 / 30, showFlows);
      renderer.render(scene, camera);
    },
    stats() {
      let lod: THREE.LOD | null = null;
      glider.root.traverse((o) => {
        if ((o as THREE.LOD).isLOD) lod = o as THREE.LOD;
      });
      const levels = (lod ? (lod as THREE.LOD).levels : [{ distance: 0, object: glider.root }]).map((l) => {
        let tris = 0;
        let verts = 0;
        let draws = 0;
        l.object.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const g = m.geometry;
          const n = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
          tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * n;
          verts += g.attributes.position.count * n;
          draws++;
        });
        return { distance: l.distance, tris: Math.round(tris), verts, draws };
      });
      const t0 = performance.now();
      for (let i = 0; i < 300; i++) {
        state.brakeL = (i % 10) / 12;
        state.brakeR = (i % 7) / 10;
        glider.update(state);
      }
      const updateMs = (performance.now() - t0) / 300;
      state.brakeL = 0;
      state.brakeR = 0;
      return { levels, updateMs };
    },
  };
  lab.sun(-35, 60);
  lab.first();
  (window as unknown as { __lab: Lab }).__lab = lab;
  return lab;
}
