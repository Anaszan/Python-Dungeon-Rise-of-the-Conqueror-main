import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { castSpell, getPyodide } from './pyodideRuntime'
import type { LessonData } from './lessons'
import { missingCheck, pickSpellTask, type SpellTask } from './trials'
import { TrialBrief } from './TrialBrief'
import type { Difficulty } from './difficulty'

type SpellConsoleProps = {
  lesson: LessonData
  difficulty: Difficulty
  monsterId: string
  monsterHp: number
  monsterName: string
  monsterArmor: number
  playerHp: number
  playerAtk: number
  skillCooldown: number
  attackCooldown: number
  onAttack: (amount: number) => void
  onSkillDamage: (amount: number) => void
  // Fired once after any run (from either box) that actually called
  // attack(...) / skill(...), so the caller can start the matching cooldown.
  onAttackCast: () => void
  onSkillCast: () => void
}

function insertTab(code: string, el: HTMLTextAreaElement): { next: string; caret: number } {
  const start = el.selectionStart
  const end = el.selectionEnd
  return { next: code.slice(0, start) + '    ' + code.slice(end), caret: start + 4 }
}

export type BoxState = {
  code: string
  casting: boolean
  log: string[]
  error: string | null
}

// Not exported: this file is a component module, and a non-component export
// costs the whole file its fast-refresh. PracticeConsole keeps its own copy.
function freshBox(code: string): BoxState {
  return { code, casting: false, log: [], error: null }
}

