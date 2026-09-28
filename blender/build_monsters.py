"""Build level 1's nine monsters as rigged low-poly GLB models with an attack loop.

Level 1 ("ทางเดินมืด") is the first thing anyone sees, so its cast is
deliberately the plainest of the six: one clean motion each and no gimmick.
The Slime hops and lands flat, the goblins swing what they are holding, the
wraiths raise their sleeves and sweep them down, the Dragon rears and bites.
Every later level's loop is built to read *against* this one — level 3's three
jabs are only legible as a repeat because level 1 taught the single swing, and
level 6's blade coming off mid-chop only reads as a failure because the same
chop works here.

This script used to join every part into one static mesh and export with
export_animations=False; the "_attack" in the filenames was a naming convention
inherited from the 2D art, not an animation. It now follows the same
conventions as levels 2-6 and imports the rig, the primitives and the shared
attack loops from build_monsters_level2 and build_monsters_level3 rather than
restating them: each monster split into rig groups (legs, torso, head, arms,
weapon, wings, tail...), parented into a real hierarchy, with one action named
"Attack" over 24 frames whose first and last poses match so it repeats cleanly.

Footprint is unchanged: X-centred, base at local z=0, top at or below z=2 (glTF
is Y-up, Blender is Z-up — the exporter converts). A model shorter than 2 units
is *meant* to be shorter — Monster.tsx normalises against a fixed raw height of
2, so the slimes stay squat and the Dragon fills its slot. Models face -Y in
Blender, which becomes +Z in glTF: the direction the dungeon's characters face.

Run it from the repo root:

    blender --background --python blender/build_monsters.py
    blender --background --python blender/build_monsters.py -- --preview

Writes public/monsters/<name>_attack.glb, and with --preview also renders
blender/preview/level1/<name>.png (rest) and <name>_strike.png (contact frame).
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
    reset, torus, wraith_base,
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PREVIEW = os.path.join(REPO, "blender", "preview", "level1")


# --------------------------------------------------------------------------
# shared bodies
#
# The wraiths use build_monsters_level2.wraith_base outright — that function is
# this level's wraith silhouette, split for rigging, and level 2's Wraith Elite
# and Sovereign are the same body with armour bolted on. Sharing it is the
# point: the player should recognise what a Wraith Elite used to be.
# --------------------------------------------------------------------------
def slime_base(BODY, DARK, MOUTH, drips, eyes=2, W=1.0):
    """A blob in two halves: the puddle it sits in and the dome that hops.

    Splitting them is what makes the hop read. Scaled as one lump the slime
    just pulses in place; with the puddle left behind on the floor and lagging
    a few frames, the dome visibly tears itself free and lands again.
    """
    group('puddle')
    ico((0, 0, 0.13), r=0.5, sub=2, scale=(1.53 * W, 1.41 * W, 0.26), m=BODY)
    for dx, dy, r in drips:
        ico((dx * W, dy * W, 0.07), r=r, sub=1, scale=(1.5, 1.5, 0.55), m=DARK)

    group('body', pivot=(0, 0, 0.14))
    ico((0, 0, 0.59), r=0.5, sub=2, scale=(1.16 * W, 1.08 * W, 1.06), m=BODY)
    cone((0.05, 0.02, 1.12), r1=0.09, depth=0.22, verts=6, m=BODY)     # the drop on top
    ico((0, -0.50, 0.50), r=0.12, sub=2, scale=(1.6, 0.55, 0.8), m=MOUTH)
    for s in ((-1, 1) if eyes == 2 else (-1,)):
        ico((s * 0.22, -0.45, 0.74), r=0.15, sub=2, scale=(1.0, 0.8, 1.1), m=rig.WHITE)
        ico((s * 0.24, -0.55, 0.73), r=0.08, sub=2, m=rig.PUPIL)


def grunt_base(SKIN, DARK, CLOTH, CLOTH2, W=1.0, potbelly=1.0):
    """Level 1's goblin: bandy legs, pot belly, big ears, hooked nose, underbite.

    Shorter and rounder than level 2's soldier_base on purpose — these are the
    goblins the armoured ones were promoted out of, and the difference has to
    be visible in the silhouette before either of them moves.
    """
    group('legs')
    for s in (-1, 1):
        cyl((s * 0.17 * W, 0, 0.32), r=0.105 * W, depth=0.50, verts=8, m=SKIN)
        cube((s * 0.17 * W, -0.06, 0.055), scale=(0.22 * W, 0.30, 0.11), m=CLOTH2)

    group('torso', pivot=(0, 0, 0.50))
    ico((0, 0, 0.76), r=0.32, sub=2, scale=(1.14 * W * potbelly, 0.98 * potbelly, 1.02), m=SKIN)
    ico((0, 0, 0.99), r=0.30, sub=2, scale=(1.22 * W, 0.94, 0.78), m=SKIN)
    cone((0, 0, 0.54), r1=0.31 * W, r2=0.25 * W, depth=0.28, verts=9, m=CLOTH)
    cyl((0, 0, 0.66), r=0.31 * W * potbelly, depth=0.08, verts=10, m=CLOTH2)

    group('head', pivot=(0, 0, 1.08), parent='torso')
    ico((0, 0, 1.23), r=0.29, sub=2, scale=(1.02, 0.96, 1.0), m=SKIN)
    for s in (-1, 1):
        cone((s * 0.38, 0.03, 1.31), r1=0.105, depth=0.36, verts=6, m=SKIN, rot=(0, s * 1.20, 0))
    cone((0, -0.26, 1.19), r1=0.075, depth=0.22, verts=6, m=SKIN, rot=(PI / 2, 0, 0))
    for s in (-1, 1):
        ico((s * 0.125, -0.235, 1.30), r=0.058, sub=2, m=rig.WHITE)
        ico((s * 0.135, -0.275, 1.30), r=0.030, sub=2, m=rig.PUPIL)
        cone((s * 0.075, -0.215, 1.075), r1=0.028, depth=0.075, verts=4, m=rig.WHITE,
             rot=(PI, 0, 0))                                            # the underbite
    cube((0, -0.235, 1.385), scale=(0.36, 0.08, 0.06), m=DARK)          # brow

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.38 * W, 0, 0.96), parent='torso')
        cyl((side * 0.38 * W, 0, 0.78), r=0.082 * W, depth=0.40, verts=7, m=SKIN)
        ico((side * 0.38 * W, -0.02, 0.55), r=0.10 * W, sub=1, m=SKIN)


def dragon_base(SCALES, BELLY, DARKR, MEMB, HORN, EYE):
    """Level 1's boss: a young dragon, squat and wide rather than long.

    Neck, head and jaw are three nested groups so the bite arrives as one
    motion travelling up the body instead of the whole animal tipping forward.
    Deliberately smaller in every dimension than level 2's Elder Dragon, which
    is the same creature grown up — the two share a colourway and a build, and
    the second one has to read as the first one after another five levels.
    """
    group('legs')
    for s in (-1, 1):
        ico((s * 0.30, 0.10, 0.56), r=0.21, sub=2, scale=(0.95, 1.15, 1.15), m=SCALES)
        cyl((s * 0.27, -0.02, 0.28), r=0.115, depth=0.44, verts=8, m=SCALES)
        cube((s * 0.27, -0.13, 0.07), scale=(0.26, 0.38, 0.14), m=SCALES)
        for k in (-1, 0, 1):
            cone((s * 0.27 + k * 0.075, -0.31, 0.055), r1=0.030, depth=0.13, verts=4,
                 m=HORN, rot=(-PI / 2, 0, 0))

    group('body', pivot=(0, 0.06, 0.72))
    ico((0, 0.04, 0.95), r=0.40, sub=2, scale=(1.02, 1.18, 1.12), m=SCALES)
    ico((0, -0.22, 0.90), r=0.30, sub=2, scale=(0.86, 0.60, 1.15), m=BELLY)
    ico((0, -0.06, 1.22), r=0.29, sub=2, scale=(1.02, 1.02, 0.95), m=SCALES)
    for s in (-1, 1):                                       # the little forelimbs
        cyl((s * 0.30, -0.20, 1.05), r=0.062, depth=0.28, verts=6, m=SCALES,
            rot=(0.5, s * 0.35, 0))
        ico((s * 0.36, -0.30, 0.90), r=0.075, sub=1, m=SCALES)
        for k in (-1, 0, 1):
            cone((s * 0.36 + k * 0.05, -0.37, 0.87), r1=0.020, depth=0.10, verts=4,
                 m=HORN, rot=(-1.9, 0, 0))
    for yy, zz, r in ((0.22, 1.10, 0.07), (0.36, 0.94, 0.062), (0.48, 0.78, 0.05)):
        cone((0, yy, zz + 0.16), r1=r, depth=0.20, verts=4, m=HORN, rot=(0.45, 0, 0))

    group('neck', pivot=(0, -0.08, 1.30), parent='body')
    ico((0, -0.13, 1.42), r=0.20, sub=2, m=SCALES)
    ico((0, -0.21, 1.58), r=0.18, sub=2, m=SCALES)
    for yy, zz, r in ((-0.08, 1.36, 0.05), (0.06, 1.24, 0.062)):
        cone((0, yy, zz + 0.16), r1=r, depth=0.20, verts=4, m=HORN, rot=(0.45, 0, 0))

    group('head', pivot=(0, -0.26, 1.70), parent='neck')
    ico((0, -0.30, 1.73), r=0.25, sub=2, scale=(1.0, 1.10, 0.95), m=SCALES)
    ico((0, -0.55, 1.66), r=0.16, sub=2, scale=(0.95, 1.15, 0.72), m=SCALES)   # snout
    for s in (-1, 1):
        ico((s * 0.145, -0.44, 1.79), r=0.075, sub=2, scale=(1.0, 0.85, 1.0), m=rig.WHITE)
        ico((s * 0.155, -0.50, 1.79), r=0.048, sub=2, m=EYE)
        ico((s * 0.160, -0.535, 1.79), r=0.022, sub=2, scale=(0.5, 1.0, 1.4), m=rig.PUPIL)
        ico((s * 0.055, -0.70, 1.685), r=0.026, sub=1, m=DARKR)                # nostrils
        cone((s * 0.155, -0.15, 1.90), r1=0.062, depth=0.36, verts=5, m=HORN,
             rot=(-0.85, 0, s * 0.25))                                         # horns
        cone((s * 0.24, -0.30, 1.72), r1=0.075, depth=0.22, verts=4, m=MEMB,
             rot=(0, s * 1.35, 0))                                             # ear frills

    group('jaw', pivot=(0, -0.40, 1.62), parent='head')
    ico((0, -0.55, 1.585), r=0.14, sub=2, scale=(0.90, 1.10, 0.35), m=DARKR)
    for s in (-1, 1):
        cone((s * 0.085, -0.63, 1.61), r1=0.024, depth=0.075, verts=4, m=rig.WHITE,
             rot=(PI, 0, 0))

    for side, gname in ((-1, 'wing_r'), (1, 'wing_l')):
        group(gname, pivot=(side * 0.16, 0.22, 1.28), parent='body')
        cone((side * 0.62, 0.30, 1.48), r1=0.62, depth=0.045, verts=3, m=MEMB,
             rot=(1.15, side * 0.55, side * 0.35))
        cone((side * 0.44, 0.24, 1.30), r1=0.40, depth=0.04, verts=3, m=MEMB,
             rot=(1.25, side * 0.45, side * 0.9))
        cyl((side * 0.52, 0.26, 1.42), r=0.028, depth=0.80, verts=5, m=SCALES,
            rot=(0.35, side * 1.05, 0))
        cone((side * 0.92, 0.36, 1.80), r1=0.035, depth=0.14, verts=4, m=HORN,
             rot=(0.3, side * 1.1, 0))

    group('tail', pivot=(0, 0.34, 0.84), parent='body')
    for i, (yy, zz, r) in enumerate(((0.42, 0.80, 0.19), (0.62, 0.76, 0.155),
                                     (0.80, 0.80, 0.12), (0.95, 0.90, 0.09),
                                     (1.06, 1.02, 0.06))):
        ico((0, yy, zz), r=r, sub=2 if i < 3 else 1, m=SCALES)
    cone((0, 1.14, 1.13), r1=0.055, depth=0.20, verts=4, m=HORN, rot=(-0.7, 0, 0))


# --------------------------------------------------------------------------
# attack loops specific to level 1
#
# Sign convention (shared with the other five scripts): a positive X rotation
# pitches a part forward, toward -Y, which is the direction the model faces.
# --------------------------------------------------------------------------
def anim_slime_hop(reach=0.30, lift=0.26):
    """Coil, tear free of the floor, land flat, settle.

    The puddle is keyed *against* the motion empty on the way up so it stays
    near the ground while the dome rises — the two are one creature, and what
    sells that is the lag between them rather than either one on its own.
    """
    body = ['motion', 'puddle', 'body']
    hold(body, [1])

    key('motion', 6, move=(0, 0.07, -0.03))                 # coil
    key('body', 6, scale=(1.18, 1.18, 0.68))
    key('puddle', 6, scale=(1.16, 1.16, 0.78))

    key('motion', 10, move=(0, -reach * 0.55, lift))        # airborne
    key('body', 10, scale=(0.82, 0.82, 1.36))
    key('puddle', 10, move=(0, 0.05, -lift * 0.62), scale=(0.86, 0.86, 0.90))

    key('motion', 14, move=(0, -reach, 0))                  # splat
    key('body', 14, scale=(1.34, 1.34, 0.60))
    key('puddle', 14, scale=(1.30, 1.30, 0.70))

    key('motion', 19, move=(0, -reach * 0.28, 0.02))        # settle
    key('body', 19, scale=(0.94, 0.94, 1.10))
    key('puddle', 19, scale=(0.96, 0.96, 1.05))

    hold(body, [LAST])


def anim_dragon_bite(reach=0.28, rear=0.14):
    """Rear onto the back legs, beat the wings once, and bring the head down.

    The neck leads and the head follows a beat later, so the bite arrives at
    the end of a whip rather than as one rigid lunge — the only thing on this
    level with more than a single joint doing the work.
    """
    parts = ['motion', 'legs', 'body', 'neck', 'head', 'jaw', 'wing_r', 'wing_l', 'tail']
    hold(parts, [1])

    key('motion', 7, move=(0, 0.18, rear))
    key('body', 7, rot=(-0.30, 0, 0))
    key('neck', 7, rot=(-0.52, 0, 0))
    key('head', 7, rot=(-0.26, 0, 0))
    key('jaw', 7, rot=(0.80, 0, 0))                         # gaping
    key('wing_r', 7, rot=(0, 0.95, 0))
    key('wing_l', 7, rot=(0, -0.95, 0))
    key('tail', 7, rot=(-0.24, 0, 0))
    key('legs', 7, move=(0, 0.03, 0))

    key('motion', 12, move=(0, -reach, 0))
    key('body', 12, rot=(0.30, 0, 0))
    key('neck', 12, rot=(0.74, 0, 0))
    key('head', 12, rot=(0.34, 0, 0))
    key('jaw', 12, rot=(0.08, 0, 0))                        # shut on the target
    key('wing_r', 12, rot=(0, -0.42, 0))
    key('wing_l', 12, rot=(0, 0.42, 0))
    key('tail', 12, rot=(0.30, 0, 0))
    key('legs', 12, move=(0, -reach * 0.35, 0))

    key('motion', 18, move=(0, -reach * 0.28, rear * 0.25))
    key('body', 18, rot=(0.08, 0, 0))
    key('neck', 18, rot=(0.20, 0, 0))
    key('head', 18, rot=(0.10, 0, 0))
    key('jaw', 18, rot=(0.22, 0, 0))
    key('wing_r', 18, rot=(0, 0.30, 0))
    key('wing_l', 18, rot=(0, -0.30, 0))
    key('tail', 18, rot=(0.10, 0, 0))
    key('legs', 18, move=(0, -reach * 0.10, 0))

    hold(parts, [LAST])


# --------------------------------------------------------------------------
# the cast
# --------------------------------------------------------------------------
def build_slime():
    """Slime — the first monster in the game: it hops at you and lands flat."""
    reset()
    BODY = mat("SlimeBody", "6fdc4f", rough=0.35)
    DARK = mat("SlimeDark", "4aa832", rough=0.45)
    MOUTH = mat("Mouth", "7a2b33", rough=0.6)
    slime_base(BODY, DARK, MOUTH, [(-0.70, 0.12, 0.11), (0.74, -0.06, 0.09),
                                   (0.24, 0.62, 0.10), (-0.30, -0.60, 0.08)])
    root = assemble("Slime", 1.25)
    anim_slime_hop()
    export(root, "slime_attack.glb")
    return 14


def build_glitch_slime():
    """Glitch Slime — the same hop with the picture breaking up around it."""
    reset()
    BODY = mat("GlitchBody", "a233f2", rough=0.3)
    DARK = mat("GlitchDark", "5d1a99", rough=0.4)
    MOUTH = mat("GlitchMouth", "2a0f3f", rough=0.6)
    CYAN = mat("GlitchCyan", "18c4b4", rough=0.4, emit=0.25)
    PINK = mat("GlitchPink", "d92fae", rough=0.4, emit=0.22)
    slime_base(BODY, DARK, MOUTH, [(-0.70, 0.10, 0.11), (0.74, -0.06, 0.09)], eyes=1)

    group('body')
    cube((0.24, -0.46, 0.74), scale=(0.26, 0.14, 0.26), m=CYAN)     # the other eye, corrupted
    cube((0.26, -0.54, 0.74), scale=(0.12, 0.08, 0.12), m=rig.PUPIL)

    # Torn scanlines, on their own group so they can slip out of register while
    # the body hops. Discs, not boxes: a square slab's corners stick a full
    # 1.41x past the round body and read as a dinner plate, not a glitch.
    group('scan_a', pivot=(0, 0, 0.86), parent='body')
    cyl((0.075, 0.04, 0.86), r=0.435, depth=0.05, verts=10, m=CYAN)
    group('scan_b', pivot=(0, 0, 0.44), parent='body')
    cyl((-0.085, -0.03, 0.44), r=0.575, depth=0.042, verts=10, m=PINK)

    group('bits', pivot=(0, -0.10, 0.70), parent='body')
    for loc, sc, mm, rot in (((0.78, -0.16, 1.02), 0.14, CYAN, (0.4, 0.3, 0.2)),
                             ((-0.84, -0.04, 0.62), 0.11, PINK, (0.2, 0.6, 0.1)),
                             ((0.54, -0.36, 0.14), 0.09, CYAN, (0.9, 0.2, 0.5)),
                             ((-0.32, -0.24, 1.22), 0.08, PINK, (0.3, 0.8, 0.4))):
        cube(loc, scale=(sc, sc, sc), m=mm, rot=rot)

    root = assemble("GlitchSlime", 1.32)
    anim_slime_hop(reach=0.28, lift=0.28)
    # The scanlines slide sideways a frame at a time instead of following the
    # squash, which is the whole difference between this and the plain slime.
    for g, amt in (('scan_a', 0.16), ('scan_b', -0.13)):
        key(g, 1)
        key(g, 6, move=(amt, 0, 0))
        key(g, 10, move=(-amt * 0.8, 0, 0.03))
        key(g, 14, move=(amt * 1.2, 0, -0.02))
        key(g, 19, move=(-amt * 0.4, 0, 0))
        key(g, LAST)
    key('bits', 1)
    key('bits', 10, rot=(0, 0, 0.7), scale=1.30)
    key('bits', 14, rot=(0, 0, -0.5), scale=0.72)
    key('bits', 19, rot=(0, 0, 0.3), scale=1.08)
    key('bits', LAST)
    export(root, "glitchslime_attack.glb")
    return 14


def build_goblin():
    """Goblin — a rusty knife and an overhead swing: the game's plainest attack."""
    reset()
    SKIN = mat("GoblinSkin", "8fc23f", rough=0.65)
    DARK = mat("GoblinDark", "5e8a24", rough=0.7)
    CLOTH = mat("GoblinCloth", "8a5a32", rough=0.85)
    CLOTH2 = mat("GoblinCloth2", "4a3120", rough=0.9)
    grunt_base(SKIN, DARK, CLOTH, CLOTH2)

    group('knife', pivot=(-0.38, 0, 0.96), parent='arm_r')
    cyl((-0.46, -0.10, 0.44), r=0.034, depth=0.20, verts=6, m=CLOTH2)
    cube((-0.46, -0.10, 0.555), scale=(0.17, 0.06, 0.040), m=rig.STEEL)
    cone((-0.46, -0.10, 0.78), r1=0.072, r2=0.010, depth=0.44, verts=4, m=rig.STEEL)

    root = assemble("Goblin", 1.58)
    hold(['knife'], [1, LAST])
    rig.anim_overhead_chop(reach=0.22, lean=0.28)
    export(root, "goblin_attack.glb")
    return 12


