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

// Is this keystroke going into a text field?
//
// It matters now in a way it never did before: the code boxes live *in* the
// dungeon (TargetPanel), so the player types Python while standing in a room
// full of monsters. Without this, writing `while` would walk them into a wall
// — w, a and s are all movement keys — and Tab would re-target instead of
// indenting. Every global key listener in the game goes through this first.
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || target.isContentEditable
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
    const onDown = (e: KeyboardEvent) => {
      // A keypress meant for a code box never moves the player. Only keydown
      // is filtered: a key held down *before* focus moved into the textarea
      // still has to be released, or the player would walk forever.
      if (isTypingTarget(e.target)) return
      setKey(e, true)
    }
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
