import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard } from '@react-three/drei'
import * as THREE from 'three'
import {
  BRAZIER_INTENSITY,
  BRAZIER_RADIUS,
  CANDLE_INTENSITY,
  CANDLE_RADIUS,
  CRYSTAL_INTENSITY,
  CRYSTAL_RADIUS,
  LIGHT_DECAY,
  RIFT_INTENSITY,
  RIFT_RADIUS,
  TORCH_INTENSITY,
  TORCH_RADIUS,
  WISP_INTENSITY,
  WISP_RADIUS,
} from './constants'

// Every prop takes the same three inputs so GameScene can map a
// DecorationData straight onto a component without a per-kind branch.
// `rotationY` turns a prop to face a wall; `color` is how one component
// covers a level's variant of it (an arcane torch burns violet, a vault
// crystal burns black-purple).
export type PropProps = {
  position: [number, number, number]
  rotationY?: number
  color?: string
}

// Soft radial-gradient glow sprite, drawn once to a canvas — same zero-asset
// approach as the floor/wall textures in Ground.tsx.
function createGlowTexture(color: string) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, color)
  grad.addColorStop(0.4, color)
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Detail (which way a bone lies, what colour a shelf's books are, how a prop
// bobs out of phase with its neighbours) is derived from where the prop
// stands, so two copies of the same prop differ from each other but neither
// changes between renders or between runs.
function seededRandom(position: [number, number, number]) {
  let a = Math.floor(Math.abs(position[0] * 7919 + position[2] * 104729) * 16) + 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// ด่าน 1 — ทางเดินมืด: guttering torches, worn statues, a chest at the end.
// ---------------------------------------------------------------------------

export function Torch({ position, color = '#ffaa3c' }: PropProps) {
  const glowTex = useMemo(() => createGlowTexture(hexToRgba(color, 0.9)), [color])
  const lightRef = useRef<THREE.PointLight>(null!)
  const flameRef = useRef<THREE.Mesh>(null!)

  // The flicker is what sells a torch as a fire rather than a lamp, and in a
  // dark level it moves the edge of the pool of light around with it. Divided
  // out by its own ~1.1 baseline so TORCH_INTENSITY stays the honest average
  // brightness rather than something the flicker quietly scales up.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flicker = 1.1 + Math.sin(t * 11) * 0.15 + Math.sin(t * 23) * 0.08
    if (lightRef.current) lightRef.current.intensity = (flicker / 1.1) * TORCH_INTENSITY
    if (flameRef.current) flameRef.current.scale.setScalar(0.9 + flicker * 0.15)
  })

  return (
    <group position={position}>
      <mesh castShadow position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 1.1, 6]} />
        <meshStandardMaterial color="#2c2418" />
      </mesh>
      {/* Along with the player's lantern, this is the only thing lighting the
          dungeon — see GameScene. Everything outside TORCH_RADIUS of one of
          these, and outside the player's own pool, stays dark. */}
      <pointLight
        ref={lightRef}
        position={[0, 1.15, 0]}
        color={color}
        intensity={TORCH_INTENSITY}
        distance={TORCH_RADIUS}
        decay={LIGHT_DECAY}
      />
      <Billboard position={[0, 1.15, 0]}>
        <mesh ref={flameRef}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Billboard>
    </group>
  )
}

export function Statue({ position, rotationY = 0, color = '#4a4436' }: PropProps) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.9]} />
        <meshStandardMaterial color="#3a3226" />
      </mesh>
      <mesh castShadow position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.28, 0.34, 1.2, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 1.85, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

