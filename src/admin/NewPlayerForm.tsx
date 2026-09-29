import { useState } from 'react'
import type { NewPlayer } from './adminApi'

// The password rules the signup screen enforces are the ones the database
// enforces too (migrations_014 rejects anything under 8 characters), so this
// only saves a round trip — it is not the check that matters.
const MIN_PASSWORD_LENGTH = 8

// เพิ่มผู้ใช้ — an account made by the admin instead of by the player.
//
// The admin types a password and tells the player what it is; the account is
// created already email-confirmed, so the player can sign in immediately and
// change it from the reset-password link whenever they like.
export function NewPlayerForm({
  busy,
  onCreate,
  onCancel,
}: {
  busy: boolean
  onCreate: (player: NewPlayer) => Promise<void>
  onCancel: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [nickname, setNickname] = useState('')

  const ready = email.includes('@') && password.length >= MIN_PASSWORD_LENGTH

  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!ready || busy) return
        void onCreate({ email: email.trim(), password, displayName: displayName.trim(), nickname: nickname.trim() })
      }}
    >
      <p className="admin-form-title">เพิ่มผู้ใช้ใหม่</p>
      <div className="admin-form-grid">
        <label className="admin-field">
          <span>อีเมล *</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
        </label>
        <label className="admin-field">
          <span>รหัสผ่าน * (อย่างน้อย {MIN_PASSWORD_LENGTH} ตัว)</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </label>
        <label className="admin-field">
          <span>ชื่อที่แสดง</span>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="admin-field">
          <span>ชื่อเล่น (ใช้ล็อกอินได้)</span>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </label>
      </div>
      <p className="admin-section-note">
        บัญชีจะถูกสร้างแบบยืนยันอีเมลแล้ว ล็อกอินได้ทันที — บอกรหัสผ่านนี้ให้ผู้เล่นแล้วให้เขาเปลี่ยนเองภายหลังได้
      </p>
      <div className="admin-form-actions">
        <button type="submit" className="admin-row-btn" disabled={!ready || busy}>
          {busy ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
        </button>
        <button type="button" className="admin-row-btn" onClick={onCancel} disabled={busy}>
          ยกเลิก
        </button>
      </div>
    </form>
  )
}
