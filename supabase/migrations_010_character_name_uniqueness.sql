-- Run this after migrations_009 in the Supabase SQL Editor.
--
-- Closes three holes in the unique character name added by migrations_006.
--
-- 1. Uniqueness was exact-text, so "Elora", "elora" and " Elora " could all
--    be taken at once — three players with, as far as anyone reading the
--    leaderboard is concerned, the same name.
-- 2. is_character_name_taken matched the same exact-text way, and also
--    reported a player's own name back to them as taken.
-- 3. Nothing decided the race. Two players can both be told a free name is
--    free; only the one that gets there first may keep it, and until now the
--    loser's save simply failed to write while the game let them play on
--    under a name that was never theirs. claim_character_name below is what
--    the customize screen now has to win before it will start the game.

-- If this fails, two saves already differ only by case or padding. Find them
-- with
--   select lower(btrim(character_name)), count(*)
--   from public.game_saves
--   where character_name is not null
--   group by 1 having count(*) > 1;
-- and rename all but one of each group before running this again.
alter table public.game_saves
  drop constraint if exists game_saves_character_name_key;

create unique index if not exists game_saves_character_name_lower_key
  on public.game_saves (lower(btrim(character_name)));

-- Matches the index above, so the screen and the database always agree on
-- what "already taken" means. `user_id is distinct from auth.uid()` is what
-- lets a returning player re-confirm the name they already own.
create or replace function public.is_character_name_taken(p_name text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists(
    select 1
    from public.game_saves
    where lower(btrim(character_name)) = lower(btrim(p_name))
      and user_id is distinct from auth.uid()
  );
$$;

revoke all on function public.is_character_name_taken(text) from public;
grant execute on function public.is_character_name_taken(text) to anon, authenticated;

-- Takes the name for the caller, or reports back that someone else got it
-- first. The insert and the uniqueness test are one statement, so there is no
-- window between them for a second player to slip through — which is exactly
-- what a check-then-save from the client cannot promise.
--
-- It writes nothing but the name: the rest of the save follows from the game
-- itself (see saveProgress), and a claim that dragged default HP or level
-- along would quietly reset a returning player's progress.
create or replace function public.claim_character_name(p_name text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_name);
begin
  if v_user is null or v_name = '' then
    return false;
  end if;

  insert into public.game_saves (user_id, character_name)
  values (v_user, v_name)
  on conflict (user_id) do update set character_name = excluded.character_name;

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.claim_character_name(text) from public;
grant execute on function public.claim_character_name(text) to authenticated;
