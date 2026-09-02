"""Build level 6's ten monsters as rigged low-poly GLB models with an attack loop.

Level 6 is the error-handling chapter ("ห้วงพังทลาย"), and every monster in it
performs the same thing the chapter teaches: the attack goes wrong on purpose.
Something breaks off at the moment of contact — a chest plate, a blade, a
misfired bolt, a whole run of the wyrm's spine — and then snaps back into place
before the loop ends. The raise and the catch, once a second, on every monster
in the room.

That is also why the models are built at all: level 6's monsters shipped as flat
PNG sprites with no modelUrl. The PNGs stay as each monster's imageUrl, because
the combat screen is plain HTML and can only show an <img>.

Everything else follows the level 2 conventions, and this file imports the rig,
the primitives and the shared attack loops from the earlier scripts rather than
restating them: X-centred, base at local z=0, top at or below z=2, models facing
-Y, and one action named "Attack" over 24 frames whose first and last poses match
so it repeats cleanly. The three wisps reuse level 4's wisp body outright — they
are meant to read as the tower's wisps after something went wrong with them.

Run it from the repo root:

    blender --background --python blender/build_monsters_level6.py
    blender --background --python blender/build_monsters_level6.py -- --preview

Writes public/monsters/<name>_attack.glb, and with --preview also renders
blender/preview/level6/<name>.png (rest) and <name>_strike.png (contact frame).
"""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_monsters_level2 as rig                                    # noqa: E402
import build_monsters_level3 as rig3                                   # noqa: E402
import build_monsters_level4 as rig4                                   # noqa: E402
from build_monsters_level2 import (                                    # noqa: E402
    LAST, PI, assemble, cone, cube, cyl, export, group, hold, ico, key, mat,
    reset, soldier_base, torus,
)
from build_monsters_level4 import bolt, wisp_base                      # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PREVIEW = os.path.join(REPO, "blender", "preview", "level6")


# --------------------------------------------------------------------------
# shared bodies
# --------------------------------------------------------------------------
def wreck_base(STONE, STONE_D, CRACK, IRON, EYE, W=1.0):
    """A stone golem that has already come apart once and been put back badly.

    The lit core sits in the torso and the plate that covers it is its own
    group, so the plate can fly off on the beat and show what is underneath.
    Nothing else in the silhouette explains where the light comes from, which
    is what makes the break read as a break rather than as a pose.
    """
    group('legs')
    for s in (-1, 1):
        cyl((s * 0.26 * W, 0, 0.32), r=0.155 * W, depth=0.60, verts=7, m=STONE)
        cube((s * 0.26 * W, -0.05, 0.055), scale=(0.38 * W, 0.46, 0.11), m=STONE_D)
        for k in (-1, 1):                                   # cracks running up the shins
            cube((s * 0.26 * W + k * 0.105 * W, -0.140, 0.34), scale=(0.022, 0.05, 0.26),
                 m=CRACK, rot=(0, k * 0.12, 0))

    group('torso', pivot=(0, 0, 0.66))
    ico((0, 0, 0.94), r=0.40, sub=2, scale=(1.20 * W, 0.92, 0.94), m=STONE)
    ico((0, 0, 1.18), r=0.34, sub=2, scale=(1.42 * W, 0.86, 0.66), m=STONE)
    ico((0, -0.14, 0.98), r=0.20, sub=2, m=EYE)             # the core, normally hidden
    cyl((0, 0, 0.68), r=0.36 * W, depth=0.09, verts=9, m=IRON)

    group('chest', pivot=(0, -0.16, 0.98), parent='torso')
    cube((0, -0.28, 1.00), scale=(0.62 * W, 0.12, 0.56), m=STONE_D)
    cube((0, -0.35, 1.00), scale=(0.055, 0.045, 0.42), m=CRACK)         # the seam it splits on
    for s in (-1, 1):
        cube((s * 0.26 * W, -0.34, 1.00), scale=(0.075, 0.055, 0.22), m=IRON)

    group('head', pivot=(0, 0, 1.34), parent='torso')
    ico((0, 0, 1.48), r=0.26, sub=2, scale=(1.06, 0.98, 0.98), m=STONE)
    cube((0, -0.20, 1.48), scale=(0.38, 0.10, 0.20), m=STONE_D)         # the brow
    for s in (-1, 1):
        ico((s * 0.115, -0.245, 1.46), r=0.052, sub=2, m=EYE)
    cone((0, 0.06, 1.70), r1=0.14, r2=0.0, depth=0.26, verts=4, m=STONE_D, rot=(-0.35, 0, 0.4))
    cube((0, 0.02, 1.34), scale=(0.30, 0.28, 0.075), m=IRON)

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.56 * W, 0, 1.16), parent='torso')
        cyl((side * 0.56 * W, 0, 0.94), r=0.125 * W, depth=0.46, verts=7, m=STONE)
        cube((side * 0.56 * W, -0.105, 0.86), scale=(0.028, 0.05, 0.24), m=CRACK)
        ico((side * 0.58 * W, -0.04, 0.62), r=0.185 * W, sub=1, m=STONE_D)
        cyl((side * 0.56 * W, 0, 1.16), r=0.20 * W, depth=0.11, verts=8, m=IRON,
            rot=(PI / 2, 0, 0))

    # The pieces it never got back: held in place at rest, thrown wide on the beat.
    group('debris', pivot=(0, 0, 1.00), parent='torso')
    for i in range(6):
        a = 2 * PI * i / 6 + 0.4
        ico((0.66 * math.cos(a), -0.06, 1.00 + 0.66 * math.sin(a)),
            r=0.10 - 0.018 * (i % 3), sub=1,
            scale=(1.0, 0.7, 1.0), m=(STONE_D if i % 2 else STONE))


