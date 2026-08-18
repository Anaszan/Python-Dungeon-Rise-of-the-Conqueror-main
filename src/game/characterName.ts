// The rules for the name a player plays under, kept in one place because the
// same name is checked in three: the customize screen validates it, an RPC
// asks whether it is free, and a unique index in Postgres has the final say
// (see migrations_010). All three have to agree on what counts as the same
// name, or the screen will happily accept a name the database then refuses.

export const NAME_MIN_LENGTH = 2
export const NAME_MAX_LENGTH = 20

// What the database stores and compares. Postgres matches on
// `lower(btrim(character_name))`, so "Elora", " Elora " and "elora" are one
// name there; collapsing runs of whitespace on the way in closes the last gap
// ("El  ora" vs "El ora"), which Postgres would otherwise treat as two.
export function normalizeCharacterName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function isValidCharacterName(name: string) {
  const normalized = normalizeCharacterName(name)
  return normalized.length >= NAME_MIN_LENGTH && normalized.length <= NAME_MAX_LENGTH
}

// Two names collide when the database would consider them the same, which is
// not the same question as whether they look the same.
export function isSameCharacterName(a: string, b: string) {
  return normalizeCharacterName(a).toLowerCase() === normalizeCharacterName(b).toLowerCase()
}
