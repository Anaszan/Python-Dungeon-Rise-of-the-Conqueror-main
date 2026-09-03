import { useEffect, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useGameStore } from './store'
import { ALL_MONSTERS } from './levels'
import { LESSONS } from './lessons'
import { SpellConsole } from './SpellConsole'
import { DEFAULT_DIFFICULTY, difficultyLabel } from './difficulty'
import { playerPosition } from './playerPosition'
import { distanceToPlayer, isInCastRange } from './combat'
import { spawnFloatingHit } from './combatFx'
import { SPELL_CAST_RANGE } from './constants'

// The code boxes, floating in the dungeon beside whatever the player has
// targeted. This is what replaced the full-screen battle screen: it opens on
// a click, it sits next to the monster it belongs to, and everything behind
// it — the level, the player, the other monsters, their swing timers — keeps
// running while the player types.
//
// Rendered inside the dungeon <Canvas> (see GameScene) because it is anchored
// to a point in the world: drei's <Html> projects the monster's position to
// the screen every frame and the panel rides along with it. On a phone the
// stylesheet takes that anchoring away and parks the panel along the bottom
// edge instead, where a 340px panel bolted to a monster would have been half
// off screen.
export function TargetPanel() {
  const phase = useGameStore((s) => s.phase)
  const paused = useGameStore((s) => s.paused)
  const targetId = useGameStore((s) => s.targetId)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const monsterHp = useGameStore((s) => s.monsterHp)
  const swing = useGameStore((s) => (targetId ? s.monsterSwing[targetId] : undefined))
  const playerHp = useGameStore((s) => s.playerHp)
  const attackPower = useGameStore((s) => s.attackPower)
  const skillCooldown = useGameStore((s) => s.skillCooldown)
  const attackCooldown = useGameStore((s) => s.attackCooldown)
  const difficulty = useGameStore((s) => s.difficulty) ?? DEFAULT_DIFFICULTY
  const damageMonster = useGameStore((s) => s.damageMonster)
  const startSkillCooldown = useGameStore((s) => s.startSkillCooldown)
  const startAttackCooldown = useGameStore((s) => s.startAttackCooldown)
  const clearTarget = useGameStore((s) => s.clearTarget)

  // Folded away, the panel keeps only its header — a way to watch a fight
  // (and keep the target) without a code editor covering the room.
  const [collapsed, setCollapsed] = useState(false)
  const [inRange, setInRange] = useState(true)
  const [distance, setDistance] = useState(0)
  // Which side of the monster the panel hangs off. A target over on the right
  // of the screen gets its panel on its left, so a fight near the edge never
  // pushes the code boxes off it.
  const [flipped, setFlipped] = useState(false)
  // Compared against the state above so the per-frame checks only re-render
  // when an answer changes, not on every frame it stays the same.
  const lastCheck = useRef({ inRange: true, distance: 0, flipped: false })
  const projected = useRef(new Vector3())

  const camera = useThree((s) => s.camera)

  const monster = targetId ? ALL_MONSTERS.find((m) => m.id === targetId) : undefined

  useFrame(() => {
    if (!monster) return
    const next = isInCastRange(monster, playerPosition.x, playerPosition.z)
    // Rounded to a tenth: the number on screen has one decimal, so anything
    // finer is a re-render nobody can see.
    const dist = Math.round(distanceToPlayer(monster, playerPosition.x, playerPosition.z) * 10) / 10
    if (next !== lastCheck.current.inRange) {
      lastCheck.current.inRange = next
      setInRange(next)
    }
    if (dist !== lastCheck.current.distance) {
      lastCheck.current.distance = dist
      setDistance(dist)
    }

    // Same projection drei does for the anchor itself, reduced to the one
    // question this needs answered: is the monster past the middle of the
    // screen? The 0.1 of hysteresis keeps a target hovering right on the line
    // from flipping the panel back and forth every frame.
    projected.current.set(...monster.position).project(camera)
    const flip = lastCheck.current.flipped ? projected.current.x > -0.1 : projected.current.x > 0.1
    if (flip !== lastCheck.current.flipped) {
      lastCheck.current.flipped = flip
      setFlipped(flip)
    }
  })

  // Escape drops the target before it reaches PauseButton, so the key reads
  // as "back out of what I'm doing" rather than always meaning "pause". With
  // nothing targeted it falls through and pauses the game as it always did.
  useEffect(() => {
    if (!targetId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      clearTarget()
    }
    // Capture phase: PauseButton listens on window too, and this has to win.
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [targetId, clearTarget])

  if (phase !== 'exploring' || paused || !monster || !targetId) return null

  const hp = monsterHp[targetId] ?? monster.maxHp
  const hpPct = Math.max(0, Math.min(100, (hp / monster.maxHp) * 100))
  const lesson = LESSONS[currentLevel - 1]

  // Damage is announced over the monster it landed on, which is the whole
  // point of fighting in the room instead of on a battle screen.
  const showDamage = (kind: 'attack' | 'skill') => (amount: number) => {
    damageMonster(amount)
    if (amount > 0) {
      spawnFloatingHit(kind, `-${amount}`, [monster.position[0], monster.position[1] + 0.6, monster.position[2]])
    }
  }

  return (
    <Html
      position={[monster.position[0], monster.position[1] + 0.4, monster.position[2]]}
      zIndexRange={[40, 32]}
      wrapperClass="target-panel-wrapper"
      className="target-panel-inner"
    >
      <div
        className={`target-panel${flipped ? ' target-panel-flipped' : ''}${collapsed ? ' target-panel-collapsed' : ''}`}
      >
        <div className="target-panel-head">
          <div className="target-panel-title">
            <span className="target-panel-name">{monster.name}</span>
            <span className="target-panel-badges">
              <span className="target-badge">ATK ของเจ้า {attackPower}</span>
              <span className="target-badge">เกราะ {monster.armor ?? '—'}</span>
              <span className="target-badge">{difficultyLabel(difficulty)}</span>
            </span>
          </div>
          <div className="target-panel-actions">
            <button
              type="button"
              className="target-panel-btn"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'กางแผงคาถา' : 'พับแผงคาถา'}
            >
              {collapsed ? '▴' : '▾'}
            </button>
            <button
              type="button"
              className="target-panel-btn"
              onClick={clearTarget}
              title="ปลดล็อกเป้า (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="target-panel-vitals">
          <span className="nameplate-hp-track target-panel-hp">
            <span className="nameplate-hp-fill" style={{ width: `${hpPct}%` }} />
          </span>
          <span className="target-panel-hp-text">
            {hp} / {monster.maxHp} HP
          </span>
        </div>

        {swing != null && (
          <p className="target-panel-swing">
            ⚔ {monster.name} จะฟาดใส่เจ้าในอีก {swing.toFixed(1)} วินาที (−{monster.attackDamage} HP) — ถอยออกไปให้พ้นระยะก็หยุดตีได้
          </p>
        )}

        {!collapsed && (
          <>
            {!inRange && (
              <p className="target-panel-warning">
                ไกลเกินไป ({distance.toFixed(1)} / {SPELL_CAST_RANGE} ช่อง) — เดินเข้าไปใกล้อีกหน่อยแล้วคาถาจะถึงตัวมัน
              </p>
            )}
            <SpellConsole
              key={targetId}
              compact
              lesson={lesson}
              difficulty={difficulty}
              monsterId={targetId}
              monsterHp={hp}
              monsterName={monster.name}
              monsterArmor={monster.armor ?? 999}
              playerHp={playerHp}
              playerAtk={attackPower}
              skillCooldown={skillCooldown}
              attackCooldown={attackCooldown}
              blockedReason={inRange ? null : 'คาถาไปไม่ถึง — เข้าใกล้อีกหน่อย'}
              onAttack={showDamage('attack')}
              onSkillDamage={showDamage('skill')}
              onAttackCast={startAttackCooldown}
              onSkillCast={startSkillCooldown}
            />
            <p className="target-panel-hint">
              คลิกมอนตัวอื่นเพื่อเปลี่ยนเป้า · Tab สลับเป้าใกล้ตัว · Esc ปลดล็อก · WASD เดินหนีได้ตลอดเวลา
            </p>
          </>
        )}
      </div>
    </Html>
  )
}
