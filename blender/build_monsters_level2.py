"""Build level 2's ten monsters as rigged low-poly GLB models with an attack loop.

Level 1's cast (blender/build_monsters.py) is modelled and rigged the same way,
on the plainest loops of the six — that script imports this one for the rig, the
primitives and the shared attack loops, as levels 3-6 do. This script keeps each
monster split into rig groups (legs, torso, head, arms, weapon, wings, tail...),
parents them into a real hierarchy, keyframes a one-second attack loop, and
exports it as a glTF animation that Monster.tsx plays with useAnimations.

Footprint matches level 1 exactly so nothing needs per-file tuning: X-centred,
base at local y=0, top at or below local y=2 (glTF is Y-up, Blender is Z-up —
the exporter converts). Models face -Y in Blender, which becomes +Z in glTF:
the direction the dungeon's characters face.

Run it from the repo root:

    blender --background --python blender/build_monsters_level2.py
    blender --background --python blender/build_monsters_level2.py -- --preview

Writes public/monsters/<name>_attack.glb, and with --preview also renders
blender/preview/level2/<name>.png (rest) and <name>_strike.png (contact frame).
Only needed when these models change; the generated .glb files are committed.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

PI = math.pi
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_MODELS = os.path.join(REPO, "public", "monsters")
OUT_PREVIEW = os.path.join(REPO, "blender", "preview", "level2")

# One second at 24fps. Frame 1 and frame LAST hold the same pose so the clip
# loops without a hitch when three.js repeats it.
FPS = 24
LAST = 24

PREVIEW_OBJECTS = {"PreviewCam", "PreviewKey", "PreviewFill", "PreviewRim"}

# --------------------------------------------------------------------------
# rig groups
#
# A group is one joined mesh with its origin at a named pivot — the joint it
# swings around. Groups can nest (an axe hangs off an arm, an arm off a torso),
# which is what lets a single rotation key on the torso carry the head and both
# arms with it.
# --------------------------------------------------------------------------
GROUPS = []          # ordered list of dicts: name, pivot, parent, parts
CURRENT = None
OBJ = {}             # group name -> the joined object (or empty)
REST = {}            # group name -> its rest location, so keys can be offsets


def group(name, pivot=(0, 0, 0), parent=None):
    """Start (or re-select) a rig group. Parents must be declared before children."""
    global CURRENT
    for g in GROUPS:
        if g["name"] == name:
            CURRENT = g
            return name
    CURRENT = {"name": name, "pivot": Vector(pivot), "parent": parent, "parts": []}
    GROUPS.append(CURRENT)
    return name


# --------------------------------------------------------------------------
# primitives
# --------------------------------------------------------------------------
def _lin(c):
    """One sRGB byte to the linear value Blender's Base Color expects."""
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mat(name, hexcol, rough=0.7, metal=0.0, emit=0.0, alpha=1.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    if m.node_tree is None:                # pre-5.x needs this switched on by hand
        m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    r, g, bl = (_lin(int(hexcol[i:i + 2], 16)) for i in (0, 2, 4))
    b.inputs["Base Color"].default_value = (r, g, bl, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (r, g, bl, 1)
        b.inputs["Emission Strength"].default_value = emit
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        try:
            m.blend_method = 'BLEND'
        except Exception:
            pass
    return m


def _finish(o, m):
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = False          # flat shading is the whole look
    CURRENT["parts"].append(o)
    return o


def ico(loc, r=0.5, sub=2, scale=(1, 1, 1), m=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc, rotation=rot)
    o = bpy.context.view_layer.objects.active
    o.scale = scale
    return _finish(o, m)


def cube(loc, size=1.0, scale=(1, 1, 1), m=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=size, location=loc, rotation=rot)
    o = bpy.context.view_layer.objects.active
    o.scale = scale
    return _finish(o, m)


def cone(loc, r1=0.5, r2=0.0, depth=1.0, verts=8, m=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth,
                                    location=loc, rotation=rot)
    return _finish(bpy.context.view_layer.objects.active, m)


def cyl(loc, r=0.3, depth=1.0, verts=8, m=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=loc, rotation=rot)
    return _finish(bpy.context.view_layer.objects.active, m)


def torus(loc, major=0.3, minor=0.02, m=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=loc, major_radius=major, minor_radius=minor,
                                     major_segments=14, minor_segments=5, rotation=rot)
    return _finish(bpy.context.view_layer.objects.active, m)


def reset():
    GROUPS.clear()
    OBJ.clear()
    REST.clear()
    for o in list(bpy.data.objects):
        if o.name in PREVIEW_OBJECTS:
            continue
        bpy.data.objects.remove(o, do_unlink=True)
    for d in list(bpy.data.meshes):
        if d.users == 0:
            bpy.data.meshes.remove(d)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)


# --------------------------------------------------------------------------
# assembly
# --------------------------------------------------------------------------
def _join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = name
    return o


def assemble(name, target_height):
    """Join each group, hang them off a motion empty, and normalise the whole rig.

    The result is two nested empties: `name` carries the normalising scale and
    offset (so the model is X/Y-centred, sits on z=0 and is target_height tall),
    and `name_motion` sits at the origin inside it for whole-body movement —
    lunges, hovering, recoil — without disturbing that normalisation.
    """
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    root = bpy.context.view_layer.objects.active
    root.name = name
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    motion = bpy.context.view_layer.objects.active
    motion.name = name + "_motion"
    motion.parent = root
    OBJ['motion'] = motion
    REST['motion'] = Vector((0, 0, 0))

    for g in GROUPS:
        if not g["parts"]:
            continue
        o = _join(g["parts"], "%s_%s" % (name, g["name"]))
        o.data.transform(Matrix.Translation(-g["pivot"]))
        o.location = g["pivot"]
        OBJ[g["name"]] = o
        REST[g["name"]] = Vector(g["pivot"])

    bpy.context.view_layer.update()
    for g in GROUPS:
        o = OBJ.get(g["name"])
        if o is None:
            continue
        p = OBJ[g["parent"]] if g["parent"] else motion
        o.parent = p
        o.matrix_parent_inverse = p.matrix_world.inverted()
    bpy.context.view_layer.update()

    pts = []
    for g in GROUPS:
        o = OBJ.get(g["name"])
        if o is None:
            continue
        mw = o.matrix_world
        pts.extend(mw @ v.co for v in o.data.vertices)
    minz, maxz = min(p.z for p in pts), max(p.z for p in pts)
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    s = target_height / (maxz - minz)
    root.scale = (s, s, s)
    root.location = (-cx * s, -cy * s, -minz * s)
    bpy.context.view_layer.update()
    return root


def key(name, frame, rot=(0, 0, 0), move=(0, 0, 0), scale=1.0):
    """Key one group at `frame`. rot/move are relative to its rest pose."""
    o = OBJ[name]
    o.rotation_euler = rot
    o.location = REST[name] + Vector(move)
    o.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    o.keyframe_insert('rotation_euler', frame=frame)
    o.keyframe_insert('location', frame=frame)
    o.keyframe_insert('scale', frame=frame)


def hold(names, frames):
    """Key the rest pose for groups that are otherwise untouched at those frames."""
    for n in names:
        for f in frames:
            key(n, f)


def export(root, filename):
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for o in root.children_recursive:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(OUT_MODELS, filename)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_apply=False, export_yup=True,
        export_animations=True, export_animation_mode='SCENE',
        # Defaults to True, which emits one glTF animation per object — the
        # rig would then need nine clips played in lockstep instead of one.
        export_anim_scene_split_object=False,
        export_frame_range=True, export_bake_animation=True,
        export_optimize_animation_size=False,
    )
    tris = sum(len(o.data.polygons) for o in root.children_recursive if o.type == 'MESH')
    print("wrote %s (%d faces, %d groups, %d frames)" % (filename, tris, len(GROUPS), LAST))