def trap_base(IRON, IRON_D, RUST, TOOTH, EYE, W=1.0, teeth=5):
    """A sprung trap that got up and walked: coil legs, a hinged jaw for a head.

    The two jaws are separate groups hinged on the same pivot, so the bite is a
    real open-and-shut rather than a mouth that scales. Its eyes sit on the
    hinge block behind them and stay put while the jaws move — otherwise the
    face travels with the bite and the whole thing reads as a wobbling box.
    """
    group('legs')
    for s in (-1, 1):
        for k in range(3):                                   # a coil spring per leg
            torus((s * 0.20 * W, 0, 0.08 + k * 0.105), major=0.10 * W, minor=0.028,
                  m=IRON_D, rot=(0.12, 0, 0))
        cube((s * 0.20 * W, -0.04, 0.030), scale=(0.26 * W, 0.34, 0.06), m=IRON)
        for k in (-1, 1):
            cone((s * 0.20 * W + k * 0.075 * W, -0.20, 0.03), r1=0.026, depth=0.10,
                 verts=4, m=TOOTH, rot=(-PI / 2, 0, 0))

    group('torso', pivot=(0, 0, 0.40))
    cyl((0, 0, 0.52), r=0.30 * W, depth=0.16, verts=8, m=IRON)          # the base plate
    torus((0, 0, 0.62), major=0.26 * W, minor=0.038, m=RUST, rot=(0, 0, 0))
    cube((0, 0.02, 0.74), scale=(0.34 * W, 0.26, 0.20), m=IRON_D)       # the hinge block
    for s in (-1, 1):
        ico((s * 0.115, -0.135, 0.80), r=0.062, sub=2, m=EYE)

    for sign, gname in ((1, 'jaw_up'), (-1, 'jaw_dn')):
        group(gname, pivot=(0, -0.06, 0.76), parent='torso')
        cone((0, -0.34, 0.76 + sign * 0.115), r1=0.30 * W, r2=0.20 * W, depth=0.10,
             verts=8, m=IRON, rot=(PI / 2, 0, 0))
        cyl((0, -0.50, 0.76 + sign * 0.135), r=0.055, depth=0.36 * W, verts=6, m=IRON_D,
            rot=(0, PI / 2, 0))
        for i in range(teeth):
            t = (i / (teeth - 1)) * 2 - 1
            cone((t * 0.20 * W, -0.50, 0.76 + sign * 0.075), r1=0.045, r2=0.0, depth=0.24,
                 verts=4, m=TOOTH, rot=(sign * PI / 2, 0, 0))

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.30 * W, 0.02, 0.66), parent='torso')
        cyl((side * 0.34 * W, -0.02, 0.52), r=0.045, depth=0.34, verts=6, m=IRON_D,
            rot=(0.2, side * 0.25, 0))
        ico((side * 0.40 * W, -0.10, 0.36), r=0.075, sub=1, m=IRON)
        for k in range(3):
            cone((side * 0.40 * W + (k - 1) * 0.045, -0.16, 0.28), r1=0.018, depth=0.14,
                 verts=4, m=TOOTH, rot=(PI + 0.2, 0, 0))

    group('chain', pivot=(0, 0.22, 0.50), parent='torso')
    for i in range(5):
        torus((0, 0.30 + i * 0.155, 0.44 - i * 0.075), major=0.070, minor=0.020, m=RUST,
              rot=(PI / 2, (i % 2) * PI / 2, 0))
    cone((0, 1.10, 0.10), r1=0.11, r2=0.0, depth=0.24, verts=5, m=IRON_D, rot=(-1.2, 0, 0))


