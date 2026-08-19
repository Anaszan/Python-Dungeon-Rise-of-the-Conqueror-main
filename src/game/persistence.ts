import { supabase } from '../lib/supabase'
import { PLAYER_MAX_HP, BASE_ATTACK_POWER } from './constants'
import type { CharacterClass, CharacterGender } from '../character/characterOptions'
import { DEFAULT_GENDER, DEFAULT_SKIN_COLOR } from '../character/characterOptions'

export type SaveData = {
  defeatedMonsterIds: string[]
  playerHp: number
  attackPower: number
  collectedPickupIds: string[]
  currentLevel: number
  skillCooldown: number
  characterClass: CharacterClass | null
  gender: CharacterGender
  skinColor: string
  shirtColor: string | null
  characterName: string | null
}

// Running against a project that has not had every migration applied yet.
//
// shirt_color (migrations_009) is the one column the game can honestly do
// without: it is a cosmetic choice, and a save that predates it renders in the
// outfit's own color anyway. Rather than refusing to start — which is what an
// unrecognised column does to the whole read, and with it the whole game — the
// two functions below notice that particular failure, carry on without the
// column, and say so in the console. Everything else still fails loudly.
//
// Nothing else degrades this way. A missing name-uniqueness migration is a
// correctness problem, not a cosmetic one, and is handled where it matters
// (claimCharacterName).
const SAVE_COLUMNS =
  'defeated_monster_ids, player_hp, attack_power, collected_pickup_ids, current_level, skill_cooldown, character_class, gender, skin_color, character_name'
const SHIRT_COLOR_COLUMN = 'shirt_color'

// null until the first read finds out, so later requests skip an attempt
// already known to fail.
let hasShirtColor: boolean | null = null

function isMissingShirtColor(error: { code?: string; message: string }) {
  // 42703 is Postgres' undefined_column. PostgREST passes it straight through,
  // but the code is checked against the message too so a project that reports
  // it differently is not misread as a healthy database.
  return (error.code === '42703' || error.message.includes('does not exist')) && error.message.includes(SHIRT_COLOR_COLUMN)
}

function warnMissingShirtColor() {
  if (hasShirtColor === false) return
  hasShirtColor = false
  console.warn(
    `game_saves.${SHIRT_COLOR_COLUMN} is missing, so the shirt color will not be remembered between sessions. ` +
      'Run supabase/migrations_009_character_shirt_color.sql to enable it.',
  )
}

// Throws if the save cannot be read, and the caller (App) keeps the player on
// a retry screen rather than starting the game.
//
// The tempting shortcut — log the error and hand back a blank save — costs a
// player their character: a blank save has no character_class or
// character_name, which is the app's own definition of "this player has never
// made a character", so a single failed read would send someone who has played
// for hours back to the customize screen and then overwrite their real save
// with a level-1 one. A row that genuinely is not there is a different answer
// and still comes back as a blank save; only a *failed question* throws.
export async function loadSave(userId: string): Promise<SaveData> {
  // The column list is chosen at runtime, which is more than the client's
  // type inference can follow — hence the shape spelled out here. Every field
  // is optional because a save row predates most of them.
  type SaveRow = Partial<{
    defeated_monster_ids: string[]
    player_hp: number
    attack_power: number
    collected_pickup_ids: string[]
    current_level: number
    skill_cooldown: number
    character_class: string | null
    gender: string | null
    skin_color: string | null
    shirt_color: string | null
    character_name: string | null
  }>

  const read = async (columns: string) => {
    const result = await supabase.from('game_saves').select(columns).eq('user_id', userId).maybeSingle()
    return { data: result.data as SaveRow | null, error: result.error }
  }

  let { data, error } = await read(
    hasShirtColor === false ? SAVE_COLUMNS : `${SAVE_COLUMNS}, ${SHIRT_COLOR_COLUMN}`,
  )

  if (error && isMissingShirtColor(error)) {
    warnMissingShirtColor()
    ;({ data, error } = await read(SAVE_COLUMNS))
  }

  if (error) throw new Error(error.message)
  if (hasShirtColor === null) hasShirtColor = true

  return {
    defeatedMonsterIds: data?.defeated_monster_ids ?? [],
    playerHp: data?.player_hp ?? PLAYER_MAX_HP,
    attackPower: data?.attack_power ?? BASE_ATTACK_POWER,
    collectedPickupIds: data?.collected_pickup_ids ?? [],
    currentLevel: data?.current_level ?? 1,
    skillCooldown: data?.skill_cooldown ?? 0,
    characterClass: (data?.character_class as CharacterClass | null) ?? null,
    // Saves written before migrations_008 have no gender — they keep the
    // model they've always been rendered with.
    gender: (data?.gender as CharacterGender | null) ?? DEFAULT_GENDER,
    skinColor: data?.skin_color ?? DEFAULT_SKIN_COLOR,
    // Saves written before migrations_009 have no shirt color — null keeps
    // their outfit exactly the color it has always rendered in.
    shirtColor: data?.shirt_color ?? null,
    characterName: data?.character_name ?? null,
  }
}

