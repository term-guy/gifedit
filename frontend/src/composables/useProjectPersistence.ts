import { ref, watch } from 'vue'
import { useGifStore } from '@/stores/gifStore'
import { useHistoryStore } from '@/stores/historyStore'
import type { TextAnimation } from '@/types'

const DB_NAME = 'gif_editor_db'
const DB_VERSION = 1
const STORE_NAME = 'sessions'
const SESSION_KEY = 'current'
const VERSION = 1

// Module-level so AppTopBar can read them without prop-drilling
export const restoring = ref(false)
export const restoreProgress = ref(0)
export const restoreTotal = ref(0)
export const saving = ref(false)

interface PersistedFrame {
  id: string
  dataUrl: string
  thumbnailUrl: string
  duration: number
  canvasJson: string
}

interface PersistedState {
  version: number
  filename: string
  width: number
  height: number
  repeat: number
  activeFrameId: string | null
  frames: PersistedFrame[]
  textAnimations: TextAnimation[]
  globalCanvasJson?: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db: IDBDatabase, value: PersistedState): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, SESSION_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function idbGet(db: IDBDatabase): Promise<PersistedState | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(SESSION_KEY)
    req.onsuccess = () => resolve(req.result as PersistedState | undefined)
    req.onerror = () => reject(req.error)
  })
}

function dataUrlToImageData(dataUrl: string, width: number, height: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('no 2d context')); return }
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, width, height))
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
}

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export function useProjectPersistence() {
  const gifStore = useGifStore()
  const historyStore = useHistoryStore()

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let db: IDBDatabase | null = null

  async function getDB(): Promise<IDBDatabase> {
    if (!db) db = await openDB()
    return db
  }

  async function saveNow(): Promise<void> {
    if (!gifStore.project) return
    const state: PersistedState = {
      version: VERSION,
      filename: gifStore.project.filename,
      width: gifStore.project.width,
      height: gifStore.project.height,
      repeat: gifStore.project.repeat,
      activeFrameId: gifStore.project.activeFrameId,
      frames: gifStore.frames.map((f) => ({
        id: f.id,
        dataUrl: f.dataUrl,
        thumbnailUrl: f.thumbnailUrl,
        duration: f.duration,
        canvasJson: f.canvasJson,
      })),
      textAnimations: gifStore.textAnimations.map((a) => ({ ...a })),
      globalCanvasJson: gifStore.project.globalCanvasJson,
    }
    saving.value = true
    try {
      await idbPut(await getDB(), state)
    } catch (err) {
      console.warn('[persistence] IndexedDB write failed', err)
    } finally {
      saving.value = false
    }
  }

  function scheduleSave() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => { void saveNow() }, 800)
  }

  async function restore(): Promise<boolean> {
    restoring.value = true
    restoreProgress.value = 0
    restoreTotal.value = 0

    try {
      const state = await idbGet(await getDB())
      if (!state || state.version !== VERSION || !state.frames?.length) return false

      restoreTotal.value = state.frames.length

      historyStore.clear()
      gifStore.reset()
      gifStore.initProject(state.filename, state.width, state.height, null, state.repeat ?? -1)

      for (const [index, pf] of state.frames.entries()) {
        const imageData = await dataUrlToImageData(pf.dataUrl, state.width, state.height)
        gifStore.addFrame({
          id: pf.id,
          imageData,
          dataUrl: pf.dataUrl,
          thumbnailUrl: pf.thumbnailUrl,
          duration: pf.duration,
          canvasJson: pf.canvasJson,
        })
        restoreProgress.value++

        // Let Vue/Konva paint the first visible frame immediately, then keep
        // chunking restore work so large sessions don't appear stalled.
        if (index === 0 || index % 8 === 0) {
          await waitForNextPaint()
        }
      }

      if (state.activeFrameId) gifStore.setActiveFrame(state.activeFrameId)
      if (state.globalCanvasJson) gifStore.updateGlobalCanvasJson(state.globalCanvasJson)
      for (const anim of state.textAnimations) gifStore.addTextAnimation(anim)

      return true
    } catch (err) {
      console.warn('[persistence] restore failed', err)
      return false
    } finally {
      restoring.value = false
    }
  }

  async function clear(): Promise<void> {
    try {
      const database = await getDB()
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).delete(SESSION_KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('[persistence] clear failed', err)
    }
  }

  function startWatching() {
    watch(
      [() => gifStore.project, () => gifStore.textAnimations],
      () => { if (gifStore.project) scheduleSave() },
      { deep: true },
    )
  }

  return { restore, saveNow, startWatching, clear }
}
