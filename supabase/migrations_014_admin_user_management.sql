-- Run this after migrations_013 in the Supabase SQL Editor.
--
-- Gives the admin role the four powers the spec asks for — เพิ่ม / แก้ไข / ลบ /
-- ระงับผู้ใช้ — plus the suspension enforcement that makes "ระงับ" mean
-- something rather than just greying out a row in a table.
--
-- Everything here is SECURITY DEFINER and starts by asking public.is_admin()
-- (migrations_012). That check is the whole security boundary: the client is
-- an anon-key browser app, so anything it is allowed to call, any player can
-- call. Hiding a button is decoration; this file is the lock.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Suspension
-- ---------------------------------------------------------------------------
-- A suspended player can still sign in and read their own save (the game
-- shows them a "บัญชีถูกระงับ" screen and signs them out), but the database
-- stops accepting any *write* from them: no progress, no score, no rename.
-- Enforcing it in RLS rather than in the client is the point — a suspended
-- player who patches the JavaScript still cannot write a single row.
alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  add column if not exists suspended_reason text;

create or replace function public.is_suspended(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and suspended_at is not null
  );
$$;

revoke all on function public.is_suspended(uuid) from public;
grant execute on function public.is_suspended(uuid) to authenticated;

-- game_saves: reading your own save stays allowed while suspended (the game
-- has to be able to tell you who you are before it turns you away), writing
-- does not. Split into four policies because the old catch-all "for all"
-- could not say "read yes, write no".
drop policy if exists "users manage their own save" on public.game_saves;
drop policy if exists "users read their own save" on public.game_saves;
drop policy if exists "users insert their own save" on public.game_saves;
drop policy if exists "users update their own save" on public.game_saves;
drop policy if exists "users delete their own save" on public.game_saves;

create policy "users read their own save"
  on public.game_saves for select
  using (auth.uid() = user_id);

create policy "users insert their own save"
  on public.game_saves for insert
  with check (auth.uid() = user_id and not public.is_suspended(auth.uid()));

create policy "users update their own save"
  on public.game_saves for update
  using (auth.uid() = user_id and not public.is_suspended(auth.uid()))
  with check (auth.uid() = user_id and not public.is_suspended(auth.uid()));

create policy "users delete their own save"
  on public.game_saves for delete
  using (auth.uid() = user_id and not public.is_suspended(auth.uid()));

-- A suspended player may not put a new score on the leaderboard either.
drop policy if exists "users insert their own score" on public.scores;
create policy "users insert their own score"
  on public.scores for insert
  with check (auth.uid() = user_id and not public.is_suspended(auth.uid()));

