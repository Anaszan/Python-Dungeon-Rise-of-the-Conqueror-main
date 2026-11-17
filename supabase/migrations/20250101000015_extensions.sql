-- Runs before everything else. Nothing in the game calls these directly; they
-- are what the later migrations assume is already there.
--
-- On a hosted Supabase project this file is a no-op: the platform creates the
-- `extensions` schema and installs pgcrypto into it before you ever see the
-- project, which is why migrations_014 could write `extensions.crypt(...)` in
-- admin_create_player without ever asking for the extension. A local stack
-- from `supabase start` is built from the same image and so has it too — but
-- "the base image happens to ship it" is not something a migration should
-- rest on when saying so costs two statements and both are idempotent.
--
-- pgcrypto is the one that matters: crypt() / gen_salt('bf') are how
-- admin_create_player hashes the password for an account the admin creates by
-- hand, and a missing extension there fails at the moment an admin tries to
-- add a player, not at setup time where it would be obvious.

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
