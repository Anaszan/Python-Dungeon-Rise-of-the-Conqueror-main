-- Run this after migrations_007 in the Supabase SQL Editor.
--
-- Adds the player's chosen gender to the per-user save slot, alongside the
-- character class / skin color from migrations_005. Existing rows keep a
-- null gender; loadSave() falls back to DEFAULT_GENDER ('male') for them, so
-- players created before this migration keep the model they already had.

alter table public.game_saves
  add column gender text check (gender in ('male', 'female'));
