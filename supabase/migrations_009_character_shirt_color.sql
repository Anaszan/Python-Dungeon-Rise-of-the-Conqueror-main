-- Run this after migrations_008 in the Supabase SQL Editor.
--
-- Splits the character's colors in two: skin_color (migrations_005) now only
-- drives the bare skin, and this column drives the outfit. Existing rows keep
-- a null shirt_color; loadSave() leaves it null, and CharacterModel renders a
-- null shirt as the color the class's model already ships in — so characters
-- created before this migration look unchanged until their player picks a
-- shirt color on the customize screen.

alter table public.game_saves
  add column shirt_color text;
