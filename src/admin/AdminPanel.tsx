import { Fragment, useCallback, useEffect, useState } from 'react'
import { useAdminStore } from './adminStore'
import {
  adminCreatePlayer,
  adminDeletePlayer,
  adminSendPasswordReset,
  adminSetAdmin,
  adminSetSuspended,
  adminUpdatePlayer,
  fetchAdminPlayers,
  type AdminPlayerRow,
} from './adminApi'
import { NewPlayerForm } from './NewPlayerForm'
import { PlayerEditor } from './PlayerEditor'
import { useGameStore } from '../game/store'
import { LEVELS } from '../game/levels'
import { LESSONS } from '../game/lessons'
import { PLAYER_MAX_HP } from '../game/constants'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function playerLabel(row: AdminPlayerRow): string {
  return row.characterName ?? row.nickname ?? row.displayName ?? '(ยังไม่ได้สร้างตัวละคร)'
}

// The admin console: jump around this account's own levels, and manage every
// player in the game — เพิ่ม / แก้ไข / ลบ / ระงับ.
//
// Nothing here is the security boundary. The warp buttons only ever move
// *this* account's save (the same store actions the game itself uses), and
// every user-management button calls a SECURITY DEFINER RPC that re-checks
// is_admin() in the database (migrations_014). A player who forces this panel
// open gets their own level buttons and a table full of 403s.
export function AdminPanel() {
  const isAdmin = useAdminStore((s) => s.isAdmin)
  const panelOpen = useAdminStore((s) => s.panelOpen)
  const setPanelOpen = useAdminStore((s) => s.setPanelOpen)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const defeatedIds = useGameStore((s) => s.defeatedIds)
  const playerHp = useGameStore((s) => s.playerHp)
  const warpToLevel = useGameStore((s) => s.warpToLevel)
  const resetLevelMonsters = useGameStore((s) => s.resetLevelMonsters)

  const [players, setPlayers] = useState<AdminPlayerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedOnce, setLoadedOnce] = useState(false)
  // Which row has its editor open, whether the "new user" form is up, and what
  // the last action reported.
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlayers(await fetchAdminPlayers())
      setLoadedOnce(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลผู้เล่นไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  // Every user-management action goes through here: one place that says what
  // happened, pulls the table again so the screen is not left lying about the
  // state, and refuses to start a second action while one is in flight.
  const run = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setBusy(true)
      setError(null)
      setNotice(null)
      try {
        await action()
        setNotice(`${label}สำเร็จ`)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : `${label}ไม่สำเร็จ`)
      } finally {
        setBusy(false)
      }
    },
    [load],
  )

  // Fetched when the panel opens rather than on mount: this component stays
  // mounted for the whole session, and nobody needs a table of every player
  // pulled down in the background while they are fighting.
  useEffect(() => {
    if (panelOpen && !loadedOnce && !loading) void load()
    // `loading` is deliberately out of the deps: including it would re-run this
    // the moment the request finishes and start a second one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, loadedOnce, load])

  if (!panelOpen || !isAdmin) return null

  const conquerors = players.filter((p) => p.isConqueror).length
  const suspended = players.filter((p) => p.suspendedAt).length

  return (
    <div className="screen-overlay admin-overlay">
      <div className="admin-panel">
        <div className="admin-header">
          <div>
            <p className="chapter-intro-eyebrow">โหมดแอดมิน</p>
            <h1 className="admin-title">แผงควบคุมผู้ดูแลเกม</h1>
          </div>
          <button type="button" className="admin-close-btn" onClick={() => setPanelOpen(false)}>
            ปิด ✕
          </button>
        </div>

        <section className="admin-section">
          <h2 className="admin-section-title">วาร์ปข้ามด่าน</h2>
          <p className="admin-section-note">
            ย้ายตัวละครของบัญชีนี้ไปเริ่มต้นด่านไหนก็ได้ทันที — HP, พลังโจมตี, มอนสเตอร์ที่ปราบแล้วและไอเทมที่เก็บแล้วติดตัวไปด้วยทั้งหมด
            ไม่มีอะไรถูกล้าง ส่วนปุ่ม "รีเซ็ตมอนสเตอร์" จะปลุกมอนสเตอร์ทั้งด่านนั้นกลับมา (บอสกลับไปถูกผนึกเหมือนเดิม) เพื่อเล่นซ้ำได้
            — มีผลเฉพาะเซฟของบัญชีนี้เท่านั้น และไอเทมที่เก็บไปแล้วไม่คืนให้ กันการฟาร์มพลัง
          </p>
          {playerHp <= 0 && <p className="admin-error">ตัวละครหมดพลังชีวิตอยู่ — กด "เริ่มใหม่" ที่หน้าเกมโอเวอร์ก่อนจึงจะวาร์ปได้</p>}
          <div className="admin-warp-grid">
            {LEVELS.map((level) => {
              const lesson = LESSONS[level.level - 1]
              const alive = level.monsters.filter((m) => !defeatedIds.has(m.id)).length
              const isCurrent = level.level === currentLevel
              return (
                <div key={level.level} className={`admin-warp-card${isCurrent ? ' admin-warp-btn-current' : ''}`}>
                  <button
                    type="button"
                    className="admin-warp-btn"
                    disabled={isCurrent || playerHp <= 0}
                    onClick={() => {
                      warpToLevel(level.level)
                      setPanelOpen(false)
                    }}
                  >
                    <span className="admin-warp-level">ด่าน {level.level}</span>
                    <span className="admin-warp-name">{level.name}</span>
                    <span className="admin-warp-meta">
                      บทที่ {lesson.chapter} · {lesson.chapterTitle}
                    </span>
                    <span className="admin-warp-status">
                      {isCurrent ? '● อยู่ที่นี่' : alive === 0 ? '✔ เคลียร์แล้ว (ห้องว่าง)' : `เหลือมอนสเตอร์ ${alive} ตัว`}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="admin-reset-btn"
                    disabled={alive === level.monsters.length}
                    onClick={() => resetLevelMonsters(level.level)}
                    title={`ปลุกมอนสเตอร์ทั้ง ${level.monsters.length} ตัวของด่าน ${level.level} กลับมา`}
                  >
                    ♻ รีเซ็ตมอนสเตอร์ ({level.monsters.length - alive} ตัวที่ตายแล้ว)
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2 className="admin-section-title">จัดการผู้ใช้</h2>
            <div className="admin-section-tools">
              <button type="button" className="practice-reroll-btn" onClick={() => setAdding((v) => !v)} disabled={busy}>
                {adding ? 'ปิดฟอร์ม' : '➕ เพิ่มผู้ใช้'}
              </button>
              <button type="button" className="practice-reroll-btn" onClick={() => void load()} disabled={loading || busy}>
                {loading ? 'กำลังโหลด...' : '🔄 รีเฟรช'}
              </button>
            </div>
          </div>

          <p className="admin-section-note">
            เพิ่ม / แก้ไข / ลบ / ระงับผู้ใช้ทุกคนในระบบ — ผู้ใช้ที่ถูกระงับจะยังล็อกอินได้แต่เล่นไม่ได้ และฐานข้อมูลจะปฏิเสธการเขียน
            ทุกอย่างของเขา (ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ)
          </p>

          {error && <p className="admin-error">{error}</p>}
          {notice && <p className="admin-notice">{notice}</p>}

          {adding && (
            <NewPlayerForm
              busy={busy}
              onCancel={() => setAdding(false)}
              onCreate={async (player) => {
                await run('เพิ่มผู้ใช้', () => adminCreatePlayer(player))
                setAdding(false)
              }}
            />
          )}

          {!error && loadedOnce && (
            <p className="admin-summary">
              ผู้ใช้ทั้งหมด {players.length} คน · พิชิตเกมแล้ว {conquerors} คน · ถูกระงับ {suspended} คน
            </p>
          )}

          {loading && players.length === 0 && <p className="admin-section-note">กำลังโหลดข้อมูลผู้เล่น...</p>}

          {players.length > 0 && (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ผู้เล่น</th>
                    <th>อีเมล</th>
                    <th>ด่าน</th>
                    <th>โหมด</th>
                    <th>HP</th>
                    <th>ATK</th>
                    <th>ปราบแล้ว</th>
                    <th>ไอเทม</th>
                    <th>สถานะ</th>
                    <th>อัปเดตล่าสุด</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((row) => (
                    <Fragment key={row.userId}>
                      <tr className={row.suspendedAt ? 'admin-row-suspended' : undefined}>
                        <td>
                          <span className="admin-cell-name">{playerLabel(row)}</span>
                          <span className="admin-cell-sub">
                            {row.characterClass ?? '—'}
                            {row.isAdmin && ' · 🛡 แอดมิน'}
                          </span>
                        </td>
                        <td className="admin-cell-email">{row.email ?? '—'}</td>
                        <td>{row.currentLevel}</td>
                        <td>{row.difficulty === 'hard' ? 'ยาก' : row.difficulty === 'easy' ? 'ง่าย' : '—'}</td>
                        <td>
                          {row.playerHp} / {PLAYER_MAX_HP}
                        </td>
                        <td>{row.attackPower}</td>
                        <td>{row.monstersDefeated}</td>
                        <td>{row.pickupsCollected}</td>
                        <td>
                          {row.suspendedAt ? (
                            <span className="admin-badge-suspended" title={row.suspendedReason ?? undefined}>
                              ⛔ ถูกระงับ
                            </span>
                          ) : row.isConqueror ? (
                            <span className="admin-badge-win">👑 พิชิตแล้ว ({row.bestScore})</span>
                          ) : (
                            'กำลังเล่น'
                          )}
                        </td>
                        <td className="admin-cell-time">{formatTime(row.updatedAt)}</td>
                        <td className="admin-row-actions">
                          <button
                            type="button"
                            className="admin-row-btn"
                            disabled={busy}
                            onClick={() => setEditing(editing === row.userId ? null : row.userId)}
                          >
                            ✏️ แก้ไข
                          </button>
                          <button
                            type="button"
                            className="admin-row-btn"
                            disabled={busy}
                            onClick={() =>
                              void run(row.suspendedAt ? 'ปลดระงับ' : 'ระงับผู้ใช้', async () => {
                                if (row.suspendedAt) return adminSetSuspended(row.userId, false)
                                // A suspension nobody wrote a reason for is one
                                // nobody can explain to the player later.
                                const reason = window.prompt(`เหตุผลที่ระงับ ${playerLabel(row)}`, '')
                                if (reason === null) throw new Error('ยกเลิกแล้ว')
                                return adminSetSuspended(row.userId, true, reason)
                              })
                            }
                          >
                            {row.suspendedAt ? '✅ ปลดระงับ' : '⛔ ระงับ'}
                          </button>
                          <button
                            type="button"
                            className="admin-row-btn admin-row-btn-danger"
                            disabled={busy}
                            onClick={() =>
                              void run('ลบผู้ใช้', async () => {
                                // Deleting an account takes its save, its
                                // scores and its login with it, and nothing
                                // here can put any of it back — hence typing
                                // the word rather than clicking OK.
                                const typed = window.prompt(
                                  `ลบบัญชี ${row.email ?? playerLabel(row)} ถาวร — เซฟ คะแนน และการล็อกอินจะหายทั้งหมด\nพิมพ์ ลบ เพื่อยืนยัน`,
                                  '',
                                )
                                if (typed?.trim() !== 'ลบ') throw new Error('ยกเลิกแล้ว')
                                return adminDeletePlayer(row.userId)
                              })
                            }
                          >
                            🗑 ลบ
                          </button>
                        </td>
                      </tr>
                      {editing === row.userId && (
                        <tr>
                          <td colSpan={11}>
                            <PlayerEditor
                              player={row}
                              busy={busy}
                              onClose={() => setEditing(null)}
                              onSave={async (edit) => {
                                await run('แก้ไขข้อมูล', () => adminUpdatePlayer(row.userId, edit))
                                setEditing(null)
                              }}
                              onToggleAdmin={() =>
                                void run(row.isAdmin ? 'ถอดสิทธิ์แอดมิน' : 'ให้สิทธิ์แอดมิน', async () => {
                                  if (!row.email) throw new Error('บัญชีนี้ไม่มีอีเมล')
                                  return adminSetAdmin(row.email, !row.isAdmin)
                                })
                              }
                              onResetPassword={() =>
                                void run('ส่งอีเมลรีเซ็ตรหัสผ่าน', async () => {
                                  if (!row.email) throw new Error('บัญชีนี้ไม่มีอีเมล')
                                  return adminSendPasswordReset(row.email)
                                })
                              }
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && loadedOnce && players.length === 0 && (
            <p className="admin-section-note">ยังไม่มีผู้ใช้ในระบบ</p>
          )}
        </section>
      </div>
    </div>
  )
}
