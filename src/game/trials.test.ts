import { describe, expect, it } from 'vitest'
import { LESSONS } from './lessons'
import {
  ALL_TRIAL_SETS,
  missingCheck,
  pickSpellTask,
  stripComments,
  trialStarterCode,
  trialsForLesson,
  type TrialSpec,
} from './trials'

// Hard mode's โจทย์ are content, and content can be wrong in ways nothing else
// notices: a chapter with no trials silently drops the player back to the easy
// skeleton, and a mistyped check turns into a spell that can never be cast.
// These tests are what stops either shipping.

// One reference answer per trial, kept here rather than in trials.ts so the
// solutions never reach the player's bundle. Every check of a trial must
// accept its answer — that is what proves the โจทย์ is actually solvable.
const SOLUTIONS: Record<string, string> = {
  'ch2-atk-report': `damage = atk
print(damage)
attack(damage)
`,
  'ch2-atk-combine': `base = atk
bonus = 5
damage = base + bonus
attack(damage)
`,
  'ch2-skill-multiply': `power = atk * 3
print(power)
skill(power)
`,
  'ch2-skill-name': `power = atk * 3
print("สาปใส่", monster_name)
skill(power)
`,
  'ch3-atk-readhp': `if monster_hp > 50:
    damage = atk
else:
    damage = atk // 2

attack(damage)
`,
  'ch3-atk-selfcheck': `if hp > 50 and monster_hp > 30:
    damage = atk
else:
    damage = atk // 2

attack(damage)
`,
  'ch3-skill-finisher': `if monster_hp <= atk * 3:
    power = atk * 3
else:
    power = atk * 2

skill(power)
`,
  'ch3-skill-armor': `if monster_armor > 10:
    power = atk * 3
else:
    power = atk * 2

skill(power)
`,
  'ch4-atk-combo': `for i in range(4):
    print(i)
    attack(atk)
`,
  'ch4-atk-drain': `remaining = atk * 3
while remaining > 0:
    attack(atk)
    remaining = remaining - atk
`,
  'ch4-skill-split': `for i in range(3):
    skill(atk * 3 // 3)
`,
  'ch4-skill-countfromhp': `rounds = monster_hp // (atk * 3) + 1
for i in range(rounds):
    skill(atk * 3)
`,
  'ch5-atk-named': `def fireball(power):
    return power * 2

attack(fireball(atk))
`,
  'ch5-atk-default': `def blast(power, bonus=5):
    return power + bonus

attack(blast(atk))
`,
  'ch5-skill-reads-monster': `def judge(enemy_hp):
    return enemy_hp

skill(judge(monster_hp))
`,
  'ch5-skill-two-functions': `def base(p):
    return p * 2

def big(p):
    return base(p) + 10

skill(big(atk))
`,
  'ch6-atk-roundtrip': `with open("spellbook.txt", "w") as f:
    f.write(str(atk))

with open("spellbook.txt", "r") as f:
    damage = int(f.read())

attack(damage)
`,
  'ch6-atk-append': `with open("book.txt", "w") as f:
    f.write(str(atk) + ",")

with open("book.txt", "a") as f:
    f.write(str(atk))

with open("book.txt", "r") as f:
    parts = f.read().split(",")

attack(int(parts[0]) + int(parts[1]))
`,
  'ch6-skill-grimoire': `with open("grimoire.txt", "w") as f:
    f.write(str(atk))

with open("grimoire.txt", "r") as f:
    power = int(f.read()) * 3

skill(power)
`,
  'ch6-skill-log': `with open("log.txt", "w") as f:
    f.write(monster_name)

with open("log.txt", "r") as f:
    print(f.read())

power = atk * 3
skill(power)
`,
  'ch7-atk-zerodiv': `try:
    damage = atk // monster_armor
except ZeroDivisionError:
    damage = atk

attack(damage)
`,
  'ch7-atk-finally': `try:
    damage = atk // monster_armor
except ZeroDivisionError:
    damage = atk
finally:
    print("คาถาจบแล้ว")

attack(damage)
`,
  'ch7-skill-shield': `try:
    power = atk // monster_armor
except ZeroDivisionError:
    power = atk * 3

skill(power)
`,
  'ch7-skill-report': `try:
    power = atk // monster_armor
except ZeroDivisionError:
    print("เกราะถูกสาปเป็นศูนย์!")
    power = atk * 3

skill(power)
`,
}

