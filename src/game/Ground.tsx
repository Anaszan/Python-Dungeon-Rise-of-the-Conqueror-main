import { Suspense, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { Region, Wall } from './dungeon'
import { WALL_HEIGHT } from './dungeon'
import type { FloorPalette, LevelTheme, SurfaceGlow, WallPalette } from './levelTheme'

function TexturedFloorMaterial({ url, width, depth }: { url: string; width: number; depth: number }) {
  const texture = useTexture(url)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(width, depth)
  return <meshStandardMaterial map={texture} />
}

function TexturedWallMaterial({ url, width, height }: { url: string; width: number; height: number }) {
  const texture = useTexture(url)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(width, height)
  return <meshStandardMaterial map={texture} />
}

// Seeded PRNG so texture detail (cracks, moss, speckle) is stable across
// re-renders instead of jittering every time the canvas is redrawn.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TEXTURE_SIZE = 512

function newCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = TEXTURE_SIZE
  return { canvas, ctx: canvas.getContext('2d')! }
}

function toTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

// One stone/plank tone, nudged by `variance` so no two slabs read as identical
// even though they come from the same two base colours. Blue is moved least,
// which is what keeps a weathered surface from drifting toward grey.
function varied([r, g, b]: [number, number, number], variance: number) {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `rgb(${c(r + variance)}, ${c(g + variance * 0.85)}, ${c(b + variance * 0.6)})`
}

// A glowing mark is drawn into two canvases at once: faintly into the colour
// map so it reads as burned into the surface, and at full strength into an
// emissive map. The emissive copy is what makes ด่าน 4's sigils and ด่าน 6's
// reality-cracks visible at all — those levels carry no light of their own,
// so an unlit floor mark would simply be black (see GameScene).
type GlowTarget = { ctx: CanvasRenderingContext2D; emissive: CanvasRenderingContext2D | null }

function strokeGlow(target: GlowTarget, color: string, width: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  target.ctx.save()
  target.ctx.strokeStyle = color
  target.ctx.globalAlpha = 0.35
  target.ctx.lineWidth = width
  draw(target.ctx)
  target.ctx.restore()

  if (!target.emissive) return
  target.emissive.save()
  target.emissive.strokeStyle = color
  target.emissive.lineWidth = width
  target.emissive.shadowColor = color
  target.emissive.shadowBlur = 12
  draw(target.emissive)
  target.emissive.restore()
}

// An arcane sigil: an outer ring, an inner ring, and a triangle bridging them.
function drawRuneMark(target: GlowTarget, color: string, x: number, y: number, r: number) {
  strokeGlow(target, color, 3, (ctx) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2
      const px = x + Math.cos(a) * r * 0.8
      const py = y + Math.sin(a) * r * 0.8
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
  })
}

// A tear in reality: a jagged main line with a couple of short forks off it.
function drawCrackMark(
  target: GlowTarget,
  color: string,
  rand: () => number,
  x: number,
  y: number,
  len: number,
) {
  const angle = rand() * Math.PI * 2
  const points: [number, number][] = [[x, y]]
  let cx = x
  let cy = y
  for (let i = 0; i < 5; i++) {
    const a = angle + (rand() - 0.5) * 1.4
    cx += Math.cos(a) * (len / 5)
    cy += Math.sin(a) * (len / 5)
    points.push([cx, cy])
  }
  strokeGlow(target, color, 2.5, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (const [px, py] of points.slice(1)) ctx.lineTo(px, py)
    ctx.stroke()
  })
  // forks
  const [fx, fy] = points[2]
  strokeGlow(target, color, 1.5, (ctx) => {
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.lineTo(fx + (rand() - 0.5) * len * 0.5, fy + (rand() - 0.5) * len * 0.5)
    ctx.stroke()
  })
}

function drawGlowMark(
  target: GlowTarget,
  glow: SurfaceGlow,
  rand: () => number,
  x: number,
  y: number,
  scale: number,
) {
  if (glow.style === 'rune') drawRuneMark(target, glow.color, x, y, scale * 0.35)
  else drawCrackMark(target, glow.color, rand, x, y, scale * 0.9)
}