def build_goblin_scout():
    """Goblin Scout — hooded, with a shortbow: draws, looses, and lowers it."""
    reset()
    SKIN = mat("ScoutSkin", "a8d95e", rough=0.65)
    DARK = mat("ScoutDark", "6f9c33", rough=0.7)
    CLOTH = mat("ScoutCloth", "4f6b33", rough=0.85)
    CLOTH2 = mat("ScoutCloth2", "33452a", rough=0.9)
    WOOD = mat("ScoutWood", "6b4a2a", rough=0.9)
    STRING = mat("Bowstring", "d8cfae", rough=0.9)
    grunt_base(SKIN, DARK, CLOTH, CLOTH2, W=0.88, potbelly=0.90)

    group('head')
    cone((0, 0.02, 1.40), r1=0.34, r2=0.05, depth=0.34, verts=8, m=CLOTH)           # hood
    cone((0, 0.30, 1.30), r1=0.13, depth=0.34, verts=6, m=CLOTH, rot=(-0.9, 0, 0))  # hood tail
    group('torso')
    cyl((0.05, 0.20, 0.95), r=0.10, depth=0.44, verts=8, m=CLOTH2, rot=(0.25, 0.2, 0))
    for dx in (-0.03, 0.02, 0.07):                                                  # quiver
        cyl((0.05 + dx, 0.22, 1.24), r=0.012, depth=0.26, verts=4, m=WOOD,
            rot=(0.25, 0.2, 0))

    # The bow rides the left hand; the right hand draws. The arrow is its own
    # group hanging off the motion empty so it can leave on the release.
    group('bow', pivot=(0.334, 0, 0.96), parent='arm_l')
    torus((0.52, -0.30, 0.74), major=0.34, minor=0.026, m=WOOD, rot=(0, PI / 2, 0.18))
    cube((0.52, -0.30, 0.74), scale=(0.014, 0.014, 0.66), m=STRING)
    group('arrow', pivot=(0.52, -0.30, 0.74))
    cyl((0.52, -0.30, 0.74), r=0.013, depth=0.58, verts=4, m=WOOD, rot=(PI / 2, 0, 0))
    cone((0.52, -0.61, 0.74), r1=0.032, r2=0.0, depth=0.10, verts=4, m=rig.STEEL,
         rot=(-PI / 2, 0, 0))
    for s in (-1, 1):
        cube((0.52 + s * 0.024, -0.03, 0.74), scale=(0.010, 0.11, 0.085), m=STRING,
             rot=(0, 0, s * 0.3))

    root = assemble("GoblinScout", 1.60)
    hold(['bow'], [1, LAST])
    # Draw on 8, loose on 12, lower the bow by 18 — an archer's beat laid over
    # the same lunge the other two goblins use, so the level still reads as one
    # cast rather than three unrelated animations.
    body = ['motion', 'legs', 'torso', 'head', 'arm_r', 'arm_l', 'arrow']
    hold(body, [1])
    key('motion', 8, move=(0, 0.09, 0))
    key('torso', 8, rot=(-0.14, 0, -0.26))
    key('head', 8, rot=(-0.06, 0, 0.16))
    key('arm_l', 8, rot=(-1.30, 0, -0.18))                  # bow arm out
    key('arm_r', 8, rot=(-1.05, 0, 0.75))                   # string hand back
    key('arrow', 8, move=(0, 0.20, 0))
    key('legs', 8, move=(0, 0.02, 0))

    key('motion', 12, move=(0, -0.16, 0))
    key('torso', 12, rot=(0.12, 0, -0.14))
    key('head', 12, rot=(0.08, 0, 0.08))
    key('arm_l', 12, rot=(-1.36, 0, -0.10))
    key('arm_r', 12, rot=(-0.55, 0, 0.30))
    key('arrow', 12, move=(0, -1.15, 0.03))                 # loosed
    key('legs', 12, move=(0, -0.05, 0))

    key('arrow', 13, move=(0, -1.15, 0.03), scale=0.001)    # gone, before it can be seen returning
    key('arrow', 19, move=(0, 0.24, 0), scale=0.001)
    key('arrow', 21, move=(0, 0.20, 0))                     # a fresh one nocked

    key('motion', 18, move=(0, -0.04, 0))
    key('torso', 18, rot=(0.04, 0, -0.04))
    key('head', 18, rot=(0.02, 0, 0))
    key('arm_l', 18, rot=(-0.45, 0, -0.04))
    key('arm_r', 18, rot=(-0.18, 0, 0.10))
    key('legs', 18, move=(0, -0.01, 0))
    hold(body, [LAST])
    export(root, "goblinscout_attack.glb")
    return 12


