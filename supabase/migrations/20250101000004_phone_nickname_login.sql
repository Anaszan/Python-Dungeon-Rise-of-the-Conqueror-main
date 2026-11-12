-- Run this after migrations_002 and migrations_003 in the Supabase SQL Editor.
--
-- Adds phone number + nickname registration and lets players log in with
-- email OR phone OR nickname (Supabase Auth itself is still email-keyed, so
-- non-email identifiers are resolved to an email server-side first).

-- profiles.nickname: a public handle, same visibility as display_name
-- (already publicly readable — safe, it's just a username).
alter table public.profiles
  add column nickname text unique;

-- Phone numbers are personal info and must NOT be publicly readable the way
-- profiles is, so they live in their own table with owner-only RLS instead
-- of being added as a column on profiles.
create table public.user_contacts (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique
);

alter table public.user_contacts enable row level security;

create policy "users manage their own contact info"
  on public.user_contacts for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Recreate the signup trigger to also capture nickname/phone from the
-- signUp() metadata payload ({ data: { nickname, phone } }).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, nickname)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'nickname'
  );

  if new.raw_user_meta_data->>'phone' is not null then
    insert into public.user_contacts (id, phone)
    values (new.id, new.raw_user_meta_data->>'phone');
  end if;

  return new;
end;
$$;

-- Looks up the email for a nickname or phone identifier so the client can
-- sign in with supabase.auth.signInWithPassword({ email, password }) even
-- when the player typed their phone/nickname. SECURITY DEFINER so it can
-- read auth.users.email and the owner-only user_contacts table, but it only
-- ever returns a single matched email — same trust model as a "forgot
-- password" email lookup.
create or replace function public.resolve_login_email(identifier text)
returns text
language plpgsql
security definer set search_path = public
stable
as $$
declare
  result_email text;
begin
  select u.email into result_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_contacts c on c.id = u.id
  where p.nickname = identifier or c.phone = identifier
  limit 1;

  return result_email;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- Lets the sign-up form show a friendly "already taken" error before
-- submitting, instead of a raw unique-constraint violation. Needed for phone
-- specifically since user_contacts isn't publicly readable.
create or replace function public.is_identifier_taken(p_nickname text, p_phone text)
returns table (nickname_taken boolean, phone_taken boolean)
language sql
security definer set search_path = public
stable
as $$
  select
    exists(select 1 from public.profiles where nickname = p_nickname) as nickname_taken,
    exists(select 1 from public.user_contacts where phone = p_phone) as phone_taken;
$$;

revoke all on function public.is_identifier_taken(text, text) from public;
grant execute on function public.is_identifier_taken(text, text) to anon, authenticated;
