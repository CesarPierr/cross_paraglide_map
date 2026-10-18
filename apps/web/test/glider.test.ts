import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { newGlider, type GliderState } from '../src/game/flight';
import { buildGlider, Sway } from '../src/game/glider';
import {
  BODY,
  CARABINER_X,
  EYE_NECK,
  EYE_SEATED,
  EYE_STANDING,
  FEET_Y,
  FINGERS,
  HANDLE_R,
  fairingGeometry,
  fingerJoints,
  gloveGeometry,
  handleAxis,
  podGeometry,
  shellGeometry,
  torsoGeometry,
} from '../src/game/glider-gear';
import { LineSet } from '../src/game/glider-lines';
import { PilotRig } from '../src/game/glider-pilot';
import { newDeform, wingPoint } from '../src/game/glider-shape';

/** Signed volume of a closed indexed mesh: positive when its triangles are wound outwards. */
function signedVolume(g: THREE.BufferGeometry): number {
  const p = g.getAttribute('position');
  const idx = g.index!;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(p, idx.getX(i));
    b.fromBufferAttribute(p, idx.getX(i + 1));
    c.fromBufferAttribute(p, idx.getX(i + 2));
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

const still = (over: Partial<GliderState> = {}): GliderState => Object.assign(newGlider(0, 0, 1500, 0), over);

/** The rig's eye: the head's group carries the base of the neck, its rotation the eye's offset. */
function eyeOf(rig: PilotRig): THREE.Vector3 {
  return new THREE.Vector3(...EYE_NECK).applyEuler(rig.pilot.rotation).add(rig.pilot.position);
}

/** A rig posed seated (stand 0) or standing, both brakes at `b`, the canopy right overhead. */
function posed(b: number, stand = 0): PilotRig {
  const rig = new PilotRig();
  const st = still({ brakeL: b, brakeR: b, vx: 0, vy: 0 });
  for (let i = 0; i < 3; i++) rig.update({ st, stand, run: 0, dt: 1 / 60, canopyInv: new THREE.Quaternion() }, null);
  rig.body.updateMatrixWorld(true);
  return rig;
}

/** Distance from a point to a segment. */
function segDist(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = b.clone().sub(a);
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return a.clone().addScaledVector(ab, t).distanceTo(p);
}

/** The visible body's vertex nearest to a point (the head, hidden in first person, left out). */
function clearance(rig: PilotRig, p: THREE.Vector3): number {
  let best = Infinity;
  const v = new THREE.Vector3();
  rig.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
    for (let q: THREE.Object3D | null = m; q; q = q.parent) if (q === rig.pilot) return;
    const pos = m.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) best = Math.min(best, v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).distanceTo(p));
  });
  return best;
}

/** Brake pulley on the right C riser (glider-pilot.ts PULLEY). */
const PULLEY_R = new THREE.Vector3(0.252, 0.426, 0.072);

