"""Build level 3's nine monsters as rigged low-poly GLB models with an attack loop.

Level 3 is the loops chapter ("สนามประลองคอมโบ"), so the cast is built around
repetition: the Loop Imp and the Goblin Skirmisher land three jabs inside the
one-second clip, and the Hydra's three heads strike one after another — a
for-loop you can watch.

Everything else follows the level 2 conventions, and this file imports the rig,
the primitives and the shared attack loops from build_monsters_level2 rather
than restating them: X-centred, base at local z=0, top at or below z=2, models
facing -Y, and one action named "Attack" over 24 frames whose first and last
poses match so it repeats cleanly.

Run it from the repo root:

    blender --background --python blender/build_monsters_level3.py
    blender --background --python blender/build_monsters_level3.py -- --preview

Writes public/monsters/<name>_attack.glb, and with --preview also renders
blender/preview/level3/<name>.png (rest) and <name>_strike.png (contact frame).
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_monsters_level2 as rig                                    # noqa: E402
from build_monsters_level2 import (                                    # noqa: E402
    LAST, PI, assemble, cone, cube, cyl, export, group, hold, ico, key, mat,
    reset, soldier_base, torus,
)

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PREVIEW = os.path.join(REPO, "blender", "preview", "level3")


# --------------------------------------------------------------------------
# shared bodies
# --------------------------------------------------------------------------
def imp_base(SKIN, DARK, HORN, MEMB, EYE, W=1.0):
    """Small winged imp: stubby legs, pot belly, bat wings, barbed tail.

    Wings and tail get their own groups so the imp can hover and flap while the
    arms do the striking.
    """
    group('legs')
    for s in (-1, 1):
        cyl((s * 0.16 * W, 0, 0.22), r=0.088 * W, depth=0.40, verts=7, m=SKIN)
        cube((s * 0.16 * W, -0.05, 0.035), scale=(0.17 * W, 0.26, 0.07), m=DARK)
        for k in (-1, 0, 1):
            cone((s * 0.16 * W + k * 0.055 * W, -0.18, 0.03), r1=0.020, depth=0.075,
                 verts=4, m=HORN, rot=(-PI / 2, 0, 0))

    group('torso', pivot=(0, 0, 0.40))
    ico((0, 0, 0.60), r=0.28, sub=2, scale=(1.10 * W, 1.02, 1.06), m=SKIN)
    ico((0, -0.10, 0.58), r=0.20, sub=2, scale=(0.90, 0.60, 1.00), m=DARK)      # pale belly
    ico((0, 0, 0.80), r=0.24, sub=2, scale=(1.22 * W, 0.92, 0.70), m=SKIN)

    group('head', pivot=(0, 0, 0.90), parent='torso')
    ico((0, -0.02, 1.02), r=0.25, sub=2, scale=(1.04, 0.96, 0.98), m=SKIN)
    for s in (-1, 1):
        cone((s * 0.31, 0.02, 1.08), r1=0.085, depth=0.28, verts=5, m=SKIN, rot=(0, s * 1.35, 0))
        cone((s * 0.12, 0.06, 1.24), r1=0.048, r2=0.0, depth=0.26, verts=4, m=HORN,
             rot=(-0.30, s * 0.30, 0))
        ico((s * 0.105, -0.195, 1.08), r=0.062, sub=2, m=rig.WHITE)
        ico((s * 0.115, -0.235, 1.08), r=0.034, sub=2, m=EYE)
    cone((0, -0.21, 1.00), r1=0.045, depth=0.13, verts=5, m=SKIN, rot=(PI / 2, 0, 0))
    cube((0, -0.195, 0.90), scale=(0.30, 0.07, 0.055), m=DARK)                  # grin
    for s in (-1, 1):
        cone((s * 0.085, -0.20, 0.885), r1=0.024, depth=0.070, verts=4, m=rig.WHITE, rot=(PI, 0, 0))

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.30 * W, 0, 0.82), parent='torso')
        cyl((side * 0.30 * W, -0.02, 0.66), r=0.058 * W, depth=0.34, verts=6, m=SKIN)
        ico((side * 0.30 * W, -0.05, 0.48), r=0.072 * W, sub=1, m=SKIN)
        for k in range(3):
            cone((side * 0.30 * W + (k - 1) * 0.042, -0.11, 0.42), r1=0.017, depth=0.13,
                 verts=4, m=HORN, rot=(PI + 0.25, 0, 0))

    for side, gname in ((-1, 'wing_r'), (1, 'wing_l')):
        group(gname, pivot=(side * 0.12, 0.12, 0.88), parent='torso')
        cone((side * 0.48, 0.26, 1.06), r1=0.46, depth=0.035, verts=3, m=MEMB,
             rot=(1.20, side * 0.50, side * 0.40))
        cone((side * 0.34, 0.20, 0.90), r1=0.30, depth=0.032, verts=3, m=MEMB,
             rot=(1.30, side * 0.40, side * 0.95))
        cyl((side * 0.38, 0.22, 1.00), r=0.020, depth=0.58, verts=5, m=DARK,
            rot=(0.35, side * 1.05, 0))
        cone((side * 0.70, 0.30, 1.28), r1=0.028, depth=0.11, verts=4, m=HORN,
             rot=(0.3, side * 1.1, 0))

    group('tail', pivot=(0, 0.22, 0.50), parent='torso')
    for i, (yy, zz, r) in enumerate(((0.30, 0.48, 0.075), (0.44, 0.42, 0.060),
                                     (0.57, 0.40, 0.046), (0.68, 0.44, 0.034))):
        ico((0, yy, zz), r=r, sub=1 if i > 1 else 2, m=SKIN)
    cone((0, 0.78, 0.50), r1=0.075, r2=0.0, depth=0.20, verts=3, m=HORN, rot=(-1.1, 0, 0))


def banshee_base(GOWN, GOWN_D, VEIL, EYE, MOUTH, RING, strands=7):
    """A floating wailing spirit: a tattered gown, streaming hair, a torn mouth.

    The pale face sits inside a dark cowl on purpose — a ghost built entirely
    out of one washed-out colour reads as a blob at dungeon size, so the value
    contrast has to come from the hood around the face rather than the face.

    The `rings` group is a small stack of tori at the mouth — the visible shape
    of the scream. Kept tight at rest and blown outward on the beat: any larger
    and they stop reading as sound and start reading as scribble over the model.
    """
    group('gown')
    cone((0, 0, 0.52), r1=0.42, r2=0.27, depth=1.04, verts=10, m=GOWN)
    for i in range(7):
        a = 2 * PI * i / 7 + 0.2
        cone((0.36 * math.cos(a), 0.36 * math.sin(a), 0.12), r1=0.070, depth=0.26,
             verts=4, m=GOWN_D, rot=(PI, 0, 0))
    for i in range(4):                                     # gown folds
        a = 2 * PI * i / 4 + 0.6
        cube((0.28 * math.cos(a), 0.28 * math.sin(a), 0.66), scale=(0.05, 0.05, 0.74),
             m=GOWN_D, rot=(0, 0, a))

    group('torso', pivot=(0, 0, 0.98))
    ico((0, 0, 1.10), r=0.28, sub=2, scale=(1.18, 0.96, 0.62), m=GOWN)
    cyl((0, 0, 1.19), r=0.25, depth=0.05, verts=10, m=GOWN_D)

    group('head', pivot=(0, 0, 1.24), parent='torso')
    cone((0, 0.05, 1.44), r1=0.30, r2=0.06, depth=0.44, verts=8, m=GOWN_D)      # cowl
    ico((0, -0.02, 1.38), r=0.235, sub=2, scale=(0.96, 0.90, 1.06), m=VEIL)
    for side in (-1, 1):
        ico((side * 0.092, -0.190, 1.45), r=0.058, sub=2, scale=(1.0, 0.7, 1.2), m=MOUTH)
        ico((side * 0.092, -0.222, 1.45), r=0.034, sub=2, m=EYE)
    ico((0, -0.165, 1.265), r=0.090, sub=2, scale=(0.85, 0.75, 1.45), m=MOUTH)  # the wail

    # Swept back and down, not up: fanned over the head the strands out-read the
    # face and the whole silhouette turns into a grey starburst.
    group('hair', pivot=(0, 0.04, 1.42), parent='head')
    for i in range(strands):
        a = -0.9 + 1.8 * i / (strands - 1)
        cone((0.23 * math.sin(a), 0.13 + 0.05 * math.cos(a), 1.37 - 0.05 * abs(a)),
             r1=0.026, r2=0.005, depth=0.50, verts=4, m=GOWN_D,
             rot=(-1.32 - 0.10 * abs(a), 0, a * 0.45))

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.24, 0, 1.12), parent='torso')
        cone((side * 0.36, -0.08, 0.92), r1=0.110, r2=0.042, depth=0.52, verts=6, m=GOWN,
             rot=(0.14, side * 0.28, 0))
        ico((side * 0.46, -0.17, 0.68), r=0.062, sub=1, m=VEIL)
        for k in range(4):
            cone((side * 0.46 + (k - 1.5) * 0.038, -0.20, 0.58), r1=0.015, depth=0.15,
                 verts=4, m=VEIL, rot=(PI + 0.22, 0, 0))

    # Solid shards fanning out of the mouth rather than rings. Thin wire circles
    # read as scribble drawn over the face at dungeon size — and worse, they sit
    # exactly where the face is, so the one readable feature loses to an effect.
    group('rings', pivot=(0, -0.20, 1.26), parent='head')
    for i in range(4):
        a = -0.62 + 1.24 * i / 3
        cone((0.15 * math.sin(a), -0.30 - 0.07 * math.cos(a), 1.26 + 0.055 * math.sin(a * 1.6)),
             r1=0.042, r2=0.0, depth=0.19, verts=3, m=RING, rot=(PI / 2, 0, a * 0.55))


def hydra_base(SCALES, BELLY, DARKR, HORN, EYE, MOUTH):
    """Three long necks on one squat body — the level 3 boss.

    Each neck and head is its own group so they can strike in sequence instead
    of together, which is the whole point of putting a hydra in the loops level.
    The necks are deliberately long and swept forward: kept short, all three
    heads sink into the body's silhouette and the thing reads as one lumpy
    animal rather than as three attackers taking turns.
    """
    group('legs')
    for s in (-1, 1):
        for yy, r in ((-0.10, 0.130), (0.40, 0.122)):
            cyl((s * 0.32, yy, 0.24), r=r, depth=0.44, verts=8, m=SCALES)
            cube((s * 0.32, yy - 0.09, 0.055), scale=(0.29, 0.33, 0.11), m=SCALES)
            for k in (-1, 0, 1):
                cone((s * 0.32 + k * 0.078, yy - 0.23, 0.05), r1=0.027, depth=0.12,
                     verts=4, m=HORN, rot=(-PI / 2, 0, 0))

    group('body', pivot=(0, 0.10, 0.58))
    ico((0, 0.12, 0.74), r=0.44, sub=2, scale=(0.98, 1.28, 0.86), m=SCALES)
    ico((0, 0.06, 0.54), r=0.32, sub=2, scale=(0.94, 1.18, 0.52), m=BELLY)
    ico((0, -0.26, 0.86), r=0.28, sub=2, scale=(1.14, 0.86, 0.86), m=SCALES)   # chest
    for yy, zz, r in ((0.52, 1.00, 0.075), (0.30, 1.06, 0.090), (0.06, 1.06, 0.082)):
        cone((0, yy, zz), r1=r, r2=0.0, depth=0.24, verts=4, m=HORN, rot=(0.30, 0, 0))

    for tag, dx0, dxd, tilt in (('a', 0.0, 0.0, 0.0),
                                ('b', -0.24, -0.155, -0.36),
                                ('c', 0.24, 0.155, 0.36)):
        nk = 'neck_' + tag
        group(nk, pivot=(dx0, -0.24, 0.98), parent='body')
        for i in range(7):                       # overlapping beads, not a string of them
            ico((dx0 + dxd * i * 0.57, -0.24 - 0.077 * i, 0.98 + 0.108 * i),
                r=0.150 - 0.0125 * i, sub=2, m=SCALES)

        hx, hy, hz = dx0 + dxd * 3.7, -0.74, 1.68
        hd = 'head_' + tag
        group(hd, pivot=(hx, hy, hz), parent=nk)
        ico((hx, hy - 0.07, hz + 0.06), r=0.170, sub=2, scale=(1.0, 1.10, 0.96), m=SCALES)
        ico((hx, hy - 0.26, hz - 0.01), r=0.108, sub=2, scale=(0.92, 1.20, 0.66), m=SCALES)
        ico((hx, hy - 0.26, hz - 0.07), r=0.090, sub=2, scale=(0.88, 1.14, 0.32), m=MOUTH)
        for s in (-1, 1):
            ico((hx + s * 0.100, hy - 0.14, hz + 0.11), r=0.052, sub=2, m=rig.WHITE)
            ico((hx + s * 0.108, hy - 0.19, hz + 0.11), r=0.032, sub=2, m=EYE)
            cone((hx + s * 0.098, hy + 0.06, hz + 0.19), r1=0.042, r2=0.0, depth=0.26,
                 verts=4, m=HORN, rot=(-0.75, 0, s * 0.28 + tilt * 0.25))
            for k in range(2):
                cone((hx + s * (0.042 + k * 0.036), hy - 0.25 - k * 0.05, hz - 0.035),
                     r1=0.017, depth=0.068, verts=4, m=rig.WHITE, rot=(PI, 0, 0))
        cone((hx, hy - 0.35, hz - 0.005), r1=0.028, r2=0.0, depth=0.10, verts=4,
             m=DARKR, rot=(-PI / 2, 0, 0))

    group('tail', pivot=(0, 0.52, 0.68), parent='body')
    for i, (yy, zz, r) in enumerate(((0.60, 0.66, 0.185), (0.79, 0.62, 0.148), (0.97, 0.66, 0.116),
                                     (1.12, 0.76, 0.086), (1.24, 0.88, 0.058))):
        ico((0, yy, zz), r=r, sub=2 if i < 3 else 1, m=SCALES)
    cone((0, 1.32, 1.00), r1=0.054, depth=0.21, verts=4, m=HORN, rot=(-0.7, 0, 0))


# --------------------------------------------------------------------------
# attack loops specific to level 3
#
# Sign convention (the one level 2 was rebuilt around): a positive X rotation
# pitches a part *forward*, toward -Y, which is the direction the model faces.
# --------------------------------------------------------------------------
def anim_thrust(weapon_arm='arm_r', off_arm='arm_l', base='legs', reach=0.34):
    """Spear work: coil back onto the rear foot, then drive the point straight out."""
    body = ['motion', base, 'torso', 'head', weapon_arm, off_arm]
    hold(body, [1])
    key('motion', 6, move=(0, 0.14, 0))
    key('torso', 6, rot=(-0.24, 0, 0))
    key('head', 6, rot=(-0.10, 0, 0))
    key(weapon_arm, 6, rot=(0.45, 0, -0.15))
    key(off_arm, 6, rot=(-0.30, 0, 0.25))
    key(base, 6, move=(0, 0.03, 0))

    key('motion', 11, move=(0, -reach, 0))
    key('torso', 11, rot=(0.30, 0, 0))
    key('head', 11, rot=(0.16, 0, 0))
    key(weapon_arm, 11, rot=(-1.58, 0, 0.10))
    key(off_arm, 11, rot=(0.40, 0, -0.30))
    key(base, 11, move=(0, -reach * 0.4, 0))

    key('motion', 16, move=(0, -reach * 0.35, 0))
    key('torso', 16, rot=(0.10, 0, 0))
    key('head', 16, rot=(0.05, 0, 0))
    key(weapon_arm, 16, rot=(-0.70, 0, 0.04))
    key(off_arm, 16, rot=(0.14, 0, -0.10))
    key(base, 16, move=(0, -reach * 0.12, 0))

    hold(body, [LAST])


def anim_triple_jab(base='legs', reach=0.20, swing=1.25):
    """Three strikes inside the one-second loop — the chapter's `for i in range(3)`.

    The arms alternate, so each jab lands on a different beat rather than the
    two of them mirroring one another the whole way through.
    """
    body = ['motion', base, 'torso', 'head', 'arm_r', 'arm_l']
    hold(body, [1])
    for n, (wind, hit) in enumerate(((3, 6), (10, 13), (17, 20))):
        lead, trail = ('arm_r', 'arm_l') if n % 2 == 0 else ('arm_l', 'arm_r')
        turn = 0.14 if n % 2 == 0 else -0.14
        key('motion', wind, move=(0, 0.07, 0), rot=(0, 0, turn))
        key('torso', wind, rot=(-0.14, 0, turn * 1.6))
        key('head', wind, rot=(-0.08, 0, turn))
        key(lead, wind, rot=(0.40, 0, 0))
        key(trail, wind, rot=(-0.30, 0, 0))
        key(base, wind, move=(0, 0.02, 0))

        key('motion', hit, move=(0, -reach, 0), rot=(0, 0, -turn))
        key('torso', hit, rot=(0.22, 0, -turn * 1.6))
        key('head', hit, rot=(0.12, 0, -turn))
        key(lead, hit, rot=(-swing, 0, 0))
        key(trail, hit, rot=(0.35, 0, 0))
        key(base, hit, move=(0, -reach * 0.35, 0))
    hold(body, [LAST])


def anim_flap(beats=((6, 0.95, -0.30), (12, -0.55, 0.34), (18, 0.40, -0.14))):
    """Wing beat and tail lash, laid over whatever the arms are doing.

    Deliberately keys nothing but the wings and the tail: the arm loop this sits
    on top of already owns the `motion` empty, and a second set of keys there
    would fight it for the lunge — on the Loop Imp it would land right on a jab
    and cancel it.
    """
    for g in ('wing_r', 'wing_l', 'tail'):
        key(g, 1)
    for f, wing, tail in beats:
        key('wing_r', f, rot=(0, wing, 0))
        key('wing_l', f, rot=(0, -wing, 0))
        key('tail', f, rot=(tail, 0, 0))
    for g in ('wing_r', 'wing_l', 'tail'):
        key(g, LAST)


def anim_scream(rise=0.16, reach=0.26, ring_peak=1.7):
    """Draw breath, throw the head forward, and let the wail out in rings."""
    body = ['motion', 'gown', 'torso', 'head', 'hair', 'arm_r', 'arm_l', 'rings']
    hold(body, [1])
    key('motion', 7, move=(0, 0.16, rise))
    key('gown', 7, rot=(-0.12, 0, 0), scale=(0.94, 0.94, 1.10))
    key('torso', 7, rot=(-0.34, 0, 0))
    key('head', 7, rot=(-0.42, 0, 0))
    key('hair', 7, rot=(-0.30, 0, 0))
    key('arm_r', 7, rot=(0.55, 0, -0.55))
    key('arm_l', 7, rot=(0.55, 0, 0.55))
    key('rings', 7, scale=0.35)

    key('motion', 12, move=(0, -reach, rise * 0.35))
    key('gown', 12, rot=(0.16, 0, 0), scale=(1.10, 1.10, 0.93))
    key('torso', 12, rot=(0.40, 0, 0))
    key('head', 12, rot=(0.34, 0, 0))
    key('hair', 12, rot=(0.46, 0, 0))
    key('arm_r', 12, rot=(-1.05, 0, 0.85))
    key('arm_l', 12, rot=(-1.05, 0, -0.85))
    key('rings', 12, scale=1.15)

    key('motion', 17, move=(0, -reach * 0.3, rise * 0.6))
    key('gown', 17, rot=(0.05, 0, 0))
    key('torso', 17, rot=(0.14, 0, 0))
    key('head', 17, rot=(0.12, 0, 0))
    key('hair', 17, rot=(0.20, 0, 0))
    key('arm_r', 17, rot=(-0.35, 0, 0.30))
    key('arm_l', 17, rot=(-0.35, 0, -0.30))
    key('rings', 17, scale=ring_peak)

    key('rings', 20, scale=0.55)
    hold(body, [LAST])


# --------------------------------------------------------------------------
# the cast
# --------------------------------------------------------------------------
def build_imp():
    """Imp — the small fast one that opens the arena."""
    reset()
    SKIN = mat("ImpSkin", "8fd35f", rough=0.6)
    DARK = mat("ImpDark", "5c9636", rough=0.7)
    HORN = mat("ImpHorn", "e8dcc2", rough=0.45)
    MEMB = mat("ImpWing", "6aa83f", rough=0.75)
    EYE = mat("ImpEye", "ff7a2f", rough=0.25, emit=0.9)
    imp_base(SKIN, DARK, HORN, MEMB, EYE)
    root = assemble("Imp", 1.52)
    rig.anim_double_swipe(reach=0.22)
    anim_flap()
    export(root, "imp_attack.glb")
    return 11


def build_loop_imp():
    """Loop Imp — the chapter's mascot: a ring of runes and three jabs per loop."""
    reset()
    SKIN = mat("LiSkin", "6fd38f", rough=0.6)
    DARK = mat("LiDark", "3f9e60", rough=0.7)
    HORN = mat("LiHorn", "e2f0d8", rough=0.45)
    MEMB = mat("LiWing", "4fb073", rough=0.75)
    EYE = mat("LiEye", "ffe14a", rough=0.25, emit=1.1)
    RUNE = mat("LiRune", "b6ff7a", rough=0.3, emit=1.3)
    imp_base(SKIN, DARK, HORN, MEMB, EYE, W=0.94)
    group('head')
    ico((0, 0.04, 1.30), r=0.045, sub=2, m=RUNE)
    group('loop', pivot=(0, 0.02, 0.78))
    torus((0, 0.02, 0.78), major=0.60, minor=0.022, m=RUNE, rot=(0.35, 0, 0))
    for i in range(3):                                   # three marks: one per jab
        a = 2 * PI * i / 3 + 0.4
        cube((0.60 * math.cos(a), 0.02 + 0.60 * math.sin(a) * 0.94, 0.78 + 0.20 * math.sin(a)),
             scale=(0.075, 0.075, 0.075), m=RUNE, rot=(0.35, 0, a))
    root = assemble("LoopImp", 1.56)
    anim_triple_jab(reach=0.19, swing=1.30)
    anim_flap(beats=((4, 0.90, -0.28), (11, -0.55, 0.30), (18, 0.50, -0.16)))
    # The rune ring ticks round a third of a turn per jab, so the loop counter
    # is visible from across the arena.
    key('loop', 1)
    for f, turn, sc in ((6, 2 * PI / 3, 1.14), (13, 4 * PI / 3, 1.14), (20, 2 * PI, 1.14)):
        key('loop', f, rot=(0, 0, turn), scale=sc)
    key('loop', LAST, rot=(0, 0, 2 * PI))
    export(root, "loopimp_attack.glb")
    return 13


