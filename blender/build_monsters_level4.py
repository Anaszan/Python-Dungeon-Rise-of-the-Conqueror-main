"""Build level 4's ten monsters as rigged low-poly GLB models with an attack loop.

Level 4 is the functions chapter ("หอคอยแห่งฟังก์ชัน"), so the cast is built
around call-and-return: every caster here throws a bolt out on the beat and
catches it coming back inside the same one-second loop — a call that returns a
value, playing on a loop across the room. The melee half of the cast (the
cultists and the spell knights) guards that idea rather than performing it.

This file replaces the flat planes level 4 used to ship (GLBs baked from the
2D art, zero depth) with the same kind of rigged models as levels 2 and 3, and
imports the rig, the primitives and the shared attack loops from those two
scripts rather than restating them: X-centred, base at local z=0, top at or
below z=2, models facing -Y, and one action named "Attack" over 24 frames whose
first and last poses match so it repeats cleanly.

Run it from the repo root:

    blender --background --python blender/build_monsters_level4.py
    blender --background --python blender/build_monsters_level4.py -- --preview

Writes public/monsters/<name>_attack.glb, and with --preview also renders
blender/preview/level4/<name>.png (rest) and <name>_strike.png (contact frame).
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_monsters_level2 as rig                                    # noqa: E402
import build_monsters_level3 as rig3                                   # noqa: E402
from build_monsters_level2 import (                                    # noqa: E402
    LAST, PI, assemble, cone, cube, cyl, export, group, hold, ico, key, mat,
    reset, soldier_base, torus,
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PREVIEW = os.path.join(REPO, "blender", "preview", "level4")


# --------------------------------------------------------------------------
# shared bodies
# --------------------------------------------------------------------------
def wisp_base(GLOW, HALO, CORE, SHARD, EYE, shards=6, halo_tilt=0.30):
    """A hovering ball of spell-light on a flame tail, with a shell of shards.

    No legs and no real body: the rig is the tail it stands on, the glowing
    body, a shell that breathes with the cast, and two stubby light-hands that
    push the bolt out. The dark core inside the glow is not decoration — a
    monster made of one bright colour is a white blob at dungeon size, and the
    core is where the eyes get something to sit against.
    """
    group('trail')
    cone((0, 0, 0.30), r1=0.20, r2=0.055, depth=0.60, verts=6, m=HALO, rot=(PI, 0, 0))
    for i in range(5):                                     # embers falling off the tail
        a = 2 * PI * i / 5 + 0.3
        ico((0.155 * math.cos(a), 0.155 * math.sin(a), 0.10 + 0.055 * (i % 3)),
            r=0.050 - 0.008 * (i % 3), sub=1, m=SHARD)

    group('body', pivot=(0, 0, 0.72))
    ico((0, 0, 1.02), r=0.36, sub=2, scale=(1.0, 0.94, 1.04), m=GLOW)
    ico((0, -0.03, 1.02), r=0.235, sub=2, scale=(1.0, 0.90, 1.0), m=CORE)
    cone((0, 0, 0.74), r1=0.26, r2=0.34, depth=0.30, verts=8, m=HALO)      # the neck of flame
    # The eyes sit *outside* the glow shell, on dark sockets. Sunk inside it
    # they were invisible from the dungeon camera and the wisp read as a
    # featureless white ball — the sockets are what give it a face at all.
    for s in (-1, 1):
        ico((s * 0.105, -0.300, 1.07), r=0.088, sub=2, scale=(1.0, 0.55, 1.0), m=CORE)
        ico((s * 0.105, -0.345, 1.07), r=0.048, sub=2, m=EYE)

    # A crown of shards standing in the plane that faces the camera, each one
    # pointing straight out from the core. Fanned through the depth axis
    # instead they cross each other from a three-quarter view and the whole
    # monster reads as a ball of tangled wire.
    group('shell', pivot=(0, 0, 1.02), parent='body')
    for i in range(shards):
        a = 2 * PI * i / shards + 0.25
        cone((0.50 * math.cos(a), -0.02, 1.02 + 0.50 * math.sin(a)),
             r1=0.090, r2=0.0, depth=0.34, verts=4, m=SHARD, rot=(0, PI / 2 - a, 0))

    group('halo', pivot=(0, 0, 1.02), parent='body')
    torus((0, 0, 1.02), major=0.64, minor=0.048, m=SHARD, rot=(halo_tilt, 0, 0))

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.30, -0.04, 1.00), parent='body')
        for k in range(3):
            ico((side * (0.36 + k * 0.085), -0.10 - k * 0.035, 0.96 - k * 0.045),
                r=0.072 - k * 0.016, sub=1, m=GLOW)
        ico((side * 0.60, -0.19, 0.85), r=0.070, sub=2, m=SHARD)           # the casting hand


def sprite_base(SKIN, DARK, CLOTH, CLOTH2, WING, EYE, W=1.0):
    """A hand-sized hex-caster: pointed hood, long ears, four insect wings.

    Two wings a side rather than one: a single pair reads as a bird from the
    dungeon camera, and these are meant to hover and jitter, not glide.
    """
    group('legs')
    for s in (-1, 1):
        cyl((s * 0.115 * W, 0, 0.20), r=0.052 * W, depth=0.40, verts=6, m=SKIN)
        cube((s * 0.115 * W, -0.055, 0.03), scale=(0.12 * W, 0.22, 0.055), m=CLOTH2)

    group('torso', pivot=(0, 0, 0.40))
    ico((0, 0, 0.60), r=0.225, sub=2, scale=(1.02 * W, 0.86, 1.08), m=CLOTH)
    cone((0, 0, 0.44), r1=0.27 * W, r2=0.15, depth=0.30, verts=8, m=CLOTH)      # tunic skirt
    cyl((0, 0, 0.53), r=0.21 * W, depth=0.055, verts=9, m=CLOTH2)               # sash
    ico((0, -0.15, 0.68), r=0.055, sub=2, m=WING)                               # hex charm

    group('head', pivot=(0, 0, 0.78), parent='torso')
    ico((0, -0.01, 0.93), r=0.205, sub=2, scale=(1.0, 0.94, 1.02), m=SKIN)
    for s in (-1, 1):
        cone((s * 0.27, 0.03, 0.99), r1=0.058, r2=0.0, depth=0.28, verts=5, m=SKIN,
             rot=(0, s * 1.30, 0))                                              # long ears
        ico((s * 0.082, -0.155, 0.97), r=0.050, sub=2, m=rig.WHITE)
        ico((s * 0.090, -0.190, 0.97), r=0.029, sub=2, m=EYE)
    cone((0, -0.175, 0.90), r1=0.030, depth=0.09, verts=5, m=SKIN, rot=(PI / 2, 0, 0))
    cone((0, 0.04, 1.10), r1=0.215, r2=0.02, depth=0.40, verts=6, m=CLOTH2,     # pointed hood
         rot=(0.32, 0, 0))

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.235 * W, 0, 0.72), parent='torso')
        cyl((side * 0.235 * W, -0.02, 0.58), r=0.044 * W, depth=0.30, verts=6, m=SKIN)
        ico((side * 0.235 * W, -0.05, 0.43), r=0.058 * W, sub=1, m=SKIN)

    for side, gname in ((-1, 'wing_r'), (1, 'wing_l')):
        group(gname, pivot=(side * 0.10, 0.14, 0.76), parent='torso')
        for dz, length, tilt in ((0.20, 0.62, 0.55), (-0.02, 0.46, 0.20)):
            cone((side * (0.26 + length * 0.32), 0.20, 0.78 + dz), r1=length * 0.30, r2=0.0,
                 depth=0.030, verts=3, m=WING, rot=(1.35, side * 0.30, side * tilt))
            cyl((side * (0.20 + length * 0.26), 0.19, 0.78 + dz * 0.9), r=0.013,
                depth=length * 0.90, verts=4, m=DARK, rot=(0.15, side * 1.15, side * tilt * 0.4))


def mage_base(ROBE, ROBE_D, SKIN, BEARD, EYE, TRIM, tatters=10, hood=True):
    """A tall robed caster: heavy skirt, mantle, hooded face, sleeves that sweep.

    Unlike the level 2 wraiths this one has a face inside the hood rather than a
    void — the archmage is the only thing in the tower the player is meant to
    read as a person, which is what makes it the boss rather than one more
    haunt.
    """
    group('robe')
    cone((0, 0, 0.64), r1=0.48, r2=0.30, depth=1.16, verts=10, m=ROBE)
    for i in range(tatters):
        a = 2 * PI * i / tatters + 0.2
        cone((0.44 * math.cos(a), 0.44 * math.sin(a), 0.10), r1=0.090, depth=0.34,
             verts=4, m=ROBE_D, rot=(PI, 0, 0))
    for i in range(4):                                                # standing folds
        a = 2 * PI * i / 4 + 0.7
        cube((0.34 * math.cos(a), 0.34 * math.sin(a), 0.74), scale=(0.055, 0.055, 0.86),
             m=ROBE_D, rot=(0, 0, a))

    group('torso', pivot=(0, 0, 1.10))
    ico((0, 0, 1.26), r=0.32, sub=2, scale=(1.16, 0.98, 0.72), m=ROBE)
    cone((0, 0.04, 1.30), r1=0.40, r2=0.24, depth=0.30, verts=9, m=ROBE_D)      # mantle
    cyl((0, 0, 1.44), r=0.24, depth=0.055, verts=10, m=TRIM)
    ico((0, -0.22, 1.32), r=0.070, sub=2, m=EYE)                                # breast sigil

    group('head', pivot=(0, 0, 1.50), parent='torso')
    ico((0, -0.02, 1.64), r=0.225, sub=2, scale=(0.98, 0.94, 1.04), m=SKIN)
    for s in (-1, 1):
        ico((s * 0.086, -0.185, 1.68), r=0.046, sub=2, m=rig.WHITE)
        ico((s * 0.094, -0.216, 1.68), r=0.027, sub=2, m=EYE)
        cube((s * 0.095, -0.175, 1.77), scale=(0.16, 0.06, 0.045), m=BEARD,     # heavy brows
             rot=(0, s * -0.22, 0))
    cone((0, -0.19, 1.62), r1=0.038, depth=0.11, verts=5, m=SKIN, rot=(PI / 2, 0, 0))
    for i in range(5):                                                          # the beard
        a = -0.5 + 1.0 * i / 4
        cone((0.11 * math.sin(a), -0.145 - 0.02 * abs(a), 1.46 - 0.03 * abs(a)),
             r1=0.048, r2=0.012, depth=0.34, verts=4, m=BEARD, rot=(PI - 0.16, 0, a * 0.5))
    if hood:
        cone((0, 0.05, 1.80), r1=0.34, r2=0.07, depth=0.44, verts=8, m=ROBE_D)

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.30, 0, 1.32), parent='torso')
        cone((side * 0.40, -0.06, 1.06), r1=0.145, r2=0.065, depth=0.56, verts=6, m=ROBE,
             rot=(0.12, side * 0.26, 0))
        ico((side * 0.50, -0.15, 0.78), r=0.072, sub=1, m=SKIN)
        for k in range(3):
            cone((side * 0.50 + (k - 1) * 0.046, -0.18, 0.68), r1=0.018, depth=0.15,
                 verts=4, m=SKIN, rot=(PI + 0.18, 0, 0))


def bolt(mat_glow, mat_hot, at=(0, -0.34, 1.00), r=0.11, spikes=5):
    """The thing that gets thrown and comes back — one group named 'bolt'.

    Parented to the motion empty rather than to a hand: it has to leave the
    caster entirely and fly back, which it cannot do while it hangs off an arm
    that is busy following through.
    """
    group('bolt', pivot=at)
    ico(at, r=r * 0.95, sub=2, m=mat_hot)
    ico(at, r=r * 1.15, sub=1, scale=(1.0, 1.7, 1.0), m=mat_glow)
    # Drawn out along -Y with a point on the front so it reads as something
    # travelling rather than as a rock the caster happened to drop.
    cone((at[0], at[1] - r * 1.9, at[2]), r1=r * 0.82, r2=0.0, depth=r * 2.4, verts=5,
         m=mat_glow, rot=(-PI / 2, 0, 0))
    cone((at[0], at[1] + r * 2.0, at[2]), r1=r * 0.55, r2=0.0, depth=r * 2.0, verts=4,
         m=mat_glow, rot=(PI / 2, 0, 0))                      # the tail it drags
    for i in range(spikes):
        a = 2 * PI * i / spikes + 0.4
        cone((at[0] + r * 1.35 * math.cos(a), at[1], at[2] + r * 1.35 * math.sin(a)),
             r1=r * 0.34, r2=0.0, depth=r * 1.6, verts=3, m=mat_glow,
             rot=(0, PI / 2 - a, 0))


# --------------------------------------------------------------------------
# attack loops specific to level 4
#
# Sign convention (shared with levels 2 and 3): a positive X rotation pitches a
# part forward, toward -Y, which is the direction the model faces.
# --------------------------------------------------------------------------
def anim_cast_return(base='legs', torso='torso', head='head', reach=0.20, throw=1.15,
                     rise=0.0, extra=()):
    """The chapter in one second: gather the argument, throw, catch the return.

    Frame 6 winds up with the bolt swollen at the chest, 11 releases it out
    past the front of the model, 17 has it back in the caster's hands, and 21
    folds it away — so the loop reads as call → return rather than as a monster
    throwing things away forever.
    """
    parts = ['motion', base, torso, 'arm_r', 'arm_l', 'bolt'] + list(extra)
    if head:
        parts.append(head)
    hold(parts, [1])

    key('motion', 6, move=(0, 0.12, rise))
    key(torso, 6, rot=(-0.26, 0, 0))
    key('arm_r', 6, rot=(0.90, 0, -0.42))
    key('arm_l', 6, rot=(0.90, 0, 0.42))
    key(base, 6, move=(0, 0.03, 0))
    key('bolt', 6, move=(0, 0.22, 0.04), scale=1.55)
    if head:
        key(head, 6, rot=(-0.16, 0, 0))

    key('motion', 11, move=(0, -reach, rise * 0.3))
    key(torso, 11, rot=(0.34, 0, 0))
    key('arm_r', 11, rot=(-0.85, 0, 0.60))
    key('arm_l', 11, rot=(-0.85, 0, -0.60))
    key(base, 11, move=(0, -reach * 0.35, 0))
    key('bolt', 11, move=(0, -throw, 0.06), scale=0.80)
    if head:
        key(head, 11, rot=(0.24, 0, 0))

    # the return: the bolt comes back to the hands that threw it
    key('motion', 17, move=(0, -reach * 0.30, rise * 0.6))
    key(torso, 17, rot=(0.10, 0, 0))
    key('arm_r', 17, rot=(-0.22, 0, 0.26))
    key('arm_l', 17, rot=(-0.22, 0, -0.26))
    key(base, 17, move=(0, -reach * 0.10, 0))
    key('bolt', 17, move=(0, -0.10, 0.03), scale=1.30)
    if head:
        key(head, 17, rot=(0.08, 0, 0))

    key('bolt', 21, move=(0, 0.02, 0.01), scale=0.55)
    hold(parts, [LAST])


def anim_flutter(groups=('wing_r', 'wing_l'), beat=0.85, every=3):
    """Insect wings: a fast even beat that never lands on the cast's beat.

    Keyed on its own stride rather than around the strike so the flutter reads
    as constant hover — a wing that pauses while the arms move looks like the
    same limb keyed twice. The two sides mirror on the Z axis, which is the
    axis a wing sweeps around when the model faces -Y.
    """
    for g in groups:
        key(g, 1)
    up = True
    for f in range(1 + every, LAST, every):
        for g in groups:
            side = -1 if g.endswith('_r') else 1
            key(g, f, rot=(0, 0, side * (beat if up else -beat * 0.55)))
        up = not up
    for g in groups:
        key(g, LAST)


def anim_hover(groups, drift=0.06):
    """A slow bob laid under a cast, for the things that never touch the floor."""
    for g in groups:
        key(g, 1)
        key(g, 8, move=(0, 0, drift))
        key(g, 16, move=(0, 0, -drift * 0.5))
        key(g, LAST)


def anim_ritual_slash(reach=0.24):
    """Cultist work: hold the dagger up in both hands, then bring it down across.

    A chop with the offhand riding along, which is what separates a rite from
    the plain overhead swings the goblins were doing two levels ago.
    """
    body = ['motion', 'legs', 'torso', 'head', 'arm_r', 'arm_l']
    hold(body, [1])
    key('motion', 7, move=(0, 0.10, 0.02))
    key('torso', 7, rot=(-0.24, 0, 0.16))
    key('head', 7, rot=(-0.20, 0, 0))
    key('arm_r', 7, rot=(2.45, 0, -0.20))
    key('arm_l', 7, rot=(2.10, 0, 0.34))
    key('legs', 7, move=(0, 0.02, 0))

    key('motion', 12, move=(0, -reach, 0))
    key('torso', 12, rot=(0.38, 0, -0.22))
    key('head', 12, rot=(0.26, 0, 0))
    key('arm_r', 12, rot=(-1.05, 0, 0.30))
    key('arm_l', 12, rot=(-0.45, 0, -0.20))
    key('legs', 12, move=(0, -reach * 0.35, 0))

    key('motion', 17, move=(0, -reach * 0.35, 0))
    key('torso', 17, rot=(0.12, 0, -0.06))
    key('head', 17, rot=(0.08, 0, 0))
    key('arm_r', 17, rot=(-0.50, 0, 0.10))
    key('arm_l', 17, rot=(-0.16, 0, -0.06))
    key('legs', 17, move=(0, -reach * 0.12, 0))
    hold(body, [LAST])


# --------------------------------------------------------------------------
# the cast
# --------------------------------------------------------------------------
def build_arcane_wisp():
    """Arcane Wisp — level 4's opener: a bolt thrown and caught, once a second."""
    reset()
    GLOW = mat("AwGlow", "8fc7e8", rough=0.6, emit=0.55, alpha=0.90)
    HALO = mat("AwHalo", "5f9fd0", rough=0.7, emit=0.35, alpha=0.75)
    CORE = mat("AwCore", "12283c", rough=0.5)
    SHARD = mat("AwShard", "cdeaff", rough=0.3, emit=1.3, alpha=0.88)
    EYE = mat("AwEye", "ffffff", rough=0.2, emit=2.4)
    HOT = mat("AwHot", "eaf6ff", rough=0.25, emit=2.2)
    wisp_base(GLOW, HALO, CORE, SHARD, EYE, shards=6)
    bolt(SHARD, HOT, at=(0, -0.40, 1.00), r=0.105)
    root = assemble("ArcaneWisp", 1.54)

    anim_cast_return(base='trail', torso='body', head=None, reach=0.18, throw=1.05,
                     rise=0.06, extra=['shell', 'halo'])
    # The shell breathes with the cast and the halo keeps turning through it.
    key('shell', 6, scale=1.30)
    key('shell', 11, scale=0.62)
    key('shell', 17, scale=1.14)
    key('halo', 6, rot=(0, 0, 1.6), scale=0.86)
    key('halo', 11, rot=(0, 0, 3.4), scale=1.24)
    key('halo', 17, rot=(0, 0, 5.0), scale=0.94)
    key('halo', LAST, rot=(0, 0, 2 * PI))
    export(root, "arcanewisp_attack.glb")
    return 11


