export const PLAYER_SPEED = 6

export const ISO_OFFSET = { x: 10, y: 12, z: 10 } as const

export const COMBAT_TRIGGER_DISTANCE = 1.2
export const FLEE_CLEAR_DISTANCE = 2.2
export const PICKUP_TRIGGER_DISTANCE = 1.0

export const PLAYER_MAX_HP = 200
export const BASE_ATTACK_POWER = 30

// Every `kind: 'attack'` pickup in every level hands out exactly this much —
// see levels.ts. Kept as one constant rather than a per-pickup number so the
// power curve stays flat and predictable: the player's atk is always
// BASE_ATTACK_POWER + 10 per potion collected, no matter which level it came
// from. The level-exam damage targets in lessons.ts are sized against that.
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
// Just enough fill to read a silhouette a step outside the light rather than
// nothing at all. Raising this washes the darkness out fast.
export const DUNGEON_AMBIENT_INTENSITY = 0.09

// Regular attack is now also cast by running Python code, so it gets a
// short cooldown too — otherwise there's nothing pacing how fast the
// attack box can be re-run. Shorter than the skill's so it still reads as
// the "everyday" spell next to the rarer, harder-hitting skill.
export const ATTACK_COOLDOWN_SECONDS = 3
