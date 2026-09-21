import type { Wall } from './dungeon'
import type { DecorationData, DecorationKind, LevelData } from './levels'

// Which props the player bumps into, and how big a box each one blocks.
//
// Props used to be pure decoration: the player walked straight through a
// coffin or a bookshelf as if it were a hologram. Each solid prop now turns
// into an extra collision box handed to Player.tsx alongside the level's
// walls, so it is stopped (and slides along) exactly the way a wall does —
// same hitsWall()/canStandAt() code, nothing new to keep in sync.
//
// [width along the prop's own x, depth along its own z], read off the meshes
// in DungeonProps.tsx and rounded to the widest part near the floor — what a
// body walking into the thing would actually meet. A tall, thin top (the
// statue's head, the brazier's bowl) does not widen the box: the player's
// legs hit the base first.
//
// null = walked through on purpose:
//   - floor decals the player walks *over*: rune circles, spike traps (a trap
//     you cannot step on is a wall with a texture), scattered bones;
//   - things floating at head height or above: wisps, tomes, rifts, rubble —
//     none of them reach the floor, so a box on the floor under them would be
//     an invisible wall.
export const PROP_FOOTPRINTS: Record<DecorationKind, readonly [number, number] | null> = {
  torch: [0.24, 0.24], // pole r≈0.06, padded so it reads as a post rather than a pixel
  statue: [0.9, 0.9], // plinth 0.9×0.9
  chest: [0.9, 0.62], // body 0.9×0.6 plus the lock plate
  bones: null,
  wisp: null,
  coffin: [0.95, 2.05], // lid 0.95×2.05 overhangs the 0.85×2 box
  brazier: [0.9, 0.9], // base r=0.5 (a hair smaller: it tapers to 0.42)
  cage: [1.12, 1.12], // base r≈0.58, bars at r=0.5
  runeCircle: null,
  crystal: [0.9, 0.9], // base r=0.5, shards cluster inside it
  tome: null,
  bookshelf: [1.62, 0.5], // top board 1.62×0.5
  desk: [1.1, 0.8], // top 1.1 wide; back panel to front edge ≈0.8 deep
  spikeTrap: null,
  rift: null,
  rubble: null,
}

// A prop's box after its rotationY, as the axis-aligned box hitsWall()
// expects. For the quarter turns the levels actually use this just swaps
// width and depth; any other angle gets the bounding box of the turned
// rectangle — a little generous at the corners, never too small.
function propCollider(deco: DecorationData): Wall | null {
  const footprint = PROP_FOOTPRINTS[deco.kind]
  if (!footprint) return null
  const [w, d] = footprint
  const angle = deco.rotationY ?? 0
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  return {
    x: deco.position[0],
    z: deco.position[2],
    width: w * cos + d * sin,
    depth: w * sin + d * cos,
  }
}

export function propColliders(decorations: DecorationData[] = []): Wall[] {
  return decorations.map(propCollider).filter((c): c is Wall => c !== null)
}

// Everything the player can walk into on this level: the walls, then the
// solid props. What Player.tsx moves against and what dungeon.test.ts
// flood-fills — the same list in both, so the test proves no prop seals off a
// doorway or buries a monster the player has to reach.
//
// Ground.tsx still gets level.walls alone: it *draws* walls, and a coffin
// rendered as a wall block would be a very different coffin.
export function levelColliders(level: Pick<LevelData, 'walls' | 'decorations'>): Wall[] {
  return [...level.walls, ...propColliders(level.decorations)]
}
