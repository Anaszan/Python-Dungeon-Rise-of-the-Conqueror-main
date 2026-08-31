import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Billboard, useAnimations, useGLTF, useTexture } from '@react-three/drei'
import { LoopRepeat, type Group } from 'three'
import { useGameStore } from './store'
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
// at or below local y=2. The older files are flat planes baked from 2D art
// (zero depth); levels 1 and 2 are solid low-poly models built in Blender
// (sources under blender/). Normalizing against that fixed y=2 raw height lets
// either kind drop in next to the plain image sprites at a matching on-screen
// size without per-file tuning — and a deliberately short model (the slimes, at
// y=1.25) reads as short on screen rather than being stretched to fill.
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

  // Level 2's models ship a one-second attack loop (blender/build_monsters_level2.py);
  // level 1's are a single static pose and export no clips at all, so this is a
  // no-op for them. Every clip in the file is played, not just the first — a
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

export function Monster({ data }: { data: MonsterData }) {
  const defeated = useGameStore((s) => s.defeatedIds.has(data.id))
  if (defeated) return null

  const scale = data.name === 'Elder Dragon' ? 1.8 : data.name === 'Dragon' ? 1.5 : 1
  const placeholder = <MonsterShape color={data.color} scale={scale} />

  return (
    <group position={data.position}>
      {data.modelUrl ? (
        <MonsterArtBoundary fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <MonsterModel url={data.modelUrl} scale={scale} />
          </Suspense>
        </MonsterArtBoundary>
      ) : data.imageUrl ? (
        <MonsterArtBoundary fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <MonsterSprite url={data.imageUrl} scale={scale} />
          </Suspense>
        </MonsterArtBoundary>
      ) : (
        placeholder
      )}
    </group>
  )
}
