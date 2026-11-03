import { describe, expect, it } from 'vitest'
import { composeSlots, emptySlots, slotsOf } from './slots'
import { LESSONS } from './lessons'
import { ALL_TRIAL_SETS, missingCheck, pickSpellTask, stripComments, trialSlots } from './trials'

const template = slotsOf('รวมพลังจากสองแหล่ง', [
  'สร้างตัวแปรอย่างน้อยสองตัว',
  'รวมค่าทั้งสองด้วยเครื่องหมาย +',
  'ส่งผลรวมนั้นเข้า attack(...)',
])

describe('composing hard mode write-in slots', () => {
  it('puts every demand on screen as its own comment, in order', () => {
    const code = composeSlots(template, [])

    expect(code).toContain('# โจทย์จากมอนสเตอร์: รวมพลังจากสองแหล่ง')
    expect(code).toContain('# 1) สร้างตัวแปรอย่างน้อยสองตัว')
    expect(code).toContain('# 2) รวมค่าทั้งสองด้วยเครื่องหมาย +')
    expect(code).toContain('# 3) ส่งผลรวมนั้นเข้า attack(...)')
    expect(code.indexOf('# 1)')).toBeLessThan(code.indexOf('# 2)'))
    expect(code.indexOf('# 2)')).toBeLessThan(code.indexOf('# 3)'))
  })

  it('writes each answer under the demand it answers', () => {
    const code = composeSlots(template, ['base = atk', 'damage = base + 5', 'attack(damage)'])

    expect(code).toBe(
      [
        '# โจทย์จากมอนสเตอร์: รวมพลังจากสองแหล่ง',
        '',
        '# 1) สร้างตัวแปรอย่างน้อยสองตัว',
        'base = atk',
        '',
        '# 2) รวมค่าทั้งสองด้วยเครื่องหมาย +',
        'damage = base + 5',
        '',
        '# 3) ส่งผลรวมนั้นเข้า attack(...)',
        'attack(damage)',
        '',
      ].join('\n'),
    )
  })

  it('keeps the indentation inside a slot and drops only the trailing blank lines', () => {
    // A slot regularly holds the body of a block, so leading spaces are the
    // player's code and have to survive verbatim.
    const code = composeSlots(slotsOf('t', ['a']), ['if monster_hp > 50:\n    damage = atk\n\n\n'])

    expect(code).toContain('if monster_hp > 50:\n    damage = atk\n')
    expect(code).not.toContain('damage = atk\n\n\n')
  })

  it('leaves no stray blank line where a slot is still empty', () => {
    const code = composeSlots(template, ['', 'damage = base + 5', ''])

    expect(code).toContain('# 1) สร้างตัวแปรอย่างน้อยสองตัว\n\n# 2)')
  })

  it('composes a spell written entirely in one slot into working source', () => {
    // Nothing forces an answer into a particular box: what gates the cast is
    // the โจทย์'s checks, not where the lines were typed.
    const code = composeSlots(template, ['base = atk\nbonus = 5\nattack(base + bonus)', '', ''])
    const source = stripComments(code)

    expect(source).toContain('base = atk')
    expect(source).toContain('attack(base + bonus)')
  })

  it('does not count whitespace as something written', () => {
    expect(emptySlots(template, [])).toBe(3)
    expect(emptySlots(template, ['base = atk', '  ', ''])).toBe(2)
    expect(emptySlots(template, ['a', 'b', 'c'])).toBe(0)
  })
})

describe('slots as the hard-mode editor', () => {
  it('gives every trial one slot per demand', () => {
    for (const { chapter, trials } of ALL_TRIAL_SETS) {
      for (const trial of [...trials.attack, ...trials.skill]) {
        const slots = trialSlots(trial)
        expect(slots.labels, `ch${chapter} ${trial.id}`).toEqual(trial.brief)
        expect(slots.labels.length, `ch${chapter} ${trial.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('hands a hard-mode box its slots and no blanks', () => {
    for (const lesson of LESSONS) {
      for (const kind of ['attack', 'skill'] as const) {
        const task = pickSpellTask(lesson, 'hard', kind, 'seed')
        expect(task.blanks, `${lesson.chapter} ${kind}`).toBeNull()
        expect(task.slots?.labels, `${lesson.chapter} ${kind}`).toEqual(task.trial?.brief)
      }
    }
  })

  it('hands an easy-mode box its blanks and no slots', () => {
    for (const lesson of LESSONS) {
      const task = pickSpellTask(lesson, 'easy', 'attack', 'seed')
      expect(task.slots, `${lesson.chapter}`).toBeNull()
      expect(task.blanks, `${lesson.chapter}`).not.toBeNull()
    }
  })

  it('starts every hard-mode box short of the โจทย์', () => {
    // The composed-empty source is comments only, so no check may pass on it
    // — otherwise a trial would mark itself complete before a line is typed.
    for (const { chapter, trials } of ALL_TRIAL_SETS) {
      for (const trial of [...trials.attack, ...trials.skill]) {
        const empty = composeSlots(trialSlots(trial), [])
        expect(stripComments(empty).trim(), `ch${chapter} ${trial.id}`).toBe('')
        expect(missingCheck(trial, empty), `ch${chapter} ${trial.id}`).toBeDefined()
      }
    }
  })
})
