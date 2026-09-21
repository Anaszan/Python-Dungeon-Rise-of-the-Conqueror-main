import { useState } from 'react'
import { useGameStore } from '../game/store'
import { LEVELS } from '../game/levels'
import {
  CHARACTER_CLASS_OPTIONS,
  GENDER_OPTIONS,
  type AppearanceChoice,
} from '../character/characterOptions'
import { CharacterPortrait } from '../character/CharacterPortrait'
import { AppearancePicker } from '../character/AppearancePicker'
import { PLAYER_MAX_HP } from '../game/constants'

type EditStatus = 'idle' | 'saving' | 'saved' | 'error'

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
  const updateAppearance = useGameStore((s) => s.updateAppearance)

  // Non-null while the player is editing, and holds the pending look — so the
  // character in the dungeon behind this panel does not change class every
  // time they tap an option, only when they save.
  const [draft, setDraft] = useState<AppearanceChoice | null>(null)
  const [editStatus, setEditStatus] = useState<EditStatus>('idle')

  const startEditing = () => {
    if (!characterClass) return
    setDraft({ characterClass, gender, skinColor, shirtColor })
    setEditStatus('idle')
  }

  const cancelEditing = () => {
    setDraft(null)
    setEditStatus('idle')
  }

  // Closing is also cancelling: an unsaved draft must not be waiting, half
  // applied, the next time the panel is opened.
  const close = () => {
    setOpen(false)
    cancelEditing()
  }

  const saveAppearance = async () => {
    if (!draft) return
    setEditStatus('saving')
    const saved = await updateAppearance(draft)
    if (!saved) {
      // The store already has the new look, but Supabase does not — saying so
      // is the difference between the player retrying now and finding their
      // old character waiting for them tomorrow.
      setEditStatus('error')
      return
    }
    setEditStatus('saved')
    setDraft(null)
  }

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
      <button type="button" className="profile-toggle" onClick={() => (open ? close() : setOpen(true))}>
        👤 โปรไฟล์
      </button>
      {open && (
        <div className="screen-overlay profile-overlay" onClick={close}>
          <div className="auth-panel profile-panel" onClick={(e) => e.stopPropagation()}>
            <h1>โปรไฟล์ผู้เล่น</h1>

            <div className="profile-header">
              {/* Hidden while editing: the picker below carries its own live
                  model, and two WebGL canvases of the same character side by
                  side is a lot of dungeon to render for one panel. */}
              {characterClass && !draft && (
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
                  <span> ดาเมจ {attackPower}</span>
                  <span>
                    HP {playerHp}/{PLAYER_MAX_HP}
                  </span>
                </div>
              </div>
            </div>

            {/* Only the look changes here. The name is the character's claimed
                identity and stays as it was created — see the store's
                updateAppearance. */}
            <div className="customize-section profile-appearance">
              <p className="customize-section-label">ตัวละครของคุณ</p>
              {draft ? (
                <>
                  <AppearancePicker
                    value={draft}
                    onChange={setDraft}
                    disabled={editStatus === 'saving'}
                  />
                  <div className="profile-editor-row">
                    <button
                      type="button"
                      className="profile-save-btn"
                      disabled={editStatus === 'saving'}
                      onClick={saveAppearance}
                    >
                      {editStatus === 'saving' ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                    <button
                      type="button"
                      className="accessory-btn"
                      disabled={editStatus === 'saving'}
                      onClick={cancelEditing}
                    >
                      ยกเลิก
                    </button>
                    {editStatus === 'error' && (
                      <span className="customize-name-status customize-name-error">
                        บันทึกไม่สำเร็จ กรุณาลองใหม่
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="profile-editor-row">
                  <button type="button" className="accessory-btn" disabled={!characterClass} onClick={startEditing}>
                    แก้ไขตัวละคร
                  </button>
                  {editStatus === 'saved' && (
                    <span className="customize-name-status customize-name-ok">บันทึกแล้ว</span>
                  )}
                </div>
              )}
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

            <button type="button" onClick={close}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </>
  )
}