def build_goblin_brute():
    """Goblin Brute — the big one: a spiked club brought down with its whole weight."""
    reset()
    SKIN = mat("BruteSkin", "3a7a26", rough=0.7)
    DARK = mat("BruteDark", "24521a", rough=0.75)
    CLOTH = mat("BruteCloth", "5a3320", rough=0.9)
    CLOTH2 = mat("BruteCloth2", "2e1c12", rough=0.9)
    IRON = mat("BruteIron", "6e727a", rough=0.45, metal=0.6)
    grunt_base(SKIN, DARK, CLOTH, CLOTH2, W=1.30, potbelly=1.18)

    group('head')
    for s in (-1, 1):
        cone((s * 0.10, -0.22, 1.10), r1=0.036, depth=0.16, verts=4, m=rig.WHITE,
             rot=(-0.25, 0, 0))                             # tusks
    group('torso')
    for s in (-1, 1):
        ico((s * 0.50, 0, 1.06), r=0.19, sub=1, scale=(1.0, 1.0, 0.62), m=IRON)

    group('club', pivot=(-0.494, 0, 0.96), parent='arm_r')
    cyl((-0.55, -0.10, 0.60), r=0.045, depth=0.62, verts=7, m=CLOTH, rot=(0.20, 0, 0))
    ico((-0.55, -0.22, 1.00), r=0.17, sub=1, scale=(1.0, 1.0, 1.25), m=CLOTH2)
    for a_i in range(4):
        ang = a_i * PI / 2 + 0.4
        cone((-0.55 + 0.17 * math.cos(ang), -0.22 + 0.17 * math.sin(ang), 1.02),
             r1=0.035, depth=0.14, verts=4, m=IRON,
             rot=(math.sin(ang) * -1.4, math.cos(ang) * 1.4, 0))

    root = assemble("GoblinBrute", 1.85)
    hold(['club'], [1, LAST])
    rig.anim_overhead_chop(reach=0.28, lean=0.40)
    export(root, "goblinbrute_attack.glb")
    return 12