def build_function_wisp():
    """Function Wisp — the chapter's mascot: arguments in, one value back out.

    Three marks ride the ring and are pulled into the core on the wind-up, which
    is the call; the bolt that leaves on frame 11 and comes home on 17 is the
    return.
    """
    reset()
    GLOW = mat("FwGlow", "6fb0e8", rough=0.6, emit=0.6, alpha=0.90)
    HALO = mat("FwHalo", "3f7fc0", rough=0.7, emit=0.35, alpha=0.75)
    CORE = mat("FwCore", "0d2036", rough=0.5)
    SHARD = mat("FwShard", "9fd8ff", rough=0.3, emit=1.4, alpha=0.88)
    EYE = mat("FwEye", "eaffff", rough=0.2, emit=2.6)
    RUNE = mat("FwRune", "b6f0ff", rough=0.3, emit=1.6)
    HOT = mat("FwHot", "ffffff", rough=0.25, emit=2.4)
    wisp_base(GLOW, HALO, CORE, SHARD, EYE, shards=5, halo_tilt=0.45)

    group('args', pivot=(0, 0, 1.02))
    torus((0, 0, 1.02), major=0.78, minor=0.040, m=RUNE, rot=(0.45, 0, 0))
    for i in range(3):                                     # three arguments on the ring
        a = 2 * PI * i / 3 + 0.5
        cube((0.78 * math.cos(a), 0.78 * math.sin(a) * 0.90,
              1.02 + 0.34 * math.sin(a)), scale=(0.075, 0.075, 0.075), m=RUNE,
             rot=(0.45, 0, a))
    bolt(SHARD, HOT, at=(0, -0.44, 1.00), r=0.115, spikes=6)
    root = assemble("FunctionWisp", 1.58)

    anim_cast_return(base='trail', torso='body', head=None, reach=0.16, throw=1.20,
                     rise=0.07, extra=['shell', 'halo', 'args'])
    key('shell', 6, scale=1.26)
    key('shell', 11, scale=0.60)
    key('shell', 17, scale=1.12)
    key('halo', 6, rot=(0, 0, -1.2))
    key('halo', 11, rot=(0, 0, -2.6))
    key('halo', 17, rot=(0, 0, -4.4))
    key('halo', LAST, rot=(0, 0, -2 * PI))
    # The arguments collapse into the core to make the call, then reappear.
    key('args', 6, rot=(0, 0, 1.1), scale=0.34)
    key('args', 11, rot=(0, 0, 2.4), scale=0.30)
    key('args', 17, rot=(0, 0, 4.2), scale=1.18)
    key('args', LAST, rot=(0, 0, 2 * PI))
    export(root, "functionwisp_attack.glb")
    return 11


