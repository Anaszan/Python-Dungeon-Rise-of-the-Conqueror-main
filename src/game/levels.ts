import type { Region, Wall } from './dungeon'
import { WALL_THICKNESS } from './dungeon'
import { ATTACK_PICKUP_AMOUNT, PLAYER_MAX_HP } from './constants'
import type { MonsterData } from './monsters'
import type { PickupData } from './pickups'

export type DecorationData = {
  kind: 'torch' | 'statue' | 'chest'
  position: [number, number, number]
}

export type LevelData = {
  level: number
  name: string
  spawnPosition: [number, number, number]
  regions: Region[]
  walls: Wall[]
  monsters: MonsterData[]
  pickups: PickupData[]
  decorations?: DecorationData[]
  // Optional art: drop an image under public/textures and point these at its
  // URL (e.g. "/textures/level1-floor.png") to replace the placeholder floor
  // color / grid and wall color with real map art. Left unset, levels render
  // with the current flat-color placeholders.
  floorTextureUrl?: string
  wallTextureUrl?: string
}

// Level 1: a long corridor from spawn to an end room, with a west room and an
// east room branching off partway down. Coordinates already account for
// player clearance, so regions can share an exact boundary with no gap at
// doorways.
const LEVEL_1_REGIONS: Region[] = [
  { xMin: -2, xMax: 2, zMin: -34, zMax: 1 }, // main corridor
  { xMin: -8.5, xMax: -2, zMin: -13, zMax: -7 }, // west branch room
  { xMin: 2, xMax: 8.5, zMin: -23, zMax: -17 }, // east branch room
  { xMin: -6.5, xMax: 6.5, zMin: -40, zMax: -34 }, // end room
]

const LEVEL_1_WALLS: Wall[] = [
  // corridor entrance cap (spawn end)
  { x: 0, z: 1, width: 4, depth: WALL_THICKNESS },
  // corridor west wall, split around the west room doorway
  { x: -2, z: -3, width: WALL_THICKNESS, depth: 8 },
  { x: -2, z: -23.5, width: WALL_THICKNESS, depth: 21 },
  // corridor east wall, split around the east room doorway
  { x: 2, z: -8, width: WALL_THICKNESS, depth: 18 },
  { x: 2, z: -28.5, width: WALL_THICKNESS, depth: 11 },

  // west room walls (doorway faces east, left open)
  { x: -5.25, z: -7, width: 6.5, depth: WALL_THICKNESS },
  { x: -5.25, z: -13, width: 6.5, depth: WALL_THICKNESS },
  { x: -8.5, z: -10, width: WALL_THICKNESS, depth: 6 },

  // east room walls (doorway faces west, left open)
  { x: 5.25, z: -17, width: 6.5, depth: WALL_THICKNESS },
  { x: 5.25, z: -23, width: 6.5, depth: WALL_THICKNESS },
  { x: 8.5, z: -20, width: WALL_THICKNESS, depth: 6 },

  // end room walls, split around the corridor doorway on the north side
  { x: -4.25, z: -34, width: 4.5, depth: WALL_THICKNESS },
  { x: 4.25, z: -34, width: 4.5, depth: WALL_THICKNESS },
  { x: 0, z: -40, width: 13, depth: WALL_THICKNESS },
  { x: -6.5, z: -37, width: WALL_THICKNESS, depth: 6 },
  { x: 6.5, z: -37, width: WALL_THICKNESS, depth: 6 },
]

