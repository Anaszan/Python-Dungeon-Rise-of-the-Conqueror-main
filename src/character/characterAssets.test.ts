// Model files live in public/ and are fetched by url, so nothing type-checks
// them: a renamed or missing .glb only shows up as a character silently
// falling back to the grey placeholder. Check they are on disk instead.
/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CHARACTER_ASSETS } from './characterAssets'
import { CHARACTER_CLASS_OPTIONS, GENDER_OPTIONS } from './characterOptions'
import { CAST_STYLES } from './cast'
import type { CharacterClass } from './characterOptions'

function publicPath(url: string) {
  return fileURLToPath(new URL(`../../public${url}`, import.meta.url))
}

function gltfJson(url: string) {
  const buffer = readFileSync(publicPath(url))
  return JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString()) as {
    materials?: { name: string }[]
    nodes?: { name: string }[]
    animations?: { name: string }[]
    skins?: { joints: number[] }[]
  }
}

describe('character models', () => {
  it('has an asset for every class the customize screen offers', () => {
    for (const gender of GENDER_OPTIONS) {
      for (const cls of CHARACTER_CLASS_OPTIONS) {
        expect(CHARACTER_ASSETS[gender.id][cls.id], `${gender.id}/${cls.id}`).toBeDefined()
      }
    }
  })

  it('ships every model file it points at, rigged', () => {
    for (const [gender, classes] of Object.entries(CHARACTER_ASSETS)) {
      for (const [cls, asset] of Object.entries(classes)) {
        const file = publicPath(asset.glb)
        expect(existsSync(file), `${gender}/${cls}: missing ${asset.glb}`).toBe(true)

        // glTF binary: magic 'glTF', then a JSON chunk. Both genders must be
        // skinned — the shared model path renders them in their bind pose and
        // hangs weapons off a bone, neither of which works on a bare mesh.
        const buffer = readFileSync(file)
        expect(buffer.subarray(0, 4).toString(), `${asset.glb} is not a .glb`).toBe('glTF')
        const json = buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString()
        expect(json, `${asset.glb} has no skin`).toContain('"skins"')
      }
    }
  })

  // The skin/shirt tints are matched by name against the loaded model, so a
  // typo (or a repacked .glb that renamed something) would silently leave the
  // player's color picker with nothing to paint. Check the names are in there.
  it('names surfaces the color pickers can actually find', () => {
    for (const [gender, classes] of Object.entries(CHARACTER_ASSETS)) {
      for (const [cls, asset] of Object.entries(classes)) {
        const { materials = [], nodes = [] } = gltfJson(asset.glb)
        const materialNames = materials.map((m) => m.name)
        // GLTFLoader strips dots out of node names, so compare like for like.
        const nodeNames = nodes.map((n) => n.name.replace(/\./g, ''))
        const where = `${gender}/${cls}`

        for (const material of [asset.skinMaterial, asset.shirtMaterial, ...Object.keys(asset.recolor ?? {})]) {
          if (material === undefined) continue
          expect(materialNames, `${where}: no material named ${material}`).toContain(material)
        }
        if (asset.skinMesh !== undefined) {
          expect(
            nodeNames.some((name) => name.includes(asset.skinMesh as string)),
            `${where}: no mesh matching ${asset.skinMesh}`,
          ).toBe(true)
        }
        for (const mesh of asset.shirtMeshes ?? []) {
          expect(nodeNames, `${where}: no mesh named ${mesh}`).toContain(mesh)
        }

        // Either a material or a mesh has to be selected, or the shirt picker
        // does nothing for this character.
        expect(
          asset.shirtMaterial !== undefined || (asset.shirtMeshes?.length ?? 0) > 0,
          `${where}: nothing follows the shirt color`,
        ).toBe(true)
      }
    }
  })

  // Every model can walk, by one of the two routes in character/gait.ts —
  // either it ships the clips, or it has the bones the hand-posed gait swings.
  // A model with neither would just glide along the floor in its bind pose.
  it('can be walked, by clip or by bone', () => {
    const POSED_BONES = ['UpperLeg.L', 'UpperLeg.R', 'LowerLeg.L', 'LowerLeg.R', 'UpperArm.L', 'UpperArm.R', 'Torso']

    for (const [gender, classes] of Object.entries(CHARACTER_ASSETS)) {
      for (const [cls, asset] of Object.entries(classes)) {
        const { animations = [], skins = [], nodes = [] } = gltfJson(asset.glb)
        const where = `${gender}/${cls}`

        if (animations.length > 0) {
          for (const suffix of ['|Walk', '|Idle']) {
            expect(
              animations.some((clip) => clip.name.endsWith(suffix)),
              `${where}: no ${suffix} clip`,
            ).toBe(true)
          }
          continue
        }

        const joints = (skins[0]?.joints ?? []).map((index) => nodes[index].name)
        for (const bone of POSED_BONES) {
          expect(joints, `${where}: hand-posed gait needs a ${bone} bone`).toContain(bone)
        }
      }
    }
  })

  // Same idea for the cast (character/cast.ts): every class casts by one of
  // the two routes, and a model that supports neither would fire its spell
  // standing perfectly still. Both routes are named against the model file, so
  // nothing but this catches a renamed clip or a rig missing an arm.
  it('can cast, by clip or by bone', () => {
    // The hand-posed cast reaches further up the body than the gait does.
    const CAST_BONES = [
      'Torso',
      'Chest',
      'Head',
      'Shoulder.R',
      'UpperArm.R',
      'LowerArm.R',
      'Wrist.R',
      'UpperArm.L',
      'LowerArm.L',
    ]

    for (const [gender, classes] of Object.entries(CHARACTER_ASSETS)) {
      for (const [cls, asset] of Object.entries(classes)) {
        const { animations = [], skins = [], nodes = [] } = gltfJson(asset.glb)
        const where = `${gender}/${cls}`
        const style = CAST_STYLES[cls as CharacterClass]

        if (animations.length > 0) {
          expect(
            animations.some((clip) => clip.name.endsWith(style.clip)),
            `${where}: no ${style.clip} clip to cast with`,
          ).toBe(true)
          continue
        }

        const joints = (skins[0]?.joints ?? []).map((index) => nodes[index].name)
        for (const bone of CAST_BONES) {
          expect(joints, `${where}: hand-posed cast needs a ${bone} bone`).toContain(bone)
        }
      }
    }
  })
})
