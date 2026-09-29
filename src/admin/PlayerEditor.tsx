import { useState } from 'react'
import type { AdminPlayerRow, PlayerEdit } from './adminApi'
import { LEVELS } from '../game/levels'
import { PLAYER_MAX_HP } from '../game/constants'

// A number the admin typed, or null for "leave it alone". An emptied field is
// not a zero — clearing the HP box must not set a player's HP to nothing.
function numberOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? Math.round(n) : null
}

function textOrNull(value: string, original: string | null): string | null {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === (original ?? '')) return null
  return trimmed
}

// แก้ไข — names, progress, admin rights and the password-reset email, for one
// player. Opens as a row underneath theirs in the table.
//
// Every field starts on what the player currently has and only the ones that
// actually changed are sent: admin_update_player() reads null as "keep",
// which is what lets this form fix one typo without rewriting a save.
export function PlayerEditor({
  player,
  busy,
  onSave,
  onClose,
  onToggleAdmin,
  onResetPassword,
}: {
  player: AdminPlayerRow
  busy: boolean
  onSave: (edit: PlayerEdit) => Promise<void>
  onClose: () => void
  onToggleAdmin: () => void
  onResetPassword: () => void
}) {
  const [displayName, setDisplayName] = useState(player.displayName ?? '')
  const [nickname, setNickname] = useState(player.nickname ?? '')
  const [characterName, setCharacterName] = useState(player.characterName ?? '')
  const [level, setLevel] = useState(String(player.currentLevel))
  const [hp, setHp] = useState(String(player.playerHp))
  const [atk, setAtk] = useState(String(player.attackPower))

  return (
    <div className="admin-form admin-form-inline">
      <p className="admin-form-title">แก้ไข: {player.email ?? player.userId}</p>

      <div className="admin-form-grid">
        <label className="admin-field">
          <span>ชื่อที่แสดง</span>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>ชื่อเล่น</span>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>ชื่อตัวละคร</span>
          <input type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>ด่านปัจจุบัน (1–{LEVELS.length})</span>
          <input type="number" min={1} max={LEVELS.length} value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>HP (สูงสุด {PLAYER_MAX_HP})</span>
          <input type="number" min={0} max={PLAYER_MAX_HP} value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>พลังโจมตี</span>
          <input type="number" min={0} value={atk} onChange={(e) => setAtk(e.target.value)} />
        </label>
      </div>

      <p className="admin-section-note">
        ช่องที่ไม่ได้แก้จะถูกปล่อยไว้ตามเดิม — การแก้ด่าน/HP/พลังโจมตีมีไว้ช่วยผู้เล่นที่ติด ไม่ใช่ให้เล่นแทน
        {player.characterName == null && ' · ผู้เล่นคนนี้ยังไม่ได้สร้างตัวละคร จึงยังไม่มีข้อมูลเกมให้แก้'}
      </p>

      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-row-btn"
          disabled={busy}
          onClick={() =>
            void onSave({
              displayName: textOrNull(displayName, player.displayName),
              nickname: textOrNull(nickname, player.nickname),
              characterName: textOrNull(characterName, player.characterName),
              currentLevel: numberOrNull(level),
              playerHp: numberOrNull(hp),
              attackPower: numberOrNull(atk),
            })
          }
        >
          {busy ? 'กำลังบันทึก...' : '💾 บันทึก'}
        </button>
        <button type="button" className="admin-row-btn" onClick={onResetPassword} disabled={busy || !player.email}>
          ✉️ ส่งอีเมลรีเซ็ตรหัสผ่าน
        </button>
        <button type="button" className="admin-row-btn" onClick={onToggleAdmin} disabled={busy || !player.email}>
          {player.isAdmin ? '🛡 ถอดสิทธิ์แอดมิน' : '🛡 ให้สิทธิ์แอดมิน'}
        </button>
        <button type="button" className="admin-row-btn" onClick={onClose} disabled={busy}>
          ปิด
        </button>
      </div>
    </div>
  )
}
