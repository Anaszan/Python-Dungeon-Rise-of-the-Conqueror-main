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
// Signed in, so the tests below exercise the same persistence path a real
// session takes rather than short-circuiting on a missing user id.
vi.mock('../auth/authStore', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'test-user' } } }) },
}))
vi.mock('./persistence', () => ({
  // Mirrors the real signature: callers that wait on it are told the write
  // landed.
  saveProgress: vi.fn(() => Promise.resolve(true)),
  submitScore: vi.fn(),
}))

const { useGameStore } = await import('./store')
const { saveProgress } = await import('./persistence')

// Every monster of a level dead except the last, without going through
// combat — the setup for testing what the *killing blow* does.
function killAllButLastInLevel(levelIndex: number) {
  const monsters = LEVELS[levelIndex].monsters
  useGameStore.setState({
    currentLevel: levelIndex + 1,
    defeatedIds: new Set(monsters.slice(0, -1).map((m) => m.id)),
    playerHp: 100,
  })
}

// Every minion dead and the boss still standing: the state in which the boss
// has just broken out of its seal and is the only thing left to fight.
function clearMinionsOf(levelIndex: number) {
  const monsters = LEVELS[levelIndex].monsters
  useGameStore.setState({
    currentLevel: levelIndex + 1,
    defeatedIds: new Set(monsters.filter((m) => !m.boss).map((m) => m.id)),
    playerHp: 100,
    phase: 'exploring',
  })
  return monsters.find((m) => m.boss)!
}

// And the kill that ends the level: the boss, which is the only way onward
// now that the exam door is gone.
function clearLevel(levelIndex: number) {
  const boss = clearMinionsOf(levelIndex)
  useGameStore.getState().setTarget(boss.id)
  useGameStore.getState().damageMonster(boss.maxHp)
}

