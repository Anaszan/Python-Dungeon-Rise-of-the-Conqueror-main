import numpy as np


def _seg_distance(P, a, b):
    ab = b - a
    L2 = float(ab @ ab)
    t = np.zeros(len(P)) if L2 == 0 else np.clip((P - a) @ ab / L2, 0.0, 1.0)
    proj = a + t[:, None] * ab
    return np.linalg.norm(P - proj, axis=1)


def weights_for(P, segs, k=4, falloff=4.0):
    """Inverse-distance skin weights against the bone segments nearest each vertex."""
    names = [s[0] for s in segs]
    D = np.stack([_seg_distance(P, s[1], s[2]) for s in segs], axis=1)
    order = np.argsort(D, axis=1)[:, :k]
    d = np.take_along_axis(D, order, axis=1)
    w = 1.0 / np.power(d + 1e-4, falloff)
    w /= w.sum(axis=1, keepdims=True)
    return order, w, names


def pinned(n, joint_index, k=4):
    """All weight on a single joint — used for heads, pads and held weapons."""
    j = np.zeros((n, k), np.uint16); w = np.zeros((n, k), np.float32)
    j[:, 0] = joint_index; w[:, 0] = 1.0
    return j, w
