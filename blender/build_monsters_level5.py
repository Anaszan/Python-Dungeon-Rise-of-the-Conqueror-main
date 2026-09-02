"""Build level 5's nine monsters as rigged low-poly GLB models with an attack loop.

Level 5 is the file-handling chapter ("หอสมุดต้องสาป"), and the whole cast
performs the same three beats the chapter teaches: a book swings open, something
comes off the page, and the covers snap shut again — open, read, close, once a
second. The librarians and the Forbidden Tome carry a real book with hinged
covers to do it with; the golems open their own chest instead; the archivists
are the ones doing the writing.

Everything else follows the level 2 conventions, and this file imports the rig,
the primitives and the shared attack loops from build_monsters_level2 and
build_monsters_level3 rather than restating them: X-centred, base at local z=0,
top at or below z=2, models facing -Y, and one action named "Attack" over 24
frames whose first and last poses match so it repeats cleanly.

Level 5 shipped with no models at all until now — its monsters were flat PNG
sprites in both views. The PNGs stay as each monster's imageUrl, because the
combat screen is plain HTML and can only show an <img>.

Run it from the repo root:

    blender --background --python blender/build_monsters_level5.py
    blender --background --python blender/build_monsters_level5.py -- --preview

Writes public/monsters/<name>_attack.glb, and with --preview also renders
blender/preview/level5/<name>.png (rest) and <name>_strike.png (contact frame).
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
OUT_PREVIEW = os.path.join(REPO, "blender", "preview", "level5")


# --------------------------------------------------------------------------
# the book
#
# Hinged at a vertical spine, so a rotation about Z swings a cover. Which sign
# opens a cover depends on which side of the spine it sits: the -X cover opens
# on +Z rotation, the +X one on -Z. `open_z(side)` is that sign, and every
# animation below goes through it rather than hard-coding ±.
# --------------------------------------------------------------------------
def open_z(side, amount):
    return -side * amount


def book(COVER, COVER_D, PAGE, CLASP, at=(0, -0.42, 1.00), w=0.30, h=0.42,
         parent='torso', leaves=5):
    """A book held open at the chest: spine, two hinged covers, a fan of leaves.

    The leaves are their own group so they can be thrown forward on the read
    beat while the covers stay with the hands that hold them.
    """
    x0, y0, z0 = at
    group('book', pivot=(x0, y0, z0), parent=parent)
    cube((x0, y0 + 0.02, z0), scale=(0.07, 0.10, h * 1.06), m=COVER_D)          # the spine
    for zz in (-h * 0.5, h * 0.5):
        cube((x0, y0 + 0.02, z0 + zz), scale=(0.085, 0.11, 0.035), m=CLASP)

    for side, gname in ((-1, 'cover_r'), (1, 'cover_l')):
        group(gname, pivot=(x0, y0, z0), parent='book')
        cube((x0 + side * w * 0.55, y0 - 0.015, z0), scale=(w, 0.045, h), m=COVER)
        cube((x0 + side * w * 0.55, y0 - 0.042, z0), scale=(w * 0.72, 0.020, h * 0.74),
             m=CLASP)                                                          # the tooled panel
        cube((x0 + side * w * 1.02, y0 - 0.010, z0), scale=(0.035, 0.055, h * 1.02), m=COVER_D)

    group('pages', pivot=(x0, y0 - 0.05, z0), parent='book')
    for i in range(leaves):
        t = (i / (leaves - 1)) * 2 - 1                                         # -1 .. 1
        cube((x0 + t * w * 0.46, y0 - 0.055 - abs(t) * 0.015, z0),
             scale=(w * 0.44, 0.014, h * 0.88), m=PAGE, rot=(0, 0, -t * 0.30))


def loose_pages(PAGE, name='flurry', pivot=(0, 0, 1.0), parent=None, count=6,
                radius=0.62, spread=0.26):
    """Sheets torn free and hanging in the air around the monster.

    Kept in the plane that faces the camera. Fanned through the depth axis they
    cross each other from the dungeon's three-quarter view and stop reading as
    paper at all.
    """
    group(name, pivot=pivot, parent=parent)
    for i in range(count):
        a = 2 * PI * i / count + 0.35
        cube((pivot[0] + radius * math.cos(a), pivot[1] - spread * (i % 2),
              pivot[2] + radius * math.sin(a)),
             scale=(0.22, 0.012, 0.28), m=PAGE, rot=(0.2 * math.sin(a), 0, -a * 0.5))


# --------------------------------------------------------------------------
# shared bodies
# --------------------------------------------------------------------------
def golem_base(STONE, STONE_D, COVER, PAGE, TRIM, EYE, W=1.0):
    """A golem bound out of books: slab legs, a stack for a chest, stone fists.

    The chest stack is the thing that opens, so the books that make it are laid
    with their spines facing out and a lit gap left between the top two — the
    seam the light comes out of when it reads.
    """
    group('legs')
    for s in (-1, 1):
        for k, (zz, ww) in enumerate(((0.13, 0.30), (0.36, 0.27), (0.56, 0.24))):
            cube((s * 0.24 * W, 0, zz), scale=(ww * W, 0.36, 0.19),
                 m=(COVER if k % 2 else STONE_D), rot=(0, 0, s * 0.06 * k))
        cube((s * 0.24 * W, -0.06, 0.035), scale=(0.34 * W, 0.44, 0.09), m=STONE)

    group('torso', pivot=(0, 0, 0.70))
    for k, (zz, ww, dd, rr) in enumerate(((0.80, 0.72, 0.44, 0.05),
                                          (0.98, 0.78, 0.46, -0.07),
                                          (1.15, 0.70, 0.42, 0.09),
                                          (1.30, 0.60, 0.38, -0.04))):
        cube((0, 0, zz), scale=(ww * W, dd, 0.155), m=(COVER if k % 2 else STONE), rot=(0, 0, rr))
        cube((0, -dd * 0.5 + 0.02, zz), scale=(ww * W * 0.86, 0.030, 0.105), m=PAGE,
             rot=(0, 0, rr))                                                   # the page block
    cyl((0, -0.20, 1.06), r=0.26 * W, depth=0.055, verts=10, m=TRIM, rot=(PI / 2, 0, 0))
    ico((0, -0.24, 1.07), r=0.10, sub=2, scale=(1.0, 0.5, 1.0), m=EYE)         # the seam's light

    group('head', pivot=(0, 0, 1.40), parent='torso')
    cube((0, 0, 1.52), scale=(0.46 * W, 0.40, 0.30), m=STONE)
    cube((0, -0.19, 1.52), scale=(0.40 * W, 0.06, 0.24), m=COVER)              # the face plate
    for s in (-1, 1):
        ico((s * 0.115, -0.225, 1.55), r=0.055, sub=2, m=EYE)
    cube((0, 0, 1.70), scale=(0.34 * W, 0.30, 0.075), m=TRIM)
    for s in (-1, 1):
        cube((s * 0.26 * W, 0.02, 1.66), scale=(0.10, 0.24, 0.20), m=STONE_D)

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.48 * W, 0, 1.26), parent='torso')
        for k, zz in enumerate((1.10, 0.92, 0.74)):
            cube((side * 0.48 * W, -0.02, zz), scale=(0.26 * W, 0.28, 0.155),
                 m=(COVER if k % 2 else STONE), rot=(0, 0, side * 0.08 * k))
        ico((side * 0.50 * W, -0.04, 0.56), r=0.155 * W, sub=1, m=STONE)
        cyl((side * 0.48 * W, 0, 1.26), r=0.20 * W, depth=0.10, verts=8, m=TRIM,
            rot=(PI / 2, 0, 0))


def librarian_base(ROBE, ROBE_D, PALE, EYE, GLASS, tails=6):
    """A hovering ghost scholar: no legs, a stole over the shoulders, spectacles.

    The spectacles are doing real work — a pale face on a pale robe is a smear
    at dungeon size, and two dark rings are the one feature that survives being
    shrunk to sprite height.
    """
    group('tail')
    cone((0, 0, 0.48), r1=0.40, r2=0.25, depth=0.96, verts=9, m=ROBE_D)
    for i in range(tails):
        a = 2 * PI * i / tails + 0.25
        cone((0.29 * math.cos(a), 0.29 * math.sin(a), 0.11), r1=0.072, depth=0.30,
             verts=4, m=ROBE_D, rot=(PI, 0, 0))

    group('torso', pivot=(0, 0, 0.94))
    ico((0, 0, 1.10), r=0.31, sub=2, scale=(1.12, 0.88, 0.92), m=ROBE)
    cone((0, 0.04, 1.14), r1=0.36, r2=0.22, depth=0.28, verts=9, m=ROBE_D)      # the stole
    for s in (-1, 1):
        cube((s * 0.17, -0.20, 1.02), scale=(0.09, 0.06, 0.46), m=ROBE_D)       # its two ends

    group('head', pivot=(0, 0, 1.34), parent='torso')
    ico((0, -0.02, 1.48), r=0.235, sub=2, scale=(0.98, 0.92, 1.04), m=PALE)
    cone((0, 0.05, 1.66), r1=0.30, r2=0.07, depth=0.36, verts=8, m=ROBE_D)      # scholar's cap
    cube((0, 0.05, 1.84), scale=(0.42, 0.42, 0.045), m=ROBE_D)                  # its board
    for s in (-1, 1):
        torus((s * 0.095, -0.205, 1.50), major=0.075, minor=0.018, m=GLASS, rot=(PI / 2, 0, 0))
        ico((s * 0.095, -0.215, 1.50), r=0.052, sub=2, m=EYE)
    cube((0, -0.205, 1.50), scale=(0.075, 0.030, 0.020), m=GLASS)               # the bridge
    cube((0, -0.185, 1.36), scale=(0.20, 0.06, 0.045), m=ROBE_D)                # a thin mouth

    for side, gname in ((-1, 'arm_r'), (1, 'arm_l')):
        group(gname, pivot=(side * 0.28, -0.02, 1.14), parent='torso')
        cone((side * 0.38, -0.16, 1.00), r1=0.115, r2=0.055, depth=0.44, verts=6, m=ROBE,
             rot=(0.55, side * 0.34, 0))
        ico((side * 0.40, -0.36, 0.92), r=0.065, sub=1, m=PALE)                 # hands at the book


def archivist_base(SKIN, DARK, ROBE, ROBE_D, TRIM, EYE, W=1.0, belly=1.0):
    """A living scholar of the stacks: soldier's frame under an archivist's robe.

    Reuses the level 2 fighter body on purpose — the archivists are the only
    thing in this library with its feet on the floor, and sharing a silhouette
    with the goblins and orcs is what makes them read that way.
    """
    soldier_base(SKIN, DARK, ROBE, ROBE_D, W=W, belly=belly, ears=False)

    group('torso')
    cone((0, 0.03, 1.06), r1=0.40 * W, r2=0.24, depth=0.30, verts=9, m=ROBE_D)  # mantle
    for s in (-1, 1):
        cube((s * 0.17, -0.29, 0.96), scale=(0.10, 0.06, 0.52), m=TRIM)         # stole ends
    cube((0, -0.30, 0.72), scale=(0.34, 0.10, 0.22), m=ROBE_D)                  # the satchel

    group('head')
    cone((0, 0.03, 1.50), r1=0.31, r2=0.10, depth=0.24, verts=8, m=ROBE_D)      # low hood
    cube((0, 0.03, 1.64), scale=(0.44, 0.44, 0.045), m=ROBE_D)                  # scholar's board
    for s in (-1, 1):
        torus((s * 0.115, -0.245, 1.38), major=0.078, minor=0.018, m=TRIM, rot=(PI / 2, 0, 0))
        ico((s * 0.115, -0.255, 1.38), r=0.050, sub=2, m=EYE)
    cube((0, -0.245, 1.38), scale=(0.075, 0.030, 0.020), m=TRIM)


# --------------------------------------------------------------------------
# attack loops specific to level 5
# --------------------------------------------------------------------------
def anim_open_read_close(base='tail', torso='torso', head='head', reach=0.26, rise=0.10,
                         spread=0.95, throw=0.58, extra=()):
    """The chapter in one second: the covers swing open, the page comes off it,
    the covers snap shut.

    Frame 7 opens the book and draws the body back, 12 throws the leaves out
    past the front of the model, 18 shuts the covers on the follow-through, and
    24 is back at rest — so the loop reads as one complete `with open(...)`
    block rather than a monster waving a book around.
    """
    body = ['motion', base, torso, 'arm_r', 'arm_l', 'book', 'cover_r', 'cover_l', 'pages']
    body += list(extra)
    if head:
        body.append(head)
    hold(body, [1])

    key('motion', 7, move=(0, 0.14, rise))
    key(torso, 7, rot=(-0.26, 0, 0))
    key(base, 7, rot=(-0.16, 0, 0))
    key('arm_r', 7, rot=(-0.20, 0, -0.42))
    key('arm_l', 7, rot=(-0.20, 0, 0.42))
    key('book', 7, move=(0, -0.10, 0.06), scale=1.12)
    key('cover_r', 7, rot=(0, 0, open_z(-1, spread)))
    key('cover_l', 7, rot=(0, 0, open_z(1, spread)))
    key('pages', 7, scale=(1.0, 1.0, 1.15))
    if head:
        key(head, 7, rot=(-0.26, 0, 0))

    key('motion', 12, move=(0, -reach, rise * 0.35))
    key(torso, 12, rot=(0.34, 0, 0))
    key(base, 12, rot=(0.22, 0, 0))
    key('arm_r', 12, rot=(0.30, 0, 0.30))
    key('arm_l', 12, rot=(0.30, 0, -0.30))
    key('book', 12, move=(0, -0.22, 0.02), scale=1.06)
    key('cover_r', 12, rot=(0, 0, open_z(-1, spread * 0.80)))
    key('cover_l', 12, rot=(0, 0, open_z(1, spread * 0.80)))
    key('pages', 12, move=(0, -throw, 0.04), scale=(1.22, 1.0, 1.16))
    if head:
        key(head, 12, rot=(0.28, 0, 0))

    key('motion', 18, move=(0, -reach * 0.30, rise * 0.55))
    key(torso, 18, rot=(0.10, 0, 0))
    key(base, 18, rot=(0.06, 0, 0))
    key('arm_r', 18, rot=(0.10, 0, 0.10))
    key('arm_l', 18, rot=(0.10, 0, -0.10))
    key('book', 18, move=(0, 0.04, 0.01))
    key('cover_r', 18, rot=(0, 0, open_z(-1, -0.34)))               # shut
    key('cover_l', 18, rot=(0, 0, open_z(1, -0.34)))
    key('pages', 18, move=(0, 0.03, 0), scale=(0.55, 1.0, 0.80))
    if head:
        key(head, 18, rot=(0.08, 0, 0))

    hold(body, [LAST])


def anim_flurry(name='flurry', beats=((7, 1.28, 0.9), (12, 0.62, -0.7), (18, 1.10, 1.6))):
    """Loose sheets pulled in on the open and blown out on the read.

    Keys nothing but its own group: whatever loop this sits on top of already
    owns the motion empty, and a second set of keys there would fight it.
    """
    key(name, 1)
    for f, sc, turn in beats:
        key(name, f, rot=(0, 0, turn), scale=sc)
    key(name, LAST)


def anim_chest_open(seam='torso', frames=((7, 1.14), (12, 0.90), (18, 1.04))):
    """The golems have no book, so their own chest stack is what opens.

    A scale on the torso rather than a rotation: the books that make the chest
    are stacked along Z, and stretching that axis pulls the seams apart exactly
    the way a stack of them would come loose.
    """
    for f, sc in frames:
        key(seam, f, scale=(1.0, 1.0, sc))


# --------------------------------------------------------------------------
# the cast
# --------------------------------------------------------------------------
def _golem(name, filename, height, stone, stone_d, cover, page, trim, eye,
           W=1.0, anim='chop', extra=None):
    reset()
    STONE = mat(name + "Stone", stone, rough=0.78)
    STONE_D = mat(name + "StoneD", stone_d, rough=0.82)
    COVER = mat(name + "Cover", cover, rough=0.7)
    PAGE = mat(name + "Page", page, rough=0.85)
    TRIM = mat(name + "Trim", trim, rough=0.4, metal=0.65)
    EYE = mat(name + "Eye", eye, rough=0.25, emit=1.5)
    golem_base(STONE, STONE_D, COVER, PAGE, TRIM, EYE, W=W)
    if extra:
        extra(STONE, STONE_D, COVER, PAGE, TRIM, EYE)
    loose_pages(PAGE, pivot=(0, -0.06, 1.06), parent='torso', count=6, radius=0.70)
    root = assemble(name, height)
    if anim == 'chop':
        rig.anim_overhead_chop(reach=0.24, lean=0.30)
        anim_chest_open()
        anim_flurry()
        strike = 12
    else:
        rig.anim_double_swipe(reach=0.22)
        anim_chest_open(frames=((6, 1.12), (11, 0.90), (15, 1.03)))
        anim_flurry(beats=((6, 1.30, -0.9), (11, 0.60, 0.7), (15, 1.08, -1.5)))
        strike = 11
    export(root, filename)
    return strike


def build_book_golem():
    """Book Golem — level 5's opener: a stack of bound volumes that stands up."""
    return _golem("BookGolem", "bookgolem_attack.glb", 1.86,
                  "7a6a4f", "5a4d38", "8a5a34", "e6dcc0", "b89a52", "ffcf6a")


