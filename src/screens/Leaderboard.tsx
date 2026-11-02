import { useState } from 'react'
import { fetchProgressLeaderboard, type ProgressLeaderboardRow } from '../game/persistence'
import { LEVELS } from '../game/levels'

export function Leaderboard() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ProgressLeaderboardRow[]>([])

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setLoading(true)
    setRows(await fetchProgressLeaderboard())
    setLoading(false)
  }

  return (
    <>
      {/* See LogoutButton: the label is separable so a phone can show the
          icon alone. */}
      <button className="leaderboard-toggle" onClick={toggle} title="อันดับ" aria-label="อันดับ">
        🏆<span className="hud-btn-label"> อันดับ</span>
      </button>
      {open && (
        <div className="screen-overlay leaderboard-overlay" onClick={toggle}>
          <div className="auth-panel" onClick={(e) => e.stopPropagation()}>
            <h1>อันดับผู้เล่น</h1>
            {loading ? (
              <p>กำลังโหลด...</p>
            ) : rows.length === 0 ? (
              <p>ยังไม่มีผู้เล่น</p>
            ) : (
              <ol className="leaderboard-list">
                {rows.map((row, i) => {
                  const name = row.display_name ?? row.character_name ?? 'ผู้เล่นนิรนาม'
                  const levelName = LEVELS[row.current_level - 1]?.name
                  return (
                    <li key={i} className={row.is_conqueror ? 'leaderboard-row-conqueror' : undefined}>
                      {row.is_conqueror ? (
                        <>
                          👑 {name} — ผู้พิชิตดันเจี้ยน ({row.monsters_defeated} ตัว)
                        </>
                      ) : (
                        <>
                          {name} — ด่าน {row.current_level}/{LEVELS.length}
                          {levelName ? `: ${levelName}` : ''}
                        </>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
            <button type="button" onClick={toggle}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </>
  )
}
