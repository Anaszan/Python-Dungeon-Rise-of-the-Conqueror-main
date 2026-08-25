// How the player fights every monster in the dungeon. This is a *coding*
// difficulty, not a combat one: monster HP, damage and cooldowns are identical
// in both modes (see CombatTicker/levels.ts — nothing there reads this). What
// changes is what the two code boxes in a fight ask of the player.
//
//   easy — the fill-in-the-blank skeletons the game has always shipped with
//          (lessons.ts attackSkeletons/skillSkeletons): one `___` to replace,
//          the rest of the spell is written for you.
//   hard — the monster hands over a โจทย์ (trials.ts): an empty editor, a
//          written brief, and a checklist of the chapter's syntax that the
//          code has to actually contain before the spell is allowed to fire.
//
// The end-of-level exam (LevelExamOverlay) is deliberately the same in both
// modes — it was already a write-it-from-scratch test. Hard mode is what makes
// every ordinary monster on the way to it feel like one too.
export type Difficulty = 'easy' | 'hard'

// What a save written before migrations_011 (or a player who somehow reaches
// combat without choosing) fights at. Never used to skip the picker — a null
// difficulty in the store is what sends the player to DifficultySelect.
export const DEFAULT_DIFFICULTY: Difficulty = 'easy'

export type DifficultyOption = {
  id: Difficulty
  name: string
  eyebrow: string
  tagline: string
  bullets: string[]
  // A tiny before/after of what one attack box looks like in this mode, shown
  // on the picker so the choice is concrete instead of two adjectives.
  sample: string
}

export const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    id: 'easy',
    name: 'ง่าย — เติมคำในช่องว่าง',
    eyebrow: 'ผู้ฝึกหัด',
    tagline: 'อาจารย์เขียนคาถาไว้ให้แล้ว เจ้าเติมแค่ส่วนที่ขาด',
    bullets: [
      'ทุกครั้งที่เจอมอนสเตอร์ จะมีโค้ดตั้งต้นให้พร้อม เหลือแค่ช่อง ___ ให้เติม',
      'เหมาะกับคนที่เพิ่งเริ่มเขียน Python หรืออยากดูโครงคาถาที่ถูกต้องก่อน',
      'ยังต้องผ่านบทสอบจบด่านที่ต้องเขียนเองทั้งหมดเหมือนกัน',
    ],
    sample: `damage = ___  # TODO: ใส่ตัวแปรพลังโจมตี

attack(damage)`,
  },
  {
    id: 'hard',
    name: 'ยาก — เขียนตามโจทย์ของมอนสเตอร์',
    eyebrow: 'ผู้ท้าชิง',
    tagline: 'มอนสเตอร์ส่งโจทย์มาให้ เจ้าต้องเขียนคาถาเองทั้งหมด',
    bullets: [
      'ไม่มีโค้ดตั้งต้นให้เติม — มีแต่โจทย์ + เงื่อนไขที่คาถาต้องทำให้ครบ',
      'คาถาจะร่ายไม่ออกจนกว่าโค้ดของเจ้าจะเข้าเงื่อนไขของโจทย์ครบทุกข้อ',
      'มอนสเตอร์แต่ละตัวในด่านเดียวกันได้โจทย์คนละแบบ และมีคำใบ้ให้เมื่อจนมุม',
    ],
    sample: `# โจทย์: รายงานพลังก่อนลงมือ
# 1. สร้างตัวแปรเก็บพลังจาก atk
# 2. รายงานด้วย print()
# 3. ส่งเข้า attack(...)`,
  },
]

export function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'hard'
}

// Short label for the badge shown in the corner of a fight / on the pause menu.
export function difficultyLabel(id: Difficulty): string {
  return id === 'hard' ? 'โหมดยาก · เขียนตามโจทย์' : 'โหมดง่าย · เติมช่องว่าง'
}
