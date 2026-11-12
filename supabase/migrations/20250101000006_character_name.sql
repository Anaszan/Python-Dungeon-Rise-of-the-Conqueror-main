-- Run this after migrations_002 through migrations_005 in the Supabase SQL
-- Editor.
--
-- Adds a player-chosen character name to the existing save slot, enforced
-- unique at the DB level (source of truth for races), plus an RPC so the
-- character-customize screen can show a friendly "already taken" error
-- before submitting, mirroring is_identifier_taken from migrations_004.

alter table public.game_saves
  add column character_name text unique;

create or replace function public.is_character_name_taken(p_name text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists(select 1 from public.game_saves where character_name = p_name);
$$;

revoke all on function public.is_character_name_taken(text) from public;
grant execute on function public.is_character_name_taken(text) to anon, authenticated;
