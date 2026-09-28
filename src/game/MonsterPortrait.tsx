import { Canvas } from '@react-three/fiber'
import { MonsterArt } from './Monster'
import type { MonsterData } from './monsters'

// One monster on its own, drawn as the model it actually is — the same GLB the
// dungeon renders, attack loop and all, in a small canvas of its own.
//
// Used by the boss entrance (BossIntro): a flat PNG of the thing the player
// just unsealed is a poster, and a poster is not what walks into the room.
// MonsterArt keeps its whole fallback chain inside the canvas (model → sprite
// → colored blob), so a model that fails to load still shows *something*
// rather than blanking out the middle of the cutscene.
export function MonsterPortrait({ monster }: { monster: MonsterData }) {
  return (
    <Canvas camera={{ position: [0, 0, 2.3], fov: 34 }} gl={{ alpha: true }} dpr={[1, 1.5]}>
      {/* Lit for a portrait rather than for a dungeon: a warm key from the
          front so the silhouette reads, and a red rim from behind that is
          doing the same job as the red wash behind the boss's name. */}
      <ambientLight intensity={1.25} color="#9a8060" />
      <directionalLight position={[2, 2.5, 3]} intensity={1.8} color="#ffcf8a" />
      <directionalLight position={[-2.5, 1.5, -2]} intensity={1.1} color="#e8483f" />
      <MonsterArt data={monster} />
    </Canvas>
  )
}
