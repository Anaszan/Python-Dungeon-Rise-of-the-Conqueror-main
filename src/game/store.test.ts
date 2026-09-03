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

// And the killing blow itself, which is the only thing that opens an exam.
function clearLevel(levelIndex: number) {
  killAllButLastInLevel(levelIndex)
  const monsters = LEVELS[levelIndex].monsters
  const last = monsters[monsters.length - 1]
  useGameStore.getState().setTarget(last.id)
  useGameStore.getState().damageMonster(last.maxHp)
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

    // The exam and the game-over screen are both modal. A target lock left
    // open under one would put a live code console on top of them.
    it('refuses to lock while anything but the dungeon is on screen', () => {
      useGameStore.setState({ phase: 'exam' })
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

  it('the killing blow on a level’s last monster opens that level’s exam', () => {
    killAllButLastInLevel(0)
    const last = LEVELS[0].monsters[LEVELS[0].monsters.length - 1]
    useGameStore.getState().setTarget(last.id)

    useGameStore.getState().damageMonster(last.maxHp)

    const s = useGameStore.getState()
    expect(s.phase).toBe('exam')
    expect(s.currentLevel).toBe(1) // still level 1 — the exam has not been passed yet
    expect(s.targetId).toBeNull()
  })

  it('passLevelExam is what actually advances the level', () => {
    clearLevel(0)

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
    clearLevel(LEVELS.length - 1)
    expect(useGameStore.getState().phase).toBe('exam')

    useGameStore.getState().passLevelExam()
    expect(useGameStore.getState().phase).toBe('victory')
  })

  // The admin warp (src/admin/) is the one thing in the game that moves
  // between levels without passing an exam, so what it does *not* touch
  // matters as much as what it does.
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

    it('lands on the exam when the target level is already cleared', () => {
      // 'exam' is only ever entered by leaving a fight, and a cleared level
      // has none left — without deriving it here the admin would arrive in an
      // empty dungeon with no way out of it.
      const ids = LEVELS[2].monsters.map((m) => m.id)
      useGameStore.setState({ currentLevel: 1, playerHp: 100, defeatedIds: new Set(ids) })

      useGameStore.getState().warpToLevel(3)

      expect(useGameStore.getState().phase).toBe('exam')
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
      shirtColor: null,
      characterName: 'Rin',
      difficulty: 'hard',
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
      shirtColor: null,
      characterName: 'Shade',
      difficulty: 'easy',
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
// click every monster of a level, kill it, sit the end-of-level exam, and
// expect the game to hand out the next level — and the victory screen after
// the last one. The individual cases above each pin one branch; this is the
// check that all six levels really do chain together end to end.
function fightAndDefeat(monster: (typeof ALL_MONSTERS)[number]) {
  useGameStore.getState().setTarget(monster.id)
  expect(useGameStore.getState().targetId, `targeting ${monster.name}`).toBe(monster.id)
  useGameStore.getState().damageMonster(monster.maxHp)
  expect(useGameStore.getState().monsterHp[monster.id], `${monster.name} HP`).toBe(0)
  expect(useGameStore.getState().targetId, `${monster.name} is still targeted after dying`).toBeNull()
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

  it('treats walking away from the final monster as leaving the level unfinished', () => {
    const level = LEVELS[0]
    level.monsters.slice(0, -1).forEach(fightAndDefeat)

    const last = level.monsters[level.monsters.length - 1]
    useGameStore.getState().setTarget(last.id)
    useGameStore.getState().damageMonster(last.maxHp - 1) // hurt, never killed
    useGameStore.getState().setTarget(null)

    const s = useGameStore.getState()
    expect(s.currentLevel).toBe(1)
    expect(s.phase).toBe('exploring')
    expect(s.monsterHp[last.id]).toBe(1)
  })
})
