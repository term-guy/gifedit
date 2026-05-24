import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GifProject, GifFrame, TextAnimation } from '@/types'

const MAX_HISTORY = 50

export interface FrameSnapshot {
  id: string
  imageData: ImageData
  dataUrl: string
  thumbnailUrl: string
  duration: number
  canvasJson: string
}

export interface HistorySnapshot {
  frames: FrameSnapshot[]
  activeFrameId: string | null
  textAnimations: TextAnimation[]
  globalCanvasJson: string
}

function cloneFrame(frame: GifFrame): FrameSnapshot {
  return {
    id: frame.id,
    imageData: new ImageData(
      new Uint8ClampedArray(frame.imageData.data),
      frame.imageData.width,
      frame.imageData.height,
    ),
    dataUrl: frame.dataUrl,
    thumbnailUrl: frame.thumbnailUrl,
    duration: frame.duration,
    canvasJson: frame.canvasJson,
  }
}

function cloneSnapshot(project: GifProject, textAnimations: TextAnimation[]): HistorySnapshot {
  return {
    frames: project.frames.map(cloneFrame),
    activeFrameId: project.activeFrameId,
    textAnimations: textAnimations.map((a) => ({ ...a })),
    globalCanvasJson: project.globalCanvasJson ?? '',
  }
}

function cap(stack: HistorySnapshot[]) {
  if (stack.length > MAX_HISTORY) stack.shift()
}

export const useHistoryStore = defineStore('history', () => {
  const past = ref<HistorySnapshot[]>([])
  const future = ref<HistorySnapshot[]>([])

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function pushSnapshot(project: GifProject, textAnimations: TextAnimation[]) {
    past.value.push(cloneSnapshot(project, textAnimations))
    cap(past.value)
    future.value = []
  }

  function undo(project: GifProject, textAnimations: TextAnimation[]): HistorySnapshot | null {
    if (!past.value.length) return null
    future.value.push(cloneSnapshot(project, textAnimations))
    cap(future.value)
    return past.value.pop()!
  }

  function redo(project: GifProject, textAnimations: TextAnimation[]): HistorySnapshot | null {
    if (!future.value.length) return null
    past.value.push(cloneSnapshot(project, textAnimations))
    cap(past.value)
    return future.value.pop()!
  }

  function clear() {
    past.value = []
    future.value = []
  }

  return { canUndo, canRedo, pushSnapshot, undo, redo, clear }
})
