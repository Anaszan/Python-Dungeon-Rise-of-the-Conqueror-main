import { supabase } from '../lib/supabase'
import { isDifficulty, type Difficulty } from '../game/difficulty'

// One player's whole save as the admin dashboard sees it — the shape returned
// by get_admin_player_overview() (migrations_012_admin.sql), which is the only
// way to read another player's row at all: game_saves is owner-only RLS.
export type AdminPlayerRow = {
  userId: string
  email: string | null
  displayName: string | null
  nickname: string | null
  characterName: string | null
  characterClass: string | null
  difficulty: Difficulty | null
  currentLevel: number
  playerHp: number
  attackPower: number
  monstersDefeated: number
  pickupsCollected: number
  isConqueror: boolean
  bestScore: number | null
  completedAt: string | null
  updatedAt: string | null
}

type OverviewRow = {
  user_id: string
  email: string | null
  display_name: string | null
  nickname: string | null
  character_name: string | null
  character_class: string | null
  difficulty: string | null
  current_level: number | null
  player_hp: number | null
  attack_power: number | null
  monsters_defeated: number | null
  pickups_collected: number | null
  is_conqueror: boolean | null
  best_score: number | null
  completed_at: string | null
  updated_at: string | null
}

// PostgREST's "no such function": migrations_012 has not been applied to this
// project yet. That is not an error worth showing anyone — it just means this
// deployment has no admin role — so is_admin() answers false and the admin UI
// never appears.
const MISSING_FUNCTION = 'PGRST202'

// Whether the signed-in user is on the admin allow-list. Only ever used to
// decide whether to render the admin UI; the actual protection is the
// is_admin() check inside the RPC, which the client cannot skip.
export async function fetchIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin')
  if (!error) return data === true
  if (error.code === MISSING_FUNCTION) return false
  // Any other failure (offline, RLS misconfigured) is reported and treated as
  // "not an admin": the safe answer, and the dashboard is not worth breaking
  // the game over.
  console.error('Failed to check admin status:', error.message)
  return false
}

// Throws on failure rather than returning an empty list: an admin looking at
// an empty dashboard needs to know whether there are no players or whether the
// question could not be asked (see loadSave for the same reasoning).
export async function fetchAdminPlayers(): Promise<AdminPlayerRow[]> {
  const { data, error } = await supabase.rpc('get_admin_player_overview')
  if (error) {
    if (error.code === MISSING_FUNCTION) {
      throw new Error('ยังไม่ได้ติดตั้งระบบแอดมิน — รัน supabase/migrations_012_admin.sql ก่อน')
    }
    throw new Error(error.message)
  }

  return ((data ?? []) as OverviewRow[]).map((row) => ({
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    nickname: row.nickname,
    characterName: row.character_name,
    characterClass: row.character_class,
    difficulty: isDifficulty(row.difficulty) ? row.difficulty : null,
    currentLevel: row.current_level ?? 1,
    playerHp: row.player_hp ?? 0,
    attackPower: row.attack_power ?? 0,
    monstersDefeated: row.monsters_defeated ?? 0,
    pickupsCollected: row.pickups_collected ?? 0,
    isConqueror: row.is_conqueror === true,
    bestScore: row.best_score,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }))
}
