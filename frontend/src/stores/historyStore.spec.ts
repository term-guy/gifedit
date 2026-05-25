import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHistoryStore } from './historyStore'
import type { GifProject } from '@/types'

function makeProject(overrides: Partial<GifProject> = {}): GifProject {
  return {
    filename: 'test.gif',
    width: 4,
    height: 4,
    repeat: -1,
    frames: [],
    activeFrameId: null,
    globalCanvasJson: '',
    sourceFile: null,
    ...overrides,
  }
}

describe('historyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with canUndo and canRedo both false', () => {
    const store = useHistoryStore()
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(false)
  })

  it('pushSnapshot enables canUndo', () => {
    const store = useHistoryStore()
    store.pushSnapshot(makeProject(), [])
    expect(store.canUndo).toBe(true)
  })

  it('undo returns the previously pushed snapshot', () => {
    const store = useHistoryStore()
    store.pushSnapshot(makeProject({ activeFrameId: 'f1' }), [])
    const snapshot = store.undo(makeProject({ activeFrameId: 'f2' }), [])
    expect(snapshot).not.toBeNull()
    expect(snapshot!.activeFrameId).toBe('f1')
  })

  it('undo enables canRedo and clears canUndo when stack is drained', () => {
    const store = useHistoryStore()
    store.pushSnapshot(makeProject(), [])
    store.undo(makeProject(), [])
    expect(store.canUndo).toBe(false)
    expect(store.canRedo).toBe(true)
  })

  it('redo returns the state that was current at undo time', () => {
    const store = useHistoryStore()
    store.pushSnapshot(makeProject({ activeFrameId: 'f1' }), [])
    store.undo(makeProject({ activeFrameId: 'f2' }), [])
    // redo should restore f2 (what was "current" when we undid)
    const snapshot = store.redo(makeProject({ activeFrameId: 'f1' }), [])
    expect(snapshot!.activeFrameId).toBe('f2')
    expect(store.canRedo).toBe(false)
    expect(store.canUndo).toBe(true)
  })

  it('pushSnapshot clears the redo stack', () => {
    const store = useHistoryStore()
    store.pushSnapshot(makeProject(), [])
    store.undo(makeProject(), [])
    expect(store.canRedo).toBe(true)
    store.pushSnapshot(makeProject(), [])
    expect(store.canRedo).toBe(false)
  })

  it('undo returns null when history is empty', () => {
    const store = useHistoryStore()
    expect(store.undo(makeProject(), [])).toBeNull()
  })

  it('redo returns null when future is empty', () => {
    const store = useHistoryStore()
    expect(store.redo(makeProject(), [])).toBeNull()
  })

  it('caps history at 50 snapshots and drops the oldest', () => {
    const store = useHistoryStore()
    const project = makeProject()
    for (let i = 0; i < 55; i++) {
      store.pushSnapshot(project, [])
    }
    // Drain all 50 retained snapshots
    for (let i = 0; i < 50; i++) {
      store.undo(project, [])
    }
    // Stack exhausted — 51st undo should return null
    expect(store.undo(project, [])).toBeNull()
  })

  it('deep-copies imageData into the snapshot so later mutations do not corrupt history', () => {
    const store = useHistoryStore()
    const data = new Uint8ClampedArray(4 * 4 * 4)
    const imageData = new ImageData(data, 4, 4)
    const project = makeProject({
      frames: [{
        id: 'f1',
        imageData,
        dataUrl: '',
        thumbnailUrl: '',
        duration: 100,
        canvasJson: '',
      }],
    })
    store.pushSnapshot(project, [])
    // Mutate the live imageData after the snapshot was taken
    imageData.data[0] = 99
    const snapshot = store.undo(makeProject(), [])
    expect(snapshot!.frames[0].imageData.data[0]).toBe(0)
  })
})