def build_index_golem():
    """Index Golem — the same stack, tabbed and cross-referenced, and faster for it."""
    def extra(STONE, STONE_D, COVER, PAGE, TRIM, EYE):
        group('torso')
        for k, zz in enumerate((0.80, 0.98, 1.15, 1.30)):          # the index tabs
            for j in range(3):
                cube((-0.26 + j * 0.26, -0.235, zz + 0.045), scale=(0.13, 0.055, 0.055),
                     m=(TRIM if (j + k) % 2 else EYE))
        group('head')
        for s in (-1, 1):                                          # card-drawer pulls
            cube((s * 0.20, -0.225, 1.66), scale=(0.10, 0.055, 0.045), m=TRIM)
    return _golem("IndexGolem", "indexgolem_attack.glb", 1.90,
                  "8a7a5f", "685a42", "6a6a8a", "f0e8d0", "c9ab5e", "ffe08a",
                  W=1.04, anim='swipe', extra=extra)


def _librarian(name, filename, height, robe, robe_d, pale, eye, glass, cover, cover_d,
               page, clasp, tails=6, spread=0.95, extra=None):
    reset()
    ROBE = mat(name + "Robe", robe, rough=0.85, alpha=0.90)
    ROBE_D = mat(name + "RobeD", robe_d, rough=0.9, alpha=0.80)
    PALE = mat(name + "Pale", pale, rough=0.8, emit=0.20, alpha=0.88)
    EYE = mat(name + "Eye", eye, rough=0.2, emit=2.2)
    GLASS = mat(name + "Glass", glass, rough=0.3, metal=0.6)
    COVER = mat(name + "Cover", cover, rough=0.7)
    COVER_D = mat(name + "CoverD", cover_d, rough=0.75)
    PAGE = mat(name + "Page", page, rough=0.85, emit=0.25)
    CLASP = mat(name + "Clasp", clasp, rough=0.35, metal=0.7)
    librarian_base(ROBE, ROBE_D, PALE, EYE, GLASS, tails=tails)
    book(COVER, COVER_D, PAGE, CLASP, at=(0, -0.46, 1.12), w=0.36, h=0.50)
    loose_pages(PAGE, pivot=(0, -0.10, 1.18), parent='torso', count=6, radius=0.74)
    if extra:
        extra(ROBE, ROBE_D, PALE, EYE, GLASS, PAGE, CLASP)
    root = assemble(name, height)
    anim_open_read_close(spread=spread)
    anim_flurry()
    export(root, filename)
    return 12