describe('pilot and harness', () => {
  it('builds the harness and the body as closed surfaces wound outwards', () => {
    for (const g of [torsoGeometry(), shellGeometry(), podGeometry(), fairingGeometry()]) {
      expect(signedVolume(g)).toBeGreaterThan(0);
      const p = g.getAttribute('position').array as Float32Array;
      expect(p.every(Number.isFinite)).toBe(true);
    }
  });

  it('puts the eyes where the first-person camera is, seated and standing', () => {
    const rig = new PilotRig();
    const q = new THREE.Quaternion();
    rig.update({ st: still(), stand: 0, run: 0, dt: 1 / 60, canopyInv: q }, null);
    expect(eyeOf(rig).distanceTo(new THREE.Vector3(...EYE_SEATED))).toBeLessThan(0.002);
    rig.update({ st: still(), stand: 1, run: 0, dt: 1 / 60, canopyInv: q }, null);
    expect(eyeOf(rig).distanceTo(new THREE.Vector3(...EYE_STANDING))).toBeLessThan(0.002);
  });

  it('stands on the ground, the soles under the carabiners where the take-off puts them', () => {
    const rig = new PilotRig();
    rig.update({ st: still(), stand: 1, run: 0, dt: 1 / 60, canopyInv: new THREE.Quaternion() }, null);
    const boots = rig.body.children.filter((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.getAttribute('position').count > 0).map((o) => o.position.y);
    // The two ankle joints (the lowest posed parts) are BODY.ankle above the soles.
    const ankles = boots.sort((a, b) => a - b).slice(0, 2);
    for (const y of ankles) expect(y - BODY.ankle).toBeCloseTo(FEET_Y, 2);
  });

  it('keeps the risers on the carabiners while the canopy turns about them', () => {
    const glider = buildGlider(undefined, { lod: 'high' });
    const st = still({ weightShift: 1 });
    for (let i = 0; i < 120; i++) glider.update(st, 1 / 60);
    expect(glider.sway!.roll).toBeLessThan(-0.05);
    glider.root.updateMatrixWorld(true);
    let straps: THREE.InstancedMesh | null = null;
    glider.root.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (m.isInstancedMesh && m.count === 8 && !straps && (m.material as THREE.MeshStandardMaterial).map) straps = m;
    });
    expect(straps).not.toBeNull();
    const s = straps as unknown as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const rootInv = glider.root.matrixWorld.clone().invert();
    for (let i = 0; i < 8; i++) {
      s.getMatrixAt(i, m);
      // The strap's origin is its bottom loop: in the glider frame, on its carabiner.
      p.setFromMatrixPosition(m).applyMatrix4(s.matrixWorld).applyMatrix4(rootInv);
      expect(Math.abs(Math.abs(p.x) - CARABINER_X)).toBeLessThan(0.002);
      expect(Math.abs(p.y - 0.036)).toBeLessThan(0.002);
    }
  });

  it('copes with the partial state of another pilot and with extreme states', () => {
    const glider = buildGlider();
    const partial = { brakeL: 0.3, brakeR: 0.6, collapse: { side: 1, amount: 0.5, frontal: 0, cravat: 0, cravatSide: 0 }, ears: 0 } as unknown as GliderState;
    for (let i = 0; i < 10; i++) glider.update(partial, 1 / 60);
    const wild = still({ brakeL: 1, brakeR: 1, speedbar: 1, ears: 1, stall: 1, spin: 1, load: 4, bankRate: 9, pitchRate: -9, tipHpL: 30, tipHpR: -30, weightShift: -1 });
    for (let i = 0; i < 60; i++) glider.update(wild, 1 / 60);
    glider.root.updateMatrixWorld(true);
    glider.root.traverse((o) => {
      for (const v of o.matrixWorld.elements) expect(Number.isFinite(v)).toBe(true);
    });
    expect(Math.abs(glider.sway!.roll)).toBeLessThanOrEqual(0.14);
    expect(Math.abs(glider.sway!.pitch)).toBeLessThanOrEqual(0.16);
  });
});

