import { describe, expect, it } from 'vitest'
import { floodFill } from './floodFill'

/**
 * Helper: create a small ImageData filled with a single color.
 */
function solidImageData(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  return new ImageData(data, width, height)
}

/**
 * Helper: read pixel color from ImageData at (x, y).
 */
function pixelAt(
  imageData: ImageData,
  x: number,
  y: number,
): [number, number, number, number] {
  const idx = (y * imageData.width + x) * 4
  return [
    imageData.data[idx],
    imageData.data[idx + 1],
    imageData.data[idx + 2],
    imageData.data[idx + 3],
  ]
}

describe('floodFill', () => {
  it('fills a solid-color image entirely', () => {
    const src = solidImageData(3, 3, 255, 0, 0) // red
    const result = floodFill(src, 1, 1, '#00ff00') // fill green at center

    // Every pixel should now be green
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(pixelAt(result, x, y)).toEqual([0, 255, 0, 255])
      }
    }
  })

  it('returns the original ImageData when fill color matches target color', () => {
    const src = solidImageData(2, 2, 255, 0, 0)
    const result = floodFill(src, 0, 0, '#ff0000')

    // Should be the same object (early return)
    expect(result).toBe(src)
  })

  it('fills only a bounded region separated by a different color', () => {
    const src = solidImageData(4, 4, 255, 255, 255) // white background

    // Draw a horizontal red line at y=1, blocking fill propagation
    for (let x = 0; x < 4; x++) {
      const idx = (1 * 4 + x) * 4
      src.data[idx] = 255
      src.data[idx + 1] = 0
      src.data[idx + 2] = 0
    }

    // Fill from top-left corner (y=0) with blue
    const result = floodFill(src, 0, 0, '#0000ff')

    // Top row should be blue
    for (let x = 0; x < 4; x++) {
      expect(pixelAt(result, x, 0)).toEqual([0, 0, 255, 255])
    }

    // Red barrier row should remain red
    for (let x = 0; x < 4; x++) {
      expect(pixelAt(result, x, 1)).toEqual([255, 0, 0, 255])
    }

    // Rows below the barrier should remain white
    for (let y = 2; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(pixelAt(result, x, y)).toEqual([255, 255, 255, 255])
      }
    }
  })

  it('respects tolerance when matching target colors', () => {
    // Build a gradient image: top-left (100,0,0), top-right (110,0,0),
    // bottom row (200,0,0). Low tolerance should only fill matching neighbors;
    // high tolerance should bridge the gap.
    const gradient = new Uint8ClampedArray(2 * 2 * 4)
    // Top-left: (100, 0, 0), Top-right: (110, 0, 0)
    gradient[0] = 100; gradient[1] = 0; gradient[2] = 0; gradient[3] = 255
    gradient[4] = 110; gradient[5] = 0; gradient[6] = 0; gradient[7] = 255
    // Bottom-left: (200, 0, 0), Bottom-right: (200, 0, 0)
    gradient[8] = 200; gradient[9] = 0; gradient[10] = 0; gradient[11] = 255
    gradient[12] = 200; gradient[13] = 0; gradient[14] = 0; gradient[15] = 255
    const gradImage = new ImageData(gradient, 2, 2)

    // Low tolerance (5): starting at (0,0) with target ~100, neighbor (1,0)=110 should NOT match
    const lowTol = floodFill(gradImage, 0, 0, '#00ff00', 5)
    expect(pixelAt(lowTol, 0, 0)).toEqual([0, 255, 0, 255]) // filled
    expect(pixelAt(lowTol, 1, 0)).toEqual([110, 0, 0, 255]) // not filled

    // High tolerance (15): starting at (0,0), neighbor (1,0)=110 should match
    const highTol = floodFill(gradImage, 0, 0, '#00ff00', 15)
    expect(pixelAt(highTol, 0, 0)).toEqual([0, 255, 0, 255]) // filled
    expect(pixelAt(highTol, 1, 0)).toEqual([0, 255, 0, 255]) // also filled
  })

  it('fills a single pixel when neighbors are all different', () => {
    const src = solidImageData(3, 3, 255, 255, 255)

    // Set center to red, everything else remains white
    const centerIdx = (1 * 3 + 1) * 4
    src.data[centerIdx] = 255
    src.data[centerIdx + 1] = 0
    src.data[centerIdx + 2] = 0

    // Fill center with blue
    const result = floodFill(src, 1, 1, '#0000ff', 0)

    // Only center should be blue
    expect(pixelAt(result, 1, 1)).toEqual([0, 0, 255, 255])

    // Neighbors should remain white
    expect(pixelAt(result, 0, 1)).toEqual([255, 255, 255, 255])
    expect(pixelAt(result, 2, 1)).toEqual([255, 255, 255, 255])
    expect(pixelAt(result, 1, 0)).toEqual([255, 255, 255, 255])
    expect(pixelAt(result, 1, 2)).toEqual([255, 255, 255, 255])
  })

  it('handles hex colors with and without # prefix', () => {
    const src = solidImageData(2, 2, 0, 0, 0)

    // With # prefix
    const result1 = floodFill(src, 0, 0, '#ff0000')
    expect(pixelAt(result1, 0, 0)).toEqual([255, 0, 0, 255])

    // Without # prefix (hexToRgba strips it)
    const result2 = floodFill(src, 0, 0, '00ff00')
    expect(pixelAt(result2, 0, 0)).toEqual([0, 255, 0, 255])
  })
})
