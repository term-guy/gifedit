import { watch } from 'vue'
import Konva from 'konva'
import {
  ks,
  hasSelection,
  isSelectionGlobal,
  eyedropPointerPos,
  textPlacementPos,
  selectedNodeKind,
  selectedNodeShapeType,
  selectedNodeFill,
  selectedNodeStroke,
  selectedNodeStrokeColor,
  selectedNodeStrokeWidth,
  selectedNodeCornerRadius,
  selectedNodeFontFamily,
  selectedNodeFontSize,
  selectedNodeBold,
  selectedNodeItalic,
} from './konvaState'
import { flushSerialize, scheduleSerialize } from './useKonvaSerializer'
import { parseSerializedChildren } from './useKonvaThumbnails'
import { useKonvaSelection } from './useKonvaSelection'
import { useKonvaAnimations } from './useKonvaAnimations'
import { useKonvaDrawTools } from './useKonvaDrawTools'
import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'

export function useKonvaEditor() {
  const gifStore = useGifStore()
  const editorStore = useEditorStore()

  const selection = useKonvaSelection()
  const animations = useKonvaAnimations()
  const drawTools = useKonvaDrawTools()

  function flush() { flushSerialize(gifStore, ks.selectionOutline) }
  function schedule() { scheduleSerialize(gifStore, ks.selectionOutline) }

  function init(containerId: string, width: number, height: number) {
    ks.stage = new Konva.Stage({ container: containerId, width, height })

    ks.baseLayer = new Konva.Layer()
    ks.drawLayer = new Konva.Layer()
    ks.animationLayer = new Konva.Layer()
    ks.stage.add(ks.baseLayer)
    ks.stage.add(ks.drawLayer)
    ks.stage.add(ks.animationLayer)

    ks.transformer = new Konva.Transformer({
      rotateEnabled: true,
      borderStroke: '#f5a623',
      borderStrokeWidth: 2,
      borderDash: [],
      anchorFill: '#f5a623',
      anchorStroke: '#0f0f0f',
      anchorStrokeWidth: 1,
      anchorSize: 9,
      anchorCornerRadius: 0,
      rotateAnchorOffset: 24,
    })
    ks.animationLayer.add(ks.transformer)
    ks.selectionOutline = selection.createSelectionOutline()
    ks.animationLayer.add(ks.selectionOutline)

    setupEvents()

    watch(
      () => [editorStore.shapeStroke, editorStore.shapeStrokeColor, editorStore.shapeStrokeWidth] as const,
      ([stroke, color, width]) => {
        if (!ks.selectionTarget || !(ks.selectionTarget instanceof Konva.Rect || ks.selectionTarget instanceof Konva.Circle)) return
        ks.selectionTarget.stroke(stroke ? color : '')
        ks.selectionTarget.strokeWidth(stroke ? (width as number) : 0)
        ks.selectionTarget.getLayer()?.batchDraw()
        schedule()
      },
    )

    watch(
      () => editorStore.shapeCornerRadius,
      (radius) => {
        if (!ks.selectionTarget || !(ks.selectionTarget instanceof Konva.Rect)) return
        if (ks.selectionTarget.getAttr('shapeType') !== 'square') return
        ks.selectionTarget.cornerRadius(radius)
        ks.selectionTarget.getLayer()?.batchDraw()
        schedule()
      },
    )

    watch(
      () => editorStore.activeTool,
      (tool) => { ks.drawLayer?.listening(tool === 'select') },
      { immediate: true },
    )
  }

  function destroy() {
    ks.stage?.destroy()
    ks.stage = null
    ks.baseLayer = null
    ks.drawLayer = null
    ks.animationLayer = null
    ks.transformer = null
    ks.selectionOutline = null
    ks.selectionTarget = null
    ks.currentLine = null
    ks.isDrawing = false
    ks.isDrawingShape = false
    ks.shapeStartPos = null
    ks.currentShapePreview = null
    ks.lastFrameId = null
    hasSelection.value = false
    isSelectionGlobal.value = false
    selection.clearSelectedNodeState()
  }

  function loadFrame(frameId: string, skipFlush = false) {
    if (!ks.stage || !ks.baseLayer || !ks.drawLayer || !ks.animationLayer) return
    if (!skipFlush) flush()
    const frame = gifStore.frames.find((f) => f.id === frameId)
    if (!frame) return

    ks.transformer?.remove()
    ks.baseLayer.destroyChildren()
    ks.drawLayer.destroyChildren()
    ks.animationLayer.destroyChildren()

    if (ks.transformer) {
      ks.transformer.nodes([])
      ks.animationLayer.add(ks.transformer)
    }
    ks.selectionOutline = selection.createSelectionOutline()
    ks.animationLayer.add(ks.selectionOutline)

    const image = document.createElement('canvas')
    image.width = frame.imageData.width
    image.height = frame.imageData.height
    image.getContext('2d')!.putImageData(frame.imageData, 0, 0)

    const konvaImg = new Konva.Image({
      image,
      x: 0,
      y: 0,
      width: frame.imageData.width,
      height: frame.imageData.height,
      listening: false,
    })
    ks.baseLayer.add(konvaImg)
    ks.baseLayer.draw()

    if (frame.canvasJson) {
      try {
        const parsed = JSON.parse(frame.canvasJson)
        if (parsed.children) {
          for (const childConfig of parsed.children) selection.restoreShape(childConfig)
          ks.drawLayer.draw()
        }
      } catch {}
    }

    const globalJson = gifStore.project?.globalCanvasJson
    if (globalJson) {
      try {
        const children = parseSerializedChildren(globalJson)
        for (const childConfig of children) selection.restoreShape(childConfig)
        ks.drawLayer.draw()
      } catch {}
    }

    ks.lastFrameId = frameId
    selection.hideSelectionOutline()
    hasSelection.value = false
    isSelectionGlobal.value = false
    ks.animationLayer.draw()
  }

  function setupEvents() {
    if (!ks.stage) return

    ks.stage.on('mousedown touchstart', (e) => {
      const pendingPick = editorStore.pendingColorPick
      if (pendingPick) {
        editorStore.pendingColorPick = null
        doCanvasPick(pendingPick)
        e.evt.preventDefault()
        return
      }

      const tool = editorStore.activeTool
      if (tool === 'draw' || tool === 'erase') {
        drawTools.startDrawing(e)
      } else if (tool === 'fill') {
        drawTools.doFill(e)
      } else if (tool === 'shape') {
        drawTools.startDrawingShape(e)
      } else if (tool === 'text') {
        if (textPlacementPos.value) {
          // textarea already open — let its blur event commit
        } else {
          const pos = ks.stage?.getPointerPosition()
          if (pos) textPlacementPos.value = { x: pos.x, y: pos.y }
          e.evt.preventDefault()
        }
      } else {
        if (e.target === ks.stage || e.target?.getLayer() === ks.baseLayer) {
          selection.hideSelectionOutline()
          hasSelection.value = false
          ks.drawLayer?.draw()
          ks.animationLayer?.draw()
        }
      }
    })

    ks.stage.on('mousemove touchmove', () => {
      if (ks.isDrawing && (editorStore.activeTool === 'draw' || editorStore.activeTool === 'erase')) {
        drawTools.continueDrawing()
      }
      if (ks.isDrawingShape) drawTools.continueDrawingShape()
      if (editorStore.pendingColorPick) {
        const pos = ks.stage?.getPointerPosition()
        eyedropPointerPos.value = pos ?? null
      }
    })

    ks.stage.on('mouseleave', () => { eyedropPointerPos.value = null })

    ks.stage.on('mouseup touchend', () => {
      drawTools.finishDrawing()
      if (ks.isDrawingShape) drawTools.finishDrawingShape()
    })
  }

  function sampleColor(x: number, y: number): string {
    if (!ks.baseLayer || !ks.drawLayer || !ks.stage) return '#000000'
    const offscreen = document.createElement('canvas')
    offscreen.width = ks.stage.width()
    offscreen.height = ks.stage.height()
    const ctx = offscreen.getContext('2d')!
    const w = ks.stage.width()
    const h = ks.stage.height()
    ctx.drawImage((ks.baseLayer.getCanvas() as unknown as { _canvas: HTMLCanvasElement })._canvas, 0, 0, w, h)
    ctx.drawImage((ks.drawLayer.getCanvas() as unknown as { _canvas: HTMLCanvasElement })._canvas, 0, 0, w, h)
    const [r, g, b] = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '00')}`
  }

  function getCompositedCanvas(): HTMLCanvasElement | null {
    if (!ks.baseLayer || !ks.drawLayer || !ks.stage) return null
    const offscreen = document.createElement('canvas')
    offscreen.width = ks.stage.width()
    offscreen.height = ks.stage.height()
    const ctx = offscreen.getContext('2d')!
    const w = ks.stage.width()
    const h = ks.stage.height()
    ctx.drawImage((ks.baseLayer.getCanvas() as unknown as { _canvas: HTMLCanvasElement })._canvas, 0, 0, w, h)
    ctx.drawImage((ks.drawLayer.getCanvas() as unknown as { _canvas: HTMLCanvasElement })._canvas, 0, 0, w, h)
    return offscreen
  }

  function doCanvasPick(cb: (color: string) => void) {
    if (!ks.stage) return
    const pos = ks.stage.getPointerPosition()
    if (!pos) return
    cb(sampleColor(pos.x, pos.y))
  }

  function deleteSelected() {
    if (!ks.transformer) return
    if (animations.isSelectedAnimationNode()) {
      const animId = ks.selectionTarget?.getAttr('animationId')
      if (typeof animId === 'string') {
        gifStore.deleteTextAnimation(animId)
        ks.transformer.nodes([])
        selection.hideSelectionOutline()
        hasSelection.value = false
        animations.renderAnimationNodes(gifStore.activeFrameIndex)
      }
      return
    }
    if (!ks.drawLayer) return
    const nodes = ks.transformer.nodes()
    if (!nodes.length) return
    selection.pushCanvasSnapshot()
    ks.transformer.nodes([])
    selection.hideSelectionOutline()
    hasSelection.value = false
    nodes.forEach((n) => n.destroy())
    ks.drawLayer.draw()
    schedule()
  }

  function getDrawLayerDataUrl(): string | null {
    if (!ks.drawLayer || !ks.stage) return null
    const offscreen = document.createElement('canvas')
    offscreen.width = ks.stage.width()
    offscreen.height = ks.stage.height()
    offscreen.getContext('2d')!.drawImage(ks.drawLayer.getCanvas()._canvas, 0, 0)
    return offscreen.toDataURL('image/png')
  }

  function forceReloadFrame() {
    if (ks.lastFrameId) loadFrame(ks.lastFrameId, true)
  }

  function setZoom(_zoom: number) {}

  function getStage() { return ks.stage }

  return {
    init,
    destroy,
    loadFrame,
    forceReloadFrame,
    flushSerialize: flush,
    clearSelection() {
      selection.hideSelectionOutline()
      hasSelection.value = false
      ks.drawLayer?.draw()
      ks.animationLayer?.draw()
    },
    addText: drawTools.addText,
    addShape: drawTools.addShape,
    addSticker: drawTools.addSticker,
    cancelTextPlacement: drawTools.cancelTextPlacement,
    deleteSelected,
    setZoom,
    getStage,
    getDrawLayerDataUrl,
    getCompositedCanvas,
    syncAnimatedTextVisibility: animations.syncAnimatedTextVisibility,
    renderAnimationNodes: animations.renderAnimationNodes,
    setSelectionGlobal: selection.setSelectionGlobal,
    updateSelectedFill: selection.updateSelectedFill,
    updateSelectedStroke: selection.updateSelectedStroke,
    updateSelectedStrokeColor: selection.updateSelectedStrokeColor,
    updateSelectedStrokeWidth: selection.updateSelectedStrokeWidth,
    updateSelectedCornerRadius: selection.updateSelectedCornerRadius,
    updateSelectedFontFamily: selection.updateSelectedFontFamily,
    updateSelectedFontSize: selection.updateSelectedFontSize,
    updateSelectedBold: selection.updateSelectedBold,
    updateSelectedItalic: selection.updateSelectedItalic,
    filling: drawTools.filling,
    hasSelection,
    isSelectionGlobal,
    eyedropPointerPos,
    textPlacementPos,
    selectedNodeKind,
    selectedNodeShapeType,
    selectedNodeFill,
    selectedNodeStroke,
    selectedNodeStrokeColor,
    selectedNodeStrokeWidth,
    selectedNodeCornerRadius,
    selectedNodeFontFamily,
    selectedNodeFontSize,
    selectedNodeBold,
    selectedNodeItalic,
  }
}
