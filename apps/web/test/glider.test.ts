import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { newGlider, type GliderState } from '../src/game/flight';
import { buildGlider, Sway } from '../src/game/glider';
import { BODY, CARABINER_X, EYE_NECK, EYE_SEATED, EYE_STANDING, FEET_Y, fairingGeometry, podGeometry, shellGeometry, torsoGeometry } from '../src/game/glider-gear';
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