def build_ghost_librarian():
    """Ghost Librarian — still holding the volume it was shelving when it died."""
    return _librarian("GhostLibrarian", "ghostlibrarian_attack.glb", 1.88,
                      "cfd8f0", "9fadd0", "eef4ff", "9fe8ff", "8fa0c0",
                      "3d4a72", "232c48", "f4f0dc", "c9b06a")


def build_whispering_librarian():
    """Whispering Librarian — reads aloud; the words come off the page as shards."""
    def extra(ROBE, ROBE_D, PALE, EYE, GLASS, PAGE, CLASP):
        group('head')
        for i in range(4):                                   # the whisper leaving the mouth
            a = -0.55 + 1.1 * i / 3
            cone((0.14 * math.sin(a), -0.30 - 0.06 * math.cos(a), 1.36 + 0.05 * math.sin(a * 1.6)),
                 r1=0.036, r2=0.0, depth=0.17, verts=3, m=EYE, rot=(PI / 2, 0, a * 0.55))
        group('torso')
        for s in (-1, 1):                                    # a second stole, longer
            cube((s * 0.26, -0.14, 0.94), scale=(0.075, 0.055, 0.58), m=ROBE_D)
    return _librarian("WhisperingLibrarian", "whisperinglibrarian_attack.glb", 1.92,
                      "b8c7e8", "8695c0", "e6eeff", "b6f0ff", "7d90b4",
                      "5a3f72", "2e2044", "f6f2e0", "d8bf78", tails=7, spread=1.05,
                      extra=extra)