def build_wraith():
    """Wraith — raises both sleeves and sweeps them down: the caster's release."""
    reset()
    wraith_base(mat("WraithRobe", "8a6fd1", rough=0.85),
                mat("WraithRobeD", "5c48a0", rough=0.9),
                mat("WraithVoid", "1a1626", rough=0.6),
                mat("WraithEye", "e8dcff", rough=0.2, emit=2.2))
    root = assemble("Wraith", 1.92)
    rig.anim_wraith_cast(sweep=1.10)
    export(root, "wraith_attack.glb")
    return 13


def build_null_wraith():
    """Null Wraith — a wraith with holes in it; the broken halo turns as it casts."""
    reset()
    # Kept lighter than its #3a3a42 tint would suggest: at the tint's own value
    # the whole model collapses into one unreadable silhouette in the dungeon.
    ROBE = mat("NullRobe", "4a4a58", rough=0.85)
    ROBED = mat("NullRobeD", "2c2c36", rough=0.9)
    VOID = mat("NullVoid", "0b0b11", rough=0.5)
    EYE = mat("NullEye", "ff2233", rough=0.25, emit=0.9)   # >1 emission blows out to white
    EDGE = mat("NullEdge", "7d7d90", rough=0.7)
    wraith_base(ROBE, ROBED, VOID, EYE, tatters=9)

    group('torso')
    cyl((0, 0.02, 1.235), r=0.315, depth=0.05, verts=10, m=EDGE)
    group('nulls', pivot=(0, -0.02, 1.10), parent='torso')
    for loc, sc, rot in (((0.50, -0.18, 1.26), 0.085, (0.4, 0.3, 0.2)),
                         ((-0.54, -0.10, 1.02), 0.070, (0.2, 0.6, 0.1)),
                         ((0.42, -0.24, 0.50), 0.055, (0.9, 0.2, 0.5)),
                         ((-0.40, -0.20, 1.62), 0.050, (0.3, 0.8, 0.4)),
                         ((0.30, 0.26, 1.50), 0.060, (0.7, 0.1, 0.9))):
        cube(loc, scale=(sc, sc, sc), m=EDGE, rot=rot)

    group('halo', pivot=(0, 0.03, 1.66), parent='head')
    for i in range(8):
        if i == 3:
            continue                      # the gap is what makes it a *broken* halo
        a = 2 * PI * i / 8
        cube((0.26 * math.cos(a), 0.26 * math.sin(a) + 0.03, 1.66),
             scale=(0.085, 0.030, 0.030), m=EYE, rot=(0, 0, a))

    root = assemble("NullWraith", 1.98)
    rig.anim_wraith_cast(sweep=1.15)
    key('nulls', 1)
    key('nulls', 8, rot=(0, 0, -0.5), scale=1.22)
    key('nulls', 13, rot=(0, 0, 0.4), scale=0.68)
    key('nulls', 18, rot=(0, 0, 0.9), scale=1.05)
    key('nulls', LAST)
    key('halo', 1)
    key('halo', 8, rot=(0, 0, 1.1))
    key('halo', 13, rot=(0, 0, 3.0))
    key('halo', 18, rot=(0, 0, 4.8))
    key('halo', LAST, rot=(0, 0, 2 * PI))
    export(root, "nullwraith_attack.glb")
    return 13


