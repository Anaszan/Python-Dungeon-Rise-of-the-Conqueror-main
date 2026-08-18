import { useState } from 'react'
import { useGameStore } from '../game/store'
import { LEVELS } from '../game/levels'
import { CHARACTER_CLASS_OPTIONS, GENDER_OPTIONS } from '../character/characterOptions'
import { CharacterPortrait } from '../character/CharacterPortrait'
import { PLAYER_MAX_HP } from '../game/constants'

export function PlayerProfile() {
  const [open, setOpen] = useState(false)
  const characterName = useGameStore((s) => s.characterName)
  const characterClass = useGameStore((s) => s.characterClass)
  const gender = useGameStore((s) => s.gender)
  const skinColor = useGameStore((s) => s.skinColor)
  const shirtColor = useGameStore((s) => s.shirtColor)
  const attackPower = useGameStore((s) => s.attackPower)
  const playerHp = useGameStore((s) => s.playerHp)
  const defeatedIds = useGameStore((s) => s.defeatedIds)
  const currentLevel = useGameStore((s) => s.currentLevel)

  const classLabel = CHARACTER_CLASS_OPTIONS.find((c) => c.id === characterClass)?.label ?? '-'
  const genderLabel = GENDER_OPTIONS.find((g) => g.id === gender)?.label ?? '-'

  const totalMonsters = LEVELS.reduce((sum, l) => sum + l.monsters.length, 0)
  const totalDefeated = LEVELS.reduce(
    (sum, l) => sum + l.monsters.filter((m) => defeatedIds.has(m.id)).length,
    0,
  )
  const overallPct = totalMonsters === 0 ? 0 : Math.round((totalDefeated / totalMonsters) * 100)

  return (
    <>
      <button type="button" className="profile-toggle" onClick={() => setOpen((o) => !o)}>
        👤 โปรไฟล์
      </button>
      {open && (
        <div className="screen-overlay profile-overlay" onClick={() => setOpen(false)}>
          <div className="auth-panel profile-panel" onClick={(e) => e.stopPropagation()}>
            <h1>โปรไฟล์ผู้เล่น</h1>

            <div className="profile-header">
              {characterClass && (
                <div className="profile-portrait">
                  <CharacterPortrait appearance={{ characterClass, gender, skinColor, shirtColor }} />
                </div>
              )}
              <div className="profile-identity">
                <div className="profile-name">{characterName ?? 'ผู้เล่นนิรนาม'}</div>
                <div className="profile-class">
                  {classLabel} · {genderLabel}
                </div>
                <div className="profile-stats-row">
                  <span>ครีติคอล {attackPower}</span>
                  <span>
                    HP {playerHp}/{PLAYER_MAX_HP}
                  </span>
                </div>
              </div>
            </div>

            <div className="customize-section profile-overall">
              <p className="customize-section-label">ความคืบหน้ารวม</p>
              <div className="profile-level-track">
                <div className="profile-level-fill" style={{ width: `${overallPct}%` }} />
              </div>
              <span className="profile-level-pct">
                {totalDefeated}/{totalMonsters} ตัว ({overallPct}%)
              </span>
            </div>

            <div className="customize-section profile-levels">
              <p className="customize-section-label">ความคืบหน้าแต่ละด่าน</p>
              <ul className="profile-level-list">
                {LEVELS.map((level) => {
                  const defeated = level.monsters.filter((m) => defeatedIds.has(m.id)).length
                  const total = level.monsters.length
                  const pct = total === 0 ? 0 : Math.round((defeated / total) * 100)
                  return (
                    <li
                      key={level.level}
                      className={level.level === currentLevel ? 'profile-level-item profile-level-current' : 'profile-level-item'}
                    >
                      <div className="profile-level-row">
                        <span>
                          ด่าน {level.level}: {level.name}
                        </span>
                        <span>
                          {defeated}/{total} ({pct}%)
                        </span>
                      </div>
                      <div className="profile-level-track">
                        <div className="profile-level-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <button type="button" onClick={() => setOpen(false)}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </>
  )
}
