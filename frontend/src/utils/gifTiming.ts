export const GIF_DELAY_STEP_MS = 10
export const GIF_RELIABLE_MIN_DELAY_MS = 20
export const GIF_DEFAULT_DELAY_MS = 100

export interface RetimedGifFrame {
  index: number
  duration: number
}

export interface RetimedGifSelection {
  frames: RetimedGifFrame[]
  droppedIndices: number[]
  actualTotalDuration: number
}

export function normalizeGifDelayMs(duration: number): number {
  if (!Number.isFinite(duration)) return GIF_DEFAULT_DELAY_MS

  const rounded = Math.round(duration)
  if (rounded <= 0) return 0

  // GIF stores delays in centiseconds, but 10 ms frames are commonly played
  // back slower by viewers. Author at 20 ms minimum so preview and export align.
  return Math.max(GIF_RELIABLE_MIN_DELAY_MS, Math.ceil(rounded / GIF_DELAY_STEP_MS) * GIF_DELAY_STEP_MS)
}

function normalizeTargetTotalDuration(duration: number): number {
  if (!Number.isFinite(duration)) return GIF_DEFAULT_DELAY_MS

  const rounded = Math.round(duration / GIF_DELAY_STEP_MS) * GIF_DELAY_STEP_MS
  if (rounded <= 0) return 0

  return Math.max(GIF_RELIABLE_MIN_DELAY_MS, rounded)
}

function buildEvenGroups(frameCount: number, keepCount: number): number[][] {
  const groups: number[][] = []

  for (let i = 0; i < keepCount; i++) {
    const start = Math.floor((i * frameCount) / keepCount)
    const end = Math.floor(((i + 1) * frameCount) / keepCount)
    const group: number[] = []

    for (let index = start; index < end; index++) {
      group.push(index)
    }

    if (group.length > 0) groups.push(group)
  }

  return groups
}

function allocateGroupDurations(totalDuration: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  if (totalDuration <= 0) return new Array(weights.length).fill(0)

  const baseDuration = GIF_RELIABLE_MIN_DELAY_MS
  const extraStepsTotal = Math.max(
    0,
    Math.round((totalDuration - weights.length * baseDuration) / GIF_DELAY_STEP_MS),
  )

  const safeWeights = weights.some((weight) => weight > 0)
    ? weights
    : weights.map(() => 1)
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0)
  const rawSteps = safeWeights.map((weight) => (extraStepsTotal * weight) / weightTotal)
  const stepAllocations = rawSteps.map((value) => Math.floor(value))
  let remainingSteps = extraStepsTotal - stepAllocations.reduce((sum, value) => sum + value, 0)

  const remainders = rawSteps
    .map((value, index) => ({ index, remainder: value - stepAllocations[index] }))
    .sort((a, b) => b.remainder - a.remainder)

  for (const { index } of remainders) {
    if (remainingSteps <= 0) break
    stepAllocations[index] += 1
    remainingSteps -= 1
  }

  return stepAllocations.map((steps) => baseDuration + steps * GIF_DELAY_STEP_MS)
}

export function retimeGifSelection(
  durations: number[],
  targetTotalDuration: number,
): RetimedGifSelection {
  if (durations.length === 0) {
    return { frames: [], droppedIndices: [], actualTotalDuration: 0 }
  }

  const normalizedTarget = normalizeTargetTotalDuration(targetTotalDuration)
  if (normalizedTarget === 0) {
    return {
      frames: durations.map((_, index) => ({ index, duration: 0 })),
      droppedIndices: [],
      actualTotalDuration: 0,
    }
  }

  const keepCount = Math.min(
    durations.length,
    Math.max(1, Math.floor(normalizedTarget / GIF_RELIABLE_MIN_DELAY_MS)),
  )
  const groups = buildEvenGroups(durations.length, keepCount)
  const weights = groups.map((group) =>
    group.reduce((sum, index) => sum + Math.max(0, durations[index] ?? 0), 0),
  )
  const groupDurations = allocateGroupDurations(normalizedTarget, weights)

  return {
    frames: groups.map((group, index) => ({
      index: group[0],
      duration: groupDurations[index],
    })),
    droppedIndices: groups.flatMap((group) => group.slice(1)),
    actualTotalDuration: groupDurations.reduce((sum, duration) => sum + duration, 0),
  }
}
