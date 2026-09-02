export type MonsterData = {
  id: string
  name: string
  maxHp: number
  color: string
  attackDamage: number
  attackInterval: number
  position: [number, number, number]
  // Art: drop a (transparent-background) image under public/monsters and
  // point this at its URL (e.g. "/monsters/slime.png") to render the monster
  // as a billboarded sprite instead of the placeholder shape. Still required
  // even now that every monster has a modelUrl (levels.test.ts enforces it):
  // it is the fallback both the dungeon and the battle screen drop to when a
  // model fails to load, and the only art a monster would have if its GLB
  // went missing.
  imageUrl?: string
  // The monster's 3D model: a GLB under public/monsters, rendered billboarded
  // and playing whatever attack loop it was exported with. Takes precedence
  // over imageUrl in *both* places a monster is drawn — the dungeon
  // (Monster.tsx) and the battle screen (MonsterPortrait.tsx), which share one
  // MonsterArt component so a creature looks the same in the corridor as it
  // does in the fight. Normalized against a fixed raw height (see
  // MODEL_RAW_HEIGHT), so models only need their base at local y=0.
  modelUrl?: string
  // Exposed to the player's Python code as `monster_armor` (see
  // pyodideRuntime.ts). Defaults to a large number when unset so dividing by
  // it never zero-divides — level 6 sets this to 0 on purpose to force the
  // try/except lesson.
  armor?: number
}
