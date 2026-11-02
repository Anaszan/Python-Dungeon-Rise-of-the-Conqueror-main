import { useEffect, useState } from 'react'
import { castSpell, getPyodide } from './pyodideRuntime'
import type { LessonData } from './lessons'
import { CodeBox, type BoxState } from './SpellConsole'
import { pickSpellTask, type SpellTask } from './trials'
import { fillBlanks, unfilledBlanks } from './blanks'
import { TrialBrief } from './TrialBrief'
import { type Difficulty } from './difficulty'

const DUMMY_MAX_HP = 50
const DUMMY_NAME = 'หุ่นฝึกซ้อม'

// Same shape SpellConsole builds: the composed code plus, in easy mode, one
// answer slot per blank in the skeleton.
function freshBox(task: SpellTask): BoxState {
  return {
    code: task.code,
    answers: task.blanks ? Array<string>(task.blanks.count).fill('') : [],
    casting: false,
    log: [],
    error: null,
  }
}

function withAnswer(box: BoxState, task: SpellTask, index: number, value: string): BoxState {
  if (!task.blanks) return box
  const answers = box.answers.map((a, i) => (i === index ? value : a))
  return { ...box, answers, code: fillBlanks(task.blanks, answers) }
}

// A safe practice fight shown on ChapterIntro before the player ever steps
// into the level — same two-box attack/skill mechanic as real combat
// (SpellConsole), but against a local training dummy instead of the game
// store, so trying things out here has zero risk (no HP lost, no cooldown
// carried into the real fight). Reuses CodeBox from SpellConsole.tsx so the
// editor/log/run-button look and behave identically in both places.
//
// It also mirrors the chosen difficulty: a hard-mode player practices against
// a real โจทย์ with its checklist, not against a fill-in-the-blank skeleton
// they will never see again. Unlike real combat, the checklist here does not
// block the run — this is the one room where a half-finished idea is supposed
// to be runnable.
export function PracticeConsole({
  lesson,
  difficulty,
  playerHp,
  playerAtk,
  monsterArmor,
}: {
  lesson: LessonData
  difficulty: Difficulty
  playerHp: number
  playerAtk: number
  monsterArmor: number
}) {
  const [warming, setWarming] = useState(true)
  const [dummyHp, setDummyHp] = useState(DUMMY_MAX_HP)
  // Bumped by the reroll button to pull a different variant out of the
  // chapter — a different skeleton on easy, a different โจทย์ on hard.
  const [round, setRound] = useState(0)

  const attackTask = pickSpellTask(lesson, difficulty, 'attack', `practice:atk:${round}`)
  const skillTask = pickSpellTask(lesson, difficulty, 'skill', `practice:skill:${round}`)

  const [attackBox, setAttackBox] = useState<BoxState>(() => freshBox(attackTask))
  const [skillBox, setSkillBox] = useState<BoxState>(() => freshBox(skillTask))

  // New level's lesson, a different difficulty, or a reroll → fresh dummy and
  // fresh tasks, same as SpellConsole does when the fight changes.
  useEffect(() => {
    setDummyHp(DUMMY_MAX_HP)
    setAttackBox(freshBox(pickSpellTask(lesson, difficulty, 'attack', `practice:atk:${round}`)))
    setSkillBox(freshBox(pickSpellTask(lesson, difficulty, 'skill', `practice:skill:${round}`)))
  }, [lesson, difficulty, round])

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

  function damageDummy(amount: number) {
    setDummyHp((hp) => Math.max(0, hp - amount))
  }

  async function run(box: BoxState, setBox: (b: BoxState) => void, task: SpellTask) {
    // The one gate the practice room does keep. Its checklist deliberately
    // does not block a run — a half-finished idea is supposed to be runnable
    // here — but a skeleton with `___` still in it is not a half-finished
    // idea, it is a SyntaxError with nothing to learn from.
    const left = task.blanks ? unfilledBlanks(task.blanks, box.answers) : 0
    if (left > 0) {
      setBox({
        ...box,
        casting: false,
        log: [],
        error: `ยังเติมไม่ครบ — เหลืออีก ${left} ช่อง เติมช่องสีทองในโค้ดให้ครบก่อนแล้วค่อยลองร่าย`,
      })
      return
    }

    setBox({ ...box, casting: true, log: [], error: null })
    const result = await castSpell(box.code, {
      playerHp,
      playerAtk,
      monsterHp: dummyHp,
      monsterName: DUMMY_NAME,
      monsterArmor,
      onAttack: damageDummy,
      onSkill: damageDummy,
    })
    setBox({ ...box, casting: false, log: result.log, error: result.ok ? null : (result.errorMessage ?? 'คาถาผิดพลาด') })
    // No cooldowns here on purpose — this is a practice fight, not the real
    // thing, so nothing should feel like it's being "spent".
  }

  const dummyDefeated = dummyHp <= 0
  const hpPct = Math.max(0, Math.min(100, (dummyHp / DUMMY_MAX_HP) * 100))

  function briefOf(task: SpellTask, code: string) {
    return task.trial ? <TrialBrief trial={task.trial} code={code} /> : undefined
  }

  return (
    <div className="practice-console">
      <div className="practice-header">
        <div>
          <p className="practice-label">ห้องฝึกซ้อม — ลองเขียนโค้ดก่อนเข้าด่านจริงได้ที่นี่ ไม่มีผลกับสถานะตัวจริง</p>
          <p className="practice-dummy-name">{DUMMY_NAME}</p>
          <div className="hp-bar-track practice-dummy-track">
            <div className="hp-bar-fill" style={{ width: `${hpPct}%` }} />
          </div>
          <p className="practice-dummy-hp">
            {dummyHp} / {DUMMY_MAX_HP} HP
          </p>
        </div>
        <button className="practice-reroll-btn" onClick={() => setRound((n) => n + 1)}>
          🔄 ฝึกใหม่ (สุ่มโจทย์)
        </button>
      </div>

      {dummyDefeated && <p className="practice-dummy-defeated">หุ่นฝึกซ้อมพังแล้ว! กด "ฝึกใหม่" เพื่อซ่อมแล้วลองต่อ</p>}

      <div className="spell-console">
        <CodeBox
          title="ฝึกโจมตี"
          state={attackBox}
          brief={briefOf(attackTask, attackBox.code)}
          blanks={attackTask.blanks}
          onChange={(code) => setAttackBox({ ...attackBox, code })}
          onAnswer={(i, value) => setAttackBox(withAnswer(attackBox, attackTask, i, value))}
          onRun={() => run(attackBox, setAttackBox, attackTask)}
          label={warming ? 'กำลังเรียกพลังจากอีกมิติ...' : attackBox.casting ? 'กำลังร่ายคาถา...' : 'ทดลองร่าย ⚡'}
          disabled={warming || attackBox.casting}
        />
        <CodeBox
          title="ฝึกสกิลพิเศษ"
          state={skillBox}
          brief={briefOf(skillTask, skillBox.code)}
          blanks={skillTask.blanks}
          onChange={(code) => setSkillBox({ ...skillBox, code })}
          onAnswer={(i, value) => setSkillBox(withAnswer(skillBox, skillTask, i, value))}
          onRun={() => run(skillBox, setSkillBox, skillTask)}
          label={warming ? 'กำลังเรียกพลังจากอีกมิติ...' : skillBox.casting ? 'กำลังร่ายคาถา...' : 'ทดลองร่าย ✦'}
          disabled={warming || skillBox.casting}
        />
      </div>
    </div>
  )
}