def build_goblin_raider():
    """Goblin Raider — spear and buckler, the arena's line fighter."""
    reset()
    SKIN = mat("GrSkin", "d1954b", rough=0.65)
    DARK = mat("GrDark", "96662c", rough=0.7)
    CLOTH = mat("GrCloth", "6d4526", rough=0.85)
    CLOTH2 = mat("GrCloth2", "3a2413", rough=0.9)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.02, belly=0.94)

    group('head')
    cyl((0, 0.01, 1.49), r=0.30, depth=0.07, verts=9, m=rig.DARKSTEEL)          # brim helm
    cone((0, 0.01, 1.56), r1=0.24, r2=0.06, depth=0.20, verts=8, m=rig.DARKSTEEL)
    group('torso')
    cube((0, -0.02, 0.98), scale=(0.70, 0.34, 0.22), m=rig.DARKSTEEL)           # chest strap

    group('spear', pivot=(-0.408, 0, 0.62), parent='arm_r')
    cyl((-0.408, -0.05, 1.02), r=0.028, depth=1.34, verts=6, m=rig.WOOD)
    cyl((-0.408, -0.05, 1.66), r=0.042, depth=0.10, verts=6, m=rig.DARKSTEEL)
    cone((-0.408, -0.05, 1.84), r1=0.062, r2=0.0, depth=0.28, verts=4, m=rig.STEEL)
    for s in (-1, 1):
        cone((-0.408 + s * 0.05, -0.05, 1.70), r1=0.030, r2=0.0, depth=0.13, verts=3,
             m=rig.STEEL, rot=(0, s * 1.1, 0))
    group('buckler', pivot=(0.408, 0, 0.90), parent='arm_l')
    cyl((0.50, -0.13, 0.88), r=0.24, depth=0.055, verts=8, m=rig.DARKSTEEL, rot=(PI / 2, 0, 0.1))
    ico((0.50, -0.19, 0.88), r=0.075, sub=1, scale=(1, 0.5, 1), m=rig.STEEL)

    root = assemble("GoblinRaider", 1.68)
    hold(['spear', 'buckler'], [1, LAST])
    anim_thrust(reach=0.36)
    export(root, "goblinraider_attack.glb")
    return 11


