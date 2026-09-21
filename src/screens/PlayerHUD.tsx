import { useGameStore } from '../game/store'
import { PLAYER_MAX_HP } from '../game/constants'

export function PlayerHUD() {
  const playerHp = useGameStore((s) => s.playerHp)
  const attackPower = useGameStore((s) => s.attackPower)
  const characterName = useGameStore((s) => s.characterName)
  const pct = Math.max(0, Math.min(100, (playerHp / PLAYER_MAX_HP) * 100))

  return (
    <div className="player-hud">
      {characterName && <div className="player-hud-name">{characterName}</div>}
      <div className="player-hp-track">
        <div className="player-hp-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="player-hud-labels">
        <span>HP {playerHp}/{PLAYER_MAX_HP}</span>
        <span>ดาเมจ {attackPower}</span>
      </div>
    </div>
  )
}
