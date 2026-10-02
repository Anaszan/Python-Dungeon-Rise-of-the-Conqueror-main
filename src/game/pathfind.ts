import { canStandAt, type Region, type Wall } from './dungeon'

// Walking around things, rather than into them.
//
// Click-to-walk used to be a straight line: the player marched at the spot
// they clicked, slid along whatever they met on the way, and gave up the
// moment a corner blocked both axes at once. In a dungeon of branch rooms and
// bookshelves that meant half the clicks in a level ended with the character
// grinding into a wall two metres from where they were sent.
//
// This turns the click into a route instead — a short list of waypoints that
// bends around the walls and the solid props (propCollision.ts), which
// clickMove.ts then walks one leg at a time.
//
// Everything here searches against canStandAt(), the same test Player.tsx
// moves by, so a route this returns is one the body can actually follow:
// never a line that only a point could take.

export type PathPoint = { x: number; z: number }

// Cell size of the search grid, in world units. The narrowest gap in any
// level is a doorway minus the player's own width on each side (~1.5 units at
// the tightest), so this leaves every passage several cells across while
// keeping a whole level to a few thousand cells — one click's work, not a
// frame's.
export const PATH_CELL = 0.25

// How far from an unwalkable click to look for a spot that *is* walkable.
// Clicking a wall, a bookshelf or the black past the floor edge should still
// walk the player up to it rather than doing nothing at all.
const SNAP_RADIUS = 2.5

// A level that somehow grew past this is not worth searching on a click.
const MAX_CELLS = 400_000

type Grid = {
  xMin: number
  zMin: number
  cols: number
  rows: number
  // 0 = not asked yet, 1 = a body fits here, -1 = it does not. Filled in as
  // the search reaches each cell: most clicks only ever touch a corridor's
  // worth of them.
  state: Int8Array
  regions: Region[]
  walls: Wall[]
}

function buildGrid(regions: Region[], walls: Wall[]): Grid | null {
  let xMin = Infinity
  let xMax = -Infinity
  let zMin = Infinity
  let zMax = -Infinity
  for (const r of regions) {
    xMin = Math.min(xMin, r.xMin)
    xMax = Math.max(xMax, r.xMax)
    zMin = Math.min(zMin, r.zMin)
    zMax = Math.max(zMax, r.zMax)
  }
  if (!Number.isFinite(xMin)) return null

  const cols = Math.floor((xMax - xMin) / PATH_CELL) + 1
  const rows = Math.floor((zMax - zMin) / PATH_CELL) + 1
  if (cols * rows > MAX_CELLS) return null
  return { xMin, zMin, cols, rows, state: new Int8Array(cols * rows), regions, walls }
}

const cellX = (g: Grid, ix: number) => g.xMin + ix * PATH_CELL
const cellZ = (g: Grid, iz: number) => g.zMin + iz * PATH_CELL

function open(g: Grid, ix: number, iz: number): boolean {
  if (ix < 0 || iz < 0 || ix >= g.cols || iz >= g.rows) return false
  const i = iz * g.cols + ix
  const known = g.state[i]
  if (known !== 0) return known === 1
  const ok = canStandAt(cellX(g, ix), cellZ(g, iz), g.regions, g.walls)
  g.state[i] = ok ? 1 : -1
  return ok
}

// The standable cell nearest (x, z), searched outward a ring at a time. Both
// ends of a route go through this: the destination because the player may
// have clicked a wall, and the start because a player who has somehow ended
// up inside one still has to be able to walk out.
function snap(g: Grid, x: number, z: number): number | null {
  const cx = Math.round((x - g.xMin) / PATH_CELL)
  const cz = Math.round((z - g.zMin) / PATH_CELL)
  const maxRing = Math.ceil(SNAP_RADIUS / PATH_CELL)

  for (let ring = 0; ring <= maxRing; ring++) {
    let best = -1
    let bestDistance = Infinity
    for (let ix = cx - ring; ix <= cx + ring; ix++) {
      for (let iz = cz - ring; iz <= cz + ring; iz++) {
        // Only the edge of this ring: the inside was covered by the last one.
        if (Math.max(Math.abs(ix - cx), Math.abs(iz - cz)) !== ring) continue
        if (!open(g, ix, iz)) continue
        const dx = cellX(g, ix) - x
        const dz = cellZ(g, iz) - z
        const d = dx * dx + dz * dz
        if (d < bestDistance) {
          bestDistance = d
          best = iz * g.cols + ix
        }
      }
    }
    if (best >= 0) return best
  }
  return null
}

