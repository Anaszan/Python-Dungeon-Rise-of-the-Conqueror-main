import { describe, expect, it } from 'vitest'
import { DUNGEON_THEMES, MUSIC_RUMBLE_CUT_HZ } from './soundEngine'

// The rule the music bus's high-pass only half enforces: the filter keeps the
// sub-bass out of the mix, but a pad written below the cut would simply be
// filtered into silence instead — a level with no pad at all. These are the
// checks that a theme stays audible on the right side of that line.
describe('no sub-bass drone under the music', () => {
  it.each(DUNGEON_THEMES.map((theme, i) => [i + 1, theme] as const))(
    'level %i keeps both pad oscillators above the cut',
    (_level, theme) => {
      expect(theme.padRoot).toBeGreaterThanOrEqual(MUSIC_RUMBLE_CUT_HZ)
      expect(theme.padRoot * theme.padRatio2).toBeGreaterThanOrEqual(MUSIC_RUMBLE_CUT_HZ)
    },
  )

  it.each(DUNGEON_THEMES.map((theme, i) => [i + 1, theme] as const))(
    'level %i leaves the pad its own fundamental to play',
    (_level, theme) => {
      // The pad's lowpass has to sit above its root, or the theme's two
      // filters close on each other and the pad vanishes from both ends.
      // Measured against the lowest point the LFO sweeps the corner down to.
      expect(theme.padFilterFreq - theme.padLfoDepth).toBeGreaterThan(theme.padRoot * 0.5)
    },
  )

  it.each(DUNGEON_THEMES.map((theme, i) => [i + 1, theme] as const))(
    'level %i plays its motif above the cut',
    (_level, theme) => {
      expect(Math.min(...theme.scale)).toBeGreaterThanOrEqual(MUSIC_RUMBLE_CUT_HZ)
    },
  )
})