// Every monster in a level is a distinct type — no two share a name, even
// when they occupy the same "tier" (e.g. two corridor trash mobs). Level 1
// gives every monster its own sprite art (public/monsters/*.svg); other
// levels still reuse a shared sprite per stat tier under a new name/color.
const LEVEL_1_MONSTERS: MonsterData[] = [
  // main corridor
  { id: 'slime-1', name: 'Slime', maxHp: 30, color: '#6fdc4f', attackDamage: 5, attackInterval: 10, position: [0, 0.5, -4], imageUrl: '/monsters/slime_attack.png' },
  { id: 'slime-2', name: 'Glitch Slime', maxHp: 30, color: '#a233f2', attackDamage: 5, attackInterval: 10, position: [0, 0.5, -16], imageUrl: '/monsters/glitchslime_attack.png' },
  { id: 'wraith-2', name: 'Null Wraith', maxHp: 80, color: '#3a3a42', attackDamage: 12, attackInterval: 10, position: [0, 0.5, -28], imageUrl: '/monsters/nullwraith_attack.png' },

  // west branch room
  { id: 'goblin-1', name: 'Goblin', maxHp: 50, color: '#8fc23f', attackDamage: 8, attackInterval: 10, position: [-4, 0.5, -8], imageUrl: '/monsters/goblin_attack.png' },
  { id: 'goblin-2', name: 'Goblin Scout', maxHp: 50, color: '#a8d95e', attackDamage: 8, attackInterval: 10, position: [-6.5, 0.5, -11], imageUrl: '/monsters/goblinscout_attack.png' },

  // east branch room
  { id: 'goblin-3', name: 'Goblin Brute', maxHp: 50, color: '#3a7a26', attackDamage: 8, attackInterval: 10, position: [5, 0.5, -19], imageUrl: '/monsters/goblinbrute_attack.png' },
  { id: 'wraith-1', name: 'Wraith', maxHp: 80, color: '#8a6fd1', attackDamage: 12, attackInterval: 10, position: [7, 0.5, -21], imageUrl: '/monsters/wraith_attack.png' },

  // end room
  { id: 'wraith-3', name: 'Echo Wraith', maxHp: 80, color: '#3a6bd1', attackDamage: 12, attackInterval: 10, position: [-3, 0.5, -37], imageUrl: '/monsters/echowraith_attack.png' },
  { id: 'dragon-1', name: 'Dragon', maxHp: 150, color: '#e05263', attackDamage: 20, attackInterval: 10, position: [3, 0.5, -37], imageUrl: '/monsters/dragon_attack.png' },
]

const LEVEL_1_PICKUPS: PickupData[] = [
  { id: 'heal-1', kind: 'heal', amount: PLAYER_MAX_HP, position: [-7, 0.5, -9] },
  { id: 'attack-1', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [6, 0.5, -22] },
  { id: 'heal-2', kind: 'heal', amount: PLAYER_MAX_HP, position: [0, 0.5, -25] },
  { id: 'attack-2', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [-5, 0.5, -38] },
  { id: 'potion-1', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [0, 0.5, -10] },
]

const LEVEL_1_DECORATIONS: DecorationData[] = [
  { kind: 'torch', position: [-1.8, 0, -2] },
  { kind: 'torch', position: [1.8, 0, -2] },
  { kind: 'torch', position: [-1.8, 0, -20] },
  { kind: 'torch', position: [1.8, 0, -26] },
  { kind: 'torch', position: [-1.8, 0, -30] },
  { kind: 'torch', position: [1.8, 0, -30] },
  { kind: 'torch', position: [-3.5, 0, -7.5] },
  { kind: 'torch', position: [-3.5, 0, -12.5] },
  { kind: 'torch', position: [3.5, 0, -17.5] },
  { kind: 'torch', position: [3.5, 0, -22.5] },
  { kind: 'statue', position: [-5, 0, -38.5] },
  { kind: 'statue', position: [5, 0, -38.5] },
  { kind: 'chest', position: [0, 0, -38] },
]

export const LEVEL_1: LevelData = {
  level: 1,
  name: 'ทางเดินมืด',
  spawnPosition: [0, 0.6, 0],
  regions: LEVEL_1_REGIONS,
  walls: LEVEL_1_WALLS,
  monsters: LEVEL_1_MONSTERS,
  pickups: LEVEL_1_PICKUPS,
  decorations: LEVEL_1_DECORATIONS,
}