# --------------------------------------------------------------------------
# attack loops specific to level 6
#
# Every one of them is the same shape: the swing lands, something comes off,
# and it is back where it started before frame 24 — a raise and a catch inside
# one loop.
# --------------------------------------------------------------------------
def anim_fracture(parts, hit=12, peak=15, back=20):
    """Throw pieces loose at the contact frame and pull them home again.

    `parts` is a sequence of (group, move, rot) — the pose the piece flies to.
    Only ever used on groups the base attack loop does not key, so the two do
    not fight over the same channels.
    """
    for g, mv, rt in parts:
        key(g, 1)
        key(g, hit - 2)
        key(g, hit, move=tuple(v * 0.42 for v in mv), rot=tuple(v * 0.42 for v in rt))
        key(g, peak, move=mv, rot=rt)
        key(g, back)
        key(g, LAST)


def anim_stutter(groups, frames=(13, 14, 16), amount=0.06):
    """A one-frame judder on the follow-through: the thing that went wrong.

    Alternating sign frame to frame, so it reads as a signal dropping out
    rather than as a second, slower motion.
    """
    for g in groups:
        for i, f in enumerate(frames):
            s = 1 if i % 2 == 0 else -1
            key(g, f, move=(s * amount, 0, -s * amount * 0.6),
                rot=(0, 0, s * amount * 1.6))


def anim_bite(base='legs', gape=0.85, reach=0.26, jam=0.30):
    """Trap work: gape wide, snap shut, jam half-open, then force itself closed.

    The jam is the point — a bite that simply closes is a crocodile; a bite that
    closes, fails, and has to be closed again is this chapter's monster.
    """
    body = ['motion', base, 'torso', 'jaw_up', 'jaw_dn', 'arm_r', 'arm_l']
    hold(body, [1])
    key('motion', 6, move=(0, 0.13, 0.04))
    key('torso', 6, rot=(-0.22, 0, 0))
    key('jaw_up', 6, rot=(-gape, 0, 0))
    key('jaw_dn', 6, rot=(gape * 0.85, 0, 0))
    key('arm_r', 6, rot=(0.55, 0, -0.35))
    key('arm_l', 6, rot=(0.55, 0, 0.35))
    key(base, 6, move=(0, 0.03, 0))

    key('motion', 11, move=(0, -reach, 0))
    key('torso', 11, rot=(0.30, 0, 0))
    key('jaw_up', 11, rot=(0.12, 0, 0))
    key('jaw_dn', 11, rot=(-0.10, 0, 0))
    key('arm_r', 11, rot=(-0.70, 0, 0.45))
    key('arm_l', 11, rot=(-0.70, 0, -0.45))
    key(base, 11, move=(0, -reach * 0.35, 0))

    key('jaw_up', 14, rot=(-jam, 0, 0.09))                  # it does not stay shut
    key('jaw_dn', 14, rot=(jam * 0.9, 0, -0.09))
    key('torso', 14, rot=(0.16, 0, 0.06))

    key('motion', 18, move=(0, -reach * 0.28, 0.02))
    key('torso', 18, rot=(0.08, 0, 0))
    key('jaw_up', 18, rot=(0.04, 0, 0))                     # forced closed on the second try
    key('jaw_dn', 18, rot=(-0.03, 0, 0))
    key('arm_r', 18, rot=(-0.22, 0, 0.16))
    key('arm_l', 18, rot=(-0.22, 0, -0.16))
    key(base, 18, move=(0, -reach * 0.10, 0))
    hold(body, [LAST])


