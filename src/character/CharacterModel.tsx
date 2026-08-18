import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import type { CharacterClass, CharacterGender } from './characterOptions'
import { DEFAULT_GENDER } from './characterOptions'
import { CHARACTER_ASSETS, type ClassAsset } from './characterAssets'

const SKIN_FALLBACK_COLOR = '#e0b48a'
const ROBE_COLOR = '#4a4030'
const BLADE_COLOR = '#c9ccd6'
const HAIR_COLOR = '#3b2416'

export type CharacterAppearance = {
  characterClass: CharacterClass
  gender: CharacterGender
  skinColor: string
  // null (or absent, for saves written before the shirt picker existed) keeps
  // the outfit's own color — see defaultShirtColor in characterAssets.ts.
  shirtColor?: string | null
}

// Target vertical footprint every player model (procedural or real) fits
// into, matching the old single-capsule model so ground contact / camera
// framing in Player.tsx need no retuning.
const MODEL_HEIGHT = 1.3
const MODEL_FEET_Y = -0.65

// Where a weapon goes in the rig. The values are the local transform of the
// sword that ships parented to the right hand inside HoodedAdventurer.glb —
// every model in the women pack shares one armature, and rig_male.py names the
// men's bones to match, so the same grip works on all of them. Note the
// women's rig is authored at 1/100 scale (its armature node scales by 100),
// which is why these numbers look tiny; the weapon meshes themselves are built
// in normal model units and scaled by the bone's own world scale at attach
// time, which keeps the same grip correct on the men's 1:1 rig.
//
// The bone is named `Middle1.R` in both files; GLTFLoader strips the dot.
const GRIP_BONE = 'Middle1R'
const GRIP_POSITION: [number, number, number] = [-0.0000042, 0.0009108, -0.0002511]
const GRIP_QUATERNION: [number, number, number, number] = [0.0006481, 0, -0.7120197, 0.7021592]

// Kept for the procedural fallback only: if a real model fails to load there
// is no mesh left to swap, so that placeholder is reshaped instead.
const GENDER_PROPORTIONS: Record<CharacterGender, { width: number; height: number }> = {
  male: { width: 1.1, height: 1.05 },
  female: { width: 0.9, height: 0.95 },
}

// Tied-back hair, added behind the head mesh for female characters. Sized in
// model-height units so it stays proportional whatever the class model
// scaled to.
function Ponytail({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshStandardMaterial color={HAIR_COLOR} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, -0.15, -0.03]} rotation={[-0.22, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.025, 0.28, 8]} />
        <meshStandardMaterial color={HAIR_COLOR} roughness={0.8} />
      </mesh>
    </group>
  )
}

// Guaranteed fallback if a class's real model fails to load: a plain
// low-poly humanoid with the head/hands tinted by skinColor and the torso and
// sleeves by shirtColor, the same two-way split the real models get.
function ProceduralCharacterModel({
  skinColor,
  shirtColor,
  gender,
}: {
  skinColor: string
  shirtColor: string
  gender: CharacterGender
}) {
  const { width, height } = GENDER_PROPORTIONS[gender]
  return (
    <group scale={[width, height, width]} position={[0, MODEL_FEET_Y * (1 - height), 0]}>
      <mesh castShadow position={[-0.12, -0.42, 0]}>
        <boxGeometry args={[0.16, 0.55, 0.18]} />
        <meshStandardMaterial color={ROBE_COLOR} />
      </mesh>
      <mesh castShadow position={[0.12, -0.42, 0]}>
        <boxGeometry args={[0.16, 0.55, 0.18]} />
        <meshStandardMaterial color={ROBE_COLOR} />
      </mesh>

      <mesh castShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[0.5, 0.48, 0.3]} />
        <meshStandardMaterial color={shirtColor} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh castShadow position={[side * 0.32, 0.1, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.42, 8]} />
            <meshStandardMaterial color={shirtColor} />
          </mesh>
          <mesh castShadow position={[side * 0.32, -0.14, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={skinColor} />
          </mesh>
        </group>
      ))}

      <mesh castShadow position={[0, 0.52, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      {gender === 'female' && <Ponytail position={[0, 0.58, -0.17]} />}

      <group position={[0.32, -0.1, 0.16]} rotation={[0, 0, Math.PI * 0.08]}>
        <mesh castShadow position={[0, 0.32, 0]}>
          <boxGeometry args={[0.05, 0.55, 0.03]} />
          <meshStandardMaterial color={BLADE_COLOR} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

// Drops a loaded model into the slot every character shares: scaled so it
// stands MODEL_HEIGHT tall, then shifted so its feet land on MODEL_FEET_Y
// and it is centred on the spot it stands on.
function fitToPlayerSlot(model: THREE.Object3D) {
  model.updateMatrixWorld(true)
  const rawSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
  model.scale.setScalar(rawSize.y > 0 ? MODEL_HEIGHT / rawSize.y : 1)

  model.updateMatrixWorld(true)
  const scaledBox = new THREE.Box3().setFromObject(model)
  const center = scaledBox.getCenter(new THREE.Vector3())
  model.position.set(-center.x, MODEL_FEET_Y - scaledBox.min.y, -center.z)
}

// Weapons for the outfits that ship empty-handed, built in normal
// model units (the caller rescales them into the rig's units). The blade
// hangs down -Y from the fist, matching the pack's own sword.
function buildDagger() {
  const group = new THREE.Group()
  const steel = new THREE.MeshStandardMaterial({ color: BLADE_COLOR, metalness: 0.6, roughness: 0.3 })
  const grip = new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 0.9 })

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.14, 8), grip)
  handle.position.y = 0.05
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.045), steel)
  guard.position.y = -0.025
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.016), steel)
  blade.position.y = -0.21

  for (const mesh of [handle, guard, blade]) {
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

function buildStaff(orbColor: string) {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.9 })

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 1, 8), wood)
  shaft.position.y = 0.15
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 12, 12),
    new THREE.MeshStandardMaterial({ color: orbColor, emissive: orbColor, emissiveIntensity: 0.6 }),
  )
  orb.position.y = 0.68

  for (const mesh of [shaft, orb]) {
    mesh.castShadow = true
    group.add(mesh)
  }
  return group
}