// A* over the grid, 8-connected. Returns the cells from `from` to `to`
// inclusive, or null when the two are not connected (a vault behind a wall
// the level never opened).
function search(g: Grid, from: number, to: number): number[] | null {
  const count = g.cols * g.rows
  const cost = new Float64Array(count).fill(Infinity)
  const estimate = new Float64Array(count).fill(Infinity)
  const cameFrom = new Int32Array(count).fill(-1)
  const closed = new Uint8Array(count)

  const toX = to % g.cols
  const toZ = (to - toX) / g.cols
  // Octile distance: the cheapest 8-connected walk over empty ground, which
  // never overestimates and so keeps A* honest.
  const heuristic = (cell: number) => {
    const ix = cell % g.cols
    const iz = (cell - ix) / g.cols
    const dx = Math.abs(ix - toX)
    const dz = Math.abs(iz - toZ)
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)
  }

  // Binary min-heap of cells, ordered by `estimate`. Flat arrays rather than
  // a sorted list: a corridor-length search pushes a few thousand cells.
  const heap: number[] = []
  const push = (cell: number) => {
    heap.push(cell)
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (estimate[heap[parent]] <= estimate[heap[i]]) break
      ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
      i = parent
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let small = i
        if (l < heap.length && estimate[heap[l]] < estimate[heap[small]]) small = l
        if (r < heap.length && estimate[heap[r]] < estimate[heap[small]]) small = r
        if (small === i) break
        ;[heap[small], heap[i]] = [heap[i], heap[small]]
        i = small
      }
    }
    return top
  }

  cost[from] = 0
  estimate[from] = heuristic(from)
  push(from)

  while (heap.length) {
    const cell = pop()
    if (cell === to) break
    if (closed[cell]) continue
    closed[cell] = 1

    const ix = cell % g.cols
    const iz = (cell - ix) / g.cols
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue
        const nx = ix + dx
        const nz = iz + dz
        if (!open(g, nx, nz)) continue
        // No cutting corners: a diagonal step is only legal when both of the
        // squares it slips between are clear too. Without this the route
        // would try to shave the corner of a bookshelf and wedge the body on
        // it, which is exactly the walk this is here to replace.
        if (dx !== 0 && dz !== 0 && (!open(g, ix + dx, iz) || !open(g, ix, iz + dz))) continue

        const neighbour = nz * g.cols + nx
        if (closed[neighbour]) continue
        const step = dx !== 0 && dz !== 0 ? Math.SQRT2 : 1
        const next = cost[cell] + step
        if (next >= cost[neighbour]) continue
        cost[neighbour] = next
        estimate[neighbour] = next + heuristic(neighbour)
        cameFrom[neighbour] = cell
        push(neighbour)
      }
    }
  }

  if (cameFrom[to] < 0 && to !== from) return null
  const cells: number[] = [to]
  for (let cell = to; cell !== from; ) {
    cell = cameFrom[cell]
    if (cell < 0) return null
    cells.push(cell)
  }
  return cells.reverse()
}

// Whether the player can walk straight from one point to the other. Sampled
// at half a cell, and deliberately *not* testing the starting point itself:
// a player wedged in a wall (a level edit under an old save, say) still has
// to be allowed to walk out of it.
export function isClearLine(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  regions: Region[],
  walls: Wall[],
): boolean {
  const dx = toX - fromX
  const dz = toZ - fromZ
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (PATH_CELL * 0.5)))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    if (!canStandAt(fromX + dx * t, fromZ + dz * t, regions, walls)) return false
  }
  return true
}

// Pull the slack out of a grid route: keep a waypoint only where the straight
// line from the last one it kept finally breaks. A corridor that A* returned
// as forty cells of staircase comes back as the two or three corners the
// player actually has to turn.
function straighten(
  startX: number,
  startZ: number,
  points: PathPoint[],
  regions: Region[],
  walls: Wall[],
): PathPoint[] {
  const out: PathPoint[] = []
  let anchorX = startX
  let anchorZ = startZ
  for (let i = 1; i < points.length; i++) {
    if (isClearLine(anchorX, anchorZ, points[i].x, points[i].z, regions, walls)) continue
    const corner = points[i - 1]
    out.push(corner)
    anchorX = corner.x
    anchorZ = corner.z
  }
  out.push(points[points.length - 1])
  return out
}

// The route from where the player is standing to where they clicked, as
// waypoints to walk in order (the start is not one of them). null when there
// is no way there at all — which is the signal to ignore the click rather
// than set off on a walk that cannot finish.
export function findPath(
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  regions: Region[],
  walls: Wall[],
): PathPoint[] | null {
  // Most clicks are "a few steps down this corridor", and those need no
  // search at all.
  if (canStandAt(goalX, goalZ, regions, walls) && isClearLine(startX, startZ, goalX, goalZ, regions, walls)) {
    return [{ x: goalX, z: goalZ }]
  }

  const grid = buildGrid(regions, walls)
  if (!grid) return null
  const from = snap(grid, startX, startZ)
  const to = snap(grid, goalX, goalZ)
  if (from == null || to == null) return null
  if (from === to) {
    const ix = to % grid.cols
    const iz = (to - ix) / grid.cols
    return [{ x: cellX(grid, ix), z: cellZ(grid, iz) }]
  }

  const cells = search(grid, from, to)
  if (!cells) return null

  const points = cells.map((cell) => {
    const ix = cell % grid.cols
    const iz = (cell - ix) / grid.cols
    return { x: cellX(grid, ix), z: cellZ(grid, iz) }
  })
  const route = straighten(startX, startZ, points, regions, walls)

  // Finish on the spot that was actually clicked when that spot is standable
  // — the snapped cell is up to half a cell off, and the marker on the floor
  // is sitting where the click was.
  const last = route.length - 1
  const previous = last > 0 ? route[last - 1] : { x: startX, z: startZ }
  if (
    canStandAt(goalX, goalZ, regions, walls) &&
    isClearLine(previous.x, previous.z, goalX, goalZ, regions, walls)
  ) {
    route[last] = { x: goalX, z: goalZ }
  }
  return route
}
