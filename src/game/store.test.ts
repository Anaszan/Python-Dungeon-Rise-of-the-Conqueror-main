import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ALL_MONSTERS, LEVELS } from './levels'
import { PLAYER_MAX_HP, BASE_ATTACK_POWER } from './constants'
import { DEFAULT_GENDER, DEFAULT_SKIN_COLOR } from '../character/characterOptions'

// The store persists progress to Supabase on nearly every action — none of
// that belongs in a unit test for the state machine, so every module on
// that path is stubbed out.
vi.mock('../audio/soundEngine', () => ({
  playAttackImpact: vi.fn(),
  playPlayerHurt: vi.fn(),
}))
vi.mock('../auth/authStore', () => ({
  useAuthStore: { getState: () => ({ session: null }) },
}))
vi.mock('./persistence', () => ({
  saveProgress: vi.fn(),
  submitScore: vi.fn(),
}))

const { useGameStore } = await import('./store')

function defeatAllMonstersInLevel(levelIndex: number) {
  const ids = LEVELS[levelIndex].monsters.map((m) => m.id)
  useGameStore.setState({ defeatedIds: new Set(ids) })
  return ids
}

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().resetSave()
  })

  it('starts with the documented defaults', () => {
    const s = useGameStore.getState()
    expect(s.phase).toBe('exploring')
    expect(s.currentLevel).toBe(1)
    expect(s.playerHp).toBe(PLAYER_MAX_HP)
    expect(s.attackPower).toBe(BASE_ATTACK_POWER)
    expect(s.characterClass).toBeNull()
    expect(s.gender).toBe(DEFAULT_GENDER)
    expect(s.characterName).toBeNull()
    expect(s.paused).toBe(false)
  })

  it('enterCombat switches to combat and seeds full HP for a new monster', () => {
    useGameStore.getState().enterCombat({ id: 'slime-1', name: 'Slime', maxHp: 30, attackInterval: 10 })
    const s = useGameStore.getState()
    expect(s.phase).toBe('combat')
    expect(s.activeMonsterId).toBe('slime-1')
    expect(s.monsterHp['slime-1']).toBe(30)
  })

  it('damageMonster clamps at 0 and marks the monster defeated', () => {
    useGameStore.getState().enterCombat({ id: 'slime-1', name: 'Slime', maxHp: 30, attackInterval: 10 })
    useGameStore.getState().damageMonster(999)
    const s = useGameStore.getState()
    expect(s.monsterHp['slime-1']).toBe(0)
    expect(s.defeatedIds.has('slime-1')).toBe(true)
  })

  it('damagePlayer clamps at 0 and moves the phase to gameover', () => {
    useGameStore.getState().damagePlayer(PLAYER_MAX_HP + 50)
    const s = useGameStore.getState()
    expect(s.playerHp).toBe(0)
    expect(s.phase).toBe('gameover')
  })

  it('healPlayer clamps at PLAYER_MAX_HP', () => {
    useGameStore.getState().damagePlayer(20)
    useGameStore.getState().healPlayer(999)
    expect(useGameStore.getState().playerHp).toBe(PLAYER_MAX_HP)
  })

  it('exitCombat opens the end-of-level exam once every monster in the current level is defeated', () => {
    const ids = defeatAllMonstersInLevel(0)
    useGameStore.setState({ currentLevel: 1, activeMonsterId: ids[ids.length - 1], playerHp: 100 })

    useGameStore.getState().exitCombat()

    const s = useGameStore.getState()
    expect(s.phase).toBe('exam')
    expect(s.currentLevel).toBe(1) // still level 1 — the exam has not been passed yet
    expect(s.activeMonsterId).toBeNull()
  })

  it('passLevelExam is what actually advances the level', () => {
    const ids = defeatAllMonstersInLevel(0)
    useGameStore.setState({ currentLevel: 1, activeMonsterId: ids[ids.length - 1], playerHp: 100 })
    useGameStore.getState().exitCombat()

    useGameStore.getState().passLevelExam()

    const s = useGameStore.getState()
    expect(s.currentLevel).toBe(2)
    expect(s.phase).toBe('exploring')
  })

  it('passLevelExam does nothing outside the exam phase', () => {
    useGameStore.setState({ currentLevel: 1, phase: 'exploring' })

    useGameStore.getState().passLevelExam()

    expect(useGameStore.getState().currentLevel).toBe(1)
    expect(useGameStore.getState().phase).toBe('exploring')
  })

  it('the final level reaches victory through its exam, not around it', () => {
    const lastLevelIndex = LEVELS.length - 1
    const ids = defeatAllMonstersInLevel(lastLevelIndex)
    useGameStore.setState({ currentLevel: LEVELS.length, activeMonsterId: ids[ids.length - 1], playerHp: 100 })

    useGameStore.getState().exitCombat()
    expect(useGameStore.getState().phase).toBe('exam')

    useGameStore.getState().passLevelExam()
    expect(useGameStore.getState().phase).toBe('victory')
  })

  it('exitCombat treats an undefeated monster as a flee, not a level clear', () => {
    useGameStore.getState().enterCombat({ id: 'slime-1', name: 'Slime', maxHp: 30, attackInterval: 10 })
    useGameStore.setState({ playerHp: 100 })

    useGameStore.getState().exitCombat()

    const s = useGameStore.getState()
    expect(s.phase).toBe('exploring')
    expect(s.currentLevel).toBe(1)
    expect(s.fledMonsterId).toBe('slime-1')
  })

  it('exitCombat is a no-op while the player is already dead', () => {
    useGameStore.setState({ playerHp: 0, activeMonsterId: 'slime-1', phase: 'gameover' })

    useGameStore.getState().exitCombat()

    expect(useGameStore.getState().activeMonsterId).toBe('slime-1')
    expect(useGameStore.getState().phase).toBe('gameover')
  })

  it('confirmCharacter stores the chosen class, gender, skin, and name', () => {
    useGameStore.getState().confirmCharacter('wizard', 'female', '#abcdef', 'Gandalf')
    const s = useGameStore.getState()
    expect(s.characterClass).toBe('wizard')
    expect(s.gender).toBe('female')
    expect(s.skinColor).toBe('#abcdef')
    expect(s.characterName).toBe('Gandalf')
  })

  it('hydrateSave derives the exam phase from a save whose level has no monsters left', () => {
    useGameStore.getState().hydrateSave({
      defeatedMonsterIds: LEVELS[0].monsters.map((m) => m.id),
      playerHp: 120,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: [],
      currentLevel: 1,
      skillCooldown: 0,
      characterClass: 'wizard',
      gender: 'male',
      skinColor: DEFAULT_SKIN_COLOR,
      characterName: 'Rin',
    })
    const s = useGameStore.getState()
    expect(s.phase).toBe('exam')
    expect(s.currentLevel).toBe(1)
  })

  it('hydrateSave derives gameover from a save persisted at 0 HP', () => {
    useGameStore.getState().hydrateSave({
      defeatedMonsterIds: ['slime-1'],
      playerHp: 0,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: [],
      currentLevel: 2,
      skillCooldown: 0,
      characterClass: 'rogue',
      gender: 'female',
      skinColor: DEFAULT_SKIN_COLOR,
      characterName: 'Shade',
    })
    const s = useGameStore.getState()
    expect(s.phase).toBe('gameover')
    expect(s.defeatedIds.has('slime-1')).toBe(true)
    expect(s.currentLevel).toBe(2)
  })

  it('hydrateSave derives exploring from a save with HP remaining', () => {
    useGameStore.getState().hydrateSave({
      defeatedMonsterIds: [],
      playerHp: 50,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: [],
      currentLevel: 1,
      skillCooldown: 0,
      characterClass: null,
      gender: DEFAULT_GENDER,
      skinColor: DEFAULT_SKIN_COLOR,
      characterName: null,
    })
    expect(useGameStore.getState().phase).toBe('exploring')
  })

  it('setPaused toggles the paused flag without touching phase', () => {
    useGameStore.getState().enterCombat({ id: 'slime-1', name: 'Slime', maxHp: 30, attackInterval: 10 })
    useGameStore.getState().setPaused(true)
    expect(useGameStore.getState().paused).toBe(true)
    expect(useGameStore.getState().phase).toBe('combat')
    useGameStore.getState().setPaused(false)
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('restart resets progress but keeps the chosen character, and clears any stuck pause', () => {
    useGameStore.getState().confirmCharacter('cleric', 'female', '#111111', 'Elora')
    useGameStore.setState({ currentLevel: 3, playerHp: 10, paused: true })

    useGameStore.getState().restart()

    const s = useGameStore.getState()
    expect(s.currentLevel).toBe(1)
    expect(s.playerHp).toBe(PLAYER_MAX_HP)
    expect(s.paused).toBe(false)
    expect(s.characterClass).toBe('cleric')
    expect(s.gender).toBe('female')
    expect(s.characterName).toBe('Elora')
  })

  it('resetSave clears the chosen character and any stuck pause', () => {
    useGameStore.getState().confirmCharacter('cleric', 'female', '#111111', 'Elora')
    useGameStore.setState({ paused: true })

    useGameStore.getState().resetSave()

    const s = useGameStore.getState()
    expect(s.characterClass).toBeNull()
    expect(s.gender).toBe(DEFAULT_GENDER)
    expect(s.characterName).toBeNull()
    expect(s.paused).toBe(false)
  })
})