def build_silent_librarian():
    """Silent Librarian — the sealed one: chains on the book, and it opens widest."""
    def extra(ROBE, ROBE_D, PALE, EYE, GLASS, PAGE, CLASP):
        group('head')
        cube((0, -0.185, 1.36), scale=(0.26, 0.055, 0.10), m=CLASP)   # a clasp over the mouth
        group('book')
        for zz in (-0.12, 0.12):                                      # chains across the spine
            torus((0, -0.52, 1.12 + zz), major=0.11, minor=0.022, m=CLASP, rot=(0, PI / 2, 0))
        group('cover_r')
        cube((-0.28, -0.50, 1.12), scale=(0.060, 0.032, 0.40), m=CLASP)
        group('cover_l')
        cube((0.28, -0.50, 1.12), scale=(0.060, 0.032, 0.40), m=CLASP)
    return _librarian("SilentLibrarian", "silentlibrarian_attack.glb", 1.94,
                      "e0e8f8", "adb8d8", "f8fbff", "dff4ff", "9aa8c8",
                      "6a6a80", "343448", "ffffff", "e0e0ea", tails=5, spread=1.25,
                      extra=extra)


def build_archivist():
    """Archivist — quill in one hand, a stiff scroll in the other, used as a spear."""
    reset()
    SKIN = mat("ArSkin", "c9a888", rough=0.65)
    DARK = mat("ArDark", "97795c", rough=0.7)
    ROBE = mat("ArRobe", "4f7a6a", rough=0.86)
    ROBE_D = mat("ArRobeD", "24463c", rough=0.9)
    TRIM = mat("ArTrim", "c9a24a", rough=0.35, metal=0.7)
    EYE = mat("ArEye", "ffe6a0", rough=0.25, emit=1.0)
    PAPER = mat("ArPaper", "f0e8cc", rough=0.85)
    archivist_base(SKIN, DARK, ROBE, ROBE_D, TRIM, EYE, W=0.98, belly=0.94)

    group('scroll', pivot=(-0.392, 0, 1.04), parent='arm_r')
    cyl((-0.392, -0.05, 1.00), r=0.055, depth=1.24, verts=8, m=PAPER)
    for zz in (0.40, 1.60):
        cyl((-0.392, -0.05, zz), r=0.075, depth=0.09, verts=8, m=TRIM)
    cone((-0.392, -0.05, 1.76), r1=0.060, r2=0.0, depth=0.22, verts=5, m=TRIM)
    group('quill', pivot=(0.392, 0, 1.04), parent='arm_l')
    cyl((0.44, -0.12, 0.72), r=0.018, depth=0.34, verts=5, m=TRIM, rot=(0.30, 0, 0))
    cone((0.44, -0.20, 0.98), r1=0.075, r2=0.0, depth=0.44, verts=4, m=PAPER, rot=(0.30, 0, 0))

    root = assemble("Archivist", 1.76)
    hold(['scroll', 'quill'], [1, LAST])
    rig3.anim_thrust(reach=0.34)
    export(root, "archivist_attack.glb")
    return 11


