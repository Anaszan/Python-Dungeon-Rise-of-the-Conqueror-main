import { describe, expect, it } from 'vitest'
import {
  applyCastAxis,
  castBoneNode,
  CAST_STYLES,
  castSeconds,
  isGaitDrivenAxis,
  samplePose,
  type CastBone,
  type CastKeyframe,
} from './cast'
import { GAIT_DRIVEN_AXES } from './gait'
import { CHARACTER_CLASS_OPTIONS } from './characterOptions'

function poseAt(keys: readonly CastKeyframe[], p: number) {
  const out = new Map<CastBone, [number, number, number]>()
  samplePose(keys, p, out)
  return out
}

describe('cast styles', () => {
  it('gives every class its own motion, colour and length', () => {
    const seen = new Set<string>()
    for (const option of CHARACTER_CLASS_OPTIONS) {
      const style = CAST_STYLES[option.id]
      expect(style, `${option.id} has no cast`).toBeDefined()
      expect(style.seconds).toBeGreaterThan(0)
      // Two classes casting in the same colour would undo the one thing the
      // aura is for: saying at a glance whose magic just went off.
      expect(seen.has(style.color), `${option.id} reuses a colour`).toBe(false)
      seen.add(style.color)
    }
  })

  // The motion has to start and end at rest, or a cast would leave the
  // character standing in a half-swing until the next one.
  it.each(CHARACTER_CLASS_OPTIONS)('$id starts and ends at rest', (option) => {
    const style = CAST_STYLES[option.id]
    expect(style.pose[0].t).toBe(0)
    expect(style.pose[style.pose.length - 1].t).toBe(1)
    expect(style.pose[0].pose).toEqual({})
    expect(style.pose[style.pose.length - 1].pose).toEqual({})
  })

  it.each(CHARACTER_CLASS_OPTIONS)('$id keyframes run forwards in time', (option) => {
    const times = CAST_STYLES[option.id].pose.map((key) => key.t)
    for (let i = 1; i < times.length; i++) {
      expect(times[i], `keyframe ${i}`).toBeGreaterThan(times[i - 1])
    }
  })

  // Every class actually moves the arm that carries its weapon — a cast that
  // posed only the torso would read as a shrug.
  it.each(CHARACTER_CLASS_OPTIONS)('$id swings the weapon arm', (option) => {
    const reach = CAST_STYLES[option.id].pose.flatMap((key) => (key.pose.upperArmR ? [key.pose.upperArmR[0]] : []))
    expect(reach.length, 'never poses the right arm').toBeGreaterThan(0)
    expect(Math.max(...reach.map(Math.abs))).toBeGreaterThan(1)
  })

  it('makes the special skill the bigger version of the same cast', () => {
    for (const option of CHARACTER_CLASS_OPTIONS) {
      expect(castSeconds(option.id, 'skill')).toBeGreaterThan(castSeconds(option.id, 'attack'))
    }
  })
})

// The layering rule the hand-posed cast lives or dies by. The bug it is here
// to stop is silent: an offset added every frame to an axis nobody resets
// compounds, and the arm creeps further out of place with each frame of the
// cast until it is somewhere behind the model — which reads as a broken rig,
// not as a wrong number.
describe('layering a cast over the walk', () => {
  it('adds to an axis the gait rewrites every frame', () => {
    // The gait has already put 0.4 there this frame; the cast's 0.9 goes on
    // top, and next frame the gait's own write is what clears it.
    expect(applyCastAxis(0.4, 0, 0.9, true)).toBeCloseTo(1.3)
  })

  it('rebuilds an axis the gait never touches, so a held pose never creeps', () => {
    let value = 0.2 // the bone's rest rotation on this axis
    for (let frame = 0; frame < 60; frame++) {
      value = applyCastAxis(value, 0.2, 0.35, false)
    }
    // A whole second of holding the same offset, and it is still the same
    // offset — not 60 of them.
    expect(value).toBeCloseTo(0.55)
  })

  it('returns every bone to rest when the cast stops posing it', () => {
    const held = applyCastAxis(0.2, 0.2, 0.35, false)
    expect(applyCastAxis(held, 0.2, 0, false)).toBeCloseTo(0.2)
  })

  it('routes each posed axis by what the gait actually writes', () => {
    // Not a restatement of the table: this reads the gait's own exported
    // contract, so moving an axis between the two in gait.ts without moving it
    // here fails.
    expect(isGaitDrivenAxis('upperArmR', 'x')).toBe(true)
    expect(isGaitDrivenAxis('upperArmR', 'z')).toBe(false)
    expect(isGaitDrivenAxis('chest', 'x')).toBe(false)
    for (const bone of ['torso', 'upperArmR', 'lowerArmL'] as CastBone[]) {
      expect(GAIT_DRIVEN_AXES[castBoneNode(bone)], `${bone} is not a gait bone any more`).toBeDefined()
    }
  })
})

describe('samplePose', () => {
  const keys: CastKeyframe[] = [
    { t: 0, pose: {} },
    { t: 0.5, pose: { upperArmR: [-2, 0, 0], chest: [0.5, 0, 0] } },
    { t: 1, pose: {} },
  ]

  it('is at rest at both ends', () => {
    expect(poseAt(keys, 0).get('upperArmR')).toEqual([0, 0, 0])
    expect(poseAt(keys, 1).get('upperArmR')).toEqual([0, 0, 0])
  })

  it('reaches the keyframe exactly at its own time', () => {
    expect(poseAt(keys, 0.5).get('upperArmR')).toEqual([-2, 0, 0])
    expect(poseAt(keys, 0.5).get('chest')).toEqual([0.5, 0, 0])
  })

  it('eases rather than ramping — the midpoint of a leg is not its average', () => {
    const quarter = poseAt(keys, 0.25).get('upperArmR')![0]
    // Smoothstep at the halfway point of a segment is exactly 0.5, so compare
    // somewhere it actually differs from a straight line.
    const eighth = poseAt(keys, 0.125).get('upperArmR')![0]
    expect(quarter).toBeCloseTo(-1, 5)
    expect(Math.abs(eighth)).toBeLessThan(Math.abs(-2 * 0.25))
  })

  // A bone posed on one side of a segment and absent from the other has to be
  // written anyway, easing back to rest — otherwise it sticks at its last
  // value for the rest of the cast.
  it('eases a bone back to rest when the next keyframe omits it', () => {
    const trailing = poseAt(keys, 0.75).get('chest')
    expect(trailing).toBeDefined()
    expect(trailing![0]).toBeGreaterThan(0)
    expect(trailing![0]).toBeLessThan(0.5)
  })

  it('clamps outside 0..1 instead of extrapolating', () => {
    expect(poseAt(keys, -3).get('upperArmR')).toEqual([0, 0, 0])
    expect(poseAt(keys, 9).get('upperArmR')).toEqual([0, 0, 0])
  })

  it('reuses the caller’s map rather than allocating one per frame', () => {
    const out = new Map<CastBone, [number, number, number]>()
    samplePose(keys, 0.5, out)
    expect(out.size).toBe(2)
    samplePose(keys, 0, out)
    // Cleared, not appended to.
    expect(out.size).toBeLessThanOrEqual(2)
    expect(out.get('upperArmR')).toEqual([0, 0, 0])
  })
})