// Level 2: a longer corridor with a west room and an east room (both bigger
// than level 1's), plus a vault room hanging off the west side of the end
// room as a bonus detour. Same authoring approach as level 1 — walls sit
// exactly on region boundaries except at doorway gaps.
const LEVEL_2_REGIONS: Region[] = [
  { xMin: -2, xMax: 2, zMin: -42, zMax: 1 }, // main corridor
  { xMin: -9, xMax: -2, zMin: -16, zMax: -9 }, // west branch room
  { xMin: 2, xMax: 9, zMin: -28, zMax: -21 }, // east branch room
  { xMin: -7, xMax: 7, zMin: -48, zMax: -42 }, // end room
  { xMin: -13, xMax: -7, zMin: -47, zMax: -43 }, // vault room off the end room
]

const LEVEL_2_WALLS: Wall[] = [
  // corridor entrance cap (spawn end)
  { x: 0, z: 1, width: 4, depth: WALL_THICKNESS },
  // corridor west wall, split around the west room doorway
  { x: -2, z: -4, width: WALL_THICKNESS, depth: 10 },
  { x: -2, z: -29, width: WALL_THICKNESS, depth: 26 },
  // corridor east wall, split around the east room doorway
  { x: 2, z: -10, width: WALL_THICKNESS, depth: 22 },
  { x: 2, z: -35, width: WALL_THICKNESS, depth: 14 },

  // west room walls (doorway faces east, left open)
  { x: -5.5, z: -9, width: 7, depth: WALL_THICKNESS },
  { x: -5.5, z: -16, width: 7, depth: WALL_THICKNESS },
  { x: -9, z: -12.5, width: WALL_THICKNESS, depth: 7 },

  // east room walls (doorway faces west, left open)
  { x: 5.5, z: -21, width: 7, depth: WALL_THICKNESS },
  { x: 5.5, z: -28, width: 7, depth: WALL_THICKNESS },
  { x: 9, z: -24.5, width: WALL_THICKNESS, depth: 7 },

  // end room walls: north side split around the corridor doorway,
  // west side split around the vault-room doorway
  { x: -4.5, z: -42, width: 5, depth: WALL_THICKNESS },
  { x: 4.5, z: -42, width: 5, depth: WALL_THICKNESS },
  { x: -7, z: -42.5, width: WALL_THICKNESS, depth: 1 },
  { x: -7, z: -47.5, width: WALL_THICKNESS, depth: 1 },
  { x: 7, z: -45, width: WALL_THICKNESS, depth: 6 },
  { x: 0, z: -48, width: 14, depth: WALL_THICKNESS },

  // vault room walls (doorway faces east, left open)
  { x: -10, z: -43, width: 6, depth: WALL_THICKNESS },
  { x: -10, z: -47, width: 6, depth: WALL_THICKNESS },
  { x: -13, z: -45, width: WALL_THICKNESS, depth: 4 },
]

const LEVEL_2_MONSTERS: MonsterData[] = [
  // main corridor
  { id: 'goblin-warrior-1', name: 'Goblin Warrior', maxHp: 70, color: '#a8632f', attackDamage: 12, attackInterval: 10, position: [0, 0.5, -5], imageUrl: '/monsters/goblinwarrior_attack.png' },
  { id: 'specter-1', name: 'Specter', maxHp: 60, color: '#b8d9f0', attackDamage: 14, attackInterval: 10, position: [0, 0.5, -19], imageUrl: '/monsters/ghostspecter_attack.png' },
  { id: 'wraith-elite-1', name: 'Wraith Elite', maxHp: 120, color: '#5a3f8a', attackDamage: 18, attackInterval: 10, position: [0, 0.5, -33], imageUrl: '/monsters/wraithelite_attack.png' },

  // west branch room
  { id: 'orc-1', name: 'Orc', maxHp: 90, color: '#5c7a3d', attackDamage: 15, attackInterval: 10, position: [-5, 0.5, -11], imageUrl: '/monsters/orc_attack.png' },
  { id: 'orc-2', name: 'Orc Berserker', maxHp: 90, color: '#4a6a2f', attackDamage: 15, attackInterval: 10, position: [-7, 0.5, -14], imageUrl: '/monsters/orc_attack.png' },

  // east branch room
  { id: 'goblin-warrior-2', name: 'Goblin Marauder', maxHp: 70, color: '#b8763a', attackDamage: 12, attackInterval: 10, position: [5, 0.5, -23], imageUrl: '/monsters/goblinmarauder_attack.png' },
  { id: 'specter-2', name: 'Wisp Specter', maxHp: 60, color: '#9fc9e8', attackDamage: 14, attackInterval: 10, position: [7, 0.5, -26], imageUrl: '/monsters/wispspecter_attack.png' },

  // end room
  { id: 'wraith-elite-2', name: 'Wraith Sovereign', maxHp: 120, color: '#4a3570', attackDamage: 18, attackInterval: 10, position: [-4, 0.5, -45], imageUrl: '/monsters/wraithsovereign_attack.png' },
  { id: 'elder-dragon-1', name: 'Elder Dragon', maxHp: 260, color: '#c21f3a', attackDamage: 28, attackInterval: 10, position: [4, 0.5, -46], imageUrl: '/monsters/elderdragon_attack.png' },

  // vault room
  { id: 'specter-3', name: 'Hollow Specter', maxHp: 60, color: '#7fb8d9', attackDamage: 14, attackInterval: 10, position: [-10, 0.5, -45], imageUrl: '/monsters/hollowspecter_attack.png' },
]