def _sprite(name, filename, height, skin, dark, cloth, cloth2, wing, eye, glow, hot,
            W=1.0, throw=0.95, extra=None):
    reset()
    SKIN = mat(name + "Skin", skin, rough=0.62)
    DARK = mat(name + "Dark", dark, rough=0.7)
    CLOTH = mat(name + "Cloth", cloth, rough=0.85)
    CLOTH2 = mat(name + "Cloth2", cloth2, rough=0.88)
    WING = mat(name + "Wing", wing, rough=0.35, emit=0.6, alpha=0.55)
    EYE = mat(name + "Eye", eye, rough=0.2, emit=2.0)
    GLOW = mat(name + "Glow", glow, rough=0.3, emit=1.3, alpha=0.88)
    HOT = mat(name + "Hot", hot, rough=0.25, emit=2.2)
    sprite_base(SKIN, DARK, CLOTH, CLOTH2, WING, EYE, W=W)
    if extra:
        extra(SKIN, DARK, CLOTH, CLOTH2, WING, EYE, GLOW)
    bolt(GLOW, HOT, at=(0, -0.36, 0.62), r=0.085)
    root = assemble(name, height)
    anim_cast_return(reach=0.16, throw=throw, rise=0.05)
    anim_flutter(beat=0.95, every=3)
    export(root, filename)
    return 11


