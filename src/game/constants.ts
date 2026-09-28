// Units per second on the floor. Pulled 20% down from the original 6 so the
// dungeon reads at walking pace; GAIT_CYCLES_PER_SECOND in character/gait.ts
// paces the walk cycle against this, so the two move together.
export const PLAYER_SPEED = 4.8

export const ISO_OFFSET = { x: 10, y: 12, z: 10 } as const

// Ranges the whole fight is built out of. Combat happens in the dungeon
// itself now — there is no battle screen to cut to — so every one of these is
// a distance on the floor between the player and a monster, measured on the
// XZ plane (height is never part of it).
//
//   AGGRO   a monster starts swinging the moment the player is this close, and
//           stops the moment they step back out. Every level spawns the player
//           at least 4 units from its nearest monster (levels.test.ts), so
//           arriving in a level can never start a fight on its own.
//   CAST    how far a spell reaches. Comfortably longer than AGGRO, which is
//           what makes backing out of a monster's swing and finishing it from
//           range a real option rather than a bug.
//   LOCK    how far away a monster can be clicked to become the target. Longer
//           than CAST on purpose: picking your next target across the room and
//           walking into range is how RO plays.
//   DROP    walk this far from the locked target and the lock lets go by
//           itself, so a target left behind two rooms ago stops following the
//           player around.
export const MONSTER_AGGRO_RANGE = 2.2
export const SPELL_CAST_RANGE = 6.5
export const TARGET_LOCK_RANGE = 10
export const TARGET_DROP_RANGE = 13
export const PICKUP_TRIGGER_DISTANCE = 1.0

// Where the player is standing gets saved (GameScene → store.recordPosition)
// once they have walked this far from the last saved spot — about two-thirds
// of a second at PLAYER_SPEED — and never more often than the interval, so a
// long walk down a corridor is a handful of writes rather than one per frame.
// Coming back after a crash or a closed tab costs at most this much walking.
export const POSITION_SAVE_DISTANCE = 3
export const POSITION_SAVE_MIN_INTERVAL_SECONDS = 2

export const PLAYER_MAX_HP = 200
export const BASE_ATTACK_POWER = 30

// Every `kind: 'attack'` pickup in every level hands out exactly this much —
// see levels.ts. Kept as one constant rather than a per-pickup number so the
// power curve stays flat and predictable: the player's atk is always
// BASE_ATTACK_POWER + 10 per potion collected, no matter which level it came
// from. Boss HP in levels.ts is sized against that curve.
export const ATTACK_PICKUP_AMOUNT = 10

export const SKILL_COOLDOWN_SECONDS = 8
export const SKILL_DAMAGE_MULTIPLIER = 3

// Dungeon lighting. The levels are unlit by design — see GameScene, which
// carries no scene-wide light at all. Everything a player can see is inside
// one of two pools of light: the lantern they carry (Player.tsx) and the
// torches standing in the level (DungeonProps' Torch).
//
// DECAY is deliberately softer than the physically-correct 2. Light landing
// on a floor is scaled by the cosine of its angle, which at ground level
// falls off hard with distance on its own; stacking true inverse-square on
// top of that gives a blown-out hot spot at the player's feet ringed by
// almost nothing. Pulling the exponent down spreads the same light into the
// broad, readable circle this is meant to be, at the cost of being physically
// fictional — which is the right trade for a lantern in a game.
//
// RADIUS is the hard cutoff where three.js windows the light to zero; the
// pool reads as fading out well before it, at roughly half that distance.
//
// The numbers below were picked by working the whole chain through — three's
// distance attenuation, the floor's albedo, ACES tone mapping, sRGB encode —
// and reading off the resulting pixel values across the pool. The lantern
// lands around 140/255 under the player, is still comfortably readable out at
// 4-5 units, and has gone black by 8. Unlit floor sits at 2/255.
export const LIGHT_DECAY = 1.7
// Measured from the player's own origin, which every level spawns 0.6 above
// the floor — so this hangs the light ~2.5 above the ground, the height the
// falloff above was tuned at.
export const LANTERN_HEIGHT = 1.9
export const LANTERN_RADIUS = 11
export const LANTERN_INTENSITY = 18
export const TORCH_RADIUS = 10
export const TORCH_INTENSITY = 14

// Each level has its own signature light source standing in for (or standing
// next to) the torch — a wisp in the catacombs, a brazier in the arena, a
// crystal in the tower, a candle in the library, a leaking rift in the glitch
// dungeon. They are all read against the torch above: a brazier is the one
// thing that lights a whole room, a wisp or a candle only lights the metre or
// two around itself, which is what keeps those levels dark even though there
// are more lights standing in them.
export const WISP_RADIUS = 7
export const WISP_INTENSITY = 6
export const BRAZIER_RADIUS = 13
export const BRAZIER_INTENSITY = 22
export const CRYSTAL_RADIUS = 7
export const CRYSTAL_INTENSITY = 5
export const CANDLE_RADIUS = 5
export const CANDLE_INTENSITY = 4
export const RIFT_RADIUS = 7
export const RIFT_INTENSITY = 7
// The scene's ambient fill — just enough to read a silhouette a step outside
// the light rather than nothing at all — now lives per level in
// levelTheme.ts, along with the colour it is tinted. Every level sets it
// somewhere around 0.1; raising it washes that level's darkness out fast, and
// the arena is the only one deliberately pushed past that.

// Regular attack is now also cast by running Python code, so it gets a
// short cooldown too — otherwise there's nothing pacing how fast the
// attack box can be re-run. Shorter than the skill's so it still reads as
// the "everyday" spell next to the rarer, harder-hitting skill.
export const ATTACK_COOLDOWN_SECONDS = 3
