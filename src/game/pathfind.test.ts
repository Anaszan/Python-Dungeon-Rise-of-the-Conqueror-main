import { describe, expect, it } from 'vitest'
import { findPath, isClearLine, PATH_CELL } from './pathfind'
import { canStandAt } from './dungeon'
import { LEVELS } from './levels'
import { levelColliders } from './propCollision'

// Every leg of a route has to be a line the player's whole body can walk
// down, because that is exactly what Player.tsx does with it: steer at the
// next waypoint until it is reached, then at the one after.
function walkable(level: (typeof LEVELS)[number], startX: number, startZ: number, route: { x: number; z: number }[]) {
  const walls = levelColliders(level)
  let x = startX
  let z = startZ
  for (const point of route) {
    if (!isClearLine(x, z, point.x, point.z, level.regions, walls)) return false
    x = point.x
    z = point.z
  }
  return true
}

describe('routing a click around the dungeon', () => {
  const level1 = LEVELS[0]
  const walls1 = levelColliders(level1)

  it('walks a clear corridor in one straight leg', () => {
    const route = findPath(0, 0, 0, -10, level1.regions, walls1)!

    expect(route).toEqual([{ x: 0, z: -10 }])
  })

  it('bends around the corner into a branch room instead of giving up', () => {
    // The west room opens off the corridor at a right angle: a straight line
    // from the corridor to its far corner runs through the room's own wall,
    // which is what the old straight-line walk used to grind into.
    const [sx, , sz] = level1.spawnPosition
    expect(isClearLine(sx, sz, -8, -12.5, level1.regions, walls1)).toBe(false)

    const route = findPath(sx, sz, -8, -12.5, level1.regions, walls1)!

    expect(route.length).toBeGreaterThan(1)
    expect(walkable(level1, sx, sz, route)).toBe(true)
  })

  it('arrives at the spot that was actually clicked', () => {
    const [sx, , sz] = level1.spawnPosition
    const route = findPath(sx, sz, -8, -12.5, level1.regions, walls1)!

    expect(route[route.length - 1]).toEqual({ x: -8, z: -12.5 })
  })

  it('walks up to a wall that was clicked rather than ignoring the click', () => {
    // Clicking the wall itself (or the black past the floor) is a normal
    // thing to do with a mouse; it should still mean "go over there".
    expect(canStandAt(-1.9, -20, level1.regions, walls1)).toBe(false)

    const route = findPath(0, 0, -1.9, -20, level1.regions, walls1)!
    const end = route[route.length - 1]

    expect(canStandAt(end.x, end.z, level1.regions, walls1)).toBe(true)
    expect(Math.hypot(end.x - -1.9, end.z - -20)).toBeLessThan(1)
  })

  it('never routes a diagonal through the corner of a prop', () => {
    // Level 5's corridor is lined with bookshelves on alternating sides, so
    // every walk down it has to thread between them.
    const library = LEVELS[4]
    const walls = levelColliders(library)
    const [sx, , sz] = library.spawnPosition
    const route = findPath(sx, sz, 0, -32, library.regions, walls)!

    expect(walkable(library, sx, sz, route)).toBe(true)
  })

  it('reaches the boss corner of every level from its spawn', () => {
    for (const level of LEVELS) {
      const walls = levelColliders(level)
      const [sx, , sz] = level.spawnPosition
      const boss = level.monsters.find((m) => m.boss)!
      // Stand next to it, not inside it.
      const goalX = boss.position[0] - 1
      const goalZ = boss.position[2] + 1

      const route = findPath(sx, sz, goalX, goalZ, level.regions, walls)
      expect(route, `${level.name}: no route to ${boss.name}`).not.toBeNull()
      expect(walkable(level, sx, sz, route!), `${level.name}: unwalkable leg`).toBe(true)
    }
  })

  it('straightens a long route down to the corners it actually turns', () => {
    const [sx, , sz] = level1.spawnPosition
    const end = LEVELS[0].monsters.find((m) => m.boss)!.position
    const route = findPath(sx, sz, end[0] - 1, end[2] + 1, level1.regions, walls1)!

    // The grid itself would hand back one cell per quarter metre; the walk
    // the player sees should be a handful of legs, not hundreds.
    expect(route.length).toBeLessThan(Math.hypot(end[0] - sx, end[2] - sz) / PATH_CELL / 4)
  })
})
