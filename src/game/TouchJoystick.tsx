import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useGameStore } from './store'
import { isMovementKey } from './useKeyboardMap'

// Read by Player.tsx and merged with the keyboard's forward/backward/left/right
// flags, so both input methods drive the same movement vector.
export const touchMoveState = { x: 0, z: 0 }

const MAX_RADIUS = 42

// Which way the player is steering at the moment.
//
// Walking with the keyboard puts the stick away: it is a thumb control sitting
// on top of the dungeon, and someone on WASD has no use for it there. The next
// touch anywhere on the screen brings it straight back, so a tablet with a
// keyboard attached can keep swapping between the two — which is also why a
// mouse click is not enough to bring it back, only a real touch.
function useKeyboardIsWalking() {
  const [walking, setWalking] = useState(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isMovementKey(e.code)) setWalking(true)
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setWalking(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return walking
}

export function TouchJoystick() {
  const phase = useGameStore((s) => s.phase)
  const paused = useGameStore((s) => s.paused)
  const keyboardIsWalking = useKeyboardIsWalking()
  const baseRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  // The stick only exists while walking around by thumb: a fight (or the pause
  // menu) takes the screen over, the keyboard replaces it outright, and a drag
  // in progress ends either way.
  const hidden = phase !== 'exploring' || paused || keyboardIsWalking

  const reset = useCallback(() => {
    pointerIdRef.current = null
    setKnob({ x: 0, y: 0 })
    touchMoveState.x = 0
    touchMoveState.z = 0
  }, [])

  // The stick can go away mid-drag: combat starts (stepping onto a monster),
  // or a hand reaches over to the keyboard while a thumb is still holding the
  // knob. Either way the base stops rendering ('return null' below) without
  // the pointer ever being lifted over it, so no pointerup/pointercancel
  // arrives to clear the drag — without this reset the last drag vector is
  // still sitting in touchMoveState, and the player walks off on their own the
  // moment the stick's own input is expected to have stopped.
  useEffect(() => {
    if (hidden) reset()
  }, [hidden, reset])

  // Same reason, for the case where the whole game view goes away mid-drag.
  useEffect(() => reset, [reset])

  const updateFromPoint = (clientX: number, clientY: number) => {
    const base = baseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    let dx = clientX - (rect.left + rect.width / 2)
    let dy = clientY - (rect.top + rect.height / 2)
    const dist = Math.hypot(dx, dy)
    if (dist > MAX_RADIUS) {
      dx = (dx / dist) * MAX_RADIUS
      dy = (dy / dist) * MAX_RADIUS
    }
    setKnob({ x: dx, y: dy })
    touchMoveState.x = dx / MAX_RADIUS
    touchMoveState.z = dy / MAX_RADIUS
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    pointerIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return
    updateFromPoint(e.clientX, e.clientY)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return
    reset()
  }

  if (hidden) return null

  return (
    <div
      ref={baseRef}
      className="touch-joystick-base"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="touch-joystick-knob"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  )
}