# --------------------------------------------------------------------------
# shared materials and parts
# --------------------------------------------------------------------------
WHITE = PUPIL = STEEL = DARKSTEEL = WOOD = BONE = None


def _common():
    global WHITE, PUPIL, STEEL, DARKSTEEL, WOOD, BONE
    WHITE = mat("EyeWhite", "FFFFFF", rough=0.4)
    PUPIL = mat("Pupil", "16202a", rough=0.35)
    STEEL = mat("Steel", "b8bec9", rough=0.3, metal=0.7)
    DARKSTEEL = mat("DarkSteel", "6b7079", rough=0.4, metal=0.65)
    WOOD = mat("Haft", "6b4a2a", rough=0.9)
    BONE = mat("Bone", "e8dcc2", rough=0.5)


def eyes(z, y=-0.235, dx=0.125, r=0.056, pupil=None, glow=False):
    for s in (-1, 1):
        ico((s * dx, y, z), r=r, sub=2, m=(pupil if glow else WHITE))
        if not glow:
            ico((s * dx * 1.08, y - 0.04, z), r=r * 0.52, sub=2, m=pupil or PUPIL)


def soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.0, belly=1.0, tusks=0.0, ears=True):
    """Stocky two-legged fighter, split into legs / torso / head / two arms.

    W widens the whole frame, belly rounds out the gut, tusks>0 pushes a pair of
    lower fangs past the lip. The arm groups are left empty of anything but the
    limb itself so each monster can hang its own weapon off them.
    """
    group('legs')
    for s in (-1, 1):
        cyl((s * 0.19 * W, 0, 0.30), r=0.115 * W, depth=0.54, verts=8, m=SKIN)
        cube((s * 0.19 * W, -0.07, 0.055), scale=(0.24 * W, 0.34, 0.11), m=CLOTH2)
        for k in (-1, 0, 1):                       # toes
            cone((s * 0.19 * W + k * 0.07 * W, -0.23, 0.045), r1=0.026, depth=0.09,
                 verts=4, m=DARK, rot=(-PI / 2, 0, 0))

    group('torso', pivot=(0, 0, 0.55))
    ico((0, 0, 0.83), r=0.34, sub=2, scale=(1.14 * W * belly, 1.00 * belly, 1.00), m=SKIN)
    ico((0, 0, 1.06), r=0.31, sub=2, scale=(1.32 * W, 0.94, 0.78), m=SKIN)
    cone((0, 0, 0.60), r1=0.33 * W, r2=0.27 * W, depth=0.26, verts=9, m=CLOTH)
    cyl((0, 0, 0.73), r=0.33 * W * belly, depth=0.09, verts=10, m=CLOTH2)
    cube((0, -0.30 * belly, 0.73), scale=(0.13, 0.05, 0.13), m=STEEL)          # belt buckle
    cone((0, 0.16, 1.02), r1=0.30 * W, r2=0.20 * W, depth=0.30, verts=8, m=CLOTH)  # back cloak

    group('head', pivot=(0, 0, 1.16), parent='torso')
    ico((0, 0, 1.31), r=0.29, sub=2, scale=(1.04, 0.98, 1.02), m=SKIN)
    if ears:
        for s in (-1, 1):
            cone((s * 0.37, 0.03, 1.38), r1=0.10, depth=0.34, verts=6, m=SKIN, rot=(0, s * 1.22, 0))
    cone((0, -0.26, 1.28), r1=0.072, depth=0.21, verts=6, m=SKIN, rot=(PI / 2, 0, 0))  # nose
    eyes(1.38)
    cube((0, -0.235, 1.16), scale=(0.34, 0.08, 0.055), m=DARK)                 # mouth line
    if tusks:
        for s in (-1, 1):
            cone((s * 0.11, -0.225, 1.20), r1=0.036 * tusks, depth=0.20 * tusks,
                 verts=4, m=BONE, rot=(-0.22, 0, 0))

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.40 * W, 0, 1.06), parent='torso')
        cyl((side * 0.40 * W, 0, 0.86), r=0.088 * W, depth=0.42, verts=7, m=SKIN)
        ico((side * 0.40 * W, -0.02, 0.62), r=0.105 * W, sub=1, m=SKIN)        # fist
        ico((side * 0.44 * W, 0, 1.06), r=0.14 * W, sub=1, scale=(1.0, 1.0, 0.7), m=CLOTH2)


def specter_base(GHOST, GHOST_D, CORE, EYE, tail_tips=6):
    """A legless hovering ghost: tapered tail, ribbed chest, hollow head, claws."""
    group('tail')
    cone((0, 0, 0.46), r1=0.40, r2=0.26, depth=0.92, verts=9, m=GHOST_D)
    for i in range(tail_tips):
        a = 2 * PI * i / tail_tips + 0.25
        cone((0.30 * math.cos(a), 0.30 * math.sin(a), 0.10), r1=0.075, depth=0.30,
             verts=4, m=GHOST_D, rot=(PI, 0, 0))

    group('torso', pivot=(0, 0, 0.90))
    ico((0, 0, 1.10), r=0.33, sub=2, scale=(1.10, 0.86, 1.00), m=GHOST)
    for k, z in enumerate((0.96, 1.08, 1.20)):                 # ribs
        torus((0, -0.04, z), major=0.30 - k * 0.015, minor=0.026, m=GHOST_D, rot=(PI / 2, 0, 0))
    ico((0, -0.10, 1.08), r=0.10, sub=2, m=CORE)               # the spark in the chest

    group('head', pivot=(0, 0, 1.32), parent='torso')
    ico((0, -0.02, 1.46), r=0.25, sub=2, scale=(1.00, 0.94, 1.06), m=GHOST)
    cone((0, 0.04, 1.66), r1=0.25, r2=0.05, depth=0.34, verts=8, m=GHOST_D)   # hood peak
    ico((0, -0.14, 1.44), r=0.17, sub=2, scale=(0.95, 0.80, 1.00), m=CORE)    # hollow face
    eyes(1.47, y=-0.245, dx=0.082, r=0.046, pupil=EYE, glow=True)

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.30, -0.02, 1.16), parent='torso')
        cone((side * 0.42, -0.10, 0.98), r1=0.115, r2=0.055, depth=0.50, verts=6, m=GHOST,
             rot=(0.12, side * 0.30, 0))
        ico((side * 0.52, -0.18, 0.74), r=0.070, sub=1, m=GHOST_D)
        for k in range(3):
            cone((side * 0.52 + (k - 1) * 0.048, -0.21, 0.64), r1=0.020, depth=0.17,
                 verts=4, m=CORE, rot=(PI + 0.20, 0, 0))


