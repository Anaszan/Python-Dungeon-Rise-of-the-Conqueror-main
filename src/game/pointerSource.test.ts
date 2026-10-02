import { describe, expect, it } from 'vitest'
import { startedOnCanvas } from './pointerSource'

describe('where a dungeon click came from', () => {
  it('answers a click on the canvas', () => {
    expect(startedOnCanvas({ nodeName: 'CANVAS' } as unknown as EventTarget)).toBe(true)
  })

  it('ignores a click that landed on the spell console', () => {
    // The regression: r3f listens on the canvas's parent, drei's <Html>
    // renders into that same parent, so clicking into the code editor used to
    // be raycast into the floor behind it and send the player walking away
    // mid-spell.
    expect(startedOnCanvas({ nodeName: 'TEXTAREA' } as unknown as EventTarget)).toBe(false)
    expect(startedOnCanvas({ nodeName: 'BUTTON' } as unknown as EventTarget)).toBe(false)
    expect(startedOnCanvas({ nodeName: 'DIV' } as unknown as EventTarget)).toBe(false)
  })

  it('ignores an event with no target at all', () => {
    expect(startedOnCanvas(null)).toBe(false)
    expect(startedOnCanvas(undefined)).toBe(false)
  })
})
