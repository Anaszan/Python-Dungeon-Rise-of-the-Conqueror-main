import { useEffect } from 'react'
import { useGameStore } from '../game/store'

// Rendered only while the dungeon (app-root) is on screen. Also binds Escape
// as a toggle, since a keyboard shortcut is the expected way to pause on
// desktop and the on-screen button alone would be easy to miss mid-fight.
//
// Escape does double duty now: with a monster targeted, TargetPanel takes the
// key first (in the capture phase) to drop the target, and only an Escape with
// nothing selected reaches this and pauses the game.
export function PauseButton() {
  const paused = useGameStore((s) => s.paused)
  const phase = useGameStore((s) => s.phase)
  const setPaused = useGameStore((s) => s.setPaused)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      if (useGameStore.getState().phase !== 'exploring') return
      setPaused(!useGameStore.getState().paused)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setPaused])

  if (phase !== 'exploring') return null

  return (
    <button type="button" className="pause-btn" onClick={() => setPaused(!paused)} aria-label="หยุดชั่วคราว" title="หยุดชั่วคราว (Esc)">
      ⏸
    </button>
  )
}