def wraith_base(ROBE, ROBE_D, VOID, EYE, tatters=9):
    """The level 1 wraith silhouette, split for rigging: robe / torso / head / arms."""
    group('robe')
    cone((0, 0, 0.62), r1=0.46, r2=0.30, depth=1.12, verts=10, m=ROBE)
    for i in range(tatters):
        a = 2 * PI * i / tatters + 0.2
        cone((0.42 * math.cos(a), 0.42 * math.sin(a), 0.11), r1=0.095, depth=0.36,
             verts=4, m=ROBE_D, rot=(PI, 0, 0))

    group('torso', pivot=(0, 0, 1.05))
    ico((0, 0, 1.16), r=0.30, sub=2, scale=(1.18, 1.06, 0.55), m=ROBE)

    group('head', pivot=(0, 0, 1.24), parent='torso')
    cone((0, 0.03, 1.44), r1=0.30, r2=0.055, depth=0.46, verts=8, m=ROBE)
    ico((0, -0.13, 1.35), r=0.19, sub=2, scale=(0.95, 0.85, 1.05), m=VOID)
    for s in (-1, 1):
        ico((s * 0.078, -0.255, 1.37), r=0.045, sub=2, m=EYE)

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.28, 0, 1.10), parent='torso')
        cone((side * 0.36, -0.05, 0.88), r1=0.135, r2=0.07, depth=0.54, verts=6, m=ROBE,
             rot=(0.10, side * 0.24, 0))
        ico((side * 0.45, -0.14, 0.60), r=0.078, sub=1, m=VOID)
        for k in range(3):
            cone((side * 0.45 + (k - 1) * 0.045, -0.17, 0.50), r1=0.019, depth=0.15,
                 verts=4, m=VOID, rot=(PI + 0.18, 0, 0))


# --------------------------------------------------------------------------
# shared attack loops
# --------------------------------------------------------------------------
def anim_overhead_chop(weapon_arm='arm_r', off_arm='arm_l', base='legs', reach=0.26, lean=0.34):
    """Wind the weapon arm back over the head, then drive it down with the body."""
    body = ['motion', base, 'torso', 'head', weapon_arm, off_arm]
    hold(body, [1])
    key('motion', 7, move=(0, 0.10, 0))
    key('torso', 7, rot=(-0.20, 0, 0))
    key('head', 7, rot=(-0.14, 0, 0))
    key(weapon_arm, 7, rot=(2.35, 0, -0.30))
    key(off_arm, 7, rot=(-0.35, 0, 0.20))
    key(base, 7, move=(0, 0.02, 0))

    key('motion', 12, move=(0, -reach, 0))
    key('torso', 12, rot=(lean, 0, 0))
    key('head', 12, rot=(0.20, 0, 0))
    key(weapon_arm, 12, rot=(-0.95, 0, 0.12))
    key(off_arm, 12, rot=(0.45, 0, -0.25))
    key(base, 12, move=(0, -reach * 0.35, 0))

    key('motion', 16, move=(0, -reach * 0.45, 0))
    key('torso', 16, rot=(lean * 0.55, 0, 0))
    key('head', 16, rot=(0.08, 0, 0))
    key(weapon_arm, 16, rot=(-0.62, 0, 0.05))
    key(off_arm, 16, rot=(0.20, 0, -0.10))
    key(base, 16, move=(0, -reach * 0.15, 0))

    hold(body, [LAST])


def anim_double_swipe(reach=0.22):
    """Both arms cross in front — the twin-weapon opener."""
    body = ['motion', 'legs', 'torso', 'head', 'arm_r', 'arm_l']
    hold(body, [1])
    key('motion', 6, move=(0, 0.09, 0), rot=(0, 0, 0.16))
    key('torso', 6, rot=(-0.16, 0, 0.30))
    key('arm_r', 6, rot=(1.25, 0, -0.85))
    key('arm_l', 6, rot=(1.25, 0, 0.85))
    key('head', 6, rot=(-0.10, 0, 0.14))

    key('motion', 11, move=(0, -reach, 0), rot=(0, 0, -0.14))
    key('torso', 11, rot=(0.26, 0, -0.34))
    key('arm_r', 11, rot=(-0.55, 0, 1.25))
    key('arm_l', 11, rot=(-0.55, 0, -1.25))
    key('head', 11, rot=(0.16, 0, -0.16))

    key('motion', 15, move=(0, -reach * 0.4, 0), rot=(0, 0, 0.05))
    key('torso', 15, rot=(0.10, 0, 0.12))
    key('arm_r', 15, rot=(-0.20, 0, 0.55))
    key('arm_l', 15, rot=(-0.20, 0, -0.55))
    key('head', 15, rot=(0.05, 0, 0.05))
    key('legs', 15)

    hold(body, [LAST])


def anim_ghost_lunge(rise=0.10, reach=0.30):
    """Hovering monsters: drift up, coil back, then throw the whole body forward."""
    body = ['motion', 'tail', 'torso', 'head', 'arm_r', 'arm_l']
    hold(body, [1])
    key('motion', 7, move=(0, 0.14, rise), scale=(0.94, 0.94, 1.10))
    key('torso', 7, rot=(-0.30, 0, 0))
    key('head', 7, rot=(-0.22, 0, 0))
    key('arm_r', 7, rot=(0.95, 0, -0.45))
    key('arm_l', 7, rot=(0.95, 0, 0.45))
    key('tail', 7, rot=(-0.18, 0, 0))

    key('motion', 12, move=(0, -reach, rise * 0.3), scale=(1.10, 1.10, 0.92))
    key('torso', 12, rot=(0.42, 0, 0))
    key('head', 12, rot=(0.30, 0, 0))
    key('arm_r', 12, rot=(-0.80, 0, 0.85))
    key('arm_l', 12, rot=(-0.80, 0, -0.85))
    key('tail', 12, rot=(0.24, 0, 0))

    key('motion', 17, move=(0, -reach * 0.35, rise * 0.6), scale=(1.0, 1.0, 1.0))
    key('torso', 17, rot=(0.14, 0, 0))
    key('head', 17, rot=(0.10, 0, 0))
    key('arm_r', 17, rot=(-0.28, 0, 0.30))
    key('arm_l', 17, rot=(-0.28, 0, -0.30))
    key('tail', 17, rot=(0.08, 0, 0))

    hold(body, [LAST])


def anim_wraith_cast(sweep=1.15):
    """Raise both sleeves, then sweep them down and out — the caster's release."""
    body = ['motion', 'robe', 'torso', 'head', 'arm_r', 'arm_l']
    hold(body, [1])
    key('motion', 8, move=(0, 0.06, 0.12))
    key('torso', 8, rot=(-0.18, 0, 0))
    key('head', 8, rot=(-0.24, 0, 0))
    key('arm_r', 8, rot=(1.55, 0, -0.55))
    key('arm_l', 8, rot=(1.55, 0, 0.55))
    key('robe', 8, rot=(-0.10, 0, 0), scale=(0.94, 0.94, 1.08))

    key('motion', 13, move=(0, -0.20, -0.02))
    key('torso', 13, rot=(0.30, 0, 0))
    key('head', 13, rot=(0.26, 0, 0))
    key('arm_r', 13, rot=(-0.60, 0, sweep))
    key('arm_l', 13, rot=(-0.60, 0, -sweep))
    key('robe', 13, rot=(0.14, 0, 0), scale=(1.10, 1.10, 0.94))

    key('motion', 18, move=(0, -0.05, 0.05))
    key('torso', 18, rot=(0.08, 0, 0))
    key('head', 18, rot=(0.06, 0, 0))
    key('arm_r', 18, rot=(-0.18, 0, sweep * 0.35))
    key('arm_l', 18, rot=(-0.18, 0, -sweep * 0.35))
    key('robe', 18, rot=(0.03, 0, 0))

    hold(body, [LAST])


