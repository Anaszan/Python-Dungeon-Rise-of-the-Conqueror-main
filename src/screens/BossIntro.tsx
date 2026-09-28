import { useEffect } from 'react'
import { useGameStore } from '../game/store'
import { ALL_MONSTERS, LEVELS } from '../game/levels'

// How long the entrance plays before handing the dungeon back. Long enough to
// read the name and see the thing, short enough that a player clearing six
// levels never sits through it wishing it would stop — and skippable anyway.
const REVEAL_MS = 4200

// The boss's entrance: the moment the floor is clear, the dungeon stops, the
// screen letterboxes, and the thing that was sealed behind the level walks in.
//
// Nothing here changes the fight. The seal has already broken in the store
// (damageMonster sets bossReveal), and this is the pause the player gets to
// look at what they just let out — CombatTicker and Player both treat
// bossReveal like a pause, so nothing swings and nobody walks while it runs.
export function BossIntro() {
  const bossReveal = useGameStore((s) => s.bossReveal)
  const currentLevel = useGameStore((s) => s.currentLevel)
  const endBossReveal = useGameStore((s) => s.endBossReveal)

  // Plays itself out. The timer is keyed to this particular reveal so a reset
  // (admin, restart) that clears it mid-cutscene does not leave a timer
  // pointed at the next one.
  useEffect(() => {
    if (!bossReveal) return
    const timer = setTimeout(endBossReveal, REVEAL_MS)
    return () => clearTimeout(timer)
  }, [bossReveal, endBossReveal])

  // Any key or click cuts it short: nobody should have to wait out a cutscene
  // they have seen before, least of all with a boss already on the floor.
  useEffect(() => {
    if (!bossReveal) return
    const skip = () => endBossReveal()
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
  }, [bossReveal, endBossReveal])

  if (!bossReveal) return null
  const boss = ALL_MONSTERS.find((m) => m.id === bossReveal)
  if (!boss) return null

  return (
    <div className="boss-intro">
      {/* Letterbox bars slide in from both edges — the cheapest, most legible
          "this is a cutscene" there is, and they leave the dungeon itself
          visible between them. */}
      <div className="boss-intro-bar boss-intro-bar-top" />
      <div className="boss-intro-bar boss-intro-bar-bottom" />

      <div className="boss-intro-content">
        <p className="boss-intro-eyebrow">ผนึกแตกแล้ว · ด่าน {currentLevel}</p>
        {boss.imageUrl && <img className="boss-intro-art" src={boss.imageUrl} alt={boss.name} />}
        <h2 className="boss-intro-name">{boss.name}</h2>
        <p className="boss-intro-sub">
          บอสประจำ{LEVELS[currentLevel - 1].name}ปรากฏตัว — คาถาปิดผนึกต้องเขียนเองทั้งหมด
        </p>
        <p className="boss-intro-skip">แตะหรือกดปุ่มใดก็ได้เพื่อข้าม</p>
      </div>
    </div>
  )
}
