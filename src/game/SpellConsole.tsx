import { Fragment, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { castSpell, getPyodide } from './pyodideRuntime'
import type { LessonData } from './lessons'
import { missingCheck, pickSpellTask, type SpellTask } from './trials'
import { fillBlanks, unfilledBlanks, type BlankTemplate } from './blanks'
 import { composeSlots, emptySlots, type SlotTemplate } from './slots'
import { TrialBrief } from './TrialBrief'
import type { Difficulty } from './difficulty'

type SpellConsoleProps = {
  lesson: LessonData
  difficulty: Difficulty
  // The level's boss: both boxes then ask for the chapter written from
  // scratch, in either difficulty (see bossTrial in trials.ts).
  isBoss?: boolean
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
  // Set while the spell physically cannot land — the target has been walked
  // out of range. Both boxes go read-only and say why, instead of a dead
  // button with no explanation on it.
  blockedReason?: string | null
  // The dungeon-side layout (TargetPanel) has a fraction of the room the old
  // full-screen battle screen had, so the editors start shorter there. The
  // player can still drag any box taller — .spell-textarea is resizable.
  compact?: boolean
}

function insertTab(code: string, el: HTMLTextAreaElement): { next: string; caret: number } {
  const start = el.selectionStart
  const end = el.selectionEnd
  return { next: code.slice(0, start) + '    ' + code.slice(end), caret: start + 4 }
}

// Tab inserts four spaces instead of leaving the box — Python is written here,
// and a key that jumps focus away mid-block is worse than useless. Shared by
// every editor on this panel (the one-box textarea and each write-in slot).
function tabToIndent(
  e: KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (next: string) => void,
) {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const el = e.currentTarget
  const { next, caret } = insertTab(value, el)
  onChange(next)
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = caret
  })
}

export type BoxState = {
  // What actually gets cast. Recomposed from `answers` every time one of them
  // changes — out of the skeleton in easy mode, out of the โจทย์'s slots in
  // hard mode — so everything downstream (the run, the trial checks, the log)
  // sees one kind of thing either way.
  code: string
  // One entry per thing the player has to supply, in order: per `___` in
  // easy mode's skeleton, per demand in hard mode's โจทย์.
  answers: string[]
  casting: boolean
  log: string[]
  error: string | null
}

// Not exported: this file is a component module, and a non-component export
// costs the whole file its fast-refresh. PracticeConsole keeps its own copy.
function freshBox(task: SpellTask): BoxState {
  return {
    code: task.code,
    answers: Array<string>(answerCount(task)).fill(''),
    casting: false,
    log: [],
    error: null,
  }
}

// Not exported for the same reason as the rest of this file's helpers.
// PracticeConsole keeps its own copy of these three.
function answerCount(task: SpellTask): number {
  if (task.blanks) return task.blanks.count
  if (task.slots) return task.slots.labels.length
  return 0
}

// Answering one blank or writing in one slot: the box keeps the answers, and
// `code` is rebuilt from them so the rest of the console never has to know
// which kind of box this was.
function withAnswer(box: BoxState, task: SpellTask, index: number, value: string): BoxState {
  const answers = box.answers.map((a, i) => (i === index ? value : a))
  if (task.blanks) return { ...box, answers, code: fillBlanks(task.blanks, answers) }
  if (task.slots) return { ...box, answers, code: composeSlots(task.slots, answers) }
  return box
}

// The message a box shows instead of casting when the player has not filled
// everything in. Pyodide would raise a SyntaxError on the leftover `___`,
// which is true but says nothing about what to do next.
function unfilledMessage(task: SpellTask, box: BoxState): string | null {
  if (!task.blanks) return null
  const left = unfilledBlanks(task.blanks, box.answers)
  if (left === 0) return null
  return `ยังเติมไม่ครบ — เหลืออีก ${left} ช่อง เติมช่องสีทองในโค้ดให้ครบก่อนแล้วค่อยร่าย`
}