def build_archivist_scribe():
    """Archivist Scribe — writes: three strokes of the quill inside the one loop."""
    reset()
    SKIN = mat("AsSkin", "d0b092", rough=0.65)
    DARK = mat("AsDark", "9e8264", rough=0.7)
    ROBE = mat("AsRobe", "5f8a7a", rough=0.86)
    ROBE_D = mat("AsRobeD", "2e5448", rough=0.9)
    TRIM = mat("AsTrim", "d8b45a", rough=0.35, metal=0.7)
    EYE = mat("AsEye", "fff0b8", rough=0.25, emit=1.1)
    PAPER = mat("AsPaper", "f6efd6", rough=0.85)
    INK = mat("AsInk", "1a1a2e", rough=0.4)
    archivist_base(SKIN, DARK, ROBE, ROBE_D, TRIM, EYE, W=0.92, belly=0.88)

    group('torso')
    for k in range(3):                                       # blank sheets tucked in the stole
        cube((-0.10 + k * 0.10, -0.34, 0.92), scale=(0.16, 0.012, 0.30), m=PAPER,
             rot=(0, 0, -0.2 + k * 0.2))
    for side, gname, arm in ((-1, 'quill_r', 'arm_r'), (1, 'quill_l', 'arm_l')):
        group(gname, pivot=(side * 0.368, 0, 1.04), parent=arm)
        cyl((side * 0.40, -0.10, 0.70), r=0.017, depth=0.30, verts=5, m=INK, rot=(0.26, 0, 0))
        cone((side * 0.40, -0.17, 0.94), r1=0.070, r2=0.0, depth=0.42, verts=4, m=PAPER,
             rot=(0.26, 0, 0))
        ico((side * 0.40, -0.14, 0.56), r=0.030, sub=1, m=INK)                 # a loaded nib

    root = assemble("ArchivistScribe", 1.74)
    hold(['quill_r', 'quill_l'], [1, LAST])
    rig3.anim_triple_jab(reach=0.20, swing=1.35)
    export(root, "archivistscribe_attack.glb")
    return 13


