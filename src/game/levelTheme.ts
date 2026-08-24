// Per-level art direction. Everything in here is what makes ด่าน 1 (a damp
// stone corridor) not look like ด่าน 5 (a wooden library) even when the two
// share a floor plan: the palette the procedural floor/wall textures are drawn
// from (Ground.tsx), the colour the darkness itself is tinted (fog + ambient),
// and the dust/ember motes drifting through the air (GameScene).
//
// No external image assets — the textures are still drawn to a canvas at
// runtime, this just hands the drawing code a different set of colours and a
// different pattern per level.

// How the floor slabs are laid out:
//   slab  — cut stone tiles with grout lines (dungeon / catacomb / tower)
//   sand  — packed dirt and grit, no tile seams (arena)
//   plank — long wooden boards with grain (library)
export type FloorStyle = 'slab' | 'sand' | 'plank'

// How a wall face is drawn:
//   brick — staggered stone courses, count set by rows/cols
//   shelf — bookcase: shelf boards packed with book spines
export type WallStyle = 'brick' | 'shelf'

// Glowing marks burned into a surface. These are drawn twice — faintly into
// the colour map, and at full strength into a separate emissive map — so they
// stay visible in a level that has no light of its own (see GameScene).
//   rune  — arcane circles and glyphs (ด่าน 4)
//   crack — jagged tears in reality (ด่าน 6)
export type SurfaceGlow = {
  color: string
  style: 'rune' | 'crack'
  // Fraction of tiles/bricks that get a mark, 0..1.
  chance: number
  // Feeds meshStandardMaterial's emissiveIntensity.
  intensity: number
}

export type FloorPalette = {
  style: FloorStyle
  // World units covered by one repeat of the texture. 1 = one tile per metre.
  tile: number
  // Gap colour behind the slabs / boards.
  base: string
  // The two alternating slab (or plank) tones.
  slabA: string
  slabB: string
  grout: string
  crack: string
  // Moss, slime, dust — whatever grows or settles on this floor.
  speckle: string
  speckleChance: number
  glow?: SurfaceGlow
}

export type WallPalette = {
  style: WallStyle
  // World units per texture repeat, horizontally and vertically. The vertical
  // one is normally left at the wall height so a bookcase tiles exactly once
  // top to bottom instead of being sliced off mid-shelf.
  tileU: number
  tileV: number
  mortar: string
  brickA: string
  brickB: string
  rows: number
  cols: number
  speckle: string
  speckleChance: number
  glow?: SurfaceGlow
}

export type LevelTheme = {
  // Stable key for the texture cache in Ground.tsx.
  id: string
  floor: FloorPalette
  wall: WallPalette
  // Fog doubles as the background colour, so this is also what the void
  // between the lit rooms is made of. `near` has to clear the camera offset
  // (~18 units) plus the lantern's reach or the fog eats the player's own
  // pool of light — see the note in GameScene.
  fog: { color: string; near: number; far: number }
  ambient: { color: string; intensity: number }
  // Drifting particles: dust in the library, embers over the arena, spirit
  // motes in the catacombs. `scale` is the box they fill, sized to the level's
  // footprint so they don't stop halfway down a long corridor.
  motes: {
    color: string
    count: number
    size: number
    speed: number
    opacity: number
    scale: [number, number, number]
  }
}

// ด่าน 1 — ทางเดินมืด. Damp grey-brown stone, slime growing in the seams,
// black haze. The baseline every other level is a departure from.
export const DARK_CORRIDOR_THEME: LevelTheme = {
  id: 'dark-corridor',
  floor: {
    style: 'slab',
    tile: 1,
    base: '#2f2c22',
    slabA: '#4b4738',
    slabB: '#423e30',
    grout: 'rgba(0, 0, 0, 0.45)',
    crack: 'rgba(0, 0, 0, 0.4)',
    speckle: '70, 130, 60',
    speckleChance: 0.45,
  },
  wall: {
    style: 'brick',
    tileU: 1,
    tileV: 1,
    mortar: '#2a2419',
    brickA: '#5f5a42',
    brickB: '#544f39',
    rows: 10,
    cols: 6,
    speckle: '70, 110, 55',
    speckleChance: 0.22,
  },
  fog: { color: '#05040a', near: 26, far: 60 },
  ambient: { color: '#6a7ba8', intensity: 0.09 },
  motes: { color: '#c9b48f', count: 45, size: 2, speed: 0.3, opacity: 0.18, scale: [16, 4, 42] },
}

// ด่าน 2 — ห้องใต้ดินที่ลึกกว่าเดิม. Colder and wetter than ด่าน 1, lit
// green-blue by wisps rather than fire, and the fog closes in tighter.
export const CATACOMBS_THEME: LevelTheme = {
  id: 'catacombs',
  floor: {
    style: 'slab',
    tile: 1,
    base: '#232830',
    slabA: '#3c4149',
    slabB: '#343941',
    grout: 'rgba(0, 0, 0, 0.5)',
    crack: 'rgba(0, 0, 0, 0.45)',
    speckle: '60, 120, 100',
    speckleChance: 0.4,
  },
  wall: {
    style: 'brick',
    tileU: 1,
    tileV: 1,
    mortar: '#1d222a',
    brickA: '#4a505a',
    brickB: '#414752',
    rows: 8,
    cols: 5,
    speckle: '60, 120, 100',
    speckleChance: 0.28,
  },
  fog: { color: '#04080b', near: 22, far: 52 },
  ambient: { color: '#5fb8a8', intensity: 0.08 },
  motes: { color: '#7fe8d0', count: 70, size: 2.5, speed: 0.2, opacity: 0.26, scale: [18, 4, 52] },
}

