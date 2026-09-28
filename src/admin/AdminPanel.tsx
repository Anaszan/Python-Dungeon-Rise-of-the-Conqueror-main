import { useCallback, useEffect, useState } from 'react'
import { useAdminStore } from './adminStore'
import { fetchAdminPlayers, type AdminPlayerRow } from './adminApi'
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

// The admin console: jump to any level, and read every player's save.
//
// Both halves lean entirely on the server for permission. The warp buttons
// only ever move *this* account's save (the same store action the game itself
// uses), and the dashboard's data comes from an RPC that refuses anyone who is
// not on the allow-list — so a player who forces this component open sees an
// error and their own level buttons, not somebody else's data.
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
                <div
                  key={level.level}
                  className={`admin-warp-card${isCurrent ? ' admin-warp-btn-current' : ''}`}
                >
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
            <h2 className="admin-section-title">แดชบอร์ดผู้เล่น</h2>
            <button type="button" className="practice-reroll-btn" onClick={() => void load()} disabled={loading}>
              {loading ? 'กำลังโหลด...' : '🔄 รีเฟรช'}
            </button>
          </div>

          {error && <p className="admin-error">{error}</p>}

          {!error && loadedOnce && (
            <p className="admin-summary">
              ผู้เล่นทั้งหมด {players.length} คน · พิชิตเกมแล้ว {conquerors} คน
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
                  </tr>
                </thead>
                <tbody>
                  {players.map((row) => (
                    <tr key={row.userId}>
                      <td>
                        <span className="admin-cell-name">{playerLabel(row)}</span>
                        {row.characterClass && <span className="admin-cell-sub">{row.characterClass}</span>}
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
                        {row.isConqueror ? (
                          <span className="admin-badge-win">👑 พิชิตแล้ว ({row.bestScore})</span>
                        ) : (
                          'กำลังเล่น'
                        )}
                      </td>
                      <td className="admin-cell-time">{formatTime(row.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && loadedOnce && players.length === 0 && (
            <p className="admin-section-note">ยังไม่มีผู้เล่นคนไหนมีเซฟในระบบ</p>
          )}
        </section>
      </div>
    </div>
  )
}
