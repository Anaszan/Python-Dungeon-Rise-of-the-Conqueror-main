import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterClass } from './characterOptions'
import { GAIT_DRIVEN_AXES } from './gait'

// The cast: what the player's character actually *does* when a spell goes off.
//
// Every class in this game attacks by writing Python, but they are not all
// holding the same thing — so each one casts with the weapon it carries: the
// warrior chops, the rogue stabs, the wizard drives its staff forward, the
// cleric raises both hands and brings the light down. Class also picks the
// colour of the glow that goes with it (see CastAura).
//
// Two rigs need two completely different treatments, the same split gait.ts
// already lives with:
//   * the women's packs ship 24 authored clips, so their cast is one of those
//     clips played once (`clip` below);
//   * the men's models were rigged from static .obj and carry no clips at all,
//     so theirs is hand-posed here (`pose` below) on the same bone names.

export type CastKind = 'attack' | 'skill'

// A cast is an *event*, not a state — "this exact cast, now" — so the id is
// what components watch. Re-running the same spell produces a new id and
// replays the motion; nothing else about the signal changes.
export type CastSignal = { id: number; kind: CastKind }

// ── the bus ────────────────────────────────────────────────────────────────
// Same reasoning as combatFx: a cast is over in under a second and exactly two
// things care (the model and its aura). Routing it through the game store
// would re-render every screen subscribed to the store for an animation
// nobody else is watching.

type Listener = (signal: CastSignal) => void

const listeners = new Set<Listener>()
let nextCastId = 0

export function triggerCast(kind: CastKind): void {
  const signal: CastSignal = { id: nextCastId++, kind }
  for (const listener of listeners) listener(signal)
}

