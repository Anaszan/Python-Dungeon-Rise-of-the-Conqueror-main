import type { PathPoint } from './pathfind'

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
  // Where the walk ends — what the marker on the floor sits on. The legs in
  // between live in `route` below.
  x: 0,
  z: 0,
}

// The waypoints still to walk and which one is current. A click hands these
// over already routed around the level's walls and props (see pathfind.ts);
// a click with nowhere to route (or a caller that has no level to route in,
// like the tests) simply walks one leg straight at the destination.
let route: PathPoint[] = []
let leg = 0

// Close enough to call it arrived. A little under half a body width: any
// tighter and the last step overshoots, which shows up as the character
// twitching back and forth on the spot.
export const CLICK_MOVE_ARRIVE_DISTANCE = 0.25

export function setClickMoveTarget(x: number, z: number, path?: PathPoint[]) {
  route = path && path.length ? path : [{ x, z }]
  leg = 0
  const last = route[route.length - 1]
  clickMoveTarget.active = true
  clickMoveTarget.x = last.x
  clickMoveTarget.z = last.z
}

// Called when the player takes the wheel back (any WASD/joystick input), when
// the walk arrives, and when it is blocked with nowhere left to slide.
export function cancelClickMove() {
  clickMoveTarget.active = false
  route = []
  leg = 0
}

// The legs left to walk, for tests and for anything that wants to draw the
// route. A copy: nothing outside this module gets to edit the walk in place.
export function clickMoveRoute(): PathPoint[] {
  return route.slice(leg)
}

// The step direction toward the current waypoint, as a unit vector, or null
// once the player has reached the end of the route. Pure and exported for its
// own sake: this is the whole of "walking there", and it is much easier to
// check here than through a frame loop.
//
// Waypoints before the last one are passed through rather than stopped at —
// reaching one only means the next leg has started, which is what makes a
// route round a corner read as one continuous walk.
export function clickMoveDirection(
  playerX: number,
  playerZ: number,
  arriveDistance = CLICK_MOVE_ARRIVE_DISTANCE,
): { x: number; z: number } | null {
  if (!clickMoveTarget.active) return null

  while (leg < route.length) {
    const point = route[leg]
    const dx = point.x - playerX
    const dz = point.z - playerZ
    const distance = Math.hypot(dx, dz)
    if (distance <= arriveDistance) {
      // The end of the route is where the walk stops; `leg` stays put so
      // asking again gives the same answer rather than falling off the end.
      if (leg === route.length - 1) return null
      leg++
      continue
    }
    return { x: dx / distance, z: dz / distance }
  }
  return null
}