# --------------------------------------------------------------------------
# the cast
# --------------------------------------------------------------------------
def build_goblin_warrior():
    """Goblin Warrior — level 2's opener: a level 1 goblin that found armour."""
    reset()
    SKIN = mat("GwSkin", "a8632f", rough=0.65)
    DARK = mat("GwDark", "6f3c18", rough=0.7)
    CLOTH = mat("GwCloth", "7a4a28", rough=0.85)
    CLOTH2 = mat("GwCloth2", "3f2716", rough=0.9)
    IRON = mat("GwIron", "8d939c", rough=0.4, metal=0.6)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.0, belly=1.0)

    group('torso')
    cyl((0, 0, 1.10), r=0.36, depth=0.10, verts=10, m=IRON)                 # gorget
    for s in (-1, 1):
        ico((s * 0.40, 0, 1.10), r=0.19, sub=1, scale=(1.0, 1.0, 0.60), m=IRON)
    group('head')
    cone((0, 0.01, 1.50), r1=0.30, r2=0.07, depth=0.26, verts=8, m=IRON)    # helm cap
    cube((0, -0.24, 1.44), scale=(0.10, 0.14, 0.30), m=IRON)                # nasal bar

    group('weapon', pivot=(-0.40, 0, 0.62), parent='arm_r')                 # a short sword
    cyl((-0.40, -0.04, 0.56), r=0.032, depth=0.20, verts=6, m=CLOTH2)
    cube((-0.40, -0.04, 0.68), scale=(0.26, 0.06, 0.05), m=IRON)
    cube((-0.40, -0.04, 0.98), scale=(0.075, 0.030, 0.62), m=STEEL)
    cone((-0.40, -0.04, 1.36), r1=0.055, r2=0.0, depth=0.18, verts=4, m=STEEL)
    group('shield', pivot=(0.40, 0, 0.90), parent='arm_l')
    cyl((0.50, -0.14, 0.86), r=0.30, depth=0.06, verts=6, m=IRON, rot=(PI / 2, 0, 0.1))
    ico((0.50, -0.20, 0.86), r=0.09, sub=1, scale=(1, 0.5, 1), m=STEEL)

    root = assemble("GoblinWarrior", 1.66)
    hold(['weapon', 'shield'], [1, LAST])
    anim_overhead_chop(reach=0.26, lean=0.34)
    export(root, "goblinwarrior_attack.glb")
    return 12


def build_goblin_marauder():
    """Goblin Marauder — the raider: horned helm, a hand axe in each fist."""
    reset()
    SKIN = mat("GmSkin", "b8763a", rough=0.65)
    DARK = mat("GmDark", "7d4a1e", rough=0.7)
    CLOTH = mat("GmCloth", "6a4326", rough=0.85)
    CLOTH2 = mat("GmCloth2", "39220f", rough=0.9)
    FUR = mat("GmFur", "8a6a44", rough=0.95)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.06, belly=0.96)

    group('torso')
    for s in (-1, 1):
        ico((s * 0.44, 0.02, 1.12), r=0.20, sub=1, scale=(1.0, 1.1, 0.62), m=FUR)
    cube((0, -0.05, 0.96), scale=(0.16, 0.62, 0.55), m=CLOTH2, rot=(0, 0, 0.5))   # bandolier
    group('head')
    cone((0, 0.01, 1.50), r1=0.29, r2=0.10, depth=0.22, verts=7, m=DARK)
    for s in (-1, 1):                                                    # helm horns
        cone((s * 0.22, 0.04, 1.62), r1=0.070, r2=0.01, depth=0.40, verts=5, m=BONE,
             rot=(0.15, s * 1.05, 0))

    for side, gname, arm in ((-1, 'axe_r', 'arm_r'), (1, 'axe_l', 'arm_l')):
        group(gname, pivot=(side * 0.424, 0, 0.62), parent=arm)
        cyl((side * 0.424, -0.04, 0.72), r=0.030, depth=0.44, verts=6, m=WOOD)
        cube((side * 0.424, -0.04, 0.95), scale=(0.055, 0.10, 0.20), m=DARKSTEEL)
        cone((side * 0.424, -0.16, 0.97), r1=0.17, r2=0.02, depth=0.055, verts=3,
             m=STEEL, rot=(PI / 2, 0, 0))

    root = assemble("GoblinMarauder", 1.72)
    hold(['axe_r', 'axe_l'], [1, LAST])
    anim_double_swipe(reach=0.24)
    export(root, "goblinmarauder_attack.glb")
    return 11


def build_orc():
    """Orc — a slab of muscle with a studded club."""
    reset()
    SKIN = mat("OrcSkin", "5c7a3d", rough=0.7)
    DARK = mat("OrcDark", "3c5326", rough=0.75)
    CLOTH = mat("OrcCloth", "4a3a24", rough=0.9)
    CLOTH2 = mat("OrcCloth2", "251c11", rough=0.9)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.34, belly=1.16, tusks=1.0, ears=False)

    group('head')
    for s in (-1, 1):                                    # small swept-back ears
        cone((s * 0.30, 0.06, 1.34), r1=0.075, depth=0.22, verts=5, m=SKIN, rot=(0, s * 1.45, 0))
    cube((0, 0.02, 1.54), scale=(0.34, 0.30, 0.10), m=CLOTH2)          # headband
    group('torso')
    for s in (-1, 1):
        ico((s * 0.52, 0, 1.10), r=0.22, sub=1, scale=(1.0, 1.0, 0.72), m=SKIN)
        cube((s * 0.52, -0.06, 1.24), scale=(0.30, 0.30, 0.07), m=DARK)   # shoulder plate

    group('club', pivot=(-0.536, 0, 0.62), parent='arm_r')
    cyl((-0.536, -0.05, 0.80), r=0.045, depth=0.62, verts=6, m=WOOD)
    cone((-0.536, -0.05, 1.20), r1=0.10, r2=0.155, depth=0.42, verts=7, m=WOOD)
    for i in range(6):
        a = 2 * PI * i / 6
        cone((-0.536 + 0.14 * math.cos(a), -0.05 + 0.14 * math.sin(a), 1.16 + (i % 3) * 0.08),
             r1=0.040, r2=0.0, depth=0.13, verts=4, m=DARKSTEEL,
             rot=(math.sin(a) * -1.5, math.cos(a) * 1.5, 0))

    root = assemble("Orc", 1.80)
    hold(['club'], [1, LAST])
    anim_overhead_chop(reach=0.30, lean=0.40)
    export(root, "orc_attack.glb")
    return 12