export function TreasureChest({ position, rotationY = 0 }: PropProps) {
  const glowTex = useMemo(() => createGlowTexture('rgba(255, 214, 110, 0.85)'), [])
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.6]} />
        <meshStandardMaterial color="#4a3320" />
      </mesh>
      <mesh castShadow position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.6, 12, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#5a4028" />
      </mesh>
      <mesh position={[0, 0.5, 0.31]}>
        <boxGeometry args={[0.12, 0.12, 0.05]} />
        <meshStandardMaterial color="#d4af37" emissive="#d4af37" emissiveIntensity={0.6} />
      </mesh>
      <Billboard position={[0, 0.4, 0]}>
        <mesh>
          <planeGeometry args={[1.4, 1.4]} />
          {/* Dimmer than the torch flame on purpose: the chest glimmers in a
              dark room to hint that something is over there, without lighting
              itself up so brightly that it reads as a third light source. */}
          <meshBasicMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.28} />
        </mesh>
      </Billboard>
    </group>
  )
}

// Skull, ribs and scattered long bones. Marks a dragon's nest in ด่าน 1 and
// the older, bigger skeletons in the catacombs and the arena.
export function BonePile({ position, rotationY = 0, color = '#cfc7ad' }: PropProps) {
  const bones = useMemo(() => {
    const rand = seededRandom(position)
    return Array.from({ length: 4 }, () => ({
      x: (rand() - 0.5) * 1.1,
      z: (rand() - 0.5) * 1.1,
      angle: rand() * Math.PI,
      length: 0.4 + rand() * 0.4,
    }))
  }, [position])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {bones.map((b, i) => (
        <mesh key={i} castShadow position={[b.x, 0.06, b.z]} rotation={[Math.PI / 2, 0, b.angle]}>
          <cylinderGeometry args={[0.045, 0.045, b.length, 5]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      {/* ribcage arcs, half-buried */}
      {[0, 1].map((i) => (
        <mesh key={`rib-${i}`} castShadow position={[0.15 + i * 0.28, 0.02, -0.1]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.3 - i * 0.05, 0.035, 5, 10, Math.PI]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh castShadow position={[-0.45, 0.15, 0.2]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.45, 0.08, 0.32]}>
        <boxGeometry args={[0.2, 0.08, 0.14]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// ด่าน 2 — ห้องใต้ดินที่ลึกกว่าเดิม: spirit lights and stone coffins.
// ---------------------------------------------------------------------------

// The catacombs' light source. Drifts on its own little orbit rather than
// hanging still, so a corridor lit by these never reads as a corridor lit by
// lamps — and being much dimmer than a torch, it keeps the level dark.
export function Wisp({ position, color = '#7fe8d0' }: PropProps) {
  const glowTex = useMemo(() => createGlowTexture(hexToRgba(color, 0.85)), [color])
  const groupRef = useRef<THREE.Group>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const phase = useMemo(() => seededRandom(position)() * Math.PI * 2, [position])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (groupRef.current) {
      groupRef.current.position.set(
        position[0] + Math.sin(t * 0.6) * 0.4,
        position[1] + Math.sin(t * 0.9) * 0.25,
        position[2] + Math.cos(t * 0.45) * 0.4,
      )
    }
    if (lightRef.current) lightRef.current.intensity = WISP_INTENSITY * (0.8 + Math.sin(t * 2.3) * 0.2)
  })

  return (
    <group ref={groupRef} position={position}>
      <pointLight ref={lightRef} color={color} intensity={WISP_INTENSITY} distance={WISP_RADIUS} decay={LIGHT_DECAY} />
      <Billboard>
        <mesh>
          <planeGeometry args={[0.9, 0.9]} />
          <meshBasicMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.85} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.07, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </Billboard>
    </group>
  )
}

// Stone sarcophagus with its lid shoved a little off true — whatever was
// inside is out walking around the level by now.
export function Coffin({ position, rotationY = 0, color = '#434a55' }: PropProps) {
  const rand = useMemo(() => seededRandom(position), [position])
  const shift = useMemo(() => ({ x: (rand() - 0.5) * 0.2, angle: (rand() - 0.5) * 0.12 }), [rand])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[0.85, 0.44, 2]} />
        <meshStandardMaterial color="#39404a" />
      </mesh>
      {/* hollow: a dark mouth where the lid has slid clear */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.7, 0.05, 1.85]} />
        <meshStandardMaterial color="#0a0c10" />
      </mesh>
      <group position={[shift.x, 0.5, -0.12]} rotation={[0, shift.angle, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.95, 0.16, 2.05]} />
          <meshStandardMaterial color={color} />
        </mesh>
        <mesh position={[0, 0.11, -0.1]}>
          <boxGeometry args={[0.18, 0.06, 1.4]} />
          <meshStandardMaterial color="#586170" />
        </mesh>
        <mesh position={[0, 0.11, 0.4]}>
          <boxGeometry args={[0.55, 0.06, 0.18]} />
          <meshStandardMaterial color="#586170" />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// ด่าน 3 — สนามประลองคอมโบ: fire bowls and beast cages.
// ---------------------------------------------------------------------------

// The arena's light: a standing fire bowl, far brighter than a wall torch, so
// the colosseum reads as an open lit space rather than a corridor.
export function Brazier({ position, color = '#ff9a3c' }: PropProps) {
  const glowTex = useMemo(() => createGlowTexture(hexToRgba(color, 0.9)), [color])
  const lightRef = useRef<THREE.PointLight>(null!)
  const fireRef = useRef<THREE.Mesh>(null!)
  const phase = useMemo(() => seededRandom(position)() * 10, [position])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    const flicker = 1.1 + Math.sin(t * 7) * 0.14 + Math.sin(t * 17) * 0.07
    if (lightRef.current) lightRef.current.intensity = (flicker / 1.1) * BRAZIER_INTENSITY
    if (fireRef.current) fireRef.current.scale.setScalar(0.95 + flicker * 0.2)
  })

  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.42, 0.5, 0.12, 10]} />
        <meshStandardMaterial color="#2f2a22" />
      </mesh>
      <mesh castShadow position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.11, 0.16, 0.78, 8]} />
        <meshStandardMaterial color="#2f2a22" metalness={0.5} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.95, 0]}>
        <cylinderGeometry args={[0.44, 0.22, 0.32, 12]} />
        <meshStandardMaterial color="#3a332a" metalness={0.6} roughness={0.6} />
      </mesh>
      {/* coals sitting in the bowl */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.08, 12]} />
        <meshStandardMaterial color="#7a2410" emissive={color} emissiveIntensity={0.8} />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, 1.35, 0]}
        color={color}
        intensity={BRAZIER_INTENSITY}
        distance={BRAZIER_RADIUS}
        decay={LIGHT_DECAY}
      />
      <Billboard position={[0, 1.35, 0]}>
        <mesh ref={fireRef}>
          <planeGeometry args={[1.3, 1.3]} />
          <meshBasicMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Billboard>
    </group>
  )
}

