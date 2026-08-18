import re

WEAPON_WORDS = ('Sword', 'Staff', 'Dagger')
HEAD_WORDS = ('Face', 'Head')
PAD_WORDS = ('ShoulderPad',)


_TRAILING_INDEX = re.compile(r'\.\d+$')
_PRIMITIVE_SUFFIX = re.compile(r'_(Cylinder|Torus|Cube|Sphere|Plane|Circle)$')


def base_name(raw):
    """`Warrior_Body__ncl1_29.005` -> `Warrior_Body`, `ShoulderPad.L__ncl1_29.000`
    -> `ShoulderPad.L`. Blender's numeric duplicate suffix goes; the `.L`/`.R`
    side marker stays, so left and right parts keep distinct names."""
    return _PRIMITIVE_SUFFIX.sub('', _TRAILING_INDEX.sub('', raw.split('__')[0]))


def kind(raw):
    n = base_name(raw)
    if any(w in n for w in WEAPON_WORDS):
        return 'weapon'
    if any(w in n for w in PAD_WORDS):
        return 'pad'
    if n in HEAD_WORDS or n.startswith(HEAD_WORDS):
        return 'head'
    return 'body'
