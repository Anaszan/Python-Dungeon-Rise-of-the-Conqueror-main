// This is the one file under src/ that touches the filesystem — it checks the
// art in public/ actually exists. tsconfig.app.json limits `types` to
// vite/client so app code can't reach for node globals by accident, so pull
// the node types in here only.
/// <reference types="node" />
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_MONSTERS, availableMonsters, bossIsSealed, bossOf, LEVELS, LIGHT_DECORATION_KINDS } from './levels'
import { LESSONS } from './lessons'
import { canStandAt, hitsWall, isWalkable } from './dungeon'
import { ATTACK_PICKUP_AMOUNT, MONSTER_AGGRO_RANGE, LANTERN_RADIUS } from './constants'

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
    // The whole power curve is "BASE + 10 per potion", and the boss HP in
    // levels.ts is sized against it — a one-off bigger potion would quietly
    // break that.
    for (const pickup of LEVELS.flatMap((l) => l.pickups)) {
      if (pickup.kind !== 'attack') continue
      expect(pickup.amount, `${pickup.id} is off the flat power curve`).toBe(ATTACK_PICKUP_AMOUNT)
    }
  })
})

// The boss seal: every level ends on one boss, and that boss is not in the
// dungeon until the rest of the floor is dead. Killing it is what opens the
// next level (store.damageMonster), so an unreachable or duplicated boss is a
// level nobody can finish.
describe.each(LEVELS)('level $level ($name) boss', (level) => {
  it('has exactly one', () => {
    expect(level.monsters.filter((m) => m.boss).map((m) => m.name)).toHaveLength(1)
  })

  it('is the toughest thing on the floor', () => {
    // Not a rule the code depends on, but a level whose boss is weaker than
    // the minions it hides behind is an authoring mistake every time.
    const boss = bossOf(level)!
    for (const minion of level.monsters.filter((m) => !m.boss)) {
      expect(boss.maxHp, `${minion.name} out-tanks the boss`).toBeGreaterThan(minion.maxHp)
    }
  })

  it('stays sealed until the last minion dies, then walks in', () => {
    const minions = level.monsters.filter((m) => !m.boss)
    const boss = bossOf(level)!

    expect(bossIsSealed(level, new Set())).toBe(true)
    expect(availableMonsters(level, new Set()), 'sealed boss is on the floor').not.toContain(boss)

    // One short of clear — still sealed.
    const allButOne = new Set(minions.slice(0, -1).map((m) => m.id))
    expect(bossIsSealed(level, allButOne)).toBe(true)

    const clear = new Set(minions.map((m) => m.id))
    expect(bossIsSealed(level, clear)).toBe(false)
    expect(availableMonsters(level, clear)).toEqual([boss])

    // And a dead boss is not on the floor either.
    expect(availableMonsters(level, new Set([...clear, boss.id]))).toEqual([])
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