def build_hex_sprite():
    """Hex Sprite — the small one that opens the tower's side rooms."""
    def extra(SKIN, DARK, CLOTH, CLOTH2, WING, EYE, GLOW):
        group('head')
        ico((0, 0.06, 1.30), r=0.042, sub=2, m=GLOW)          # the mark on the hood
    return _sprite("HexSprite", "hexsprite_attack.glb", 1.36,
                   "e8d2b0", "b79a72", "7a4a8f", "3f2450", "d9a8ff", "ffe27a",
                   "c98fe8", "ffe9ff", extra=extra)


def build_hex_imp():
    """Hex Imp — hexes stacked: horns, a heavier hood and two marks in the air."""
    def extra(SKIN, DARK, CLOTH, CLOTH2, WING, EYE, GLOW):
        group('head')
        for s in (-1, 1):
            cone((s * 0.115, 0.02, 1.12), r1=0.045, r2=0.0, depth=0.24, verts=4,
                 m=DARK, rot=(-0.30, s * 0.28, 0))
        group('torso')
        cone((0, 0.20, 0.60), r1=0.13, r2=0.02, depth=0.44, verts=5, m=CLOTH2,
             rot=(-0.85, 0, 0))                                # tail of the hood
        group('marks', pivot=(0, -0.10, 0.72), parent='torso')
        for i, (dx, dz) in enumerate(((-0.30, 0.22), (0.30, 0.14))):
            cube((dx, -0.24, 0.72 + dz), scale=(0.070, 0.070, 0.070), m=GLOW,
                 rot=(0, 0, 0.5 + i))
    n = _sprite("HexImp", "heximp_attack.glb", 1.42,
                "d8bfa0", "a5865f", "5c3570", "2a1638", "c78fff", "ffd24a",
                "b06fe8", "f6e2ff", W=1.06, throw=1.02, extra=extra)
    return n