// The Python code sandbox that replaced the old placeholder Attack/skill
// buttons — see README "Python combat sandbox". Both the regular attack and
// the special skill are written as real Python here, each in its own box so
// they read as two separate spells rather than one shared script. Both
// boxes share the same battle-state globals and the same attack()/skill()
// bindings — whichever function the code calls is the effect that happens,
// regardless of which box it was typed in.
//
// What each box *starts* holding depends on the difficulty the player chose
// before the first level (see difficulty.ts): easy hands over the chapter's
// fill-in-the-blank skeleton, hard hands over the monster's โจทย์ and an empty
// editor, and refuses to cast until the code satisfies it.
export function SpellConsole({
  lesson,
  difficulty,
  monsterId,
  monsterHp,
  monsterName,
  monsterArmor,
  playerHp,
  playerAtk,
  skillCooldown,
  attackCooldown,
  onAttack,
  onSkillDamage,
  onAttackCast,
  onSkillCast,
}: SpellConsoleProps) {
  const [warming, setWarming] = useState(true)

  // The seed includes monsterId so level 1's 9 monsters naturally cycle
  // through the variants (easy: "fill a number" vs "fill a variable"; hard:
  // one โจทย์ per monster) instead of always showing the same one.
  const attackTask = useMemo(
    () => pickSpellTask(lesson, difficulty, 'attack', `${monsterId}:atk`),
    [lesson, difficulty, monsterId],
  )
  const skillTask = useMemo(
    () => pickSpellTask(lesson, difficulty, 'skill', `${monsterId}:skill`),
    [lesson, difficulty, monsterId],
  )

  const [attackBox, setAttackBox] = useState<BoxState>(() => freshBox(attackTask.code))
  const [skillBox, setSkillBox] = useState<BoxState>(() => freshBox(skillTask.code))

  // Reset both editors whenever the task changes (new monster, new level, or
  // the difficulty switched mid-run) — otherwise a previous fight's finished
  // code would carry over and the new โจทย์ would be answered before it was
  // read.
  useEffect(() => {
    setAttackBox(freshBox(attackTask.code))
  }, [attackTask])

  useEffect(() => {
    setSkillBox(freshBox(skillTask.code))
  }, [skillTask])

  // Warm the Pyodide runtime the moment the console mounts (first combat of
  // the session) so the multi-second download/boot cost isn't paid on the
  // player's first cast.
  useEffect(() => {
    let cancelled = false
    getPyodide()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setWarming(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function run(box: BoxState, setBox: (b: BoxState) => void, task: SpellTask) {
    // Hard mode only: the โจทย์ is checked against the source *before* the code
    // ever reaches Pyodide, so a spell that ignores the chapter's syntax
    // simply does not fire — no damage, and no cooldown spent either, since
    // nothing was cast. Easy mode has no trial and runs whatever is typed.
    const missing = task.trial && missingCheck(task.trial, box.code)
    if (missing) {
      setBox({
        ...box,
        casting: false,
        log: [],
        error: `คาถายังไม่ตรงโจทย์ของ ${monsterName} จึงร่ายไม่ออก — ยังขาด: ${missing.label}`,
      })
      return
    }

    setBox({ ...box, casting: true, log: [], error: null })
    const result = await castSpell(box.code, {
      playerHp,
      playerAtk,
      monsterHp,
      monsterName,
      monsterArmor,
      onAttack,
      onSkill: onSkillDamage,
    })
    setBox({ ...box, casting: false, log: result.log, error: result.ok ? null : result.errorMessage ?? 'คาถาผิดพลาด' })
    if (result.attackUsed) onAttackCast()
    if (result.skillUsed) onSkillCast()
  }

  return (
    <div className="spell-console">
      <CodeBox
        title={`โจมตี — ใส่ ${monsterName}`}
        state={attackBox}
        brief={attackTask.trial && <TrialBrief trial={attackTask.trial} code={attackBox.code} />}
        onChange={(code) => setAttackBox({ ...attackBox, code })}
        onRun={() => run(attackBox, setAttackBox, attackTask)}
        label={
          warming
            ? 'กำลังเรียกพลังจากอีกมิติ...'
            : attackBox.casting
              ? 'กำลังร่ายคาถา...'
              : attackCooldown > 0
                ? `รอคูลดาวน์ (${Math.ceil(attackCooldown)}s)`
                : 'ร่ายคาถา ⚡'
        }
        disabled={warming || attackBox.casting || attackCooldown > 0}
      />
      <CodeBox
        title="สกิลพิเศษ"
        state={skillBox}
        brief={skillTask.trial && <TrialBrief trial={skillTask.trial} code={skillBox.code} />}
        onChange={(code) => setSkillBox({ ...skillBox, code })}
        onRun={() => run(skillBox, setSkillBox, skillTask)}
        label={
          warming
            ? 'กำลังเรียกพลังจากอีกมิติ...'
            : skillBox.casting
              ? 'กำลังร่ายคาถา...'
              : skillCooldown > 0
                ? `รอคูลดาวน์ (${Math.ceil(skillCooldown)}s)`
                : 'ร่ายสกิลพิเศษ ✦'
        }
        disabled={warming || skillBox.casting || skillCooldown > 0}
      />
    </div>
  )
}

export function CodeBox({
  title,
  state,
  brief,
  onChange,
  onRun,
  label,
  disabled,
}: {
  title: string
  state: BoxState
  // Hard mode's โจทย์ panel, rendered between the title and the editor. Left
  // out entirely in easy mode, where the skeleton itself is the instruction.
  brief?: ReactNode
  onChange: (code: string) => void
  onRun: () => void
  label: string
  disabled: boolean
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const el = e.currentTarget
    const { next, caret } = insertTab(state.code, el)
    onChange(next)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = caret
    })
  }

  return (
    <div className="spell-box">
      <p className="spell-console-label">{title}</p>
      {brief}
      <textarea
        className="spell-textarea"
        value={state.code}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        disabled={state.casting}
        // Hard mode's editor starts with the โจทย์ as comments and the whole
        // spell still to write, so it gets more room than a one-blank skeleton.
        rows={brief ? 12 : 6}
      />
      {(state.log.length > 0 || state.error) && (
        <div className="spell-log">
          {state.log.map((line, i) => (
            <p key={i} className="spell-log-line">
              {line}
            </p>
          ))}
          {state.error && <p className="spell-log-error">{state.error}</p>}
        </div>
      )}
      <button className="spell-run-btn" onClick={onRun} disabled={disabled}>
        {label}
      </button>
    </div>
  )
}