def anim_misfire(base='trail', torso='body', reach=0.18, throw=1.05, rise=0.06, extra=()):
    """The level 4 cast, gone wrong: the bolt leaves and does not come back clean.

    Level 4's wisps throw and catch on 11 and 17 — a call that returns. This one
    throws on 11, loses the bolt behind itself on 15, and has to haul it back
    into the hands by 20. Same beat, failed.
    """
    parts = ['motion', base, torso, 'arm_r', 'arm_l', 'bolt'] + list(extra)
    hold(parts, [1])

    key('motion', 6, move=(0, 0.12, rise))
    key(torso, 6, rot=(-0.26, 0, 0))
    key('arm_r', 6, rot=(0.90, 0, -0.42))
    key('arm_l', 6, rot=(0.90, 0, 0.42))
    key(base, 6, move=(0, 0.03, 0))
    key('bolt', 6, move=(0, 0.22, 0.04), scale=1.55)

    key('motion', 11, move=(0, -reach, rise * 0.3))
    key(torso, 11, rot=(0.34, 0, 0))
    key('arm_r', 11, rot=(-0.85, 0, 0.60))
    key('arm_l', 11, rot=(-0.85, 0, -0.60))
    key(base, 11, move=(0, -reach * 0.35, 0))
    key('bolt', 11, move=(0, -throw, 0.06), scale=0.80)

    # the throw fails: it snaps back past the caster instead of into its hands
    key('motion', 15, move=(0, 0.10, rise * 0.2), rot=(0, 0, 0.10))
    key(torso, 15, rot=(-0.20, 0, 0.14))
    key('arm_r', 15, rot=(0.30, 0, -0.20))
    key('arm_l', 15, rot=(0.30, 0, 0.20))
    key('bolt', 15, move=(0, 0.62, -0.10), scale=1.45)

    key('motion', 20, move=(0, -0.04, rise * 0.5), rot=(0, 0, -0.04))
    key(torso, 20, rot=(0.10, 0, -0.05))
    key('arm_r', 20, rot=(-0.20, 0, 0.22))
    key('arm_l', 20, rot=(-0.20, 0, -0.22))
    key(base, 20, move=(0, -0.03, 0))
    key('bolt', 20, move=(0, 0.02, 0.01), scale=0.62)       # caught, barely
    hold(parts, [LAST])


# --------------------------------------------------------------------------
# the cast
# --------------------------------------------------------------------------
def _trap(name, filename, height, iron, iron_d, rust, tooth, eye, W=1.0, teeth=5,
          gape=0.85, extra=None):
    reset()
    IRON = mat(name + "Iron", iron, rough=0.5, metal=0.55)
    IRON_D = mat(name + "IronD", iron_d, rough=0.6, metal=0.45)
    RUST = mat(name + "Rust", rust, rough=0.85)
    TOOTH = mat(name + "Tooth", tooth, rough=0.4)
    EYE = mat(name + "Eye", eye, rough=0.25, emit=1.6)
    trap_base(IRON, IRON_D, RUST, TOOTH, EYE, W=W, teeth=teeth)
    if extra:
        extra(IRON, IRON_D, RUST, TOOTH, EYE)
    root = assemble(name, height)
    hold(['chain'], [1, LAST])
    anim_bite(gape=gape)
    # The chain lashes a beat behind the bite, and judders when the jaw jams.
    key('chain', 7, rot=(-0.30, 0, 0.18))
    key('chain', 12, rot=(0.34, 0, -0.16))
    anim_stutter(['chain'], frames=(14, 15, 17), amount=0.05)
    key('chain', 20, rot=(0.08, 0, 0.04))
    export(root, filename)
    return 11


def build_trap_sprite():
    """Trap Sprite — level 6's opener: a jaw trap that keeps failing to stay shut."""
    return _trap("TrapSprite", "trapsprite_attack.glb", 1.44,
                 "c9a86f", "8a7040", "9a5a34", "f0e6c8", "ffd15c")


def build_snare_sprite():
    """Snare Sprite — the same trap with a wider gape and a noose off its back."""
    def extra(IRON, IRON_D, RUST, TOOTH, EYE):
        group('chain')
        torus((0, 0.98, 0.20), major=0.20, minor=0.028, m=RUST, rot=(1.2, 0, 0))  # the noose
        group('torso')
        for s in (-1, 1):                                   # sprung side arms
            cone((s * 0.34, 0.10, 0.62), r1=0.055, r2=0.015, depth=0.36, verts=4, m=IRON_D,
                 rot=(-0.5, s * 0.6, 0))
    return _trap("SnareSprite", "snaresprite_attack.glb", 1.50,
                 "d8a25c", "9a6a34", "a8542c", "f6ecd2", "ffb347",
                 W=1.06, teeth=6, gape=1.00, extra=extra)


