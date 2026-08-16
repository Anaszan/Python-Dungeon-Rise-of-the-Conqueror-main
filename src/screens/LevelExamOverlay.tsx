import { useEffect, useState } from 'react'
import { useGameStore } from '../game/store'
import { LEVELS } from '../game/levels'
import { LESSONS } from '../game/lessons'
import { castSpell, getPyodide } from '../game/pyodideRuntime'
import { CodeBox, type BoxState } from '../game/SpellConsole'
import { Mentor } from '../components/Mentor'

// The gate between two levels. Killing the last monster of a level no longer
// opens the next one on its own (see store.exitCombat) — it drops the player
// here, into one empty editor, and the only way through is to write that
// chapter's whole spell again from scratch and knock the gate guardian down
// with it in a single cast.
//
// Why "in a single cast": the guardian is restored to full HP at the start of
// every run, so the pass condition is a property of one complete script, not
// of damage accumulated across a dozen half-finished attempts. Combined with
// the per-chapter `checks` (which read the source, not the result) that makes
// the exam un-passable by pasting three bare attack() calls into the loops
// level — the syntax the chapter taught has to actually be in there.
//
// Nothing here touches the real fight state: damage lands on a local counter,
// and there are no cooldowns, the same way PracticeConsole stays out of the
// store.
type Verdict =
  | { kind: 'idle' }
  | { kind: 'fail'; message: string }
  | { kind: 'pass' }

