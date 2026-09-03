import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGameStore } from './store'
import { LEVELS } from './levels'
import { playerPosition } from './playerPosition'
import { isAggroed, isOutOfLockRange, nearestTarget } from './combat'
import { spawnFloatingHit } from './combatFx'
import type { MonsterData } from './monsters'

// How often the swing timers are published to the store for the nameplates to
// draw. The timers themselves advance every frame in a ref; only the *shown*
// value is throttled, so a bar moves smoothly enough to read without pushing
// 60 store updates a second through React.
const SWING_PUBLISH_INTERVAL = 0.1

// The clock the whole dungeon fights on.
//
// The old version drove one monster at a time, because only one monster
// existed while the battle screen was up. There is no battle screen any more:
// every living monster in the level runs its own swing timer, and any of them
// standing within MONSTER_AGGRO_RANGE of the player is hitting them. Walking
// into a cluster of three means taking three sets of hits, and walking back
// out stops all three.
export function CombatTicker() {
  // monster id → seconds accumulated toward its next swing. Monsters out of
  // range are deleted from this rather than frozen, so stepping away and back
  // gives the player a fresh full interval instead of an instant hit from a
  // timer that was left almost full.
  const timers = useRef(new Map<string, number>())
  const sincePublish = useRef(0)
  // The last object handed to the store, so an unchanged frame publishes
  // nothing at all.
  const publishedKey = useRef('')

  useFrame((_, delta) => {
    const state = useGameStore.getState()

    if (state.skillCooldown > 0 || state.attackCooldown > 0) {
      if (!state.paused) state.tickCooldowns(delta)
    }

    // Nothing swings while the game is paused, during the end-of-level exam,
    // or once the player is down.
    if (state.paused || state.phase !== 'exploring') {
      if (timers.current.size > 0) {
        timers.current.clear()
        publishedKey.current = ''
        useGameStore.setState({ monsterSwing: {} })
      }
      return
    }

    const level = LEVELS[state.currentLevel - 1]
    const px = playerPosition.x
    const pz = playerPosition.z

    // The lock lets go on its own when the target dies (damageMonster already
    // did that) or when the player has simply walked off and left it.
    if (state.targetId) {
      const target = level.monsters.find((m) => m.id === state.targetId)
      if (!target || state.defeatedIds.has(state.targetId) || isOutOfLockRange(target, px, pz)) {
        state.setTarget(null)
      }
    }

    let engaged: MonsterData | null = null
    const swing: Record<string, number> = {}
    let anyEngaged = false

    for (const monster of level.monsters) {
      if (state.defeatedIds.has(monster.id)) {
        timers.current.delete(monster.id)
        continue
      }

      if (!isAggroed(monster, px, pz)) {
        timers.current.delete(monster.id)
        continue
      }

      anyEngaged = true
      if (engaged === null) engaged = monster

      // A monster that has just noticed the player winds up for a full
      // interval before its first hit — stepping into range is never an
      // instant loss of HP.
      const elapsed = (timers.current.get(monster.id) ?? 0) + delta
      if (elapsed >= monster.attackInterval) {
        timers.current.set(monster.id, elapsed - monster.attackInterval)
        useGameStore.getState().damagePlayer(monster.attackDamage)
        spawnFloatingHit('player', `-${monster.attackDamage}`, [playerPosition.x, playerPosition.y, playerPosition.z])
        // damagePlayer can end the run. Stop here rather than letting the rest
        // of the pack pile onto a corpse in the same frame.
        if (useGameStore.getState().phase !== 'exploring') return
      } else {
        timers.current.set(monster.id, elapsed)
      }

      swing[monster.id] = Math.max(0, monster.attackInterval - (timers.current.get(monster.id) ?? 0))
    }

    // Auto-lock: something is chewing on the player and they have not picked a
    // target. Handing them the nearest attacker is what keeps a fight from
    // needing a click before it can be answered — and it is only ever done
    // when the player is already under attack, so it never yanks the lock off
    // a monster they chose on purpose.
    //
    // Escape (and the panel's ✕) sets suppressAutoTarget, which is the one
    // thing that overrides this: without it, dismissing the panel while
    // standing in a monster's reach would be undone on the very next frame.
    if (anyEngaged) {
      if (!state.targetId && !state.suppressAutoTarget) {
        const nearest = nearestTarget(level.monsters, state.defeatedIds, px, pz)
        if (nearest) state.setTarget(nearest.id)
      }
    } else if (state.suppressAutoTarget) {
      // Out of everything's reach: the next monster to corner them gets to
      // open a panel again.
      state.allowAutoTarget()
    }

    sincePublish.current += delta
    if (sincePublish.current < SWING_PUBLISH_INTERVAL) return
    sincePublish.current = 0

    // One string per frame beats a deep compare: the nameplates only redraw
    // when a tenth of a second actually ticked over on somebody's bar.
    const key = Object.entries(swing)
      .map(([id, seconds]) => `${id}:${seconds.toFixed(1)}`)
      .join('|')
    if (key === publishedKey.current) return
    publishedKey.current = key
    useGameStore.getState().setMonsterSwing(swing)
  })

  return null
}