def build_curse_sprite():
    """Curse Sprite — the one that keeps its hex out after the throw lands."""
    def extra(SKIN, DARK, CLOTH, CLOTH2, WING, EYE, GLOW):
        group('head')
        for i in range(5):                                      # a small crown of pins
            a = -0.9 + 1.8 * i / 4
            cone((0.16 * math.sin(a), 0.03 + 0.07 * math.cos(a), 1.16), r1=0.026, r2=0.0,
                 depth=0.20, verts=4, m=GLOW, rot=(-0.28, 0, a * 0.6))
        group('torso')
        for s in (-1, 1):                                       # trailing ribbons
            cone((s * 0.20, 0.18, 0.56), r1=0.075, r2=0.012, depth=0.46, verts=4,
                 m=CLOTH2, rot=(-0.70, s * 0.30, 0))
    return _sprite("CurseSprite", "cursesprite_attack.glb", 1.38,
                   "f0d8c4", "c0a084", "8f3f7a", "4a1c3e", "ff9ee0", "fff0a0",
                   "e08fd0", "ffe6f6", W=0.96, throw=0.90, extra=extra)


def build_cultist():
    """Cultist — a robed servant of the tower with a ritual dagger."""
    reset()
    SKIN = mat("CuSkin", "c79f7c", rough=0.65)
    DARK = mat("CuDark", "8f6b4c", rough=0.7)
    CLOTH = mat("CuCloth", "7a3d3d", rough=0.88)
    CLOTH2 = mat("CuCloth2", "3a1c1c", rough=0.9)
    GOLD = mat("CuGold", "c9a24c", rough=0.4, metal=0.7)
    SIGIL = mat("CuSigil", "ff8a5c", rough=0.3, emit=1.2)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=0.96, belly=0.92, ears=False)

    group('torso')
    cone((0, 0.02, 1.08), r1=0.40, r2=0.24, depth=0.30, verts=9, m=CLOTH)       # mantle
    ico((0, -0.28, 1.02), r=0.062, sub=2, m=SIGIL)                              # breast mark
    group('head')
    cone((0, 0.05, 1.46), r1=0.38, r2=0.07, depth=0.52, verts=8, m=CLOTH2)      # deep hood
    for s in (-1, 1):                                                           # the cowl's edge
        cube((s * 0.24, -0.13, 1.34), scale=(0.10, 0.34, 0.40), m=CLOTH2, rot=(0, 0, s * 0.35))
    cube((0, -0.235, 1.34), scale=(0.30, 0.07, 0.10), m=CLOTH2)                 # shadowed brow

    group('dagger', pivot=(-0.384, 0, 1.06), parent='arm_r')
    cyl((-0.384, -0.06, 0.54), r=0.026, depth=0.18, verts=6, m=CLOTH2)
    cube((-0.384, -0.06, 0.64), scale=(0.17, 0.05, 0.035), m=GOLD)
    cube((-0.384, -0.06, 0.84), scale=(0.055, 0.022, 0.36), m=rig.STEEL)
    cone((-0.384, -0.06, 1.04), r1=0.038, r2=0.0, depth=0.16, verts=4, m=rig.STEEL)
    group('bowl', pivot=(0.384, 0, 1.06), parent='arm_l')
    cyl((0.44, -0.14, 0.58), r=0.13, depth=0.09, verts=8, m=GOLD)
    ico((0.44, -0.14, 0.66), r=0.075, sub=1, scale=(1, 1, 0.5), m=SIGIL)

    root = assemble("Cultist", 1.72)
    hold(['dagger', 'bowl'], [1, LAST])
    anim_ritual_slash(reach=0.24)
    export(root, "cultist_attack.glb")
    return 12


