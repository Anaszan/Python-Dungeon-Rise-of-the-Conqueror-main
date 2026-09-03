import { create } from 'zustand'
import { useAuthStore } from '../auth/authStore'
import { saveProgress, submitScore, type SaveData } from './persistence'
import { ALL_MONSTERS, LEVELS } from './levels'
import { PLAYER_MAX_HP, BASE_ATTACK_POWER, SKILL_COOLDOWN_SECONDS, ATTACK_COOLDOWN_SECONDS } from './constants'
import {
  DEFAULT_GENDER,
  DEFAULT_SKIN_COLOR,
  type AppearanceChoice,
  type CharacterClass,
  type CharacterGender,
} from '../character/characterOptions'
import { playAttackImpact, playPlayerHurt } from '../audio/soundEngine'
import type { Difficulty } from './difficulty'

// Fighting is no longer a phase. There is no battle screen to cut away to:
// the player picks a target, casts at it, and takes hits, all while standing
// in the dungeon and free to walk away mid-fight — so 'exploring' *is* the
// combat state (see the target lock below).
//
// 'exam' sits between clearing a level and getting the next one: the moment
// the last monster of a level goes down, the player is dropped into the
// end-of-level exam (LevelExamOverlay) instead of straight into level N+1.
// Nothing but passLevelExam() leaves this phase, so the exam is the only door
// out of a finished level — including the last one, which reaches 'victory'
// through it rather than around it.
type GamePhase = 'exploring' | 'exam' | 'gameover' | 'victory'

type GameState = {
  phase: GamePhase
  currentLevel: number
  // The locked target: the monster every spell in the code boxes lands on,
  // and the only thing damageMonster() can hurt. Clicking a monster in the
  // dungeon sets it, Tab cycles it, Escape and walking away clear it. Null
  // means no target, which is what closes the target panel.
  targetId: string | null
  // Set when the *player* let go of the target on purpose (Escape, the panel's
  // ✕). It stops CombatTicker's auto-lock from handing the same monster
  // straight back on the next frame while they are still standing in its
  // reach — which would make dismissing the panel mid-melee impossible.
  // Cleared the moment nothing is attacking them any more, or the moment they
  // pick a target themselves.
  suppressAutoTarget: boolean
  monsterHp: Record<string, number>
  defeatedIds: Set<string>
  playerHp: number
  attackPower: number
  collectedPickupIds: Set<string>
  skillCooldown: number
  // Ephemeral pacing for the regular attack box — unlike skillCooldown this
  // is never persisted to Supabase (see startAttackCooldown), it's short
  // enough that losing it on a page reload isn't worth a DB migration.
  attackCooldown: number
  // Seconds until each *engaged* monster's next swing, keyed by monster id —
  // driven by CombatTicker, drawn as the little timer bar under a monster's
  // nameplate. Only monsters currently in aggro range appear here (walking
  // away empties it), and the ticker only pushes a new object when a
  // displayed tenth-of-a-second actually changed, so this is not a
  // per-frame re-render. Never persisted, same reasoning as attackCooldown.
  monsterSwing: Record<string, number>
  characterClass: CharacterClass | null
  gender: CharacterGender
  skinColor: string
  // null = never picked one, so the outfit keeps the color its model ships in
  // (see defaultShirtColor in characterAssets.ts). That's also what every save
  // written before migrations_009 loads as.
  shirtColor: string | null
  characterName: string | null
  // How every monster fight asks for its code — see difficulty.ts. null means
  // this player has never chosen, which is what puts DifficultySelect on
  // screen between the customize screen and the first chapter intro (App.tsx).
  // Unlike the character it is not a one-time decision: the pause menu can
  // switch it mid-run, and the next fight (and the next box reset) follows.
  difficulty: Difficulty | null
  saveLoaded: boolean
  // Mid-game pause: freezes player movement, the combat attack timer, and
  // exploration triggers (see the `paused` checks in Player.tsx, GameScene.tsx,
  // and CombatTicker.tsx) without touching `phase`, so resuming drops the
  // player back into exactly whatever exploring/combat state they paused in.
  paused: boolean

  setTarget: (monsterId: string | null) => void
  // Escape, and the panel's ✕. Unlike setTarget(null) — which is also how the
  // ticker drops a target that died or was walked away from — this one is a
  // deliberate "leave me alone", and the auto-lock respects it.
  clearTarget: () => void
  allowAutoTarget: () => void
  damageMonster: (amount: number) => void
  damagePlayer: (amount: number) => void
  healPlayer: (amount: number) => void
  increaseAttackPower: (amount: number) => void
  collectPickup: (id: string) => void
  startSkillCooldown: () => void
  startAttackCooldown: () => void
  tickCooldowns: (delta: number) => void
  setMonsterSwing: (swing: Record<string, number>) => void
  passLevelExam: () => void
  setPaused: (paused: boolean) => void
  // Admin-only jump to any level (see src/admin/). Not reachable from normal
  // play — the only way past a level's gate is passLevelExam().
  warpToLevel: (level: number) => void
  confirmCharacter: (
    characterClass: CharacterClass,
    gender: CharacterGender,
    skinColor: string,
    shirtColor: string | null,
    characterName: string,
  ) => void
  setDifficulty: (difficulty: Difficulty) => void
  // Editing an existing character from the profile screen. Deliberately does
  // not touch characterName: that one is claimed at creation and is the only
  // part of a character another player can collide with.
  updateAppearance: (appearance: AppearanceChoice) => Promise<boolean>
  hydrateSave: (save: SaveData) => void
  resetSave: () => void
  restart: () => void
}