// ด่าน 3 — สนามประลองคอมโบ. Open colosseum: pale limestone, sand underfoot
// with old stains in it, warm and much brighter than anywhere below ground.
export const ARENA_THEME: LevelTheme = {
  id: 'arena',
  floor: {
    style: 'sand',
    tile: 2,
    base: '#6b5a3e',
    slabA: '#7a6746',
    slabB: '#5e4e35',
    grout: 'rgba(0, 0, 0, 0.25)',
    crack: 'rgba(40, 20, 14, 0.5)',
    speckle: '90, 47, 40',
    speckleChance: 0.3,
  },
  wall: {
    style: 'brick',
    tileU: 2,
    tileV: 1.6,
    mortar: '#4a4234',
    brickA: '#8a7d60',
    brickB: '#7b6f54',
    rows: 4,
    cols: 3,
    speckle: '90, 47, 40',
    speckleChance: 0.18,
  },
  fog: { color: '#0d0803', near: 30, far: 70 },
  ambient: { color: '#c8925a', intensity: 0.14 },
  motes: { color: '#ffb257', count: 80, size: 3, speed: 0.6, opacity: 0.3, scale: [20, 6, 44] },
}

// ด่าน 4 — หอคาถาต้องมนตร์. Polished violet stone with live sigils burning
// in the floor and walls; the air itself is full of arcane dust.
export const ARCANE_TOWER_THEME: LevelTheme = {
  id: 'arcane-tower',
  floor: {
    style: 'slab',
    tile: 1,
    base: '#1a1730',
    slabA: '#2e2a46',
    slabB: '#26233b',
    grout: 'rgba(0, 0, 0, 0.55)',
    crack: 'rgba(0, 0, 0, 0.4)',
    speckle: '120, 95, 220',
    speckleChance: 0.2,
    glow: { color: '#8f6fff', style: 'rune', chance: 0.16, intensity: 1.2 },
  },
  wall: {
    style: 'brick',
    tileU: 1,
    tileV: 1,
    mortar: '#161328',
    brickA: '#3c3559',
    brickB: '#332d4d',
    rows: 10,
    cols: 6,
    speckle: '120, 95, 220',
    speckleChance: 0.12,
    glow: { color: '#7f5fe0', style: 'rune', chance: 0.08, intensity: 1 },
  },
  fog: { color: '#08061a', near: 24, far: 58 },
  ambient: { color: '#8f7fe8', intensity: 0.12 },
  motes: { color: '#c7a8ff', count: 100, size: 2.5, speed: 0.4, opacity: 0.35, scale: [18, 6, 52] },
}

// ด่าน 5 — หอสมุดลับ. The only level built out of wood rather than stone:
// board floors, bookcase walls, and slow dust hanging in warm lamplight. The
// fog sits close so the shelves always vanish into the maze.
export const LIBRARY_THEME: LevelTheme = {
  id: 'library',
  floor: {
    style: 'plank',
    tile: 2,
    base: '#2c1f14',
    slabA: '#5a4230',
    slabB: '#4c3726',
    grout: 'rgba(0, 0, 0, 0.5)',
    crack: 'rgba(0, 0, 0, 0.3)',
    speckle: '200, 180, 140',
    speckleChance: 0.25,
  },
  wall: {
    style: 'shelf',
    tileU: 2,
    tileV: 1.6,
    mortar: '#241a11',
    brickA: '#5a4128',
    brickB: '#48331f',
    rows: 4,
    cols: 1,
    speckle: '200, 180, 140',
    speckleChance: 0.1,
  },
  fog: { color: '#0a0705', near: 20, far: 46 },
  ambient: { color: '#d8c08f', intensity: 0.1 },
  motes: { color: '#e8dcc0', count: 130, size: 1.6, speed: 0.12, opacity: 0.22, scale: [16, 5, 42] },
}

// ด่าน 6 — ดันเจี้ยนกับดักมรณะ. Dead grey machinery with reality torn open
// through it: hot magenta cracks in the floor, cyan ones in the walls, and
// fast-moving motes that never quite settle.
export const GLITCH_THEME: LevelTheme = {
  id: 'glitch',
  floor: {
    style: 'slab',
    tile: 1,
    base: '#17171c',
    slabA: '#2b2b33',
    slabB: '#232329',
    grout: 'rgba(0, 0, 0, 0.6)',
    crack: 'rgba(0, 0, 0, 0.5)',
    speckle: '120, 40, 70',
    speckleChance: 0.18,
    glow: { color: '#ff2e63', style: 'crack', chance: 0.22, intensity: 1.4 },
  },
  wall: {
    style: 'brick',
    tileU: 1,
    tileV: 1,
    mortar: '#101014',
    brickA: '#33333c',
    brickB: '#2b2b33',
    rows: 9,
    cols: 5,
    speckle: '37, 244, 208',
    speckleChance: 0.1,
    glow: { color: '#25f4d0', style: 'crack', chance: 0.12, intensity: 1.1 },
  },
  fog: { color: '#07040c', near: 20, far: 54 },
  ambient: { color: '#a04fd0', intensity: 0.1 },
  motes: { color: '#ff4f8f', count: 90, size: 2, speed: 1.2, opacity: 0.3, scale: [18, 6, 52] },
}
