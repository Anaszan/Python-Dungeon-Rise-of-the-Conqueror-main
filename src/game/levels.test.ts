// This is the one file under src/ that touches the filesystem — it checks the
// art in public/ actually exists. tsconfig.app.json limits `types` to
// vite/client so app code can't reach for node globals by accident, so pull
// the node types in here only.
/// <reference types="node" />
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALL_MONSTERS, LEVELS } from './levels'
import { LESSONS } from './lessons'
import { canStandAt, hitsWall } from './dungeon'
import { COMBAT_TRIGGER_DISTANCE, LANTERN_RADIUS } from './constants'

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

  it('gives every monster a 2D sprite for the combat screen', () => {
    // CombatOverlay is plain HTML: it renders monster.imageUrl in an <img>
    // and falls back to a flat colored circle when it is missing. modelUrl
    // does not help there — an <img> cannot show a GLB — so a monster with
    // only a model (as all of level 4 once had) turns into a blob the moment
    // the fight starts, even though it looks right out in the dungeon.
    for (const monster of ALL_MONSTERS) {
      expect(monster.imageUrl, `${monster.name} has no imageUrl`).toBeTruthy()
    }
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

  it('keeps pickup ids unique across every level', () => {
    // collectedPickupIds is a flat set in the store, so a reused id would
    // mark a later level's pickup as already taken.
    const ids = LEVELS.flatMap((l) => l.pickups).map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe.each(LEVELS)('level $level ($name)', (level) => {
  const { regions, walls, spawnPosition } = level

  it('spawns the player on solid floor, clear of every wall', () => {
    expect(canStandAt(spawnPosition[0], spawnPosition[2], regions, walls)).toBe(true)
  })

  it('does not drop the player straight into a fight on arrival', () => {
    // GameScene triggers combat on proximity every frame, including the first
    // one after a level advance — a monster parked on the spawn point would
    // start the level mid-battle before the player could move.
    for (const monster of level.monsters) {
      expect(distance(spawnPosition, monster.position), monster.name).toBeGreaterThan(COMBAT_TRIGGER_DISTANCE)
    }
  })

  it.each(level.monsters)('does not bury $name inside a wall', (monster) => {
    expect(hitsWall(monster.position[0], monster.position[2], walls, 0)).toBe(false)
  })

  it.each(level.pickups)('does not bury $id inside a wall', (pickup) => {
    expect(hitsWall(pickup.position[0], pickup.position[2], walls, 0)).toBe(false)
  })

  it('stocks a way to heal and a way to hit harder', () => {
    // HP carries across levels and never regenerates on its own, so a level
    // with no heal in it can only be survived on whatever the player walked
    // in with.
    expect(level.pickups.some((p) => p.kind === 'heal'), 'no heal pickup').toBe(true)
    expect(level.pickups.some((p) => p.kind === 'attack'), 'no attack pickup').toBe(true)
  })

  it('is dark but navigable: it places torches, and the lantern outreaches the fight trigger', () => {
    // The level itself is unlit (see GameScene) — the only light is the
    // player's lantern and these. Without at least one torch a level has no
    // landmark to navigate by at all.
    const torches = (level.decorations ?? []).filter((d) => d.kind === 'torch')
    expect(torches.length).toBeGreaterThan(0)
    // And the lantern has to reach further than the distance at which a
    // monster starts a fight, or the player would be ambushed out of the dark
    // by something they never got to see.
    expect(LANTERN_RADIUS).toBeGreaterThan(COMBAT_TRIGGER_DISTANCE)
  })
})
