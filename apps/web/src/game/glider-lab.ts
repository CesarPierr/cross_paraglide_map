/**
 * Development bench for the paraglider and the vultures, outside the game: the glider in
 * front of a plain sky with the game's kind of light (sun + sky/ground hemisphere), a
 * first-person camera at the pilot's eyes (same place and head angles as world.ts), a chase
 * camera, other pilots and vultures, the state editable from the console or a test through
 * window.__lab; `fly()` flies the flight model in turbulence (the canopy's motion relative
 * to the pilot), `gpu()` times the glider's draw per part. Not imported by the app; load it
 * from the dev server (any page of it):
 *
 *   await import('/src/game/glider-lab.ts').then((m) => m.startLab())
 *
 * Frame: three.js y up = the glider frame (x right, y up, z back); the vultures, which live
 * in the game's east/north/up frame, are turned into it.
 */
import * as THREE from 'three';
import type { AirMass } from './airmass';
import { newGlider, step, type AirSample, type Controls, type GliderState } from './flight';
import { buildGlider, type GliderModel } from './glider';
import { EYE_SEATED, EYE_STANDING } from './glider-gear';
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
  /** First person: head yaw (+ right) and pitch (+ up), as in the game (seated, or standing while the glider stands). */
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
  /**
   * Flies the flight model for `seconds` (1/120 s steps, a frame every 1/60 s) in a still
   * air shaken by turbulence 0..1 (vertical gusts at the pilot and at each tip from a few
   * travelling waves), the glider turned by its bank and pendulum pitch as in the game.
   * Returns the extremes of the canopy's attitude relative to the pilot (rad) and of its tips' heave (m).
   */
  fly(seconds: number, opts?: { turbulence?: number; brakeL?: number; brakeR?: number; weight?: number; ears?: boolean; speedbar?: number }): { roll: [number, number]; pitch: [number, number]; flex: [number, number] };
  stats(): { levels: { distance: number; tris: number; verts: number; draws: number }[]; updateMs: number };
  /**
   * GPU time (ms per draw of the glider, timer query) for the current camera: the whole
   * glider and each part of the nearest level alone (wing, lines, risers, pilot), the sky
   * and the other objects hidden; null where the browser has no timer query.
   */
  gpu(n?: number): Promise<Record<string, number | null>>;
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
  let flyT = 0;
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
      // The eyes seated in the pod or standing on the take-off, as world.ts places them.
      const k = glider.standing();
      camera.position.set(0, EYE_SEATED[1] + (EYE_STANDING[1] - EYE_SEATED[1]) * k, EYE_SEATED[2] + (EYE_STANDING[2] - EYE_SEATED[2]) * k);
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
    fly(seconds, opts = {}) {
      const c: Controls = { brakeL: opts.brakeL ?? 0, brakeR: opts.brakeR ?? 0, speedbar: opts.speedbar ?? 0, ears: opts.ears ?? false, weight: opts.weight ?? 0 };
      const turb = opts.turbulence ?? 0;
      const air: AirSample = { u: 0, v: 0, w: 0, turbulence: turb, wL: 0, wR: 0, agl: 800 };
      const roll: [number, number] = [0, 0];
      const pitch: [number, number] = [0, 0];
      const flex: [number, number] = [0, 0];
      const dyn = glider.dynamics;
      const g = (x: number) => Math.sin(x) + 0.6 * Math.sin(2.3 * x + 1.1) + 0.35 * Math.sin(5.1 * x + 2.3);
      const frames = Math.round(seconds * 60);
      for (let f = 0; f < frames; f++) {
        for (let k = 0; k < 2; k++) {
          flyT += 1 / 120;
          // Gusts of ~1.5 m/s at full turbulence, different at each tip (eddies of a few metres).
          air.w = 1.5 * turb * g(flyT * 1.7);
          air.wL = air.w + 1.1 * turb * g(flyT * 2.9 + 4.1);
          air.wR = air.w + 1.1 * turb * g(flyT * 3.1 + 0.7);
          step(state, c, air, 1 / 120, Math.random);
        }
        glider.root.quaternion.setFromEuler(new THREE.Euler(-state.pitch, 0, -state.bank, 'ZXY'));
        glider.update(state, 1 / 60);
        const sw = glider.sway;
        if (sw) {
          roll[0] = Math.min(roll[0], sw.roll);
          roll[1] = Math.max(roll[1], sw.roll);
          pitch[0] = Math.min(pitch[0], sw.pitch);
          pitch[1] = Math.max(pitch[1], sw.pitch);
        }
        if (dyn) {
          // Heave of the tips (first and last stations).
          const tl = dyn.x[0];
          const tr = dyn.x[dyn.x.length - 4];
          flex[0] = Math.min(flex[0], tl, tr);
          flex[1] = Math.max(flex[1], tl, tr);
        }
      }
      state.x = 0;
      state.y = 0;
      state.z = 1500;
      return { roll, pitch, flex };
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
    async gpu(n = 200) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number } | null;
      const out: Record<string, number | null> = {};
      let lod: THREE.LOD | null = null;
      glider.root.traverse((o) => {
        if ((o as THREE.LOD).isLOD) lod = o as THREE.LOD;
      });
      const level = lod ? ((lod as THREE.LOD).levels.find((l) => l.object.visible)?.object ?? glider.root) : glider.root;
      const canopy = level.children[0];
      const parts: Record<string, THREE.Object3D[]> = {
        wing: canopy.children.filter((o) => (o as THREE.Mesh).isMesh && !!((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms?.uFoldL),
        lines: canopy.children.filter((o) => (o as THREE.Mesh).isMesh && !!((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms?.uViewport),
        risers: canopy.children.filter((o) => !(o as THREE.Mesh).isMesh),
        pilot: level.children.slice(1),
      };
      const all = Object.values(parts).flat();
      const hidden = scene.children.filter((o) => o !== glider.root && o.visible);
      for (const o of hidden) o.visible = false;
      glider.update(state);
      // Many draws per query (a few draws are lost in the timer's noise), after a warm-up,
      // the median of 7; an empty draw's time is subtracted. Wall: the same draws with
      // gl.finish (CPU submission and GPU together).
      const once = async (): Promise<[number, number]> => {
        gl.finish();
        const t0 = performance.now();
        const q = ext ? gl.createQuery() : null;
        if (ext && q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        for (let i = 0; i < n; i++) renderer.render(scene, camera);
        if (ext && q) gl.endQuery(ext.TIME_ELAPSED_EXT);
        gl.finish();
        const wall = (performance.now() - t0) / n;
        let g = NaN;
        if (ext && q) {
          for (let w = 0; w < 400 && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); w++) await new Promise((r) => setTimeout(r, 5));
          if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) g = (gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6 / n;
          gl.deleteQuery(q);
        }
        return [g, wall];
      };
      const median = async (): Promise<[number, number]> => {
        await once();
        await once();
        const g: number[] = [];
        const w: number[] = [];
        for (let rep = 0; rep < 7; rep++) {
          const [a, b] = await once();
          if (Number.isFinite(a)) g.push(a);
          w.push(b);
        }
        g.sort((a, b) => a - b);
        w.sort((a, b) => a - b);
        return [g.length ? g[g.length >> 1] : NaN, w[w.length >> 1]];
      };
      glider.root.visible = false;
      const [g0, w0] = await median();
      glider.root.visible = true;
      const time = async (): Promise<number | null> => {
        const [g, w] = await median();
        out[`wall:${current}`] = Math.max(0, w - w0);
        return ext && Number.isFinite(g) ? Math.max(0, g - g0) : null;
      };
      let current = 'glider';
      out.glider = await time();
      for (const [k, objs] of Object.entries(parts)) {
        for (const o of all) o.visible = objs.includes(o);
        current = k;
        out[k] = await time();
      }
      for (const o of all) o.visible = true;
      for (const o of hidden) o.visible = true;
      return out;
    },
  };
  lab.sun(-35, 60);
  lab.first();
  (window as unknown as { __lab: Lab }).__lab = lab;
  return lab;
}