// Iron cage with something still alive in it, watching the player go past.
export function Cage({ position, rotationY = 0, color = '#ff3b30' }: PropProps) {
  const eyeRef = useRef<THREE.Group>(null!)
  const phase = useMemo(() => seededRandom(position)() * 6, [position])
  const bars = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), [])

  useFrame(({ clock }) => {
    // The occupant shifts its weight now and then — enough motion for the eyes
    // to catch the player's attention, not enough to read as a live monster.
    const t = clock.elapsedTime + phase
    if (eyeRef.current) {
      eyeRef.current.position.x = Math.sin(t * 0.7) * 0.08
      eyeRef.current.position.y = 0.5 + Math.sin(t * 1.3) * 0.03
    }
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.56, 0.6, 0.1, 12]} />
        <meshStandardMaterial color="#2a2622" metalness={0.6} roughness={0.6} />
      </mesh>
      {bars.map((a, i) => (
        <mesh key={i} castShadow position={[Math.cos(a) * 0.5, 0.8, Math.sin(a) * 0.5]}>
          <cylinderGeometry args={[0.035, 0.035, 1.4, 5]} />
          <meshStandardMaterial color="#38332c" metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
      {[0.55, 1.15].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.5, 0.03, 5, 14]} />
          <meshStandardMaterial color="#38332c" metalness={0.7} roughness={0.5} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.52, 0]}>
        <cylinderGeometry args={[0.2, 0.56, 0.24, 12]} />
        <meshStandardMaterial color="#2a2622" metalness={0.6} roughness={0.6} />
      </mesh>
      {/* the occupant: a shape in the dark and two eyes */}
      <group ref={eyeRef} position={[0, 0.5, 0]}>
        <mesh>
          <sphereGeometry args={[0.34, 10, 8]} />
          <meshStandardMaterial color="#14110f" roughness={1} />
        </mesh>
        {[-0.11, 0.11].map((x) => (
          <mesh key={x} position={[x, 0.14, 0.3]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// ด่าน 4 — หอคาถาต้องมนตร์: sigils, crystals and floating grimoires.
// ---------------------------------------------------------------------------

// A sigil turning slowly on the floor (or in mid-air, if the level places it
// above the ground). Drawn with unlit additive material on purpose: it is a
// light in its own right, so it stays readable in a room with nothing else
// burning in it.
export function RuneCircle({ position, color = '#8f6fff' }: PropProps) {
  const spinRef = useRef<THREE.Group>(null!)
  const counterRef = useRef<THREE.Group>(null!)
  const phase = useMemo(() => seededRandom(position)() * Math.PI * 2, [position])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (spinRef.current) spinRef.current.rotation.z = t * 0.25
    if (counterRef.current) counterRef.current.rotation.z = -t * 0.4
  })

  const glyph = (
    <meshBasicMaterial
      color={color}
      transparent
      opacity={0.8}
      side={THREE.DoubleSide}
      depthWrite={false}
      blending={THREE.AdditiveBlending}
    />
  )

  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <group ref={spinRef}>
        <mesh>
          <ringGeometry args={[0.94, 1.02, 48]} />
          {glyph}
        </mesh>
        <mesh>
          <ringGeometry args={[0.78, 0.82, 48]} />
          {glyph}
        </mesh>
      </group>
      <group ref={counterRef}>
        <mesh>
          <ringGeometry args={[0.5, 0.58, 3]} />
          {glyph}
        </mesh>
        <mesh rotation={[0, 0, Math.PI]}>
          <ringGeometry args={[0.5, 0.58, 3]} />
          {glyph}
        </mesh>
        <mesh>
          <ringGeometry args={[0.18, 0.24, 24]} />
          {glyph}
        </mesh>
      </group>
    </group>
  )
}

// A crystal cluster. Its own small light is what lets the tower and the vault
// be lit by something other than fire.
export function Crystal({ position, rotationY = 0, color = '#a88fff' }: PropProps) {
  const lightRef = useRef<THREE.PointLight>(null!)
  const shards = useMemo(() => {
    const rand = seededRandom(position)
    return [
      { x: 0, z: 0, h: 1, tilt: 0, s: 1 },
      { x: 0.22, z: 0.14, h: 0.62, tilt: 0.35, s: 0.7 },
      { x: -0.2, z: -0.12, h: 0.48, tilt: -0.4, s: 0.6 },
    ].map((s) => ({ ...s, spin: rand() * Math.PI }))
  }, [position])
  const phase = useMemo(() => seededRandom(position)() * 8, [position])

  useFrame(({ clock }) => {
    // Slow pulse rather than a flicker: this is a stone that holds power, not
    // something burning.
    const t = clock.elapsedTime + phase
    if (lightRef.current) lightRef.current.intensity = CRYSTAL_INTENSITY * (0.75 + Math.sin(t * 1.1) * 0.25)
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh receiveShadow position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.45, 0.5, 0.08, 8]} />
        <meshStandardMaterial color="#241f38" />
      </mesh>
      {shards.map((s, i) => (
        <mesh key={i} castShadow position={[s.x, 0.05 + s.h * 0.5, s.z]} rotation={[s.tilt, s.spin, s.tilt * 0.6]}>
          <octahedronGeometry args={[0.22 * s.s]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.4}
            transparent
            opacity={0.85}
            roughness={0.15}
            metalness={0.1}
          />
        </mesh>
      ))}
      <pointLight
        ref={lightRef}
        position={[0, 0.7, 0]}
        color={color}
        intensity={CRYSTAL_INTENSITY}
        distance={CRYSTAL_RADIUS}
        decay={LIGHT_DECAY}
      />
    </group>
  )
}

