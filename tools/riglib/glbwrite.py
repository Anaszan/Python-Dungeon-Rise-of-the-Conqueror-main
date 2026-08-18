import numpy as np
from pygltflib import (GLTF2, Scene, Node, Mesh, Primitive, Attributes, Buffer, BufferView,
                       Accessor, Material, PbrMetallicRoughness, TextureInfo, Texture, Image,
                       Sampler, Skin, ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, FLOAT, UNSIGNED_INT,
                       UNSIGNED_SHORT, SCALAR, VEC2, VEC3, VEC4, MAT4)

COMPONENT = {np.dtype('float32'): FLOAT, np.dtype('uint32'): UNSIGNED_INT,
             np.dtype('uint16'): UNSIGNED_SHORT}
TYPE = {1: SCALAR, 2: VEC2, 3: VEC3, 4: VEC4, 16: MAT4}


class Builder:
    def __init__(self):
        self.g = GLTF2(scene=0, scenes=[Scene(nodes=[])], asset={'generator': 'rig_male.py', 'version': '2.0'})
        self.blob = bytearray()

    def _view(self, data, target=None):
        data = np.ascontiguousarray(data)
        pad = (-len(self.blob)) % 4
        self.blob.extend(b'\x00' * pad)
        offset = len(self.blob)
        self.blob.extend(data.tobytes())
        self.g.bufferViews.append(BufferView(buffer=0, byteOffset=offset,
                                             byteLength=data.nbytes, target=target))
        return len(self.g.bufferViews) - 1

    def accessor(self, data, target=None, minmax=False):
        data = np.ascontiguousarray(data)
        ncomp = 1 if data.ndim == 1 else data.shape[1]
        view = self._view(data, target)
        acc = Accessor(bufferView=view, componentType=COMPONENT[data.dtype], count=len(data),
                       type=TYPE[ncomp])
        if minmax:
            acc.min = data.min(axis=0).tolist()
            acc.max = data.max(axis=0).tolist()
        self.g.accessors.append(acc)
        return len(self.g.accessors) - 1

    def texture(self, uri):
        self.g.images.append(Image(uri=uri))
        if not self.g.samplers:
            self.g.samplers.append(Sampler(magFilter=9729, minFilter=9987, wrapS=10497, wrapT=10497))
        self.g.textures.append(Texture(sampler=0, source=len(self.g.images) - 1))
        return len(self.g.textures) - 1

    def material(self, name, texture_index):
        self.g.materials.append(Material(
            name=name, doubleSided=False,
            pbrMetallicRoughness=PbrMetallicRoughness(
                baseColorTexture=TextureInfo(index=texture_index),
                metallicFactor=0.0, roughnessFactor=0.85)))
        return len(self.g.materials) - 1

    def node(self, **kw):
        self.g.nodes.append(Node(**kw))
        return len(self.g.nodes) - 1

    def save(self, path):
        self.g.buffers.append(Buffer(byteLength=len(self.blob)))
        self.g.set_binary_blob(bytes(self.blob))
        self.g.save_binary(path)
