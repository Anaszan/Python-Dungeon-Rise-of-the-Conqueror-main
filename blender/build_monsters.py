"""Build level 1's nine monsters as low-poly GLB models.

The other levels' monster .glb files are flat planes baked from 2D art. These
are solid low-poly meshes, built from primitives so the whole cast can be
regenerated (and restyled) from one script instead of hand-edited in a .blend.

Every model follows the footprint Monster.tsx assumes: X-centred, base at
local y=0, top at or below local y=2 (glTF is Y-up; Blender is Z-up, so the
script works in Z and the exporter converts). A model shorter than 2 units is
*meant* to be shorter — Monster.tsx normalises against a fixed raw height of 2,
so the slimes end up squat and the dragon fills its slot.

Models face -Y in Blender, which the exporter turns into +Z — the direction the
dungeon's characters face.

Run it from the repo root:

    blender --background --python blender/build_monsters.py

Writes public/monsters/<name>_attack.glb. Only needed when these models change;
the generated .glb files are committed.
"""
import math
import os
import sys

import bpy

PI = math.pi
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_MODELS = os.path.join(REPO, "public", "monsters")

# --------------------------------------------------------------------------
# primitives
# --------------------------------------------------------------------------
PARTS = []


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
    PARTS.append(o)
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
    PARTS.clear()
    for o in list(bpy.data.objects):
        if o.type == 'MESH':
            d = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.meshes.remove(d)