const LEVEL_2_PICKUPS: PickupData[] = [
  { id: 'heal-3', kind: 'heal', amount: PLAYER_MAX_HP, position: [-6, 0.5, -10] },
  { id: 'attack-3', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [6, 0.5, -27] },
  { id: 'heal-4', kind: 'heal', amount: PLAYER_MAX_HP, position: [-2, 0.5, -44] },
  { id: 'attack-4', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [-10, 0.5, -44] },
  { id: 'potion-2', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [0, 0.5, -12] },
]

const LEVEL_2_DECORATIONS: DecorationData[] = [
  { kind: 'torch', position: [-1.8, 0, -2] },
  { kind: 'torch', position: [1.8, 0, -2] },
  { kind: 'torch', position: [-1.8, 0, -22] },
  { kind: 'torch', position: [1.8, 0, -32] },
  { kind: 'torch', position: [-1.8, 0, -36] },
  { kind: 'torch', position: [1.8, 0, -36] },
  { kind: 'torch', position: [-4, 0, -8.5] },
  { kind: 'torch', position: [-4, 0, -16.5] },
  { kind: 'torch', position: [4, 0, -20.5] },
  { kind: 'torch', position: [4, 0, -28.5] },
  { kind: 'statue', position: [-6, 0, -46.5] },
  { kind: 'statue', position: [6, 0, -46.5] },
  { kind: 'torch', position: [-8, 0, -44] },
  { kind: 'chest', position: [-10, 0, -45] },
]

export const LEVEL_2: LevelData = {
  level: 2,
  name: 'ห้องใต้ดินที่ลึกกว่าเดิม',
  spawnPosition: [0, 0.6, 0],
  regions: LEVEL_2_REGIONS,
  walls: LEVEL_2_WALLS,
  monsters: LEVEL_2_MONSTERS,
  pickups: LEVEL_2_PICKUPS,
  decorations: LEVEL_2_DECORATIONS,
}

// Levels 3-6 intentionally reuse LEVEL_1's and LEVEL_2's region/wall
// geometry verbatim (just re-exported under new names) rather than
// authoring new floor plans. That geometry is the only part of a level that
// can silently break (a wall gap leaves an unreachable pickup, a doorway
// half a unit off leaves the player stuck) and there's no way to click
// through the 3D scene to verify new geometry visually in this environment
// — reusing a known-good shape keeps that risk at zero. Monsters, pickups,
// names and difficulty are new per level.

// Level 3 — บทที่ 4 (การวนซ้ำ): same footprint as level 1.
const LEVEL_3_REGIONS: Region[] = LEVEL_1_REGIONS
const LEVEL_3_WALLS: Wall[] = LEVEL_1_WALLS