def _wisp(name, filename, height, glow, halo, core, shard, eye, hot, shards=5,
          halo_tilt=0.30, extra=None):
    reset()
    GLOW = mat(name + "Glow", glow, rough=0.6, emit=0.55, alpha=0.88)
    HALO = mat(name + "Halo", halo, rough=0.7, emit=0.32, alpha=0.72)
    CORE = mat(name + "Core", core, rough=0.5)
    SHARD = mat(name + "Shard", shard, rough=0.3, emit=1.3, alpha=0.88)
    EYE = mat(name + "Eye", eye, rough=0.2, emit=2.4)
    HOT = mat(name + "Hot", hot, rough=0.25, emit=2.2)
    wisp_base(GLOW, HALO, CORE, SHARD, EYE, shards=shards, halo_tilt=halo_tilt)
    if extra:
        extra(GLOW, HALO, CORE, SHARD, EYE, HOT)
    bolt(SHARD, HOT, at=(0, -0.42, 1.00), r=0.11)
    root = assemble(name, height)
    anim_misfire(extra=['shell', 'halo'])
    # The shell blows apart on the failure and is dragged back together after.
    key('shell', 6, scale=1.28)
    key('shell', 11, scale=0.60)
    key('shell', 15, scale=1.62)
    key('shell', 20, scale=0.92)
    key('halo', 6, rot=(0, 0, 1.4))
    key('halo', 11, rot=(0, 0, 3.0))
    key('halo', 15, rot=(0, 0, 2.2))                 # it loses a turn, then catches up
    key('halo', 20, rot=(0, 0, 5.6))
    key('halo', LAST, rot=(0, 0, 2 * PI))
    export(root, filename)
    return 11


def build_cursed_wisp():
    """Cursed Wisp — a tower wisp with the curse burned into its core."""
    return _wisp("CursedWisp", "cursedwisp_attack.glb", 1.52,
                 "b0483f", "7a2f2f", "2a0d10", "ff8f6a", "ffe07a", "ffd0a8")


def build_hex_wisp():
    """Hex Wisp — the hex it was carrying broke; the ring around it has a gap now."""
    def extra(GLOW, HALO, CORE, SHARD, EYE, HOT):
        group('halo')
        for i in range(5):                          # a broken second ring, one piece missing
            a = 2 * PI * i / 7 + 0.5
            cube((0.86 * math.cos(a), -0.02, 1.02 + 0.86 * math.sin(a)),
                 scale=(0.10, 0.045, 0.10), m=SHARD, rot=(0, -a, 0))
    return _wisp("HexWisp", "hexwisp_attack.glb", 1.56,
                 "c2544c", "8a3f3f", "300f14", "ff9f7a", "fff0a0", "ffdcbc",
                 shards=6, halo_tilt=0.48, extra=extra)


def build_blight_wisp():
    """Blight Wisp — the one that has been failing longest: shedding, and lopsided."""
    def extra(GLOW, HALO, CORE, SHARD, EYE, HOT):
        group('trail')
        for i in range(4):                          # flakes coming off the tail
            a = 2 * PI * i / 4 + 0.6
            cube((0.26 * math.cos(a), 0.06 * math.sin(a), 0.22 + 0.09 * (i % 2)),
                 scale=(0.10, 0.030, 0.13), m=HALO, rot=(0.3, 0, -a))
        group('body')
        cube((0.20, -0.20, 1.16), scale=(0.22, 0.10, 0.075), m=CORE, rot=(0, 0.3, 0.2))
    return _wisp("BlightWisp", "blightwisp_attack.glb", 1.50,
                 "b8605c", "a34f4f", "26100f", "ffb08a", "ffe6a8", "ffd8c0",
                 shards=4, halo_tilt=0.18, extra=extra)


def _golem(name, filename, height, stone, stone_d, crack, iron, eye, W=1.0, extra=None):
    reset()
    STONE = mat(name + "Stone", stone, rough=0.8)
    STONE_D = mat(name + "StoneD", stone_d, rough=0.84)
    CRACK = mat(name + "Crack", crack, rough=0.3, emit=1.1)
    IRON = mat(name + "Iron", iron, rough=0.45, metal=0.6)
    EYE = mat(name + "Eye", eye, rough=0.25, emit=1.6)
    wreck_base(STONE, STONE_D, CRACK, IRON, EYE, W=W)
    if extra:
        extra(STONE, STONE_D, CRACK, IRON, EYE)
    root = assemble(name, height)
    rig.anim_overhead_chop(reach=0.26, lean=0.32)
    # The plate over the core is thrown clear by its own swing, and the loose
    # pieces go with it; both are back before the clip repeats.
    anim_fracture([
        ('chest', (0, -0.30, 0.16), (-0.85, 0, 0.30)),
        ('debris', (0, -0.10, 0.0), (0, 0, 0.9)),
    ])
    key('debris', 15, scale=1.55)
    key('debris', 20, scale=0.90)
    anim_stutter(['chest'], frames=(16, 17, 18), amount=0.05)
    export(root, filename)
    return 15