def build_archivist_warden():
    """Archivist Warden — the one that closes the stacks: ledger shield, seal-stamp maul."""
    reset()
    SKIN = mat("AwSkin", "b89878", rough=0.68)
    DARK = mat("AwDark", "8a6c50", rough=0.72)
    ROBE = mat("AwRobe", "3f6a5a", rough=0.86)
    ROBE_D = mat("AwRobeD", "1c3c33", rough=0.9)
    TRIM = mat("AwTrim", "b8963e", rough=0.35, metal=0.75)
    EYE = mat("AwEye", "ffd980", rough=0.25, emit=1.2)
    IRON = mat("AwIron", "6d7480", rough=0.4, metal=0.65)
    PAPER = mat("AwPaper", "e8dfbe", rough=0.85)
    archivist_base(SKIN, DARK, ROBE, ROBE_D, TRIM, EYE, W=1.16, belly=1.06)

    group('torso')
    cube((0, -0.08, 1.00), scale=(0.62, 0.38, 0.40), m=IRON)                   # a clerk's cuirass
    for s in (-1, 1):
        ico((s * 0.50, 0, 1.14), r=0.21, sub=1, scale=(1.0, 1.0, 0.58), m=IRON)
    group('head')
    cyl((0, 0.02, 1.58), r=0.24, depth=0.055, verts=9, m=TRIM)

    group('stamp', pivot=(-0.464, 0, 1.06), parent='arm_r')
    cyl((-0.464, -0.05, 0.84), r=0.040, depth=0.60, verts=6, m=ROBE_D)
    cyl((-0.464, -0.05, 1.20), r=0.20, depth=0.22, verts=8, m=IRON)
    cyl((-0.464, -0.05, 1.33), r=0.155, depth=0.055, verts=8, m=TRIM)          # the seal face
    for i in range(6):
        a = 2 * PI * i / 6
        cube((-0.464 + 0.13 * math.cos(a), -0.05 + 0.13 * math.sin(a), 1.36),
             scale=(0.055, 0.055, 0.045), m=EYE, rot=(0, 0, a))
    group('ledger', pivot=(0.464, 0, 1.06), parent='arm_l')
    cube((0.60, -0.13, 0.94), scale=(0.34, 0.09, 0.62), m=ROBE_D)
    cube((0.60, -0.185, 0.94), scale=(0.28, 0.030, 0.54), m=PAPER)
    for zz in (0.68, 1.20):
        cube((0.60, -0.19, zz), scale=(0.30, 0.035, 0.055), m=TRIM)

    root = assemble("ArchivistWarden", 1.84)
    hold(['stamp', 'ledger'], [1, LAST])
    rig.anim_overhead_chop(reach=0.26, lean=0.32)
    export(root, "archivistwarden_attack.glb")
    return 12