// An open book hanging in the air, turning as it drifts. Used in the tower's
// spell labs and all over the library.
export function FloatingTome({ position, color = '#c7a8ff' }: PropProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const glowTex = useMemo(() => createGlowTexture(hexToRgba(color, 0.7)), [color])
  const phase = useMemo(() => seededRandom(position)() * Math.PI * 2, [position])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (!groupRef.current) return
    groupRef.current.position.y = position[1] + Math.sin(t * 0.8) * 0.12
    groupRef.current.rotation.y = t * 0.3
  })

  return (
    <group ref={groupRef} position={position}>
      {[-1, 1].map((side) => (
        <group key={side} rotation={[0, 0, side * 0.22]}>
          <mesh castShadow position={[side * 0.17, 0, 0]}>
            <boxGeometry args={[0.32, 0.03, 0.42]} />
            <meshStandardMaterial color="#efe4c8" />
          </mesh>
          <mesh position={[side * 0.17, -0.025, 0]}>
            <boxGeometry args={[0.34, 0.025, 0.44]} />
            <meshStandardMaterial color="#5a2f38" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[0.06, 0.04, 0.44]} />
        <meshStandardMaterial color="#4a2530" />
      </mesh>
      <Billboard>
        <mesh>
          <planeGeometry args={[1.1, 1.1]} />
          <meshBasicMaterial
            map={glowTex}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={0.4}
          />
        </mesh>
      </Billboard>
    </group>
  )
}

// ---------------------------------------------------------------------------
// ด่าน 5 — หอสมุดลับ: shelves, reading desks, candlelight.
// ---------------------------------------------------------------------------

// A case of books, taller than the walls, which is what turns the level-1
// corridor footprint into a canyon between shelves. The books on each shelf
// are one block rather than one mesh apiece — a corridor lined with these
// would otherwise cost hundreds of draw calls for detail nobody can resolve
// from the isometric camera.
export function Bookshelf({ position, rotationY = 0 }: PropProps) {
  const shelves = useMemo(() => {
    const rand = seededRandom(position)
    return Array.from({ length: 4 }, (_, i) => ({
      y: 0.32 + i * 0.5,
      hue: Math.floor(rand() * 360),
      light: 18 + rand() * 16,
      fill: 0.72 + rand() * 0.24,
      leaning: rand() < 0.4,
      lean: (rand() - 0.5) * 0.5,
      leanX: (rand() - 0.5) * 0.9,
    }))
  }, [position])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* case: back panel and two sides */}
      <mesh castShadow receiveShadow position={[0, 1.05, -0.19]}>
        <boxGeometry args={[1.5, 2.1, 0.08]} />
        <meshStandardMaterial color="#39281a" />
      </mesh>
      {[-0.71, 0.71].map((x) => (
        <mesh key={x} castShadow position={[x, 1.05, 0]}>
          <boxGeometry args={[0.09, 2.1, 0.42]} />
          <meshStandardMaterial color="#4a3423" />
        </mesh>
      ))}
      <mesh castShadow position={[0, 2.12, 0]}>
        <boxGeometry args={[1.62, 0.1, 0.5]} />
        <meshStandardMaterial color="#523a26" />
      </mesh>
      {shelves.map((s, i) => (
        <group key={i}>
          <mesh castShadow receiveShadow position={[0, s.y - 0.06, 0]}>
            <boxGeometry args={[1.5, 0.07, 0.42]} />
            <meshStandardMaterial color="#523a26" />
          </mesh>
          <mesh castShadow position={[0, s.y + 0.19, -0.02]}>
            <boxGeometry args={[1.36 * s.fill, 0.4, 0.3]} />
            <meshStandardMaterial color={`hsl(${s.hue}, 30%, ${s.light}%)`} roughness={0.9} />
          </mesh>
          {s.leaning && (
            <mesh castShadow position={[s.leanX, s.y + 0.16, 0.02]} rotation={[0, 0, s.lean]}>
              <boxGeometry args={[0.09, 0.36, 0.28]} />
              <meshStandardMaterial color={`hsl(${(s.hue + 140) % 360}, 34%, ${s.light + 10}%)`} roughness={0.9} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

// A scribe's desk with a candle still burning on it. The candle is the
// library's light source — small and warm, so the shelves stay in shadow.
export function ReadingDesk({ position, rotationY = 0, color = '#ffcf8a' }: PropProps) {
  const glowTex = useMemo(() => createGlowTexture(hexToRgba(color, 0.85)), [color])
  const lightRef = useRef<THREE.PointLight>(null!)
  const flameRef = useRef<THREE.Mesh>(null!)
  const phase = useMemo(() => seededRandom(position)() * 9, [position])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    const flicker = 1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 19) * 0.06
    if (lightRef.current) lightRef.current.intensity = flicker * CANDLE_INTENSITY
    if (flameRef.current) flameRef.current.scale.setScalar(0.85 + flicker * 0.2)
  })

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* slanted writing top */}
      <mesh castShadow receiveShadow position={[0, 0.78, 0]} rotation={[-0.28, 0, 0]}>
        <boxGeometry args={[1.1, 0.06, 0.72]} />
        <meshStandardMaterial color="#5a4128" />
      </mesh>
      <mesh castShadow position={[0, 0.62, -0.3]}>
        <boxGeometry args={[1.1, 0.28, 0.1]} />
        <meshStandardMaterial color="#4a3421" />
      </mesh>
      {[[-0.48, -0.28], [0.48, -0.28], [-0.48, 0.28], [0.48, 0.28]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.32, z]}>
          <boxGeometry args={[0.08, 0.64, 0.08]} />
          <meshStandardMaterial color="#3d2b1b" />
        </mesh>
      ))}
      {/* open ledger left on the desk */}
      <mesh position={[-0.15, 0.83, 0.02]} rotation={[-0.28, 0.2, 0]}>
        <boxGeometry args={[0.42, 0.03, 0.3]} />
        <meshStandardMaterial color="#e6dbbd" />
      </mesh>
      {/* candle */}
      <mesh castShadow position={[0.38, 0.92, -0.1]}>
        <cylinderGeometry args={[0.045, 0.055, 0.24, 8]} />
        <meshStandardMaterial color="#e8dfc4" />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0.38, 1.12, -0.1]}
        color={color}
        intensity={CANDLE_INTENSITY}
        distance={CANDLE_RADIUS}
        decay={LIGHT_DECAY}
      />
      <Billboard position={[0.38, 1.09, -0.1]}>
        <mesh ref={flameRef}>
          <planeGeometry args={[0.34, 0.34]} />
          <meshBasicMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </Billboard>
    </group>
  )
}

