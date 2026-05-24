export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}
