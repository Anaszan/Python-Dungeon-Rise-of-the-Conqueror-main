// Click-to-walk: the RO habit of clicking a patch of floor and having the
// character walk over to it, alongside WASD rather than instead of it.
//
// Module-level mutable state, like touchMoveState and playerPosition: the
// destination changes on a click and is read every frame by Player.tsx, and
// nothing renders from it except a marker that follows it with a ref. Putting
// it in the store would re-render every store subscriber for a number only the
// frame loop cares about.
export const clickMoveTarget = {
  active: false,
  x: 0,
  z: 0,
}

// Close enough to call it arrived. A little under half a body width: any
// tighter and the last step overshoots, which shows up as the character
// twitching back and forth on the spot.
export const CLICK_MOVE_ARRIVE_DISTANCE = 0.25

export function setClickMoveTarget(x: number, z: number) {
  clickMoveTarget.active = true
  clickMoveTarget.x = x
  clickMoveTarget.z = z
}

// Called when the player takes the wheel back (any WASD/joystick input), when
// the walk arrives, and when it is blocked with nowhere left to slide.
export function cancelClickMove() {
  clickMoveTarget.active = false
}

// The step direction toward the current destination, as a unit vector, or
// null once the player is close enough to stop. Pure and exported for its own
// sake: this is the whole of "walking there", and it is much easier to check
// here than through a frame loop.
export function clickMoveDirection(
  playerX: number,
  playerZ: number,
  arriveDistance = CLICK_MOVE_ARRIVE_DISTANCE,
): { x: number; z: number } | null {
  if (!clickMoveTarget.active) return null
  const dx = clickMoveTarget.x - playerX
  const dz = clickMoveTarget.z - playerZ
  const distance = Math.hypot(dx, dz)
  if (distance <= arriveDistance) return null
  return { x: dx / distance, z: dz / distance }
}
