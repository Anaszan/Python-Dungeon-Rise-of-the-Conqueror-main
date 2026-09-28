import { useRef, useState, type RefObject } from 'react'
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
import { cancelClickMove, clickMoveDirection } from './clickMove'
import { useGameStore } from './store'
import { DEFAULT_CHARACTER_CLASS } from '../character/characterOptions'
import { CharacterModel } from '../character/CharacterModel'
import { CastAura } from '../character/CastAura'
import { useCastSignal } from '../character/cast'

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
  const move = useKeyboardMap()
  const facing = useRef(0)
  const dir = useRef(new THREE.Vector3())
  // The only per-frame value the model needs from here: whether the player is
  // walking. It is React state rather than a ref because the walk cycle lives
  // inside CharacterModel (it is rig-specific — see character/gait.ts), and it
  // only ever changes when the player starts or stops.
  const [walking, setWalking] = useState(false)
  const characterClass = useGameStore((s) => s.characterClass) ?? DEFAULT_CHARACTER_CLASS
  const gender = useGameStore((s) => s.gender)
  const skinColor = useGameStore((s) => s.skinColor)
  const shirtColor = useGameStore((s) => s.shirtColor)
  // The last spell that actually went off (TargetPanel fires it). This is the
  // only player-side copy of the character that casts — the profile portrait
  // passes nothing and just stands there.
  const cast = useCastSignal()

  useFrame((_, delta) => {
    const state = useGameStore.getState()
    const active = state.phase === 'exploring' && !state.paused

    const m = move.current
    dir.current.set(
      (m.right ? 1 : 0) - (m.left ? 1 : 0) + touchMoveState.x,
      0,
      (m.backward ? 1 : 0) - (m.forward ? 1 : 0) + touchMoveState.z,
    )

    // Steering by hand always wins: the first key (or joystick nudge) drops
    // whatever the last click was walking toward, so the two never fight over
    // the same body.
    if (dir.current.lengthSq() > 0.0001) {
      cancelClickMove()
    } else {
      const toClick = clickMoveDirection(positionRef.current.x, positionRef.current.z)
      // Null means the walk is over — either nothing was clicked, or the
      // destination has been reached and this is the step that stops.
      if (toClick) dir.current.set(toClick.x, 0, toClick.z)
      else cancelClickMove()
    }
    // Held keys during a fight or a pause must not leave the model marching in
    // place, so this asks whether the player is walking, not merely steering.
    const moving = active && dir.current.lengthSq() > 0.0001
    if (moving !== walking) setWalking(moving)
    if (!active) return

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
      const steppedX = allowed(nextX, pos.z)
      if (steppedX) pos.x = nextX
      const steppedZ = allowed(pos.x, nextZ)
      if (steppedZ) pos.z = nextZ

      // A click-walk that cannot move on either axis is wedged against
      // something between it and the destination (the dungeon has corners a
      // straight line does not solve). Give up rather than grinding into the
      // wall forever — sliding along one is unaffected, since that still
      // moves on one axis.
      if (!steppedX && !steppedZ) cancelClickMove()

      facing.current = Math.atan2(dir.current.x, dir.current.z)
    }

    root.current.position.set(positionRef.current.x, positionRef.current.y, positionRef.current.z)
    root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, facing.current, 0.2)
  })

  return (
    <group ref={root} position={[0, 0.6, 0]}>
      {/* The lantern the player carries through the dark. It hangs off the
          root rather than the model, so the pool of light stays put while the
          walk cycle bobs the character inside it. This is the only light that
          follows the player, so how far they can see is exactly
          LANTERN_RADIUS in every direction until they reach a torch. */}
      <pointLight
        position={[0, LANTERN_HEIGHT, 0]}
        color="#ffc978"
        intensity={LANTERN_INTENSITY}
        distance={LANTERN_RADIUS}
        decay={LIGHT_DECAY}
      />
      <CharacterModel appearance={{ characterClass, gender, skinColor, shirtColor }} moving={walking} cast={cast} />
      {/* The glow and the rune ring that go with the pose. Inside the same
          group, so a cast that carries on while the player walks travels with
          them instead of being left behind on the floor. */}
      <CastAura characterClass={characterClass} cast={cast} />
    </group>
  )
}