// ---------------------------------------------------------------------------
// ด่าน 6 — ดันเจี้ยนกับดักมรณะ: dead machinery and torn reality.
// ---------------------------------------------------------------------------

// A spike trap that fired once and jammed. Half its spikes are up, the rest
// are snapped over — the level's whole premise is machinery that no longer
// does what it was built to do.
export function SpikeTrap({ position, rotationY = 0 }: PropProps) {
  const spikes = useMemo(() => {
    const rand = seededRandom(position)
    return Array.from({ length: 7 }, () => ({
      x: (rand() - 0.5) * 0.9,
      z: (rand() - 0.5) * 0.9,
      height: 0.28 + rand() * 0.3,
      broken: rand() < 0.45,
      tilt: (rand() - 0.5) * 2.4,
      spin: rand() * Math.PI,
    }))
  }, [position])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh receiveShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[1.3, 0.05, 1.3]} />
        <meshStandardMaterial color="#22222a" metalness={0.5} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[1.06, 0.02, 1.06]} />
        <meshStandardMaterial color="#15151b" />
      </mesh>
      {spikes.map((s, i) => (
        <mesh
          key={i}
          castShadow
          position={[s.x, s.broken ? 0.08 : 0.05 + s.height / 2, s.z]}
          rotation={s.broken ? [Math.PI / 2 + s.tilt * 0.2, s.spin, 0] : [s.tilt * 0.12, s.spin, s.tilt * 0.12]}
        >
          <coneGeometry args={[0.06, s.height, 6]} />
          <meshStandardMaterial color="#6b6b74" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

// A tear in the level. Unlit additive planes that jitter in width and a light
// that stutters with them, so it reads as something malfunctioning rather
// than something burning.
export function GlitchRift({ position, color = '#ff2e63' }: PropProps) {
  const shardsRef = useRef<THREE.Group>(null!)
  const lightRef = useRef<THREE.PointLight>(null!)
  const phase = useMemo(() => seededRandom(position)() * 20, [position])
  const shards = useMemo(() => {
    const rand = seededRandom(position)
    return Array.from({ length: 4 }, () => ({
      x: (rand() - 0.5) * 0.5,
      y: (rand() - 0.5) * 0.5,
      w: 0.05 + rand() * 0.09,
      h: 0.6 + rand() * 1.1,
      tilt: (rand() - 0.5) * 0.5,
    }))
  }, [position])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    // Two fast sines beating against each other, floored so the rift never
    // fully closes: an unsteady stutter rather than a regular pulse.
    const stutter = Math.max(0.25, Math.abs(Math.sin(t * 13) * 0.6 + Math.sin(t * 31) * 0.5))
    if (shardsRef.current) shardsRef.current.scale.set(stutter, 0.9 + stutter * 0.2, 1)
    if (lightRef.current) lightRef.current.intensity = RIFT_INTENSITY * stutter
  })

  return (
    <group position={position}>
      <pointLight ref={lightRef} color={color} intensity={RIFT_INTENSITY} distance={RIFT_RADIUS} decay={LIGHT_DECAY} />
      <Billboard>
        <group ref={shardsRef}>
          {shards.map((s, i) => (
            <mesh key={i} position={[s.x, s.y, 0]} rotation={[0, 0, s.tilt]}>
              <planeGeometry args={[s.w, s.h]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.9}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
      </Billboard>
    </group>
  )
}

// Chunks of floor that came loose when the dungeon's physics did, turning
// slowly in mid-air.
export function FloatingRubble({ position, color = '#39394a' }: PropProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const rocks = useMemo(() => {
    const rand = seededRandom(position)
    return Array.from({ length: 4 }, () => ({
      x: (rand() - 0.5) * 1.4,
      y: (rand() - 0.5) * 0.9,
      z: (rand() - 0.5) * 1.4,
      size: 0.12 + rand() * 0.22,
      spin: [rand() * Math.PI, rand() * Math.PI, rand() * Math.PI] as [number, number, number],
      bob: 0.4 + rand() * 0.5,
    }))
  }, [position])
  const phase = useMemo(() => seededRandom(position)() * Math.PI * 2, [position])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (!groupRef.current) return
    groupRef.current.rotation.y = t * 0.12
    groupRef.current.children.forEach((child, i) => {
      child.position.y = rocks[i].y + Math.sin(t * rocks[i].bob) * 0.12
      child.rotation.x = rocks[i].spin[0] + t * 0.15
    })
  })

  return (
    <group ref={groupRef} position={position}>
      {rocks.map((r, i) => (
        <mesh key={i} castShadow position={[r.x, r.y, r.z]} rotation={r.spin}>
          <dodecahedronGeometry args={[r.size, 0]} />
          <meshStandardMaterial color={color} flatShading roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}
