import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useKeyboardMap } from './useKeyboardMap'
import { touchMoveState } from './TouchJoystick'
import {
  LANTERN_HEIGHT,
  LANTERN_INTENSITY,
  LANTERN_RADIUS,
  LIGHT_DECAY,
  PLAYER_SPEED,
} from './constants'
import { canStandAt, hitsWall, isWalkable, type Region, type Wall } from './dungeon'
import { useGameStore } from './store'
import { DEFAULT_CHARACTER_CLASS } from '../character/characterOptions'
import { CharacterModel } from '../character/CharacterModel'

export function Player({
  positionRef,
  regions,
  walls,
}: {
  positionRef: RefObject<THREE.Vector3>
  regions: Region[]
  walls: Wall[]
}) {
  const root = useRef<THREE.Group>(null!)
  const modelGroup = useRef<THREE.Group>(null!)
  const move = useKeyboardMap()
  const facing = useRef(0)
  const dir = useRef(new THREE.Vector3())
  // Walk-cycle accumulator: a fake gait (bob + side-to-side sway) applied to
  // the model only. Every class model is rigged now, but nothing drives those
  // skeletons yet, so this stands in until a real walk cycle does.
  // bobAmount eases toward 0/1 so starting and stopping don't snap.
  const walkPhase = useRef(0)
  const bobAmount = useRef(0)
  const characterClass = useGameStore((s) => s.characterClass) ?? DEFAULT_CHARACTER_CLASS
  const gender = useGameStore((s) => s.gender)
  const skinColor = useGameStore((s) => s.skinColor)

  useFrame((_, delta) => {
    const state = useGameStore.getState()
    if (state.phase !== 'exploring' || state.paused) return

    const m = move.current
    dir.current.set(
      (m.right ? 1 : 0) - (m.left ? 1 : 0) + touchMoveState.x,
      0,
      (m.backward ? 1 : 0) - (m.forward ? 1 : 0) + touchMoveState.z,
    )
    const moving = dir.current.lengthSq() > 0.0001

    if (moving) {
      dir.current.normalize()
      const pos = positionRef.current
      const nextX = pos.x + dir.current.x * PLAYER_SPEED * delta
      const nextZ = pos.z + dir.current.z * PLAYER_SPEED * delta

      // Standing somewhere canStandAt() rejects would make every step
      // illegal and wedge the player in place, so if that ever happens
      // (a spawn point authored right against a wall) fall back to a laxer
      // test until they've walked clear of the edge again. That fallback
      // still refuses to enter a wall's actual box — only the body's own
      // clearance around it is dropped — so recovering from a bad spot can
      // never turn into walking through the wall itself.
      const clear = canStandAt(pos.x, pos.z, regions, walls)
      const allowed = (x: number, z: number) =>
        clear
          ? canStandAt(x, z, regions, walls)
          : isWalkable(x, z, regions) && !hitsWall(x, z, walls, 0)

      // Axis at a time, so running into a wall diagonally slides along it
      // instead of stopping dead.
      if (allowed(nextX, pos.z)) pos.x = nextX
      if (allowed(pos.x, nextZ)) pos.z = nextZ

      facing.current = Math.atan2(dir.current.x, dir.current.z)
    }

    root.current.position.set(positionRef.current.x, positionRef.current.y, positionRef.current.z)
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, facing.current, 0.2)

    bobAmount.current = THREE.MathUtils.lerp(bobAmount.current, moving ? 1 : 0, 0.15)
    walkPhase.current += delta * 9
    if (modelGroup.current) {
      modelGroup.current.position.y = Math.abs(Math.sin(walkPhase.current)) * 0.05 * bobAmount.current
      modelGroup.current.rotation.z = Math.sin(walkPhase.current) * 0.06 * bobAmount.current
    }
  })

  return (
    <group ref={root} position={[0, 0.6, 0]}>
      {/* The lantern the player carries through the dark. It hangs off the
          root group rather than modelGroup so the pool of light stays put
          while the walk cycle bobs the model inside it. This is the only
          light that follows the player, so how far they can see is exactly
          LANTERN_RADIUS in every direction until they reach a torch. */}
      <pointLight
        position={[0, LANTERN_HEIGHT, 0]}
        color="#ffc978"
        intensity={LANTERN_INTENSITY}
        distance={LANTERN_RADIUS}
        decay={LIGHT_DECAY}
      />
      <group ref={modelGroup}>
        <CharacterModel appearance={{ characterClass, gender, skinColor }} />
      </group>
    </group>
  )
}