def build_echo_wraith():
    """Echo Wraith — two after-images that repeat the cast a few frames late.

    The lag is the character. Keyed in step with the body the copies read as
    one fat wraith; a few frames behind, they read as the same wraith arriving
    three times.
    """
    reset()
    GH1 = mat("EchoGhost1", "5f9bff", rough=0.9, emit=0.35, alpha=0.34)
    GH2 = mat("EchoGhost2", "5f9bff", rough=0.9, emit=0.30, alpha=0.18)
    wraith_base(mat("EchoRobe", "3a6bd1", rough=0.85),
                mat("EchoRobeD", "27488f", rough=0.9),
                mat("EchoVoid", "0d1730", rough=0.55),
                mat("EchoEye", "9fe8ff", rough=0.2, emit=2.4))

    for gname, (dx, dy, sc, mm) in (('echo_a', (0.30, 0.26, 0.92, GH1)),
                                    ('echo_b', (0.56, 0.50, 0.82, GH2))):
        group(gname, pivot=(dx, dy, 0.90))
        cone((dx, dy, 0.62 * sc), r1=0.46 * sc, r2=0.30 * sc, depth=1.12 * sc, verts=8, m=mm)
        ico((dx, dy, 1.16 * sc), r=0.30 * sc, sub=1, scale=(1.18, 1.06, 0.55), m=mm)
        cone((dx, dy + 0.03, 1.44 * sc), r1=0.30 * sc, r2=0.055, depth=0.46 * sc,
             verts=6, m=mm)

    root = assemble("EchoWraith", 1.92)
    rig.anim_wraith_cast(sweep=1.20)
    for gname, lag, amt in (('echo_a', 3, 0.80), ('echo_b', 6, 0.62)):
        key(gname, 1)
        key(gname, min(8 + lag, LAST), move=(0, 0.06 * amt, 0.12 * amt), rot=(-0.18 * amt, 0, 0))
        key(gname, min(13 + lag, LAST), move=(0, -0.20 * amt, -0.02), rot=(0.30 * amt, 0, 0))
        key(gname, min(18 + lag, LAST), move=(0, -0.05 * amt, 0.05 * amt), rot=(0.08 * amt, 0, 0))
        key(gname, LAST)
    export(root, "echowraith_attack.glb")
    return 13


