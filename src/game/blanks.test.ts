import { describe, expect, it } from 'vitest'
import { BLANK, fillBlanks, parseBlanks, unfilledBlanks } from './blanks'
import { LESSONS } from './lessons'
import { pickSpellTask } from './trials'

describe('splitting a skeleton into blanks', () => {
  it('keeps the code around a blank as literal text', () => {
    const template = parseBlanks('damage = ___  # TODO\nattack(damage)\n')

    expect(template.count).toBe(1)
    expect(template.segments).toEqual(['damage = ', '  # TODO\nattack(damage)\n'])
  })

  it('puts the answer back exactly where the blank was', () => {
    const template = parseBlanks('if monster_hp ___ 50:')

    expect(fillBlanks(template, ['>'])).toBe('if monster_hp > 50:')
  })

  it('leaves the blank marker in place until it is answered', () => {
    // An untouched skeleton has to compose back to itself, so nothing
    // downstream can mistake it for finished code.
    const code = 'power = ___\nskill(power)\n'
    const template = parseBlanks(code)

    expect(fillBlanks(template, [''])).toBe(code)
    expect(fillBlanks(template, ['   '])).toBe(code)
  })

  it('does not count whitespace as an answer', () => {
    const template = parseBlanks('a = ___ + ___')

    expect(unfilledBlanks(template, ['', ''])).toBe(2)
    expect(unfilledBlanks(template, ['atk', ' '])).toBe(1)
    expect(unfilledBlanks(template, ['atk', '5'])).toBe(0)
  })

  it('handles a blank at the very start of a line', () => {
    // Chapter 7's skeleton opens a line with the blank (`___:  # เติม finally`),
    // so the segment before it is empty rather than missing.
    const template = parseBlanks('___:  # TODO\n    print("done")\n')

    expect(template.segments[0]).toBe('')
    expect(fillBlanks(template, ['finally'])).toBe('finally:  # TODO\n    print("done")\n')
  })
})

describe('every easy-mode exercise is fillable', () => {
  const cases = LESSONS.flatMap((lesson) =>
    (['attack', 'skill'] as const).map((kind) => [lesson.chapter, kind, lesson] as const),
  )

  it.each(cases)('chapter %i %s box has something to fill in', (_chapter, kind, lesson) => {
    // Easy mode renders the skeleton read-only with an input per blank. A
    // skeleton with no blank would therefore be a wall of code the player
    // can neither edit nor answer — nothing to do but stare at it.
    const task = pickSpellTask(lesson, 'easy', kind, 'seed')

    expect(task.blanks).not.toBeNull()
    expect(task.blanks!.count).toBeGreaterThan(0)
  })

  it.each(cases)('chapter %i %s box runs clean once every blank is answered', (_chapter, kind, lesson) => {
    const task = pickSpellTask(lesson, 'easy', kind, 'seed')
    const answers = Array<string>(task.blanks!.count).fill('1')

    expect(fillBlanks(task.blanks!, answers)).not.toContain(BLANK)
  })

  it.each(cases)('chapter %i %s skeleton variants all have blanks', (_chapter, kind, lesson) => {
    // pickSpellTask only ever returns one variant per seed, so the others
    // are checked directly — a variant without a blank would only surface
    // for whichever monster happened to hash onto it.
    const skeletons = kind === 'attack' ? lesson.attackSkeletons : lesson.skillSkeletons

    for (const skeleton of skeletons) {
      expect(parseBlanks(skeleton).count, skeleton).toBeGreaterThan(0)
    }
  })
})

describe('the write-it-yourself boxes keep their empty editor', () => {
  it.each(LESSONS.map((lesson) => [lesson.chapter, lesson] as const))(
    'chapter %i hard mode has no blanks to fill',
    (_chapter, lesson) => {
      // Hard mode's whole point is an empty editor and a written โจทย์, so it
      // must never be routed into the fill-in-the-blank editor.
      for (const kind of ['attack', 'skill'] as const) {
        expect(pickSpellTask(lesson, 'hard', kind, 'seed').blanks).toBeNull()
      }
    },
  )

  it.each(LESSONS.map((lesson) => [lesson.chapter, lesson] as const))(
    'chapter %i boss has no blanks to fill, in either difficulty',
    (_chapter, lesson) => {
      for (const difficulty of ['easy', 'hard'] as const) {
        for (const kind of ['attack', 'skill'] as const) {
          expect(pickSpellTask(lesson, difficulty, kind, 'seed', true).blanks).toBeNull()
        }
      }
    },
  )
})
