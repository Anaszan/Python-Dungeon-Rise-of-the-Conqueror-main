import { useState } from 'react'
import { Mentor } from '../components/Mentor'
import { useGameStore } from '../game/store'
import { DIFFICULTY_OPTIONS, type Difficulty } from '../game/difficulty'

// Module-level, not inline: Mentor restarts its typewriter whenever the
// `lines` array identity changes, and this screen re-renders on every click of
// a difficulty card.
const MENTOR_LINES = [
  'ก่อนจะก้าวเข้าดันเจี้ยน ข้าขอถามอย่างหนึ่ง — เจ้าอยากให้ข้าช่วยร่างคาถาไว้ให้ หรืออยากประลองกับโจทย์ของมอนสเตอร์ตรง ๆ',
  'โหมดง่าย ข้าจะเขียนคาถาไว้ให้เกือบครบ เหลือช่องว่างให้เจ้าเติมแค่จุดเดียว',
  'โหมดยาก มอนสเตอร์แต่ละตัวจะส่งโจทย์มาให้ เจ้าต้องเขียนคาถาเองทั้งหมดให้ตรงเงื่อนไข ไม่งั้นคาถาจะไม่ยอมออกจากมือเจ้า',
  'เลือกผิดก็ไม่เป็นไร — เปลี่ยนได้ทีหลังจากเมนูหยุดชั่วคราวระหว่างเล่น',
]

// Sits between making a character and the first chapter intro (see App.tsx),
// and is shown again only if the player never answered it. What it picks is a
// *coding* difficulty, not a combat one — see difficulty.ts. The same picker
// is reachable later from the pause menu, so nobody is locked into the mode
// they guessed at before they had seen a single monster.
export function DifficultySelect() {
  const setDifficulty = useGameStore((s) => s.setDifficulty)
  const [choice, setChoice] = useState<Difficulty>('easy')

  return (
    <div className="screen-overlay">
      <div className="customize-panel difficulty-panel">
        <h1>เลือกระดับความท้าทาย</h1>

        <Mentor lines={MENTOR_LINES} />

        <div className="difficulty-options">
          {DIFFICULTY_OPTIONS.map((option) => {
            const selected = option.id === choice
            return (
              <button
                key={option.id}
                type="button"
                className={`difficulty-card${selected ? ' difficulty-card-selected' : ''}`}
                onClick={() => setChoice(option.id)}
                aria-pressed={selected}
              >
                <span className="difficulty-card-eyebrow">{option.eyebrow}</span>
                <span className="difficulty-card-name">{option.name}</span>
                <span className="difficulty-card-tagline">{option.tagline}</span>
                <span className="difficulty-card-bullets">
                  {option.bullets.map((line) => (
                    <span key={line} className="difficulty-card-bullet">
                      • {line}
                    </span>
                  ))}
                </span>
                <pre className="difficulty-card-sample">
                  <code>{option.sample}</code>
                </pre>
              </button>
            )
          })}
        </div>

        <p className="difficulty-note">
          ทั้งสองโหมดใช้มอนสเตอร์ พลังชีวิต และบทสอบจบด่านชุดเดียวกัน — ต่างกันแค่ "โจทย์โค้ด" ที่เจอในหน้าต่อสู้เท่านั้น
        </p>

        <button type="button" className="customize-confirm" onClick={() => setDifficulty(choice)}>
          เริ่มการผจญภัยด้วยโหมดนี้
        </button>
      </div>
    </div>
  )
}
