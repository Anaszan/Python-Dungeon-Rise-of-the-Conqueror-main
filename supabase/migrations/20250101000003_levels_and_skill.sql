-- Run this in the Supabase SQL Editor (adds level progress and special-skill
-- cooldown tracking to the save slot — safe to run even if columns already
-- exist).

alter table public.game_saves
  add column if not exists current_level int not null default 1,
  add column if not exists skill_cooldown numeric not null default 0;
