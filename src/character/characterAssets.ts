import type { CharacterClass, CharacterGender } from './characterOptions'
import type { ShirtTarget } from './shirtTexture'

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
  // Which surface follows the player's chosen shirt color — the same
  // material-name / mesh-name split as the skin fields above, and for the same
  // reason. On the women's packs one flat material is the garment, so the
  // swatch is simply assigned to it. The men's models share one painted atlas
  // across the body, so there the garment is found in the texture instead
  // (shirtTarget) and the repainted copy goes on these meshes. Names are as
  // GLTFLoader exposes them, i.e. with dots stripped ('ShoulderPad.R' in the
  // file -> 'ShoulderPadR' here).
  shirtMaterial?: string
  shirtMeshes?: string[]
  shirtTarget?: ShirtTarget
  // Roughly the color the outfit already looks like. The women's models are
  // literally set to it until the player picks something (it is their
  // material's own color); the men's textures are left alone, and it only
  // colors the "keep the original outfit" swatch on the customize screen.
  defaultShirtColor: string
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
    warrior: {
      glb: '/models/warrior/Warrior.glb',
      skinMesh: 'Face',
      shirtMeshes: ['Warrior_Body', 'ShoulderPadR', 'ShoulderPadL'],
      // His plate is the only near-grey thing on the sheet; the leather, the
      // red tabard and his bare hands all keep their own color.
      shirtTarget: { kind: 'desaturated', maxSat: 0.09, minLightness: 0.15 },
      defaultShirtColor: '#7c828b',
    },
    cleric: {
      glb: '/models/cleric/Cleric.glb',
      skinMesh: 'Head',
      shirtMeshes: ['Cleric', 'ShoulderPads'],
      // The undyed robe. His beard is just as pale but sits on the head mesh,
      // which keeps the untouched texture.
      shirtTarget: { kind: 'desaturated', maxSat: 0.09, minLightness: 0.15 },
      defaultShirtColor: '#c8c2ad',
    },
    wizard: {
      glb: '/models/wizard/Wizard.glb',
      skinMesh: 'Face',
      shirtMeshes: ['Wizard', 'ShoulderPadL', 'ShoulderPadR', 'Pouch'],
      // Nothing else on his sheet is blue, so the robe recolors on its own and
      // the gold trim survives.
      shirtTarget: { kind: 'hue', hue: 222, tolerance: 40, minSat: 0.2 },
      defaultShirtColor: '#2f4f9e',
    },
    rogue: {
      glb: '/models/rogue/Rogue.glb',
      skinMesh: 'Face',
      shirtMeshes: ['Rogue', 'Guard', 'Belt', 'Pouch'],
      shirtTarget: { kind: 'hue', hue: 350, tolerance: 25, minSat: 0.2 },
      defaultShirtColor: '#7d2733',
    },
  },
  female: {
    warrior: {
      glb: '/models/female/HoodedAdventurer.glb',
      skinMaterial: 'Skin',
      // Her hood and cloak share one material; the black tunic and leggings
      // underneath stay put so the outfit keeps its shading.
      shirtMaterial: 'DarkBrown',
      defaultShirtColor: '#492e18',
    },
    rogue: {
      glb: '/models/female/Adventurer.glb',
      skinMaterial: 'Skin',
      shirtMaterial: 'LightGreen',
      defaultShirtColor: '#595236',
      weapon: 'dagger',
    },
    wizard: {
      glb: '/models/female/Witch.glb',
      skinMaterial: 'Skin',
      // The robe, hat and skirt are one material on this mesh.
      shirtMaterial: 'Purple',
      defaultShirtColor: '#421968',
      weapon: 'staff',
      staffOrbColor: '#8be3ff',
    },
    cleric: {
      glb: '/models/female/Witch.glb',
      skinMaterial: 'Skin',
      shirtMaterial: 'Purple',
      // Same mesh as the wizard, so the cleric's robe starts cream instead of
      // purple (plus the trim recolors below) to keep the two apart.
      defaultShirtColor: '#e9e1cd',
      recolor: {
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
