import { describe, it, expect } from 'vitest'
import {
  cycleTarget,
  distanceToPlayer,
  isAggroed,
  isInCastRange,
  isLockable,
  isOutOfLockRange,
  nearestTarget,
} from './combat'
import { MONSTER_AGGRO_RANGE, SPELL_CAST_RANGE, TARGET_DROP_RANGE, TARGET_LOCK_RANGE } from './constants'
import { LEVELS } from './levels'
import type { MonsterData } from './monsters'

// A monster is only ever a name and a spot on the floor as far as this module
// is concerned, so the fixtures are the smallest thing that satisfies the type.
function monsterAt(id: string, x: number, z: number): MonsterData {
  return {
    id,
    name: id,
    maxHp: 30,
    color: '#fff',
    attackDamage: 5,
    attackInterval: 4,
    position: [x, 0.6, z],
  }
}

const NO_ONE: ReadonlySet<string> = new Set()

describe('measuring the floor', () => {
  it('measures on the XZ plane and ignores how tall a monster is', () => {
    const low = monsterAt('low', 3, 4)
    const tall: MonsterData = { ...low, id: 'tall', position: [3, 40, 4] }

    expect(distanceToPlayer(low, 0, 0)).toBe(5)
    expect(distanceToPlayer(tall, 0, 0)).toBe(5)
  })
})

describe('the ranges a fight is made of', () => {
  // Each predicate is checked on both sides of its own boundary, because the
  // whole feel of the fight is which of these the player is inside of.
  it.each([
    ['aggro', isAggroed, MONSTER_AGGRO_RANGE],
    ['cast', isInCastRange, SPELL_CAST_RANGE],
    ['lock', isLockable, TARGET_LOCK_RANGE],
  ] as const)('%s range includes its own boundary and nothing past it', (_name, predicate, range) => {
    expect(predicate(monsterAt('m', range - 0.01, 0), 0, 0)).toBe(true)
    expect(predicate(monsterAt('m', range + 0.01, 0), 0, 0)).toBe(false)
  })

  it('lets go of a target only once it is past the drop range', () => {
    expect(isOutOfLockRange(monsterAt('m', TARGET_DROP_RANGE - 0.01, 0), 0, 0)).toBe(false)
    expect(isOutOfLockRange(monsterAt('m', TARGET_DROP_RANGE + 0.01, 0), 0, 0)).toBe(true)
  })

  // These four constants only make sense in this order, and the fight leans on
  // it: a spell has to outreach a monster's swing (otherwise backing out of
  // melee means you can no longer answer), you have to be able to click
  // something before you can hit it, and the lock has to survive walking a bit
  // further than that or it would drop on the way in.
  it('keeps the ranges in the order the fight depends on', () => {
    expect(MONSTER_AGGRO_RANGE).toBeLessThan(SPELL_CAST_RANGE)
    expect(SPELL_CAST_RANGE).toBeLessThan(TARGET_LOCK_RANGE)
    expect(TARGET_LOCK_RANGE).toBeLessThan(TARGET_DROP_RANGE)
  })

  // Level design leans on it too — every level parks the player at least 4
  // units from its nearest monster, so arriving somewhere can never be an
  // ambush.
  it('leaves every level’s spawn point outside every monster’s reach', () => {
    for (const level of LEVELS) {
      for (const monster of level.monsters) {
        expect(isAggroed(monster, level.spawnPosition[0], level.spawnPosition[2]), `${level.name}: ${monster.name}`).toBe(
          false,
        )
      }
    }
  })
})

describe('picking a target', () => {
  const pack = [monsterAt('near', 2, 0), monsterAt('mid', 5, 0), monsterAt('far', 8, 0)]

  it('grabs the nearest living monster in range', () => {
    expect(nearestTarget(pack, NO_ONE, 0, 0)?.id).toBe('near')
  })

  it('skips the dead', () => {
    expect(nearestTarget(pack, new Set(['near']), 0, 0)?.id).toBe('mid')
  })

  it('finds nobody when the room is empty within range', () => {
    expect(nearestTarget([monsterAt('across-the-level', 40, 0)], NO_ONE, 0, 0)).toBeNull()
    expect(nearestTarget([], NO_ONE, 0, 0)).toBeNull()
  })

  it('honours a tighter range than the default lock', () => {
    expect(nearestTarget(pack, NO_ONE, 0, 0, 3)?.id).toBe('near')
    expect(nearestTarget(pack, NO_ONE, 0, 0, 1)).toBeNull()
  })
})

describe('cycling targets with Tab', () => {
  const pack = [monsterAt('far', 8, 0), monsterAt('near', 2, 0), monsterAt('mid', 5, 0)]

  it('walks outward from the nearest and wraps back around', () => {
    const first = cycleTarget(pack, NO_ONE, 0, 0, null)
    expect(first?.id).toBe('near')

    const second = cycleTarget(pack, NO_ONE, 0, 0, first!.id)
    expect(second?.id).toBe('mid')

    const third = cycleTarget(pack, NO_ONE, 0, 0, second!.id)
    expect(third?.id).toBe('far')

    expect(cycleTarget(pack, NO_ONE, 0, 0, third!.id)?.id).toBe('near')
  })

  it('starts over at the nearest when the held target is gone or out of range', () => {
    expect(cycleTarget(pack, new Set(['mid']), 0, 0, 'mid')?.id).toBe('near')
    expect(cycleTarget(pack, NO_ONE, 0, 0, 'a-monster-two-rooms-back')?.id).toBe('near')
  })

  it('leaves an empty corridor with no target at all', () => {
    expect(cycleTarget(pack, new Set(['near', 'mid', 'far']), 0, 0, 'near')).toBeNull()
  })

  it('never offers something outside lock range', () => {
    const spread = [monsterAt('close', 3, 0), monsterAt('miles-away', TARGET_LOCK_RANGE + 5, 0)]
    expect(cycleTarget(spread, NO_ONE, 0, 0, null)?.id).toBe('close')
    expect(cycleTarget(spread, NO_ONE, 0, 0, 'close')?.id, 'wrapped onto something out of range').toBe('close')
  })
})
