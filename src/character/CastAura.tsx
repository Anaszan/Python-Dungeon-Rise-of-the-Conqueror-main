import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { CharacterClass } from './characterOptions'
import { CAST_STYLES, castSeconds, type CastSignal } from './cast'

// The light that goes with a cast: a rune ring that opens out across the floor
// under the caster, and a flare at the height their hands are working at, both
// in the class's own colour (CAST_STYLES).
//
// It exists because the dungeon is dark and the camera is a long way back — a
// pose alone, on a 1.3-unit character seen from above, is easy to miss. The
// glow is what makes a cast unmistakable from across the room, and the colour
// is what makes it read as *that class's* magic.
//
// Rendered as a child of the player group in Player.tsx, so it travels with
// them if they cast and keep walking.

// Where the flare sits, in the same units the fitted character stands in:
// out in front of the caster's weapon hand, at about chest height. It is
// deliberately small — big enough to read as light leaving the hand, never big
// enough to hide the pose it is meant to be selling.
const FLARE_POSITION: [number, number, number] = [0.17, 0.06, 0.32]

// The rune ring's height, and it is fussier than it looks. This group hangs
// off the player, whose own origin sits 0.6 above the floor (every level's
// spawnPosition, and Ground draws its floor slabs at world y = 0) — so the
// ring has to land just *above* -0.6, not below it, or the floor covers the
// whole thing and the only part that ever shows is whatever spills past the
// edge of the room.
const FLOOR_Y = -0.57

export function CastAura({
  characterClass,
  cast,
}: {
  characterClass: CharacterClass
  cast: CastSignal | null
}) {
  const style = CAST_STYLES[characterClass]
  const color = useMemo(() => new THREE.Color(style.color), [style.color])

  const ring = useRef<THREE.Mesh>(null)
  const ringMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const flare = useRef<THREE.Mesh>(null)
  const flareMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const group = useRef<THREE.Group>(null)

  // Seconds into the current cast, or null when there is nothing to draw.
  const elapsed = useRef<number | null>(null)
  const total = useRef(0)
  const gain = useRef(1)

  useEffect(() => {
    if (!cast) return
    elapsed.current = 0
    total.current = castSeconds(characterClass, cast.kind)
    // The special skill is the bigger, brighter version of the same magic.
    gain.current = cast.kind === 'skill' ? 1.7 : 1
  }, [cast, characterClass])

  useFrame((_, delta) => {
    if (!group.current) return

    if (elapsed.current === null) {
      if (group.current.visible) group.current.visible = false
      return
    }

    elapsed.current += delta
    const p = elapsed.current / total.current
    if (p >= 1) {
      elapsed.current = null
      group.current.visible = false
      return
    }
    group.current.visible = true

    // The ring opens out fast and thins as it goes, the way a shockwave reads.
    // Sized against the isometric camera rather than the character: from
    // eighteen units back, a ring that only just clears their feet is a
    // smudge, so it ends up about twice as wide as they are tall.
    const spread = 0.75 + p * 1.15 * gain.current
    if (ring.current) {
      ring.current.scale.setScalar(spread)
      ring.current.rotation.z += delta * 1.4
    }
    if (ringMaterial.current) ringMaterial.current.opacity = (1 - p) * 0.95

    // The flare is the opposite shape: it snaps to full in the first fifth of
    // the cast — the moment the spell leaves the hands — and falls away after.
    const punch = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8
    if (flare.current) flare.current.scale.setScalar((0.055 + punch * 0.075) * gain.current)
    if (flareMaterial.current) flareMaterial.current.opacity = punch * 0.9
    if (light.current) light.current.intensity = punch * 9 * gain.current
  })

  return (
    <group ref={group} visible={false}>
      {/* Flat on the floor, and deliberately unlit + depth-write-free: it is a
          glow painted on the ground, not an object standing on it. */}
      <mesh ref={ring} position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* A closed circle, not the three-quarter arc the target ring uses:
            additive gold on an already-bright torchlit floor is a subtle
            change, and a gap in it turned what was left into a stray smear
            rather than a rune. */}
        <ringGeometry args={[0.5, 0.74, 48]} />
        {/* Ordinary alpha blending, unlike the flare above. Additive is the
            obvious choice for a glow and it is the wrong one here: the floor
            it lands on is already torchlit orange, and adding gold to gold is
            a change nobody can see. Painting over the floor reads on a lit
            slab and in an unlit corridor alike. */}
        <meshBasicMaterial
          ref={ringMaterial}
          color={color}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={flare} position={FLARE_POSITION}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          ref={flareMaterial}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Short range on purpose: the lantern is what lights the room, and this
          is only meant to wash the caster and the floor right around them. */}
      <pointLight
        ref={light}
        position={[FLARE_POSITION[0], FLARE_POSITION[1] + 0.25, FLARE_POSITION[2]]}
        color={color}
        intensity={0}
        distance={4.5}
        decay={1.6}
      />
    </group>
  )
}
