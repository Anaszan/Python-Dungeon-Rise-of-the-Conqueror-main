import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// The walk cycle, for two rigs that need completely different treatment.
//
// The women's packs ship a full set of authored clips, so their walk is the
// artist's own Walk (and Idle) crossfaded on the spot. The men's models were
// rigged from static .obj by tools/rig_male.py and carry no clips at all — but
// that rig puts every bone at identity rotation with Y up and the model facing
// +Z, which is exactly the frame a hand-posed gait needs: a rotation about a
// bone's own X axis swings that limb forward or back. So theirs is posed here.
//
// Both are driven at the same cadence so switching gender never changes how
// fast the character's feet move.

// Strides per second, where one cycle is two steps — so this is a two-steps-a-
// second walking cadence, and both rigs are held to it.
//
// It is a pace, not a copy of the artwork: the women's Walk clip is authored
// as a 1.67s amble, which is why it plays back at roughly 1.7x here. Their
// stride still covers less ground than the player actually travels (a 1.3-unit
// character crossing 4.8 units a second is moving faster than any real walk),
// so the feet do skate a little. Raising this hides that but turns the walk
// into a scurry; it was traded off by eye against PLAYER_SPEED, and the two
// belong together — change one and the other wants revisiting.
export const GAIT_CYCLES_PER_SECOND = 1.0
// Seconds to crossfade between standing and walking.
const GAIT_FADE = 0.22
// How fast the hand-posed gait eases in and out, per second.
const GAIT_DAMP = 9

const WALK_CLIP = '|Walk'
const IDLE_CLIP = '|Idle'

// --- authored clips (the women's packs) -------------------------------------

function findClip(clips: THREE.AnimationClip[], suffix: string) {
  return clips.find((clip) => clip.name.endsWith(suffix)) ?? null
}

// Deliberately not drei's useAnimations: it caches its actions against the
// root it first saw, and this model is rebuilt from scratch whenever the
// player changes a color — which would leave the new body standing in its bind
// pose while the old one kept walking.
export function useClipGait(root: THREE.Object3D, clips: THREE.AnimationClip[], moving: boolean) {
  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root])

  const actions = useMemo(() => {
    const walk = findClip(clips, WALK_CLIP)
    const idle = findClip(clips, IDLE_CLIP)
    return {
      walk: walk ? mixer.clipAction(walk) : null,
      idle: idle ? mixer.clipAction(idle) : null,
    }
  }, [mixer, clips])

  useEffect(() => {
    const action = moving ? actions.walk : actions.idle
    if (!action) return
    // The clip's own length sets its stride, so pace it by how long it is
    // rather than by a tuned multiplier that would drift if the clip changed.
    if (moving) action.setEffectiveTimeScale(action.getClip().duration * GAIT_CYCLES_PER_SECOND)
    action.reset().fadeIn(GAIT_FADE).play()
    return () => {
      action.fadeOut(GAIT_FADE)
    }
  }, [actions, moving])

  useEffect(() => {
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(root)
    }
  }, [mixer, root])

  useFrame((_, delta) => {
    if (actions.walk || actions.idle) mixer.update(delta)
  })
}

// --- hand-posed gait (the men's rigged .obj) --------------------------------

const HIP_SWING = 0.55
const KNEE_BEND = 0.75
const ARM_SWING = 0.42
const ELBOW_BEND = 0.3
const TORSO_TWIST = 0.09
// Vertical bounce, in the same units the fitted model stands in.
const BOB_HEIGHT = 0.035
const BREATH_DEPTH = 0.022

type Rig = {
  upperLeg: [THREE.Object3D, THREE.Object3D]
  lowerLeg: [THREE.Object3D | null, THREE.Object3D | null]
  upperArm: [THREE.Object3D | null, THREE.Object3D | null]
  lowerArm: [THREE.Object3D | null, THREE.Object3D | null]
  torso: THREE.Object3D | null
  restY: number
}

// GLTFLoader strips the dots out of node names, so 'UpperLeg.L' in the file is
// 'UpperLegL' here — same as the grip bone in CharacterModel.
function readRig(root: THREE.Object3D): Rig | null {
  const bone = (name: string) => root.getObjectByName(name) ?? null
  const upperLegL = bone('UpperLegL')
  const upperLegR = bone('UpperLegR')
  if (!upperLegL || !upperLegR) return null
  return {
    upperLeg: [upperLegL, upperLegR],
    lowerLeg: [bone('LowerLegL'), bone('LowerLegR')],
    upperArm: [bone('UpperArmL'), bone('UpperArmR')],
    lowerArm: [bone('LowerArmL'), bone('LowerArmR')],
    torso: bone('Torso'),
    restY: root.position.y,
  }
}

export function useProceduralGait(root: THREE.Object3D, enabled: boolean, moving: boolean) {
  const rig = useMemo(() => (enabled ? readRig(root) : null), [root, enabled])
  const phase = useRef(0)
  const blend = useRef(0)

  useFrame((state, delta) => {
    if (!rig) return

    blend.current = THREE.MathUtils.damp(blend.current, moving ? 1 : 0, GAIT_DAMP, delta)
    const swing = blend.current
    // The phase keeps running while the gait fades out, so a stop settles
    // mid-stride instead of snapping the legs shut.
    phase.current += delta * GAIT_CYCLES_PER_SECOND * Math.PI * 2
    const step = Math.sin(phase.current)
    const lift = Math.cos(phase.current)

    // Negative X swings a limb toward +Z, the way the model faces, so the leg
    // in front of the body is the one on the negative side.
    rig.upperLeg[0].rotation.x = -step * HIP_SWING * swing
    rig.upperLeg[1].rotation.x = step * HIP_SWING * swing
    // Knees only fold backwards, and only on the leg swinging through.
    if (rig.lowerLeg[0]) rig.lowerLeg[0].rotation.x = Math.max(0, lift) * KNEE_BEND * swing
    if (rig.lowerLeg[1]) rig.lowerLeg[1].rotation.x = Math.max(0, -lift) * KNEE_BEND * swing

    // Arms counter the legs.
    if (rig.upperArm[0]) rig.upperArm[0].rotation.x = step * ARM_SWING * swing
    if (rig.upperArm[1]) rig.upperArm[1].rotation.x = -step * ARM_SWING * swing
    if (rig.lowerArm[0]) rig.lowerArm[0].rotation.x = -(0.5 + 0.5 * step) * ELBOW_BEND * swing
    if (rig.lowerArm[1]) rig.lowerArm[1].rotation.x = -(0.5 - 0.5 * step) * ELBOW_BEND * swing

    if (rig.torso) {
      rig.torso.rotation.y = -step * TORSO_TWIST * swing
      // Standing still, he breathes instead — otherwise an idle man is a
      // completely frozen statue next to the women's idle clip.
      rig.torso.rotation.x = Math.sin(state.clock.elapsedTime * 1.6) * BREATH_DEPTH * (1 - swing)
    }

    // Two bounces per cycle: one per footfall.
    root.position.y = rig.restY + Math.abs(step) * BOB_HEIGHT * swing
  })
}