// Resolves to whether the write landed. Almost every caller fires this and
// forgets: progress is written after nearly every action, the store keeps its
// own copy, and the next action will write again. updateAppearance is the
// exception — it is a button the player pressed once, so it waits and says.
async function persist(): Promise<boolean> {
  const userId = useAuthStore.getState().session?.user.id
  if (!userId) return false
  // Nothing is written until this account's own save has been read back. The
  // state before that is placeholder — level 1, full HP, no character — and
  // writing it would overwrite a real save with a blank one.
  if (!useGameStore.getState().saveLoaded) return false
  const {
    defeatedIds,
    playerHp,
    attackPower,
    collectedPickupIds,
    currentLevel,
    skillCooldown,
    characterClass,
    gender,
    skinColor,
    shirtColor,
    characterName,
    difficulty,
  } = useGameStore.getState()
  return saveProgress(userId, {
    defeatedMonsterIds: [...defeatedIds],
    playerHp,
    attackPower,
    collectedPickupIds: [...collectedPickupIds],
    currentLevel,
    skillCooldown,
    characterClass,
    gender,
    skinColor,
    shirtColor,
    characterName,
    difficulty,
  })
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'exploring',
  currentLevel: 1,
  targetId: null,
  suppressAutoTarget: false,
  monsterHp: {},
  defeatedIds: new Set(),
  playerHp: PLAYER_MAX_HP,
  attackPower: BASE_ATTACK_POWER,
  collectedPickupIds: new Set(),
  skillCooldown: 0,
  attackCooldown: 0,
  monsterSwing: {},
  characterClass: null,
  gender: DEFAULT_GENDER,
  skinColor: DEFAULT_SKIN_COLOR,
  shirtColor: null,
  characterName: null,
  difficulty: null,
  saveLoaded: false,
  paused: false,

  // Locking a target is the whole "entering a fight" ceremony now: no phase
  // change, no screen, nothing paused. Clicking a monster in the dungeon,
  // Tab, and CombatTicker's auto-lock all land here.
  //
  // A monster's HP is seeded the first time it is ever targeted and kept
  // afterwards — walk away from something at half health, come back an hour
  // later, and it is still at half health.
  setTarget: (monsterId) => {
    if (monsterId == null) {
      set({ targetId: null })
      return
    }
    const monster = ALL_MONSTERS.find((m) => m.id === monsterId)
    // Ignore anything that isn't a real monster, or one already dead — a
    // corpse is not a target, and letting it become one would leave the panel
    // open on a monster that is no longer in the dungeon.
    if (!monster) return
    const { defeatedIds, monsterHp, phase } = get()
    if (defeatedIds.has(monsterId)) return
    if (phase !== 'exploring') return
    set({
      targetId: monsterId,
      // Choosing a target is itself the answer to "leave me alone".
      suppressAutoTarget: false,
      monsterHp: { ...monsterHp, [monsterId]: monsterHp[monsterId] ?? monster.maxHp },
    })
  },

  clearTarget: () => set({ targetId: null, suppressAutoTarget: true }),

  // Called by CombatTicker once nothing is in range any more: walking clear of
  // the pack is what re-arms the auto-lock for the next one.
  allowAutoTarget: () => set({ suppressAutoTarget: false }),

  // Every spell lands on the locked target. With no target there is nothing
  // to hit, which is also what makes casting at empty air harmless rather
  // than an error.
  damageMonster: (amount) => {
    const { targetId, monsterHp, defeatedIds, currentLevel, characterClass } = get()
    if (!targetId) return
    if (amount > 0) playAttackImpact(characterClass)
    const wasDefeated = defeatedIds.has(targetId)
    const nextHp = Math.max(0, (monsterHp[targetId] ?? 0) - amount)
    const nextDefeated = new Set(defeatedIds)
    if (nextHp <= 0) nextDefeated.add(targetId)

    const levelCleared = nextHp <= 0 && LEVELS[currentLevel - 1].monsters.every((m) => nextDefeated.has(m.id))

    set({
      monsterHp: { ...monsterHp, [targetId]: nextHp },
      defeatedIds: nextDefeated,
      // A dead monster stops being the target the instant it drops: the panel
      // closes, the corpse disappears, and the player is free to pick the
      // next one. Nothing here waits on a "Continue" button any more.
      targetId: nextHp <= 0 ? null : targetId,
      // Clearing the last monster of a level is what opens that level's exam.
      // currentLevel deliberately does not move — passLevelExam() is still the
      // only thing that advances it, so a reload mid-exam lands back on the
      // exam (see hydrateSave) rather than skipping it.
      phase: levelCleared ? 'exam' : get().phase,
    })

    if (!wasDefeated && nextHp <= 0) {
      persist()
      const isLastLevel = currentLevel === LEVELS.length
      if (isLastLevel && levelCleared) {
        const userId = useAuthStore.getState().session?.user.id
        if (userId) submitScore(userId, nextDefeated.size)
      }
    }
  },

  damagePlayer: (amount) => {
    if (amount > 0) playPlayerHurt()
    set((state) => {
      const nextHp = Math.max(0, state.playerHp - amount)
      if (nextHp > 0) return { playerHp: nextHp }
      // Dying drops the target and every swing timer with it, so the game-over
      // screen isn't sitting on top of a live target panel and a monster still
      // counting down to its next hit.
      return { playerHp: 0, phase: 'gameover', targetId: null, monsterSwing: {}, suppressAutoTarget: false }
    })
    persist()
  },

  healPlayer: (amount) => {
    set((state) => ({ playerHp: Math.min(PLAYER_MAX_HP, state.playerHp + amount) }))
    persist()
  },

  increaseAttackPower: (amount) => {
    set((state) => ({ attackPower: state.attackPower + amount }))
    persist()
  },

  collectPickup: (id) => {
    set((state) => ({ collectedPickupIds: new Set(state.collectedPickupIds).add(id) }))
    persist()
  },

  // The special skill is now cast by writing Python code that calls
  // skill(amount) — see SpellConsole.tsx / pyodideRuntime.ts. That code path
  // deals damage through damageMonster() directly and then calls this to
  // start the cooldown, instead of a single button action owning both.
  startSkillCooldown: () => {
    if (get().phase !== 'exploring') return
    set({ skillCooldown: SKILL_COOLDOWN_SECONDS })
    persist()
  },

  // Same idea as startSkillCooldown but for the regular attack box — see
  // pyodideRuntime.ts SpellResult.attackUsed. Not persisted: this fires
  // roughly every ATTACK_COOLDOWN_SECONDS during any active fight, so
  // writing it to Supabase every time would be a lot of avoidable traffic
  // for a value that's fine to just reset to 0 on reload.
  startAttackCooldown: () => {
    if (get().phase !== 'exploring') return
    set({ attackCooldown: ATTACK_COOLDOWN_SECONDS })
  },

  tickCooldowns: (delta) =>
    set((state) => ({
      skillCooldown: state.skillCooldown > 0 ? Math.max(0, state.skillCooldown - delta) : state.skillCooldown,
      attackCooldown: state.attackCooldown > 0 ? Math.max(0, state.attackCooldown - delta) : state.attackCooldown,
    })),

  setMonsterSwing: (swing) => set({ monsterSwing: swing }),

  // The only exit from 'exam': called by LevelExamOverlay once the player's
  // own from-scratch code has satisfied every check for the chapter and put
  // the gate guardian down in a single cast.
  passLevelExam: () => {
    const { phase, currentLevel } = get()
    if (phase !== 'exam') return

    if (currentLevel < LEVELS.length) {
      set({
        phase: 'exploring',
        targetId: null,
        monsterSwing: {},
        suppressAutoTarget: false,
        currentLevel: currentLevel + 1,
      })
      persist()
      return
    }

    set({ phase: 'victory', targetId: null, monsterSwing: {}, suppressAutoTarget: false })
  },

  setPaused: (paused) => set({ paused }),

  // Drops the player at the start of any level, for testing. Nothing else is
  // touched — HP, attack power, defeated monsters and collected pickups all
  // carry over — so warping away and back leaves progress exactly as it was.
  //
  // The phase is re-derived the same way hydrateSave does it: warping into a
  // level whose monsters are already dead has to land on that level's exam,
  // because 'exam' is only ever entered by the killing blow on a level's last
  // monster (damageMonster) and there are none left to kill. Without this the
  // admin would arrive in an empty dungeon with no way forward.
  warpToLevel: (level) => {
    const { playerHp, defeatedIds, currentLevel } = get()
    if (playerHp <= 0) return // dead — the game-over overlay owns the screen
    const target = Math.min(Math.max(Math.round(level), 1), LEVELS.length)
    if (target === currentLevel) return

    const cleared = LEVELS[target - 1].monsters.every((m) => defeatedIds.has(m.id))
    set({
      currentLevel: target,
      phase: cleared ? 'exam' : 'exploring',
      targetId: null,
      monsterSwing: {},
      suppressAutoTarget: false,
      paused: false,
    })
    persist()
  },

  confirmCharacter: (characterClass, gender, skinColor, shirtColor, characterName) => {
    set({ characterClass, gender, skinColor, shirtColor, characterName })
    persist()
  },

  // Chosen on DifficultySelect before the first level, and changeable later
  // from the pause menu. Nothing about the current fight is reset here: the
  // code boxes re-seed themselves from the new difficulty on their next
  // render (see SpellConsole's task effects), so switching mid-fight swaps
  // the โจทย์ without touching anyone's HP.
  setDifficulty: (difficulty) => {
    set({ difficulty })
    persist()
  },

  updateAppearance: (appearance) => {
    set(appearance)
    return persist()
  },

  hydrateSave: (save) => {
    const defeated = new Set(save.defeatedMonsterIds)
    // Nothing writes 'exam' to Supabase (phase isn't part of SaveData), so it
    // has to be re-derived: a save whose current level has no monsters left
    // is a save taken during that level's exam. Without this, reloading
    // mid-exam would drop the player into an empty dungeon with every
    // monster dead and no way left to reach the next level.
    const levelCleared = LEVELS[save.currentLevel - 1]?.monsters.every((m) => defeated.has(m.id)) ?? false

    set({
      // A save can be persisted mid-death (damagePlayer writes playerHp: 0
      // to Supabase the instant HP hits zero, before the player ever clicks
      // "restart"). Without deriving phase here too, reloading that save
      // would drop the player back into the level they died in — stale
      // defeatedIds, 0 HP, no game-over screen — instead of sending them
      // through the same reset restart() does.
      phase: save.playerHp <= 0 ? 'gameover' : levelCleared ? 'exam' : 'exploring',
      defeatedIds: defeated,
      playerHp: save.playerHp,
      attackPower: save.attackPower,
      collectedPickupIds: new Set(save.collectedPickupIds),
      currentLevel: save.currentLevel,
      skillCooldown: save.skillCooldown,
      characterClass: save.characterClass,
      gender: save.gender,
      skinColor: save.skinColor,
      shirtColor: save.shirtColor,
      characterName: save.characterName,
      // Stays null for a save written before migrations_011 (or before the
      // player ever reached the picker), which sends them to DifficultySelect
      // once and then remembers the answer.
      difficulty: save.difficulty,
      saveLoaded: true,
      // Nothing about a fight survives a reload: the target lock and every
      // swing timer are moment-to-moment state, and a monster's remaining HP
      // was never persisted either (it re-seeds at full the next time it is
      // targeted, same as before).
      targetId: null,
      monsterSwing: {},
      suppressAutoTarget: false,
    })
  },

  restart: () => {
    set({
      phase: 'exploring',
      currentLevel: 1,
      targetId: null,
      suppressAutoTarget: false,
      monsterHp: {},
      defeatedIds: new Set(),
      playerHp: PLAYER_MAX_HP,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: new Set(),
      skillCooldown: 0,
      attackCooldown: 0,
      monsterSwing: {},
      paused: false,
    })
    persist()
  },

  // Clears out the previous account's data while a different session's save
  // is (re)loading, so switching accounts on the same page never flashes
  // the prior user's character/progress.
  resetSave: () =>
    set({
      phase: 'exploring',
      currentLevel: 1,
      targetId: null,
      suppressAutoTarget: false,
      monsterHp: {},
      defeatedIds: new Set(),
      playerHp: PLAYER_MAX_HP,
      attackPower: BASE_ATTACK_POWER,
      collectedPickupIds: new Set(),
      skillCooldown: 0,
      attackCooldown: 0,
      monsterSwing: {},
      characterClass: null,
      gender: DEFAULT_GENDER,
      skinColor: DEFAULT_SKIN_COLOR,
      shirtColor: null,
      characterName: null,
      difficulty: null,
      saveLoaded: false,
      paused: false,
    }),
}))
