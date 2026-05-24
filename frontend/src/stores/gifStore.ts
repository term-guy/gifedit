import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import type { GifFrame, GifProject } from '@/types'
import type { HistorySnapshot } from '@/stores/historyStore'
import { normalizeGifDelayMs } from '@/utils/gifTiming'

export const useGifStore = defineStore('gif', () => {
  const project = ref<GifProject | null>(null)
  const textAnimations = ref<import('@/types').TextAnimation[]>([])

  const frames = computed(() => project.value?.frames ?? [])
  const activeFrame = computed(() =>
    frames.value.find((f) => f.id === project.value?.activeFrameId) ?? null,
  )
  const activeFrameIndex = computed(() =>
    frames.value.findIndex((f) => f.id === project.value?.activeFrameId),
  )

  function initProject(
    filename: string,
    width: number,
    height: number,
    sourceFile: File | null = null,
    repeat = -1,
  ) {
    project.value = {
      filename,
      width,
      height,
      repeat,
      frames: [],
      activeFrameId: null,
      globalCanvasJson: '',
      sourceFile,
    }
    textAnimations.value = []
  }

  function addFrame(frame: GifFrame) {
    if (!project.value) return
    project.value.frames.push({
      ...frame,
      duration: normalizeGifDelayMs(frame.duration),
    })
    if (!project.value.activeFrameId) {
      project.value.activeFrameId = frame.id
    }
  }

  function setActiveFrame(id: string) {
    if (!project.value) return
    project.value.activeFrameId = id
  }

  function duplicateFrame(id: string) {
    if (!project.value) return
    const idx = project.value.frames.findIndex((f) => f.id === id)
    if (idx === -1) return
    const src = project.value.frames[idx]
    const clone: GifFrame = {
      ...src,
      id: nanoid(),
      imageData: new ImageData(
        new Uint8ClampedArray(src.imageData.data),
        src.imageData.width,
        src.imageData.height,
      ),
    }
    project.value.frames.splice(idx + 1, 0, clone)
  }

  function deleteFrame(id: string) {
    if (!project.value) return
    const idx = project.value.frames.findIndex((f) => f.id === id)
    if (idx === -1) return
    project.value.frames.splice(idx, 1)
    if (project.value.activeFrameId === id) {
      const newActive = project.value.frames[Math.min(idx, project.value.frames.length - 1)]
      project.value.activeFrameId = newActive?.id ?? null
    }
  }

  function updateFrameDuration(id: string, duration: number) {
    const frame = frames.value.find((f) => f.id === id)
    if (frame) {
      frame.duration = normalizeGifDelayMs(duration)
    }
  }

  function updateFrameCanvasJson(id: string, json: string) {
    const frame = frames.value.find((f) => f.id === id)
    if (frame) {
      frame.canvasJson = json
    }
  }

  function updateFrameDataUrl(id: string, dataUrl: string) {
    const frame = frames.value.find((f) => f.id === id)
    if (frame) {
      frame.dataUrl = dataUrl
    }
  }

  function updateFrameImageData(id: string, imageData: ImageData) {
    const frame = frames.value.find((f) => f.id === id)
    if (frame) {
      frame.imageData = imageData
    }
  }

  function updateGlobalCanvasJson(json: string) {
    if (project.value) {
      project.value.globalCanvasJson = json
    }
  }

  function updateRepeat(repeat: number) {
    if (project.value) {
      project.value.repeat = repeat
    }
  }

  function reorderFrames(newOrder: GifFrame[]) {
    if (!project.value) return
    project.value.frames = newOrder
  }

  function addTextAnimation(anim: import('@/types').TextAnimation) {
    textAnimations.value.push(anim)
  }

  function updateTextAnimation(id: string, anim: Partial<import('@/types').TextAnimation>) {
    const idx = textAnimations.value.findIndex((a) => a.id === id)
    if (idx !== -1) {
      Object.assign(textAnimations.value[idx], anim)
    }
  }

  function deleteTextAnimation(id: string) {
    const idx = textAnimations.value.findIndex((a) => a.id === id)
    if (idx !== -1) {
      textAnimations.value.splice(idx, 1)
    }
  }

  function restoreSnapshot(snapshot: HistorySnapshot) {
    if (!project.value) return
    project.value.frames = snapshot.frames.map((s) => ({
      id: s.id,
      imageData: new ImageData(
        new Uint8ClampedArray(s.imageData.data),
        s.imageData.width,
        s.imageData.height,
      ),
      dataUrl: s.dataUrl,
      thumbnailUrl: s.thumbnailUrl,
      duration: normalizeGifDelayMs(s.duration),
      canvasJson: s.canvasJson,
    }))
    project.value.activeFrameId = snapshot.activeFrameId
    project.value.globalCanvasJson = snapshot.globalCanvasJson ?? ''
    project.value.sourceFile = null
    textAnimations.value = snapshot.textAnimations.map((a) => ({ ...a }))
  }

  function framesPixelEqual(a: ImageData, b: ImageData): boolean {
    if (a.width !== b.width || a.height !== b.height) return false
    const da = a.data
    const db = b.data
    for (let i = 0; i < da.length; i++) {
      if (da[i] !== db[i]) return false
    }
    return true
  }

  function deduplicateConsecutiveFrames(): number {
    if (!project.value || project.value.frames.length < 2) return 0
    const input = project.value.frames
    const output: GifFrame[] = [{ ...input[0], duration: input[0].duration }]
    let removed = 0

    for (let i = 1; i < input.length; i++) {
      const curr = input[i]
      const prev = output[output.length - 1]
      if (curr.canvasJson === prev.canvasJson && framesPixelEqual(prev.imageData, curr.imageData)) {
        prev.duration += curr.duration
        removed++
      } else {
        output.push({ ...curr })
      }
    }

    if (removed > 0) {
      project.value.frames = output
      if (!output.some((f) => f.id === project.value!.activeFrameId)) {
        project.value.activeFrameId = output[0]?.id ?? null
      }
    }
    return removed
  }

  function reset() {
    project.value = null
    textAnimations.value = []
  }

  return {
    project,
    textAnimations,
    frames,
    activeFrame,
    activeFrameIndex,
    initProject,
    addFrame,
    setActiveFrame,
    duplicateFrame,
    deleteFrame,
    updateFrameDuration,
    updateFrameCanvasJson,
    updateFrameDataUrl,
    updateFrameImageData,
    updateGlobalCanvasJson,
    updateRepeat,
    reorderFrames,
    addTextAnimation,
    updateTextAnimation,
    deleteTextAnimation,
    restoreSnapshot,
    deduplicateConsecutiveFrames,
    reset,
  }
})
