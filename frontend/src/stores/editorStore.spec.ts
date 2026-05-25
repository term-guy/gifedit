import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from './editorStore'

describe('editorStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('setTool', () => {
    it('opens the sticker picker and closes the text panel when switching to sticker', () => {
      const store = useEditorStore()
      store.setTool('text')
      store.setTool('sticker')
      expect(store.showStickerPicker).toBe(true)
      expect(store.showTextPanel).toBe(false)
    })

    it('opens the text panel and closes the sticker picker when switching to text', () => {
      const store = useEditorStore()
      store.setTool('sticker')
      store.setTool('text')
      expect(store.showTextPanel).toBe(true)
      expect(store.showStickerPicker).toBe(false)
    })

    it('closes both panels when switching to a non-UI tool', () => {
      const store = useEditorStore()
      store.setTool('sticker')
      store.setTool('draw')
      expect(store.showStickerPicker).toBe(false)
      expect(store.showTextPanel).toBe(false)
    })
  })

  describe('setZoom', () => {
    it('clamps to minimum 0.1', () => {
      const store = useEditorStore()
      store.setZoom(0.001)
      expect(store.zoom).toBe(0.1)
    })

    it('clamps to maximum 8', () => {
      const store = useEditorStore()
      store.setZoom(100)
      expect(store.zoom).toBe(8)
    })

    it('preserves a value within range unchanged', () => {
      const store = useEditorStore()
      store.setZoom(2.5)
      expect(store.zoom).toBe(2.5)
    })
  })

  describe('toggleFrameSelection', () => {
    it('adds a frame id when not already selected', () => {
      const store = useEditorStore()
      store.toggleFrameSelection('f1')
      expect(store.selectedFrameIds).toContain('f1')
    })

    it('removes a frame id when it is already selected', () => {
      const store = useEditorStore()
      store.toggleFrameSelection('f1')
      store.toggleFrameSelection('f1')
      expect(store.selectedFrameIds).not.toContain('f1')
    })

    it('updates the anchor to the most recently toggled frame', () => {
      const store = useEditorStore()
      store.toggleFrameSelection('f1')
      store.toggleFrameSelection('f2')
      expect(store.frameSelectionAnchorId).toBe('f2')
    })
  })

  describe('setFrameSelection', () => {
    it('defaults the anchor to the last id in the list when not provided', () => {
      const store = useEditorStore()
      store.setFrameSelection(['f1', 'f2', 'f3'])
      expect(store.frameSelectionAnchorId).toBe('f3')
    })

    it('uses the explicitly provided anchorId over the default', () => {
      const store = useEditorStore()
      store.setFrameSelection(['f1', 'f2', 'f3'], 'f1')
      expect(store.frameSelectionAnchorId).toBe('f1')
    })

    it('clears anchorId when the selection is emptied', () => {
      const store = useEditorStore()
      store.setFrameSelection(['f1'])
      store.setFrameSelection([])
      expect(store.frameSelectionAnchorId).toBeNull()
    })
  })
})
