import { useEffect, useState } from 'react'
import { Html } from '@react-three/drei'
import { FLOATING_HIT_MS, onFloatingHit, type FloatingHit } from './combatFx'

// Never draw more than this many numbers at once. A loop lesson can call
// attack() up to MAX_SPELL_CALLS times in a single cast (see pyodideRuntime),
// and 200 simultaneously animating DOM nodes is a stutter, not a spectacle.
const MAX_ON_SCREEN = 10

// The damage numbers that pop off whatever just got hit. Mounted once inside
// the dungeon canvas; every hit anywhere in the level ends up here through the
// combatFx bus.
export function FloatingHits() {
  const [hits, setHits] = useState<FloatingHit[]>([])

  useEffect(() => {
    // Each number clears itself after its animation. The timers are collected
    // so a level change (which unmounts this) doesn't leave callbacks pointed
    // at a component that is gone.
    const timeouts = new Set<ReturnType<typeof setTimeout>>()

    const unsubscribe = onFloatingHit((hit) => {
      setHits((current) => [...current, hit].slice(-MAX_ON_SCREEN))
      const timeout = setTimeout(() => {
        timeouts.delete(timeout)
        setHits((current) => current.filter((h) => h.id !== hit.id))
      }, FLOATING_HIT_MS)
      timeouts.add(timeout)
    })

    return () => {
      unsubscribe()
      for (const timeout of timeouts) clearTimeout(timeout)
    }
  }, [])

  return (
    <>
      {hits.map((hit) => (
        <Html
          key={hit.id}
          position={hit.position}
          center
          // Numbers are decoration and must never eat a click meant for the
          // monster standing behind them. drei's `pointerEvents` prop only
          // applies in transform mode, so this goes on the wrapper as a class
          // instead — pointer-events is inherited, so the span picks it up.
          wrapperClass="nameplate-wrapper"
          zIndexRange={[28, 22]}
        >
          <span className={`floating-hit floating-hit-${hit.kind}`}>{hit.text}</span>
        </Html>
      ))}
    </>
  )
}