def build_goblin_skirmisher():
    """Goblin Skirmisher — light, scarfed, two daggers, three hits a second."""
    reset()
    SKIN = mat("GsSkin", "d1b04b", rough=0.65)
    DARK = mat("GsDark", "9a7d24", rough=0.7)
    CLOTH = mat("GsCloth", "5d5a2c", rough=0.85)
    CLOTH2 = mat("GsCloth2", "2f2d14", rough=0.9)
    SCARF = mat("GsScarf", "b8412f", rough=0.9)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=0.90, belly=0.86)

    group('torso')
    cyl((0, 0, 1.14), r=0.26, depth=0.09, verts=9, m=SCARF)
    cone((0, 0.24, 1.02), r1=0.11, r2=0.02, depth=0.52, verts=5, m=SCARF, rot=(-0.75, 0, 0))
    group('head')
    cube((0, -0.01, 1.46), scale=(0.34, 0.33, 0.075), m=CLOTH2)                 # headwrap
    cone((0, 0.22, 1.42), r1=0.055, r2=0.01, depth=0.30, verts=4, m=SCARF, rot=(-0.9, 0, 0))

    for side, gname, arm in ((-1, 'dagger_r', 'arm_r'), (1, 'dagger_l', 'arm_l')):
        group(gname, pivot=(side * 0.36, 0, 0.62), parent=arm)
        cyl((side * 0.36, -0.05, 0.60), r=0.026, depth=0.16, verts=6, m=CLOTH2)
        cube((side * 0.36, -0.05, 0.70), scale=(0.16, 0.05, 0.04), m=rig.STEEL)
        cube((side * 0.36, -0.05, 0.90), scale=(0.055, 0.024, 0.36), m=rig.STEEL)
        cone((side * 0.36, -0.05, 1.11), r1=0.040, r2=0.0, depth=0.16, verts=4, m=rig.STEEL)

    root = assemble("GoblinSkirmisher", 1.62)
    hold(['dagger_r', 'dagger_l'], [1, LAST])
    anim_triple_jab(reach=0.22, swing=1.45)
    export(root, "goblinskirmisher_attack.glb")
    return 13


