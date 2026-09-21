import { describe, expect, it } from 'vitest'
import { canStandAt, hitsWall, isWalkable, PLAYER_RADIUS, WALL_THICKNESS } from './dungeon'
import { LEVELS } from './levels'
import { MONSTER_AGGRO_RANGE, PICKUP_TRIGGER_DISTANCE } from './constants'
import { levelColliders, propColliders } from './propCollision'

// canStandAt() keeps the player's whole body out of the walls, which also
// means it narrows every doorway by the player's own half-width on each side.
// This is the guard on that: no level may end up with a doorway too narrow to
// walk through, or with a monster/pickup stranded on the wrong side of one.
//
// Flood-fills the standable space on a 0.1 grid from the spawn point
// (4-neighbour, matching the axis-at-a-time movement in Player.tsx), then
// checks every monster and pickup can be triggered from somewhere in it.
//
// It floods against levelColliders() — walls *and* solid props — the exact list
// Player.tsx moves against, so a coffin dropped across a corridor or a
// bookshelf standing on a monster fails here instead of in someone's run.
const STEP = 0.1
const key = (ix: number, iz: number) => `${ix},${iz}`

function standableCells(level: (typeof LEVELS)[number]) {
  const { regions } = level
  const walls = levelColliders(level)
  const [sx, , sz] = level.spawnPosition
  const start: [number, number] = [Math.round(sx / STEP), Math.round(sz / STEP)]
  expect(canStandAt(start[0] * STEP, start[1] * STEP, regions, walls), `${level.name}: spawn`).toBe(true)

  const seen = new Set<string>([key(...start)])
  const queue: [number, number][] = [start]
  while (queue.length) {
    const [ix, iz] = queue.pop()!
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = ix + dx
      const nz = iz + dz
      const k = key(nx, nz)
      if (seen.has(k)) continue
      if (!canStandAt(nx * STEP, nz * STEP, regions, walls)) continue
      seen.add(k)
      queue.push([nx, nz])
    }
  }
  return seen
}

function reachable(level: (typeof LEVELS)[number]) {
  const seen = standableCells(level)
  return (x: number, z: number, radius: number) => {
    const span = Math.ceil(radius / STEP)
    const cx = Math.round(x / STEP)
    const cz = Math.round(z / STEP)
    for (let ix = cx - span; ix <= cx + span; ix++) {
      for (let iz = cz - span; iz <= cz + span; iz++) {
        const dx = ix * STEP - x
        const dz = iz * STEP - z
        if (dx * dx + dz * dz <= radius * radius && seen.has(key(ix, iz))) return true
      }
    }
    return false
  }
}

describe('wall collision', () => {
  it('holds the player off a wall drawn on a region boundary', () => {
    const { regions, walls } = LEVELS[0]
    // Level 1's corridor runs to x = -2 and its west wall is centred there,
    // so the point test alone lets the player stand with half their body
    // inside that wall.
    expect(isWalkable(-2, -20, regions)).toBe(true)
    expect(canStandAt(-2, -20, regions, walls)).toBe(false)
  })

  it('stops the body short of the wall face, not just short of the boundary', () => {
    const { regions, walls } = LEVELS[0]
    // Half of that wall overhangs the floor it closes off, putting its inner
    // face here — a body of PLAYER_RADIUS may not reach past it.
    const innerFace = -2 + WALL_THICKNESS / 2
    const closest = innerFace + PLAYER_RADIUS

    expect(canStandAt(closest + 0.01, -20, regions, walls)).toBe(true)
    // The regression this is guarding: standing on the region boundary alone
    // used to be enough, which left the model's shoulder sunk into the wall.
    expect(canStandAt(closest - 0.01, -20, regions, walls)).toBe(false)
  })

  it('lets a player stuck inside a wall walk back out of it', () => {
    const { walls } = LEVELS[0]
    // Player.tsx's recovery path drops the body clearance (margin 0) but
    // still refuses the wall's own box, so escaping can never become
    // walking through.
    expect(hitsWall(-2, -20, walls, 0)).toBe(true)
    expect(hitsWall(-1.8, -20, walls, 0)).toBe(false)
    expect(hitsWall(-1.8, -20, walls)).toBe(true)
  })
})

describe('prop collision', () => {
  it('blocks the player at a solid prop and lets them through a floor decal', () => {
    const coffin = propColliders([{ kind: 'coffin', position: [0, 0, 0] }])
    expect(hitsWall(0, 0, coffin)).toBe(true)
    // Long side runs along z: 2.05 deep, so 1 unit up the lid is still coffin…
    expect(hitsWall(0, 1, coffin)).toBe(true)
    // …but a body's width past its narrow side is clear.
    expect(hitsWall(0.475 + PLAYER_RADIUS + 0.01, 0, coffin)).toBe(false)

    expect(propColliders([{ kind: 'runeCircle', position: [0, 0, 0] }])).toEqual([])
    expect(propColliders([{ kind: 'wisp', position: [0, 1.4, 0] }])).toEqual([])
  })

  it('turns the box with the prop', () => {
    // A coffin laid east-west has to block along x, not along z.
    const [box] = propColliders([{ kind: 'coffin', position: [3, 0, -5], rotationY: Math.PI / 2 }])
    expect(box.x).toBe(3)
    expect(box.z).toBe(-5)
    expect(box.width).toBeCloseTo(2.05)
    expect(box.depth).toBeCloseTo(0.95)
  })
})

describe.each(LEVELS)('level $level ($name)', (level) => {
  const canReach = reachable(level)

  it.each(level.monsters)('can reach $name', (monster) => {
    expect(canReach(monster.position[0], monster.position[2], MONSTER_AGGRO_RANGE)).toBe(true)
  })

  it.each(level.pickups)('can reach $id', (pickup) => {
    expect(canReach(pickup.position[0], pickup.position[2], PICKUP_TRIGGER_DISTANCE)).toBe(true)
  })

  it('has no standable spot that overlaps a wall or a solid prop', () => {
    const offenders = [...standableCells(level)].filter((k) => {
      const [ix, iz] = k.split(',').map(Number)
      return hitsWall(ix * STEP, iz * STEP, levelColliders(level), 0)
    })
    expect(offenders).toEqual([])
  })
})
