import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from './store'
import type { PickupData } from './pickups'

// The two things lying around the dungeon, built to be told apart at a glance
// from the fixed isometric camera — which means silhouette first, color
// second: the healing draught is a round-bellied flask, the strength brew a
// tall angular vial with a blade over its cork.
//
// Both are lit by their own liquid rather than by the room. The levels are
// unlit by design (see constants.ts), so a pickup outside the lantern's pool
// would otherwise be an invisible black shape sitting in a corridor.
const POTIONS = {
  heal: {
    glass: '#bfe6cf',
    liquid: '#3fd07a',
    cork: '#7a5a3a',
  },
  attack: {
    glass: '#f0dcc0',
    liquid: '#ff9c2e',
    cork: '#6b4a2a',
  },
} as const

const FLOAT_HEIGHT = 0.12
const FLOAT_CYCLES_PER_SECOND = 0.55
const SPIN_PER_SECOND = 0.7

function GlassMaterial({ color }: { color: string }) {
  return <meshStandardMaterial color={color} transparent opacity={0.35} roughness={0.08} metalness={0.1} />
}

function LiquidMaterial({ color, intensity = 1.1 }: { color: string; intensity?: number }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} roughness={0.3} />
}

// Round belly, short neck, cork on top: the classic healing draught.
function HealthPotion() {
  const { glass, liquid, cork } = POTIONS.heal
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.26, 20, 16]} />
        <GlassMaterial color={glass} />
      </mesh>
      {/* The draught itself, a little smaller than the glass so it reads as
          liquid sitting inside the bottle rather than as the bottle. */}
      <mesh position={[0, -0.03, 0]}>
        <sphereGeometry args={[0.21, 18, 14]} />
        <LiquidMaterial color={liquid} />
      </mesh>
      <mesh castShadow position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.16, 12]} />
        <GlassMaterial color={glass} />
      </mesh>
      <mesh castShadow position={[0, 0.41, 0]}>
        <cylinderGeometry args={[0.075, 0.085, 0.09, 12]} />
        <meshStandardMaterial color={cork} roughness={0.9} />
      </mesh>
      {/* Collar tie, so the two potions differ in outline and not just hue. */}
      <mesh position={[0, 0.24, 0]}>
        <torusGeometry args={[0.1, 0.018, 8, 16]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  )
}

// Tall faceted vial with a blade riding above it: the strength brew.
function StrengthPotion() {
  const { glass, liquid, cork } = POTIONS.attack
  return (
    <group>
      <mesh castShadow>
        <cylinderGeometry args={[0.17, 0.22, 0.4, 6]} />
        <GlassMaterial color={glass} />
      </mesh>
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[0.14, 0.185, 0.3, 6]} />
        <LiquidMaterial color={liquid} />
      </mesh>
      <mesh castShadow position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.07, 0.13, 0.14, 6]} />
        <GlassMaterial color={glass} />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.065, 0.075, 0.08, 10]} />
        <meshStandardMaterial color={cork} roughness={0.9} />
      </mesh>
      {/* The mark of what it does: a small sword standing over the cork. */}
      <group position={[0, 0.62, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.05, 0.26, 0.02]} />
          <LiquidMaterial color="#ffd98a" intensity={0.8} />
        </mesh>
        <mesh castShadow position={[0, 0.17, 0]}>
          <coneGeometry args={[0.035, 0.09, 4]} />
          <LiquidMaterial color="#ffd98a" intensity={0.8} />
        </mesh>
        <mesh castShadow position={[0, -0.14, 0]}>
          <boxGeometry args={[0.16, 0.03, 0.03]} />
          <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  )
}

export function Pickup({ data }: { data: PickupData }) {
  const collected = useGameStore((s) => s.collectedPickupIds.has(data.id))
  const bottle = useRef<THREE.Group>(null)

  // Turning on the spot and drifting up and down is what marks these out as
  // something to pick up rather than scenery. The phase is seeded from the
  // position so a room full of potions does not bob in lockstep.
  const offset = data.position[0] + data.position[2]
  useFrame((state) => {
    if (!bottle.current) return
    const t = state.clock.elapsedTime
    bottle.current.rotation.y = t * SPIN_PER_SECOND
    bottle.current.position.y = Math.sin(t * FLOAT_CYCLES_PER_SECOND * Math.PI * 2 + offset) * FLOAT_HEIGHT
  })

  if (collected) return null

  return (
    <group position={data.position}>
      <group ref={bottle}>{data.kind === 'heal' ? <HealthPotion /> : <StrengthPotion />}</group>
    </group>
  )
}
