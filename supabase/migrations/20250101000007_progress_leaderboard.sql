-- Run this after migrations_002 through migrations_006 in the Supabase SQL
-- Editor.
--
-- game_saves has owner-only RLS ("users manage their own save"), so the
-- client can never query other players' current_level directly. This adds a
-- SECURITY DEFINER RPC (same pattern as is_character_name_taken /
-- resolve_login_email) that exposes just enough per-player progress data —
-- display name, current level, and whether they've beaten the game — for
-- Leaderboard.tsx to show everyone's standing, not only the top scorers.
--
-- Ordering: conquerors (a row in `scores`) always sort first — ranked among
-- themselves by monsters_defeated desc then completed_at asc, same as the
-- old top-scores query — then everyone else by current_level desc so the
-- player furthest into the dungeon ranks highest among non-conquerors.
create or replace function public.get_progress_leaderboard()
returns table (
  display_name text,
  character_name text,
  current_level int,
  is_conqueror boolean,
  monsters_defeated int,
  completed_at timestamptz
)
language sql
security definer set search_path = public
stable
as $$
  select
    p.display_name,
    gs.character_name,
    gs.current_level,
    best.monsters_defeated is not null as is_conqueror,
    best.monsters_defeated,
    best.completed_at
  from public.game_saves gs
  join public.profiles p on p.id = gs.user_id
  left join lateral (
    select sc.monsters_defeated, sc.completed_at
    from public.scores sc
    where sc.user_id = gs.user_id
    order by sc.monsters_defeated desc, sc.completed_at asc
    limit 1
  ) best on true
  order by
    (best.monsters_defeated is not null) desc,
    best.monsters_defeated desc nulls last,
    best.completed_at asc nulls last,
    gs.current_level desc,
    gs.updated_at asc
  limit 100;
$$;

revoke all on function public.get_progress_leaderboard() from public;
grant execute on function public.get_progress_leaderboard() to anon, authenticated;