// Cut stone slabs with grout lines — the classic dungeon floor. Used by ด่าน
// 1, 2, 4 and 6, each with its own palette.
function drawSlabFloor(ctx: CanvasRenderingContext2D, p: FloorPalette, rand: () => number) {
  const size = TEXTURE_SIZE
  const slabA = hexToRgb(p.slabA)
  const slabB = hexToRgb(p.slabB)
  ctx.fillStyle = p.base
  ctx.fillRect(0, 0, size, size)

  const tiles = 6
  const tileSize = size / tiles
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const variance = rand() * 14 - 7
      ctx.fillStyle = varied((tx + ty) % 2 === 0 ? slabA : slabB, variance)
      const px = tx * tileSize
      const py = ty * tileSize
      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4)

      // corner vignette so each slab reads as slightly beveled/carved
      const grad = ctx.createRadialGradient(
        px + tileSize / 2,
        py + tileSize / 2,
        tileSize * 0.15,
        px + tileSize / 2,
        py + tileSize / 2,
        tileSize * 0.7,
      )
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.22)')
      ctx.fillStyle = grad
      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4)

      if (rand() < p.speckleChance) {
        ctx.fillStyle = `rgba(${p.speckle}, ${0.15 + rand() * 0.15})`
        ctx.beginPath()
        ctx.ellipse(
          px + tileSize * (0.2 + rand() * 0.6),
          py + tileSize * (0.2 + rand() * 0.6),
          tileSize * 0.12,
          tileSize * 0.08,
          rand() * Math.PI,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }

      if (rand() < 0.25) {
        ctx.strokeStyle = p.crack
        ctx.lineWidth = 1.5
        ctx.beginPath()
        let cx = px + tileSize * rand()
        let cy = py + tileSize * rand()
        ctx.moveTo(cx, cy)
        for (let s = 0; s < 3; s++) {
          cx += (rand() - 0.5) * tileSize * 0.4
          cy += (rand() - 0.5) * tileSize * 0.4
          ctx.lineTo(cx, cy)
        }
        ctx.stroke()
      }
    }
  }

  ctx.strokeStyle = p.grout
  ctx.lineWidth = 3
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath()
    ctx.moveTo(i * tileSize, 0)
    ctx.lineTo(i * tileSize, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * tileSize)
    ctx.lineTo(size, i * tileSize)
    ctx.stroke()
  }
}