def build_cultist_zealot():
    """Cultist Zealot — the one that finished the rite: two blades, no hood."""
    reset()
    SKIN = mat("CzSkin", "b98a68", rough=0.65)
    DARK = mat("CzDark", "7c5638", rough=0.7)
    CLOTH = mat("CzCloth", "5a2a2a", rough=0.88)
    CLOTH2 = mat("CzCloth2", "24100f", rough=0.9)
    GOLD = mat("CzGold", "d8b24c", rough=0.4, metal=0.75)
    SIGIL = mat("CzSigil", "ff5c3c", rough=0.3, emit=1.5)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.04, belly=0.96, ears=False)

    group('torso')
    for s in (-1, 1):
        ico((s * 0.44, 0, 1.14), r=0.18, sub=1, scale=(1.0, 1.0, 0.55), m=CLOTH2)
    ico((0, -0.29, 1.02), r=0.075, sub=2, scale=(1.0, 0.45, 1.0), m=SIGIL)      # the brand
    for i in range(4):
        a = 2 * PI * i / 4 + PI / 4
        cube((0.155 * math.cos(a), -0.29, 1.02 + 0.155 * math.sin(a)),
             scale=(0.10, 0.035, 0.035), m=SIGIL, rot=(0, -a, 0))
    group('head')
    cyl((0, 0.01, 1.52), r=0.26, depth=0.055, verts=9, m=GOLD)                  # circlet
    for i in range(5):
        a = -0.9 + 1.8 * i / 4
        cone((0.22 * math.sin(a), 0.03 + 0.10 * math.cos(a), 1.62), r1=0.032, r2=0.0,
             depth=0.20, verts=4, m=GOLD, rot=(-0.25, 0, a * 0.6))
    cube((0, -0.245, 1.42), scale=(0.34, 0.06, 0.075), m=CLOTH2)                # blindfold

    for side, gname, arm in ((-1, 'blade_r', 'arm_r'), (1, 'blade_l', 'arm_l')):
        group(gname, pivot=(side * 0.416, 0, 1.06), parent=arm)
        cyl((side * 0.416, -0.05, 0.56), r=0.026, depth=0.16, verts=6, m=CLOTH2)
        cube((side * 0.416, -0.05, 0.66), scale=(0.16, 0.05, 0.035), m=GOLD)
        cube((side * 0.416, -0.05, 0.90), scale=(0.050, 0.022, 0.44), m=rig.STEEL)
        cone((side * 0.416, -0.05, 1.14), r1=0.036, r2=0.0, depth=0.17, verts=4, m=SIGIL)

    root = assemble("CultistZealot", 1.74)
    hold(['blade_r', 'blade_l'], [1, LAST])
    rig3.anim_triple_jab(reach=0.22, swing=1.40)
    export(root, "cultistzealot_attack.glb")
    return 13


