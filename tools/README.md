# tools/

## rig_male.py — give the men's class models a skeleton

The women's models (`public/models/female`) ship from Quaternius as rigged
`.glb`. The men's (`public/models/<class>`) ship from the same artist as static
textured `.obj`, so the game used to carry two different model paths, and the
male characters could never be animated.

`rig_male.py` closes that gap without touching the artwork. For each class it

1. reads the `.obj`, keeping every `o` group and its UVs intact,
2. measures the mesh (neck, crotch, arm and leg centre lines, hand height) and
   fits a 23-bone humanoid skeleton to the model *as it already stands*,
   naming the bones after the women pack's rig — `Hips`, `Chest`, `UpperArm.L`,
   `Middle1.R` (the grip bone the game hangs weapons off), and so on,
3. skins the body by distance to the nearest bones, and pins the parts that
   should not blend at all: the face to `Head`, each shoulder pad to its
   `Shoulder.*`, the held weapon to the grip bone,
4. writes a `.glb` next to the `.obj`, with the textures still referenced as
   sibling `.png` files rather than embedded.

Because the skeleton is fitted to the existing pose and the inverse bind
matrices are taken from that same pose, a rigged model in its bind pose renders
pixel-identical to the `.obj` it came from — verified by rendering both through
three.js and diffing.

### Running it

```
pip install numpy pygltflib
python3 tools/rig_male.py public/models public/models
```

Only needed if the source `.obj` files change; the generated `.glb` files are
committed.