// Packed dirt and grit with old stains worked into it — no tile seams at all,
// which is most of what separates the arena floor from a cut-stone one.
function drawSandFloor(ctx: CanvasRenderingContext2D, p: FloorPalette, rand: () => number) {
  const size = TEXTURE_SIZE
  const light = hexToRgb(p.slabA)
  const dark = hexToRgb(p.slabB)
  ctx.fillStyle = p.base
  ctx.fillRect(0, 0, size, size)

  // broad drifts of lighter and darker sand
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = varied(rand() < 0.5 ? light : dark, rand() * 10 - 5)
    ctx.globalAlpha = 0.25 + rand() * 0.25
    ctx.beginPath()
    ctx.ellipse(rand() * size, rand() * size, size * (0.06 + rand() * 0.12), size * (0.04 + rand() * 0.08), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // grain
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = varied(rand() < 0.5 ? light : dark, rand() * 40 - 20)
    ctx.globalAlpha = 0.2 + rand() * 0.4
    const gx = rand() * size
    const gy = rand() * size
    ctx.fillRect(gx, gy, 1 + rand() * 2, 1 + rand() * 2)
  }
  ctx.globalAlpha = 1

  // dark stains ground into the sand where the fighting happens
  for (let i = 0; i < 14; i++) {
    if (rand() > p.speckleChance + 0.4) continue
    ctx.fillStyle = `rgba(${p.speckle}, ${0.12 + rand() * 0.2})`
    ctx.beginPath()
    ctx.ellipse(rand() * size, rand() * size, size * (0.03 + rand() * 0.07), size * (0.02 + rand() * 0.05), rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  // scattered pebbles
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = varied(dark, rand() * 24 - 12)
    ctx.beginPath()
    ctx.ellipse(rand() * size, rand() * size, 2 + rand() * 3, 1.5 + rand() * 2.5, rand() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }
}

// Long wooden boards running across the tile, with grain and staggered end
// seams. The library is the one level not made of stone.
function drawPlankFloor(ctx: CanvasRenderingContext2D, p: FloorPalette, rand: () => number) {
  const size = TEXTURE_SIZE
  const woodA = hexToRgb(p.slabA)
  const woodB = hexToRgb(p.slabB)
  ctx.fillStyle = p.base
  ctx.fillRect(0, 0, size, size)

  const planks = 6
  const plankHeight = size / planks
  for (let row = 0; row < planks; row++) {
    const y = row * plankHeight
    ctx.fillStyle = varied(row % 2 === 0 ? woodA : woodB, rand() * 16 - 8)
    ctx.fillRect(0, y + 1.5, size, plankHeight - 3)

    // grain: long wavering lines along the board
    for (let g = 0; g < 7; g++) {
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.06 + rand() * 0.12})`
      ctx.lineWidth = 0.8 + rand()
      ctx.beginPath()
      const gy = y + plankHeight * (0.15 + rand() * 0.7)
      ctx.moveTo(0, gy)
      for (let x = 0; x <= size; x += size / 8) {
        ctx.lineTo(x, gy + (rand() - 0.5) * plankHeight * 0.12)
      }
      ctx.stroke()
    }

    // a knot or two
    if (rand() < 0.5) {
      const kx = rand() * size
      const ky = y + plankHeight * 0.5
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.lineWidth = 1.5
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath()
        ctx.ellipse(kx, ky, k * 3, k * 2, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // staggered end seam
    const seam = size * (row % 2 === 0 ? 0.38 : 0.71)
    ctx.fillStyle = p.grout
    ctx.fillRect(seam, y + 1.5, 2.5, plankHeight - 3)

    // board edge shading
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
    ctx.fillRect(0, y + 1.5, size, 1.5)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, y + plankHeight - 3, size, 2)

    // settled dust along the boards
    if (rand() < p.speckleChance + 0.4) {
      ctx.fillStyle = `rgba(${p.speckle}, ${0.05 + rand() * 0.06})`
      ctx.fillRect(0, y + plankHeight * rand() * 0.6, size, plankHeight * 0.2)
    }
  }
}

// Staggered stone courses. `rows`/`cols` are what turn the same routine from
// ด่าน 1's small dungeon bricks into ด่าน 3's big colosseum blocks.
function drawBrickWall(ctx: CanvasRenderingContext2D, p: WallPalette, rand: () => number) {
  const size = TEXTURE_SIZE
  const brickA = hexToRgb(p.brickA)
  const brickB = hexToRgb(p.brickB)
  ctx.fillStyle = p.mortar
  ctx.fillRect(0, 0, size, size)

  const rowHeight = size / p.rows
  const brickWidth = size / p.cols
  for (let row = 0; row < p.rows; row++) {
    const offset = row % 2 === 0 ? 0 : rowHeight
    for (let i = -1; i <= p.cols; i++) {
      const x = i * brickWidth + offset
      const variance = rand() * 16 - 8
      ctx.fillStyle = varied((row + i) % 2 === 0 ? brickA : brickB, variance)
      const bx = x + 2
      const by = row * rowHeight + 2
      const bw = brickWidth - 4
      const bh = rowHeight - 4
      ctx.fillRect(bx, by, bw, bh)

      // subtle top-edge highlight, bottom-edge shadow per brick for depth
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.fillRect(bx, by, bw, 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(bx, by + bh - 2, bw, 2)

      if (rand() < p.speckleChance) {
        ctx.fillStyle = `rgba(${p.speckle}, ${0.1 + rand() * 0.15})`
        ctx.beginPath()
        ctx.ellipse(bx + bw * rand(), by + bh * rand(), bw * 0.15, bh * 0.3, 0, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

// Bookcase wall: shelf boards packed edge to edge with book spines. Drawn at
// one repeat per wall height (see WallPalette.tileV) so the shelves never get
// sliced off halfway up.
function drawShelfWall(ctx: CanvasRenderingContext2D, p: WallPalette, rand: () => number) {
  const size = TEXTURE_SIZE
  const board = hexToRgb(p.brickA)
  ctx.fillStyle = p.mortar
  ctx.fillRect(0, 0, size, size)

  const shelfHeight = size / p.rows
  for (let row = 0; row < p.rows; row++) {
    const top = row * shelfHeight
    const boardThickness = shelfHeight * 0.12
    const slotTop = top + boardThickness
    const slotHeight = shelfHeight - boardThickness * 2

    // dark recess behind the books
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, slotTop, size, slotHeight)

    // book spines
    let x = 2 + rand() * 6
    while (x < size - 6) {
      const w = 8 + rand() * 16
      const lean = rand() < 0.08
      const h = slotHeight * (0.7 + rand() * 0.28)
      const y = slotTop + slotHeight - h
      ctx.save()
      if (lean) {
        ctx.translate(x + w / 2, slotTop + slotHeight)
        ctx.rotate((rand() - 0.5) * 0.35)
        ctx.translate(-(x + w / 2), -(slotTop + slotHeight))
      }
      // Hue-random spines: the one place in the palette where variety beats
      // matching, since a wall of identically coloured books reads as a
      // striped box rather than a library.
      const hue = Math.floor(rand() * 360)
      ctx.fillStyle = `hsl(${hue}, ${25 + rand() * 30}%, ${18 + rand() * 22}%)`
      ctx.fillRect(x, y, w, h)
      // gilt band on the spine
      ctx.fillStyle = `rgba(${p.speckle}, ${0.25 + rand() * 0.35})`
      ctx.fillRect(x + 1, y + h * (0.15 + rand() * 0.2), w - 2, 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.fillRect(x + w - 2, y, 2, h)
      ctx.restore()
      x += w + 1 + rand() * 2
    }

    // the shelf board itself
    ctx.fillStyle = varied(board, rand() * 10 - 5)
    ctx.fillRect(0, top + shelfHeight - boardThickness, size, boardThickness)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'
    ctx.fillRect(0, top + shelfHeight - boardThickness, size, 2)
    ctx.fillStyle = p.brickB
    ctx.fillRect(0, top, size, boardThickness * 0.6)
  }

  // vertical case dividers
  ctx.fillStyle = varied(board, -10)
  for (const dx of [0, size / 2 - 4, size - 8]) ctx.fillRect(dx, 0, 8, size)
}

type SurfaceTextures = { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture | null; glow?: SurfaceGlow }

function scatterGlow(target: GlowTarget, glow: SurfaceGlow, rand: () => number, cells: number) {
  const cell = TEXTURE_SIZE / cells
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      if (rand() >= glow.chance) continue
      drawGlowMark(target, glow, rand, (cx + 0.5) * cell, (cy + 0.5) * cell, cell)
    }
  }
}

function createFloorTextures(p: FloorPalette): SurfaceTextures {
  const { canvas, ctx } = newCanvas()
  const emissive = p.glow ? newCanvas() : null
  if (emissive) {
    emissive.ctx.fillStyle = '#000000'
    emissive.ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  }
  const rand = mulberry32(1337)

  if (p.style === 'sand') drawSandFloor(ctx, p, rand)
  else if (p.style === 'plank') drawPlankFloor(ctx, p, rand)
  else drawSlabFloor(ctx, p, rand)

  if (p.glow) scatterGlow({ ctx, emissive: emissive?.ctx ?? null }, p.glow, rand, 4)

  return {
    map: toTexture(canvas),
    emissiveMap: emissive ? toTexture(emissive.canvas) : null,
    glow: p.glow,
  }
}

function createWallTextures(p: WallPalette): SurfaceTextures {
  const { canvas, ctx } = newCanvas()
  const emissive = p.glow ? newCanvas() : null
  if (emissive) {
    emissive.ctx.fillStyle = '#000000'
    emissive.ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
  }
  const rand = mulberry32(4242)

  if (p.style === 'shelf') drawShelfWall(ctx, p, rand)
  else drawBrickWall(ctx, p, rand)

  if (p.glow) scatterGlow({ ctx, emissive: emissive?.ctx ?? null }, p.glow, rand, 3)

  return {
    map: toTexture(canvas),
    emissiveMap: emissive ? toTexture(emissive.canvas) : null,
    glow: p.glow,
  }
}

// One canvas per theme, not one per mesh. Every floor slab and every wall box
// needs its own THREE.Texture because each sets its own `repeat`, but a clone
// shares the underlying image source — so a level with 5 regions and 20 walls
// still draws (and uploads to the GPU) exactly two canvases.
const floorTextureCache = new Map<string, SurfaceTextures>()
const wallTextureCache = new Map<string, SurfaceTextures>()

function cached(cache: Map<string, SurfaceTextures>, key: string, make: () => SurfaceTextures) {
  let entry = cache.get(key)
  if (!entry) {
    entry = make()
    cache.set(key, entry)
  }
  return entry
}

function useTiledMaterial(base: SurfaceTextures, repeatX: number, repeatY: number) {
  const cloned = useMemo(() => {
    const map = base.map.clone()
    map.needsUpdate = true
    const emissiveMap = base.emissiveMap ? base.emissiveMap.clone() : null
    if (emissiveMap) emissiveMap.needsUpdate = true
    return { map, emissiveMap }
  }, [base])

  for (const tex of [cloned.map, cloned.emissiveMap]) {
    if (!tex) continue
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(repeatX, repeatY)
  }
  return cloned
}

function ThemedFloorMaterial({ theme, width, depth }: { theme: LevelTheme; width: number; depth: number }) {
  const base = cached(floorTextureCache, theme.id, () => createFloorTextures(theme.floor))
  const { map, emissiveMap } = useTiledMaterial(base, width / theme.floor.tile, depth / theme.floor.tile)
  return (
    <meshStandardMaterial
      map={map}
      emissiveMap={emissiveMap ?? undefined}
      emissive={emissiveMap ? '#ffffff' : '#000000'}
      emissiveIntensity={base.glow?.intensity ?? 0}
    />
  )
}

function ThemedWallMaterial({ theme, width, height }: { theme: LevelTheme; width: number; height: number }) {
  const base = cached(wallTextureCache, theme.id, () => createWallTextures(theme.wall))
  const { map, emissiveMap } = useTiledMaterial(base, width / theme.wall.tileU, height / theme.wall.tileV)
  return (
    <meshStandardMaterial
      map={map}
      emissiveMap={emissiveMap ?? undefined}
      emissive={emissiveMap ? '#ffffff' : '#000000'}
      emissiveIntensity={base.glow?.intensity ?? 0}
    />
  )
}

export function Ground({
  regions,
  walls,
  theme,
  floorTextureUrl,
  wallTextureUrl,
  onFloorClick,
}: {
  regions: Region[]
  walls: Wall[]
  theme: LevelTheme
  floorTextureUrl?: string
  wallTextureUrl?: string
  // Click-to-walk (see clickMove.ts). The floor slabs are the only thing in
  // the dungeon the player can click *through* to a place rather than at a
  // thing, so this lives here. Monsters stop the event before it reaches the
  // floor, which is what keeps "attack that" from also meaning "walk there".
  onFloorClick?: (x: number, z: number) => void
}) {
  return (
    <group>
      {regions.map((r, i) => {
        const width = r.xMax - r.xMin
        const depth = r.zMax - r.zMin
        const x = (r.xMin + r.xMax) / 2
        const z = (r.zMin + r.zMax) / 2
        // No <Grid> overlay on top of the floor any more. drei's Grid draws
        // through its own unlit shader, so once the dungeon went dark (see
        // GameScene) it was the one thing still visible everywhere — a
        // glowing wireframe map of rooms the player's lantern had never
        // reached. The procedural stone texture already carves its own slab
        // grout lines, so nothing was lost by dropping it.
        return (
          <mesh
            key={i}
            receiveShadow
            position={[x, 0, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerDown={
              onFloorClick &&
              ((e) => {
                // Only the nearest floor hit: a click crossing two slabs at a
                // shared edge would otherwise fire twice.
                e.stopPropagation()
                onFloorClick(e.point.x, e.point.z)
              })
            }
          >
            <planeGeometry args={[width, depth]} />
            {floorTextureUrl ? (
              <Suspense fallback={<ThemedFloorMaterial theme={theme} width={width} depth={depth} />}>
                <TexturedFloorMaterial url={floorTextureUrl} width={width} depth={depth} />
              </Suspense>
            ) : (
              <ThemedFloorMaterial theme={theme} width={width} depth={depth} />
            )}
          </mesh>
        )
      })}

      {walls.map((w, i) => (
        <mesh
          key={i}
          castShadow
          receiveShadow
          position={[w.x, WALL_HEIGHT / 2, w.z]}
        >
          <boxGeometry args={[w.width, WALL_HEIGHT, w.depth]} />
          {wallTextureUrl ? (
            <Suspense fallback={<ThemedWallMaterial theme={theme} width={w.width} height={WALL_HEIGHT} />}>
              <TexturedWallMaterial url={wallTextureUrl} width={w.width} height={WALL_HEIGHT} />
            </Suspense>
          ) : (
            <ThemedWallMaterial theme={theme} width={w.width} height={WALL_HEIGHT} />
          )}
        </mesh>
      ))}
    </group>
  )
}
