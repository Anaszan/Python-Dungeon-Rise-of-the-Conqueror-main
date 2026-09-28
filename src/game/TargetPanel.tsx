import { useEffect, useRef, useState, type CSSProperties } from 'react'
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
import { triggerCast } from '../character/cast'
import { SPELL_CAST_RANGE } from './constants'

// The smallest gap the panel leaves between itself and the monster it belongs
// to, in CSS pixels: wide enough to clear the monster's own nameplate (132px,
// centred on the same anchor).
const MIN_PANEL_GAP = 74

// ...and how much room the panel leaves around the player, measured from the
// centre of the screen — which is exactly where the player always is, because
// IsoCamera is locked to them. This is what stops the panel from parking on
// top of the character casting the spell, which at melee range the monster's
// own position alone will not do: two units away is only about ninety pixels
// on screen, less than the gap above.
const PLAYER_CLEARANCE = 96

// Last resort when neither side has room for the full clearance — the panel
// still has to stay on screen.
const EDGE_MARGIN = 8

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
  // Which side of the monster the panel hangs off. The camera is locked to the
  // player (IsoCamera), so the player is always dead centre of the screen —
  // which means the panel has to hang off the monster's *outer* side, pointing
  // away from centre, or it lands on top of the character it belongs to and
  // hides them casting.
  const [flipped, setFlipped] = useState(false)
  // How far from the monster the panel actually hangs, in CSS pixels. Handed
  // to the stylesheet as a custom property (see .target-panel) rather than a
  // full transform, so CSS keeps ownership of the layout and this only feeds
  // it the one number it cannot work out for itself.
  const [gap, setGap] = useState(MIN_PANEL_GAP)
  // Compared against the state above so the per-frame checks only re-render
  // when an answer changes, not on every frame it stays the same.
  const lastCheck = useRef({ inRange: true, distance: 0, flipped: false, gap: MIN_PANEL_GAP })
  const projected = useRef(new Vector3())

  const camera = useThree((s) => s.camera)
  const viewport = useThree((s) => s.size)

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

    // Same projection drei does for the anchor itself, turned into the one
    // question this needs answered: which side of the monster does the panel
    // go on?
    //
    // First choice is always the side away from the player (= away from screen
    // centre), so the character stays visible. That is overruled only when the
    // panel would not fit there, which is what stops a fight against the wall
    // at the edge of the screen from pushing the code boxes off it.
    projected.current.set(...monster.position).project(camera)
    const screenX = (projected.current.x * 0.5 + 0.5) * viewport.width
    const centre = viewport.width / 2
    // Kept in step with .target-panel in index.css.
    const panelWidth = Math.min(340, viewport.width * 0.4)

    // What each side would cost: the gap needed to clear the player, and the
    // biggest gap that still leaves the panel on screen.
    const wantLeft = Math.max(MIN_PANEL_GAP, screenX - (centre - PLAYER_CLEARANCE))
    const wantRight = Math.max(MIN_PANEL_GAP, centre + PLAYER_CLEARANCE - screenX)
    const roomLeft = screenX - panelWidth - EDGE_MARGIN
    const roomRight = viewport.width - screenX - panelWidth - EDGE_MARGIN

    // Away from the player first, and the other side only when this one cannot
    // hold the panel.
    const awayIsLeft = screenX < centre
    const flip = awayIsLeft ? wantLeft <= roomLeft || wantRight > roomRight : wantRight > roomRight && wantLeft <= roomLeft

    const nextGap = Math.round(
      Math.max(EDGE_MARGIN, Math.min(flip ? wantLeft : wantRight, flip ? roomLeft : roomRight)),
    )

    if (flip !== lastCheck.current.flipped) {
      lastCheck.current.flipped = flip
      setFlipped(flip)
    }
    if (nextGap !== lastCheck.current.gap) {
      lastCheck.current.gap = nextGap
      setGap(nextGap)
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
        style={{ '--panel-gap': `${gap}px` } as CSSProperties}
      >
        <div className="target-panel-head">
          <div className="target-panel-title">
            <span className="target-panel-name">{monster.name}</span>
            <span className="target-panel-badges">
              <span className="target-badge">ATK ของเจ้า {attackPower}</span>
              <span className="target-badge">เกราะ {monster.armor ?? '—'}</span>
              <span className="target-badge">{difficultyLabel(difficulty)}</span>
              {monster.boss && <span className="target-badge target-badge-boss">บอส · เขียนคาถาเองทั้งหมด</span>}
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
              isBoss={monster.boss === true}
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
              // Fired once per run that actually cast something, which is
              // exactly when the character should swing: the pose and the
              // damage land together, and a spell that fizzled on its โจทย์
              // plays no animation at all.
              onAttackCast={() => {
                startAttackCooldown()
                triggerCast('attack')
              }}
              onSkillCast={() => {
                startSkillCooldown()
                triggerCast('skill')
              }}
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
