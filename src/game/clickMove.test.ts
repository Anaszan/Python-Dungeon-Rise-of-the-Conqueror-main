import { describe, expect, it, beforeEach } from 'vitest'
import {
  cancelClickMove,
  clickMoveDirection,
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
