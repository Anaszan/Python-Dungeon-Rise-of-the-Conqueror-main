// Model files live in public/ and are fetched by url, so nothing type-checks
// them: a renamed or missing .glb only shows up as a character silently
// falling back to the grey placeholder. Check they are on disk instead.
/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CHARACTER_ASSETS } from './characterAssets'
import { CHARACTER_CLASS_OPTIONS, GENDER_OPTIONS } from './characterOptions'

function publicPath(url: string) {
  return fileURLToPath(new URL(`../../public${url}`, import.meta.url))
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
})
