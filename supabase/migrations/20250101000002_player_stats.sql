-- Run this in the Supabase SQL Editor (adds player HP/attack-power/pickup
-- tracking to the save slot created by schema.sql — safe to run even if
-- some columns already exist).

alter table public.game_saves
  add column if not exists player_hp int not null default 200,
  add column if not exists attack_power int not null default 10,
  add column if not exists collected_pickup_ids text[] not null default '{}';