def build_goblin_vanguard():
    """Goblin Vanguard — tower shield and mace, the wall the combo has to break."""
    reset()
    SKIN = mat("GvSkin", "b17a3a", rough=0.68)
    DARK = mat("GvDark", "7a501e", rough=0.72)
    CLOTH = mat("GvCloth", "4f3a22", rough=0.88)
    CLOTH2 = mat("GvCloth2", "241a0f", rough=0.9)
    PLUME = mat("GvPlume", "b8352f", rough=0.9)
    IRON = mat("GvIron", "7e848d", rough=0.38, metal=0.65)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=1.22, belly=1.08)

    group('torso')
    cube((0, -0.06, 0.99), scale=(0.62, 0.40, 0.42), m=IRON)                    # breastplate
    for s in (-1, 1):
        ico((s * 0.48, 0, 1.12), r=0.21, sub=1, scale=(1.0, 1.0, 0.58), m=IRON)
    group('head')
    cone((0, 0.01, 1.52), r1=0.30, r2=0.09, depth=0.24, verts=8, m=IRON)
    cone((0, 0.10, 1.72), r1=0.11, r2=0.02, depth=0.40, verts=5, m=PLUME, rot=(-0.5, 0, 0))
    cube((0, -0.25, 1.42), scale=(0.36, 0.10, 0.14), m=IRON)                    # visor slit

    group('mace', pivot=(-0.488, 0, 0.62), parent='arm_r')
    cyl((-0.488, -0.05, 0.82), r=0.038, depth=0.56, verts=6, m=CLOTH2)
    ico((-0.488, -0.05, 1.18), r=0.15, sub=1, m=IRON)
    for i in range(6):
        a = 2 * PI * i / 6
        cone((-0.488 + 0.15 * math.cos(a), -0.05 + 0.15 * math.sin(a), 1.18 + (i % 2) * 0.10),
             r1=0.038, r2=0.0, depth=0.13, verts=4, m=rig.STEEL,
             rot=(math.sin(a) * -1.5, math.cos(a) * 1.5, 0))
    group('tower', pivot=(0.488, 0, 0.90), parent='arm_l')
    cube((0.62, -0.14, 0.86), scale=(0.30, 0.075, 0.84), m=IRON)
    cube((0.62, -0.19, 0.86), scale=(0.075, 0.045, 0.74), m=rig.STEEL)
    for zz in (0.54, 1.16):
        cube((0.62, -0.185, zz), scale=(0.26, 0.045, 0.075), m=rig.STEEL)

    root = assemble("GoblinVanguard", 1.82)
    hold(['mace', 'tower'], [1, LAST])
    rig.anim_overhead_chop(reach=0.24, lean=0.30)
    export(root, "goblinvanguard_attack.glb")
    return 12


