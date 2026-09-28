export type MonsterData = {
  id: string
  name: string
  maxHp: number
  color: string
  attackDamage: number
  attackInterval: number
  position: [number, number, number]
  // The level's boss — the fight that ends it. Exactly one per level
  // (levels.test.ts), and sealed away until every other monster on the floor
  // is dead: it is not drawn, cannot be targeted and cannot swing before then
  // (see bossIsSealed / availableMonsters in levels.ts). Killing it is what
  // opens the next level, which is the job the end-of-level exam used to do.
  boss?: boolean
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
  // over imageUrl wherever a monster is drawn. Since the fight moved into the
  // dungeon there is only one such place left — Monster.tsx — and the model a
  // player walks up to is the model they fight. Normalized against a fixed raw
  // height (see MODEL_RAW_HEIGHT), so models only need their base at local
  // y=0.
  modelUrl?: string
  // Exposed to the player's Python code as `monster_armor` (see
  // pyodideRuntime.ts). Defaults to a large number when unset so dividing by
  // it never zero-divides — level 6 sets this to 0 on purpose to force the
  // try/except lesson.
  armor?: number
}
