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

-- Written to be safe to run more than once: the SQL Editor makes it very easy
-- to re-run a file, and a plain `add column` answers that with
-- "42701: column already exists" — an error that looks like a broken migration
-- when nothing is actually wrong. Both statements below are no-ops the second
-- time through.

alter table public.game_saves
  add column if not exists difficulty text;

-- Postgres has no `add constraint if not exists`, so drop-then-add is the
-- idempotent form. Dropping is safe here: the constraint is re-created in the
-- same statement pair, and it only ever rejected values the app never writes.
alter table public.game_saves
  drop constraint if exists game_saves_difficulty_check;

alter table public.game_saves
  add constraint game_saves_difficulty_check
  check (difficulty is null or difficulty in ('easy', 'hard'));
