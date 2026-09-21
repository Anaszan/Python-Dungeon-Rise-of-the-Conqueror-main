-- Run this after migrations_012 in the Supabase SQL Editor.
--
-- Remembers where in the dungeon the player was standing, so logging back in
-- (or reloading the page) puts them back on that spot instead of at the
-- level's entrance. Shape: {"level": 2, "x": -4.3, "z": -17.8}
--
--   level — which level the spot belongs to. A spot is only ever used on the
--           level it was recorded on; anything else falls back to the spawn.
--   x, z  — floor coordinates. Height is not stored: every level's floor is
--           flat and the game puts the player at the spawn height.
--
-- Written by the game every few steps of walking (see GameScene.tsx), cleared
-- on restart and whenever the level changes.
--
-- Optional, like shirt_color and difficulty: without this column the game
-- warns once in the console and keeps playing, it just starts every session
-- at the level's entrance. Safe to run more than once.

alter table public.game_saves
  add column if not exists last_position jsonb;