// Subscribes the caller to the bus. Returns the most recent cast, so a parent
// can hand it straight down as a prop — one re-render per cast, which is a few
// times a minute.
export function useCastSignal(): CastSignal | null {
  const [signal, setSignal] = useState<CastSignal | null>(null)
  useEffect(() => {
    const listener: Listener = (next) => setSignal(next)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return signal
}

// ── what one class's cast looks like ───────────────────────────────────────

// Which bones a hand-posed cast is allowed to touch. Both rigs name them the
// same way (GLTFLoader strips the dots, so 'UpperArm.R' arrives as
// 'UpperArmR'), and the male rig has all of them.
//
// Layering is decided per *axis*, not per bone, and GAIT_DRIVEN_AXES is what
// decides it. An axis the walk overwrites every frame (an arm's x, say) gets
// the cast added on top, so casting mid-stride does not freeze the legs. An
// axis the walk never touches (that same arm's z) is written from the bone's
// rest pose instead — adding to it every frame would compound the offset until
// the arm wound itself right off the body.
const CAST_BONES = {
  torso: 'Torso',
  chest: 'Chest',
  head: 'Head',
  shoulderR: 'ShoulderR',
  upperArmR: 'UpperArmR',
  lowerArmR: 'LowerArmR',
  wristR: 'WristR',
  upperArmL: 'UpperArmL',
  lowerArmL: 'LowerArmL',
} as const

export type CastBone = keyof typeof CAST_BONES

const AXES = ['x', 'y', 'z'] as const

// Exported for the test that holds the layering rule above to the poses.
export function castBoneNode(bone: CastBone): string {
  return CAST_BONES[bone]
}

export function isGaitDrivenAxis(bone: CastBone, axis: 'x' | 'y' | 'z'): boolean {
  return GAIT_DRIVEN_AXES[CAST_BONES[bone]]?.includes(axis) ?? false
}

// One axis of one bone, for one frame of a cast.
//
// The whole layering rule lives in this line. On an axis the gait overwrites
// every frame, `current` is already the walk's value for this frame and the
// cast is added to it. On an axis nobody else writes, `current` is whatever
// the cast itself left there last frame and must be thrown away — the value is
// rebuilt from the bone's rest pose instead, which is what stops a constant
// offset from compounding frame after frame.
export function applyCastAxis(current: number, rest: number, offset: number, gaitDriven: boolean): number {
  return gaitDriven ? current + offset : rest + offset
}

// Euler offsets in radians, XYZ. The rig's convention (documented in gait.ts):
// a *negative* rotation.x swings a limb toward +Z, the way the model faces —
// so -1.5 is an arm held straight out in front, and past about -2.5 it is
// overhead.
export type CastPose = Partial<Record<CastBone, readonly [number, number, number]>>

export type CastKeyframe = { t: number; pose: CastPose }

export type CastStyle = {
  // Clip name suffix for the rigs that ship animation (the women's packs).
  clip: string
  // Hand-posed motion for the rigs that don't (the men's).
  pose: CastKeyframe[]
  // How long the whole motion takes, in seconds. The authored clip is
  // time-scaled to fit this too, so both genders of a class cast at the same
  // speed even though the source clips are all different lengths.
  seconds: number
  // The glow at the hand and the rune under the feet.
  color: string
}

export const CAST_STYLES: Record<CharacterClass, CastStyle> = {
  // Overhead chop: wind the sword up and behind, turn the shoulders into it,
  // then bring it down through the target.
  warrior: {
    clip: '|Sword_Slash',
    seconds: 0.8,
    color: '#ffb454',
    pose: [
      { t: 0, pose: {} },
      {
        t: 0.28,
        pose: {
          upperArmR: [-2.5, 0, 0.35],
          lowerArmR: [-0.5, 0, 0],
          shoulderR: [0, 0, 0.25],
          torso: [0, 0.3, 0],
          chest: [-0.15, 0, 0],
          head: [-0.1, 0, 0],
        },
      },
      {
        t: 0.46,
        pose: {
          upperArmR: [-0.25, 0, -0.15],
          lowerArmR: [-0.1, 0, 0],
          shoulderR: [0, 0, -0.1],
          torso: [0, -0.25, 0],
          chest: [0.3, 0, 0],
          head: [0.15, 0, 0],
        },
      },
      { t: 0.7, pose: { upperArmR: [-0.5, 0, 0], torso: [0, -0.1, 0], chest: [0.12, 0, 0] } },
      { t: 1, pose: {} },
    ],
  },

  // Stab: cock the dagger back by the hip, then drive it straight out with the
  // whole body behind it. The quickest cast of the four.
  rogue: {
    clip: '|Punch_Right',
    seconds: 0.55,
    color: '#7de3a4',
    pose: [
      { t: 0, pose: {} },
      {
        t: 0.24,
        pose: {
          upperArmR: [0.5, 0, 0.15],
          lowerArmR: [-1.5, 0, 0],
          torso: [0, 0.35, 0],
          chest: [-0.1, 0, 0],
        },
      },
      {
        t: 0.42,
        pose: {
          upperArmR: [-1.45, 0, 0],
          lowerArmR: [-0.12, 0, 0],
          wristR: [0, 0, -0.2],
          torso: [0, -0.3, 0],
          chest: [0.22, 0, 0],
          head: [0.1, 0, 0],
        },
      },
      {
        t: 0.64,
        pose: { upperArmR: [-1, 0, 0], lowerArmR: [-0.5, 0, 0], torso: [0, -0.1, 0], chest: [0.08, 0, 0] },
      },
      { t: 1, pose: {} },
    ],
  },

  // Staff cast: raise the staff overhead until the orb is above the head, then
  // punch it forward at the target.
  wizard: {
    clip: '|Gun_Shoot',
    seconds: 0.85,
    color: '#9b82ff',
    pose: [
      { t: 0, pose: {} },
      {
        t: 0.32,
        pose: {
          upperArmR: [-2.2, 0, 0.2],
          lowerArmR: [-0.8, 0, 0],
          upperArmL: [-0.5, 0, 0.25],
          chest: [-0.18, 0, 0],
          head: [-0.22, 0, 0],
        },
      },
      {
        t: 0.54,
        pose: {
          upperArmR: [-1.5, 0, 0],
          lowerArmR: [-0.15, 0, 0],
          upperArmL: [-0.25, 0, 0.1],
          wristR: [0.25, 0, 0],
          chest: [0.15, 0, 0],
          head: [0.06, 0, 0],
        },
      },
      { t: 0.76, pose: { upperArmR: [-1.35, 0, 0], lowerArmR: [-0.3, 0, 0], chest: [0.05, 0, 0] } },
      { t: 1, pose: {} },
    ],
  },

  // Blessing: both hands to the sky, head tilted up, then the light is brought
  // down and pushed out toward the target. The slowest and the widest.
  cleric: {
    clip: '|Interact',
    seconds: 0.95,
    color: '#ffe07a',
    pose: [
      { t: 0, pose: {} },
      {
        t: 0.36,
        pose: {
          upperArmR: [-2.55, 0, 0.3],
          upperArmL: [-2.55, 0, -0.3],
          lowerArmR: [-0.3, 0, 0],
          lowerArmL: [-0.3, 0, 0],
          chest: [-0.22, 0, 0],
          head: [-0.3, 0, 0],
        },
      },
      {
        t: 0.64,
        pose: {
          upperArmR: [-1.35, 0, 0.1],
          upperArmL: [-1.35, 0, -0.1],
          lowerArmR: [-0.5, 0, 0],
          lowerArmL: [-0.5, 0, 0],
          chest: [0.12, 0, 0],
          head: [0.05, 0, 0],
        },
      },
      { t: 1, pose: {} },
    ],
  },
}

// The special skill is the same motion thrown harder: a little wider, a little
// longer, and a bigger glow (see CastAura).
export const SKILL_POSE_GAIN = 1.15
export const SKILL_TIME_GAIN = 1.12

export function castSeconds(characterClass: CharacterClass, kind: CastKind): number {
  const base = CAST_STYLES[characterClass].seconds
  return kind === 'skill' ? base * SKILL_TIME_GAIN : base
}

// ── sampling a hand-posed cast ─────────────────────────────────────────────

// Smoothstep, so a pose eases into the next one instead of arriving at a
// constant speed and stopping dead. Keyframes are placed at the extremes of
// the motion; this is what makes the bits between them read as a swing.
function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

// The pose at progress `p` (0 = the frame the cast starts, 1 = back at rest).
// Written into `out` rather than returned so the frame loop allocates nothing.
export function samplePose(keys: readonly CastKeyframe[], p: number, out: Map<CastBone, [number, number, number]>) {
  out.clear()
  const clamped = Math.max(0, Math.min(1, p))

  let next = keys.findIndex((key) => key.t >= clamped)
  if (next <= 0) next = keys.length > 1 ? 1 : 0
  const a = keys[next - 1] ?? keys[0]
  const b = keys[next] ?? keys[keys.length - 1]
  const span = b.t - a.t
  const mix = span > 0 ? ease((clamped - a.t) / span) : 0

  // Every bone either side mentions has to be written, or a bone that is posed
  // in `a` and absent from `b` would stay stuck at its `a` value instead of
  // easing back to rest.
  for (const bone of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)]) as Set<CastBone>) {
    const from = a.pose[bone] ?? [0, 0, 0]
    const to = b.pose[bone] ?? [0, 0, 0]
    out.set(bone, [
      from[0] + (to[0] - from[0]) * mix,
      from[1] + (to[1] - from[1]) * mix,
      from[2] + (to[2] - from[2]) * mix,
    ])
  }
}

