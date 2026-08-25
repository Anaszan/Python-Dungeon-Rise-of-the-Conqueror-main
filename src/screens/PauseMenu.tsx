import { useGameStore } from '../game/store'
import { useAuthStore } from '../auth/authStore'
import { VolumeSettings } from '../audio/VolumeSettings'
import { ProfileEditor } from './ProfileEditor'
import { DIFFICULTY_OPTIONS } from '../game/difficulty'

export function PauseMenu() {
  const paused = useGameStore((s) => s.paused)
  const setPaused = useGameStore((s) => s.setPaused)
  const difficulty = useGameStore((s) => s.difficulty)
  const setDifficulty = useGameStore((s) => s.setDifficulty)
  const signOut = useAuthStore((s) => s.signOut)

  if (!paused) return null

  return (
    <div className="screen-overlay pause-overlay">
      <div className="customize-panel pause-panel">
        <h1>หยุดชั่วคราว</h1>

        <div className="customize-section">
          <p className="customize-section-label">เสียง</p>
          <VolumeSettings />
        </div>

        {/* Changing this mid-run is safe: nothing about the current fight is
            reset — the next code box to render simply re-seeds itself from the
            new mode (see store.setDifficulty). */}
        <div className="customize-section">
          <p className="customize-section-label">ระดับความท้าทายของโค้ด</p>
          <div className="difficulty-switch">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`difficulty-switch-btn${option.id === difficulty ? ' difficulty-switch-btn-active' : ''}`}
                onClick={() => setDifficulty(option.id)}
                aria-pressed={option.id === difficulty}
              >
                <span className="difficulty-switch-name">{option.name}</span>
                <span className="difficulty-switch-tagline">{option.tagline}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="customize-section">
          <ProfileEditor />
        </div>

        <button type="button" className="customize-confirm" onClick={() => setPaused(false)}>
          เล่นต่อ
        </button>
        <button type="button" className="pause-logout-btn" onClick={() => signOut()}>
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