describe('gloved hands on the brakes', () => {
  it('makes a fist the size of a real hand in a thin glove', () => {
    // The hand above its cuff (a hand 19 cm long and 8.5 cm wide, a glove a few mm thick):
    // breadth with the thumb, knuckles above the wrist, depth from its back to the thumb.
    const p = gloveGeometry(false, false).getAttribute('position');
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) if (v.fromBufferAttribute(p, i).y > 0.02) box.expandByPoint(v);
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(0.08);
    expect(size.x).toBeLessThan(0.105);
    expect(box.max.y).toBeGreaterThan(0.105);
    expect(box.max.y).toBeLessThan(0.13);
    expect(size.z).toBeGreaterThan(0.06);
    expect(size.z).toBeLessThan(0.095);
  });

  it('closes every finger on the handle, its tip curled back under it', () => {
    for (const f of FINGERS) {
      const j = fingerJoints(f);
      const axis = handleAxis(f.x);
      let touch = Infinity;
      for (let k = 0; k < 3; k++) {
        // Each phalanx clear of the handle (a few mm of glove and padding squeezed at most)…
        const gap = segDist(axis, j[k], j[k + 1]) - (f.r0 + ((f.r1 - f.r0) * k) / 2) - HANDLE_R;
        expect(gap).toBeGreaterThan(-0.003);
        touch = Math.min(touch, gap);
      }
      // …and at least one of them on it.
      expect(touch).toBeLessThan(0.004);
      expect(j[3].z).toBeGreaterThan(j[2].z);
    }
  });

  it('holds the hands up at the eyes, under the pulleys, the elbows low against the harness', () => {
    const rig = posed(0);
    for (const s of [0, 1]) {
      const a = rig.armPose(s);
      const sg = s ? 1 : -1;
      expect(Math.abs(a.grip.y - EYE_SEATED[1])).toBeLessThan(0.08);
      expect(a.grip.z).toBeLessThan(EYE_SEATED[2] - 0.2);
      expect(a.swivel.y).toBeLessThan(PULLEY_R.y);
      expect(a.swivel.y).toBeGreaterThan(0.25);
      expect(a.elbow.y).toBeLessThan(a.shoulder.y - 0.1);
      expect(sg * a.elbow.x).toBeGreaterThan(0.21);
      expect(sg * a.elbow.x).toBeLessThan(0.32);
      // The forearm nearly upright.
      expect(a.wrist.clone().sub(a.elbow).normalize().y).toBeGreaterThan(0.85);
    }
  });

  it('brings the fists to the chin with a light brake and to the hips, elbows back, at full brake', () => {
    const light = posed(0.25).armPose(1);
    expect(light.grip.y).toBeLessThan(EYE_SEATED[1] - 0.1);
    expect(light.grip.y).toBeGreaterThan(light.shoulder.y - 0.03);
    const full = posed(1).armPose(1);
    expect(full.grip.y).toBeLessThan(full.shoulder.y - 0.25);
    expect(full.elbow.z).toBeGreaterThan(full.shoulder.z);
  });

  it('turns the handle towards the line it hangs on', () => {
    for (const b of [0, 0.25, 0.5, 1]) {
      const a = posed(b).armPose(1);
      const handle = a.swivel.clone().sub(a.grip).normalize();
      expect(handle.dot(PULLEY_R.clone().sub(a.swivel).normalize())).toBeGreaterThan(0.3);
    }
  });
});

describe('the first-person eye and the pose on the take-off', () => {
  it('keeps the eye clear of the body, neither in the neck nor in the chest', () => {
    for (const b of [0, 0.5, 1]) {
      expect(clearance(posed(b, 0), new THREE.Vector3(...EYE_SEATED))).toBeGreaterThan(0.065);
      expect(clearance(posed(b, 1), new THREE.Vector3(...EYE_STANDING))).toBeGreaterThan(0.065);
    }
  });

  it('lets the empty speedbag hang down the shins and the fairing stand behind the back', () => {
    const rig = posed(0, 1);
    const { pod, fairing } = rig as unknown as { pod: THREE.Object3D; fairing: THREE.Object3D };
    const shoulder = rig.armPose(1).shoulder;
    const p = new THREE.Box3().setFromObject(pod);
    // From the seat down below the knees, off the ground, in front of the hips.
    expect(p.max.y).toBeLessThan(shoulder.y - 0.3);
    expect(p.min.y).toBeLessThan(FEET_Y + 0.45);
    expect(p.min.y).toBeGreaterThan(FEET_Y + 0.1);
    expect(p.min.z).toBeLessThan(shoulder.z - 0.1);
    const f = new THREE.Box3().setFromObject(fairing);
    expect(f.max.y).toBeGreaterThan(shoulder.y - 0.05);
    expect(f.min.z).toBeGreaterThan(shoulder.z + 0.1);
  });
});

