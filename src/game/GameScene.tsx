import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { Ground } from './Ground'
import { Player } from './Player'
import { IsoCamera } from './IsoCamera'
import { Monster } from './Monster'
import { Pickup } from './Pickup'
import { CombatTicker } from './CombatTicker'
import {
  BonePile,
  Bookshelf,
  Brazier,
  Cage,
  Coffin,
  Crystal,
  FloatingRubble,
  FloatingTome,
  GlitchRift,
  ReadingDesk,
  RuneCircle,
  SpikeTrap,
  Statue,
  Torch,
  TreasureChest,
  Wisp,
} from './DungeonProps'
import type { PropProps } from './DungeonProps'
import type { DecorationKind } from './levels'
import { LEVELS } from './levels'
import { useGameStore } from './store'
import { COMBAT_TRIGGER_DISTANCE, FLEE_CLEAR_DISTANCE, PICKUP_TRIGGER_DISTANCE } from './constants'

// Every prop takes the same props (see PropProps), so a level's decoration
// list maps straight through this table — adding a prop kind is a new entry
// here and a new component in DungeonProps, with no branch to touch.
const DECORATION_COMPONENTS: Record<DecorationKind, (props: PropProps) => React.ReactElement> = {
  torch: Torch,
  statue: Statue,
  chest: TreasureChest,
  bones: BonePile,
  wisp: Wisp,
  coffin: Coffin,
  brazier: Brazier,
  cage: Cage,
  runeCircle: RuneCircle,
  crystal: Crystal,
  tome: FloatingTome,
  bookshelf: Bookshelf,
  desk: ReadingDesk,
  spikeTrap: SpikeTrap,
  rift: GlitchRift,
  rubble: FloatingRubble,
}

export function GameScene() {
  const playerPos = useRef(new THREE.Vector3(0, 0.6, 0))
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const levelData = LEVELS[currentLevel - 1]
  const theme = levelData.theme
  const prevPhase = useRef(phase)
  const prevLevel = useRef(currentLevel)

  useFrame(() => {
    const state = useGameStore.getState()
    if (state.paused) return

    // Reposition the player back to the level's spawn point the instant a
    // restart or level-advance is observed, right here in the frame loop —
    // not in a React effect. GameScene renders through R3F's own reconciler,
    // which commits independently of react-dom's synchronous discrete-event
    // flush, so an effect reacting to the state change can lose the race to
    // this very useFrame callback on the next rAF tick. Since the player is
    // always standing right next to whatever just killed them, a stale
    // position here would immediately re-trigger combat with that same
    // monster before any effect-based reset ever got a chance to run.
    const restarted = prevPhase.current === 'gameover' && state.phase === 'exploring'
    const levelChanged = prevLevel.current !== state.currentLevel
    if (restarted || levelChanged) {
      playerPos.current.set(...LEVELS[state.currentLevel - 1].spawnPosition)
    }
    prevPhase.current = state.phase
    prevLevel.current = state.currentLevel

    if (state.phase !== 'exploring') return

    const frameLevelData = LEVELS[state.currentLevel - 1]

    let enteredCombat = false
    for (const monster of frameLevelData.monsters) {
      if (state.defeatedIds.has(monster.id)) continue
      const dx = playerPos.current.x - monster.position[0]
      const dz = playerPos.current.z - monster.position[2]
      const distSq = dx * dx + dz * dz

      if (monster.id === state.fledMonsterId) {
        // Don't re-trigger the monster we just fled until we've stepped away
        // from it — otherwise Flee immediately re-enters the same fight.
        if (distSq > FLEE_CLEAR_DISTANCE * FLEE_CLEAR_DISTANCE) state.clearFledMonster()
        continue
      }

      if (distSq < COMBAT_TRIGGER_DISTANCE * COMBAT_TRIGGER_DISTANCE) {
        state.enterCombat(monster)
        enteredCombat = true
        break
      }
    }
    if (enteredCombat) return

    for (const pickup of frameLevelData.pickups) {
      if (state.collectedPickupIds.has(pickup.id)) continue
      const dx = playerPos.current.x - pickup.position[0]
      const dz = playerPos.current.z - pickup.position[2]
      if (dx * dx + dz * dz < PICKUP_TRIGGER_DISTANCE * PICKUP_TRIGGER_DISTANCE) {
        state.collectPickup(pickup.id)
        if (pickup.kind === 'heal') state.healPlayer(pickup.amount)
        else state.increaseAttackPower(pickup.amount)
      }
    }
  })

  return (
    <>
      <IsoCamera target={playerPos} />
      {/* Dungeon lighting: the level is dark, and the only things that light
          it are the lantern the player carries (Player.tsx) and the torches
          standing in the level (DungeonProps' Torch). There is deliberately
          no scene-wide light source here — no directional sun, no hemisphere
          fill — so a room the player has not walked into, and that has no
          torch of its own, renders as black as the void around it.

          What is left is the background, painted the level's own darkness so
          unlit geometry has nothing to sit against, a trace of ambient so a
          silhouette just outside the lantern still reads rather than
          vanishing outright, and fog to swallow the distance. All three are
          per-level (levelTheme.ts): the catacombs' dark is green, the tower's
          is violet, and the arena's is both warmer and further off, which is
          what makes an open colosseum feel open.

          Fog is measured from the camera, not the player, and IsoCamera sits
          ~18 units back — so its near plane has to clear that plus the reach
          of the lantern, or the far edge of the player's own pool of light
          would be the first thing the fog eats. Set past both, it does the
          one job it is here for: putting out torches on the far side of the
          level so a long corridor ends in darkness rather than in a row of
          visible flames. */}
      <color attach="background" args={[theme.fog.color]} />
      <fog attach="fog" args={[theme.fog.color, theme.fog.near, theme.fog.far]} />
      <ambientLight intensity={theme.ambient.intensity} color={theme.ambient.color} />
      <Sparkles
        count={theme.motes.count}
        scale={theme.motes.scale}
        size={theme.motes.size}
        speed={theme.motes.speed}
        opacity={theme.motes.opacity}
        color={theme.motes.color}
      />
      <Ground
        regions={levelData.regions}
        walls={levelData.walls}
        theme={theme}
        floorTextureUrl={levelData.floorTextureUrl}
        wallTextureUrl={levelData.wallTextureUrl}
      />
      <Player positionRef={playerPos} regions={levelData.regions} walls={levelData.walls} />
      <CombatTicker />
      {levelData.monsters.map((monster) => (
        <Monster key={monster.id} data={monster} />
      ))}
      {levelData.pickups.map((pickup) => (
        <Pickup key={pickup.id} data={pickup} />
      ))}
      {levelData.decorations?.map((deco, i) => {
        const Prop = DECORATION_COMPONENTS[deco.kind]
        return <Prop key={i} position={deco.position} rotationY={deco.rotationY} color={deco.color} />
      })}
    </>
  )
}
