import numpy as np
from .objparse import parse_obj
from .classify import kind, base_name
from . import skeleton


def read_model(path):
    pos, uv, nrm, groups = parse_obj(path)
    for g in groups:
        g['kind'] = kind(g['name'])
        g['base'] = base_name(g['name'])
        g['verts'] = np.array(sorted({k[0] for f in g['faces'] for k in f}), int)
    return pos, uv, nrm, groups


def fit(pos, groups):
    def cloud(pred):
        idx = np.concatenate([g['verts'] for g in groups if pred(g)]) if any(pred(g) for g in groups) else None
        return pos[idx] if idx is not None else None

    body = cloud(lambda g: g['kind'] != 'weapon')
    head = cloud(lambda g: g['kind'] == 'head')
    arms = cloud(lambda g: g['kind'] == 'body')
    lm = skeleton.landmarks(body, head, arms)
    return lm, skeleton.build(lm)
