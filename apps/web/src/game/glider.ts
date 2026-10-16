/**
 * 3D paraglider: wing (arched, with an airfoil, brakes pulling the trailing edge and
 * collapses folding the tips or the leading edge), lines, risers, brake handles, hands
 * and the pilot in his harness. Glider frame: x right, y up, z backwards (metres), the
 * carabiners at the origin.
 */
import * as THREE from 'three';
import { wingDeformation, type GliderState } from './flight';

const SPAN_N = 40;
const CHORD_N = 10;
/** Arc of the wing: centre and radius in the y/x plane, half angle. */
const ARC_C = new THREE.Vector3(0, 1.3, 0);
const ARC_R = 6.1;
const ARC_HALF = (58 * Math.PI) / 180;
const LE_Z = -1.15;

/** Point on the wing for a span station s (-1..1), a chord station c (0 LE .. 1 TE) and a side (+1 upper, -1 lower). */
function wingPoint(s: number, c: number, side: number, st: GliderState, out: THREE.Vector3): THREE.Vector3 {
  const a = s * ARC_HALF;
  const nx = Math.sin(a);
  const ny = Math.cos(a);
  const chord = 2.7 * (1 - 0.55 * s * s);
  // Airfoil: thickness up to 15 % of the chord, the lower surface nearly flat.
  const thick = 0.15 * chord * (1 - 0.4 * s * s);
  const tProf = 2.6 * (Math.sqrt(c) - c) * (1 - 0.3 * c);
  let off = side > 0 ? thick * tProf : -0.15 * thick * tProf;
  const d = wingDeformation(st, s);
  // Brake: the trailing edge is pulled down over the last 40 % of the chord.
  off -= d.brake * 0.75 * Math.max(0, (c - 0.55) / 0.45) ** 1.6 * chord * 0.5;
  // Frontal: the leading edge tucks under.
  if (d.front > 0) off -= d.front * Math.max(0, 0.55 - c) * chord * 1.1;
  const r = ARC_R + off;
  let z = LE_Z + c * chord * (0.9 + 0.1 * Math.abs(s));
  let x = ARC_C.x + nx * r;
  let y = ARC_C.y + ny * r;
  if (d.fold > 0) {
    // Folded tip: swings under the wing around the fold line and shortens.
    const ang = d.fold * 2.4 * Math.sign(s);
    const px = ARC_C.x + Math.sin(a - Math.sign(s) * d.fold * 0.25) * ARC_R;
    const py = ARC_C.y + Math.cos(a - Math.sign(s) * d.fold * 0.25) * ARC_R;
    const dx = x - px;
    const dy = y - py;
    x = px + dx * Math.cos(ang) - dy * Math.sin(ang) - Math.sign(s) * d.fold * 0.9;
    y = py + dx * Math.sin(ang) + dy * Math.cos(ang) - d.fold * 1.4;
    z = LE_Z + (z - LE_Z) * (1 - 0.3 * d.fold);
  }
  return out.set(x, y, z);
}

export interface GliderModel {
  root: THREE.Group;
  setInflation(theta: number | null, phi?: number, facingWing?: boolean): void;
  /** The pilot and harness (hidden in first person: the camera is in his head). */
  pilot: THREE.Group;
  update(st: GliderState): void;
}

