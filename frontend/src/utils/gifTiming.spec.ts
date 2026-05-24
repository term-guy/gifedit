import { describe, expect, it } from 'vitest'
import {
  GIF_DEFAULT_DELAY_MS,
  GIF_RELIABLE_MIN_DELAY_MS,
  normalizeGifDelayMs,
  retimeGifSelection,
} from '@/utils/gifTiming'

describe('normalizeGifDelayMs', () => {
  it('uses the default for non-finite input', () => {
    expect(normalizeGifDelayMs(Number.NaN)).toBe(GIF_DEFAULT_DELAY_MS)
  })

  it('preserves zero for paused frames', () => {
    expect(normalizeGifDelayMs(0)).toBe(0)
  })

  it('rounds small positive values up to the reliable minimum', () => {
    expect(normalizeGifDelayMs(1)).toBe(GIF_RELIABLE_MIN_DELAY_MS)
    expect(normalizeGifDelayMs(10)).toBe(GIF_RELIABLE_MIN_DELAY_MS)
  })

  it('keeps larger values on 10 ms boundaries', () => {
    expect(normalizeGifDelayMs(21)).toBe(30)
    expect(normalizeGifDelayMs(40)).toBe(40)
  })
})

describe('retimeGifSelection', () => {
  it('scales durations to a new total without dropping frames when the minimum delay still fits', () => {
    const result = retimeGifSelection([100, 100, 100], 150)

    expect(result.frames).toEqual([
      { index: 0, duration: 50 },
      { index: 1, duration: 50 },
      { index: 2, duration: 50 },
    ])
    expect(result.droppedIndices).toEqual([])
    expect(result.actualTotalDuration).toBe(150)
  })

  it('drops evenly partitioned frames when the requested total is too short', () => {
    const result = retimeGifSelection([100, 100, 100, 100], 40)

    expect(result.frames).toEqual([
      { index: 0, duration: GIF_RELIABLE_MIN_DELAY_MS },
      { index: 2, duration: GIF_RELIABLE_MIN_DELAY_MS },
    ])
    expect(result.droppedIndices).toEqual([1, 3])
    expect(result.actualTotalDuration).toBe(40)
  })

  it('keeps zero-duration selections at zero without dropping frames', () => {
    const result = retimeGifSelection([0, 0, 0], 0)

    expect(result.frames).toEqual([
      { index: 0, duration: 0 },
      { index: 1, duration: 0 },
      { index: 2, duration: 0 },
    ])
    expect(result.droppedIndices).toEqual([])
    expect(result.actualTotalDuration).toBe(0)
  })
})
