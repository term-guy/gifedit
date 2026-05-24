import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { nanoid } from 'nanoid'
import { imageDataToDataUrl, imageDataToThumbnail } from '@/utils/imageData'
import type { GifFrame } from '@/types'
import { retimeGifSelection } from '@/utils/gifTiming'

export function useFrameOps() {
  const gifStore = useGifStore()
  const editorStore = useEditorStore()
  const historyStore = useHistoryStore()

  function snapshot() {
    if (gifStore.project) historyStore.pushSnapshot(gifStore.project, gifStore.textAnimations)
  }

  function addBlankFrame() {
    const { project } = gifStore
    if (!project) return
    snapshot()
    const { width, height } = project
    const imageData = new ImageData(width, height)
    const frame: GifFrame = {
      id: nanoid(),
      imageData,
      dataUrl: imageDataToDataUrl(imageData),
      thumbnailUrl: imageDataToThumbnail(imageData),
      duration: 100,
      canvasJson: '',
    }
    gifStore.addFrame(frame)
  }

  function duplicateSelected() {
    snapshot()
    for (const id of editorStore.selectedFrameIds) {
      gifStore.duplicateFrame(id)
    }
    editorStore.clearFrameSelection()
  }

  function deleteSelected() {
    snapshot()
    const ids = [...editorStore.selectedFrameIds]
    for (const id of ids) {
      if (gifStore.frames.length <= 1) break
      gifStore.deleteFrame(id)
    }
    editorStore.clearFrameSelection()
  }

  function setBulkDuration(ms: number) {
    snapshot()
    for (const id of editorStore.selectedFrameIds) {
      gifStore.updateFrameDuration(id, ms)
    }
  }

  function reorderFrames(newOrder: GifFrame[]) {
    snapshot()
    gifStore.reorderFrames(newOrder)
  }

  function deduplicateFrames(): number {
    snapshot()
    return gifStore.deduplicateConsecutiveFrames()
  }

  function retimeSelectedFrames(targetTotalDuration: number) {
    const project = gifStore.project
    if (!project) return { removed: 0, totalDuration: 0, keptCount: 0 }
    const selectedIds = new Set(editorStore.selectedFrameIds)

    const selectedEntries = project.frames
      .map((frame) => ({ frame }))
      .filter(({ frame }) => selectedIds.has(frame.id))

    if (selectedEntries.length === 0) return { removed: 0, totalDuration: 0, keptCount: 0 }

    snapshot()

    const retimed = retimeGifSelection(
      selectedEntries.map(({ frame }) => frame.duration),
      targetTotalDuration,
    )
    const keptByRelativeIndex = new Map(
      retimed.frames.map((entry) => [entry.index, entry.duration]),
    )
    const keptIds: string[] = []
    const newFrames: GifFrame[] = []
    let selectedRelativeIndex = 0

    for (const frame of project.frames) {
      if (!selectedIds.has(frame.id)) {
        newFrames.push(frame)
        continue
      }

      const nextDuration = keptByRelativeIndex.get(selectedRelativeIndex)
      if (nextDuration !== undefined) {
        frame.duration = nextDuration
        keptIds.push(frame.id)
        newFrames.push(frame)
      }

      selectedRelativeIndex += 1
    }

    project.frames = newFrames
    editorStore.setFrameSelection(keptIds, keptIds[0] ?? null)

    if (!newFrames.some((frame) => frame.id === project.activeFrameId)) {
      project.activeFrameId = keptIds[0] ?? newFrames[0]?.id ?? null
    }

    return {
      removed: selectedEntries.length - keptIds.length,
      totalDuration: retimed.actualTotalDuration,
      keptCount: keptIds.length,
    }
  }

  return {
    addBlankFrame,
    duplicateSelected,
    deleteSelected,
    setBulkDuration,
    reorderFrames,
    deduplicateFrames,
    retimeSelectedFrames,
  }
}