def _banshee(name, filename, height, gown_hex, gown_d_hex, veil_hex, eye_hex, ring_hex,
             strands=7, ring_peak=1.5, extra=None):
    reset()
    GOWN = mat(name + "Gown", gown_hex, rough=0.85, alpha=0.92)
    GOWN_D = mat(name + "GownD", gown_d_hex, rough=0.9, alpha=0.80)
    VEIL = mat(name + "Veil", veil_hex, rough=0.8, emit=0.18, alpha=0.86)
    EYE = mat(name + "Eye", eye_hex, rough=0.2, emit=2.4)
    MOUTH = mat(name + "Mouth", "160f24", rough=0.5)
    RING = mat(name + "Ring", ring_hex, rough=0.3, emit=1.5, alpha=0.75)
    banshee_base(GOWN, GOWN_D, VEIL, EYE, MOUTH, RING, strands=strands)
    if extra:
        extra(GOWN, GOWN_D, VEIL, EYE, RING)
    root = assemble(name, height)
    anim_scream(ring_peak=ring_peak)
    export(root, filename)
    return 12


def build_banshee():
    """Banshee — the plain wail."""
    return _banshee("Banshee", "banshee_attack.glb", 1.92,
                    "b58fe8", "8a63c4", "e2d6ff", "fff4b0", "d9b6ff")


