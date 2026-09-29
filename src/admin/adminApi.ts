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
  // Moderation state (migrations_014). suspendedAt non-null = the database is
  // refusing every write from this account, whatever its client believes.
  suspendedAt: string | null
  suspendedReason: string | null
  isAdmin: boolean
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
  suspended_at: string | null
  suspended_reason: string | null
  is_admin: boolean | null
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
    suspendedAt: row.suspended_at,
    suspendedReason: row.suspended_reason,
    isAdmin: row.is_admin === true,
  }))
}

// ---------------------------------------------------------------------------
// เพิ่ม / แก้ไข / ลบ / ระงับ — the four admin actions (migrations_014).
//
// Every one of these is a SECURITY DEFINER RPC that re-checks is_admin() in
// the database. These wrappers only turn a Postgres error into a sentence a
// person can read: the RPC is what actually decides whether the action is
// allowed, so a player calling them by hand gets a 403 and nothing else.
// ---------------------------------------------------------------------------

// The RPC raises with a Thai message for the cases an admin can actually hit
// (duplicate email, too-short password, deleting yourself). Anything else is
// a database problem and is reported as it came.
function adminError(error: { code?: string; message: string }): Error {
  if (error.code === MISSING_FUNCTION) {
    return new Error('ยังไม่ได้ติดตั้งระบบจัดการผู้ใช้ — รัน supabase/migrations_014_admin_user_management.sql ก่อน')
  }
  if (error.code === '42501') return new Error('บัญชีนี้ไม่มีสิทธิ์แอดมิน')
  // 23505 is a unique violation: a duplicate nickname or character name the
  // RPC handed straight to Postgres.
  if (error.code === '23505') return new Error(`ซ้ำกับของผู้เล่นคนอื่น: ${error.message}`)
  return new Error(error.message)
}

export type NewPlayer = {
  email: string
  password: string
  displayName?: string
  nickname?: string
}

export async function adminCreatePlayer(player: NewPlayer): Promise<void> {
  const { error } = await supabase.rpc('admin_create_player', {
    p_email: player.email,
    p_password: player.password,
    p_display_name: player.displayName || null,
    p_nickname: player.nickname || null,
  })
  if (error) throw adminError(error)
}

// Only the fields the admin actually filled in are sent; the RPC reads null
// as "leave this one alone".
export type PlayerEdit = {
  displayName?: string | null
  nickname?: string | null
  characterName?: string | null
  currentLevel?: number | null
  playerHp?: number | null
  attackPower?: number | null
}

export async function adminUpdatePlayer(userId: string, edit: PlayerEdit): Promise<void> {
  const { error } = await supabase.rpc('admin_update_player', {
    p_user_id: userId,
    p_display_name: edit.displayName ?? null,
    p_nickname: edit.nickname ?? null,
    p_character_name: edit.characterName ?? null,
    p_current_level: edit.currentLevel ?? null,
    p_player_hp: edit.playerHp ?? null,
    p_attack_power: edit.attackPower ?? null,
  })
  if (error) throw adminError(error)
}

export async function adminDeletePlayer(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_player', { p_user_id: userId })
  if (error) throw adminError(error)
}

export async function adminSetSuspended(userId: string, suspended: boolean, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_suspended', {
    p_user_id: userId,
    p_suspended: suspended,
    p_reason: reason || null,
  })
  if (error) throw adminError(error)
}

export async function adminSetAdmin(email: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_admin', { p_email: email, p_is_admin: isAdmin })
  if (error) throw adminError(error)
}

// Password resets go through Supabase's own email flow rather than an RPC
// that sets a password: the admin never gets to see or choose it, and the
// link lands in the player's inbox. Same call the login screen's "forgot
// password" uses, so it arrives on the same ResetPasswordScreen.
export async function adminSendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw new Error(error.message)
}

// Is *this* account suspended? Asked once per session alongside the save, and
// again is not the security boundary — RLS is (migrations_014). This only
// decides whether to show the player the "บัญชีถูกระงับ" screen instead of a
// dungeon whose every write would silently fail.
export async function fetchMySuspension(): Promise<{ suspended: boolean; reason: string | null }> {
  const { data, error } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (error || !userId) return { suspended: false, reason: null }

  const { data: rows, error: readError } = await supabase
    .from('profiles')
    .select('suspended_at, suspended_reason')
    .eq('id', userId)
    .maybeSingle()

  // A project without migrations_014 has no such column, which simply means
  // nobody can be suspended yet.
  if (readError) return { suspended: false, reason: null }
  const row = rows as { suspended_at: string | null; suspended_reason: string | null } | null
  return { suspended: row?.suspended_at != null, reason: row?.suspended_reason ?? null }
}