def build_orc_berserker():
    """Orc Berserker — the same frame gone feral: war paint, twin axes, no armour."""
    reset()
    SKIN = mat("ObSkin", "4a6a2f", rough=0.7)
    DARK = mat("ObDark", "2e4a1c", rough=0.75)
    CLOTH = mat("ObCloth", "5a2a24", rough=0.9)
    CLOTH2 = mat("ObCloth2", "1e1410", rough=0.9)
    PAINT = mat("ObPaint", "c0342f", rough=0.6)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.42, belly=1.10, tusks=1.25, ears=False)

    group('head')
    for s in (-1, 1):
        cube((s * 0.13, -0.245, 1.42), scale=(0.09, 0.06, 0.46), m=PAINT)    # war paint
        cone((s * 0.32, 0.05, 1.36), r1=0.070, depth=0.20, verts=5, m=SKIN, rot=(0, s * 1.5, 0))
    cone((0, 0.14, 1.56), r1=0.16, r2=0.02, depth=0.40, verts=5, m=CLOTH, rot=(-0.6, 0, 0))  # topknot
    group('torso')
    for s in (-1, 1):
        ico((s * 0.56, 0, 1.10), r=0.235, sub=1, scale=(1.0, 1.0, 0.74), m=SKIN)
        cube((s * 0.30, -0.32, 0.92), scale=(0.09, 0.05, 0.40), m=PAINT, rot=(0, s * 0.3, 0))

    for side, gname, arm in ((-1, 'axe_r', 'arm_r'), (1, 'axe_l', 'arm_l')):
        group(gname, pivot=(side * 0.568, 0, 0.62), parent=arm)
        cyl((side * 0.568, -0.05, 0.78), r=0.036, depth=0.56, verts=6, m=WOOD)
        cube((side * 0.568, -0.05, 1.08), scale=(0.065, 0.11, 0.24), m=DARKSTEEL)
        for d in (-1, 1):                                    # double-bit head
            cone((side * 0.568, -0.05 + d * 0.13, 1.10), r1=0.20, r2=0.02, depth=0.06,
                 verts=3, m=STEEL, rot=(PI / 2, 0, 0))

    root = assemble("OrcBerserker", 1.88)
    hold(['axe_r', 'axe_l'], [1, LAST])
    anim_double_swipe(reach=0.30)
    export(root, "orcberserker_attack.glb")
    return 11


def build_specter():
    """Specter — the pale drifting one, all claws."""
    reset()
    GHOST = mat("SpGhost", "b8d9f0", rough=0.85, emit=0.16, alpha=0.86)
    GHOST_D = mat("SpGhostD", "89b4d6", rough=0.9, emit=0.10, alpha=0.72)
    CORE = mat("SpCore", "1b2b3a", rough=0.5)
    EYE = mat("SpEye", "eaf7ff", rough=0.2, emit=2.4)
    specter_base(GHOST, GHOST_D, CORE, EYE, tail_tips=6)
    group('torso')
    for s in (-1, 1):                                        # trailing shroud
        cone((s * 0.34, 0.22, 1.06), r1=0.13, r2=0.03, depth=0.52, verts=5, m=GHOST_D,
             rot=(0.55, s * 0.30, 0))
    root = assemble("Specter", 1.86)
    anim_ghost_lunge(rise=0.10, reach=0.32)
    export(root, "ghostspecter_attack.glb")
    return 12


def build_wisp_specter():
    """Wisp Specter — a specter grown around a burning core, orbited by embers."""
    reset()
    GHOST = mat("WsGhost", "9fc9e8", rough=0.85, emit=0.22, alpha=0.80)
    GHOST_D = mat("WsGhostD", "6f9fc4", rough=0.9, emit=0.14, alpha=0.66)
    CORE = mat("WsCore", "12304a", rough=0.5)
    EYE = mat("WsEye", "9ff0ff", rough=0.2, emit=2.6)
    EMBER = mat("WsEmber", "5fe4ff", rough=0.3, emit=1.4)
    specter_base(GHOST, GHOST_D, CORE, EYE, tail_tips=7)
    group('torso')
    ico((0, -0.10, 1.08), r=0.14, sub=2, m=EMBER)                    # the core itself
    group('orbit', pivot=(0, -0.02, 1.10), parent='torso')
    for i in range(5):
        a = 2 * PI * i / 5
        ico((0.40 * math.cos(a), -0.02 + 0.30 * math.sin(a), 1.10 + 0.16 * math.cos(a * 1.7)),
            r=0.055 - (i % 2) * 0.014, sub=1, m=EMBER)
    root = assemble("WispSpecter", 1.80)

    hold(['orbit'], [1])
    key('orbit', 7, rot=(0, 0, 1.4), scale=1.22)
    key('orbit', 12, rot=(0, 0, 3.2), scale=0.72)
    key('orbit', 17, rot=(0, 0, 4.6), scale=1.06)
    key('orbit', LAST, rot=(0, 0, 2 * PI))
    anim_ghost_lunge(rise=0.14, reach=0.26)
    export(root, "wispspecter_attack.glb")
    return 12


def build_hollow_specter():
    """Hollow Specter — the one with nothing inside; it opens its chest to scream."""
    reset()
    GHOST = mat("HsGhost", "7fb8d9", rough=0.85, emit=0.14, alpha=0.82)
    GHOST_D = mat("HsGhostD", "5a8fb0", rough=0.9, emit=0.08, alpha=0.68)
    CORE = mat("HsCore", "0a1620", rough=0.45)
    EYE = mat("HsEye", "cfefff", rough=0.2, emit=2.2)
    specter_base(GHOST, GHOST_D, CORE, EYE, tail_tips=5)
    group('torso')
    ico((0, -0.14, 1.06), r=0.19, sub=2, scale=(1.0, 0.55, 1.15), m=CORE)   # the hollow
    for s in (-1, 1):                                                       # split ribs
        for k, z in enumerate((0.98, 1.10, 1.22)):
            cube((s * (0.22 + k * 0.012), -0.12, z), scale=(0.07, 0.30, 0.045), m=GHOST)
    group('head')
    ico((0, -0.20, 1.40), r=0.11, sub=2, scale=(0.9, 0.7, 1.5), m=CORE)     # gaping jaw

    root = assemble("HollowSpecter", 1.84)
    anim_ghost_lunge(rise=0.16, reach=0.22)
    # ...then the scream on top of the lunge: the head snaps wide at contact.
    key('head', 12, rot=(0.30, 0, 0), scale=(1.0, 1.0, 1.35))
    key('head', 17, rot=(0.10, 0, 0), scale=(1.0, 1.0, 1.10))
    export(root, "hollowspecter_attack.glb")
    return 12


def build_wraith_elite():
    """Wraith Elite — a level 1 wraith promoted: pauldrons and a scythe."""
    reset()
    ROBE = mat("WeRobe", "5a3f8a", rough=0.85)
    ROBED = mat("WeRobeD", "3d2a60", rough=0.9)
    VOID = mat("WeVoid", "150f24", rough=0.55)
    EYE = mat("WeEye", "ffd166", rough=0.25, emit=1.6)
    PLATE = mat("WePlate", "7a6ba8", rough=0.45, metal=0.4)
    wraith_base(ROBE, ROBED, VOID, EYE, tatters=9)

    group('torso')
    for s in (-1, 1):
        ico((s * 0.34, 0, 1.20), r=0.19, sub=1, scale=(1.0, 1.0, 0.55), m=PLATE)
        cone((s * 0.30, 0.02, 1.42), r1=0.055, r2=0.01, depth=0.26, verts=4, m=PLATE,
             rot=(0, s * 0.35, 0))
    cyl((0, 0, 1.28), r=0.24, depth=0.06, verts=9, m=PLATE)

    group('scythe', pivot=(-0.45, -0.14, 0.60), parent='arm_r')
    cyl((-0.45, -0.14, 0.92), r=0.030, depth=1.30, verts=6, m=ROBED, rot=(0.10, 0, 0))
    cone((-0.45, -0.20, 1.56), r1=0.34, r2=0.03, depth=0.055, verts=3, m=STEEL,
         rot=(PI / 2, 0, 0.55))
    ico((-0.45, -0.16, 1.52), r=0.055, sub=1, m=EYE)

    root = assemble("WraithElite", 1.94)
    hold(['scythe'], [1, LAST])
    anim_overhead_chop(base='robe', reach=0.24, lean=0.28)
    export(root, "wraithelite_attack.glb")
    return 12