// ── the hooks ──────────────────────────────────────────────────────────────

type PosedBone = {
  object: THREE.Object3D
  rest: THREE.Euler
  // Per axis, whether the gait owns it — decided once here rather than looked
  // up three times a bone every frame.
  gaitDriven: readonly [boolean, boolean, boolean]
}

function readCastRig(root: THREE.Object3D): Map<CastBone, PosedBone> {
  const rig = new Map<CastBone, PosedBone>()
  for (const key of Object.keys(CAST_BONES) as CastBone[]) {
    const object = root.getObjectByName(CAST_BONES[key])
    if (!object) continue
    rig.set(key, {
      object,
      rest: object.rotation.clone(),
      gaitDriven: [isGaitDrivenAxis(key, 'x'), isGaitDrivenAxis(key, 'y'), isGaitDrivenAxis(key, 'z')],
    })
  }
  return rig
}

// One frame of a hand-posed cast written onto the rig. `pose` empty is the
// rest pose, which is also how a finished cast lets go of the bones it owns.
function writePose(
  rig: Map<CastBone, PosedBone>,
  pose: Map<CastBone, [number, number, number]>,
  gain: number,
) {
  for (const [key, bone] of rig) {
    const offset = pose.get(key)
    for (let i = 0; i < AXES.length; i++) {
      const axis = AXES[i]
      const value = offset ? offset[i] * gain : 0
      bone.object.rotation[axis] = applyCastAxis(
        bone.object.rotation[axis],
        bone.rest[axis],
        value,
        bone.gaitDriven[i],
      )
    }
  }
}

