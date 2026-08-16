import { useEffect, useRef, useState } from 'react'
import { useGameStore } from './store'
import { ALL_MONSTERS, LEVELS } from './levels'
import { LESSONS } from './lessons'
import { PLAYER_MAX_HP } from './constants'
import { Mentor } from '../components/Mentor'
import { SpellConsole } from './SpellConsole'
import { DEFAULT_CHARACTER_CLASS } from '../character/characterOptions'
import { CharacterPortrait } from '../character/CharacterPortrait'

// Pokemon-style HP bars read their state from color before you parse the
// numbers: green while healthy, amber once it bites, red in the danger zone.
function hpTone(pct: number) {
  if (pct > 50) return 'hp-ok'
  if (pct > 20) return 'hp-warn'
  return 'hp-danger'
}

export function CombatOverlay() {
  const phase = useGameStore((s) => s.phase)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const activeMonsterId = useGameStore((s) => s.activeMonsterId)
  const monsterHp = useGameStore((s) => s.monsterHp)
  const defeatedIds = useGameStore((s) => s.defeatedIds)
  const playerHp = useGameStore((s) => s.playerHp)
  const attackPower = useGameStore((s) => s.attackPower)
  const skillCooldown = useGameStore((s) => s.skillCooldown)
  const attackCooldown = useGameStore((s) => s.attackCooldown)
  const monsterAttackCountdown = useGameStore((s) => s.monsterAttackCountdown)
  const characterClass = useGameStore((s) => s.characterClass) ?? DEFAULT_CHARACTER_CLASS
  const gender = useGameStore((s) => s.gender)
  const skinColor = useGameStore((s) => s.skinColor)
  const damageMonster = useGameStore((s) => s.damageMonster)
  const startSkillCooldown = useGameStore((s) => s.startSkillCooldown)
  const startAttackCooldown = useGameStore((s) => s.startAttackCooldown)
  const exitCombat = useGameStore((s) => s.exitCombat)

  const monster = activeMonsterId ? ALL_MONSTERS.find((m) => m.id === activeMonsterId) : undefined
  const hp = monster ? (monsterHp[monster.id] ?? monster.maxHp) : 0

  // Briefly flash the monster portrait / shake the panel whenever a hit
  // actually lands, so damage reads as an event rather than a silent number
  // change. Guarded against firing on the render where the monster itself
  // changes (new fight, HP reset to full).
  const [monsterHit, setMonsterHit] = useState(false)
  const [playerHit, setPlayerHit] = useState(false)
  const prevMonsterId = useRef(activeMonsterId)
  const prevHp = useRef(hp)
  const prevPlayerHp = useRef(playerHp)

  useEffect(() => {
    const monsterChanged = prevMonsterId.current !== activeMonsterId
    prevMonsterId.current = activeMonsterId
    if (monsterChanged) {
      prevHp.current = hp
      return
    }
    if (hp < prevHp.current) {
      setMonsterHit(true)
      const t = setTimeout(() => setMonsterHit(false), 300)
      prevHp.current = hp
      return () => clearTimeout(t)
    }
    prevHp.current = hp
  }, [hp, activeMonsterId])

  useEffect(() => {
    if (playerHp < prevPlayerHp.current) {
      setPlayerHit(true)
      const t = setTimeout(() => setPlayerHit(false), 300)
      prevPlayerHp.current = playerHp
      return () => clearTimeout(t)
    }
    prevPlayerHp.current = playerHp
  }, [playerHp])

  if (phase !== 'combat' || !activeMonsterId) return null
  if (!monster) return null

  const hpPct = Math.max(0, Math.min(100, (hp / monster.maxHp) * 100))
  const playerHpPct = Math.max(0, Math.min(100, (playerHp / PLAYER_MAX_HP) * 100))
  const defeated = hp <= 0

  const levelData = LEVELS[currentLevel - 1]
  const levelCleared = defeated && levelData.monsters.every((m) => defeatedIds.has(m.id))
  const isLastLevel = currentLevel === LEVELS.length
  const lesson = LESSONS[currentLevel - 1]

  return (
    <div className="combat-overlay">
      <div className={`battle-screen${playerHit ? ' panel-shake' : ''}`}>
        {/* Pokemon's battle framing: each combatant's status card sits
            diagonally opposite its own sprite, so neither card covers the
            other side's art. */}
        <div className="battle-stage">
          <div className="battle-info battle-info-enemy">
            <p className="battle-info-name">{monster.name}</p>
            <div className="hp-bar-track">
              <div className={`hp-bar-fill ${hpTone(hpPct)}`} style={{ width: `${hpPct}%` }} />
            </div>
            <p className="battle-info-hp">
              {hp} / {monster.maxHp} HP
            </p>
            {!defeated && (
              <div className="battle-attack-timer">
                <p className="battle-attack-timer-label">
                  โจมตีในอีก {Math.ceil(monsterAttackCountdown)} วินาที
                </p>
                <div className="battle-attack-timer-track">
                  <div
                    className="battle-attack-timer-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, (monsterAttackCountdown / monster.attackInterval) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div
            className={`battle-sprite battle-sprite-enemy${monsterHit ? ' recoil' : ''}${playerHit ? ' lunge' : ''}${defeated ? ' fainted' : ''}`}
          >
            <div className="battle-platform" />
            {monster.imageUrl ? (
              <img src={monster.imageUrl} alt={monster.name} />
            ) : (
              <div className="battle-sprite-fallback" style={{ background: monster.color }} />
            )}
          </div>

          <div
            className={`battle-sprite battle-sprite-player${playerHit ? ' recoil' : ''}${monsterHit ? ' lunge' : ''}`}
          >
            <div className="battle-platform" />
            <CharacterPortrait appearance={{ characterClass, gender, skinColor }} view="back" />
          </div>

          <div className="battle-info battle-info-player">
            <p className="battle-info-name">คุณ</p>
            <div className="hp-bar-track">
              <div className={`hp-bar-fill ${hpTone(playerHpPct)}`} style={{ width: `${playerHpPct}%` }} />
            </div>
            <p className="battle-info-hp">
              {playerHp} / {PLAYER_MAX_HP} HP
            </p>
          </div>
        </div>

        <div className="battle-command-box">
          {defeated ? (
            <div className="battle-result">
              <p className="combat-message">
                {levelCleared
                  ? isLastLevel
                    ? 'มอนสเตอร์ด่านสุดท้ายหมดแล้ว! เหลือแค่บทสอบปิดผนึกดันเจี้ยน'
                    : `มอนสเตอร์ในด่าน ${currentLevel} หมดแล้ว! ประตูด่านต่อไปยังปิดผนึกอยู่ — ต้องผ่านบทสอบก่อน`
                  : `${monster.name} ถูกปราบแล้ว!`}
              </p>
              <button onClick={exitCombat}>{levelCleared ? 'ไปบทสอบจบด่าน' : 'Continue'}</button>
            </div>
          ) : (
            <>
              <Mentor
                key={activeMonsterId}
                compact
                lines={[
                  `เจ้าพบ ${monster.name}! ใช้กล่อง "โจมตี" กับ "สกิลพิเศษ" ด้านล่าง ทั้งสองต้องเขียนโค้ด Python เองทั้งคู่`,
                  `ทบทวนบทที่ ${lesson.chapter} (${lesson.chapterTitle}) ได้จากคำใบ้ในโค้ดตั้งต้น หรือย้อนกลับไปฟังคำสอนตอนเข้าด่านนี้ใหม่อีกครั้ง`,
                  'ทั้งสองคาถามีช่วงพักพลัง (คูลดาวน์) หลังร่ายทุกครั้ง — โจมตีพักสั้นกว่า สกิลพิเศษพักนานกว่าแต่แรงกว่า',
                ]}
              />
              <SpellConsole
                lesson={lesson}
                monsterId={activeMonsterId}
                monsterHp={hp}
                monsterName={monster.name}
                monsterArmor={monster.armor ?? 999}
                playerHp={playerHp}
                playerAtk={attackPower}
                skillCooldown={skillCooldown}
                attackCooldown={attackCooldown}
                onAttack={damageMonster}
                onSkillDamage={damageMonster}
                onAttackCast={startAttackCooldown}
                onSkillCast={startSkillCooldown}
              />
              <div className="combat-actions combat-actions-secondary">
                <button onClick={exitCombat}>Flee</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
