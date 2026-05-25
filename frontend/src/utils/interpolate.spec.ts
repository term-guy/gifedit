import { describe, expect, it } from 'vitest'
import { lerp, clamp, easeInOut } from './interpolate'

describe('lerp', () => {
  it('returns a when t is 0', () => {
    expect(lerp(10, 20, 0)).toBe(10)
  })

  it('returns b when t is 1', () => {
    expect(lerp(10, 20, 1)).toBe(20)
  })

  it('returns the midpoint when t is 0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('handles negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0)
  })

  it('extrapolates beyond the range for t > 1', () => {
    expect(lerp(0, 10, 2)).toBe(20)
  })

  it('extrapolates below the range for t < 0', () => {
    expect(lerp(0, 10, -1)).toBe(-10)
  })
})

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('returns min when value is below range', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('returns max when value is above range', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('works with negative ranges', () => {
    expect(clamp(-15, -10, -5)).toBe(-10)
  })
})

describe('easeInOut', () => {
  it('returns 0 at t=0', () => {
    expect(easeInOut(0)).toBe(0)
  })

  it('returns 1 at t=1', () => {
    expect(easeInOut(1)).toBe(1)
  })

  it('returns 0.5 at t=0.5', () => {
    expect(easeInOut(0.5)).toBe(0.5)
  })

  it('accelerates in the first half (t=0.25 < 0.25 linear)', () => {
    // easeInOut at 0.25 should be less than linear at 0.25
    expect(easeInOut(0.25)).toBeLessThan(0.25)
  })

  it('decelerates in the second half (t=0.75 > 0.75 linear)', () => {
    // easeInOut at 0.75 should be greater than linear at 0.75
    expect(easeInOut(0.75)).toBeGreaterThan(0.75)
  })
})
