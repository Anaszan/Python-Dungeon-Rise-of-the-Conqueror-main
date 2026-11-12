-- Run this after migrations_002, migrations_003 and migrations_004 in the
-- Supabase SQL Editor.
--
-- Adds the player's chosen character class + skin color to the existing
-- per-user save slot, so the character-customize screen only needs to be
-- shown once per account (not once per browser/session).

alter table public.game_saves
  add column character_class text check (character_class in ('warrior', 'cleric', 'wizard', 'rogue')),
  add column skin_color text;
