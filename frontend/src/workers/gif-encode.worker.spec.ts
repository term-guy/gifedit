import { describe, expect, it } from 'vitest'
// @ts-expect-error Plain JS worker module imported for unit testing.
import { rgbaToIndexed } from './gif-encode.worker.js'
// @ts-expect-error Plain JS worker module imported for unit testing.
import { readLoopCount } from './gif-decode.worker.js'

describe('rgbaToIndexed', () => {
  it('keeps all 256 palette entries available for opaque frames', () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 0, 255,
    ])

    const { transparentIndex, indexedPixels, colorTab } = rgbaToIndexed(rgba)

    expect(transparentIndex).toBeNull()
    expect([...indexedPixels].every((index) => index >= 0 && index <= 255)).toBe(true)
    expect(colorTab.slice(0, 12)).toEqual([
      255, 0, 0,
      0, 255, 0,
      0, 0, 255,
      255, 255, 0,
    ])
    expect([...indexedPixels]).toEqual([0, 1, 2, 3])
  })

  it('reserves a transparent palette entry only when needed', () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255,
      0, 0, 0, 0,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ])

    const { transparentIndex, indexedPixels } = rgbaToIndexed(rgba)

    expect(transparentIndex).toBe(255)
    expect(indexedPixels[1]).toBe(255)
  })
})

describe('readLoopCount', () => {
  it('returns the NETSCAPE loop count when present', () => {
    const gif = {
      frames: [
        {
          application: {
            id: 'NETSCAPE2.0',
            blocks: [1, 0, 0],
          },
        },
      ],
    }

    expect(readLoopCount(gif)).toBe(0)
  })

  it('returns -1 when the GIF has no loop extension', () => {
    expect(readLoopCount({ frames: [] })).toBe(-1)
  })
})
