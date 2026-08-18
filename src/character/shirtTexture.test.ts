// The shirt recolor picks the garment out of a shared texture atlas by color
// alone, so the thing worth pinning down is what it refuses to touch: skin,
// leather and painted trim sit in the same image as the shirt.
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { recolorShirtPixels, type ShirtTarget } from './shirtTexture'

// Real pixels off the men's atlases (they read much darker than the lit model
// does), so the thresholds are tested against the values they were tuned for.
const STEEL: Pixel = [59, 61, 59] // Warrior_Texture (560,420)
const UNDYED_CLOTH: Pixel = [143, 141, 127] // Cleric_Texture (150,750)
const LEATHER: Pixel = [66, 56, 42] // Warrior_Texture (850,150)
const SKIN: Pixel = [193, 150, 114] // Warrior_Texture (300,820)
const BLUE_ROBE: Pixel = [30, 52, 110] // Wizard_Texture (450,550)
const GOLD_TRIM: Pixel = [90, 70, 23] // Wizard_Texture (40,300)

type Pixel = [number, number, number]

const DESATURATED: ShirtTarget = { kind: 'desaturated', maxSat: 0.09, minLightness: 0.15 }
const BLUE: ShirtTarget = { kind: 'hue', hue: 222, tolerance: 40, minSat: 0.2 }

function buffer(colors: Pixel[]) {
  const data = new Uint8ClampedArray(colors.length * 4)
  colors.forEach(([r, g, b], i) => {
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = 255
  })
  return data
}

function pixelAt(data: Uint8ClampedArray, index: number): Pixel {
  return [data[index * 4], data[index * 4 + 1], data[index * 4 + 2]]
}

describe('recolorShirtPixels', () => {
  it('repaints the near-grey garment and leaves leather and skin alone', () => {
    const data = buffer([STEEL, UNDYED_CLOTH, LEATHER, SKIN])

    recolorShirtPixels(data, DESATURATED, new THREE.Color('#2f6fa8'))

    for (const index of [0, 1]) {
      const [r, , b] = pixelAt(data, index)
      expect(b, `pixel ${index} should read blue`).toBeGreaterThan(r + 30)
    }
    expect(pixelAt(data, 2)).toEqual(LEATHER)
    expect(pixelAt(data, 3)).toEqual(SKIN)
  })

  it('repaints only the robe hue, keeping its gold trim', () => {
    const data = buffer([BLUE_ROBE, GOLD_TRIM, LEATHER, SKIN])

    recolorShirtPixels(data, BLUE, new THREE.Color('#b23b3b'))

    const [r, g, b] = pixelAt(data, 0)
    expect(r).toBeGreaterThan(g)
    expect(r).toBeGreaterThan(b)
    expect(pixelAt(data, 1)).toEqual(GOLD_TRIM)
    expect(pixelAt(data, 2)).toEqual(LEATHER)
    expect(pixelAt(data, 3)).toEqual(SKIN)
  })

  it('keeps the garment shaded rather than flooding it with one flat color', () => {
    const shadow: Pixel = [60, 64, 68]
    const highlight: Pixel = [170, 176, 182]
    const data = buffer([shadow, highlight])

    recolorShirtPixels(data, DESATURATED, new THREE.Color('#3f7a4a'))

    const [, shadowG] = pixelAt(data, 0)
    const [, highlightG] = pixelAt(data, 1)
    expect(highlightG).toBeGreaterThan(shadowG + 30)
  })

  it('reports no match rather than repainting a sheet with nothing on target', () => {
    const data = buffer([LEATHER, SKIN, GOLD_TRIM])
    const before = Array.from(data)

    expect(recolorShirtPixels(data, DESATURATED, new THREE.Color('#2f6fa8'))).toBe(0)
    expect(Array.from(data)).toEqual(before)
  })

  it('leaves alpha untouched so cut-out edges stay cut out', () => {
    const data = buffer([STEEL])
    data[3] = 0

    recolorShirtPixels(data, DESATURATED, new THREE.Color('#2f6fa8'))

    expect(data[3]).toBe(0)
  })
})
