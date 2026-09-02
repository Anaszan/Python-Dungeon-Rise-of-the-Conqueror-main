import { Canvas } from '@react-three/fiber'
import { MonsterArt } from './Monster'
import type { MonsterData } from './monsters'

// The enemy's side of the battle screen. It used to be an <img> of
// monster.imageUrl, which meant the creature the player had just walked up to
// in the dungeon turned into a flat picture the moment the fight started —
// and, for the eight monsters that have no 2D art of their own, into a
// *different monster's* picture (Orc Berserker borrowed the Orc's, all three
// Banshees shared one, and so on).
//
// This renders the same GLB the dungeon does, attack loop and all, so every
// monster shows up as itself. The player's side has worked this way since it
// started rendering CharacterModel (CharacterPortrait) — this is the enemy
// half of that idea.
//
// MonsterArt keeps the fallback chain (model → sprite → colored blob) inside
// the canvas, so a monster whose model fails to load still shows its picture
// rather than blanking out the frame.
export function MonsterPortrait({ monster }: { monster: MonsterData }) {
  return (
    // Deliberately not scaled up for bosses the way the dungeon does it: there
    // the size difference is the point (a Hydra towering over the corridor),
    // here each monster is alone in its own frame, so filling it evenly reads
    // better than a Slime lost in the middle of one.
    <Canvas camera={{ position: [0, 0, 2.4], fov: 34 }} gl={{ alpha: true }} dpr={[1, 1.5]}>
      {/* Warmer and flatter than the dungeon's lighting: this is a portrait,
          so the silhouette matters more than the mood. */}
      <ambientLight intensity={1.3} color="#9a8060" />
      <directionalLight position={[2, 2.5, 3]} intensity={1.7} color="#ffcf8a" />
      <directionalLight position={[-2, 1, 2]} intensity={0.6} color="#cfe0ff" />
      <MonsterArt data={monster} />
    </Canvas>
  )
}