const loadedSave = {
  defeatedMonsterIds: ['slime-1'],
  playerHp: 120,
  attackPower: BASE_ATTACK_POWER,
  collectedPickupIds: [],
  currentLevel: 2,
  skillCooldown: 0,
  characterClass: 'wizard' as const,
  gender: DEFAULT_GENDER,
  skinColor: DEFAULT_SKIN_COLOR,
  shirtColor: null,
  characterName: 'Rin',
  difficulty: 'easy' as const,
  lastPosition: null,
}

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().resetSave()
    vi.mocked(saveProgress).mockClear()
  })

  // A save is only ever written on top of one that was read first. Without
  // this, an account whose save failed to load would look like a brand-new
  // player — level 1, no character — and the first thing that touched the
  // store would write that over hours of real progress.
  describe('writing back to Supabase', () => {
    it('writes nothing until this account’s own save has been read', () => {
      useGameStore.getState().damagePlayer(10)
      useGameStore.getState().healPlayer(5)
      useGameStore.getState().confirmCharacter('wizard', 'female', '#abcdef', null, 'Rin')

      expect(saveProgress).not.toHaveBeenCalled()
    })

    it('writes once a save has been hydrated', () => {
      useGameStore.getState().hydrateSave(loadedSave)

      useGameStore.getState().damagePlayer(10)

      expect(saveProgress).toHaveBeenCalledTimes(1)
      expect(vi.mocked(saveProgress).mock.calls[0][1]).toMatchObject({
        currentLevel: 2,
        characterName: 'Rin',
        playerHp: 110,
      })
    })
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

  describe('the target lock', () => {
    const slime = ALL_MONSTERS.find((m) => m.id === 'slime-1')!

    it('seeds full HP the first time a monster is targeted, and never re-seeds it', () => {
      useGameStore.getState().setTarget('slime-1')
      expect(useGameStore.getState().targetId).toBe('slime-1')
      expect(useGameStore.getState().monsterHp['slime-1']).toBe(slime.maxHp)

      // Wound it, look away, look back: the wound is still there. Fights are
      // interruptible now, so a monster's HP has to survive losing the lock.
      useGameStore.getState().damageMonster(10)
      useGameStore.getState().setTarget(null)
      useGameStore.getState().setTarget('slime-1')
      expect(useGameStore.getState().monsterHp['slime-1']).toBe(slime.maxHp - 10)
    })

    it('never locks onto a corpse, or onto something that is not a monster', () => {
      useGameStore.setState({ defeatedIds: new Set(['slime-1']) })
      useGameStore.getState().setTarget('slime-1')
      expect(useGameStore.getState().targetId).toBeNull()

      useGameStore.getState().setTarget('not-a-monster')
      expect(useGameStore.getState().targetId).toBeNull()
    })

    // The game-over and victory screens are modal. A target lock left open
    // under one would put a live code console on top of them.
    it('refuses to lock while anything but the dungeon is on screen', () => {
      useGameStore.setState({ phase: 'gameover' })
      useGameStore.getState().setTarget('slime-1')
      expect(useGameStore.getState().targetId).toBeNull()
    })

    it('lets go of the target the instant it dies', () => {
      useGameStore.getState().setTarget('slime-1')
      useGameStore.getState().damageMonster(999)

      const s = useGameStore.getState()
      expect(s.monsterHp['slime-1']).toBe(0)
      expect(s.defeatedIds.has('slime-1')).toBe(true)
      expect(s.targetId, 'a corpse is not a target').toBeNull()
    })

    it('has nothing to damage with no target locked', () => {
      useGameStore.getState().damageMonster(999)
      expect(useGameStore.getState().defeatedIds.size).toBe(0)
    })

    // Letting go on purpose has to stick, or dismissing the panel while a
    // monster is chewing on you would be undone by the auto-lock on the next
    // frame. Everything else that drops a target leaves the auto-lock armed.
    describe('deliberately letting go', () => {
      it('tells the auto-lock to leave the player alone', () => {
        useGameStore.getState().setTarget('slime-1')
        useGameStore.getState().clearTarget()

        expect(useGameStore.getState().targetId).toBeNull()
        expect(useGameStore.getState().suppressAutoTarget).toBe(true)
      })

      it('is undone by picking a target again', () => {
        useGameStore.getState().clearTarget()
        useGameStore.getState().setTarget('slime-1')

        expect(useGameStore.getState().suppressAutoTarget).toBe(false)
      })

      it('is undone by walking clear of everything', () => {
        useGameStore.getState().clearTarget()
        useGameStore.getState().allowAutoTarget()

        expect(useGameStore.getState().suppressAutoTarget).toBe(false)
      })

      it('does not survive dying, a level, or a warp', () => {
        useGameStore.getState().clearTarget()
        useGameStore.getState().damagePlayer(PLAYER_MAX_HP)
        expect(useGameStore.getState().suppressAutoTarget).toBe(false)

        useGameStore.setState({ playerHp: 100, phase: 'exploring' })
        useGameStore.getState().clearTarget()
        useGameStore.getState().warpToLevel(3)
        expect(useGameStore.getState().suppressAutoTarget).toBe(false)
      })
    })
  })

  it('damagePlayer clamps at 0, moves the phase to gameover, and drops the fight', () => {
    useGameStore.getState().setTarget('slime-1')
    useGameStore.setState({ monsterSwing: { 'slime-1': 1.2 } })

    useGameStore.getState().damagePlayer(PLAYER_MAX_HP + 50)

    const s = useGameStore.getState()
    expect(s.playerHp).toBe(0)
    expect(s.phase).toBe('gameover')
    expect(s.targetId).toBeNull()
    expect(s.monsterSwing).toEqual({})
  })

  it('healPlayer clamps at PLAYER_MAX_HP', () => {
    useGameStore.getState().damagePlayer(20)
    useGameStore.getState().healPlayer(999)
    expect(useGameStore.getState().playerHp).toBe(PLAYER_MAX_HP)
  })

  // The boss is the door out of a level now. There is no screen in between:
  // the killing blow hands over the next level on the spot.
  describe('the boss', () => {
    it('cannot be touched while one of its minions is still alive', () => {
      const boss = LEVELS[0].monsters.find((m) => m.boss)!
      killAllButLastInLevel(0) // kills everything except the *last* monster...
      // ...which for level 1 is the boss itself, so the floor is not clear:
      // one straggler is what the seal is made of.
      useGameStore.setState({
        defeatedIds: new Set(LEVELS[0].monsters.filter((m) => !m.boss).slice(0, -1).map((m) => m.id)),
      })

      useGameStore.getState().setTarget(boss.id)

      expect(useGameStore.getState().targetId, 'a sealed boss is not in the dungeon').toBeNull()
    })

    it('can be fought the moment the floor is clear', () => {
      const boss = clearMinionsOf(0)
      useGameStore.getState().setTarget(boss.id)
      expect(useGameStore.getState().targetId).toBe(boss.id)
    })

    it('opens the next level when it dies — no exam, no door', () => {
      const boss = clearMinionsOf(0)
      useGameStore.getState().setTarget(boss.id)

      useGameStore.getState().damageMonster(boss.maxHp)

      const s = useGameStore.getState()
      expect(s.currentLevel, 'straight through to level 2').toBe(2)
      expect(s.phase).toBe('exploring')
      expect(s.targetId).toBeNull()
      expect(s.lastPosition, 'the new level starts at its own entrance').toBeNull()
    })

    it('does not open anything when a minion dies', () => {
      killAllButLastInLevel(0)
      const straggler = LEVELS[0].monsters.filter((m) => !m.boss).at(-1)!
      useGameStore.getState().setTarget(straggler.id)

      useGameStore.getState().damageMonster(straggler.maxHp)

      expect(useGameStore.getState().currentLevel, 'still on the same floor').toBe(1)
      expect(useGameStore.getState().phase).toBe('exploring')
    })

    it('ends the game when the last level’s boss goes down', () => {
      const boss = clearMinionsOf(LEVELS.length - 1)
      useGameStore.getState().setTarget(boss.id)

      useGameStore.getState().damageMonster(boss.maxHp)

      expect(useGameStore.getState().phase).toBe('victory')
      expect(useGameStore.getState().currentLevel).toBe(LEVELS.length)
    })
  })

  // The admin warp (src/admin/) is the one thing in the game that moves
  // between levels without passing an exam, so what it does *not* touch
  // matters as much as what it does.
  // Where the player was standing, so a reload or a fresh login puts them
  // back on that spot. The spot only means anything on the level it was
  // taken on, which is what most of these guard.
  describe('saved position', () => {
    it('stamps the spot with the current level and writes it', () => {
      useGameStore.getState().hydrateSave(loadedSave)
      vi.mocked(saveProgress).mockClear()

      useGameStore.getState().recordPosition(-4.5, -17)

      expect(useGameStore.getState().lastPosition).toEqual({ level: 2, x: -4.5, z: -17 })
      expect(vi.mocked(saveProgress).mock.calls[0][1]).toMatchObject({
        lastPosition: { level: 2, x: -4.5, z: -17 },
      })
    })

    it('records nothing before this account’s save has been read', () => {
      // Same rule as every other write: the placeholder state before loading
      // must never overwrite a real save.
      useGameStore.getState().recordPosition(3, 3)
      expect(useGameStore.getState().lastPosition).toBeNull()
      expect(saveProgress).not.toHaveBeenCalled()
    })

    it('comes back from the save, but not from one that died', () => {
      useGameStore.getState().hydrateSave({ ...loadedSave, lastPosition: { level: 2, x: 1, z: -9 } })
      expect(useGameStore.getState().lastPosition).toEqual({ level: 2, x: 1, z: -9 })

      // A 0-HP save goes through the game-over reset, which starts at level
      // 1's entrance — a spot from the run that just ended has no place there.
      useGameStore.getState().hydrateSave({ ...loadedSave, playerHp: 0, lastPosition: { level: 2, x: 1, z: -9 } })
      expect(useGameStore.getState().lastPosition).toBeNull()
    })

    it('is forgotten on every level change and on restart', () => {
      const spot = { level: 1, x: 2, z: -6 }

      useGameStore.setState({ currentLevel: 1, playerHp: 100, phase: 'exploring', lastPosition: spot })
      useGameStore.getState().warpToLevel(3)
      expect(useGameStore.getState().lastPosition, 'warp').toBeNull()

      useGameStore.setState({ lastPosition: spot })
      clearLevel(0)
      expect(useGameStore.getState().lastPosition, 'next level').toBeNull()

      useGameStore.setState({ lastPosition: spot })
      useGameStore.getState().restart()
      expect(useGameStore.getState().lastPosition, 'restart').toBeNull()
    })
  })

  describe('warpToLevel', () => {
    it('jumps to any level without disturbing progress', () => {
      useGameStore.setState({ currentLevel: 1, playerHp: 100, defeatedIds: new Set(['slime-1']), phase: 'exploring' })

      useGameStore.getState().warpToLevel(4)

      const s = useGameStore.getState()
      expect(s.currentLevel).toBe(4)
      expect(s.phase).toBe('exploring')
      expect(s.playerHp).toBe(100)
      expect(s.defeatedIds.has('slime-1')).toBe(true)
    })

    it('lands on an empty floor when the target level is already cleared', () => {
      // Only reachable by admin warp: normal play never leaves a finished
      // level behind, because finishing one *is* moving to the next.
      const ids = LEVELS[2].monsters.map((m) => m.id)
      useGameStore.setState({ currentLevel: 1, playerHp: 100, defeatedIds: new Set(ids) })

      useGameStore.getState().warpToLevel(3)

      expect(useGameStore.getState().phase).toBe('exploring')
      expect(useGameStore.getState().currentLevel).toBe(3)
    })

    it('refuses to move a dead character or to leave the map', () => {
      useGameStore.setState({ currentLevel: 2, playerHp: 0, phase: 'gameover' })
      useGameStore.getState().warpToLevel(5)
      expect(useGameStore.getState().currentLevel).toBe(2)

      useGameStore.setState({ currentLevel: 2, playerHp: 100, phase: 'exploring' })
      useGameStore.getState().warpToLevel(999)
      expect(useGameStore.getState().currentLevel).toBe(LEVELS.length)

      useGameStore.getState().warpToLevel(-3)
      expect(useGameStore.getState().currentLevel).toBe(1)
    })
  })

  // Walking away from a monster you were beating on is a normal move now, not
  // a "Flee" button that ends something. Nothing about the level changes.
  it('dropping the target mid-fight leaves the level exactly as it was', () => {
    useGameStore.getState().setTarget('slime-1')
    useGameStore.getState().damageMonster(5)

    useGameStore.getState().setTarget(null)

    const s = useGameStore.getState()
    expect(s.phase).toBe('exploring')
    expect(s.currentLevel).toBe(1)
    expect(s.targetId).toBeNull()
    expect(s.defeatedIds.size).toBe(0)
  })

  it('confirmCharacter stores the chosen class, gender, skin, shirt, and name', () => {
    useGameStore.getState().confirmCharacter('wizard', 'female', '#abcdef', '#123456', 'Gandalf')
    const s = useGameStore.getState()
    expect(s.characterClass).toBe('wizard')
    expect(s.gender).toBe('female')
    expect(s.skinColor).toBe('#abcdef')
    expect(s.shirtColor).toBe('#123456')
    expect(s.characterName).toBe('Gandalf')
  })

  it('confirmCharacter keeps a null shirt color, leaving the outfit its own', () => {
    useGameStore.getState().confirmCharacter('cleric', 'female', '#abcdef', null, 'Sera')
    expect(useGameStore.getState().shirtColor).toBeNull()
  })

  // Editing from the profile screen. The name is not part of an appearance:
  // it was claimed against every other player at creation, and changing it
  // would have to be claimed all over again.
  describe('updateAppearance', () => {
    const newLook = {
      characterClass: 'rogue' as const,
      gender: 'male' as const,
      skinColor: '#8d5524',
      shirtColor: '#2f6fa8',
    }

    it('changes the whole look and leaves the claimed name alone', async () => {
      useGameStore.getState().hydrateSave(loadedSave)

      await useGameStore.getState().updateAppearance(newLook)

      const s = useGameStore.getState()
      expect(s.characterClass).toBe('rogue')
      expect(s.gender).toBe('male')
      expect(s.skinColor).toBe('#8d5524')
      expect(s.shirtColor).toBe('#2f6fa8')
      expect(s.characterName).toBe('Rin')
    })

    it('reports back whether the new look actually reached Supabase', async () => {
      // Nothing is written before this account's save has been read, and the
      // profile screen is told so rather than showing a false "saved".
      expect(await useGameStore.getState().updateAppearance(newLook)).toBe(false)

      useGameStore.getState().hydrateSave(loadedSave)
      expect(await useGameStore.getState().updateAppearance(newLook)).toBe(true)

      vi.mocked(saveProgress).mockResolvedValueOnce(false)
      expect(await useGameStore.getState().updateAppearance(newLook)).toBe(false)
    })
  })

  // Saved *during* a level, which is the only kind of save there is now:
  // killing the boss moves currentLevel in the same breath, so a finished
  // level is never what gets written.
  it('hydrateSave drops a living save straight back into the dungeon', () => {
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
      shirtColor: null,
      characterName: 'Rin',
      difficulty: 'hard',
      lastPosition: null,
    })
    const s = useGameStore.getState()
    expect(s.phase).toBe('exploring')
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
      shirtColor: null,
      characterName: 'Shade',
      difficulty: 'easy',
      lastPosition: null,
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
      shirtColor: null,
      characterName: null,
      // A save older than migrations_011 never chose a difficulty, which is
      // what puts the picker on screen once (see App.tsx).
      difficulty: null,
      lastPosition: null,
    })
    expect(useGameStore.getState().phase).toBe('exploring')
  })

  it('setPaused toggles the paused flag without touching phase or the target', () => {
    useGameStore.getState().setTarget('slime-1')
    useGameStore.getState().setPaused(true)
    expect(useGameStore.getState().paused).toBe(true)
    expect(useGameStore.getState().phase).toBe('exploring')
    expect(useGameStore.getState().targetId).toBe('slime-1')
    useGameStore.getState().setPaused(false)
    expect(useGameStore.getState().paused).toBe(false)
  })

  it('restart resets progress but keeps the chosen character, and clears any stuck pause', () => {
    useGameStore.getState().confirmCharacter('cleric', 'female', '#111111', '#222222', 'Elora')
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
    useGameStore.getState().confirmCharacter('cleric', 'female', '#111111', '#222222', 'Elora')
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
// work down every monster on the floor, then the boss it was hiding, and
// expect the next level on the spot — and the victory screen after the last
// one. The individual cases above each pin one branch; this is the check that
// all six levels really do chain together end to end.
function fightAndDefeat(monster: (typeof ALL_MONSTERS)[number]) {
  useGameStore.getState().setTarget(monster.id)
  expect(useGameStore.getState().targetId, `targeting ${monster.name}`).toBe(monster.id)
  useGameStore.getState().damageMonster(monster.maxHp)
  expect(useGameStore.getState().monsterHp[monster.id], `${monster.name} HP`).toBe(0)
  expect(useGameStore.getState().targetId, `${monster.name} is still targeted after dying`).toBeNull()
}

describe('level completion', () => {
  beforeEach(() => {
    useGameStore.getState().resetSave()
  })

  it('clears all six levels in order and ends on the victory screen', () => {
    for (const level of LEVELS) {
      expect(useGameStore.getState().currentLevel, `start of level ${level.level}`).toBe(level.level)
      expect(useGameStore.getState().phase, `start of level ${level.level}`).toBe('exploring')

      // Minions first: the boss cannot even be targeted until they are gone.
      level.monsters.filter((m) => !m.boss).forEach(fightAndDefeat)
      fightAndDefeat(level.monsters.find((m) => m.boss)!)
    }

    const s = useGameStore.getState()
    expect(s.phase).toBe('victory')
    expect(s.currentLevel).toBe(LEVELS.length)
    expect(s.defeatedIds.size).toBe(ALL_MONSTERS.length)
  })

  it.each(LEVELS)('level $level keeps its boss sealed until the floor is clear', (level) => {
    useGameStore.setState({ currentLevel: level.level })
    const minions = level.monsters.filter((m) => !m.boss)
    const boss = level.monsters.find((m) => m.boss)!

    // One minion short of clear: the boss is still not there to be fought.
    minions.slice(0, -1).forEach(fightAndDefeat)
    useGameStore.getState().setTarget(boss.id)
    expect(useGameStore.getState().targetId, 'boss reachable too early').toBeNull()
    expect(useGameStore.getState().currentLevel, 'advanced early').toBe(level.level)

    // The last minion drops and the boss walks in.
    fightAndDefeat(minions[minions.length - 1])
    expect(useGameStore.getState().currentLevel, 'a minion must not end the level').toBe(level.level)
    expect(useGameStore.getState().phase).toBe('exploring')

    fightAndDefeat(boss)
    const s = useGameStore.getState()
    if (level.level === LEVELS.length) expect(s.phase).toBe('victory')
    else expect(s.currentLevel).toBe(level.level + 1)
  })

  it('treats walking away from a wounded boss as leaving the level unfinished', () => {
    const level = LEVELS[0]
    level.monsters.filter((m) => !m.boss).forEach(fightAndDefeat)

    const boss = level.monsters.find((m) => m.boss)!
    useGameStore.getState().setTarget(boss.id)
    useGameStore.getState().damageMonster(boss.maxHp - 1) // hurt, never killed
    useGameStore.getState().setTarget(null)

    const s = useGameStore.getState()
    expect(s.currentLevel).toBe(1)
    expect(s.phase).toBe('exploring')
    expect(s.monsterHp[boss.id]).toBe(1)
  })
})
