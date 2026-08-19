import { useEffect, useRef } from 'react'

export type MoveState = {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
}

const KEY_MAP: Record<string, keyof MoveState> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
}

// Whether this key is one of the ones that walks the player. Shared with the
// touch joystick, which puts itself away when the keyboard is doing the
// walking — the two have to agree on which keys those are, or the stick would
// vanish on a key that moves nobody.
export function isMovementKey(code: string) {
  return Object.hasOwn(KEY_MAP, code)
}

export function useKeyboardMap() {
  const state = useRef<MoveState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
  })

  useEffect(() => {
    const setKey = (e: KeyboardEvent, pressed: boolean) => {
      const action = KEY_MAP[e.code]
      if (action) state.current[action] = pressed
    }
    const onDown = (e: KeyboardEvent) => setKey(e, true)
    const onUp = (e: KeyboardEvent) => setKey(e, false)

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  return state
}
