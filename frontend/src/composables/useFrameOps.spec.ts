/**
 * High-level tests that exercise user-facing operations as they flow through
 * the full store layer. Each describe block maps to something a user does in
 * the UI; each test describes an observable outcome.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useFrameOps } from './useFrameOps'
import type { GifFrame } from '@/types'

// Stub canvas utilities — we're testing frame management, not pixel rendering
vi.mock('@/utils/imageData', () => ({
  imageDataToDataUrl: () => 'data:stub',
  imageDataToThumbnail: () => 'data:stub',
}))

function makeImageData(r = 0): ImageData {
  const data = new Uint8ClampedArray(4 * 4 * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 3] = 255
  }
  return new ImageData(data, 4, 4)
}

function makeFrame(overrides: Partial<GifFrame> = {}): GifFrame {
  return {
    id: 'f-' + Math.random().toString(36).slice(2),
    imageData: makeImageData(),
    dataUrl: 'data:stub',
    thumbnailUrl: 'data:stub',
    duration: 100,
    canvasJson: '',
    ...overrides,
  }
}

describe('user workflows', () => {
  let gifStore: ReturnType<typeof useGifStore>
  let editorStore: ReturnType<typeof useEditorStore>
  let historyStore: ReturnType<typeof useHistoryStore>
  let ops: ReturnType<typeof useFrameOps>

  beforeEach(() => {
    setActivePinia(createPinia())
    gifStore = useGifStore()
    editorStore = useEditorStore()
    historyStore = useHistoryStore()
    ops = useFrameOps()
    gifStore.initProject('animation.gif', 4, 4)
  })

  describe('adding a blank frame', () => {
    it('appears in the frame list with project dimensions', () => {
      ops.addBlankFrame()
      expect(gifStore.frames.length).toBe(1)
      expect(gifStore.frames[0].imageData.width).toBe(4)
      expect(gifStore.frames[0].imageData.height).toBe(4)
    })

    it('becomes the active frame when the project was empty', () => {
      ops.addBlankFrame()
      expect(gifStore.activeFrame).not.toBeNull()
      expect(gifStore.project!.activeFrameId).toBe(gifStore.frames[0].id)
    })

    it('takes a snapshot so the action can be undone', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      ops.addBlankFrame()
      expect(historyStore.canUndo).toBe(true)
    })
  })

  describe('duplicating selected frames', () => {
    it('inserts a clone immediately after each selected frame', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      gifStore.addFrame(makeFrame({ id: 'f2' }))
      editorStore.setFrameSelection(['f1'])
      ops.duplicateSelected()
      const ids = gifStore.frames.map((f) => f.id)
      expect(ids[0]).toBe('f1')
      expect(ids[2]).toBe('f2')
      expect(gifStore.frames.length).toBe(3)
    })

    it('produces an independent copy — mutating the original does not affect the duplicate', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      editorStore.setFrameSelection(['f1'])
      ops.duplicateSelected()
      gifStore.frames[0].imageData.data[0] = 99
      expect(gifStore.frames[1].imageData.data[0]).toBe(0)
    })

    it('clears the frame selection after duplicating', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      editorStore.setFrameSelection(['f1'])
      ops.duplicateSelected()
      expect(editorStore.selectedFrameIds).toEqual([])
    })

    it('takes a snapshot so the action can be undone', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      editorStore.setFrameSelection(['f1'])
      ops.duplicateSelected()
      expect(historyStore.canUndo).toBe(true)
    })
  })

  describe('deleting selected frames', () => {
    it('removes the selected frame from the timeline', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      gifStore.addFrame(makeFrame({ id: 'f2' }))
      gifStore.addFrame(makeFrame({ id: 'f3' }))
      editorStore.setFrameSelection(['f2'])
      ops.deleteSelected()
      expect(gifStore.frames.map((f) => f.id)).toEqual(['f1', 'f3'])
    })

    it('cannot delete the last remaining frame', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      editorStore.setFrameSelection(['f1'])
      ops.deleteSelected()
      expect(gifStore.frames.length).toBe(1)
    })

    it('stops deleting once only one frame is left when multiple are selected', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      gifStore.addFrame(makeFrame({ id: 'f2' }))
      editorStore.setFrameSelection(['f1', 'f2'])
      ops.deleteSelected()
      expect(gifStore.frames.length).toBe(1)
    })

    it('clears the frame selection after deleting', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      gifStore.addFrame(makeFrame({ id: 'f2' }))
      editorStore.setFrameSelection(['f1'])
      ops.deleteSelected()
      expect(editorStore.selectedFrameIds).toEqual([])
    })
  })

  describe('setting bulk frame duration', () => {
    it('updates the delay for all selected frames', () => {
      gifStore.addFrame(makeFrame({ id: 'f1', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f2', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f3', duration: 100 }))
      editorStore.setFrameSelection(['f1', 'f3'])
      ops.setBulkDuration(500)
      expect(gifStore.frames[0].duration).toBe(500)
      expect(gifStore.frames[2].duration).toBe(500)
    })

    it('leaves unselected frames untouched', () => {
      gifStore.addFrame(makeFrame({ id: 'f1', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f2', duration: 100 }))
      editorStore.setFrameSelection(['f1'])
      ops.setBulkDuration(500)
      expect(gifStore.frames[1].duration).toBe(100)
    })
  })

  describe('retiming selected frames', () => {
    it('redistributes durations to hit the target total without dropping frames', () => {
      gifStore.addFrame(makeFrame({ id: 'f1', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f2', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f3', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f4', duration: 100 }))
      editorStore.setFrameSelection(['f1', 'f2', 'f3', 'f4'], 'f1')
      const result = ops.retimeSelectedFrames(200)
      expect(result.totalDuration).toBe(200)
      expect(result.removed).toBe(0)
      expect(gifStore.frames.every((f) => f.duration === 50)).toBe(true)
    })

    it('drops frames and reports how many were removed when the target duration is very short', () => {
      gifStore.addFrame(makeFrame({ id: 'f1', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f2', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f3', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f4', duration: 100 }))
      editorStore.setFrameSelection(['f1', 'f2', 'f3', 'f4'], 'f1')
      const result = ops.retimeSelectedFrames(40)
      expect(result.removed).toBe(2)
      expect(result.keptCount).toBe(2)
      expect(gifStore.frames.length).toBe(2)
    })

    it('leaves frames outside the selection untouched', () => {
      gifStore.addFrame(makeFrame({ id: 'f1', duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f2', duration: 100 })) // not selected
      gifStore.addFrame(makeFrame({ id: 'f3', duration: 100 }))
      editorStore.setFrameSelection(['f1', 'f3'], 'f1')
      ops.retimeSelectedFrames(200)
      expect(gifStore.frames.find((f) => f.id === 'f2')?.duration).toBe(100)
    })
  })

  describe('deduplicating consecutive identical frames', () => {
    it('collapses runs of identical frames and accumulates their duration', () => {
      const red = makeImageData(255)
      gifStore.addFrame(makeFrame({ id: 'f1', imageData: red, duration: 100 }))
      gifStore.addFrame(makeFrame({ id: 'f2', imageData: red, duration: 80 }))
      gifStore.addFrame(makeFrame({ id: 'f3', imageData: makeImageData(0), duration: 100 }))
      const removed = ops.deduplicateFrames()
      expect(removed).toBe(1)
      expect(gifStore.frames.length).toBe(2)
      expect(gifStore.frames[0].duration).toBe(180)
    })

    it('takes a snapshot so the action can be undone', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      ops.deduplicateFrames()
      expect(historyStore.canUndo).toBe(true)
    })
  })

  describe('undo / redo', () => {
    it('restores the frame list to the state it was in before the last edit', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      gifStore.addFrame(makeFrame({ id: 'f2' }))
      editorStore.setFrameSelection(['f2'])
      ops.deleteSelected()
      expect(gifStore.frames.length).toBe(1)

      const snapshot = historyStore.undo(gifStore.project!, gifStore.textAnimations)!
      gifStore.restoreSnapshot(snapshot)
      expect(gifStore.frames.length).toBe(2)
      expect(gifStore.frames.map((f) => f.id)).toEqual(['f1', 'f2'])
    })

    it('redo re-applies the edit after an undo', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      gifStore.addFrame(makeFrame({ id: 'f2' }))
      editorStore.setFrameSelection(['f2'])
      ops.deleteSelected()

      const undo = historyStore.undo(gifStore.project!, gifStore.textAnimations)!
      gifStore.restoreSnapshot(undo)
      expect(gifStore.frames.length).toBe(2)

      const redo = historyStore.redo(gifStore.project!, gifStore.textAnimations)!
      gifStore.restoreSnapshot(redo)
      expect(gifStore.frames.length).toBe(1)
    })

    it('undo restores the correct imageData, not just frame count', () => {
      const redData = makeImageData(255)
      gifStore.addFrame(makeFrame({ id: 'f1', imageData: redData }))
      historyStore.pushSnapshot(gifStore.project!, gifStore.textAnimations)

      const blueData = makeImageData(0)
      gifStore.updateFrameImageData('f1', blueData)
      expect(gifStore.frames[0].imageData.data[0]).toBe(0)

      const snapshot = historyStore.undo(gifStore.project!, gifStore.textAnimations)!
      gifStore.restoreSnapshot(snapshot)
      expect(gifStore.frames[0].imageData.data[0]).toBe(255)
    })

    it('a new edit after undo clears the redo stack', () => {
      gifStore.addFrame(makeFrame({ id: 'f1' }))
      gifStore.addFrame(makeFrame({ id: 'f2' }))
      editorStore.setFrameSelection(['f2'])
      ops.deleteSelected()

      historyStore.undo(gifStore.project!, gifStore.textAnimations)
      gifStore.restoreSnapshot(historyStore.undo(gifStore.project!, gifStore.textAnimations) ?? { frames: [], activeFrameId: null, textAnimations: [], globalCanvasJson: '' })

      // User makes a new edit — redo should no longer be available
      editorStore.setFrameSelection(['f1'])
      ops.deleteSelected()
      expect(historyStore.canRedo).toBe(false)
    })
  })
})
