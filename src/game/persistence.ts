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

export async function loadSave(userId: string): Promise<SaveData> {
  const { data, error } = await supabase
    .from('game_saves')
    .select(
      'defeated_monster_ids, player_hp, attack_power, collected_pickup_ids, current_level, skill_cooldown, character_class, gender, skin_color, shirt_color, character_name',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) console.error('Failed to load save:', error.message)

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

export async function saveProgress(userId: string, save: SaveData) {
  const { error } = await supabase.from('game_saves').upsert({
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
    shirt_color: save.shirtColor,
    character_name: save.characterName,
    updated_at: new Date().toISOString(),
  })

  if (error) console.error('Failed to save progress:', error.message)
}

// Lets CharacterCustomize show a friendly "already taken" error before the
// player confirms, instead of a raw unique-constraint violation from the
// upsert above — same pattern as is_identifier_taken for nicknames.
export async function isCharacterNameTaken(name: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_character_name_taken', { p_name: name })

  if (error) {
    console.error('Failed to check character name:', error.message)
    return false
  }

  return data ?? false
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
