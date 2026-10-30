"""
Cloth simulation of the canopy in Blender, headless, for the game's basis of fabric offsets
(apps/web/public/data/canopy-basis.bin, read by apps/web/src/game/glider-wing.ts).

The ribs and the line tabs hold the profile the game draws (glider-shape.ts, exported by
canopy-export.ts): they are pinned on it. Between them the two skins are cloth: ripstop that
barely stretches but buckles freely, cut to the lengths of the flying wing hands up (the rest
shape), the cells under the internal pressure of the ram air (~65 Pa at 38 km/h). Braking
pulls the rear of the ribs down: the skins between them settle into what the cloth makes of
it (the lower skin gathers into wrinkles near the trailing edge, the upper one balloons
between the brake tabs). The offsets from the game's shape, per brake level, quantized to
int8 with a scale per level.

  npx tsx scripts/blender/canopy-export.ts > /tmp/canopy-states.json
  blender -b --factory-startup --python scripts/blender/canopy-sim.py -- /tmp/canopy-states.json apps/web/public/data/canopy-basis.bin [frames]

File layout (little endian): 'CNB1', u16 cols, u16 rows, u16 levels, u16 0, f32 brake[levels],
f32 scale[levels], then int8 [level][col][row][xyz] (offset = value / 127 * scale, metres).

Only the pressurised wing is simulated here, per brake level. What moves (the span's heave,
surge and twist, the cells' internal pressure, the trailing edge's flutter, the folds) is the
game's reduced model (glider.ts WingDynamics, glider-shape.ts): a collapse bends the ribs
themselves and folds the fabric onto itself (contact), which this rig of held ribs cannot do,
and a table of baked folds could not follow a fold line that moves continuously (side, size,
angle, flapping). Nor would lower pressures add much: ripstop stretches < 1 % at 65 Pa, so the
inflated shape is the cut's down to a small fraction of the pressure, and the cells' buckling
near zero is drawn procedurally. The game's shape at full pressure is unchanged by the fabric
model, so this basis stays valid; rerun it only when the shape (glider-shape.ts) changes.
"""
import json
import struct
import sys

import bmesh
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
frames = int(argv[2]) if len(argv) > 2 else 90
data = json.load(open(src))
cols, rows = data["cols"], data["rows"]
ring = rows - 1  # the trailing edge's last row is its first


def vid(i, j):
    return i * ring + (j % ring)


def build(name, pose, rest):
    """
    The closed canopy (skins, tip closures) as a mesh cut at `rest` (the fabric's lengths),
    its shape key "pose" (animated in simulate()) bringing the pinned ribs to `pose`.
    """
    verts = [tuple(rest[i * rows + j]) for i in range(cols) for j in range(ring)]
    faces = []
    for i in range(cols - 1):
        for j in range(ring):
            faces.append((vid(i, j), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)))
    faces.append(tuple(vid(0, j) for j in range(ring)))
    faces.append(tuple(vid(cols - 1, j) for j in reversed(range(ring))))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    # Normals outwards: the pressure pushes along them.
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.shape_key_add(name="rest")
    k = ob.shape_key_add(name="pose")
    for i in range(cols):
        for j in range(ring):
            k.data[vid(i, j)].co = pose[i * rows + j]
    # Pinned: the ribs (every third column, the tips' closures with them) and the line tabs
    # on the lower skin are held by the ribs' own shape.
    g = ob.vertex_groups.new(name="pin")
    pinned = [vid(i, j) for i in range(0, cols, 3) for j in range(ring)]
    g.add(pinned, 1.0, "REPLACE")
    return ob


def simulate(ob):
    mod = ob.modifiers.new("cloth", "CLOTH")
    c = mod.settings
    c.quality = 10
    c.mass = 0.004  # kg per vertex: ~40 g/m² ripstop over ~0.01 m² per vertex
    c.air_damping = 1.0
    c.tension_stiffness = 80.0
    c.compression_stiffness = 2.0
    c.shear_stiffness = 4.0
    c.bending_stiffness = 0.02
    c.tension_damping = 5.0
    c.compression_damping = 2.0
    c.bending_damping = 0.2
    c.vertex_group_mass = "pin"
    c.pin_stiffness = 50.0
    c.use_pressure = True
    c.uniform_pressure_force = 65.0
    c.pressure_factor = 1.0
    c.effector_weights.gravity = 0.0
    mod.point_cache.frame_start = 1
    mod.point_cache.frame_end = frames
    # The ribs pulled from the hands-up shape to the state's over the first third, then held
    # while the cloth settles (the cloth's lengths are those of its first frame).
    key = ob.data.shape_keys.key_blocks["pose"]
    key.value = 0.0
    key.keyframe_insert("value", frame=1)
    key.value = 1.0
    key.keyframe_insert("value", frame=max(2, frames // 3))
    sc = bpy.context.scene
    for f in range(1, frames + 1):
        sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    return [tuple(v.co) for v in ev.data.vertices]


rest = data["states"][0]["pts"]
levels = []
for s in data["states"]:
    ob = build(f"canopy-{s['brake']}", s["pts"], rest)
    out = simulate(ob)
    off = []
    for i in range(cols):
        for j in range(rows):
            p = out[vid(i, j)]
            q = s["pts"][i * rows + j]
            off.append((p[0] - q[0], p[1] - q[1], p[2] - q[2]))
    m = max(max(abs(x) for x in o) for o in off)
    print(f"brake {s['brake']}: max offset {m:.4f} m", flush=True)
    levels.append((s["brake"], off, max(m, 1e-4)))
    bpy.data.objects.remove(ob)

with open(dst, "wb") as fh:
    fh.write(b"CNB1")
    fh.write(struct.pack("<HHHH", cols, rows, len(levels), 0))
    fh.write(struct.pack(f"<{len(levels)}f", *[l[0] for l in levels]))
    fh.write(struct.pack(f"<{len(levels)}f", *[l[2] for l in levels]))
    for _, off, sc in levels:
        fh.write(bytes((max(-127, min(127, round(x / sc * 127))) & 0xFF) for o in off for x in o))
print("written", dst, flush=True)
