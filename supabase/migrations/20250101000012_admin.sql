-- Run this after migrations_011 in the Supabase SQL Editor.
--
-- Adds the game's admin role: an allow-list of emails, a helper the client can
-- ask "am I one of them?", and one read-only RPC that returns every player's
-- progress for the admin dashboard.
--
-- Why an email allow-list and not a flag on profiles: profiles is
-- world-readable (the leaderboard needs it), so an `is_admin` column there
-- would publish who the admins are. This table is RLS-enabled with *no
-- policies at all*, which denies every normal client — the only way in is
-- through the SECURITY DEFINER functions below, which run as the owner.
--
-- Safe to run more than once.

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_emails enable row level security;

-- Seed the first admin. Add more the same way (emails are matched
-- case-insensitively, so store them lowercase):
--   insert into public.admin_emails (email) values ('someone@example.com')
--     on conflict (email) do nothing;
insert into public.admin_emails (email)
values ('teerapatmonta2@gmail.com')
on conflict (email) do nothing;

-- Is the *caller* an admin? Every admin-only path goes through this, both in
-- SQL (get_admin_player_overview) and in the client (which uses it only to
-- decide whether to render the admin UI — the real gate is the check inside
-- the RPC, so hiding the button is cosmetic, not the security boundary).
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_emails a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Every player's save in one read, for the admin dashboard. game_saves is
-- owner-only RLS, so this is the same SECURITY DEFINER pattern
-- get_progress_leaderboard() uses — except this one carries private data
-- (email, HP, exact progress) and therefore refuses to return anything at all
-- unless the caller is an admin.
--
-- Dropped first because a `create or replace` cannot change a function's
-- return type, which makes re-running an edited version fail confusingly.
drop function if exists public.get_admin_player_overview();

create function public.get_admin_player_overview()
returns table (
  user_id uuid,
  email text,
  display_name text,
  nickname text,
  character_name text,
  character_class text,
  difficulty text,
  current_level int,
  player_hp int,
  attack_power int,
  monsters_defeated int,
  pickups_collected int,
  is_conqueror boolean,
  best_score int,
  completed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer set search_path = public
stable
-- The body opens with `#variable_conflict use_column` (which has to be the
-- very first thing after $$): every OUT column named above is also a plpgsql
-- variable inside the body, so an unqualified column of the same name would be
-- ambiguous. Every reference below is table-qualified already — this is the
-- belt to that pair of braces.
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    -- 42501 is insufficient_privilege; PostgREST turns it into a 403 rather
    -- than a silent empty list, so a non-admin who calls this by hand is told
    -- no instead of being left wondering whether there are simply no players.
    raise exception 'admin privileges required' using errcode = '42501';
  end if;

  return query
    select
      gs.user_id,
      u.email::text,
      p.display_name,
      p.nickname,
      gs.character_name,
      gs.character_class,
      gs.difficulty,
      gs.current_level,
      gs.player_hp,
      gs.attack_power,
      coalesce(array_length(gs.defeated_monster_ids, 1), 0) as monsters_defeated,
      coalesce(array_length(gs.collected_pickup_ids, 1), 0) as pickups_collected,
      best.monsters_defeated is not null as is_conqueror,
      best.monsters_defeated as best_score,
      best.completed_at,
      gs.updated_at
    from public.game_saves gs
    -- Left joins on purpose, unlike get_progress_leaderboard's inner join: a
    -- save whose profile row is somehow missing is exactly the kind of thing
    -- an admin needs to be able to see, not the kind that should vanish from
    -- the list.
    left join public.profiles p on p.id = gs.user_id
    left join auth.users u on u.id = gs.user_id
    left join lateral (
      select sc.monsters_defeated, sc.completed_at
      from public.scores sc
      where sc.user_id = gs.user_id
      order by sc.monsters_defeated desc, sc.completed_at asc
      limit 1
    ) best on true
    order by gs.updated_at desc;
end;
$$;

revoke all on function public.get_admin_player_overview() from public;
grant execute on function public.get_admin_player_overview() to authenticated;