def build_wraith_sovereign():
    """Wraith Sovereign — crowned, with a ring of shards it hurls on the beat."""
    reset()
    ROBE = mat("WsvRobe", "4a3570", rough=0.85)
    ROBED = mat("WsvRobeD", "2e2049", rough=0.9)
    VOID = mat("WsvVoid", "0d0918", rough=0.5)
    EYE = mat("WsvEye", "b98cff", rough=0.25, emit=1.8)
    GOLD = mat("WsvGold", "d9b24c", rough=0.35, metal=0.8)
    SHARD = mat("WsvShard", "9a6fe8", rough=0.3, emit=1.0, alpha=0.9)
    wraith_base(ROBE, ROBED, VOID, EYE, tatters=11)

    group('robe')
    cone((0, 0.30, 0.72), r1=0.34, r2=0.10, depth=1.10, verts=6, m=ROBED, rot=(0.35, 0, 0))
    group('torso')
    cyl((0, 0, 1.26), r=0.30, depth=0.055, verts=11, m=GOLD)
    for s in (-1, 1):
        ico((s * 0.36, 0, 1.20), r=0.17, sub=1, scale=(1.0, 1.0, 0.6), m=GOLD)
    group('head')
    for i in range(7):                                        # crown
        a = 2 * PI * i / 7
        cone((0.20 * math.cos(a), 0.03 + 0.20 * math.sin(a), 1.66), r1=0.040, r2=0.0,
             depth=0.22, verts=4, m=GOLD)
    ico((0, -0.16, 1.66), r=0.050, sub=2, m=EYE)

    group('shards', pivot=(0, 0, 1.20))
    for i in range(6):
        a = 2 * PI * i / 6 + 0.3
        cone((0.62 * math.cos(a), 0.62 * math.sin(a), 1.20 + 0.20 * math.sin(a * 2)),
             r1=0.055, r2=0.0, depth=0.30, verts=4, m=SHARD,
             rot=(math.sin(a) * 0.8, math.cos(a) * 0.8, 0))

    root = assemble("WraithSovereign", 1.98)
    # The shards wind up with the sleeves, collapse inward on the release, then
    # drift back out to the ring they started from.
    key('shards', 1)
    key('shards', 8, rot=(0, 0, -0.9), scale=1.24)
    key('shards', 13, rot=(0, 0, 0.7), scale=0.55)
    key('shards', 18, rot=(0, 0, 1.6), scale=1.08)
    key('shards', LAST, rot=(0, 0, 2 * PI))
    anim_wraith_cast(sweep=1.25)
    export(root, "wraithsovereign_attack.glb")
    return 13


def build_elder_dragon():
    """Elder Dragon — level 2's boss: rears back, beats its wings, and bites."""
    reset()
    SCALES = mat("EdScale", "c21f3a", rough=0.55)
    BELLY = mat("EdBelly", "e8a08c", rough=0.6)
    DARKR = mat("EdDark", "7a1226", rough=0.6)
    MEMB = mat("EdWing", "8f1e33", rough=0.7)
    HORN = mat("EdHorn", "f0e4c8", rough=0.45)
    EYE = mat("EdEye", "ffcf3a", rough=0.2, emit=1.3)

    group('legs')
    for s in (-1, 1):
        ico((s * 0.34, 0.10, 0.58), r=0.23, sub=2, scale=(0.95, 1.15, 1.15), m=SCALES)
        cyl((s * 0.31, -0.02, 0.28), r=0.125, depth=0.46, verts=8, m=SCALES)
        cube((s * 0.31, -0.14, 0.07), scale=(0.28, 0.40, 0.14), m=SCALES)
        for k in (-1, 0, 1):
            cone((s * 0.31 + k * 0.080, -0.33, 0.055), r1=0.032, depth=0.14, verts=4,
                 m=HORN, rot=(-PI / 2, 0, 0))

    group('body', pivot=(0, 0.10, 0.90))
    ico((0, 0.04, 0.98), r=0.44, sub=2, scale=(1.02, 1.20, 1.12), m=SCALES)
    ico((0, -0.24, 0.92), r=0.32, sub=2, scale=(0.86, 0.60, 1.15), m=BELLY)
    ico((0, -0.06, 1.28), r=0.31, sub=2, scale=(1.02, 1.02, 0.95), m=SCALES)
    for s in (-1, 1):                                          # forelimbs
        cyl((s * 0.32, -0.22, 1.08), r=0.066, depth=0.30, verts=6, m=SCALES, rot=(0.5, s * 0.35, 0))
        ico((s * 0.38, -0.33, 0.92), r=0.080, sub=1, m=SCALES)
        for k in (-1, 0, 1):
            cone((s * 0.38 + k * 0.055, -0.40, 0.89), r1=0.022, depth=0.11, verts=4,
                 m=HORN, rot=(-1.9, 0, 0))
    for yy, zz, r in ((-0.08, 1.40, 0.055), (0.06, 1.28, 0.066), (0.22, 1.14, 0.074),
                      (0.36, 0.98, 0.066), (0.48, 0.82, 0.055)):
        cone((0, yy, zz + 0.16), r1=r, depth=0.22, verts=4, m=HORN, rot=(0.45, 0, 0))

    group('neck', pivot=(0, -0.06, 1.34), parent='body')
    ico((0, -0.14, 1.48), r=0.21, sub=2, m=SCALES)
    ico((0, -0.23, 1.64), r=0.19, sub=2, m=SCALES)

    group('head', pivot=(0, -0.26, 1.72), parent='neck')
    ico((0, -0.32, 1.80), r=0.26, sub=2, scale=(1.0, 1.10, 0.95), m=SCALES)
    ico((0, -0.58, 1.73), r=0.17, sub=2, scale=(0.95, 1.15, 0.72), m=SCALES)
    for s in (-1, 1):
        ico((s * 0.058, -0.74, 1.75), r=0.028, sub=1, m=DARKR)
        ico((s * 0.150, -0.46, 1.87), r=0.078, sub=2, scale=(1.0, 0.85, 1.0), m=WHITE)
        ico((s * 0.160, -0.52, 1.87), r=0.050, sub=2, m=EYE)
        ico((s * 0.166, -0.556, 1.87), r=0.023, sub=2, scale=(0.5, 1.0, 1.4), m=PUPIL)
        cone((s * 0.160, -0.16, 1.99), r1=0.070, depth=0.42, verts=5, m=HORN,
             rot=(-0.85, 0, s * 0.25))
        cone((s * 0.115, -0.30, 2.02), r1=0.045, depth=0.26, verts=4, m=HORN,
             rot=(-1.15, 0, s * 0.15))
        cone((s * 0.25, -0.32, 1.79), r1=0.078, depth=0.23, verts=4, m=MEMB, rot=(0, s * 1.35, 0))

    group('jaw', pivot=(0, -0.40, 1.68), parent='head')
    ico((0, -0.58, 1.655), r=0.15, sub=2, scale=(0.90, 1.10, 0.38), m=DARKR)
    for s in (-1, 1):
        for k in range(3):
            cone((s * (0.06 + k * 0.035), -0.52 - k * 0.06, 1.70), r1=0.022, depth=0.085,
                 verts=4, m=WHITE, rot=(PI, 0, 0))

    for side, gname in ((-1, 'wing_r'), (1, 'wing_l')):
        group(gname, pivot=(side * 0.20, 0.24, 1.42), parent='body')
        cone((side * 0.66, 0.32, 1.52), r1=0.66, depth=0.045, verts=3, m=MEMB,
             rot=(1.15, side * 0.55, side * 0.35))
        cone((side * 0.47, 0.26, 1.34), r1=0.43, depth=0.04, verts=3, m=MEMB,
             rot=(1.25, side * 0.45, side * 0.9))
        cyl((side * 0.55, 0.28, 1.46), r=0.030, depth=0.86, verts=5, m=SCALES,
            rot=(0.35, side * 1.05, 0))
        cone((side * 0.98, 0.38, 1.86), r1=0.038, depth=0.15, verts=4, m=HORN,
             rot=(0.3, side * 1.1, 0))

    group('tail', pivot=(0, 0.36, 0.84), parent='body')
    for i, (yy, zz, r) in enumerate(((0.44, 0.82, 0.20), (0.64, 0.78, 0.16), (0.83, 0.82, 0.125),
                                     (0.99, 0.92, 0.093), (1.10, 1.04, 0.062))):
        ico((0, yy, zz), r=r, sub=2 if i < 3 else 1, m=SCALES)
    cone((0, 1.18, 1.16), r1=0.058, depth=0.21, verts=4, m=HORN, rot=(-0.7, 0, 0))

    root = assemble("ElderDragon", 2.0)

    parts = ['motion', 'legs', 'body', 'neck', 'head', 'jaw', 'wing_r', 'wing_l', 'tail']
    hold(parts, [1])
    # rear back, wings up
    key('motion', 7, move=(0, 0.16, 0.10))
    key('body', 7, rot=(-0.26, 0, 0))
    key('neck', 7, rot=(-0.55, 0, 0))
    key('head', 7, rot=(-0.30, 0, 0))
    key('jaw', 7, rot=(0.55, 0, 0))
    key('wing_r', 7, rot=(0, 0.95, 0))
    key('wing_l', 7, rot=(0, -0.95, 0))
    key('tail', 7, rot=(-0.20, 0, 0))
    key('legs', 7, move=(0, 0.03, 0))
    # the bite
    key('motion', 12, move=(0, -0.36, -0.04))
    key('body', 12, rot=(0.30, 0, 0))
    key('neck', 12, rot=(0.72, 0, 0))
    key('head', 12, rot=(0.34, 0, 0))
    key('jaw', 12, rot=(0.70, 0, 0))
    key('wing_r', 12, rot=(0, -0.45, 0))
    key('wing_l', 12, rot=(0, 0.45, 0))
    key('tail', 12, rot=(0.26, 0, 0))
    key('legs', 12, move=(0, -0.12, 0))
    # snap shut, settle
    key('motion', 15, move=(0, -0.30, 0))
    key('jaw', 15, rot=(-0.06, 0, 0))
    key('neck', 15, rot=(0.50, 0, 0))
    key('head', 15, rot=(0.20, 0, 0))
    key('body', 15, rot=(0.20, 0, 0))
    key('wing_r', 15, rot=(0, -0.10, 0))
    key('wing_l', 15, rot=(0, 0.10, 0))
    key('tail', 15, rot=(0.12, 0, 0))
    key('legs', 15, move=(0, -0.08, 0))
    hold(parts, [LAST])
    export(root, "elderdragon_attack.glb")
    return 12