export function LevelExamOverlay() {
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const playerHp = useGameStore((s) => s.playerHp)
  const attackPower = useGameStore((s) => s.attackPower)
  const passLevelExam = useGameStore((s) => s.passLevelExam)

  const lesson = LESSONS[currentLevel - 1]
  const exam = lesson.exam

  const [warming, setWarming] = useState(true)
  const [box, setBox] = useState<BoxState>(() => ({ code: exam.starterCode, casting: false, log: [], error: null }))
  const [verdict, setVerdict] = useState<Verdict>({ kind: 'idle' })
  // Guardian HP left after the most recent run — display only, reset to full
  // before each new one.
  const [guardianHp, setGuardianHp] = useState(exam.guardianHp)
  const [showHints, setShowHints] = useState(false)

  // A brand new exam every level: fresh (empty) editor, guardian back to
  // full, previous level's verdict cleared.
  useEffect(() => {
    setBox({ code: exam.starterCode, casting: false, log: [], error: null })
    setVerdict({ kind: 'idle' })
    setGuardianHp(exam.guardianHp)
    setShowHints(false)
  }, [exam])

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

  if (phase !== 'exam') return null

  const isLastLevel = currentLevel === LEVELS.length
  const levelData = LEVELS[currentLevel - 1]

  async function run() {
    setBox({ ...box, casting: true, log: [], error: null })
    setVerdict({ kind: 'idle' })

    let dealt = 0
    const result = await castSpell(box.code, {
      playerHp,
      playerAtk: attackPower,
      // The guardian is always at full HP when the script starts, so
      // monster_hp reads as the number the player has to get through.
      monsterHp: exam.guardianHp,
      monsterName: exam.guardianName,
      monsterArmor: exam.guardianArmor,
      onAttack: (amount) => {
        dealt += amount
      },
      onSkill: (amount) => {
        dealt += amount
      },
    })

    const remaining = Math.max(0, exam.guardianHp - dealt)
    setGuardianHp(remaining)
    setBox({ ...box, casting: false, log: result.log, error: result.ok ? null : (result.errorMessage ?? 'คาถาผิดพลาด') })

    if (!result.ok) {
      setVerdict({ kind: 'fail', message: 'คาถาพังกลางทาง — แก้ข้อผิดพลาดด้านบนแล้วร่ายใหม่' })
      return
    }

    const missing = exam.checks.find((c) => !c.pattern.test(box.code))
    if (missing) {
      setVerdict({ kind: 'fail', message: `โค้ดรันได้ แต่ยังไม่ใช่คาถาของบทนี้ — ยังขาด: ${missing.label}` })
      return
    }

    if (remaining > 0) {
      setVerdict({
        kind: 'fail',
        message: `พลังยังไม่พอ — ทำได้ ${dealt} จาก ${exam.guardianHp} หน่วย ผู้พิทักษ์ฟื้นเต็มทุกครั้งที่ร่ายใหม่ ต้องล้มให้ได้ในคาถาเดียว`,
      })
      return
    }

    setVerdict({ kind: 'pass' })
  }

  const hpPct = Math.max(0, Math.min(100, (guardianHp / exam.guardianHp) * 100))
  const passed = verdict.kind === 'pass'

  return (
    <div className="screen-overlay exam-overlay">
      <div className="exam-panel">
        <p className="chapter-intro-eyebrow">บทสอบปิดผนึกด่าน {currentLevel}</p>
        <h1 className="chapter-intro-title">
          {levelData.name} — บทที่ {lesson.chapter}: {lesson.chapterTitle}
        </h1>

        <Mentor
          key={currentLevel}
          compact
          lines={[
            `มอนสเตอร์ในด่าน ${currentLevel} ถูกกำจัดครบแล้ว แต่ประตูสู่ด่านต่อไปยังปิดผนึกอยู่`,
            'ประตูนี้ไม่รับคาถาเติมคำในช่องว่างอีกต่อไป — เจ้าต้องเขียนคาถาของบทนี้ใหม่ทั้งหมดด้วยมือเจ้าเอง',
            'ผู้พิทักษ์จะฟื้นพลังเต็มทุกครั้งที่เจ้าเริ่มร่ายใหม่ ดังนั้นคาถาเดียวต้องล้มมันให้ได้',
          ]}
        />

        <div className="exam-guardian">
          <p className="exam-guardian-name">{exam.guardianName}</p>
          <div className="hp-bar-track exam-guardian-track">
            <div className="hp-bar-fill" style={{ width: `${hpPct}%` }} />
          </div>
          <p className="exam-guardian-hp">
            {guardianHp} / {exam.guardianHp} HP · เกราะ (monster_armor) = {exam.guardianArmor} · พลังโจมตีของเจ้า (atk) ={' '}
            {attackPower}
          </p>
        </div>

        <div className="exam-checklist">
          <p className="exam-checklist-label">เงื่อนไขผ่านบทสอบ</p>
          {exam.brief.map((line, i) => (
            <p key={i} className="exam-brief-line">
              {i + 1}. {line}
            </p>
          ))}
          <div className="exam-checks">
            {exam.checks.map((check) => {
              const ok = check.pattern.test(box.code)
              return (
                <p key={check.label} className={`exam-check${ok ? ' exam-check-ok' : ''}`}>
                  {ok ? '✔' : '○'} {check.label}
                </p>
              )
            })}
          </div>
        </div>

        <CodeBox
          title="คาถาปิดผนึกด่าน — เขียนเองทั้งหมด"
          state={box}
          onChange={(code) => setBox({ ...box, code })}
          onRun={run}
          label={warming ? 'กำลังเรียกพลังจากอีกมิติ...' : box.casting ? 'กำลังร่ายคาถา...' : 'ร่ายคาถาปิดผนึก ✦'}
          disabled={warming || box.casting || passed}
        />

        {verdict.kind === 'fail' && <p className="exam-verdict exam-verdict-fail">{verdict.message}</p>}
        {passed && (
          <p className="exam-verdict exam-verdict-pass">
            ผ่าน! คาถาของเจ้าล้มผู้พิทักษ์ได้ในคาถาเดียว ประตูเปิดแล้ว
          </p>
        )}

        <div className="exam-footer">
          <button className="practice-reroll-btn" onClick={() => setShowHints((v) => !v)}>
            {showHints ? 'ซ่อนคำใบ้' : '💡 ขอคำใบ้'}
          </button>
          <button className="practice-reroll-btn" onClick={() => setBox({ code: exam.starterCode, casting: false, log: [], error: null })}>
            🧹 ล้างกระดานเริ่มใหม่
          </button>
        </div>

        {showHints && (
          <div className="exam-hints">
            {exam.hints.map((hint, i) => (
              <p key={i}>• {hint}</p>
            ))}
          </div>
        )}

        <button className="exam-continue-btn" onClick={passLevelExam} disabled={!passed}>
          {passed
            ? isLastLevel
              ? 'ปิดผนึกดันเจี้ยนสุดท้าย 🎉'
              : `ไปด่าน ${currentLevel + 1}`
            : 'ต้องผ่านบทสอบก่อนจึงจะไปต่อได้'}
        </button>
      </div>
    </div>
  )
}