def build_wailing_banshee():
    """Wailing Banshee — heavier veil, a longer note, wider rings."""
    def extra(GOWN, GOWN_D, VEIL, EYE, RING):
        group('torso')
        cone((0, 0.16, 1.02), r1=0.36, r2=0.20, depth=0.44, verts=8, m=GOWN_D, rot=(-0.30, 0, 0))
        group('rings')
        for i in range(3):
            a = -0.5 + 1.0 * i / 2
            cone((0.24 * math.sin(a), -0.50, 1.26 + 0.09 * math.sin(a * 1.6)), r1=0.038,
                 r2=0.0, depth=0.17, verts=3, m=RING, rot=(PI / 2, 0, a * 0.55))
    return _banshee("WailingBanshee", "wailingbanshee_attack.glb", 1.96,
                    "9f7fe8", "6f52ba", "d2c4ff", "ffe08a", "c3a0ff",
                    strands=9, ring_peak=1.9, extra=extra)


def build_shrieking_banshee():
    """Shrieking Banshee — pale, crowned in shards, the scream that splits."""
    def extra(GOWN, GOWN_D, VEIL, EYE, RING):
        group('head')
        for i in range(6):
            a = -1.0 + 2.0 * i / 5
            cone((0.20 * math.sin(a), 0.04 + 0.10 * math.cos(a), 1.58), r1=0.036, r2=0.0,
                 depth=0.24, verts=4, m=RING, rot=(-0.25, 0, a * 0.6))
        group('rings')
        for j, (dy, spread) in enumerate(((-0.50, 0.26), (-0.68, 0.34))):
            for i in range(3):
                a = -0.55 + 1.1 * i / 2
                cone((spread * math.sin(a), dy, 1.26 + (0.10 + j * 0.04) * math.sin(a * 1.6)),
                     r1=0.036 - j * 0.006, r2=0.0, depth=0.16, verts=3, m=RING,
                     rot=(PI / 2, 0, a * 0.55))
    return _banshee("ShriekingBanshee", "shriekingbanshee_attack.glb", 2.0,
                    "c7a8f0", "9a7cc8", "f0e6ff", "ffffff", "e6c9ff",
                    strands=11, ring_peak=2.1, extra=extra)