const LEVEL_3_MONSTERS: MonsterData[] = [
  { id: 'imp-1', name: 'Imp', maxHp: 85, color: '#8fd35f', attackDamage: 16, attackInterval: 10, position: [0, 0.5, -4], imageUrl: '/monsters/imp_attack.svg' },
  { id: 'imp-2', name: 'Loop Imp', maxHp: 85, color: '#6fd38f', attackDamage: 16, attackInterval: 10, position: [0, 0.5, -16], imageUrl: '/monsters/loopimp_attack.svg' },
  { id: 'banshee-1', name: 'Banshee', maxHp: 150, color: '#b58fe8', attackDamage: 22, attackInterval: 10, position: [0, 0.5, -28], imageUrl: '/monsters/banshee_attack.svg' },

  { id: 'raider-1', name: 'Goblin Raider', maxHp: 115, color: '#d1954b', attackDamage: 19, attackInterval: 10, position: [-4, 0.5, -8], imageUrl: '/monsters/goblin_attack.svg' },
  { id: 'raider-2', name: 'Goblin Skirmisher', maxHp: 115, color: '#d1b04b', attackDamage: 19, attackInterval: 10, position: [-6.5, 0.5, -11], imageUrl: '/monsters/goblin_attack.svg' },

  { id: 'raider-3', name: 'Goblin Vanguard', maxHp: 115, color: '#b17a3a', attackDamage: 19, attackInterval: 10, position: [5, 0.5, -19], imageUrl: '/monsters/goblinvanguard_attack.svg' },
  { id: 'banshee-2', name: 'Wailing Banshee', maxHp: 150, color: '#9f7fe8', attackDamage: 22, attackInterval: 10, position: [7, 0.5, -21], imageUrl: '/monsters/banshee_attack.svg' },

  { id: 'banshee-3', name: 'Shrieking Banshee', maxHp: 150, color: '#c7a8f0', attackDamage: 22, attackInterval: 10, position: [-3, 0.5, -37], imageUrl: '/monsters/banshee_attack.svg' },
  { id: 'hydra-1', name: 'Hydra', maxHp: 300, color: '#e0524f', attackDamage: 32, attackInterval: 10, position: [3, 0.5, -37], imageUrl: '/monsters/hydra_attack.svg' },
]

const LEVEL_3_PICKUPS: PickupData[] = [
  { id: 'heal-5', kind: 'heal', amount: PLAYER_MAX_HP, position: [-7, 0.5, -9] },
  { id: 'attack-5', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [6, 0.5, -22] },
  { id: 'heal-6', kind: 'heal', amount: PLAYER_MAX_HP, position: [0, 0.5, -25] },
  { id: 'attack-6', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [-5, 0.5, -38] },
  { id: 'potion-3', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [0, 0.5, -10] },
]

export const LEVEL_3: LevelData = {
  level: 3,
  name: 'สนามประลองคอมโบ',
  spawnPosition: [0, 0.6, 0],
  regions: LEVEL_3_REGIONS,
  walls: LEVEL_3_WALLS,
  monsters: LEVEL_3_MONSTERS,
  pickups: LEVEL_3_PICKUPS,
  decorations: LEVEL_1_DECORATIONS,
}

// Level 4 — บทที่ 5 (ฟังก์ชัน): same footprint as level 2 (has a vault room).
const LEVEL_4_REGIONS: Region[] = LEVEL_2_REGIONS
const LEVEL_4_WALLS: Wall[] = LEVEL_2_WALLS

