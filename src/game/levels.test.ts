// This is the one file under src/ that touches the filesystem — it checks the
// art in public/ actually exists. tsconfig.app.json limits `types` to
// vite/client so app code can't reach for node globals by accident, so pull
// the node types in here only.
/// <reference types="node" />
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_MONSTERS, LEVELS, LIGHT_DECORATION_KINDS } from './levels'
import { LESSONS } from './lessons'
import { canStandAt, hitsWall, isWalkable } from './dungeon'
import {
  ATTACK_PICKUP_AMOUNT,
  BASE_ATTACK_POWER,
  MONSTER_AGGRO_RANGE,
  LANTERN_RADIUS,
  SKILL_DAMAGE_MULTIPLIER,
} from './constants'

// Level *authoring* checks — the things that would make a level unfinishable
// or unfair without ever throwing an error at runtime. dungeon.test.ts covers
// whether the floor plan can be walked; this covers everything placed on it.

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

// Art lives in public/ and is served by path, so nothing type-checks these
// urls — resolve them off this file rather than the cwd so the check holds
// wherever vitest is launched from.
function publicPath(url: string) {
  return fileURLToPath(new URL(`../../public${url}`, import.meta.url))
}

// PNG: 8-byte signature, then the IHDR chunk, whose 10th byte is the color
// type. 4 (grey+alpha) and 6 (RGBA) are the two that carry an alpha channel.
function pngHasAlpha(file: string) {
  const b = readFileSync(file)
  expect(b.subarray(12, 16).toString(), `${file} is not a PNG`).toBe('IHDR')
  return b[25] === 4 || b[25] === 6
}

