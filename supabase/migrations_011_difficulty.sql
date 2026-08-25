-- Run this after migrations_010 in the Supabase SQL Editor.
--
-- Remembers which combat mode the player picked on the DifficultySelect screen
-- (see src/game/difficulty.ts):
--   'easy' — the fill-in-the-blank skeletons the game has always used
--   'hard' — every monster hands over a written โจทย์ and an empty editor
--
-- Existing rows keep a null difficulty, which loadSave() reads as "never
-- chosen": those players see the picker once on their next visit and the
-- answer is stored from then on. The check constraint allows null for exactly
-- that reason.
--
-- The game also runs without this migration — persistence.ts notices the
-- missing column, warns once, and keeps playing (the mode is then re-asked
-- every session instead of being remembered).

alter table public.game_saves
  add column difficulty text;

alter table public.game_saves
  add constraint game_saves_difficulty_check
  check (difficulty is null or difficulty in ('easy', 'hard'));