// Level 4 is the only level whose art ships as GLB. The 3D scene prefers
// modelUrl, but the combat screen is plain HTML and can only show an <img> —
// so each monster also carries the imageUrl of the PNG that was baked into
// its own GLB (extracted from the file's embedded texture, so the two views
// show identical art).
const LEVEL_4_MONSTERS: MonsterData[] = [
  { id: 'wisp-1', name: 'Arcane Wisp', maxHp: 95, color: '#8fc7e8', attackDamage: 16, attackInterval: 10, position: [0, 0.5, -5], modelUrl: '/monsters/arcanewisp_attack.glb', imageUrl: '/monsters/arcanewisp_attack.png' },
  { id: 'hexsprite-1', name: 'Hex Sprite', maxHp: 80, color: '#c98fe8', attackDamage: 18, attackInterval: 10, position: [0, 0.5, -19], modelUrl: '/monsters/hexsprite_attack.glb', imageUrl: '/monsters/hexsprite_attack.png' },
  { id: 'spellknight-1', name: 'Spell Knight', maxHp: 160, color: '#5a4f8a', attackDamage: 23, attackInterval: 10, position: [0, 0.5, -33], modelUrl: '/monsters/spellknight_attack.glb', imageUrl: '/monsters/spellknight_attack.png' },

  { id: 'cultist-1', name: 'Cultist', maxHp: 120, color: '#7a3d3d', attackDamage: 19, attackInterval: 10, position: [-5, 0.5, -11], modelUrl: '/monsters/cultist_attack.glb', imageUrl: '/monsters/cultist_attack.png' },
  { id: 'cultist-2', name: 'Cultist Zealot', maxHp: 120, color: '#5a2a2a', attackDamage: 19, attackInterval: 10, position: [-7, 0.5, -14], modelUrl: '/monsters/cultistzealot_attack.glb', imageUrl: '/monsters/cultistzealot_attack.png' },

  { id: 'wisp-2', name: 'Function Wisp', maxHp: 95, color: '#6fb0e8', attackDamage: 16, attackInterval: 10, position: [5, 0.5, -23], modelUrl: '/monsters/functionwisp_attack.glb', imageUrl: '/monsters/functionwisp_attack.png' },
  { id: 'hexsprite-2', name: 'Hex Imp', maxHp: 80, color: '#b06fe8', attackDamage: 18, attackInterval: 10, position: [7, 0.5, -26], modelUrl: '/monsters/heximp_attack.glb', imageUrl: '/monsters/heximp_attack.png' },

  { id: 'spellknight-2', name: 'Spell Warden', maxHp: 160, color: '#3a2f6a', attackDamage: 23, attackInterval: 10, position: [-4, 0.5, -45], modelUrl: '/monsters/spellwarden_attack.glb', imageUrl: '/monsters/spellwarden_attack.png' },
  { id: 'archmage-1', name: 'Archmage', maxHp: 340, color: '#2b1d55', attackDamage: 34, attackInterval: 10, position: [4, 0.5, -46], modelUrl: '/monsters/archmage_attack.glb', imageUrl: '/monsters/archmage_attack.png' },

  { id: 'hexsprite-3', name: 'Curse Sprite', maxHp: 80, color: '#e08fd0', attackDamage: 18, attackInterval: 10, position: [-10, 0.5, -45], modelUrl: '/monsters/cursesprite_attack.glb', imageUrl: '/monsters/cursesprite_attack.png' },
]

const LEVEL_4_PICKUPS: PickupData[] = [
  { id: 'heal-7', kind: 'heal', amount: PLAYER_MAX_HP, position: [-6, 0.5, -10] },
  { id: 'attack-7', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [6, 0.5, -27] },
  { id: 'heal-8', kind: 'heal', amount: PLAYER_MAX_HP, position: [-2, 0.5, -44] },
  { id: 'attack-8', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [-10, 0.5, -44] },
  { id: 'potion-4', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [0, 0.5, -12] },
]

export const LEVEL_4: LevelData = {
  level: 4,
  name: 'หอคาถาต้องมนตร์',
  spawnPosition: [0, 0.6, 0],
  regions: LEVEL_4_REGIONS,
  walls: LEVEL_4_WALLS,
  monsters: LEVEL_4_MONSTERS,
  pickups: LEVEL_4_PICKUPS,
  decorations: LEVEL_2_DECORATIONS,
}

// Level 5 — บทที่ 6 (การจัดการไฟล์): same footprint as level 1.
const LEVEL_5_REGIONS: Region[] = LEVEL_1_REGIONS
const LEVEL_5_WALLS: Wall[] = LEVEL_1_WALLS

