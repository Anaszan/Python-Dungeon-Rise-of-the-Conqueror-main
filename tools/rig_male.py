#!/usr/bin/env python3
"""Turn the static male .obj class models into rigged .glb, so both genders
load through the same skinned-GLTF path as the women pack.

The mesh geometry is untouched: the skeleton is fitted to the model as it
already stands, and the inverse bind matrices are taken from that same pose, so
a rigged model in its bind pose renders pixel-identical to the .obj it came
from. What is gained is a skeleton (same bone names as the women pack, grip
bone included) that animation can drive later.

Usage: python3 rig_male.py <src-models-dir> <out-models-dir>
"""
import sys, os
import numpy as np

from riglib.measure import read_model, fit
from riglib import skeleton
from riglib.objparse import group_arrays
from riglib.skinning import weights_for, pinned
from riglib.glbwrite import Builder
from pygltflib import Primitive, Attributes, Mesh, Skin, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER

CLASSES = {
    'warrior': ('Warrior.obj',  'Warrior.glb'),
    'rogue':   ('Rogue.obj',    'Rogue.glb'),
    'wizard':  ('Wizard.obj',   'Wizard.glb'),
    'cleric':  ('Cleric.obj',   'Cleric.glb'),
}
GRIP_BONE = 'Middle1.R'


def bone_nodes(builder, B):
    """Create one node per bone, parents first, and return name -> node index."""
    order, seen = [], set()

    def visit(name):
        if name in seen:
            return
        parent = B[name][0]
        if parent is not None:
            visit(parent)
        seen.add(name); order.append(name)

    for name in B:
        visit(name)

    index = {}
    for name in order:
        parent, p = B[name]
        origin = B[parent][1] if parent is not None else np.zeros(3)
        index[name] = builder.node(name=name, translation=(p - origin).tolist())
    for name in order:
        parent = B[name][0]
        if parent is not None:
            node = builder.g.nodes[index[parent]]
            node.children = (node.children or []) + [index[name]]
    return order, index


def inverse_bind(B, order):
    """Bind pose is the fitted pose, so each inverse bind matrix is just a
    translation by -worldPosition (column-major, as glTF stores them)."""
    M = np.zeros((len(order), 16), np.float32)
    for i, name in enumerate(order):
        p = B[name][1]
        M[i] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -p[0], -p[1], -p[2], 1]
    return M


def convert(obj_path, glb_path):
    pos, uv, nrm, groups = read_model(obj_path)
    lm, B = fit(pos, groups)
    segs = skeleton.segments(B)

    builder = Builder()
    root = builder.node(name='RootNode', children=[])
    order, jindex = bone_nodes(builder, B)
    armature = builder.node(name='CharacterArmature', children=[jindex['Root']])

    # JOINTS_0 indexes into skin.joints, not into the node array.
    joint_slot = {name: i for i, name in enumerate(order)}

    ibm = builder.accessor(inverse_bind(B, order))
    builder.g.skins.append(Skin(name='CharacterSkin', skeleton=jindex['Root'],
                                joints=[jindex[n] for n in order],
                                inverseBindMatrices=ibm))
    skin_index = 0

    textures, materials = {}, {}

    def material_for(mtl):
        if mtl not in materials:
            if mtl not in textures:
                textures[mtl] = builder.texture(f'{mtl}.png')
            materials[mtl] = builder.material(mtl, textures[mtl])
        return materials[mtl]

    mesh_nodes = []
    for g in groups:
        P, T, N, I = group_arrays(pos, uv, nrm, g)
        n = len(P)

        if g['kind'] == 'weapon':
            J, W = pinned(n, joint_slot[GRIP_BONE])
        elif g['kind'] == 'head':
            J, W = pinned(n, joint_slot['Head'])
        elif g['kind'] == 'pad':
            J, W = pinned(n, joint_slot['Shoulder.L' if P[:, 0].mean() >= 0 else 'Shoulder.R'])
        else:
            picks, w, names = weights_for(P, segs)
            J = np.vectorize(lambda i: joint_slot[names[i]])(picks).astype(np.uint16)
            W = w.astype(np.float32)

        prim = Primitive(
            attributes=Attributes(
                POSITION=builder.accessor(P, ARRAY_BUFFER, minmax=True),
                NORMAL=builder.accessor(N, ARRAY_BUFFER),
                TEXCOORD_0=builder.accessor(T, ARRAY_BUFFER),
                JOINTS_0=builder.accessor(np.ascontiguousarray(J, np.uint16), ARRAY_BUFFER),
                WEIGHTS_0=builder.accessor(np.ascontiguousarray(W, np.float32), ARRAY_BUFFER),
            ),
            indices=builder.accessor(I.astype(np.uint32), ELEMENT_ARRAY_BUFFER),
            material=material_for(g['material']),
        )
        builder.g.meshes.append(Mesh(name=g['base'], primitives=[prim]))
        mesh_nodes.append(builder.node(name=g['base'], mesh=len(builder.g.meshes) - 1, skin=skin_index))

    builder.g.nodes[root].children = [armature] + mesh_nodes
    builder.g.scenes[0].nodes = [root]
    os.makedirs(os.path.dirname(glb_path), exist_ok=True)
    builder.save(glb_path)
    return lm


if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    for cls, (obj, glb) in CLASSES.items():
        lm = convert(os.path.join(src, cls, obj), os.path.join(out, cls, glb))
        size = os.path.getsize(os.path.join(out, cls, glb))
        print(f'{cls:8s} -> {glb:14s} {size/1024:7.0f} KB   '
              f'neck={lm["neck_y"]:.2f} crotch={lm["crotch_y"]:.2f} '
              f'arm_x={lm["arm_x"]:.2f} hand_y={lm["hand_y"]:.2f}')
