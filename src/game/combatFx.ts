// Floating combat text — the "-42" that pops off a monster the moment a spell
// lands, and the red number that pops off the player when something hits back.
//
// This is a plain event bus rather than store state on purpose. A hit number
// is write-once and gone in under a second: putting it in the game store
// would make every component subscribed to the store re-render on every tick
// of an animation nobody else cares about. Here, exactly one component
// (FloatingHits) listens, and only it re-renders.

export type HitKind = 'attack' | 'skill' | 'player' | 'note'

export type FloatingHit = {
  id: number
  kind: HitKind
  text: string
  // World position to float up from — a monster's spot on the floor, or the
  // player's.
  position: [number, number, number]
}

type Listener = (hit: FloatingHit) => void

const listeners = new Set<Listener>()
let nextId = 0

export function onFloatingHit(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function spawnFloatingHit(kind: HitKind, text: string, position: [number, number, number]): void {
  const hit: FloatingHit = { id: nextId++, kind, text, position }
  for (const listener of listeners) listener(hit)
}

// How long a number stays on screen. The CSS animation (.floating-hit) is
// written to the same duration — change one and change the other.
export const FLOATING_HIT_MS = 1000
