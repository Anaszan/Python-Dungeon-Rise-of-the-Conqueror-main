"""Fit a humanoid skeleton to a standing low-poly character mesh.

The bone names/hierarchy mirror Quaternius' "Ultimate Modular Women" rig that
the female models already use, so both genders expose the same joints (in
particular `Middle1.R`, the grip bone the game attaches weapons to).
"""
import numpy as np


def _clusters(xs, gap):
    """Split a sorted 1-D array into runs separated by more than `gap`."""
    xs = np.sort(xs)
    out, start = [], 0
    for i in range(1, len(xs)):
        if xs[i] - xs[i - 1] > gap:
            out.append(xs[start:i]); start = i
    out.append(xs[start:])
    return [c for c in out if len(c)]


def landmarks(body, head_pts=None, arm_pts=None):
    """Measure a character from its body vertex cloud (Y up, feet at y~0).

    Heights are anchored on the neck rather than on the model's total height:
    pointed hats and helmet crests make the bounding box a bad ruler, while the
    top of the shoulders is stable across all four classes.
    """
    y0, y1 = body[:, 1].min(), body[:, 1].max()
    H = y1 - y0
    half_w = np.abs(body[:, 0]).max()

    # Neck = where the head mesh starts, when the model ships a separate head
    # group; otherwise fall back to the usual 0.72 of total height.
    neck_y = float(head_pts[:, 1].min()) if head_pts is not None and len(head_pts) else y0 + 0.72 * H
    S = neck_y - y0                              # shoulder height: the ruler

    # Crotch: proportion first, then pulled to a real gap between the legs if
    # one is visible nearby (armour skirts and robes hide it on some classes).
    crotch_y = y0 + 0.48 * S
    gap = max(0.04 * S, 1e-4)
    for t in np.arange(0.56, 0.34, -0.01):
        y = y0 + t * S
        s = body[(body[:, 1] > y - 0.02 * S) & (body[:, 1] < y + 0.02 * S)]
        if len(s) < 6:
            continue
        cl = _clusters(s[:, 0], gap)
        if len(cl) >= 2 and min(abs(c).min() for c in cl) > 0.03 * half_w:
            crotch_y = y
            break

    # Leg centre line: measured well below any skirt so the robe classes still
    # get their bones inside the legs.
    legs = body[body[:, 1] < y0 + 0.30 * S]
    leg_x = float(np.abs(legs[:, 0]).mean()) if len(legs) else 0.35 * half_w
    leg_z = float(legs[:, 2].mean()) if len(legs) else 0.0

    # Arm centre line: the outermost eighth of the torso band, with shoulder
    # pads and weapons already excluded by the caller.
    src = arm_pts if arm_pts is not None and len(arm_pts) else body
    band = src[(src[:, 1] > neck_y - 0.34 * S) & (src[:, 1] < neck_y - 0.08 * S)]
    right = band[band[:, 0] < 0]
    arm_x = 0.86 * float(abs(np.percentile(right[:, 0], 10))) if len(right) > 4 else 0.7 * half_w
    arm_z = float(band[:, 2].mean()) if len(band) else 0.0

    # Hand = the bottom of the two arm columns.
    outer = src[np.abs(src[:, 0]) > 0.82 * arm_x]
    hand_y = float(np.percentile(outer[:, 1], 4)) if len(outer) > 8 else y0 + 0.44 * S
    hand_y = min(max(hand_y, y0 + 0.40 * S), y0 + 0.62 * S)

    return dict(y0=float(y0), y1=float(y1), H=float(H), S=float(S), half_w=float(half_w),
                neck_y=float(neck_y), crotch_y=float(crotch_y), leg_x=leg_x, leg_z=leg_z,
                arm_x=arm_x, arm_z=arm_z, hand_y=hand_y)


def build(lm):
    """Return {bone: (parent, world position)} in mesh space."""
    y0, S = lm['y0'], lm['S']
    neck, crotch = lm['neck_y'], lm['crotch_y']
    hip_y = crotch + 0.06 * S
    shoulder_y = neck - 0.06 * S
    ax, az = lm['arm_x'], lm['arm_z']
    lx, lz = lm['leg_x'], lm['leg_z']
    hand_y = lm['hand_y']
    elbow_y = (shoulder_y + hand_y) * 0.5
    ankle_y = y0 + 0.05 * S
    knee_y = (hip_y + ankle_y) * 0.5

    B = {}

    def add(name, parent, p):
        B[name] = (parent, np.array(p, float))

    add('Root',    None,   [0, y0, 0])
    add('Hips',    'Root', [0, hip_y, lz * 0.3])
    add('Abdomen', 'Hips', [0, hip_y + (neck - hip_y) * 0.22, lz * 0.2])
    add('Torso',   'Abdomen', [0, hip_y + (neck - hip_y) * 0.45, 0])
    add('Chest',   'Torso',   [0, shoulder_y, 0])
    add('Neck',    'Chest',   [0, neck, 0])
    add('Head',    'Neck',    [0, neck + 0.11 * S, 0])

    for side, s in (('L', 1.0), ('R', -1.0)):
        add(f'Shoulder.{side}', 'Chest', [s * ax * 0.35, shoulder_y, az])
        add(f'UpperArm.{side}', f'Shoulder.{side}', [s * ax, shoulder_y - 0.02 * S, az])
        add(f'LowerArm.{side}', f'UpperArm.{side}', [s * ax, elbow_y, az])
        add(f'Wrist.{side}',    f'LowerArm.{side}', [s * ax, hand_y + 0.03 * S, az])
        add(f'Middle1.{side}',  f'Wrist.{side}',    [s * ax, hand_y, az])

        add(f'UpperLeg.{side}', 'Hips',             [s * lx, crotch, lz])
        add(f'LowerLeg.{side}', f'UpperLeg.{side}', [s * lx, knee_y, lz])
        add(f'Foot.{side}',     f'LowerLeg.{side}', [s * lx, ankle_y, lz])
    return B


# Bones a vertex may bind to, and the bone a named mesh group is pinned to.
def segments(B):
    """Bone segments (parent->child) used for distance based skinning."""
    segs = []
    for name, (parent, p) in B.items():
        if parent is None or parent == 'Root':
            continue
        segs.append((name, B[parent][1], p))
    return segs
