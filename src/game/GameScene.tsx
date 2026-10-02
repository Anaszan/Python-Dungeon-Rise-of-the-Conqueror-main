import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { Sparkles } from '@react-three/drei'
import { Ground } from './Ground'
import { Player } from './Player'
import { IsoCamera } from './IsoCamera'
import { Monster } from './Monster'
import { Pickup } from './Pickup'
import { CombatTicker } from './CombatTicker'
import { TargetPanel } from './TargetPanel'
import { FloatingHits } from './FloatingHits'
import { playerPosition } from './playerPosition'
import { cancelClickMove, clickMoveTarget, setClickMoveTarget } from './clickMove'
import { findPath } from './pathfind'
import { cycleTarget } from './combat'
import { isTypingTarget } from './useKeyboardMap'
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
import { availableMonsters, LEVELS } from './levels'
import { levelColliders } from './propCollision'
import { useGameStore } from './store'
import { PICKUP_TRIGGER_DISTANCE, POSITION_SAVE_DISTANCE, POSITION_SAVE_MIN_INTERVAL_SECONDS } from './constants'
import { canStandAt } from './dungeon'

// The ring left on the floor where the player clicked, for as long as they are
// still walking to it. Driven straight off the module state every frame rather
// than through React: the destination changes on a click and clears itself
// mid-walk (Player.tsx), neither of which is worth a re-render of the scene.
function ClickMoveMarker() {
  const ring = useRef<Mesh>(null)

  useFrame((_, delta) => {
    const mesh = ring.current
    if (!mesh) return
    mesh.visible = clickMoveTarget.active
    if (!mesh.visible) return
    mesh.position.set(clickMoveTarget.x, 0.03, clickMoveTarget.z)
    mesh.rotation.z += delta * 1.6
  })

  return (
    <mesh ref={ring} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.22, 0.32, 24, 1, 0, Math.PI * 1.5]} />
      <meshBasicMaterial color="#f0c85a" transparent opacity={0.8} depthWrite={false} />
    </mesh>
  )
}

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
  // The one shared player position (see playerPosition.ts). Player.tsx writes
  // it, IsoCamera follows it, and every combat check in the level reads it.
  const playerPos = useRef(playerPosition)
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)
  // Re-renders the scene when a monster dies, which is exactly when the boss
  // may need to appear.
  const defeatedIds = useGameStore((s) => s.defeatedIds)
  const levelData = LEVELS[currentLevel - 1]
  // Walls plus every solid prop (coffins, shelves, statues...) — see
  // propCollision.ts. Memoized per level: Player tests against this list
  // every frame, and rebuilding it each render would be pointless churn.
  const colliders = useMemo(() => levelColliders(levelData), [levelData])
  const theme = levelData.theme
  const prevPhase = useRef(phase)
  const prevLevel = useRef(currentLevel)
  // Position saving (see POSITION_SAVE_DISTANCE): where the last save put the
  // player, and when. `placed` is false until the first frame has decided
  // where this mount starts — the saved spot or the entrance.
  const placed = useRef(false)
  const lastSavedAt = useRef({ x: 0, z: 0 })
  const lastSaveTime = useRef(0)

  useFrame(({ clock }) => {
    const state = useGameStore.getState()

    // First frame of this mount: put the player back where they left off.
    // Only a spot recorded on *this* level counts, and only if it is still
    // somewhere a body can stand — a level edit (a new coffin, a moved wall)
    // since the spot was saved must never wedge the player inside something.
    // Anything else starts at the entrance, as it always did.
    //
    // Done here rather than in an effect for the same reason the respawn
    // below is: the frame loop is what reads the position, so the frame loop
    // is what has to set it before anything else looks.
    if (!placed.current) {
      placed.current = true
      const level = LEVELS[state.currentLevel - 1]
      const saved = state.lastPosition
      const [, spawnY] = level.spawnPosition
      if (saved && saved.level === state.currentLevel && canStandAt(saved.x, saved.z, level.regions, colliders)) {
        playerPos.current.set(saved.x, spawnY, saved.z)
      } else {
        playerPos.current.set(...level.spawnPosition)
      }
      lastSavedAt.current = { x: playerPos.current.x, z: playerPos.current.z }
      lastSaveTime.current = clock.elapsedTime
    }

    if (state.paused || state.bossReveal) return

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
      // A destination clicked on the old floor means nothing on the new one —
      // left standing, it would march the player off toward those coordinates
      // the instant they arrived.
      cancelClickMove()
      // The distance for the next save is measured from here, not from the
      // spot on the level (or the run) just left behind.
      lastSavedAt.current = { x: playerPos.current.x, z: playerPos.current.z }
    }
    prevPhase.current = state.phase
    prevLevel.current = state.currentLevel

    if (state.phase !== 'exploring') return

    // Walked far enough since the last save → save again. Measured as a
    // straight line from the last saved spot, so pacing back and forth in one
    // room does not keep writing the same few metres over and over.
    const movedX = playerPos.current.x - lastSavedAt.current.x
    const movedZ = playerPos.current.z - lastSavedAt.current.z
    if (
      movedX * movedX + movedZ * movedZ >= POSITION_SAVE_DISTANCE * POSITION_SAVE_DISTANCE &&
      clock.elapsedTime - lastSaveTime.current >= POSITION_SAVE_MIN_INTERVAL_SECONDS
    ) {
      lastSavedAt.current = { x: playerPos.current.x, z: playerPos.current.z }
      lastSaveTime.current = clock.elapsedTime
      state.recordPosition(playerPos.current.x, playerPos.current.z)
    }

    const frameLevelData = LEVELS[state.currentLevel - 1]

    // Walking into a monster no longer starts anything — monsters decide for
    // themselves whether the player is close enough to swing at (see
    // CombatTicker), and the player decides for themselves what to hit back
    // (see Monster's click target). All that is left here is pickups.
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

  // Closing the tab, switching away, or locking the phone: save the spot
  // right now, even if the player has not walked a full save distance yet.
  // 'hidden' fires before the page is torn down, which gives the request a
  // chance to leave; it is best-effort, and the distance-based saves above
  // are what guarantee the player never loses more than a few steps.
  useEffect(() => {
    const saveNow = () => {
      if (document.visibilityState !== 'hidden') return
      const state = useGameStore.getState()
      if (!placed.current || state.phase !== 'exploring') return
      const movedX = playerPosition.x - lastSavedAt.current.x
      const movedZ = playerPosition.z - lastSavedAt.current.z
      if (movedX * movedX + movedZ * movedZ < 0.25) return // barely moved: nothing new to say
      lastSavedAt.current = { x: playerPosition.x, z: playerPosition.z }
      state.recordPosition(playerPosition.x, playerPosition.z)
    }
    document.addEventListener('visibilitychange', saveNow)
    return () => document.removeEventListener('visibilitychange', saveNow)
  }, [])

  // Tab walks down the monsters in range, nearest first — the one keyboard
  // habit an RO player brings with them. Bound here rather than in the target
  // panel because it has to work with nothing targeted yet, which is exactly
  // when the panel does not exist.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Tab' || isTypingTarget(e.target)) return
      const state = useGameStore.getState()
      if (state.phase !== 'exploring' || state.paused) return
      // Tab is the browser's own focus key, and there is nothing to focus in a
      // dungeon.
      e.preventDefault()
      const next = cycleTarget(
        availableMonsters(LEVELS[state.currentLevel - 1], state.defeatedIds),
        state.defeatedIds,
        playerPosition.x,
        playerPosition.z,
        state.targetId,
      )
      state.setTarget(next?.id ?? null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
        onFloorClick={(x, z) => {
          // Clicking the floor while dead, paused or mid-victory should not
          // quietly queue up a walk for whenever the screen clears.
          const state = useGameStore.getState()
          if (state.phase !== 'exploring' || state.paused) return
          // Routed around the walls and the solid props rather than aimed
          // straight at the spot: the dungeon is full of corners a straight
          // line cannot solve, and walking into one used to just cancel the
          // walk. null means there is genuinely no way there — a click on the
          // far side of a wall the level never opened — so nothing happens.
          const route = findPath(
            playerPosition.x,
            playerPosition.z,
            x,
            z,
            levelData.regions,
            colliders,
          )
          if (!route) return
          setClickMoveTarget(x, z, route)
        }}
      />
      <ClickMoveMarker />
      <Player positionRef={playerPos} regions={levelData.regions} walls={colliders} />
      <CombatTicker />
      {/* Both live inside the canvas because both are anchored to points in
          the world: the code boxes ride along beside the targeted monster,
          and every damage number pops off whatever it was dealt to. */}
      <TargetPanel />
      <FloatingHits />
      {/* The level's boss is simply not here until every other monster on the
          floor is dead — no model, no nameplate, nothing to click. Walking
          into its corner early finds an empty room, and the moment the last
          minion drops it appears (see availableMonsters). */}
      {availableMonsters(levelData, defeatedIds).map((monster) => (
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
