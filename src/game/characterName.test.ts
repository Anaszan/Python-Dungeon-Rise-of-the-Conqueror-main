// These rules exist to agree with a unique index on
// `lower(btrim(character_name))` (migrations_010). Every case below is a name
// pair the screen used to accept as two different players.
import { describe, expect, it } from 'vitest'
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  isSameCharacterName,
  isValidCharacterName,
  normalizeCharacterName,
} from './characterName'

describe('normalizeCharacterName', () => {
  it('strips the padding Postgres would strip', () => {
    expect(normalizeCharacterName('  Elora  ')).toBe('Elora')
    expect(normalizeCharacterName('\tElora\n')).toBe('Elora')
  })

  it('collapses runs of whitespace, which Postgres would not', () => {
    expect(normalizeCharacterName('El   ora')).toBe('El ora')
    expect(normalizeCharacterName('Dark  Knight')).toBe('Dark Knight')
  })

  it('leaves an ordinary name alone', () => {
    expect(normalizeCharacterName('Elora')).toBe('Elora')
    expect(normalizeCharacterName('อีโลร่า')).toBe('อีโลร่า')
  })
})

describe('isSameCharacterName', () => {
  it('treats case, padding and spacing differences as the same name', () => {
    expect(isSameCharacterName('Elora', 'elora')).toBe(true)
    expect(isSameCharacterName('Elora', ' ELORA ')).toBe(true)
    expect(isSameCharacterName('Dark Knight', 'dark  knight')).toBe(true)
  })

  it('still tells genuinely different names apart', () => {
    expect(isSameCharacterName('Elora', 'Elara')).toBe(false)
    expect(isSameCharacterName('Elora', 'Elora2')).toBe(false)
    expect(isSameCharacterName('อีโลร่า', 'อีโลรา')).toBe(false)
  })
})

describe('isValidCharacterName', () => {
  it('measures the name the database will store, not what was typed', () => {
    expect(isValidCharacterName(`  ${'a'.repeat(NAME_MIN_LENGTH)}  `)).toBe(true)
    // Padding must not push a legal name over the limit...
    expect(isValidCharacterName(`  ${'a'.repeat(NAME_MAX_LENGTH)}  `)).toBe(true)
    // ...nor let an over-long one squeak under it.
    expect(isValidCharacterName('a'.repeat(NAME_MAX_LENGTH + 1))).toBe(false)
  })

  it('rejects a name that is nothing but whitespace', () => {
    expect(isValidCharacterName('   ')).toBe(false)
    expect(isValidCharacterName('')).toBe(false)
  })

  it('rejects a name shorter than the minimum once trimmed', () => {
    expect(isValidCharacterName(' a ')).toBe(false)
  })
})
