import type { CharacterClass, CharacterGender } from './characterOptions'

// Which model file each class/gender combination loads, and how to dress it.
// Kept apart from CharacterModel.tsx so the paths can be checked against
// public/ from a test without pulling three.js into node.
//
//   female -> "Ultimate Modular Women Pack" by Quaternius
//             (public/models/female), shipped rigged, flat-colored materials
//             and no texture pages.
//   male   -> "LowPoly RPG Characters" by the same artist
//             (public/models/<class>), which ships as static textured .obj.
//             tools/rig_male.py fits a skeleton to each of those meshes and
//             writes the .glb loaded here; the geometry is untouched and the
//             bind pose is the pose the .obj already stood in, so the rigged
//             model renders identically to the mesh it came from.
//
// Both packs are CC0 1.0; see the License.txt next to each set.
export type ClassAsset = {
  glb: string
  // Which surface follows the player's chosen skin color. The women pack has
  // flat-colored materials, so a material name picks the bare skin out. The
  // men's models are texture-painted instead, and tinting the whole model
  // washed the armor/robe detail out to a dark silhouette in earlier testing —
  // so there a mesh name selects the bare face and nothing else.
  skinMaterial?: string
  skinMesh?: string
  // Material name (from the .glb) -> replacement color, for reusing one
  // outfit across two classes.
  recolor?: Record<string, string>
  // Filled in for outfits that ship empty-handed; the men's models already
  // carry their weapon as part of the mesh.
  weapon?: 'dagger' | 'staff'
  staffOrbColor?: string
}

// Only three female meshes cover four classes: the witch dresses both caster
// classes, recolored white/gold for the cleric so the two never look like the
// same character.
export const CHARACTER_ASSETS: Record<CharacterGender, Record<CharacterClass, ClassAsset>> = {
  male: {
    warrior: { glb: '/models/warrior/Warrior.glb', skinMesh: 'Face' },
    cleric: { glb: '/models/cleric/Cleric.glb', skinMesh: 'Head' },
    wizard: { glb: '/models/wizard/Wizard.glb', skinMesh: 'Face' },
    rogue: { glb: '/models/rogue/Rogue.glb', skinMesh: 'Face' },
  },
  female: {
    warrior: { glb: '/models/female/HoodedAdventurer.glb', skinMaterial: 'Skin' },
    rogue: { glb: '/models/female/Adventurer.glb', skinMaterial: 'Skin', weapon: 'dagger' },
    wizard: {
      glb: '/models/female/Witch.glb',
      skinMaterial: 'Skin',
      weapon: 'staff',
      staffOrbColor: '#8be3ff',
    },
    cleric: {
      glb: '/models/female/Witch.glb',
      skinMaterial: 'Skin',
      recolor: {
        Purple: '#e9e1cd',
        Gold: '#c9a227',
        Brown2: '#7c6a48',
        Hair_Black: '#7a5230',
        Brown: '#4a3b2a',
      },
      weapon: 'staff',
      staffOrbColor: '#ffd98a',
    },
  },
}