// Driving the real store through the whole campaign the way a player would:
// walk into every monster of a level, kill it, leave the fight, sit the
// end-of-level exam, and expect the game to hand out the next level — and the
// victory screen after the last one. The individual exitCombat cases above
// each pin one branch; this is the check that all six levels really do chain
// together end to end.
function fightAndDefeat(monster: (typeof ALL_MONSTERS)[number]) {
  const store = useGameStore.getState()
  store.enterCombat({
    id: monster.id,
    name: monster.name,
    maxHp: monster.maxHp,
    attackInterval: monster.attackInterval,
  })
  expect(useGameStore.getState().phase, `entering ${monster.name}`).toBe('combat')
  useGameStore.getState().damageMonster(monster.maxHp)
  expect(useGameStore.getState().monsterHp[monster.id], `${monster.name} HP`).toBe(0)
  useGameStore.getState().exitCombat()
}

// Stands in for the player actually writing and passing the level's exam in
// LevelExamOverlay — the store side of that is just this one call.
function sitAndPassExam(levelNumber: number) {
  expect(useGameStore.getState().phase, `exam for level ${levelNumber}`).toBe('exam')
  useGameStore.getState().passLevelExam()
}

describe('level completion', () => {
  beforeEach(() => {
    useGameStore.getState().resetSave()
  })

  it('clears all six levels in order and ends on the victory screen', () => {
    for (const level of LEVELS) {
      expect(useGameStore.getState().currentLevel, `start of level ${level.level}`).toBe(level.level)
      expect(useGameStore.getState().phase, `start of level ${level.level}`).toBe('exploring')

      level.monsters.forEach(fightAndDefeat)
      sitAndPassExam(level.level)
    }

    const s = useGameStore.getState()
    expect(s.phase).toBe('victory')
    expect(s.currentLevel).toBe(LEVELS.length)
    expect(s.defeatedIds.size).toBe(ALL_MONSTERS.length)
  })

  it.each(LEVELS)('level $level does not open the exam while one monster is still alive', (level) => {
    useGameStore.setState({ currentLevel: level.level })

    // Everything but the last monster in the level.
    level.monsters.slice(0, -1).forEach(fightAndDefeat)
    expect(useGameStore.getState().currentLevel, 'advanced early').toBe(level.level)
    expect(useGameStore.getState().phase).toBe('exploring')

    // And now the straggler, which is what should actually open the exam.
    const last = level.monsters[level.monsters.length - 1]
    fightAndDefeat(last)
    expect(useGameStore.getState().phase, 'exam should be open now').toBe('exam')
    expect(useGameStore.getState().currentLevel, 'level moved before the exam').toBe(level.level)

    sitAndPassExam(level.level)
    const s = useGameStore.getState()
    if (level.level === LEVELS.length) expect(s.phase).toBe('victory')
    else expect(s.currentLevel).toBe(level.level + 1)
  })

  it('treats fleeing the final monster as leaving the level unfinished', () => {
    const level = LEVELS[0]
    level.monsters.slice(0, -1).forEach(fightAndDefeat)

    const last = level.monsters[level.monsters.length - 1]
    useGameStore.getState().enterCombat({
      id: last.id,
      name: last.name,
      maxHp: last.maxHp,
      attackInterval: last.attackInterval,
    })
    useGameStore.getState().exitCombat() // fled, never killed it

    const s = useGameStore.getState()
    expect(s.currentLevel).toBe(1)
    expect(s.fledMonsterId).toBe(last.id)
  })
})