def build_dragon():
    """Dragon — level 1's boss: rears, beats its wings once, and bites."""
    reset()
    SCALES = mat("DragonScale", "e05263", rough=0.55)
    BELLY = mat("DragonBelly", "f2b39c", rough=0.6)
    DARKR = mat("DragonDark", "9e2f42", rough=0.6)
    MEMB = mat("DragonWing", "b8455a", rough=0.7)
    HORN = mat("DragonHorn", "efe0c2", rough=0.45)
    EYE = mat("DragonEye", "ffd24a", rough=0.2, emit=1.1)
    dragon_base(SCALES, BELLY, DARKR, MEMB, HORN, EYE)
    root = assemble("Dragon", 1.98)
    anim_dragon_bite()
    export(root, "dragon_attack.glb")
    return 12


BUILDERS = [build_slime, build_glitch_slime, build_null_wraith, build_goblin,
            build_goblin_scout, build_goblin_brute, build_wraith, build_echo_wraith,
            build_dragon]

BUILD_NAMES = {
    "build_slime": "slime",
    "build_glitch_slime": "glitchslime",
    "build_null_wraith": "nullwraith",
    "build_goblin": "goblin",
    "build_goblin_scout": "goblinscout",
    "build_goblin_brute": "goblinbrute",
    "build_wraith": "wraith",
    "build_echo_wraith": "echowraith",
    "build_dragon": "dragon",
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