const LEVEL_5_MONSTERS: MonsterData[] = [
  { id: 'bookgolem-1', name: 'Book Golem', maxHp: 115, color: '#7a6a4f', attackDamage: 20, attackInterval: 10, position: [0, 0.5, -4], imageUrl: '/monsters/BookGolem.png' },
  { id: 'bookgolem-2', name: 'Index Golem', maxHp: 115, color: '#8a7a5f', attackDamage: 20, attackInterval: 10, position: [0, 0.5, -16], imageUrl: '/monsters/02_IndexGolem.png' },
  { id: 'ghostlib-1', name: 'Ghost Librarian', maxHp: 200, color: '#cfd8f0', attackDamage: 26, attackInterval: 10, position: [0, 0.5, -28], imageUrl: '/monsters/03_GhostLibrarian.png' },

  { id: 'archivist-1', name: 'Archivist', maxHp: 155, color: '#4f7a6a', attackDamage: 23, attackInterval: 10, position: [-4, 0.5, -8], imageUrl: '/monsters/04_Archivist.png' },
  { id: 'archivist-2', name: 'Archivist Scribe', maxHp: 155, color: '#5f8a7a', attackDamage: 23, attackInterval: 10, position: [-6.5, 0.5, -11], imageUrl: '/monsters/05_ArchivistScribe.png' },

  { id: 'archivist-3', name: 'Archivist Warden', maxHp: 155, color: '#3f6a5a', attackDamage: 23, attackInterval: 10, position: [5, 0.5, -19], imageUrl: '/monsters/06_ArchivistWarden.png' },
  { id: 'ghostlib-2', name: 'Whispering Librarian', maxHp: 200, color: '#b8c7e8', attackDamage: 26, attackInterval: 10, position: [7, 0.5, -21], imageUrl: '/monsters/07_WhisperingLibrarian.png' },

  { id: 'ghostlib-3', name: 'Silent Librarian', maxHp: 200, color: '#e0e8f8', attackDamage: 26, attackInterval: 10, position: [-3, 0.5, -37], imageUrl: '/monsters/08_SilentLibrarian.png' },
  { id: 'tome-1', name: 'Forbidden Tome', maxHp: 380, color: '#3a2a66', attackDamage: 38, attackInterval: 10, position: [3, 0.5, -37], imageUrl: '/monsters/09_ForbiddenTome.png' },
]

const LEVEL_5_PICKUPS: PickupData[] = [
  { id: 'heal-9', kind: 'heal', amount: PLAYER_MAX_HP, position: [-7, 0.5, -9] },
  { id: 'attack-9', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [6, 0.5, -22] },
  { id: 'heal-10', kind: 'heal', amount: PLAYER_MAX_HP, position: [0, 0.5, -25] },
  { id: 'attack-10', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [-5, 0.5, -38] },
  { id: 'potion-5', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [0, 0.5, -10] },
]

export const LEVEL_5: LevelData = {
  level: 5,
  name: 'หอสมุดลับ',
  spawnPosition: [0, 0.6, 0],
  regions: LEVEL_5_REGIONS,
  walls: LEVEL_5_WALLS,
  monsters: LEVEL_5_MONSTERS,
  pickups: LEVEL_5_PICKUPS,
  decorations: LEVEL_1_DECORATIONS,
}

// Level 6 — บทที่ 7 (การจัดการข้อผิดพลาด): same footprint as level 2. Every
// monster here has armor: 0 on purpose — see lessons.ts — so naive
// atk / monster_armor code throws ZeroDivisionError until the player wraps
// it in try/except.
const LEVEL_6_REGIONS: Region[] = LEVEL_2_REGIONS
const LEVEL_6_WALLS: Wall[] = LEVEL_2_WALLS