// The Python code sandbox that replaced the old placeholder Attack/skill
// buttons — see README "Python combat sandbox". Both the regular attack and
// the special skill are written as real Python here, each in its own box so
// they read as two separate spells rather than one shared script. Both
// boxes share the same battle-state globals and the same attack()/skill()
// bindings — whichever function the code calls is the effect that happens,
// regardless of which box it was typed in.
//
// What each box *is* depends on the difficulty the player chose before the
// first level (see difficulty.ts). Easy hands over the chapter's skeleton as
// read-only code with a gold input box in each hole, and the player answers
// the holes — they cannot edit, or break, the spell around them. Hard hands
// over the monster's โจทย์ and an empty editor, and refuses to cast until the
// code satisfies it. The level's boss asks the hard version of either.
export function SpellConsole({
  lesson,
  difficulty,
  isBoss = false,
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
  blockedReason = null,
  compact = false,
}: SpellConsoleProps) {
  const [warming, setWarming] = useState(true)

  // The seed includes monsterId so level 1's 9 monsters naturally cycle
  // through the variants (easy: "fill a number" vs "fill a variable"; hard:
  // one โจทย์ per monster) instead of always showing the same one.
  const attackTask = useMemo(
    () => pickSpellTask(lesson, difficulty, 'attack', `${monsterId}:atk`, isBoss),
    [lesson, difficulty, monsterId, isBoss],
  )
  const skillTask = useMemo(
    () => pickSpellTask(lesson, difficulty, 'skill', `${monsterId}:skill`, isBoss),
    [lesson, difficulty, monsterId, isBoss],
  )

  const [attackBox, setAttackBox] = useState<BoxState>(() => freshBox(attackTask))
  const [skillBox, setSkillBox] = useState<BoxState>(() => freshBox(skillTask))

  // Reset both editors whenever the task changes (new monster, new level, or
  // the difficulty switched mid-run) — otherwise a previous fight's finished
  // code would carry over and the new โจทย์ would be answered before it was
  // read.
  useEffect(() => {
    setAttackBox(freshBox(attackTask))
  }, [attackTask])

  useEffect(() => {
    setSkillBox(freshBox(skillTask))
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
    // Easy mode: a skeleton with a blank still in it cannot be cast. Said
    // here rather than let through to Python, which would only answer with a
    // SyntaxError pointing at the underscores.
    const unfilled = unfilledMessage(task, box)
    if (unfilled) {
      setBox({ ...box, casting: false, log: [], error: unfilled })
      return
    }

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
        blanks={attackTask.blanks}
        slots={attackTask.slots}
        onChange={(code) => setAttackBox({ ...attackBox, code })}
        onAnswer={(i, value) => setAttackBox(withAnswer(attackBox, attackTask, i, value))}
        onRun={() => run(attackBox, setAttackBox, attackTask)}
        compact={compact}
        label={
          warming
            ? 'กำลังเรียกพลังจากอีกมิติ...'
            : attackBox.casting
              ? 'กำลังร่ายคาถา...'
              : blockedReason
                ? blockedReason
                : attackCooldown > 0
                  ? `รอคูลดาวน์ (${Math.ceil(attackCooldown)}s)`
                  : 'ร่ายคาถา ⚡'
        }
        disabled={warming || attackBox.casting || attackCooldown > 0 || blockedReason != null}
      />
      <CodeBox
        title="สกิลพิเศษ"
        state={skillBox}
        brief={skillTask.trial && <TrialBrief trial={skillTask.trial} code={skillBox.code} />}
        blanks={skillTask.blanks}
        slots={skillTask.slots}
        onChange={(code) => setSkillBox({ ...skillBox, code })}
        onAnswer={(i, value) => setSkillBox(withAnswer(skillBox, skillTask, i, value))}
        onRun={() => run(skillBox, setSkillBox, skillTask)}
        compact={compact}
        label={
          warming
            ? 'กำลังเรียกพลังจากอีกมิติ...'
            : skillBox.casting
              ? 'กำลังร่ายคาถา...'
              : blockedReason
                ? blockedReason
                : skillCooldown > 0
                  ? `รอคูลดาวน์ (${Math.ceil(skillCooldown)}s)`
                  : 'ร่ายสกิลพิเศษ ✦'
        }
        disabled={warming || skillBox.casting || skillCooldown > 0 || blockedReason != null}
      />
    </div>
  )
}

// Easy mode's editor: the chapter's spell shown as it is, with a box sitting
// in each hole the player has to fill.
//
// The code around the blanks is text, not an editable field, which is the
// whole change — the exercise is now "answer this", not "find the three
// underscores in this wall of code, delete them without breaking anything
// else, and type in their place". The `# TODO:` note the skeleton already
// carried stays right beside its own blank and reads as the question.
function FillInCode({
  template,
  answers,
  onAnswer,
  disabled,
}: {
  template: BlankTemplate
  answers: string[]
  onAnswer: (index: number, value: string) => void
  disabled: boolean
}) {
  const left = unfilledBlanks(template, answers)

  return (
    <div className="fill-code">
      <p className="fill-code-hint">
        {left > 0
          ? `✎ เติมเฉพาะช่องสีทอง — เหลืออีก ${left} ช่อง`
          : '✓ เติมครบแล้ว กดร่ายคาถาได้เลย'}
      </p>
      <code className="fill-code-source">
        {template.segments.map((segment, i) => (
          <Fragment key={i}>
            {segment}
            {i < template.count && (
              <input
                type="text"
                className={`fill-blank${(answers[i] ?? '').trim() === '' ? ' fill-blank-empty' : ''}`}
                value={answers[i] ?? ''}
                onChange={(e) => onAnswer(i, e.target.value)}
                disabled={disabled}
                spellCheck={false}
                autoComplete="off"
                aria-label={`ช่องที่ต้องเติม ${i + 1} จาก ${template.count}`}
                // Grows with what is typed instead of scrolling inside a
                // fixed box: the answer has to stay readable in the middle
                // of the line it belongs to.
                style={{ width: `${Math.max(4, (answers[i] ?? '').length + 1)}ch` }}
              />
            )}
          </Fragment>
        ))}
      </code>
    </div>
  )
}

// Hard mode's editor: one write-in box per demand on the monster's โจทย์.
//
// The player still writes every line of the spell — nothing is filled in for
// them — but each demand now has its own box with the demand itself printed
// on it, instead of three numbered requirements and one undivided textarea.
// Boxes are full multi-line editors, so writing the whole spell in the first
// one and leaving the rest empty is still allowed: what gates the cast is the
// โจทย์'s checks, never which box the lines were typed into (see slots.ts).
function WriteInSlots({
  template,
  answers,
  onAnswer,
  disabled,
  compact,
}: {
  template: SlotTemplate
  answers: string[]
  onAnswer: (index: number, value: string) => void
  disabled: boolean
  compact: boolean
}) {
  const left = emptySlots(template, answers)

  return (
    <div className="slot-code">
      <p className="slot-code-hint">
        {left === 0
          ? '✓ เขียนครบทุกช่องแล้ว'
          : `✎ เขียนคาถาเองในช่องของแต่ละข้อ — ยังว่างอยู่ ${left} ช่อง`}
      </p>
      {template.labels.map((label, i) => {
        const value = answers[i] ?? ''
        const lines = value === '' ? 0 : value.split('\n').length
        return (
          <div key={i} className={`slot-row${value.trim() === '' ? ' slot-row-empty' : ''}`}>
            <p className="slot-label">
              <span className="slot-num">{i + 1}</span> {label}
            </p>
            <textarea
              className="slot-input"
              value={value}
              onChange={(e) => onAnswer(i, e.target.value)}
              onKeyDown={(e) => tabToIndent(e, value, (next) => onAnswer(i, next))}
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              aria-label={`ช่องเขียนคาถาข้อที่ ${i + 1}: ${label}`}
              // Grows with what is typed — a box that scrolls at two lines
              // would hide the block the player is in the middle of writing.
              rows={Math.min(compact ? 8 : 12, Math.max(2, lines + 1))}
            />
          </div>
        )
      })}
    </div>
  )
}

export function CodeBox({
  title,
  state,
  brief,
  blanks = null,
  slots = null,
  onChange,
  onAnswer,
  onRun,
  label,
  disabled,
  compact = false,
}: {
  title: string
  state: BoxState
  // Hard mode's โจทย์ panel, rendered between the title and the editor. Left
  // out entirely in easy mode, where the skeleton itself is the instruction.
  brief?: ReactNode
  // Easy mode only: fill-in-the-blanks over read-only code.
  blanks?: BlankTemplate | null
  // Hard mode / boss only: one write-in box per demand on the โจทย์.
  slots?: SlotTemplate | null
  onChange: (code: string) => void
  onAnswer?: (index: number, value: string) => void
  onRun: () => void
  label: string
  disabled: boolean
  compact?: boolean
}) {
  return (
    <div className={`spell-box${compact ? ' spell-box-compact' : ''}`}>
      <p className="spell-console-label">{title}</p>
      {brief}
      {blanks && blanks.count > 0 && onAnswer ? (
        <FillInCode template={blanks} answers={state.answers} onAnswer={onAnswer} disabled={state.casting} />
      ) : slots && slots.labels.length > 0 && onAnswer ? (
        <WriteInSlots
          template={slots}
          answers={state.answers}
          onAnswer={onAnswer}
          disabled={state.casting}
          compact={compact}
        />
      ) : (
        <textarea
          className="spell-textarea"
          value={state.code}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => tabToIndent(e, state.code, onChange)}
          spellCheck={false}
          disabled={state.casting}
          rows={compact ? (brief ? 9 : 5) : brief ? 12 : 6}
        />
      )}
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
