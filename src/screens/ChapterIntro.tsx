import { Mentor } from '../components/Mentor'
import { PracticeConsole } from '../game/PracticeConsole'
import { useGameStore } from '../game/store'
import type { LessonData } from '../game/lessons'
import { difficultyLabel, type Difficulty } from '../game/difficulty'

// Shown once per level, right before the dungeon renders — see App.tsx. The
// wizard teaches that level's chapter (variables, conditionals, loops,
// functions, file handling, error handling), then a PracticeConsole lets the
// player actually try the attack/skill task against a harmless training dummy
// before they ever meet a real monster with it — in whichever difficulty they
// chose, so the practice matches the fights that follow.
export function ChapterIntro({
  level,
  lesson,
  difficulty,
  onStart,
}: {
  level: number
  lesson: LessonData
  difficulty: Difficulty
  onStart: () => void
}) {
  const playerHp = useGameStore((s) => s.playerHp)
  const attackPower = useGameStore((s) => s.attackPower)
  // Level 6's monsters all have armor: 0 to force the try/except lesson —
  // practicing against the same armor value here means the player can hit
  // that exact ZeroDivisionError safely before it matters for real.
  const monsterArmor = level === 6 ? 0 : 999

  return (
    <div className="screen-overlay">
      <div className="chapter-intro-panel">
        <p className="chapter-intro-eyebrow">
          ด่าน {level} · บทที่ {lesson.chapter} · {difficultyLabel(difficulty)}
        </p>
        <h1 className="chapter-intro-title">{lesson.chapterTitle}</h1>
        <Mentor lines={lesson.teachingLines} />
        <div className="chapter-intro-grimoire">
          {lesson.conceptRows.map(([term, meaning]) => (
            <div className="chapter-intro-row" key={term}>
              <span className="chapter-intro-term">{term}</span>
              <span className="chapter-intro-meaning">{meaning}</span>
            </div>
          ))}
        </div>
        <div className="chapter-intro-example">
          <p className="chapter-intro-example-label">📖 ตัวอย่างคาถา — โค้ด Python ที่รันได้จริงและถูกต้องแล้ว ลองดูก่อนไปเขียนเองด้านล่าง</p>
          <pre>
            <code>{lesson.exampleCode}</code>
          </pre>
        </div>
        <PracticeConsole
          lesson={lesson}
          difficulty={difficulty}
          playerHp={playerHp}
          playerAtk={attackPower}
          monsterArmor={monsterArmor}
        />
        <button onClick={onStart}>เข้าด่าน {level}</button>
      </div>
    </div>
  )
}
