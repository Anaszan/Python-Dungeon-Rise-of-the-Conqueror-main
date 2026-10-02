import { describe, expect, it, beforeEach } from 'vitest'
import {
  cancelClickMove,
  clickMoveDirection,
  clickMoveRoute,
  clickMoveTarget,
  CLICK_MOVE_ARRIVE_DISTANCE,
  setClickMoveTarget,
} from './clickMove'

describe('click to walk', () => {
  beforeEach(cancelClickMove)

  it('has nowhere to go until the floor is clicked', () => {
    expect(clickMoveDirection(0, 0)).toBeNull()
  })

  it('points at the destination as a unit step', () => {
    setClickMoveTarget(3, -4)
    const dir = clickMoveDirection(0, 0)!

    expect(Math.hypot(dir.x, dir.z), 'not a unit vector').toBeCloseTo(1)
    expect(dir.x).toBeCloseTo(0.6)
    expect(dir.z).toBeCloseTo(-0.8)
  })

  it('stops once it is close enough, instead of twitching on the spot', () => {
    setClickMoveTarget(0, 0)
    // Just short of the destination: another full step would overshoot and
    // the next frame would step back.
    expect(clickMoveDirection(CLICK_MOVE_ARRIVE_DISTANCE - 0.01, 0)).toBeNull()
    expect(clickMoveDirection(CLICK_MOVE_ARRIVE_DISTANCE + 0.01, 0)).not.toBeNull()
  })

  it('forgets the destination when cancelled', () => {
    // Pressing a movement key, changing level and being wedged against a wall
    // all cancel — after any of them the walk must not resume by itself.
    setClickMoveTarget(5, 5)
    cancelClickMove()

    expect(clickMoveTarget.active).toBe(false)
    expect(clickMoveDirection(0, 0)).toBeNull()
  })

  it('replaces the destination on a second click rather than queueing it', () => {
    setClickMoveTarget(5, 0)
    setClickMoveTarget(-5, 0)

    expect(clickMoveDirection(0, 0)!.x).toBeCloseTo(-1)
  })
})

describe('walking a route round a corner', () => {
  beforeEach(cancelClickMove)

  // What pathfind.ts hands over: the legs of an L down a corridor and out
  // into a room, rather than the straight line that used to grind into the
  // wall between them.
  const corner = [
    { x: 0, z: -10 },
    { x: -8, z: -10 },
  ]

  it('marks the end of the route, not the first corner', () => {
    setClickMoveTarget(-8, -10, corner)

    expect(clickMoveTarget.x).toBe(-8)
    expect(clickMoveTarget.z).toBe(-10)
    expect(clickMoveRoute()).toEqual(corner)
  })

  it('steers at the first waypoint while it is still ahead', () => {
    setClickMoveTarget(-8, -10, corner)
    const dir = clickMoveDirection(0, 0)!

    expect(dir.z).toBeCloseTo(-1)
    expect(dir.x).toBeCloseTo(0)
  })

  it('turns the corner instead of stopping on it', () => {
    setClickMoveTarget(-8, -10, corner)
    // Standing on the first waypoint: the old single-destination walk would
    // have called this arrived.
    const dir = clickMoveDirection(0, -10)!

    expect(dir.x).toBeCloseTo(-1)
    expect(clickMoveRoute()).toEqual([corner[1]])
  })

  it('arrives only at the last waypoint', () => {
    setClickMoveTarget(-8, -10, corner)
    clickMoveDirection(0, -10)

    expect(clickMoveDirection(-8, -10)).toBeNull()
  })

  it('does not walk legs it has already passed again', () => {
    setClickMoveTarget(-8, -10, corner)
    clickMoveDirection(0, -10)
    // Drifting back past the first waypoint mid-walk (sliding along a wall,
    // say) must not send the player back to re-collect it.
    const dir = clickMoveDirection(-1, -10)!

    expect(dir.x).toBeCloseTo(-1)
  })
})