def build_bone_tyrant():
    """Bone Tyrant — level 2's boss: the crowned dead that the crypt answers to.

    This floor's boss used to be the Elder Dragon, which is the same eight-part
    rig as level 1's Dragon (jaw / head / neck / tail / two wings / body /
    legs) in a darker red. Side by side they read as one monster shown twice,
    and a dragon was never what this level was building toward anyway — its
    cast is goblins, orcs, specters and wraiths in a crypt. So the boss is
    built out of what the floor is made of: a skeleton the height of the room,
    crowned, leaning on a bone scythe, with the skulls of the ones that came
    before it circling at its shoulder.

    build_elder_dragon stays below and still exports its own GLB; nothing
    points at it any more.
    """
    reset()
    BONEL = mat("BtBone", "ded3b4", rough=0.6)
    BONED = mat("BtBoneD", "9a8d6d", rough=0.72)
    SHROUD = mat("BtShroud", "2e2440", rough=0.9)
    SHROUDD = mat("BtShroudD", "1a1428", rough=0.95)
    CROWN = mat("BtCrown", "d9b24c", rough=0.35, metal=0.8)
    EYE = mat("BtEye", "7ad7a0", rough=0.2, emit=1.9)       # grave-light, not dragon-gold
    BLADE = mat("BtBlade", "d8e0d6", rough=0.28, metal=0.55)

    # Bare legs: the shroud starts at the hips, so what walks is bone. Kept
    # short and thick on purpose — the first pass gave it a stork's legs at
    # nearly half its own height, which read as spindly rather than as the
    # heaviest thing on the floor.
    group('legs')
    for s in (-1, 1):
        cube((s * 0.19, -0.09, 0.04), scale=(0.20, 0.38, 0.08), m=BONED)
        cyl((s * 0.19, 0.0, 0.25), r=0.065, depth=0.36, verts=7, m=BONEL)
        ico((s * 0.19, 0.0, 0.44), r=0.082, sub=1, m=BONED)
        cyl((s * 0.19, 0.01, 0.62), r=0.074, depth=0.36, verts=7, m=BONEL)
    cube((0, 0, 0.87), scale=(0.50, 0.27, 0.20), m=BONED)

    # Rib cage left open at the front — the silhouette that says "skeleton"
    # from across a dark room. The shroud sits behind it (+Y) so it reads as a
    # cape rather than a coat.
    group('torso', pivot=(0, 0, 0.95))
    cyl((0, 0.04, 1.18), r=0.055, depth=0.56, verts=6, m=BONED)
    for zz, rr in ((0.99, 0.27), (1.13, 0.30), (1.27, 0.29), (1.39, 0.25)):
        torus((0, 0.0, zz), major=rr, minor=0.029, m=BONEL)
    cube((0, 0.0, 1.50), scale=(0.64, 0.16, 0.08), m=BONEL)
    cone((0, 0.21, 1.04), r1=0.48, r2=0.28, depth=1.00, verts=9, m=SHROUD, rot=(0.16, 0, 0))
    cone((0, 0.27, 1.28), r1=0.41, r2=0.21, depth=0.64, verts=7, m=SHROUDD, rot=(0.30, 0, 0))
    for s in (-1, 1):                                        # pauldrons
        ico((s * 0.35, 0.06, 1.53), r=0.17, sub=1, scale=(1.0, 0.9, 0.55), m=SHROUDD)

    group('head', pivot=(0, 0, 1.55), parent='torso')
    ico((0, -0.04, 1.70), r=0.205, sub=2, scale=(1.0, 1.10, 1.06), m=BONEL)
    for s in (-1, 1):
        ico((s * 0.088, -0.19, 1.72), r=0.060, sub=2, m=PUPIL)
        ico((s * 0.091, -0.215, 1.72), r=0.038, sub=2, m=EYE)
    cone((0, -0.225, 1.64), r1=0.042, depth=0.07, verts=4, m=PUPIL, rot=(-PI / 2, 0, 0))
    torus((0, -0.02, 1.83), major=0.205, minor=0.023, m=CROWN)
    for i in range(7):
        a = 2 * PI * i / 7
        cone((0.195 * math.cos(a), -0.02 + 0.195 * math.sin(a), 1.93),
             r1=0.036, r2=0.0, depth=0.20, verts=4, m=CROWN)

    group('jaw', pivot=(0, -0.07, 1.63), parent='head')
    cube((0, -0.14, 1.595), scale=(0.21, 0.22, 0.058), m=BONED)
    for s in (-1, 1):
        for k in range(3):
            cone((s * (0.047 + k * 0.035), -0.21, 1.613), r1=0.016, depth=0.05,
                 verts=4, m=BONEL, rot=(PI, 0, 0))

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.32, 0.02, 1.49), parent='torso')
        ico((side * 0.32, 0.03, 1.49), r=0.085, sub=1, m=BONED)
        cyl((side * 0.345, 0.02, 1.30), r=0.047, depth=0.34, verts=6, m=BONEL)
        ico((side * 0.355, 0.015, 1.12), r=0.056, sub=1, m=BONED)
        cyl((side * 0.365, 0.0, 0.95), r=0.042, depth=0.32, verts=6, m=BONEL)
        ico((side * 0.370, -0.02, 0.79), r=0.056, sub=1, m=BONEL)

    # The scythe, held in the right hand. Thin three-vertex cones are flat
    # triangles (the same trick the dragon's wings use), turned so the blade
    # lies in the plane the arm swings through.
    group('arm_r')
    cyl((-0.370, -0.03, 1.22), r=0.029, depth=1.54, verts=6, m=BONED, rot=(0.10, 0, 0))
    cone((-0.370, -0.33, 1.88), r1=0.36, depth=0.045, verts=3, m=BLADE, rot=(0, PI / 2, 0))
    cone((-0.370, -0.14, 1.99), r1=0.18, depth=0.04, verts=3, m=BLADE, rot=(0, PI / 2, 0.9))
    torus((-0.370, -0.03, 1.96), major=0.058, minor=0.019, m=CROWN, rot=(0, PI / 2, 0))

    # Five skulls on a slow orbit — the boss's own dead, and the one part of
    # it that keeps moving while it winds up.
    group('wards', pivot=(0, 0, 1.26))
    for i in range(5):
        a = 2 * PI * i / 5 + 0.4
        x, y = 0.74 * math.cos(a), 0.74 * math.sin(a)
        z = 1.26 + 0.16 * math.sin(a * 2)
        ico((x, y, z), r=0.090, sub=1, scale=(1.0, 1.12, 1.0), m=BONEL)
        ico((x - 0.033, y - 0.068, z + 0.012), r=0.028, sub=1, m=EYE)
        ico((x + 0.033, y - 0.068, z + 0.012), r=0.028, sub=1, m=EYE)

    root = assemble("BoneTyrant", 2.0)

    # The skulls wind up with the swing, snap inward on the strike, then drift
    # back out — one full turn over the loop so the ring never jumps.
    key('wards', 1)
    key('wards', 7, rot=(0, 0, -0.85), scale=1.20)
    key('wards', 12, rot=(0, 0, 0.55), scale=0.62)
    key('wards', 17, rot=(0, 0, 1.45), scale=1.06)
    key('wards', LAST, rot=(0, 0, 2 * PI))
    # The jaw drops on the wind-up and clacks shut on the hit.
    hold(['jaw'], [1])
    key('jaw', 7, rot=(0.52, 0, 0))
    key('jaw', 12, rot=(0.10, 0, 0))
    hold(['jaw'], [LAST])
    anim_overhead_chop(reach=0.30, lean=0.38)
    export(root, "bonetyrant_attack.glb")
    return 12


