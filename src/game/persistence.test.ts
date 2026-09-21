import { describe, expect, it, vi } from 'vitest'

// Only the pure parsing is under test; the real client needs env vars.
vi.mock('../lib/supabase', () => ({ supabase: {} }))

const { parseSavedPosition } = await import('./persistence')

describe('parseSavedPosition', () => {
  it('reads a well-formed spot', () => {
    expect(parseSavedPosition({ level: 3, x: -4.25, z: -18 })).toEqual({ level: 3, x: -4.25, z: -18 })
  })

  it('treats anything malformed as "no saved spot" rather than trusting it', () => {
    // last_position is jsonb written by whatever client last saved. A bad
    // value must fall back to the entrance, never put the player somewhere
    // undefined.
    for (const bad of [
      null,
      undefined,
      'level 3',
      42,
      {},
      { level: 3, x: 1 },
      { level: '3', x: 1, z: 2 },
      { level: 2.5, x: 1, z: 2 },
      { level: 3, x: Number.NaN, z: 2 },
      { level: 3, x: 1, z: Number.POSITIVE_INFINITY },
    ]) {
      expect(parseSavedPosition(bad), JSON.stringify(bad)).toBeNull()
    }
  })
})