def build_forbidden_tome():
    """Forbidden Tome — level 5's boss: the book itself, and it is the one reading you.

    No body to hang a rig on, so the book *is* the rig: a spine that rocks, two
    covers that throw themselves open, the leaves that blast out of the gap, and
    an eye behind them that only shows while the covers are apart.
    """
    reset()
    COVER = mat("FtCover", "3a2a66", rough=0.72)
    COVER_D = mat("FtCoverD", "1e1440", rough=0.78)
    PAGE = mat("FtPage", "efe6c8", rough=0.85, emit=0.30)
    CLASP = mat("FtClasp", "c9a24a", rough=0.35, metal=0.8)
    IRIS = mat("FtIris", "ffcf5a", rough=0.2, emit=2.4)
    VOID = mat("FtVoid", "0b0718", rough=0.5)
    GLYPH = mat("FtGlyph", "b98cff", rough=0.3, emit=1.6, alpha=0.9)

    # The column of pages it stands on instead of legs.
    group('stream')
    cone((0, 0, 0.34), r1=0.30, r2=0.10, depth=0.68, verts=8, m=COVER_D, rot=(PI, 0, 0))
    for i in range(7):
        a = 2 * PI * i / 7 + 0.3
        zz = 0.10 + 0.075 * (i % 4)
        cube((0.30 * math.cos(a), 0.30 * math.sin(a), zz), scale=(0.24, 0.014, 0.30),
             m=PAGE, rot=(0.35 * math.sin(a), 0, -a * 0.5))

    group('spine', pivot=(0, 0, 0.78))
    cube((0, 0.03, 1.24), scale=(0.13, 0.20, 0.98), m=COVER_D)
    for zz in (0.80, 1.24, 1.68):
        cube((0, 0.03, zz), scale=(0.16, 0.22, 0.065), m=CLASP)

    for side, gname in ((-1, 'cover_r'), (1, 'cover_l')):
        group(gname, pivot=(0, 0, 1.24), parent='spine')
        cube((side * 0.34, -0.02, 1.24), scale=(0.62, 0.085, 0.98), m=COVER)
        cube((side * 0.34, -0.070, 1.24), scale=(0.46, 0.030, 0.78), m=COVER_D)
        ico((side * 0.34, -0.085, 1.24), r=0.11, sub=2, scale=(1.0, 0.35, 1.0), m=GLYPH)
        cube((side * 0.64, -0.01, 1.24), scale=(0.055, 0.10, 1.00), m=CLASP)
        for zz in (0.86, 1.62):                                   # the broken clasps
            cube((side * 0.60, -0.08, zz), scale=(0.16, 0.055, 0.075), m=CLASP)

    group('leaves', pivot=(0, -0.06, 1.24), parent='spine')
    for i in range(7):
        t = (i / 6) * 2 - 1
        cube((t * 0.30, -0.10 - abs(t) * 0.02, 1.24), scale=(0.30, 0.014, 0.86), m=PAGE,
             rot=(0, 0, -t * 0.34))

    group('eye', pivot=(0, -0.12, 1.24), parent='spine')
    ico((0, -0.14, 1.24), r=0.24, sub=2, scale=(1.0, 0.55, 0.80), m=VOID)
    ico((0, -0.22, 1.24), r=0.135, sub=2, scale=(1.0, 0.55, 1.0), m=IRIS)
    ico((0, -0.27, 1.24), r=0.065, sub=2, scale=(1.0, 0.5, 1.4), m=VOID)

    loose_pages(PAGE, name='flurry', pivot=(0, -0.04, 1.24), parent='spine', count=8,
                radius=1.00, spread=0.20)

    root = assemble("ForbiddenTome", 2.0)

    parts = ['motion', 'stream', 'spine', 'cover_r', 'cover_l', 'leaves', 'eye', 'flurry']
    hold(parts, [1])
    # open()
    key('motion', 7, move=(0, 0.16, 0.06))
    key('spine', 7, rot=(-0.20, 0, 0))
    key('stream', 7, rot=(-0.14, 0, 0), scale=(0.90, 0.90, 1.16))
    key('cover_r', 7, rot=(0, 0, open_z(-1, 1.30)))
    key('cover_l', 7, rot=(0, 0, open_z(1, 1.30)))
    key('leaves', 7, scale=(1.10, 1.0, 1.14))
    key('eye', 7, scale=1.30)
    key('flurry', 7, rot=(0, 0, 0.9), scale=1.24)
    # read() — the page comes off the book
    key('motion', 12, move=(0, -0.30, 0))
    key('spine', 12, rot=(0.26, 0, 0))
    key('stream', 12, rot=(0.20, 0, 0), scale=(1.12, 1.12, 0.90))
    key('cover_r', 12, rot=(0, 0, open_z(-1, 1.05)))
    key('cover_l', 12, rot=(0, 0, open_z(1, 1.05)))
    # Fanned as they go rather than driven straight out: kept coplanar the seven
    # leaves stack into one white plate that hides the eye they came from.
    key('leaves', 12, rot=(0.34, 0, 0), move=(0, -0.46, 0.10), scale=(1.20, 1.0, 1.10))
    key('eye', 12, scale=1.05)
    key('flurry', 12, rot=(0, 0, -0.8), scale=0.58)
    # close()
    key('motion', 18, move=(0, -0.08, 0.03))
    key('spine', 18, rot=(0.08, 0, 0))
    key('stream', 18, rot=(0.06, 0, 0))
    key('cover_r', 18, rot=(0, 0, open_z(-1, -0.30)))
    key('cover_l', 18, rot=(0, 0, open_z(1, -0.30)))
    key('leaves', 18, move=(0, 0.04, 0), scale=(0.55, 1.0, 0.80))
    key('eye', 18, scale=0.35)                              # shut behind the covers
    key('flurry', 18, rot=(0, 0, 1.7), scale=1.06)
    hold(parts, [LAST])
    export(root, "forbiddentome_attack.glb")
    return 12


BUILDERS = [build_book_golem, build_index_golem, build_ghost_librarian,
            build_whispering_librarian, build_silent_librarian, build_archivist,
            build_archivist_scribe, build_archivist_warden, build_forbidden_tome]

BUILD_NAMES = {
    "build_book_golem": "bookgolem",
    "build_index_golem": "indexgolem",
    "build_ghost_librarian": "ghostlibrarian",
    "build_whispering_librarian": "whisperinglibrarian",
    "build_silent_librarian": "silentlibrarian",
    "build_archivist": "archivist",
    "build_archivist_scribe": "archivistscribe",
    "build_archivist_warden": "archivistwarden",
    "build_forbidden_tome": "forbiddentome",
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