describe('canopy relative to the pilot', () => {
  it('rests with the pilot when nothing moves', () => {
    const s = new Sway();
    for (let i = 0; i < 300; i++) s.update(still(), 1 / 60);
    expect(Math.abs(s.roll)).toBeLessThan(1e-9);
    expect(Math.abs(s.pitch)).toBeLessThan(1e-9);
  });

  it('leans the harness under the risers with the weight shift (~5°), the canopy the other way', () => {
    const s = new Sway();
    for (let i = 0; i < 600; i++) s.update(still({ weightShift: 1 }), 1 / 60);
    expect(s.roll).toBeCloseTo(-0.09, 3);
  });

  it('lets the wing lead a roll and the pilot follow, then settles', () => {
    const s = new Sway();
    const st = still();
    let peak = 0;
    for (let i = 0; i < 240; i++) {
      // The glider rolls to the right faster and faster for 0.3 s, then steadily.
      st.bankRate = Math.min(0.6, (i / 60) * 2);
      s.update(st, 1 / 60);
      peak = Math.max(peak, s.roll);
    }
    expect(peak).toBeGreaterThan(0.01);
    expect(peak).toBeLessThan(0.14);
    expect(Math.abs(s.roll)).toBeLessThan(0.003);
  });

  it('flexes the tip lifted by a gust and leaves the other one', () => {
    const s = new Sway();
    for (let i = 0; i < 60; i++) s.update(still({ tipHpR: 2 }), 1 / 60);
    expect(s.flexR).toBeCloseTo(0.14, 2);
    expect(s.flexL).toBe(0);
    const d = newDeform();
    const rest = wingPoint(d, 1, 0, 0, 0, 0, 0, { x: 0, y: 0, z: 0 });
    d.flex[1] = 0.14;
    const bent = wingPoint(d, 1, 0, 0, 0, 0, 0, { x: 0, y: 0, z: 0 });
    expect(Math.hypot(bent.x - rest.x, bent.y - rest.y, bent.z - rest.z)).toBeCloseTo(0.14, 3);
    const left = wingPoint(d, -1, 0, 0, 0, 0, 0, { x: 0, y: 0, z: 0 });
    expect(left.x).toBeCloseTo(-rest.x, 6);
  });
});

describe('lines', () => {
  const positions = (ls: LineSet) => (ls.mesh.geometry.getAttribute('position').array as Float32Array).slice();

  it('are straight at rest and bow when slack (a folded side), finite everywhere', () => {
    const ls = new LineSet('high');
    const d = newDeform();
    d.brake[0] = d.brake[1] = 0.5;
    ls.update(d);
    const taut = positions(ls);
    expect(taut.every(Number.isFinite)).toBe(true);
    const folded = newDeform();
    folded.brake[0] = folded.brake[1] = 0.5;
    folded.foldL[0] = 0.2;
    folded.foldL[1] = 0.45;
    folded.foldL[2] = 2.45;
    folded.foldL[3] = 0.12;
    ls.update(folded);
    const slack = positions(ls);
    expect(slack.every(Number.isFinite)).toBe(true);
    // Some lines of the left side moved off their straight course.
    let moved = 0;
    for (let i = 0; i < slack.length; i++) if (Math.abs(slack[i] - taut[i]) > 0.05) moved++;
    expect(moved).toBeGreaterThan(20);
  });

  it('bow the brake lines hands up and pull them straight on the brakes', () => {
    const ls = new LineSet('high');
    const up = newDeform();
    ls.update(up);
    const a = positions(ls);
    const pulled = newDeform();
    pulled.brake[0] = pulled.brake[1] = 0.2;
    ls.update(pulled);
    const b = positions(ls);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff = Math.max(diff, Math.abs(a[i] - b[i]));
    expect(diff).toBeGreaterThan(0.03);
  });
});