// `upright` is for staffs: a staff copying the sword's grip would stick
// straight out in front of her, so instead the bone's own world rotation is
// cancelled out, leaving the shaft vertical in model space while still
// starting from her fist.
function attachWeapon(root: THREE.Object3D, weapon: THREE.Group, upright: boolean) {
  const bone = root.getObjectByName(GRIP_BONE)
  if (!bone) return

  root.updateMatrixWorld(true)
  const boneScale = bone.getWorldScale(new THREE.Vector3()).x
  weapon.scale.setScalar(boneScale > 0 ? 1 / boneScale : 1)
  weapon.position.fromArray(GRIP_POSITION)
  if (upright) weapon.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert())
  else weapon.quaternion.fromArray(GRIP_QUATERNION)
  bone.add(weapon)
}

// Paints the chosen shirt color onto one outfit material.
//
// The women's packs are flat-colored, so their swatch is used exactly as
// picked. The men's are texture-painted and multiply this color into the
// texture, where a mid-tone swatch would come out near-black (the same
// flattening that keeps the skin tint off their body meshes) — so there the
// tint is pushed up to full brightness first, which keeps the hue the player
// picked and leaves the shading to the texture underneath.
function applyShirtTint(material: THREE.MeshStandardMaterial, shirtColor: string) {
  material.color.set(shirtColor)
  if (!material.map) return
  const peak = Math.max(material.color.r, material.color.g, material.color.b)
  if (peak > 0) material.color.multiplyScalar(1 / peak)
}

// The player model for one class/gender: the matching rigged .glb, rendered in
// its bind pose (the packs' animation clips go unused) so the character just
// stands there.
function RiggedCharacterModel({
  asset,
  skinColor,
  shirtColor,
}: {
  asset: ClassAsset
  skinColor: string
  shirtColor: string
}) {
  const { scene } = useGLTF(asset.glb)

  const fitted = useMemo(() => {
    // Skinned meshes can't be shared between canvases — the player, the
    // profile portrait and the combat portrait can all be on screen at once,
    // and each canvas needs its own object graph — so this clones the skeleton
    // too rather than the scene graph alone.
    const clone = cloneSkinned(scene)

    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      child.castShadow = true
      const source = child.material as THREE.MeshStandardMaterial
      const material = source.clone()
      const isSkin =
        (asset.skinMaterial !== undefined && source.name === asset.skinMaterial) ||
        (asset.skinMesh !== undefined && child.name.includes(asset.skinMesh))
      const isShirt =
        (asset.shirtMaterial !== undefined && source.name === asset.shirtMaterial) ||
        (asset.shirtMeshes?.includes(child.name) ?? false)
      // Skin wins where the two overlap: on the men's models the shirt meshes
      // are whole bodies, and their face must stay the skin color.
      if (isSkin) material.color.set(skinColor)
      else if (isShirt) applyShirtTint(material, shirtColor)
      else if (asset.recolor?.[source.name]) material.color.set(asset.recolor[source.name])
      child.material = material
    })

    fitToPlayerSlot(clone)

    if (asset.weapon === 'dagger') attachWeapon(clone, buildDagger(), false)
    if (asset.weapon === 'staff') attachWeapon(clone, buildStaff(asset.staffOrbColor ?? '#8be3ff'), true)

    return clone
  }, [scene, skinColor, shirtColor, asset])

  return <primitive object={fitted} />
}

class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// A plain low-poly humanoid stands in as the guaranteed model; the real
// CC0 class model (loaded async) replaces it once ready, and any load/parse
// failure falls back to the procedural model instead of breaking the scene.
export function CharacterModel({ appearance }: { appearance: CharacterAppearance }) {
  const gender = appearance.gender ?? DEFAULT_GENDER
  const skinColor = appearance.skinColor ?? SKIN_FALLBACK_COLOR
  const asset = CHARACTER_ASSETS[gender][appearance.characterClass]
  // No pick yet: the real model keeps the color its outfit ships in, and the
  // placeholder (which has no outfit of its own) keeps its robe brown.
  const shirtColor = appearance.shirtColor ?? asset.defaultShirtColor
  const fallback = (
    <ProceduralCharacterModel
      skinColor={skinColor}
      shirtColor={appearance.shirtColor ?? ROBE_COLOR}
      gender={gender}
    />
  )
  return (
    <ModelErrorBoundary key={`${appearance.characterClass}-${gender}`} fallback={fallback}>
      <Suspense fallback={fallback}>
        <RiggedCharacterModel asset={asset} skinColor={skinColor} shirtColor={shirtColor} />
      </Suspense>
    </ModelErrorBoundary>
  )
}
