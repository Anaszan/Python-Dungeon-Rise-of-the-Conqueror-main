import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Billboard, Html, useAnimations, useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, LoopRepeat, type Group, type Mesh } from 'three'
import { useGameStore } from './store'
import { playerPosition } from './playerPosition'
import { startedOnCanvas } from './pointerSource'
import { distanceToPlayer } from './combat'
import type { MonsterData } from './monsters'

function MonsterShape({ color, scale }: { color: string; scale: number }) {
  return (
    <mesh castShadow scale={scale}>
      <icosahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}

function MonsterSprite({ url, scale }: { url: string; scale: number }) {
  const texture = useTexture(url)
  return (
    <Billboard>
      <mesh scale={scale}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshStandardMaterial map={texture} transparent alphaTest={0.3} />
      </mesh>
    </Billboard>
  )
}

// Every GLB monster here is X-centered with its base at local y=0 and its top
// at or below local y=2. All six levels are solid low-poly models built in
// Blender now (sources under blender/); a handful of unreferenced files left in
// public/monsters are still the old flat planes baked from 2D art (zero depth),
// and would drop in the same way if anything pointed at them again.
// Normalizing against that fixed y=2 raw height lets either kind sit next to
// the plain image sprites at a matching on-screen size without per-file tuning
// — and a deliberately short model (the slimes, at y=1.25) reads as short on
// screen rather than being stretched to fill.
//
// The solid models still render inside the <Billboard> below. Under the fixed
// isometric camera that costs nothing: it just keeps their front turned to the
// player, which is where a monster should be looking anyway.
const MODEL_RAW_HEIGHT = 2
const MODEL_SCALE = 1.4 / MODEL_RAW_HEIGHT

function MonsterModel({ url, scale }: { url: string; scale: number }) {
  const { scene, animations } = useGLTF(url)
  // useGLTF caches and reuses the same Object3D across every instance that
  // loads this url — without cloning, two monsters sharing a model would
  // fight over one transform instead of rendering independently.
  const instance = useMemo(() => scene.clone(true), [scene])
  // The mixer binds its clips by node name inside this group, so it has to sit
  // between the billboard and the cloned rig rather than wrap the whole thing.
  const rig = useRef<Group>(null)
  const { actions, names } = useAnimations(animations, rig)

  // Every level ships a one-second attack loop now (blender/build_monsters.py
  // for level 1, build_monsters_level<n>.py for the rest), so nothing reaching
  // this point is a still pose any more — though a clipless GLB would simply
  // render at rest. Every clip in the file is played, not just the first — a
  // model exported with its animation split per object arrives as one clip per
  // rig part, and they have to run together to add up to a single motion.
  // The shared random offset keeps those parts in step with each other while
  // still starting each *monster* somewhere different in the loop: without it a
  // room full of orcs swings in perfect unison, which reads as one animated prop
  // repeated rather than a pack of them.
  useEffect(() => {
    const clips = names.map((name) => actions[name]).filter((a) => a != null)
    if (!clips.length) return
    const offset = Math.random()
    for (const action of clips) {
      action.reset().setLoop(LoopRepeat, Infinity)
      action.time = offset * action.getClip().duration
      action.play()
    }
    return () => {
      for (const action of clips) action.stop()
    }
  }, [actions, names])

  return (
    <Billboard>
      <group scale={MODEL_SCALE * scale}>
        <group ref={rig} position={[0, -MODEL_RAW_HEIGHT / 2, 0]}>
          <primitive object={instance} />
        </group>
      </group>
    </Billboard>
  )
}

// A bad or unloadable sprite/model asset throws outside of Suspense's
// loading path, and react-three-fiber mounts each <Canvas> as its own React
// root — so an uncaught error here would silently wipe out the *entire* 3D
// scene (every monster, the player, the ground) rather than just this one
// asset. Falling back to the placeholder shape keeps one broken asset from
// taking the whole dungeon down with it.
class MonsterArtBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// The three end-of-level bosses stand taller than the cast they close out.
// Not exported: a non-component export here would cost this file its fast
// refresh, and nothing outside the dungeon draws a monster any more.
function monsterScale(name: string): number {
  if (name === 'Bone Tyrant') return 1.8
  if (name === 'Hydra') return 1.6
  if (name === 'Dragon') return 1.5
  return 1
}

// One monster's art as three.js objects, with its own fallback chain: the GLB
// model when it has one, the flat sprite when it doesn't (or when the model
// fails to load), and a colored blob when neither works.
//
// Every boundary/Suspense pair has to live on this side of the <Canvas>: an
// asset failure throws inside the canvas's own React root, so a boundary
// mounted around <Canvas> in ordinary DOM would never see it.
export function MonsterArt({ data, scale = 1 }: { data: MonsterData; scale?: number }) {
  const placeholder = <MonsterShape color={data.color} scale={scale} />
  const sprite = data.imageUrl ? (
    <MonsterArtBoundary fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <MonsterSprite url={data.imageUrl} scale={scale} />
      </Suspense>
    </MonsterArtBoundary>
  ) : (
    placeholder
  )

  if (!data.modelUrl) return sprite

  return (
    <MonsterArtBoundary fallback={sprite}>
      <Suspense fallback={placeholder}>
        <MonsterModel url={data.modelUrl} scale={scale} />
      </Suspense>
    </MonsterArtBoundary>
  )
}

// How close the player has to be for a monster's nameplate to appear. Set
// against the lantern (LANTERN_RADIUS = 11): a monster whose name is floating
// in the dark is one the player cannot see yet, so this stays just inside the
// edge of the light.
const NAMEPLATE_RANGE = 9

// How long a monster reels after being hit, in seconds.
const HURT_TIME = 0.22

// A monster standing in the dungeon: its art, its click target, its
// nameplate, and the ring that marks it as the locked target.
//
// This is the whole fight now. There is no battle screen to open — the player
// clicks the thing they want to hit, the code boxes appear beside it (see
// TargetPanel), and everything happens right here in the corridor.
export function Monster({ data }: { data: MonsterData }) {
  const defeated = useGameStore((s) => s.defeatedIds.has(data.id))
  const targeted = useGameStore((s) => s.targetId === data.id)
  const hp = useGameStore((s) => s.monsterHp[data.id])
  const swing = useGameStore((s) => s.monsterSwing[data.id])
  const setTarget = useGameStore((s) => s.setTarget)

  const scale = monsterScale(data.name)
  const art = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  // Seconds left of the current hurt reaction. A ref, not state: it changes
  // every frame and only the transform cares.
  const hurt = useRef(0)
  const lastHp = useRef(hp)

  const [near, setNear] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Hovering a monster is the game's own "this is clickable" affordance —
  // there is no cursor inside a WebGL canvas unless someone sets one.
  useEffect(() => {
    if (!hovered) return
    document.body.style.cursor = 'crosshair'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered])

  // Kick off the recoil whenever this monster's HP actually drops. Reading it
  // from the store rather than from the spell that dealt the damage means a
  // hit lands visibly no matter which of the two code boxes threw it.
  useEffect(() => {
    if (lastHp.current != null && hp != null && hp < lastHp.current) hurt.current = HURT_TIME
    lastHp.current = hp
  }, [hp])

  useFrame((_, delta) => {
    // Nameplates are drawn for the handful of monsters the player can
    // actually see. Flipping React state on a boolean (rather than storing
    // the distance) keeps this to one re-render per monster per approach.
    const inSight = distanceToPlayer(data, playerPosition.x, playerPosition.z) <= NAMEPLATE_RANGE
    if (inSight !== near) setNear(inSight)

    if (ring.current) ring.current.rotation.z += delta * 0.9

    if (art.current) {
      if (hurt.current > 0) {
        hurt.current = Math.max(0, hurt.current - delta)
        // A quick shove away from the player, decaying back to rest — the
        // in-world equivalent of the old battle screen's recoil animation.
        const push = (hurt.current / HURT_TIME) * 0.22
        art.current.position.x = push
        art.current.position.y = push * 0.5
      } else if (art.current.position.x !== 0) {
        art.current.position.set(0, 0, 0)
      }
    }
  })

  if (defeated) return null

  const maxHp = data.maxHp
  const currentHp = hp ?? maxHp
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
  const wounded = currentHp < maxHp
  const engaged = swing != null
  const showPlate = near || targeted

  return (
    <group position={data.position}>
      <group ref={art}>
        <MonsterArt data={data} scale={scale} />
      </group>

      {/* The click target. A box rather than the model itself: a GLB's own
          meshes are whatever shape the artist made, and a slime's are small
          enough to be genuinely hard to hit. Transparent instead of
          `visible={false}` because three skips invisible objects when
          raycasting — an invisible box would not be clickable at all. */}
      <mesh
        position={[0, 0.1 * scale, 0]}
        onPointerDown={(e) => {
          e.stopPropagation()
          // A click inside the spell console is raycast into the scene too
          // (see startedOnCanvas) — without this, typing in the code box
          // could re-target whatever monster happened to be drawn behind the
          // panel and throw away the spell being written.
          if (!startedOnCanvas(e.nativeEvent.target)) return
          setTarget(data.id)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1.3 * scale, 1.7 * scale, 1.3 * scale]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Target ring on the floor, the way an RO client marks what you have
          selected. Hovering shows a dimmer version of the same ring, so it is
          obvious what a click would grab before it is grabbed. */}
      {(targeted || hovered) && (
        <mesh ref={ring} position={[0, -0.68 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.52 * scale, 0.72 * scale, 40, 1, 0, Math.PI * 1.6]} />
          <meshBasicMaterial
            color={targeted ? '#f0c85a' : '#cbb98f'}
            transparent
            opacity={targeted ? 0.95 : 0.4}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {showPlate && (
        <Html
          position={[0, 0.95 * scale, 0]}
          center
          zIndexRange={[8, 4]}
          // The nameplate is a label, not a panel: it must never intercept the
          // click meant for the monster underneath it. drei's own
          // `pointerEvents` prop is a no-op outside transform mode, so the
          // wrapper class carries it — pointer-events is inherited, so one
          // rule on the wrapper covers everything drawn inside it.
          wrapperClass="nameplate-wrapper"
        >
          <div className={`nameplate${targeted ? ' nameplate-target' : ''}${engaged ? ' nameplate-engaged' : ''}`}>
            <span className="nameplate-name">{data.name}</span>
            {(targeted || engaged || wounded) && (
              <>
                <span className="nameplate-hp-track">
                  <span className="nameplate-hp-fill" style={{ width: `${hpPct}%` }} />
                </span>
                <span className="nameplate-hp-text">
                  {currentHp} / {maxHp}
                </span>
              </>
            )}
            {engaged && (
              <span className="nameplate-swing-track">
                <span
                  className="nameplate-swing-fill"
                  style={{ width: `${Math.max(0, Math.min(100, (1 - swing / data.attackInterval) * 100))}%` }}
                />
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}
