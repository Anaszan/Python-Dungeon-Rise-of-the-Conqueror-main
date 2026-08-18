"""Minimal Wavefront OBJ reader that keeps `o` groups, quads and UVs intact."""
import numpy as np


def parse_obj(path):
    pos, uv, nrm = [], [], []
    groups = []          # list of dicts: name, material, faces(list of vert-key tuples)
    cur = None
    material = None

    def key(tok):
        parts = (tok.split('/') + ['', ''])[:3]
        vi = int(parts[0]); ti = int(parts[1]) if parts[1] else 0; ni = int(parts[2]) if parts[2] else 0
        vi = vi - 1 if vi > 0 else len(pos) + vi
        ti = ti - 1 if ti > 0 else (len(uv) + ti if ti else -1)
        ni = ni - 1 if ni > 0 else (len(nrm) + ni if ni else -1)
        return (vi, ti, ni)

    for line in open(path, 'r', encoding='utf-8', errors='ignore'):
        if line.startswith('v '):
            pos.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):
            uv.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('vn '):
            nrm.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('o '):
            cur = {'name': line.split(None, 1)[1].strip(), 'faces': [], 'material': material}
            groups.append(cur)
        elif line.startswith('usemtl '):
            material = line.split(None, 1)[1].strip()
            if cur is not None and not cur['faces']:
                cur['material'] = material
        elif line.startswith('f '):
            if cur is None:
                cur = {'name': 'default', 'faces': [], 'material': material}
                groups.append(cur)
            toks = line.split()[1:]
            ring = [key(t) for t in toks]
            for i in range(1, len(ring) - 1):       # fan-triangulate quads/ngons
                cur['faces'].append((ring[0], ring[i], ring[i + 1]))

    return np.array(pos, float), np.array(uv, float), np.array(nrm, float), groups


def group_arrays(pos, uv, nrm, group):
    """De-duplicate (v,vt,vn) triples into flat vertex arrays + index buffer."""
    lookup, P, T, N, idx = {}, [], [], [], []
    for tri in group['faces']:
        for k in tri:
            j = lookup.get(k)
            if j is None:
                j = len(P)
                lookup[k] = j
                P.append(pos[k[0]])
                T.append(uv[k[1]] if k[1] >= 0 and len(uv) else [0.0, 0.0])
                N.append(nrm[k[2]] if k[2] >= 0 and len(nrm) else [0.0, 1.0, 0.0])
            idx.append(j)
    T = np.array(T, np.float32)
    T[:, 1] = 1.0 - T[:, 1]                          # OBJ uv origin is bottom-left
    return np.array(P, np.float32), T, np.array(N, np.float32), np.array(idx, np.uint32)
