import { NeuQuant } from './gif-neuquant.js'

function findClosestRGB(colorTab, r, g, b, excludeIndex = -1) {
  let minPos = 0
  let minDist = Number.MAX_SAFE_INTEGER
  for (let i = 0, index = 0; i < colorTab.length; i += 3, index++) {
    if (index === excludeIndex) continue
    const dr = r - (colorTab[i] & 255)
    const dg = g - (colorTab[i + 1] & 255)
    const db = b - (colorTab[i + 2] & 255)
    const dist = (dr * dr) + (dg * dg) + (db * db)
    if (dist < minDist) { minDist = dist; minPos = index }
  }
  return minPos
}

function buildExactPalette(opaqueRgb, maxColors) {
  const palette = []
  const paletteMap = new Map()

  for (let i = 0; i < opaqueRgb.length; i += 3) {
    const r = opaqueRgb[i]
    const g = opaqueRgb[i + 1]
    const b = opaqueRgb[i + 2]
    const key = (r << 16) | (g << 8) | b
    if (paletteMap.has(key)) continue
    if (palette.length / 3 >= maxColors) return null
    paletteMap.set(key, palette.length / 3)
    palette.push(r, g, b)
  }

  return { colorTab: palette, paletteMap }
}

export function rgbaToIndexed(rgba) {
  const opaqueRgb = []
  let hasTransparency = false
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) { hasTransparency = true; continue }
    opaqueRgb.push(rgba[i], rgba[i + 1], rgba[i + 2])
  }

  const transparentIndex = hasTransparency ? 255 : null
  const maxColors = transparentIndex != null ? 255 : 256
  const exactPalette = buildExactPalette(opaqueRgb, maxColors)
  let colorTab
  let paletteMap = null

  if (exactPalette) {
    colorTab = exactPalette.colorTab
    paletteMap = exactPalette.paletteMap
  } else {
    const trainingPixels = opaqueRgb.length > 0 ? new Uint8Array(opaqueRgb) : new Uint8Array([0, 0, 0])
    const quant = new NeuQuant(trainingPixels, 1)
    quant.buildColormap()
    colorTab = quant.getColormap()
  }

  if (transparentIndex != null) {
    colorTab[transparentIndex * 3] = 0
    colorTab[transparentIndex * 3 + 1] = 0
    colorTab[transparentIndex * 3 + 2] = 0
  }

  const indexedPixels = new Uint8Array(rgba.length / 4)
  for (let i = 0, px = 0; i < rgba.length; i += 4, px++) {
    const alpha = rgba[i + 3]
    if (alpha === 0 && transparentIndex != null) { indexedPixels[px] = transparentIndex; continue }
    if (paletteMap) {
      const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]
      indexedPixels[px] = paletteMap.get(key)
      continue
    }
    indexedPixels[px] = findClosestRGB(colorTab, rgba[i], rgba[i + 1], rgba[i + 2], transparentIndex ?? -1)
  }

  return { indexedPixels, colorTab, transparentIndex }
}
