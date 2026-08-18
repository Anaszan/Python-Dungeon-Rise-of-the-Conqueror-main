import * as THREE from 'three'

// Recoloring the men's outfits.
//
// The women's models are flat-colored, so their shirt is one material and the
// player's swatch can just be assigned to it. The men's models are a single
// hand-painted 1024x1024 atlas shared by the whole body: multiplying the
// swatch into `material.color` tints the armor, the leather, the boots and the
// bare hands all at once, and a mid-tone swatch drags the whole model down to
// a dark silhouette. So instead of tinting the material, this repaints the
// garment's own pixels in the atlas and hands back a texture, leaving the
// leather, the skin patches and the painted trim exactly as the artist made
// them.
//
// Which pixels are the garment is per class: the warrior's plate and the
// cleric's robe are the only near-grey surfaces on their sheets, while the
// wizard's robe and the rogue's wraps are the only ones in their hue. The
// numbers here were picked by running this same pass over the four .png files
// offline and checking the result against each body mesh's UV coverage.
export type ShirtTarget =
  // Everything with almost no color of its own — steel, undyed cloth.
  | { kind: 'desaturated'; maxSat: number; minLightness: number }
  // Everything already dyed one particular hue.
  | { kind: 'hue'; hue: number; tolerance: number; minSat: number }

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function rgbToHsl(r: number, g: number, b: number, out: [number, number, number]) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) {
    out[0] = 0
    out[1] = 0
    out[2] = l
    return out
  }
  out[1] = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  out[2] = l
  if (max === r) out[0] = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) out[0] = ((b - r) / d + 2) / 6
  else out[0] = ((r - g) / d + 4) / 6
  return out
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number, out: [number, number, number]) {
  if (s === 0) {
    out[0] = l * 255
    out[1] = l * 255
    out[2] = l * 255
    return out
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  out[0] = hueToRgb(p, q, h + 1 / 3) * 255
  out[1] = hueToRgb(p, q, h) * 255
  out[2] = hueToRgb(p, q, h - 1 / 3) * 255
  return out
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 1
  return d > 0.5 ? 1 - d : d
}

// How strongly one pixel belongs to the garment, 0..1. Fading out at the edge
// of the match rather than cutting hard is what keeps the odd grey texel
// inside the leather from speckling the recolored model.
function shirtWeight(target: ShirtTarget, h: number, s: number, l: number) {
  if (target.kind === 'desaturated') {
    return clamp01((target.maxSat - s) / (target.maxSat * 0.5)) * clamp01((l - target.minLightness) / 0.06)
  }
  const distance = hueDistance(h, target.hue / 360) * 360
  return (
    clamp01((target.tolerance - distance) / (target.tolerance * 0.5)) *
    clamp01((s - target.minSat) / (target.minSat * 0.5))
  )
}

// Exported for the unit test: repaints an RGBA buffer in place. Hue and
// saturation come from the chosen color, while lightness is *shifted* toward
// it rather than replaced, so the garment keeps its painted folds and seams.
export function recolorShirtPixels(data: Uint8ClampedArray, target: ShirtTarget, shirtColor: THREE.Color) {
  const hsl = { h: 0, s: 0, l: 0 }
  shirtColor.getHSL(hsl, THREE.SRGBColorSpace)

  const pixels = data.length / 4
  const weights = new Float32Array(pixels)
  const source: [number, number, number] = [0, 0, 0]
  let weightedLightness = 0
  let totalWeight = 0

  for (let p = 0; p < pixels; p++) {
    const i = p * 4
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2], source)
    const weight = shirtWeight(target, h, s, l)
    if (weight <= 0) continue
    weights[p] = weight
    weightedLightness += l * weight
    totalWeight += weight
  }
  if (totalWeight === 0) return 0

  const meanLightness = weightedLightness / totalWeight
  const painted: [number, number, number] = [0, 0, 0]
  for (let p = 0; p < pixels; p++) {
    const weight = weights[p]
    if (weight <= 0) continue
    const i = p * 4
    const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2], source)
    const lightness = Math.min(0.97, Math.max(0.03, l + (hsl.l - meanLightness) * 0.8))
    // Keep some of the original saturation variation so painted trim and
    // stitching do not flatten into one block of color.
    const saturation = Math.min(1, hsl.s * (0.75 + 0.5 * s))
    const [r, g, b] = hslToRgb(hsl.h, saturation, lightness, painted)
    data[i] += (r - data[i]) * weight
    data[i + 1] += (g - data[i + 1]) * weight
    data[i + 2] += (b - data[i + 2]) * weight
  }
  return totalWeight
}

// Repainting a 1024x1024 atlas costs ~100ms, and the player model, the profile
// portrait and the battle portrait all ask for the same one — so results are
// shared by source texture and color. The cap is small because each entry
// holds a full-size canvas.
const CACHE_LIMIT = 8
const cache = new Map<string, THREE.Texture>()

export function getRecoloredShirtMap(
  source: THREE.Texture,
  target: ShirtTarget,
  shirtColor: string,
): THREE.Texture | null {
  const key = `${source.uuid}|${shirtColor}`
  const cached = cache.get(key)
  if (cached) return cached

  const image = source.image as CanvasImageSource & { width?: number; height?: number }
  if (!image?.width || !image?.height) return null

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  recolorShirtPixels(pixels.data, target, new THREE.Color(shirtColor))
  context.putImageData(pixels, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  // The .glb's own sampler settings have to come along — GLTFLoader leaves
  // its textures unflipped, and losing that would render the model inside out
  // texture-wise.
  texture.flipY = source.flipY
  texture.colorSpace = source.colorSpace
  texture.wrapS = source.wrapS
  texture.wrapT = source.wrapT
  texture.magFilter = source.magFilter
  texture.minFilter = source.minFilter
  texture.anisotropy = source.anisotropy
  texture.channel = source.channel
  texture.offset.copy(source.offset)
  texture.repeat.copy(source.repeat)
  texture.center.copy(source.center)
  texture.rotation = source.rotation
  texture.needsUpdate = true

  cache.set(key, texture)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.get(oldest)?.dispose()
      cache.delete(oldest)
    }
  }
  return texture
}