// Hand-posed cast, for the rig with no clips of its own.
//
// MUST be called after the gait hooks in the same component: React runs
// useFrame subscriptions in the order they were made, and the additive bones
// below read whatever the gait has already written this frame.
export function useProceduralCast(
  root: THREE.Object3D,
  enabled: boolean,
  characterClass: CharacterClass,
  cast: CastSignal | null,
) {
  const rig = useMemo(() => (enabled ? readCastRig(root) : null), [root, enabled])
  const pose = useRef(new Map<CastBone, [number, number, number]>())
  // Seconds into the current cast, or null when there is nothing to play.
  const elapsed = useRef<number | null>(null)
  const active = useRef<CastSignal | null>(null)

  useEffect(() => {
    if (!cast) return
    active.current = cast
    elapsed.current = 0
  }, [cast])

  useFrame((_, delta) => {
    if (!rig || elapsed.current === null) return
    const signal = active.current
    if (!signal) return

    const style = CAST_STYLES[characterClass]
    const total = castSeconds(characterClass, signal.kind)
    elapsed.current += delta
    const gain = signal.kind === 'skill' ? SKILL_POSE_GAIN : 1

    if (elapsed.current >= total) {
      // One last write at rest — the cast may have stopped a frame or two
      // short of its final keyframe — and then stop touching the rig at all,
      // leaving it to the gait until the next cast.
      elapsed.current = null
      pose.current.clear()
      writePose(rig, pose.current, 1)
      return
    }

    samplePose(style.pose, elapsed.current / total, pose.current)
    writePose(rig, pose.current, gain)
  })
}

// Authored-clip cast, for the rigs that ship animation.
//
// Deliberately its own AnimationMixer rather than sharing the gait's: the two
// then never have to agree about weights or fades, and because this hook's
// frame callback is registered after the gait's, whatever it writes lands on
// top. The moment a cast ends the action is stopped outright — an action left
// running at weight zero keeps forcing its bones back to the bind pose every
// frame, which would freeze the walk.
export function useClipCast(
  root: THREE.Object3D,
  clips: THREE.AnimationClip[],
  characterClass: CharacterClass,
  cast: CastSignal | null,
) {
  const style = CAST_STYLES[characterClass]
  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root])

  const action = useMemo(() => {
    const clip = clips.find((candidate) => candidate.name.endsWith(style.clip))
    if (!clip) return null
    const next = mixer.clipAction(clip)
    next.setLoop(THREE.LoopOnce, 1)
    next.clampWhenFinished = false
    return next
  }, [mixer, clips, style.clip])

  const elapsed = useRef<number | null>(null)
  const total = useRef(0)
  const faded = useRef(false)

  useEffect(() => {
    if (!cast || !action) return
    total.current = castSeconds(characterClass, cast.kind)
    // The source clips are all different lengths (Sword_Slash 1.29s,
    // Gun_Shoot 0.75s...); scaling each to the class's own cast length is what
    // makes both genders of a class cast at the same speed.
    action.setEffectiveTimeScale(action.getClip().duration / total.current)
    action.setEffectiveWeight(1)
    action.reset().fadeIn(0.06).play()
    elapsed.current = 0
    faded.current = false
  }, [cast, action, characterClass])

  useEffect(() => {
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(root)
    }
  }, [mixer, root])

  useFrame((_, delta) => {
    if (!action || elapsed.current === null) return
    elapsed.current += delta
    mixer.update(delta)

    const remaining = total.current - elapsed.current
    if (!faded.current && remaining <= 0.18) {
      action.fadeOut(0.18)
      faded.current = true
    }
    if (remaining <= 0) {
      action.stop()
      elapsed.current = null
    }
  })
}