def assemble(name, target_height):
    """Join the parts, drop the result to z=0, centre it on X/Y, scale to height."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in PARTS:
        o.select_set(True)
    bpy.context.view_layer.objects.active = PARTS[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = name
    co = [v.co for v in o.data.vertices]
    minz, maxz = min(c.z for c in co), max(c.z for c in co)
    cx = (min(c.x for c in co) + max(c.x for c in co)) / 2
    cy = (min(c.y for c in co) + max(c.y for c in co)) / 2
    s = target_height / (maxz - minz)
    for v in o.data.vertices:
        v.co.x = (v.co.x - cx) * s
        v.co.y = (v.co.y - cy) * s
        v.co.z = (v.co.z - minz) * s
    o.location = (0, 0, 0)
    PARTS.clear()
    return o


def export(o, filename):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    path = os.path.join(OUT_MODELS, filename)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_animations=False)
    print("wrote %s (%d tris)" % (filename, len(o.data.polygons)))


# --------------------------------------------------------------------------
# shared parts
# --------------------------------------------------------------------------
WHITE = None
PUPIL = None
STEEL = None


def _common():
    global WHITE, PUPIL, STEEL
    WHITE = mat("EyeWhite", "FFFFFF", rough=0.4)
    PUPIL = mat("Pupil", "16202a", rough=0.35)
    STEEL = mat("Steel", "b8bec9", rough=0.3, metal=0.7)


def slime_base(BODY, DARK, drips):
    """The shared blob: a dome, a puddle, a drop off the top, and dribbles."""
    ico((0, 0, 0.59), r=0.5, sub=2, scale=(1.16, 1.08, 1.06), m=BODY)
    ico((0, 0, 0.13), r=0.5, sub=2, scale=(1.53, 1.41, 0.26), m=BODY)
    cone((0.05, 0.02, 1.12), r1=0.09, depth=0.22, verts=6, m=BODY)
    for dx, dy, r in drips:
        ico((dx, dy, 0.07), r=r, sub=1, scale=(1.5, 1.5, 0.55), m=DARK)


def goblin_base(SKIN, DARK, CLOTH, CLOTH2, W=1.0, potbelly=1.0):
    """Stubby goblin: bandy legs, pot belly, big ears, hooked nose, underbite."""
    for s in (-1, 1):
        cyl((s * 0.17 * W, 0, 0.32), r=0.105 * W, depth=0.50, verts=8, m=SKIN)
        cube((s * 0.17 * W, -0.06, 0.055), scale=(0.22 * W, 0.30, 0.11), m=CLOTH2)
    ico((0, 0, 0.76), r=0.32, sub=2, scale=(1.14 * W * potbelly, 0.98 * potbelly, 1.02), m=SKIN)
    ico((0, 0, 0.99), r=0.30, sub=2, scale=(1.22 * W, 0.94, 0.78), m=SKIN)
    cone((0, 0, 0.54), r1=0.31 * W, r2=0.25 * W, depth=0.28, verts=9, m=CLOTH)
    cyl((0, 0, 0.66), r=0.31 * W * potbelly, depth=0.08, verts=10, m=CLOTH2)
    for s in (-1, 1):
        cyl((s * 0.38 * W, 0, 0.78), r=0.082 * W, depth=0.40, verts=7, m=SKIN)
        ico((s * 0.38 * W, -0.02, 0.55), r=0.10 * W, sub=1, m=SKIN)
    ico((0, 0, 1.23), r=0.29, sub=2, scale=(1.02, 0.96, 1.0), m=SKIN)
    for s in (-1, 1):
        cone((s * 0.38, 0.03, 1.31), r1=0.105, depth=0.36, verts=6, m=SKIN, rot=(0, s * 1.20, 0))
    cone((0, -0.26, 1.19), r1=0.075, depth=0.22, verts=6, m=SKIN, rot=(PI / 2, 0, 0))
    for s in (-1, 1):
        ico((s * 0.125, -0.235, 1.30), r=0.058, sub=2, m=WHITE)
        ico((s * 0.135, -0.275, 1.30), r=0.030, sub=2, m=PUPIL)
        cone((s * 0.075, -0.215, 1.075), r1=0.028, depth=0.075, verts=4, m=WHITE, rot=(PI, 0, 0))
    cube((0, -0.235, 1.385), scale=(0.36, 0.08, 0.06), m=DARK)


def wraith_base(ROBE, ROBE_D, VOID, EYE, tatters=8):
    """Hovering cowl: a tapered robe torn into spikes at the hem, no legs."""
    cone((0, 0, 0.62), r1=0.46, r2=0.30, depth=1.12, verts=10, m=ROBE)
    for i in range(tatters):
        a = 2 * PI * i / tatters + 0.2
        cone((0.42 * math.cos(a), 0.42 * math.sin(a), 0.11), r1=0.095, depth=0.36,
             verts=4, m=ROBE_D, rot=(PI, 0, 0))
    ico((0, 0, 1.16), r=0.30, sub=2, scale=(1.18, 1.06, 0.55), m=ROBE)
    cone((0, 0.03, 1.44), r1=0.30, r2=0.055, depth=0.46, verts=8, m=ROBE)
    ico((0, -0.13, 1.35), r=0.19, sub=2, scale=(0.95, 0.85, 1.05), m=VOID)
    for s in (-1, 1):
        ico((s * 0.078, -0.255, 1.37), r=0.045, sub=2, m=EYE)
        cone((s * 0.36, -0.05, 0.88), r1=0.135, r2=0.07, depth=0.54, verts=6, m=ROBE,
             rot=(0.10, s * 0.24, 0))
        ico((s * 0.45, -0.14, 0.60), r=0.078, sub=1, m=VOID)
        for k in range(3):
            cone((s * 0.45 + (k - 1) * 0.045, -0.17, 0.50), r1=0.019, depth=0.15,
                 verts=4, m=VOID, rot=(PI + 0.18, 0, 0))


# --------------------------------------------------------------------------
# the cast
# --------------------------------------------------------------------------
def build_slime():
    reset()
    BODY = mat("SlimeBody", "6fdc4f", rough=0.35)
    DARK = mat("SlimeDark", "4aa832", rough=0.45)
    MOUTH = mat("Mouth", "7a2b33", rough=0.6)
    slime_base(BODY, DARK, [(-0.70, 0.12, 0.11), (0.74, -0.06, 0.09),
                            (0.24, 0.62, 0.10), (-0.30, -0.60, 0.08)])
    for s in (-1, 1):
        ico((s * 0.22, -0.45, 0.74), r=0.15, sub=2, scale=(1.0, 0.8, 1.1), m=WHITE)
        ico((s * 0.24, -0.55, 0.73), r=0.08, sub=2, m=PUPIL)
    ico((0, -0.50, 0.50), r=0.12, sub=2, scale=(1.6, 0.55, 0.8), m=MOUTH)
    export(assemble("Slime", 1.25), "slime_attack.glb")


def build_glitch_slime():
    reset()
    BODY = mat("GlitchBody", "a233f2", rough=0.3)
    DARK = mat("GlitchDark", "5d1a99", rough=0.4)
    CYAN = mat("GlitchCyan", "18c4b4", rough=0.4, emit=0.25)
    PINK = mat("GlitchPink", "d92fae", rough=0.4, emit=0.22)
    slime_base(BODY, DARK, [(-0.70, 0.10, 0.11), (0.74, -0.06, 0.09)])
    # Torn scanlines. Discs, not boxes: a square slab's corners stick a full
    # 1.41x past the round body and read as a dinner plate, not a glitch.
    cyl((0.075, 0.04, 0.86), r=0.435, depth=0.05, verts=10, m=CYAN)
    cyl((-0.085, -0.03, 0.44), r=0.575, depth=0.042, verts=10, m=PINK)
    ico((-0.22, -0.46, 0.74), r=0.15, sub=2, scale=(1.0, 0.8, 1.1), m=WHITE)
    ico((-0.24, -0.56, 0.73), r=0.08, sub=2, m=PUPIL)
    cube((0.24, -0.46, 0.74), scale=(0.26, 0.14, 0.26), m=CYAN)     # the other eye, corrupted
    cube((0.26, -0.54, 0.74), scale=(0.12, 0.08, 0.12), m=PUPIL)
    for loc, sc, mm, rot in (((0.78, -0.16, 1.02), 0.14, CYAN, (0.4, 0.3, 0.2)),
                             ((-0.84, -0.04, 0.62), 0.11, PINK, (0.2, 0.6, 0.1)),
                             ((0.54, -0.36, 0.14), 0.09, CYAN, (0.9, 0.2, 0.5)),
                             ((-0.32, -0.24, 1.22), 0.08, PINK, (0.3, 0.8, 0.4))):
        cube(loc, scale=(sc, sc, sc), m=mm, rot=rot)
    export(assemble("GlitchSlime", 1.32), "glitchslime_attack.glb")


def build_goblin():
    reset()
    SKIN = mat("GoblinSkin", "8fc23f", rough=0.65)
    DARK = mat("GoblinDark", "5e8a24", rough=0.7)
    CLOTH = mat("GoblinCloth", "8a5a32", rough=0.85)
    CLOTH2 = mat("GoblinCloth2", "4a3120", rough=0.9)
    goblin_base(SKIN, DARK, CLOTH, CLOTH2)
    cyl((-0.44, -0.06, 0.46), r=0.030, depth=0.17, verts=6, m=CLOTH2)
    cube((-0.44, -0.06, 0.555), scale=(0.13, 0.05, 0.035), m=STEEL)
    cone((-0.44, -0.06, 0.72), r1=0.055, r2=0.008, depth=0.30, verts=4, m=STEEL)
    export(assemble("Goblin", 1.58), "goblin_attack.glb")


def build_goblin_scout():
    reset()
    SKIN = mat("ScoutSkin", "a8d95e", rough=0.65)
    DARK = mat("ScoutDark", "6f9c33", rough=0.7)
    CLOTH = mat("ScoutCloth", "4f6b33", rough=0.85)
    CLOTH2 = mat("ScoutCloth2", "33452a", rough=0.9)
    WOOD = mat("ScoutWood", "6b4a2a", rough=0.9)
    STRING = mat("Bowstring", "d8cfae", rough=0.9)
    goblin_base(SKIN, DARK, CLOTH, CLOTH2, W=0.88, potbelly=0.90)
    cone((0, 0.02, 1.40), r1=0.34, r2=0.05, depth=0.34, verts=8, m=CLOTH)          # hood
    cone((0, 0.30, 1.30), r1=0.13, depth=0.34, verts=6, m=CLOTH, rot=(-0.9, 0, 0))  # hood tail
    cyl((0.05, 0.20, 0.95), r=0.10, depth=0.44, verts=8, m=CLOTH2, rot=(0.25, 0.2, 0))
    for dx in (-0.03, 0.02, 0.07):
        cyl((0.05 + dx, 0.22, 1.24), r=0.012, depth=0.26, verts=4, m=WOOD, rot=(0.25, 0.2, 0))
    torus((-0.44, -0.10, 0.72), major=0.30, minor=0.022, m=WOOD, rot=(0, PI / 2, 0.18))
    cube((-0.44, -0.10, 0.72), scale=(0.012, 0.012, 0.58), m=STRING)
    export(assemble("GoblinScout", 1.60), "goblinscout_attack.glb")


def build_goblin_brute():
    reset()
    SKIN = mat("BruteSkin", "3a7a26", rough=0.7)
    DARK = mat("BruteDark", "24521a", rough=0.75)
    CLOTH = mat("BruteCloth", "5a3320", rough=0.9)
    CLOTH2 = mat("BruteCloth2", "2e1c12", rough=0.9)
    IRON = mat("BruteIron", "6e727a", rough=0.45, metal=0.6)
    goblin_base(SKIN, DARK, CLOTH, CLOTH2, W=1.30, potbelly=1.18)
    for s in (-1, 1):
        cone((s * 0.10, -0.22, 1.10), r1=0.036, depth=0.16, verts=4, m=WHITE, rot=(-0.25, 0, 0))
        ico((s * 0.50, 0, 1.06), r=0.19, sub=1, scale=(1.0, 1.0, 0.62), m=IRON)
    cyl((-0.55, -0.10, 0.60), r=0.045, depth=0.62, verts=7, m=CLOTH, rot=(0.20, 0, 0))
    ico((-0.55, -0.22, 1.00), r=0.17, sub=1, scale=(1.0, 1.0, 1.25), m=CLOTH2)
    for a_i in range(4):
        ang = a_i * PI / 2 + 0.4
        cone((-0.55 + 0.17 * math.cos(ang), -0.22 + 0.17 * math.sin(ang), 1.02),
             r1=0.035, depth=0.14, verts=4, m=IRON,
             rot=(math.sin(ang) * -1.4, math.cos(ang) * 1.4, 0))
    export(assemble("GoblinBrute", 1.85), "goblinbrute_attack.glb")


def build_wraith():
    reset()
    wraith_base(mat("WraithRobe", "8a6fd1", rough=0.85),
                mat("WraithRobeD", "5c48a0", rough=0.9),
                mat("WraithVoid", "1a1626", rough=0.6),
                mat("WraithEye", "e8dcff", rough=0.2, emit=2.2))
    export(assemble("Wraith", 1.92), "wraith_attack.glb")


def build_null_wraith():
    reset()
    # Kept lighter than its #3a3a42 tint would suggest: at the tint's own value
    # the whole model collapses into one unreadable silhouette in the dungeon.
    ROBE = mat("NullRobe", "4a4a58", rough=0.85)
    ROBED = mat("NullRobeD", "2c2c36", rough=0.9)
    VOID = mat("NullVoid", "0b0b11", rough=0.5)
    EYE = mat("NullEye", "ff2233", rough=0.25, emit=0.9)   # >1 emission blows out to white
    EDGE = mat("NullEdge", "7d7d90", rough=0.7)
    wraith_base(ROBE, ROBED, VOID, EYE, tatters=9)
    cyl((0, 0.02, 1.235), r=0.315, depth=0.05, verts=10, m=EDGE)
    for loc, sc, rot in (((0.50, -0.18, 1.26), 0.085, (0.4, 0.3, 0.2)),
                         ((-0.54, -0.10, 1.02), 0.070, (0.2, 0.6, 0.1)),
                         ((0.42, -0.24, 0.50), 0.055, (0.9, 0.2, 0.5)),
                         ((-0.40, -0.20, 1.62), 0.050, (0.3, 0.8, 0.4)),
                         ((0.30, 0.26, 1.50), 0.060, (0.7, 0.1, 0.9))):
        cube(loc, scale=(sc, sc, sc), m=EDGE, rot=rot)
    for i in range(8):
        if i == 3:
            continue                      # the gap is what makes it a *broken* halo
        a = 2 * PI * i / 8
        cube((0.26 * math.cos(a), 0.26 * math.sin(a) + 0.03, 1.66),
             scale=(0.085, 0.030, 0.030), m=EYE, rot=(0, 0, a))
    export(assemble("NullWraith", 1.98), "nullwraith_attack.glb")


def build_echo_wraith():
    reset()
    GH1 = mat("EchoGhost1", "5f9bff", rough=0.9, emit=0.35, alpha=0.34)
    GH2 = mat("EchoGhost2", "5f9bff", rough=0.9, emit=0.30, alpha=0.18)
    wraith_base(mat("EchoRobe", "3a6bd1", rough=0.85),
                mat("EchoRobeD", "27488f", rough=0.9),
                mat("EchoVoid", "0d1730", rough=0.55),
                mat("EchoEye", "9fe8ff", rough=0.2, emit=2.4))
    # Two after-images lagging behind the body, each fainter and smaller.
    for dx, dy, sc, mm in ((0.30, 0.26, 0.92, GH1), (0.56, 0.50, 0.82, GH2)):
        cone((dx, dy, 0.62 * sc), r1=0.46 * sc, r2=0.30 * sc, depth=1.12 * sc, verts=8, m=mm)
        ico((dx, dy, 1.16 * sc), r=0.30 * sc, sub=1, scale=(1.18, 1.06, 0.55), m=mm)
        cone((dx, dy + 0.03, 1.44 * sc), r1=0.30 * sc, r2=0.055, depth=0.46 * sc, verts=6, m=mm)
    export(assemble("EchoWraith", 1.92), "echowraith_attack.glb")


def build_dragon():
    reset()
    SCALES = mat("DragonScale", "e05263", rough=0.55)
    BELLY = mat("DragonBelly", "f2b39c", rough=0.6)
    DARKR = mat("DragonDark", "9e2f42", rough=0.6)
    MEMB = mat("DragonWing", "b8455a", rough=0.7)
    HORN = mat("DragonHorn", "efe0c2", rough=0.45)
    EYE = mat("DragonEye", "ffd24a", rough=0.2, emit=1.1)
    for s in (-1, 1):
        ico((s * 0.30, 0.10, 0.56), r=0.21, sub=2, scale=(0.95, 1.15, 1.15), m=SCALES)
        cyl((s * 0.27, -0.02, 0.28), r=0.115, depth=0.44, verts=8, m=SCALES)
        cube((s * 0.27, -0.13, 0.07), scale=(0.26, 0.38, 0.14), m=SCALES)
        for k in (-1, 0, 1):
            cone((s * 0.27 + k * 0.075, -0.31, 0.055), r1=0.030, depth=0.13, verts=4,
                 m=HORN, rot=(-PI / 2, 0, 0))
    ico((0, 0.04, 0.95), r=0.40, sub=2, scale=(1.02, 1.18, 1.12), m=SCALES)
    ico((0, -0.22, 0.90), r=0.30, sub=2, scale=(0.86, 0.60, 1.15), m=BELLY)
    ico((0, -0.06, 1.22), r=0.29, sub=2, scale=(1.02, 1.02, 0.95), m=SCALES)
    for s in (-1, 1):
        cyl((s * 0.30, -0.20, 1.05), r=0.062, depth=0.28, verts=6, m=SCALES, rot=(0.5, s * 0.35, 0))
        ico((s * 0.36, -0.30, 0.90), r=0.075, sub=1, m=SCALES)
        for k in (-1, 0, 1):
            cone((s * 0.36 + k * 0.05, -0.37, 0.87), r1=0.020, depth=0.10, verts=4,
                 m=HORN, rot=(-1.9, 0, 0))
    ico((0, -0.13, 1.42), r=0.20, sub=2, m=SCALES)
    ico((0, -0.21, 1.58), r=0.18, sub=2, m=SCALES)
    ico((0, -0.30, 1.73), r=0.25, sub=2, scale=(1.0, 1.10, 0.95), m=SCALES)
    ico((0, -0.55, 1.66), r=0.16, sub=2, scale=(0.95, 1.15, 0.72), m=SCALES)
    ico((0, -0.55, 1.585), r=0.14, sub=2, scale=(0.90, 1.10, 0.35), m=DARKR)
    for s in (-1, 1):
        ico((s * 0.055, -0.70, 1.685), r=0.026, sub=1, m=DARKR)
        cone((s * 0.085, -0.63, 1.61), r1=0.024, depth=0.075, verts=4, m=WHITE, rot=(PI, 0, 0))
        ico((s * 0.145, -0.44, 1.79), r=0.075, sub=2, scale=(1.0, 0.85, 1.0), m=WHITE)
        ico((s * 0.155, -0.50, 1.79), r=0.048, sub=2, m=EYE)
        ico((s * 0.160, -0.535, 1.79), r=0.022, sub=2, scale=(0.5, 1.0, 1.4), m=PUPIL)
        cone((s * 0.155, -0.15, 1.90), r1=0.062, depth=0.36, verts=5, m=HORN,
             rot=(-0.85, 0, s * 0.25))
        cone((s * 0.24, -0.30, 1.72), r1=0.075, depth=0.22, verts=4, m=MEMB, rot=(0, s * 1.35, 0))
    for yy, zz, r in ((-0.08, 1.36, 0.05), (0.06, 1.24, 0.062), (0.22, 1.10, 0.07),
                      (0.36, 0.94, 0.062), (0.48, 0.78, 0.05)):
        cone((0, yy, zz + 0.16), r1=r, depth=0.20, verts=4, m=HORN, rot=(0.45, 0, 0))
    for s in (-1, 1):                     # wings: 3-sided cones make flat membranes
        cone((s * 0.62, 0.30, 1.48), r1=0.62, depth=0.045, verts=3, m=MEMB,
             rot=(1.15, s * 0.55, s * 0.35))
        cone((s * 0.44, 0.24, 1.30), r1=0.40, depth=0.04, verts=3, m=MEMB,
             rot=(1.25, s * 0.45, s * 0.9))
        cyl((s * 0.52, 0.26, 1.42), r=0.028, depth=0.80, verts=5, m=SCALES, rot=(0.35, s * 1.05, 0))
        cone((s * 0.92, 0.36, 1.80), r1=0.035, depth=0.14, verts=4, m=HORN, rot=(0.3, s * 1.1, 0))
    for i, (yy, zz, r) in enumerate(((0.42, 0.80, 0.19), (0.62, 0.76, 0.155), (0.80, 0.80, 0.12),
                                     (0.95, 0.90, 0.09), (1.06, 1.02, 0.06))):
        ico((0, yy, zz), r=r, sub=2 if i < 3 else 1, m=SCALES)
    cone((0, 1.14, 1.13), r1=0.055, depth=0.20, verts=4, m=HORN, rot=(-0.7, 0, 0))
    export(assemble("Dragon", 1.98), "dragon_attack.glb")


BUILDERS = [build_slime, build_glitch_slime, build_null_wraith, build_goblin,
            build_goblin_scout, build_goblin_brute, build_wraith, build_echo_wraith,
            build_dragon]


def _clear_scene():
    """Empty the file without wm.read_homefile().

    read_homefile leaves the window context stale for the rest of the same
    script run, and the next bpy.ops.object.join() then fails its poll — which
    only bites when the script is run in one go, exactly how it is meant to be
    run. Deleting the datablocks by hand avoids the whole problem.
    """
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials,
                 bpy.data.cameras, bpy.data.lights):
        for item in list(coll):
            coll.remove(item, do_unlink=True)


def main():
    if not os.path.isdir(OUT_MODELS):
        sys.exit("expected %s to exist — run this from a checkout of the repo" % OUT_MODELS)
    _clear_scene()
    _common()
    for build in BUILDERS:
        build()
    print("done: %d models in %s" % (len(BUILDERS), OUT_MODELS))


if __name__ == "__main__":
    main()
