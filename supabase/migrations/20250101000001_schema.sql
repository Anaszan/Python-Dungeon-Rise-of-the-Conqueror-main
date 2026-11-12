-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).

-- profiles: one row per authenticated user, readable by everyone (needed for
-- the leaderboard to show display names), writable only by the owner.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- game_saves: one save slot per user, tracks which monsters/pickups are
-- collected and the player's current HP / attack power.
create table public.game_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  defeated_monster_ids text[] not null default '{}',
  collected_pickup_ids text[] not null default '{}',
  player_hp int not null default 200,
  attack_power int not null default 10,
  updated_at timestamptz not null default now()
);

alter table public.game_saves enable row level security;

create policy "users manage their own save"
  on public.game_saves for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- scores: leaderboard entries, readable by everyone, insertable only by the
-- owning user. References profiles (not auth.users directly) so PostgREST
-- can embed the display name when the leaderboard queries scores.
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  monsters_defeated int not null,
  completed_at timestamptz not null default now()
);

alter table public.scores enable row level security;

create policy "scores are viewable by everyone"
  on public.scores for select
  using (true);

create policy "users insert their own score"
  on public.scores for insert
  with check (auth.uid() = user_id);