BUILDERS = [build_goblin_warrior, build_goblin_marauder, build_orc, build_orc_berserker,
            build_specter, build_wisp_specter, build_hollow_specter, build_wraith_elite,
            build_wraith_sovereign, build_bone_tyrant]


# --------------------------------------------------------------------------
# previews
# --------------------------------------------------------------------------
def setup_preview():
    """A fixed three-quarter camera and three lights, kept across every build."""
    scene = bpy.context.scene
    bpy.ops.object.camera_add(location=(2.6, -3.5, 1.9), rotation=(1.20, 0, 0.64))
    cam = bpy.context.view_layer.objects.active
    cam.name = "PreviewCam"
    # 40mm rather than a portrait lens: at 55 the taller models (the dragon,
    # the banshees) ran off the top of the frame and the preview stopped
    # being usable for judging silhouette.
    cam.data.lens = 40
    scene.camera = cam
    for name, loc, energy in (("PreviewKey", (3, -4, 5), 900),
                              ("PreviewFill", (-4, -3, 2.5), 300),
                              ("PreviewRim", (0, 4.5, 3.5), 500)):
        bpy.ops.object.light_add(type='POINT', location=loc)
        light = bpy.context.view_layer.objects.active
        light.name = name
        light.data.energy = energy
    scene.render.resolution_x = scene.render.resolution_y = 520
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    try:
        scene.eevee.taa_render_samples = 24
    except Exception:
        pass


def render_preview(filename, frame):
    bpy.context.scene.frame_set(frame)
    bpy.context.scene.render.filepath = os.path.join(OUT_PREVIEW, filename)
    bpy.ops.render.render(write_still=True)


# --------------------------------------------------------------------------
def _clear_scene():
    """Empty the file without wm.read_homefile().

    read_homefile leaves the window context stale for the rest of the same
    script run, and the next bpy.ops.object.join() then fails its poll — which
    only bites when the script is run in one go, exactly how it is meant to be
    run. Deleting the datablocks by hand avoids the whole problem.
    """
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials,
                 bpy.data.cameras, bpy.data.lights, bpy.data.actions):
        for item in list(coll):
            coll.remove(item, do_unlink=True)


def main(preview=False):
    if not os.path.isdir(OUT_MODELS):
        sys.exit("expected %s to exist — run this from a checkout of the repo" % OUT_MODELS)
    _clear_scene()
    scene = bpy.context.scene
    scene.name = "Attack"            # export_animation_mode='SCENE' names the clip after it
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, LAST
    _common()
    if preview:
        os.makedirs(OUT_PREVIEW, exist_ok=True)
        setup_preview()
    for build in BUILDERS:
        strike = build()
        if preview:
            name = BUILD_NAMES[build.__name__]
            render_preview(name, 1)
            render_preview(name + "_strike", strike)
    print("done: %d rigged models in %s" % (len(BUILDERS), OUT_MODELS))


BUILD_NAMES = {
    "build_goblin_warrior": "goblinwarrior",
    "build_goblin_marauder": "goblinmarauder",
    "build_orc": "orc",
    "build_orc_berserker": "orcberserker",
    "build_specter": "ghostspecter",
    "build_wisp_specter": "wispspecter",
    "build_hollow_specter": "hollowspecter",
    "build_wraith_elite": "wraithelite",
    "build_wraith_sovereign": "wraithsovereign",
    "build_bone_tyrant": "bonetyrant",
    "build_elder_dragon": "elderdragon",
}


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    main(preview="--preview" in argv)