export function buildGlider(colors = { main: 0xd62f2f, stripe: 0xf4f1ea, under: 0xb8b2aa }): GliderModel {
  const root = new THREE.Group();
  /** Wing, lines and risers: rotates about the carabiners while inflating on the ground. */
  const canopy = new THREE.Group();
  root.add(canopy);
  // --- Wing: one grid for the upper surface, one for the lower, vertex colours.
  const wingGeo = new THREE.BufferGeometry();
  const nv = (SPAN_N + 1) * (CHORD_N + 1) * 2;
  const pos = new Float32Array(nv * 3);
  const col = new Float32Array(nv * 3);
  const idx: number[] = [];
  const cMain = new THREE.Color(colors.main);
  const cStripe = new THREE.Color(colors.stripe);
  const cUnder = new THREE.Color(colors.under);
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= SPAN_N; i++) {
      for (let j = 0; j <= CHORD_N; j++) {
        const v = side * (SPAN_N + 1) * (CHORD_N + 1) + i * (CHORD_N + 1) + j;
        const s = (i / SPAN_N) * 2 - 1;
        // Upper surface: red with a white band near the tips and a thin leading-edge band.
        const c = side === 0 ? (Math.abs(s) > 0.72 && Math.abs(s) < 0.84) || j === 0 ? cStripe : cMain : cUnder;
        col.set([c.r, c.g, c.b], v * 3);
        if (i < SPAN_N && j < CHORD_N) {
          const a = v;
          const b = v + 1;
          const d = v + CHORD_N + 1;
          const e = d + 1;
          if (side === 0) idx.push(a, d, b, b, d, e);
          else idx.push(a, b, d, b, e, d);
        }
      }
    }
  }
  wingGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  wingGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  wingGeo.setIndex(idx);
  const wing = new THREE.Mesh(wingGeo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  wing.frustumCulled = false;
  canopy.add(wing);

  // --- Risers (webbing) from the carabiners to the maillons.
  const strap = new THREE.MeshLambertMaterial({ color: 0x1b1d22 });
  const risers: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    for (const dz of [-0.05, 0.07]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.5, 0.006), strap);
      m.position.set(sx * 0.215, 0.25, dz);
      m.rotation.z = sx * -0.06;
      canopy.add(m);
      risers.push(m);
    }
    const carab = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 14), new THREE.MeshLambertMaterial({ color: 0xc8ccd2 }));
    carab.position.set(sx * 0.2, 0, 0);
    carab.rotation.y = Math.PI / 2;
    root.add(carab);
  }

  // --- Lines: A/B/C rows to the riser tops, brake lines to the handles.
  const lineGeo = new THREE.BufferGeometry();
  const LINE_STATIONS = 8;
  const rows = [0.12, 0.38, 0.66];
  const nLines = 2 * LINE_STATIONS * (rows.length + 1);
  const linePos = new Float32Array(nLines * 2 * 3);
  const lineCol = new Float32Array(nLines * 2 * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45 }));
  lines.frustumCulled = false;
  canopy.add(lines);
  const cLine = new THREE.Color(0x30343a);
  const cBrake = new THREE.Color(0xe36a1f);
  for (let k = 0; k < nLines * 2; k++) {
    const isBrake = Math.floor(k / 2) % (rows.length + 1) === rows.length;
    const c = isBrake ? cBrake : cLine;
    lineCol.set([c.r, c.g, c.b], k * 3);
  }

  // --- Brake handles and hands.
  const handleMat = new THREE.MeshLambertMaterial({ color: 0xc8202a });
  const gloveMat = new THREE.MeshLambertMaterial({ color: 0x2a2c31 });
  const handles: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16), handleMat);
    h.rotation.x = Math.PI / 2;
    g.add(h);
    // A gloved fist around the handle.
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), gloveMat);
    glove.scale.set(0.9, 1.3, 0.8);
    glove.position.set(0, -0.015, 0.01);
    g.add(glove);
    root.add(g);
    handles.push(g);
  }

  // --- Pilot and harness.
  const pilot = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: 0x24456e });
  const harness = new THREE.MeshLambertMaterial({ color: 0x15171b });
  const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.75, 6, 12), harness);
  seat.rotation.x = Math.PI / 2 - 0.35;
  seat.position.set(0, -0.2, -0.15);
  pilot.add(seat);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.38, 6, 12), suit);
  torso.position.set(0, 0.15, 0.12);
  torso.rotation.x = -0.25;
  pilot.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  helmet.position.set(0, 0.55, 0.05);
  pilot.add(helmet);
  root.add(pilot);

  // Cockpit pod in front of the legs: visible from the pilot's eyes, like a real harness.
  // Seen from the eyes (0.55 m above the carabiners) it fills the bottom of the view like
  // the pod of a real cocoon harness, without hiding the landscape ahead.
  const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.7, 6, 14), harness);
  pod.rotation.x = Math.PI / 2 - 0.12;
  pod.scale.set(1.1, 1, 0.7);
  pod.position.set(0, -0.36, -0.72);
  root.add(pod);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.015, 0.16), new THREE.MeshLambertMaterial({ color: 0x0c0d10 }));
  deck.position.set(0, -0.2, -0.42);
  deck.rotation.x = -0.25;
  root.add(deck);

  const p = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const canopyInv = new THREE.Quaternion();
  /**
   * Wing position on the ground: elevation θ (0 laid out, π/2 overhead) and side angle φ
   * (+ = to the right); in a reverse launch it is in front of the pilot. null in flight.
   */
  function setInflation(theta: number | null, phi = 0, facingWing = false): void {
    if (theta === null) canopy.rotation.set(0, 0, 0);
    else {
      const back = Math.PI / 2 - theta;
      canopy.rotation.set(facingWing ? -back : back, 0, -phi, 'XZY');
    }
    canopyInv.copy(canopy.quaternion).invert();
  }

  function update(st: GliderState): void {
    let v = 0;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i <= SPAN_N; i++) {
        const s = (i / SPAN_N) * 2 - 1;
        for (let j = 0; j <= CHORD_N; j++) {
          wingPoint(s, j / CHORD_N, side === 0 ? 1 : -1, st, p);
          pos[v++] = p.x;
          pos[v++] = p.y;
          pos[v++] = p.z;
        }
      }
    }
    wingGeo.attributes.position.needsUpdate = true;
    wingGeo.computeVertexNormals();
    wingGeo.computeBoundingSphere();

    // Handles: from the rear riser pulley down to the hip as the brake is pulled.
    const hand = (b: number, sx: number, g: THREE.Group) => {
      // Hands up at shoulder height on the rear risers, down to the hips at full brake.
      g.position.set(sx * (0.3 + 0.05 * b), 0.12 - 0.45 * b, -0.08 + 0.25 * b);
    };
    hand(st.brakeL, -1, handles[0]);
    hand(st.brakeR, 1, handles[1]);

    let k = 0;
    const put = (a: THREE.Vector3, b: THREE.Vector3) => {
      linePos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6);
      k++;
    };
    for (const sx of [-1, 1]) {
      const top = tmp.set(sx * 0.23, 0.5, 0);
      for (let q = 0; q < LINE_STATIONS; q++) {
        const s = sx * (0.08 + (0.9 * q) / (LINE_STATIONS - 1));
        for (const c of rows) {
          wingPoint(s, c, -1, st, p);
          put(p.clone(), top.clone().setZ(c < 0.3 ? -0.05 : 0.07));
        }
        wingPoint(s, 1, -1, st, p);
        // Handles live in the pilot's frame: back into the canopy's (rotated on the ground).
        const hp = handles[sx < 0 ? 0 : 1].position.clone().add(new THREE.Vector3(0, 0.05, 0)).applyQuaternion(canopyInv);
        put(p.clone(), hp);
      }
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.computeBoundingSphere();
    void risers;
  }

  update({
    brakeL: 0,
    brakeR: 0,
    collapse: { side: 0, amount: 0, frontal: 0 },
  } as GliderState);
  return { root, pilot, update, setInflation };
}