def build_spell_knight():
    """Spell Knight — armour with a rune-lit sword; the tower's line fighter."""
    reset()
    SKIN = mat("SkSkin", "9a8f7a", rough=0.7)
    DARK = mat("SkDark", "6b6152", rough=0.72)
    CLOTH = mat("SkCloth", "44396f", rough=0.86)
    CLOTH2 = mat("SkCloth2", "1d1834", rough=0.9)
    PLATE = mat("SkPlate", "6f6796", rough=0.38, metal=0.7)
    TRIM = mat("SkTrim", "b9aee8", rough=0.3, metal=0.5)
    RUNE = mat("SkRune", "8fd0ff", rough=0.25, emit=1.6)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.10, belly=1.0, ears=False)

    group('torso')
    cube((0, -0.05, 1.00), scale=(0.60, 0.40, 0.44), m=PLATE)                   # breastplate
    cube((0, -0.28, 1.00), scale=(0.10, 0.05, 0.40), m=RUNE)                    # lit seam
    for s in (-1, 1):
        ico((s * 0.50, 0, 1.14), r=0.20, sub=1, scale=(1.0, 1.0, 0.58), m=PLATE)
    group('head')
    cone((0, 0.01, 1.48), r1=0.29, r2=0.10, depth=0.26, verts=8, m=PLATE)       # helm
    cube((0, -0.25, 1.38), scale=(0.34, 0.10, 0.10), m=CLOTH2)                  # visor slit
    cube((0, -0.25, 1.38), scale=(0.10, 0.06, 0.075), m=RUNE)
    for s in (-1, 1):
        cone((s * 0.16, 0.04, 1.68), r1=0.045, r2=0.0, depth=0.26, verts=4, m=TRIM,
             rot=(-0.20, s * 0.35, 0))

    group('legs')                                                               # greaves
    for s in (-1, 1):
        cube((s * 0.21, -0.02, 0.34), scale=(0.27, 0.30, 0.34), m=PLATE)
    for side in (-1, 1):
        group('arm_r' if side < 0 else 'arm_l')
        cube((side * 0.44, 0, 0.90), scale=(0.26, 0.26, 0.30), m=PLATE)       # vambrace
        ico((side * 0.44, -0.02, 0.62), r=0.12, sub=1, m=TRIM)             # gauntlet

    group('sword', pivot=(-0.44, 0, 1.06), parent='arm_r')
    cyl((-0.44, -0.06, 0.52), r=0.030, depth=0.22, verts=6, m=CLOTH2)
    ico((-0.44, -0.06, 0.40), r=0.048, sub=1, m=TRIM)
    cube((-0.44, -0.06, 0.66), scale=(0.30, 0.06, 0.045), m=TRIM)               # crossguard
    cube((-0.44, -0.06, 1.02), scale=(0.075, 0.028, 0.66), m=rig.STEEL)
    cube((-0.44, -0.075, 1.02), scale=(0.024, 0.030, 0.58), m=RUNE)             # the rune fuller
    cone((-0.44, -0.06, 1.42), r1=0.052, r2=0.0, depth=0.22, verts=4, m=rig.STEEL)
    group('kite', pivot=(0.44, 0, 1.06), parent='arm_l')
    cube((0.56, -0.15, 0.94), scale=(0.32, 0.07, 0.60), m=PLATE)
    cone((0.56, -0.15, 0.58), r1=0.23, r2=0.0, depth=0.24, verts=3, m=PLATE, rot=(PI, 0, 0))
    ico((0.56, -0.20, 0.98), r=0.075, sub=1, scale=(1, 0.5, 1), m=RUNE)

    root = assemble("SpellKnight", 1.90)
    hold(['sword', 'kite'], [1, LAST])
    rig3.anim_thrust(reach=0.32)
    export(root, "spellknight_attack.glb")
    return 11


def build_spell_warden():
    """Spell Warden — the knight's senior: a greatsword and a ring of wards."""
    reset()
    SKIN = mat("SwSkin", "8b8270", rough=0.7)
    DARK = mat("SwDark", "5d5548", rough=0.72)
    CLOTH = mat("SwCloth", "2f2758", rough=0.86)
    CLOTH2 = mat("SwCloth2", "14102a", rough=0.9)
    PLATE = mat("SwPlate", "4c447a", rough=0.36, metal=0.75)
    TRIM = mat("SwTrim", "9d92d8", rough=0.3, metal=0.55)
    RUNE = mat("SwRune", "b98cff", rough=0.25, emit=1.8)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.20, belly=1.06, ears=False)

    group('torso')
    cube((0, -0.06, 1.00), scale=(0.66, 0.42, 0.46), m=PLATE)
    for zz in (0.88, 1.06):
        cube((0, -0.29, zz), scale=(0.46, 0.045, 0.055), m=RUNE)
    for s in (-1, 1):
        ico((s * 0.54, 0, 1.14), r=0.23, sub=1, scale=(1.0, 1.0, 0.60), m=PLATE)
        cone((s * 0.50, 0.02, 1.38), r1=0.060, r2=0.01, depth=0.28, verts=4, m=TRIM,
             rot=(0, s * 0.40, 0))
    group('head')
    cone((0, 0.01, 1.50), r1=0.31, r2=0.11, depth=0.28, verts=8, m=PLATE)
    cube((0, -0.27, 1.40), scale=(0.36, 0.10, 0.085), m=CLOTH2)
    cube((0, -0.27, 1.40), scale=(0.22, 0.06, 0.045), m=RUNE)
    cone((0, 0.06, 1.76), r1=0.10, r2=0.02, depth=0.36, verts=5, m=TRIM, rot=(-0.45, 0, 0))

    group('legs')                                                               # greaves
    for s in (-1, 1):
        cube((s * 0.23, -0.02, 0.34), scale=(0.29, 0.30, 0.34), m=PLATE)
    for side in (-1, 1):
        group('arm_r' if side < 0 else 'arm_l')
        cube((side * 0.48, 0, 0.90), scale=(0.26, 0.26, 0.30), m=PLATE)       # vambrace
        ico((side * 0.48, -0.02, 0.62), r=0.14, sub=1, m=TRIM)             # gauntlet

    group('great', pivot=(-0.48, 0, 1.06), parent='arm_r')
    cyl((-0.48, -0.06, 0.46), r=0.034, depth=0.34, verts=6, m=CLOTH2)
    ico((-0.48, -0.06, 0.28), r=0.055, sub=1, m=TRIM)
    cube((-0.48, -0.06, 0.68), scale=(0.40, 0.07, 0.050), m=TRIM)
    cube((-0.48, -0.06, 1.14), scale=(0.10, 0.032, 0.86), m=rig.STEEL)
    cube((-0.48, -0.078, 1.14), scale=(0.032, 0.036, 0.78), m=RUNE)
    cone((-0.48, -0.06, 1.66), r1=0.068, r2=0.0, depth=0.28, verts=4, m=rig.STEEL)

    group('wards', pivot=(0, 0, 1.10))
    for i in range(5):
        a = 2 * PI * i / 5 + 0.3
        cube((0.74 * math.cos(a), -0.04, 1.10 + 0.74 * math.sin(a)),
             scale=(0.105, 0.105, 0.105), m=RUNE, rot=(0, a, 0))

    root = assemble("SpellWarden", 1.96)
    hold(['great'], [1, LAST])
    rig.anim_overhead_chop(reach=0.26, lean=0.32)
    # The wards tighten as the sword comes up and scatter when it lands.
    key('wards', 1)
    key('wards', 7, rot=(0, 0, -0.8), scale=0.62)
    key('wards', 12, rot=(0, 0, 0.9), scale=1.30)
    key('wards', 17, rot=(0, 0, 2.0), scale=0.94)
    key('wards', LAST, rot=(0, 0, 2 * PI))
    export(root, "spellwarden_attack.glb")
    return 12