def build_hydra():
    """Hydra — the boss. Three heads, three strikes, one loop."""
    reset()
    SCALES = mat("HyScale", "e0524f", rough=0.55)
    BELLY = mat("HyBelly", "f2b6a4", rough=0.6)
    DARKR = mat("HyDark", "9e2f30", rough=0.6)
    HORN = mat("HyHorn", "f0e4c8", rough=0.45)
    EYE = mat("HyEye", "ffd24a", rough=0.2, emit=1.2)
    MOUTH = mat("HyMouth", "6e1f2a", rough=0.55)
    hydra_base(SCALES, BELLY, DARKR, HORN, EYE, MOUTH)
    root = assemble("Hydra", 2.0)

    parts = ['motion', 'legs', 'body', 'tail',
             'neck_a', 'head_a', 'neck_b', 'head_b', 'neck_c', 'head_c']
    hold(parts, [1])
    # The body rocks once; the heads take turns. Each one rears on the beat
    # before it strikes, so at any moment two are coiled and one is out.
    key('motion', 6, move=(0, 0.10, 0.03))
    key('body', 6, rot=(-0.16, 0, 0))
    key('tail', 6, rot=(-0.20, 0, 0))
    key('legs', 6, move=(0, 0.02, 0))
    key('motion', 13, move=(0, -0.20, 0))
    key('body', 13, rot=(0.20, 0, 0))
    key('tail', 13, rot=(0.24, 0, 0))
    key('legs', 13, move=(0, -0.06, 0))
    key('motion', 19, move=(0, -0.06, 0.02))
    key('body', 19, rot=(0.06, 0, 0))
    key('tail', 19, rot=(0.08, 0, 0))
    key('legs', 19, move=(0, -0.02, 0))

    for i, (tag, lean) in enumerate((('b', -0.30), ('a', 0.0), ('c', 0.30))):
        nk, hd = 'neck_' + tag, 'head_' + tag
        rear, strike, back = 2 + i * 7, 5 + i * 7, 9 + i * 7
        key(nk, 1)
        key(hd, 1)
        key(nk, rear, rot=(-0.62, 0, -lean * 0.8))
        key(hd, rear, rot=(-0.35, 0, 0), scale=(1.0, 1.0, 1.18))
        key(nk, strike, rot=(0.92, 0, lean))
        key(hd, strike, rot=(0.40, 0, 0), scale=(1.0, 1.18, 0.86))
        key(nk, min(back, LAST), rot=(0.18, 0, lean * 0.3))
        key(hd, min(back, LAST), rot=(0.08, 0, 0))
        key(nk, LAST)
        key(hd, LAST)
    hold(parts, [LAST])
    export(root, "hydra_attack.glb")
    return 12


BUILDERS = [build_imp, build_loop_imp, build_goblin_raider, build_goblin_skirmisher,
            build_goblin_vanguard, build_banshee, build_wailing_banshee,
            build_shrieking_banshee, build_hydra]

BUILD_NAMES = {
    "build_imp": "imp",
    "build_loop_imp": "loopimp",
    "build_goblin_raider": "goblinraider",
    "build_goblin_skirmisher": "goblinskirmisher",
    "build_goblin_vanguard": "goblinvanguard",
    "build_banshee": "banshee",
    "build_wailing_banshee": "wailingbanshee",
    "build_shrieking_banshee": "shriekingbanshee",
    "build_hydra": "hydra",
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
