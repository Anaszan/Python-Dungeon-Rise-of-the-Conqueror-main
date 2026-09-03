import type { MonsterData } from './monsters'
import { MONSTER_AGGRO_RANGE, SPELL_CAST_RANGE, TARGET_DROP_RANGE, TARGET_LOCK_RANGE } from './constants'

// The geometry half of the fight, kept free of React, three.js and the store
// so it can be reasoned about (and tested) on its own. Everything here works
// in floor coordinates: a monster's [x, y, z] against the player's x and z.
// Height never enters into it — a monster standing on the same tile is in
// range whether its model is a slime or a dragon.

export function distanceToPlayer(monster: MonsterData, playerX: number, playerZ: number): number {
  const dx = playerX - monster.position[0]
  const dz = playerZ - monster.position[2]
  return Math.hypot(dx, dz)
}

// Comparing squared distances skips a sqrt per monster per frame. Every
// predicate below goes through this rather than distanceToPlayer, which is
// kept for the one place that wants the number itself (the target panel, once
// a frame, to tell the player how far off they are).
function withinSq(monster: MonsterData, playerX: number, playerZ: number, range: number): boolean {
  const dx = playerX - monster.position[0]
  const dz = playerZ - monster.position[2]
  return dx * dx + dz * dz <= range * range
}

// Close enough that the monster swings. Monsters never move (they are props
// that fight back), so this is entirely the player's choice: walk in and take
// hits, or stay out and cast from range.
export function isAggroed(monster: MonsterData, playerX: number, playerZ: number): boolean {
  return withinSq(monster, playerX, playerZ, MONSTER_AGGRO_RANGE)
}

// Close enough that a spell lands. Out of range the code boxes still open and
// still run — the player just gets told the spell fizzled short, which is
// cheaper to understand than a disabled button with no reason on it.
export function isInCastRange(monster: MonsterData, playerX: number, playerZ: number): boolean {
  return withinSq(monster, playerX, playerZ, SPELL_CAST_RANGE)
}

// Close enough to click into the target slot.
export function isLockable(monster: MonsterData, playerX: number, playerZ: number): boolean {
  return withinSq(monster, playerX, playerZ, TARGET_LOCK_RANGE)
}

// Far enough that the lock lets go on its own.
export function isOutOfLockRange(monster: MonsterData, playerX: number, playerZ: number): boolean {
  return !withinSq(monster, playerX, playerZ, TARGET_DROP_RANGE)
}

// The monster a bare Tab (or an auto-lock) should grab: the nearest living one
// inside `range`. Returns null when the player is standing alone in a corridor,
// which is what leaves the target slot empty rather than locking onto
// something across the level.
export function nearestTarget(
  monsters: readonly MonsterData[],
  defeatedIds: ReadonlySet<string>,
  playerX: number,
  playerZ: number,
  range: number = TARGET_LOCK_RANGE,
): MonsterData | null {
  let best: MonsterData | null = null
  let bestSq = range * range
  for (const monster of monsters) {
    if (defeatedIds.has(monster.id)) continue
    const dx = playerX - monster.position[0]
    const dz = playerZ - monster.position[2]
    const sq = dx * dx + dz * dz
    if (sq <= bestSq) {
      bestSq = sq
      best = monster
    }
  }
  return best
}

// Tab again to move down the list of everything currently in lock range,
// nearest first, wrapping at the end — the one keyboard gesture RO players
// reach for without thinking. Passing a `currentId` that is dead, gone or
// out of range simply starts the cycle over at the nearest.
export function cycleTarget(
  monsters: readonly MonsterData[],
  defeatedIds: ReadonlySet<string>,
  playerX: number,
  playerZ: number,
  currentId: string | null,
  range: number = TARGET_LOCK_RANGE,
): MonsterData | null {
  const inRange = monsters
    .filter((m) => !defeatedIds.has(m.id) && withinSq(m, playerX, playerZ, range))
    .sort((a, b) => distanceToPlayer(a, playerX, playerZ) - distanceToPlayer(b, playerX, playerZ))

  if (inRange.length === 0) return null
  const index = currentId ? inRange.findIndex((m) => m.id === currentId) : -1
  return inRange[(index + 1) % inRange.length]
}