// Art note: this level ships its own set (public/monsters/01_..10_*.png), one
// piece per monster name. Shattered Golem is the single exception — its
// 08_ShatteredGolem.png is an opaque, watermarked square with no alpha
// channel, so it would render as a photo tile rather than a cut-out sprite;
// it borrows its tier-mate Broken Golem's art instead, the same way level 2's
// two orcs and level 3's three banshees share one image.
const LEVEL_6_MONSTERS: MonsterData[] = [
  { id: 'trapsprite-1', name: 'Trap Sprite', maxHp: 125, color: '#e8c78f', attackDamage: 21, attackInterval: 10, position: [0, 0.5, -5], armor: 0, imageUrl: '/monsters/01_TrapSprite.png' },
  { id: 'cursedwisp-1', name: 'Cursed Wisp', maxHp: 105, color: '#7a2f2f', attackDamage: 23, attackInterval: 10, position: [0, 0.5, -19], armor: 0, imageUrl: '/monsters/02_CursedWisp.png' },
  { id: 'brokengolem-1', name: 'Broken Golem', maxHp: 210, color: '#5a5248', attackDamage: 28, attackInterval: 10, position: [0, 0.5, -33], armor: 0, imageUrl: '/monsters/03_BrokenGolem.png' },

  { id: 'cursedknight-1', name: 'Cursed Knight', maxHp: 155, color: '#3a2a2a', attackDamage: 24, attackInterval: 10, position: [-5, 0.5, -11], armor: 0, imageUrl: '/monsters/04_CursedKnight.png' },
  { id: 'cursedknight-2', name: 'Fallen Knight', maxHp: 155, color: '#2a1a1a', attackDamage: 24, attackInterval: 10, position: [-7, 0.5, -14], armor: 0, imageUrl: '/monsters/05_FallenKnight.png' },

  { id: 'trapsprite-2', name: 'Snare Sprite', maxHp: 125, color: '#e8a76f', attackDamage: 21, attackInterval: 10, position: [5, 0.5, -23], armor: 0, imageUrl: '/monsters/06_SnareSprite.png' },
  { id: 'cursedwisp-2', name: 'Hex Wisp', maxHp: 105, color: '#8a3f3f', attackDamage: 23, attackInterval: 10, position: [7, 0.5, -26], armor: 0, imageUrl: '/monsters/07_HexWisp.png' },

  { id: 'brokengolem-2', name: 'Shattered Golem', maxHp: 210, color: '#4a4238', attackDamage: 28, attackInterval: 10, position: [-4, 0.5, -45], armor: 0, imageUrl: '/monsters/03_BrokenGolem.png' },
  { id: 'glitchwyrm-1', name: 'Glitch Wyrm', maxHp: 430, color: '#ff2e63', attackDamage: 42, attackInterval: 10, position: [4, 0.5, -46], armor: 0, imageUrl: '/monsters/09_GlitchWyrm.png' },

  { id: 'cursedwisp-3', name: 'Blight Wisp', maxHp: 105, color: '#a34f4f', attackDamage: 23, attackInterval: 10, position: [-10, 0.5, -45], armor: 0, imageUrl: '/monsters/10_BlightWisp.png' },
]

const LEVEL_6_PICKUPS: PickupData[] = [
  { id: 'heal-11', kind: 'heal', amount: PLAYER_MAX_HP, position: [-6, 0.5, -10] },
  { id: 'attack-11', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [6, 0.5, -27] },
  { id: 'heal-12', kind: 'heal', amount: PLAYER_MAX_HP, position: [-2, 0.5, -44] },
  { id: 'attack-12', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [-10, 0.5, -44] },
  { id: 'potion-6', kind: 'attack', amount: ATTACK_PICKUP_AMOUNT, position: [0, 0.5, -12] },
]

export const LEVEL_6: LevelData = {
  level: 6,
  name: 'ดันเจี้ยนกับดักมรณะ',
  spawnPosition: [0, 0.6, 0],
  regions: LEVEL_6_REGIONS,
  walls: LEVEL_6_WALLS,
  monsters: LEVEL_6_MONSTERS,
  pickups: LEVEL_6_PICKUPS,
  decorations: LEVEL_2_DECORATIONS,
}

export const LEVELS: LevelData[] = [LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5, LEVEL_6]

// Monster ids are unique across all levels, so anything that only needs a
// monster's stats (not "every monster in the current level") can look it up
// here without knowing which level is active.
export const ALL_MONSTERS: MonsterData[] = LEVELS.flatMap((l) => l.monsters)
