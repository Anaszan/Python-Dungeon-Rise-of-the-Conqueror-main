import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DUNGEON_THEMES, MUSIC_RUMBLE_CUT_HZ } from './soundEngine'

describe('background music', () => {
  it.each(DUNGEON_THEMES.map((theme, i) => [i + 1, theme] as const))(
    'level %i plays its motif above the rumble cut',
    (_level, theme) => {
      // Below the cut the high-pass on the music bus would thin the lowest
      // notes of the motif out of the melody rather than remove anything
      // anybody wanted gone.
      expect(Math.min(...theme.scale)).toBeGreaterThanOrEqual(MUSIC_RUMBLE_CUT_HZ)
    },
  )

  it.each(DUNGEON_THEMES.map((theme, i) => [i + 1, theme] as const))(
    'level %i lets every note stop before it is struck again',
    (_level, theme) => {
      // Not a sustain rule in itself, but the thing that keeps the music from
      // turning back into a drone by accident: if the decay is much longer
      // than the step, notes stack on top of each other until the gaps
      // between them disappear. Two notes deep is a tail; eight is a pad.
      expect(theme.pluckDecay / theme.stepSeconds).toBeLessThan(3)
    },
  )

  it('holds no voice open behind the music', () => {
    // Every oscillator the music starts has to be a note with an end: one
    // that is stopped at a time computed from when it began. A drone is an
    // oscillator started with no stop, and that is exactly what used to run
    // behind every screen in the game — a held pad per dungeon theme and
    // another under the menu, which is the long "ooooo" this removed.
    //
    // Asserted against the source because the thing being forbidden is a
    // shape of code, and the Web Audio API it would call does not exist in
    // this test environment to spy on.
    const source = readFileSync(new URL('./soundEngine.ts', import.meta.url), 'utf8')
    const starts = source.match(/\.start\(/g) ?? []
    const stops = source.match(/\.stop\(/g) ?? []

    expect(starts.length).toBeGreaterThan(0)
    expect(stops.length, 'an oscillator is started that is never stopped').toBe(starts.length)
  })
})
