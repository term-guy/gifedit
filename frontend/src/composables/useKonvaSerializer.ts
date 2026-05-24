import Konva from 'konva'
import { ks, serializeTimer } from './konvaState'
import { refreshAllFrameThumbnails, updateStageThumbnail } from './useKonvaThumbnails'
import { useGifStore } from '@/stores/gifStore'
import { useHistoryStore } from '@/stores/historyStore'

export function partitionDrawLayerChildren(selectionOutline: Konva.Rect | null): {
  frameChildren: Record<string, unknown>[]
  globalChildren: Record<string, unknown>[]
} {
  const frameChildren: Record<string, unknown>[] = []
  const globalChildren: Record<string, unknown>[] = []
  if (!ks.drawLayer) return { frameChildren, globalChildren }

  const nodes = ks.drawLayer.getChildren().filter(
    (n) => !(n instanceof Konva.Transformer) && n !== selectionOutline,
  )
  for (const n of nodes) {
    const json = n.toJSON()
    const parsed = JSON.parse(json) as Record<string, unknown>
    if (parsed.className === 'Image') {
      const imgEl = (n as Konva.Image).image() as HTMLImageElement | HTMLCanvasElement
      if (imgEl instanceof HTMLImageElement) {
        ;(parsed.attrs as Record<string, unknown>).src = imgEl.src
      }
    }
    if ((n as Konva.Node).getAttr('allFrames')) {
      globalChildren.push(parsed)
    } else {
      frameChildren.push(parsed)
    }
  }
  return { frameChildren, globalChildren }
}

export function serializeDrawLayer(selectionOutline: Konva.Rect | null): string {
  const { frameChildren } = partitionDrawLayerChildren(selectionOutline)
  return JSON.stringify({ children: frameChildren })
}

export function serializeGlobalLayer(selectionOutline: Konva.Rect | null): string {
  const { globalChildren } = partitionDrawLayerChildren(selectionOutline)
  return JSON.stringify({ children: globalChildren })
}

export function flushSerialize(
  gifStore: ReturnType<typeof useGifStore>,
  selectionOutline: Konva.Rect | null,
) {
  if (serializeTimer.value) {
    clearTimeout(serializeTimer.value)
    serializeTimer.value = null
  }
  if (!ks.lastFrameId) return
  const nextGlobalJson = serializeGlobalLayer(selectionOutline)
  const globalChanged = nextGlobalJson !== (gifStore.project?.globalCanvasJson ?? '')
  gifStore.updateFrameCanvasJson(ks.lastFrameId, serializeDrawLayer(selectionOutline))
  gifStore.updateGlobalCanvasJson(nextGlobalJson)
  if (globalChanged) refreshAllFrameThumbnails(gifStore, nextGlobalJson)
  else updateStageThumbnail(gifStore, ks.lastFrameId)
}

export function scheduleSerialize(
  gifStore: ReturnType<typeof useGifStore>,
  selectionOutline: Konva.Rect | null,
) {
  if (serializeTimer.value) clearTimeout(serializeTimer.value)
  serializeTimer.value = setTimeout(() => {
    if (!ks.lastFrameId) return
    const nextGlobalJson = serializeGlobalLayer(selectionOutline)
    const globalChanged = nextGlobalJson !== (gifStore.project?.globalCanvasJson ?? '')
    gifStore.updateFrameCanvasJson(ks.lastFrameId, serializeDrawLayer(selectionOutline))
    gifStore.updateGlobalCanvasJson(nextGlobalJson)
    if (globalChanged) refreshAllFrameThumbnails(gifStore, nextGlobalJson)
    else updateStageThumbnail(gifStore, ks.lastFrameId)
  }, 300)
}

export function pushCanvasSnapshot(
  gifStore: ReturnType<typeof useGifStore>,
  historyStore: ReturnType<typeof useHistoryStore>,
  selectionOutline: Konva.Rect | null,
) {
  flushSerialize(gifStore, selectionOutline)
  if (gifStore.project) historyStore.pushSnapshot(gifStore.project, gifStore.textAnimations)
}