def build_archmage():
    """Archmage — level 4's boss: the staff calls, the glyphs answer, the bolt returns."""
    reset()
    ROBE = mat("AmRobe", "2b1d55", rough=0.85)
    ROBED = mat("AmRobeD", "170f34", rough=0.9)
    SKIN = mat("AmSkin", "d9bfa4", rough=0.65)
    BEARD = mat("AmBeard", "e6e2f0", rough=0.8)
    EYE = mat("AmEye", "9df0ff", rough=0.2, emit=2.4)
    TRIM = mat("AmTrim", "d9b24c", rough=0.35, metal=0.8)
    GLYPH = mat("AmGlyph", "8f7fff", rough=0.3, emit=1.6, alpha=0.9)
    HOT = mat("AmHot", "e6f6ff", rough=0.25, emit=2.6)
    mage_base(ROBE, ROBED, SKIN, BEARD, EYE, TRIM, tatters=11)

    group('staff', pivot=(-0.50, -0.10, 0.78), parent='arm_r')
    cyl((-0.50, -0.10, 1.06), r=0.034, depth=1.72, verts=6, m=rig.WOOD)
    for zz in (0.52, 1.24):
        cyl((-0.50, -0.10, zz), r=0.046, depth=0.070, verts=6, m=TRIM)
    for i in range(4):                                     # the claw that holds the orb
        a = 2 * PI * i / 4 + 0.4
        cone((-0.50 + 0.085 * math.cos(a), -0.10 + 0.085 * math.sin(a), 1.86),
             r1=0.030, r2=0.0, depth=0.26, verts=4, m=TRIM,
             rot=(math.sin(a) * -0.55, math.cos(a) * 0.55, 0))
    ico((-0.50, -0.10, 1.98), r=0.115, sub=2, m=GLYPH)

    group('glyphs', pivot=(0, 0, 1.26))
    for i in range(6):
        a = 2 * PI * i / 6 + 0.2
        cone((0.82 * math.cos(a), -0.02, 1.26 + 0.82 * math.sin(a)),
             r1=0.072, r2=0.0, depth=0.32, verts=4, m=GLYPH, rot=(0, PI / 2 - a, 0))
    torus((0, 0, 1.26), major=0.80, minor=0.042, m=GLYPH, rot=(0.28, 0, 0))
    bolt(GLYPH, HOT, at=(0, -0.52, 1.26), r=0.145, spikes=6)

    root = assemble("Archmage", 2.0)
    hold(['staff'], [1, LAST])
    rig.anim_wraith_cast(sweep=1.20)
    # The wraith cast owns the body; the glyph ring and the bolt are laid over
    # it so the boss's beat is the same call-and-return the wisps run, just
    # slower and with more of it on screen.
    key('glyphs', 1)
    key('glyphs', 8, rot=(0, 0, -1.0), scale=0.58)
    key('glyphs', 13, rot=(0, 0, 0.8), scale=1.32)
    key('glyphs', 18, rot=(0, 0, 2.2), scale=0.96)
    key('glyphs', LAST, rot=(0, 0, 2 * PI))
    key('bolt', 1)
    key('bolt', 8, move=(0, 0.24, 0.10), scale=1.60)
    key('bolt', 13, move=(0, -1.35, 0.04), scale=0.78)
    key('bolt', 18, move=(0, -0.14, 0.02), scale=1.34)
    key('bolt', 21, move=(0, 0.02, 0.01), scale=0.58)
    key('bolt', LAST)
    export(root, "archmage_attack.glb")
    return 13


BUILDERS = [build_arcane_wisp, build_function_wisp, build_hex_sprite, build_hex_imp,
            build_curse_sprite, build_cultist, build_cultist_zealot, build_spell_knight,
            build_spell_warden, build_archmage]

BUILD_NAMES = {
    "build_arcane_wisp": "arcanewisp",
    "build_function_wisp": "functionwisp",
    "build_hex_sprite": "hexsprite",
    "build_hex_imp": "heximp",
    "build_curse_sprite": "cursesprite",
    "build_cultist": "cultist",
    "build_cultist_zealot": "cultistzealot",
    "build_spell_knight": "spellknight",
    "build_spell_warden": "spellwarden",
    "build_archmage": "archmage",
}


def main(preview=False):
    if not os.path.isdir(rig.OUT_MODELS):
        sys.exit("expected %s to exist — run this from a checkout of the repo" % rig.OUT_MODELS)
    rig._clear_scene()
    scene = bpy.context.scene
    scene.name = "Attack"            # export_animation_mode='SCENE' names the clip after it
    scene.render.fps = rig.FPS
    scene.frame_start, scene.frame_end = 1, LAST
    rig._common()
    if preview:
        rig.OUT_PREVIEW = OUT_PREVIEW
        os.makedirs(OUT_PREVIEW, exist_ok=True)
        rig.setup_preview()
    for build in BUILDERS:
        strike = build()
        if preview:
            name = BUILD_NAMES[build.__name__]
            rig.render_preview(name, 1)
            rig.render_preview(name + "_strike", strike)
    print("done: %d rigged models in %s" % (len(BUILDERS), rig.OUT_MODELS))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    main(preview="--preview" in argv)