def build_broken_golem():
    """Broken Golem — held together well enough to swing, not well enough to keep swinging."""
    return _golem("BrokenGolem", "brokengolem_attack.glb", 1.92,
                  "5a5248", "3d382f", "ff7a3c", "6d7078", "ff9d4a")


def build_shattered_golem():
    """Shattered Golem — the same wreck further along: more gone, and brighter for it."""
    def extra(STONE, STONE_D, CRACK, IRON, EYE):
        group('torso')
        for s in (-1, 1):                                   # the shoulder it lost
            cube((s * 0.44, -0.06, 1.24), scale=(0.075, 0.26, 0.055), m=CRACK,
                 rot=(0, s * 0.3, 0))
        group('head')
        cube((0.11, -0.12, 1.56), scale=(0.075, 0.24, 0.045), m=CRACK, rot=(0.3, 0, 0.4))
        group('debris')
        for i in range(4):
            a = 2 * PI * i / 4 + 1.0
            ico((0.92 * math.cos(a), -0.10, 1.00 + 0.92 * math.sin(a)), r=0.075, sub=1,
                scale=(1.0, 0.6, 1.0), m=STONE_D)
    return _golem("ShatteredGolem", "shatteredgolem_attack.glb", 1.96,
                  "4a4238", "2e2a24", "ff9d3c", "5f636b", "ffbe5a", W=1.06, extra=extra)


def _knight(name, filename, height, plate, plate_d, cloth, cloth_d, glow, W=1.12):
    reset()
    SKIN = mat(name + "Skin", "8b8276", rough=0.8)
    DARK = mat(name + "Dark", "5f564c", rough=0.82)
    CLOTH = mat(name + "Cloth", cloth, rough=0.88)
    CLOTH2 = mat(name + "Cloth2", cloth_d, rough=0.9)
    PLATE = mat(name + "Plate", plate, rough=0.42, metal=0.7)
    PLATE_D = mat(name + "PlateD", plate_d, rough=0.5, metal=0.6)
    GLOW = mat(name + "Glow", glow, rough=0.25, emit=1.8)
    soldier_base(SKIN, DARK, CLOTH, CLOTH2, W=W, belly=1.0, ears=False)

    group('legs')
    for s in (-1, 1):
        cube((s * 0.19 * W, -0.02, 0.34), scale=(0.28, 0.30, 0.34), m=PLATE_D)
    group('torso')
    cube((0, -0.06, 1.00), scale=(0.62, 0.40, 0.44), m=PLATE)
    cube((0, -0.29, 0.98), scale=(0.075, 0.05, 0.34), m=GLOW)           # the split in the mail
    for s in (-1, 1):
        ico((s * 0.50, 0, 1.14), r=0.21, sub=1, scale=(1.0, 1.0, 0.58), m=PLATE)
        cone((s * 0.46, 0.02, 1.38), r1=0.055, r2=0.01, depth=0.26, verts=4, m=PLATE_D,
             rot=(0, s * 0.42, 0))
    cone((0, 0.18, 1.00), r1=0.32, r2=0.20, depth=0.36, verts=8, m=CLOTH2)   # torn cloak
    group('head')
    cone((0, 0.01, 1.50), r1=0.30, r2=0.10, depth=0.28, verts=8, m=PLATE)
    cube((0, -0.26, 1.40), scale=(0.34, 0.10, 0.10), m=CLOTH2)
    for s in (-1, 1):
        ico((s * 0.085, -0.275, 1.40), r=0.038, sub=2, m=GLOW)          # two lights in the slit
    cube((0, 0.02, 1.66), scale=(0.10, 0.26, 0.14), m=PLATE_D)
    for side in (-1, 1):
        group('arm_r' if side < 0 else 'arm_l')
        cube((side * 0.44, 0, 0.90), scale=(0.26, 0.26, 0.30), m=PLATE)
        ico((side * 0.44, -0.02, 0.62), r=0.125, sub=1, m=PLATE_D)

    # The sword in two pieces: a hilt that stays in the fist and a blade that
    # does not. `shard` hangs off the motion empty, not the arm, so it can leave.
    group('hilt', pivot=(-0.448, 0, 1.06), parent='arm_r')
    cyl((-0.448, -0.06, 0.52), r=0.030, depth=0.22, verts=6, m=CLOTH2)
    ico((-0.448, -0.06, 0.40), r=0.048, sub=1, m=PLATE_D)
    cube((-0.448, -0.06, 0.66), scale=(0.30, 0.06, 0.045), m=PLATE_D)
    cube((-0.448, -0.06, 0.86), scale=(0.075, 0.030, 0.34), m=PLATE)     # the stub of blade
    cone((-0.448, -0.06, 1.05), r1=0.048, r2=0.02, depth=0.13, verts=4, m=GLOW)

    group('shard', pivot=(-0.448, -0.06, 1.24))
    cube((-0.448, -0.06, 1.28), scale=(0.070, 0.028, 0.50), m=PLATE)
    cube((-0.448, -0.072, 1.28), scale=(0.024, 0.030, 0.44), m=GLOW)
    cone((-0.448, -0.06, 1.58), r1=0.048, r2=0.0, depth=0.22, verts=4, m=PLATE)

    root = assemble(name, height)
    hold(['hilt'], [1, LAST])
    rig.anim_overhead_chop(reach=0.26, lean=0.30)
    # The blade snaps off on contact, spins away, and is back on the hilt by 20.
    anim_fracture([('shard', (0.10, -0.52, -0.34), (1.5, 0, 0.9))], hit=12, peak=16, back=21)
    anim_stutter(['shard'], frames=(17, 18, 19), amount=0.05)
    export(root, filename)
    return 16


