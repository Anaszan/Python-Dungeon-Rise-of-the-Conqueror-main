import { useGameStore } from '../game/store'
import { bossIsSealed, bossOf, LEVELS } from '../game/levels'

// The corner banner: which floor this is, and how much of it is left.
//
// It counts *minions*, not every monster, because the boss is sealed away
// until they are all dead — counting a monster the player cannot find yet
// would read as a bug ("8/9 and nothing left in the level"). Once the floor is
// clear the count is replaced by the boss's name, which is the only hint the
// player gets that something new has walked into the dungeon.
export function LevelBanner() {
  const currentLevel = useGameStore((s) => s.currentLevel)
  const defeatedIds = useGameStore((s) => s.defeatedIds)
  const levelData = LEVELS[currentLevel - 1]

  const minions = levelData.monsters.filter((m) => !m.boss)
  const defeated = minions.filter((m) => defeatedIds.has(m.id)).length
  const boss = bossOf(levelData)
  const sealed = bossIsSealed(levelData, defeatedIds)

  return (
    <div className="level-banner">
      <span className="level-banner-name">
        ด่าน {currentLevel}: {levelData.name}
      </span>
      {sealed || !boss ? (
        <span className="level-banner-progress">
          {defeated} / {minions.length}
        </span>
      ) : (
        <span className="level-banner-boss">☠ {boss.name}</span>
      )}
    </div>
  )
}