function everyTrial(): { chapter: number; kind: 'attack' | 'skill'; trial: TrialSpec }[] {
  return ALL_TRIAL_SETS.flatMap(({ chapter, trials }) => [
    ...trials.attack.map((trial) => ({ chapter, kind: 'attack' as const, trial })),
    ...trials.skill.map((trial) => ({ chapter, kind: 'skill' as const, trial })),
  ])
}

describe('hard mode trials', () => {
  it('gives every chapter a โจทย์ for both code boxes', () => {
    // pickSpellTask falls back to the easy skeleton when a chapter has none,
    // which would quietly turn hard mode back into easy mode for that level.
    for (const lesson of LESSONS) {
      const set = trialsForLesson(lesson)
      expect(set, `chapter ${lesson.chapter}`).toBeDefined()
      expect(set!.attack.length, `chapter ${lesson.chapter} attack`).toBeGreaterThan(0)
      expect(set!.skill.length, `chapter ${lesson.chapter} skill`).toBeGreaterThan(0)
    }
  })

  it('hands a real trial to every level in hard mode', () => {
    for (const lesson of LESSONS) {
      for (const kind of ['attack', 'skill'] as const) {
        const task = pickSpellTask(lesson, 'hard', kind, `monster:${kind}`)
        expect(task.trial, `chapter ${lesson.chapter} ${kind}`).not.toBeNull()
      }
      // ...and leaves easy mode exactly as it was: a skeleton, no trial.
      expect(pickSpellTask(lesson, 'easy', 'attack', 'seed').trial).toBeNull()
      expect(lesson.attackSkeletons).toContain(pickSpellTask(lesson, 'easy', 'attack', 'seed').code)
    }
  })

  it('keeps trial ids unique and gives each one a brief and hints', () => {
    const ids = everyTrial().map(({ trial }) => trial.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const { trial } of everyTrial()) {
      expect(trial.brief.length, trial.id).toBeGreaterThan(1)
      expect(trial.checks.length, trial.id).toBeGreaterThan(1)
      expect(trial.hints.length, trial.id).toBeGreaterThan(0)
    }
  })

  it('never uses a global regex in a check', () => {
    // A global RegExp carries lastIndex between .test() calls, so the same
    // check would flip between pass and fail as TrialBrief re-renders on
    // every keystroke — and could block a cast that was actually correct.
    for (const { trial } of everyTrial()) {
      for (const check of trial.checks) {
        expect(check.pattern.global, `${trial.id}: ${check.label}`).toBe(false)
      }
    }
  })

  it('does not accept its own starter comments as an answer', () => {
    // The starter code spells the โจทย์ out in comments — "print()",
    // "attack(...)" and friends included. Without stripComments() the
    // checklist would be fully ticked before a line was written.
    for (const { trial } of everyTrial()) {
      expect(missingCheck(trial, trialStarterCode(trial)), trial.id).toBeDefined()
    }
  })

  it('accepts a correct answer for every โจทย์', () => {
    for (const { trial } of everyTrial()) {
      const solution = SOLUTIONS[trial.id]
      expect(solution, `no reference answer written for ${trial.id}`).toBeDefined()
      expect(missingCheck(trial, solution)?.label, trial.id).toBeUndefined()
    }
  })

  it('has no reference answers left over for trials that no longer exist', () => {
    const ids = new Set(everyTrial().map(({ trial }) => trial.id))
    for (const id of Object.keys(SOLUTIONS)) expect(ids.has(id), `stale answer: ${id}`).toBe(true)
  })

  it('strips comments before checking, including trailing ones', () => {
    expect(stripComments('attack(atk)  # print()')).toBe('attack(atk)  ')
    expect(stripComments('# attack(atk)\ndamage = atk')).toBe('\ndamage = atk')
  })
})