-- ...nor rename themselves out of a moderation problem.
drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id and not public.is_suspended(auth.uid()))
  with check (auth.uid() = id and not public.is_suspended(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. The admin's four actions
-- ---------------------------------------------------------------------------

-- เพิ่ม — create an account without going through the signup screen.
--
-- CAVEAT, and it is a real one: this writes into auth.users directly, which is
-- GoTrue's own table and not a documented API. It works today (and is the only
-- way to do it without shipping a service_role key or deploying an Edge
-- Function), but a future Supabase release can change those columns and break
-- it. If this ever starts failing, the fix is to move *this one function* to an
-- Edge Function calling auth.admin.createUser; nothing else in this file cares.
--
-- The empty-string token columns are deliberate: GoTrue scans them into Go
-- strings and errors on NULL, which shows up as a login that fails for no
-- visible reason.
create or replace function public.admin_create_player(
  p_email text,
  p_password text,
  p_display_name text default null,
  p_nickname text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(btrim(p_email));
begin
  if not public.is_admin() then
    raise exception 'admin privileges required' using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'อีเมลไม่ถูกต้อง' using errcode = '22023';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'อีเมลนี้ถูกใช้ไปแล้ว' using errcode = '23505';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    case when p_nickname is null then '{}'::jsonb else jsonb_build_object('nickname', p_nickname) end,
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  -- Email sign-in looks the account up through identities, not through
  -- auth.users alone: without this row the password is correct and the login
  -- still fails.
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- handle_new_user() (migrations_004) already made the profile row from the
  -- metadata above; this only fills in a display name the admin typed.
  if p_display_name is not null and btrim(p_display_name) <> '' then
    update public.profiles set display_name = btrim(p_display_name) where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_create_player(text, text, text, text) from public;
grant execute on function public.admin_create_player(text, text, text, text) to authenticated;

-- แก้ไข — names and game progress. Every parameter is optional: null means
-- "leave this one alone", so the client can send only what the admin typed.
create or replace function public.admin_update_player(
  p_user_id uuid,
  p_display_name text default null,
  p_nickname text default null,
  p_character_name text default null,
  p_current_level int default null,
  p_player_hp int default null,
  p_attack_power int default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin privileges required' using errcode = '42501';
  end if;

  update public.profiles
  set display_name = coalesce(nullif(btrim(p_display_name), ''), display_name),
      nickname = coalesce(nullif(btrim(p_nickname), ''), nickname)
  where id = p_user_id;

  -- A player who has not started the game has no save row yet, so there is
  -- nothing to update — and creating a half-made one here would send them
  -- into a dungeon without a character.
  update public.game_saves
  set character_name = coalesce(nullif(btrim(p_character_name), ''), character_name),
      current_level = coalesce(p_current_level, current_level),
      player_hp = coalesce(p_player_hp, player_hp),
      attack_power = coalesce(p_attack_power, attack_power),
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.admin_update_player(uuid, text, text, text, int, int, int) from public;
grant execute on function public.admin_update_player(uuid, text, text, text, int, int, int) to authenticated;

-- ลบ — the account and everything hanging off it. profiles, game_saves,
-- user_contacts and scores are all `on delete cascade` from auth.users, so
-- this one delete takes the whole player with it.
create or replace function public.admin_delete_player(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin privileges required' using errcode = '42501';
  end if;
  -- An admin deleting themselves mid-session is a support ticket nobody can
  -- answer: the allow-list would still name an email with no account behind it.
  if p_user_id = auth.uid() then
    raise exception 'ลบบัญชีของตัวเองไม่ได้' using errcode = '22023';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_player(uuid) from public;
grant execute on function public.admin_delete_player(uuid) to authenticated;

-- ระงับ / ปลดระงับ.
create or replace function public.admin_set_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin privileges required' using errcode = '42501';
  end if;
  if p_suspended and p_user_id = auth.uid() then
    raise exception 'ระงับบัญชีของตัวเองไม่ได้' using errcode = '22023';
  end if;

  update public.profiles
  set suspended_at = case when p_suspended then now() else null end,
      suspended_reason = case when p_suspended then nullif(btrim(p_reason), '') else null end
  where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_suspended(uuid, boolean, text) from public;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

-- Promoting/demoting another admin, so the allow-list is not a file only the
-- person with SQL Editor access can edit.
create or replace function public.admin_set_admin(p_email text, p_is_admin boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if not public.is_admin() then
    raise exception 'admin privileges required' using errcode = '42501';
  end if;
  -- The last admin removing their own access would leave the game with no way
  -- back in short of the SQL editor.
  if not p_is_admin and v_email = lower((select email from auth.users where id = auth.uid())) then
    raise exception 'ถอดสิทธิ์แอดมินของตัวเองไม่ได้' using errcode = '22023';
  end if;

  if p_is_admin then
    insert into public.admin_emails (email) values (v_email) on conflict (email) do nothing;
  else
    delete from public.admin_emails where lower(email) = v_email;
  end if;
end;
$$;

revoke all on function public.admin_set_admin(text, boolean) from public;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The dashboard, now carrying moderation state
-- ---------------------------------------------------------------------------
-- Same function as migrations_012 plus suspended_at / suspended_reason /
-- is_admin, so the table can show who is suspended and who has the keys.
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
  updated_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text,
  is_admin boolean
)
language plpgsql
security definer set search_path = public
stable
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin privileges required' using errcode = '42501';
  end if;

  return query
    select
      u.id,
      u.email::text,
      p.display_name,
      p.nickname,
      gs.character_name,
      gs.character_class,
      gs.difficulty,
      gs.current_level,
      gs.player_hp,
      gs.attack_power,
      coalesce(array_length(gs.defeated_monster_ids, 1), 0),
      coalesce(array_length(gs.collected_pickup_ids, 1), 0),
      best.monsters_defeated is not null,
      best.monsters_defeated,
      best.completed_at,
      gs.updated_at,
      p.suspended_at,
      p.suspended_reason,
      a.email is not null
    from auth.users u
    -- Driven off auth.users now, not game_saves: an account the admin just
    -- created has no save yet, and a player who cannot be seen cannot be
    -- moderated.
    left join public.profiles p on p.id = u.id
    left join public.game_saves gs on gs.user_id = u.id
    left join public.admin_emails a on lower(a.email) = lower(u.email)
    left join lateral (
      select sc.monsters_defeated, sc.completed_at
      from public.scores sc
      where sc.user_id = u.id
      order by sc.monsters_defeated desc, sc.completed_at asc
      limit 1
    ) best on true
    order by gs.updated_at desc nulls last, u.created_at desc;
end;
$$;

revoke all on function public.get_admin_player_overview() from public;
grant execute on function public.get_admin_player_overview() to authenticated;
