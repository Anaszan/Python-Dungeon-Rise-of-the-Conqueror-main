export type CharacterClass = 'warrior' | 'cleric' | 'wizard' | 'rogue'
export type CharacterGender = 'male' | 'female'

// Everything about a character the player is free to change afterwards, which
// is everything except the name — that is claimed once, when the character is
// created, and is the one part of them another player can collide with (see
// game/characterName.ts).
export type AppearanceChoice = {
  characterClass: CharacterClass
  gender: CharacterGender
  skinColor: string
  shirtColor: string | null
}

export const DEFAULT_CHARACTER_CLASS: CharacterClass = 'warrior'
export const DEFAULT_GENDER: CharacterGender = 'male'
export const DEFAULT_SKIN_COLOR = '#e0b48a'

export const CHARACTER_CLASS_OPTIONS: { id: CharacterClass; label: string }[] = [
  { id: 'warrior', label: 'นักรบ' },
  { id: 'cleric', label: 'นักบวช' },
  { id: 'wizard', label: 'นักเวท' },
  { id: 'rogue', label: 'โจร' },
]

export const GENDER_OPTIONS: { id: CharacterGender; label: string }[] = [
  { id: 'male', label: 'ชาย' },
  { id: 'female', label: 'หญิง' },
]

export const SKIN_COLOR_OPTIONS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5a3825']

// The outfit palette, kept apart from the skin one so the two pickers can
// never dress a character in a skin tone (or paint a face green). A null
// shirt color means "leave the outfit the color it ships in" — see
// defaultShirtColor in characterAssets.ts.
export const SHIRT_COLOR_OPTIONS = [
  '#b23b3b',
  '#c9762a',
  '#c9a227',
  '#3f7a4a',
  '#2f6fa8',
  '#6b4fa0',
  '#e9e1cd',
  '#3a3f4a',
]