def build_cursed_knight():
    """Cursed Knight — swings a sword that comes apart every time it lands."""
    return _knight("CursedKnight", "cursedknight_attack.glb", 1.90,
                   "6e6270", "43394a", "5a3a3a", "2c1c20", "ff6a52")


def build_fallen_knight():
    """Fallen Knight — further gone: darker plate, colder light, same broken swing."""
    return _knight("FallenKnight", "fallenknight_attack.glb", 1.94,
                   "5c556a", "342e42", "42282e", "1e1418", "a98cff", W=1.18)


def build_glitch_wyrm():
    """Glitch Wyrm — level 6's boss: a serpent whose own body loses sync mid-strike.

    Each segment of the neck is its own group chained to the one behind it, so
    the strike travels up the spine — and on the failure the odd-numbered ones
    jump off the line while the even ones keep going. It puts itself back
    together on the way out of the loop, every loop, forever.
    """
    reset()
    SCALE = mat("GwScale", "ff2e63", rough=0.5)
    SCALE_D = mat("GwScaleD", "8f0f34", rough=0.6)
    BELLY = mat("GwBelly", "ffb0c4", rough=0.6)
    VOID = mat("GwVoid", "140812", rough=0.45)
    EYE = mat("GwEye", "5cf0ff", rough=0.2, emit=2.6)
    GLITCH = mat("GwGlitch", "5cf0ff", rough=0.3, emit=1.8, alpha=0.85)
    TOOTH = mat("GwTooth", "f4e8e0", rough=0.4)

    group('coil')
    for i in range(7):                                   # the body heaped on the floor
        a = 2 * PI * i / 7
        r = 0.62 - 0.03 * i
        ico((r * math.cos(a), r * math.sin(a) * 0.80, 0.16 + 0.035 * (i % 3)),
            r=0.22 - 0.008 * i, sub=2, scale=(1.0, 1.0, 0.78),
            m=(SCALE if i % 2 else SCALE_D))
    ico((0, 0.30, 0.14), r=0.20, sub=2, scale=(1.0, 1.3, 0.66), m=BELLY)

    parent = 'coil'
    for i in range(5):                                   # the neck, segment by segment
        gname = 'seg%d' % i
        zz = 0.42 + i * 0.22
        yy = -0.05 - i * 0.085
        group(gname, pivot=(0, yy + 0.085, zz - 0.22), parent=parent)
        ico((0, yy, zz), r=0.215 - 0.018 * i, sub=2, scale=(1.0, 1.05, 0.94),
            m=(SCALE if i % 2 else SCALE_D))
        ico((0, yy - 0.10, zz - 0.02), r=0.135 - 0.012 * i, sub=2, scale=(0.9, 0.8, 0.7),
            m=BELLY)
        cone((0, yy + 0.10, zz + 0.16), r1=0.070, r2=0.0, depth=0.22, verts=4, m=VOID,
             rot=(-0.35, 0, 0))                          # a fin down the spine
        parent = gname

    group('head', pivot=(0, -0.44, 1.44), parent='seg4')
    ico((0, -0.56, 1.52), r=0.285, sub=2, scale=(1.0, 1.20, 0.92), m=SCALE)
    ico((0, -0.84, 1.46), r=0.175, sub=2, scale=(0.94, 1.25, 0.62), m=SCALE)
    for s in (-1, 1):
        ico((s * 0.135, -0.60, 1.62), r=0.072, sub=2, m=rig.WHITE)
        ico((s * 0.145, -0.67, 1.62), r=0.044, sub=2, m=EYE)
        cone((s * 0.125, -0.36, 1.70), r1=0.052, r2=0.0, depth=0.30, verts=4, m=VOID,
             rot=(-0.70, 0, s * 0.30))
    group('jaw', pivot=(0, -0.62, 1.44), parent='head')
    ico((0, -0.82, 1.38), r=0.125, sub=2, scale=(0.92, 1.25, 0.46), m=SCALE_D)
    for s in (-1, 1):
        for k in range(3):
            cone((s * (0.05 + k * 0.045), -0.88 - k * 0.04, 1.42), r1=0.024, r2=0.0,
                 depth=0.10, verts=4, m=TOOTH, rot=(PI, 0, 0))

    # The tear it lives in: shards standing in the plane that faces the player.
    group('rift', pivot=(0, 0.06, 1.02), parent='coil')
    for i in range(7):
        a = 2 * PI * i / 7 + 0.3
        cone((1.02 * math.cos(a), 0.06, 1.02 + 1.02 * math.sin(a)), r1=0.055, r2=0.0,
             depth=0.26, verts=3, m=GLITCH, rot=(0, PI / 2 - a, 0))

    root = assemble("GlitchWyrm", 2.0)

    spine = ['seg0', 'seg1', 'seg2', 'seg3', 'seg4']
    parts = ['motion', 'coil', 'head', 'jaw', 'rift'] + spine
    hold(parts, [1])
    # the strike travels up the spine
    key('motion', 6, move=(0, 0.16, 0.05))
    key('coil', 6, rot=(-0.12, 0, 0), scale=(0.94, 0.94, 1.10))
    key('rift', 6, rot=(0, 0, 0.8), scale=1.24)
    key('head', 6, rot=(-0.45, 0, 0), scale=(1.0, 1.0, 1.14))
    key('jaw', 6, rot=(0.75, 0, 0))
    for i, g in enumerate(spine):
        key(g, 4 + i, rot=(-0.30 - 0.05 * i, 0, 0))

    key('motion', 12, move=(0, -0.34, 0))
    key('coil', 12, rot=(0.16, 0, 0), scale=(1.10, 1.10, 0.92))
    key('rift', 12, rot=(0, 0, -0.6), scale=0.62)
    key('head', 12, rot=(0.42, 0, 0), scale=(1.0, 1.20, 0.86))
    key('jaw', 12, rot=(0.16, 0, 0))
    for i, g in enumerate(spine):
        key(g, 9 + i, rot=(0.36 + 0.04 * i, 0, 0))

    # the failure: odd segments drop off the line while the rest keep going
    for i, g in enumerate(spine):
        if i % 2:
            key(g, 15, move=(0.16, 0.06, 0.05), rot=(0.10, 0, 0.34))
            key(g, 17, move=(-0.12, 0, -0.04), rot=(0.20, 0, -0.26))
        else:
            key(g, 16, move=(-0.10, 0, 0.04), rot=(0.24, 0, -0.20))
    key('head', 15, rot=(0.10, 0, 0.30), move=(0.10, 0.06, 0))
    key('jaw', 15, rot=(0.55, 0, -0.20))
    key('rift', 15, rot=(0, 0, 1.6), scale=1.50)

    # and back on the line before the loop comes round
    key('motion', 20, move=(0, -0.06, 0.02))
    key('coil', 20, rot=(0.04, 0, 0))
    key('head', 20, rot=(0.08, 0, 0))
    key('jaw', 20, rot=(0.05, 0, 0))
    key('rift', 20, rot=(0, 0, 2 * PI - 0.4), scale=0.96)
    for g in spine:
        key(g, 20, rot=(0.06, 0, 0))
    key('rift', LAST, rot=(0, 0, 2 * PI))
    hold(parts, [LAST])
    export(root, "glitchwyrm_attack.glb")
    return 15


BUILDERS = [build_trap_sprite, build_snare_sprite, build_cursed_wisp, build_hex_wisp,
            build_blight_wisp, build_broken_golem, build_shattered_golem,
            build_cursed_knight, build_fallen_knight, build_glitch_wyrm]

BUILD_NAMES = {
    "build_trap_sprite": "trapsprite",
    "build_snare_sprite": "snaresprite",
    "build_cursed_wisp": "cursedwisp",
    "build_hex_wisp": "hexwisp",
    "build_blight_wisp": "blightwisp",
    "build_broken_golem": "brokengolem",
    "build_shattered_golem": "shatteredgolem",
    "build_cursed_knight": "cursedknight",
    "build_fallen_knight": "fallenknight",
    "build_glitch_wyrm": "glitchwyrm",
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
