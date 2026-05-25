import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGifStore } from './gifStore'
import type { GifFrame } from '@/types'
import { GIF_RELIABLE_MIN_DELAY_MS } from '@/utils/gifTiming'

function makeFrame(overrides: Partial<GifFrame> = {}): GifFrame {
  const data = new Uint8ClampedArray(4 * 4 * 4)
  return {
    id: 'frame-' + Math.random().toString(36).slice(2),
    imageData: new ImageData(data, 4, 4),
    dataUrl: '',
    thumbnailUrl: '',
    duration: 100,
    canvasJson: '',
    ...overrides,
  }
}

function solidFrame(id: string, r: number, duration = 100, canvasJson = ''): GifFrame {
  const data = new Uint8ClampedArray(4 * 4 * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 3] = 255
  }
  return { id, imageData: new ImageData(data, 4, 4), dataUrl: '', thumbnailUrl: '', duration, canvasJson }
}

describe('gifStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('addFrame', () => {
    it('sets activeFrameId to the first frame added', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      expect(store.project!.activeFrameId).toBe('f1')
    })

    it('does not change activeFrameId when a second frame is added', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      store.addFrame(makeFrame({ id: 'f2' }))
      expect(store.project!.activeFrameId).toBe('f1')
    })

    it('normalizes a below-minimum duration to GIF_RELIABLE_MIN_DELAY_MS', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1', duration: 10 }))
      expect(store.frames[0].duration).toBe(GIF_RELIABLE_MIN_DELAY_MS)
    })
  })

  describe('deleteFrame', () => {
    it('removes the frame from the frames array', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      store.addFrame(makeFrame({ id: 'f2' }))
      store.deleteFrame('f2')
      expect(store.frames.map((f) => f.id)).toEqual(['f1'])
    })

    it('moves activeFrameId to the next frame when the active frame is deleted', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      store.addFrame(makeFrame({ id: 'f2' }))
      store.addFrame(makeFrame({ id: 'f3' }))
      store.setActiveFrame('f1')
      store.deleteFrame('f1')
      expect(store.project!.activeFrameId).toBe('f2')
    })

    it('moves activeFrameId to the previous frame when the last frame is deleted', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      store.addFrame(makeFrame({ id: 'f2' }))
      store.addFrame(makeFrame({ id: 'f3' }))
      store.setActiveFrame('f3')
      store.deleteFrame('f3')
      expect(store.project!.activeFrameId).toBe('f2')
    })

    it('does not change activeFrameId when a non-active frame is deleted', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      store.addFrame(makeFrame({ id: 'f2' }))
      store.setActiveFrame('f1')
      store.deleteFrame('f2')
      expect(store.project!.activeFrameId).toBe('f1')
    })
  })

  describe('duplicateFrame', () => {
    it('inserts the clone immediately after the source frame', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      store.addFrame(makeFrame({ id: 'f2' }))
      store.duplicateFrame('f1')
      expect(store.frames[0].id).toBe('f1')
      expect(store.frames[2].id).toBe('f2')
      expect(store.frames.length).toBe(3)
    })

    it('gives the duplicate a different ID from the source', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      store.duplicateFrame('f1')
      expect(store.frames[1].id).not.toBe('f1')
    })

    it('deep-copies imageData so mutations to the original do not affect the clone', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(makeFrame({ id: 'f1' }))
      store.duplicateFrame('f1')
      store.frames[0].imageData.data[0] = 99
      expect(store.frames[1].imageData.data[0]).toBe(0)
    })
  })

  describe('deduplicateConsecutiveFrames', () => {
    it('merges pixel-identical consecutive frames and sums their durations', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(solidFrame('f1', 255, 100))
      store.addFrame(solidFrame('f2', 255, 80))  // identical pixels to f1
      store.addFrame(solidFrame('f3', 0, 100))   // different color
      const removed = store.deduplicateConsecutiveFrames()
      expect(removed).toBe(1)
      expect(store.frames.length).toBe(2)
      expect(store.frames[0].duration).toBe(180)
    })

    it('does not merge frames that differ only in canvasJson', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(solidFrame('f1', 255, 100, 'overlay-a'))
      store.addFrame(solidFrame('f2', 255, 100, 'overlay-b'))
      const removed = store.deduplicateConsecutiveFrames()
      expect(removed).toBe(0)
      expect(store.frames.length).toBe(2)
    })

    it('does not merge non-consecutive identical frames', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(solidFrame('f1', 255, 100))
      store.addFrame(solidFrame('f2', 0, 100))   // different — breaks the run
      store.addFrame(solidFrame('f3', 255, 100)) // same as f1 but not consecutive
      const removed = store.deduplicateConsecutiveFrames()
      expect(removed).toBe(0)
      expect(store.frames.length).toBe(3)
    })

    it('resets activeFrameId to the surviving frame when the active frame is merged away', () => {
      const store = useGifStore()
      store.initProject('test.gif', 4, 4)
      store.addFrame(solidFrame('f1', 255, 100))
      store.addFrame(solidFrame('f2', 255, 100)) // will be absorbed into f1
      store.setActiveFrame('f2')
      store.deduplicateConsecutiveFrames()
      expect(store.project!.activeFrameId).toBe('f1')
    })
  })
})