describe('campaign', () => {
  it('gives every level a chapter lesson to teach', () => {
    expect(LESSONS).toHaveLength(LEVELS.length)
    for (const level of LEVELS) {
      const lesson = LESSONS[level.level - 1]
      expect(lesson, `level ${level.level}`).toBeDefined()
      expect(lesson.attackSkeletons.length).toBeGreaterThan(0)
      expect(lesson.skillSkeletons.length).toBeGreaterThan(0)
    }
  })

  it('numbers its levels 1..n in order', () => {
    expect(LEVELS.map((l) => l.level)).toEqual(LEVELS.map((_, i) => i + 1))
  })

  it('keeps monster ids unique across every level', () => {
    // ALL_MONSTERS is looked up by id alone (see levels.ts), so a duplicate
    // would silently make two different monsters share one HP pool and one
    // defeated flag.
    const ids = ALL_MONSTERS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every monster a 2D sprite to fall back to', () => {
    // Both the dungeon and the battle screen draw the GLB now (MonsterArt),
    // so imageUrl is no longer what the fight looks at first — but it is the
    // whole fallback chain: a model that fails to load leaves a monster with
    // nothing but a colored blob in both places if it has no sprite either.
    for (const monster of ALL_MONSTERS) {
      expect(monster.imageUrl, `${monster.name} has no imageUrl`).toBeTruthy()
    }
  })

  it('gives every monster its own 3D model, not a borrowed one', () => {
    // The battle screen renders the model now, which is what finally made the
    // shared *sprites* visible as a bug (Orc Berserker wearing the Orc's
    // picture, all three Banshees the same). Sprites are still allowed to be
    // shared — they are only a fallback — but two monsters pointing at one
    // model would put that duplication straight back on screen.
    const withModel = ALL_MONSTERS.filter((m) => m.modelUrl)
    expect(withModel, 'every monster should ship a GLB model').toHaveLength(ALL_MONSTERS.length)

    const byModel = new Map<string, string[]>()
    for (const monster of withModel) {
      byModel.set(monster.modelUrl!, [...(byModel.get(monster.modelUrl!) ?? []), monster.name])
    }
    const shared = [...byModel.entries()].filter(([, names]) => names.length > 1)
    expect(shared.map(([url, names]) => `${url}: ${names.join(', ')}`)).toEqual([])
  })

  it('ships every art file it points at', () => {
    // These urls are plain strings resolved by the browser at runtime, so a
    // typo or a deleted file shows up as a missing sprite mid-fight and
    // nowhere else.
    for (const monster of ALL_MONSTERS) {
      for (const url of [monster.imageUrl, monster.modelUrl]) {
        if (!url) continue
        expect(existsSync(publicPath(url)), `${monster.name}: missing ${url}`).toBe(true)
      }
    }
  })

  it('uses cut-out sprites, not opaque tiles, for its monster art', () => {
    // Both places a sprite is drawn key it off alpha — the 3D scene discards
    // see-through pixels (alphaTest) and the combat screen just overlays the
    // PNG on the battle background. Art saved without an alpha channel is a
    // solid rectangle in both, so the monster reads as a photo tile pasted
    // onto the dungeon.
    for (const monster of ALL_MONSTERS) {
      if (!monster.imageUrl?.endsWith('.png')) continue
      expect(pngHasAlpha(publicPath(monster.imageUrl)), `${monster.name}: ${monster.imageUrl} has no alpha channel`).toBe(true)
    }
  })

  it('gives every level its own look, not just its own monsters', () => {
    // Levels 3-6 reuse an earlier level's floor plan on purpose (see the note
    // in levels.ts), so the theme and the prop list are the only things left
    // keeping two levels from being the same room twice. A copy-pasted theme
    // or decoration array is invisible until you walk into it.
    const themeIds = LEVELS.map((l) => l.theme.id)
    expect(new Set(themeIds).size, 'two levels share a theme').toBe(LEVELS.length)
    const decorations = LEVELS.map((l) => JSON.stringify(l.decorations ?? []))
    expect(new Set(decorations).size, 'two levels share a decoration list').toBe(LEVELS.length)
  })

  it('keeps pickup ids unique across every level', () => {
    // collectedPickupIds is a flat set in the store, so a reused id would
    // mark a later level's pickup as already taken.
    const ids = LEVELS.flatMap((l) => l.pickups).map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('hands out the same flat power step for every attack pickup', () => {
    // The exam damage targets below are sized against a player who has picked
    // up nothing at all, and the whole curve is "BASE + 10 per potion" — a
    // one-off bigger potion would quietly break both assumptions.
    for (const pickup of LEVELS.flatMap((l) => l.pickups)) {
      if (pickup.kind !== 'attack') continue
      expect(pickup.amount, `${pickup.id} is off the flat power curve`).toBe(ATTACK_PICKUP_AMOUNT)
    }
  })
})

// A correct answer to each chapter's end-of-level exam, kept here rather than
// in lessons.ts because the player must never be shipped the solution. Its
// job is to prove the `checks` regexes are actually satisfiable by real,
// idiomatic code for that chapter — a typo'd pattern that nothing can match
// would wall the player into a level with no way out, and there is no way to
// notice that short of playing to the end of a level.
//
// Only the regexes are asserted here; running these needs Pyodide, which is a
// CDN download at runtime and is not available in vitest. They are still
// written to genuinely clear their guardian at the worst-case atk of
// BASE_ATTACK_POWER, remembering castSpell's per-call caps (attack ≤ atk,
// skill ≤ atk × SKILL_DAMAGE_MULTIPLIER), so they stay honest answers rather
// than regex bait.
const EXAM_SOLUTIONS: Record<number, string> = {
  // ch2 — variables. 60 damage vs a 60 HP guardian.
  2: `damage = atk * 2
print(damage)
skill(damage)
`,
  // ch3 — conditionals. 90 damage (one maxed skill) vs a 90 HP guardian.
  3: `if monster_hp > 50:
    power = atk * 3
else:
    power = atk
skill(power)
`,
  // ch4 — loops. 4 × 30 vs a 120 HP guardian.
  4: `for i in range(4):
    attack(atk)
`,
  // ch5 — functions. 90 (capped skill) + 30 (capped attack) vs 120 HP.
  5: `def fireball(power):
    return power * 3

skill(fireball(atk))
attack(fireball(atk))
`,
  // ch6 — files. 90 damage vs a 90 HP guardian.
  6: `with open("spellbook.txt", "w") as f:
    f.write(str(atk))

with open("spellbook.txt", "r") as f:
    damage = int(f.read())

skill(damage * 3)
`,
  // ch7 — error handling. The division blows up, the fallback lands 90, and
  // the follow-up attack covers the last 30 of a 120 HP guardian.
  7: `try:
    power = atk // monster_armor
except ZeroDivisionError:
    power = atk * 3
skill(power)
attack(atk)
`,
}

describe.each(LESSONS)('level exam for chapter $chapter ($chapterTitle)', (lesson) => {
  const { exam } = lesson

  it('asks for something, and starts the player from a blank slate', () => {
    expect(exam.checks.length).toBeGreaterThan(0)
    expect(exam.brief.length).toBeGreaterThan(0)
    expect(exam.hints.length).toBeGreaterThan(0)
    // The exam is the one place the player writes the chapter from scratch —
    // a `___` in here would make it another fill-in-the-blank exercise.
    expect(exam.starterCode).not.toContain('___')
  })

  it('uses non-global check patterns', () => {
    // LevelExamOverlay re-tests every pattern on each keystroke. A /g regex
    // carries lastIndex between .test() calls, so the checklist would flicker
    // between passing and failing as the player types.
    for (const check of exam.checks) {
      expect(check.pattern.global, `${check.label} uses a global regex`).toBe(false)
    }
  })

  it('does not hand out any check for free in the starter code', () => {
    for (const check of exam.checks) {
      expect(check.pattern.test(exam.starterCode), `${check.label} already passes on an untouched editor`).toBe(false)
    }
  })

  it('passes every check on a real answer for its chapter', () => {
    const solution = EXAM_SOLUTIONS[lesson.chapter]
    expect(solution, `no reference solution for chapter ${lesson.chapter}`).toBeTruthy()
    for (const check of exam.checks) {
      expect(check.pattern.test(solution), `${check.label} rejects a correct chapter-${lesson.chapter} answer`).toBe(true)
    }
  })

  it('sets a guardian a player who collected nothing can still bring down', () => {
    // Worst case is a player who walked past every attack potion, so their
    // atk is still BASE_ATTACK_POWER. castSpell caps one skill() call at
    // atk × SKILL_DAMAGE_MULTIPLIER, and the guardian is restored to full
    // before each run — so anything past a couple of maxed casts turns the
    // exam into a damage grind rather than a test of the chapter.
    const strongestCast = BASE_ATTACK_POWER * SKILL_DAMAGE_MULTIPLIER
    expect(exam.guardianHp).toBeGreaterThan(0)
    expect(exam.guardianHp, 'guardian needs more than two maxed casts at base atk').toBeLessThanOrEqual(
      strongestCast * 2,
    )
  })
})

describe.each(LEVELS)('level $level ($name)', (level) => {
  const { regions, walls, spawnPosition } = level

  it('spawns the player on solid floor, clear of every wall', () => {
    expect(canStandAt(spawnPosition[0], spawnPosition[2], regions, walls)).toBe(true)
  })

  it('does not drop the player straight into a fight on arrival', () => {
    // Monsters swing at anything inside MONSTER_AGGRO_RANGE, every frame,
    // including the first one after a level advance — a monster parked on the
    // spawn point would start eating the player's HP before they could move.
    for (const monster of level.monsters) {
      expect(distance(spawnPosition, monster.position), monster.name).toBeGreaterThan(MONSTER_AGGRO_RANGE)
    }
  })

  it.each(level.monsters)('does not bury $name inside a wall', (monster) => {
    expect(hitsWall(monster.position[0], monster.position[2], walls, 0)).toBe(false)
  })

  it.each(level.pickups)('does not bury $id inside a wall', (pickup) => {
    expect(hitsWall(pickup.position[0], pickup.position[2], walls, 0)).toBe(false)
  })

  it.each(level.decorations ?? [])('stands $kind on floor the level actually has', (deco) => {
    // Props have no collision, so one placed off the floor plan doesn't break
    // anything — it just hangs in the void, or sits inside a wall with only
    // the half nobody can see poking out. Both are silent until someone walks
    // that far into the level. Props are allowed to touch a wall (a bookcase
    // has its back to one), which is why this tests the raw wall box with no
    // margin rather than the player's clearance.
    expect(isWalkable(deco.position[0], deco.position[2], regions), `${deco.kind} is off the floor plan`).toBe(true)
    expect(hitsWall(deco.position[0], deco.position[2], walls, 0), `${deco.kind} is buried in a wall`).toBe(false)
  })

  it('stocks a way to heal and a way to hit harder', () => {
    // HP carries across levels and never regenerates on its own, so a level
    // with no heal in it can only be survived on whatever the player walked
    // in with.
    expect(level.pickups.some((p) => p.kind === 'heal'), 'no heal pickup').toBe(true)
    expect(level.pickups.some((p) => p.kind === 'attack'), 'no attack pickup').toBe(true)
  })

  it('is dark but navigable: it places lights, and the lantern outreaches the fight trigger', () => {
    // The level itself is unlit (see GameScene) — the only light is the
    // player's lantern and whatever props it stands in the level. Which prop
    // that is differs per level (a torch in ด่าน 1, a wisp in the catacombs, a
    // brazier in the arena), but without at least one of them a level has no
    // landmark to navigate by at all. Props that only glow through unlit
    // additive material — a rune circle, a chest — light nothing around them
    // and so don't count here.
    const lights = (level.decorations ?? []).filter((d) => LIGHT_DECORATION_KINDS.includes(d.kind))
    expect(lights.length).toBeGreaterThan(0)
    // And the lantern has to reach further than the distance at which a
    // monster starts swinging, or the player would be ambushed out of the dark
    // by something they never got to see.
    expect(LANTERN_RADIUS).toBeGreaterThan(MONSTER_AGGRO_RANGE)
  })
})