// Returns whether the write landed, for the one caller that shows the player
// an answer (changing their character from the profile screen).
export async function saveProgress(userId: string, save: SaveData): Promise<boolean> {
  const row = {
    user_id: userId,
    defeated_monster_ids: save.defeatedMonsterIds,
    player_hp: save.playerHp,
    attack_power: save.attackPower,
    collected_pickup_ids: save.collectedPickupIds,
    current_level: save.currentLevel,
    skill_cooldown: save.skillCooldown,
    character_class: save.characterClass,
    gender: save.gender,
    skin_color: save.skinColor,
    character_name: save.characterName,
    updated_at: new Date().toISOString(),
  }

  const write = (values: object) => supabase.from('game_saves').upsert(values)

  let { error } = await write(
    hasShirtColor === false ? row : { ...row, [SHIRT_COLOR_COLUMN]: save.shirtColor },
  )

  if (error && isMissingShirtColor(error)) {
    warnMissingShirtColor()
    ;({ error } = await write(row))
  }

  // Progress is written constantly and the game keeps its own copy in the
  // store, so a failed write is worth reporting but not worth interrupting
  // play for — unlike a failed *read*, which loses a character (see loadSave).
  if (error) console.error('Failed to save progress:', error.message)
  return !error
}

// Lets CharacterCustomize show a friendly "already taken" error while the
// player is still typing, instead of a raw unique-constraint violation from
// the upsert above — same pattern as is_identifier_taken for nicknames.
//
// This throws rather than reporting "not taken" when the lookup itself fails.
// Swallowing the error would answer a question it never actually asked, and
// the answer it invents is the dangerous one: an unreachable database, or a
// project missing migrations_010, would wave every duplicate straight through.
export async function isCharacterNameTaken(name: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_character_name_taken', { p_name: name })
  if (error) throw new Error(error.message)
  return data ?? false
}

// Takes the name for this player, or returns false if someone else got there
// first. The check above is only ever advice — two players can both be told a
// free name is free — so this is what actually settles it, in one statement
// inside Postgres (migrations_010), and the customize screen refuses to start
// the game until it comes back true.
export async function claimCharacterName(name: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_character_name', { p_name: name })
  if (!error) return data === true

  // PGRST202 is PostgREST's "no such function": migrations_010 has not been
  // applied. Rather than locking new players out of a game that worked before
  // that migration existed, fall back to the check that has shipped since
  // migrations_006 — asked right now instead of on the customize screen's
  // debounce, so the gap between asking and saving is as small as a client can
  // make it. It is a narrower guarantee than the claim (two players answering
  // in the same instant can still both be told yes, and the loser's name then
  // fails to save), which is exactly why it warns.
  if (error.code !== 'PGRST202') throw new Error(error.message)
  console.warn(
    'claim_character_name is missing, so duplicate names are only checked, not reserved. ' +
      'Run supabase/migrations_010_character_name_uniqueness.sql to close the gap.',
  )
  return !(await isCharacterNameTaken(name))
}

export async function submitScore(userId: string, monstersDefeated: number) {
  const { error } = await supabase
    .from('scores')
    .insert({ user_id: userId, monsters_defeated: monstersDefeated })

  if (error) console.error('Failed to submit score:', error.message)
}

export type ProgressLeaderboardRow = {
  display_name: string | null
  character_name: string | null
  current_level: number
  is_conqueror: boolean
  monsters_defeated: number | null
  completed_at: string | null
}

// game_saves is owner-only RLS, so this goes through a SECURITY DEFINER RPC
// (see migrations_007_progress_leaderboard.sql) instead of a direct select —
// that's also what lets it return every player's current_level (not just
// scores rows) so Leaderboard.tsx can show non-conquerors' standing too.
export async function fetchProgressLeaderboard(): Promise<ProgressLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_progress_leaderboard')
  if (error) {
    console.error('Failed to load leaderboard:', error.message)
    return []
  }
  return (data ?? []) as ProgressLeaderboardRow[]
}
