import Konva from 'konva'
import { nanoid } from 'nanoid'
import {
  ks,
  hasSelection,
  isSelectionGlobal,
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
import { useEditorStore } from '@/stores/editorStore'
import { useGifStore } from '@/stores/gifStore'
import { useHistoryStore } from '@/stores/historyStore'
import type { ShapeType } from '@/types'

export function useKonvaSelection() {
  const editorStore = useEditorStore()
  const gifStore = useGifStore()
  const historyStore = useHistoryStore()

  function schedule() { scheduleSerialize(gifStore, ks.selectionOutline) }
  function flush() { flushSerialize(gifStore, ks.selectionOutline) }

  function strColor(v: string | CanvasGradient, fallback: string): string {
    return typeof v === 'string' ? v || fallback : fallback
  }

  function clearSelectedNodeState() {
    selectedNodeKind.value = null
    selectedNodeShapeType.value = null
    if (editorStore.activeTool !== 'text') editorStore.showTextPanel = false
  }

  function populateSelectedNodeState(node: Konva.Node) {
    if (!(node instanceof Konva.Text) && editorStore.activeTool !== 'text') {
      editorStore.showTextPanel = false
    }
    if (node instanceof Konva.Rect) {
      selectedNodeKind.value = 'rect'
      selectedNodeShapeType.value = (node.getAttr('shapeType') as ShapeType) || 'rectangle'
      selectedNodeFill.value = strColor(node.fill(), '#000000')
      const s = strColor(node.stroke(), '')
      selectedNodeStroke.value = Boolean(s)
      selectedNodeStrokeColor.value = s || '#000000'
      selectedNodeStrokeWidth.value = node.strokeWidth() || 2
      const cr = node.cornerRadius()
      selectedNodeCornerRadius.value = typeof cr === 'number' ? cr : 0
    } else if (node instanceof Konva.Circle) {
      selectedNodeKind.value = 'circle'
      selectedNodeShapeType.value = 'circle'
      selectedNodeFill.value = strColor(node.fill(), '#000000')
      const s = strColor(node.stroke(), '')
      selectedNodeStroke.value = Boolean(s)
      selectedNodeStrokeColor.value = s || '#000000'
      selectedNodeStrokeWidth.value = node.strokeWidth() || 2
    } else if (node instanceof Konva.Text) {
      selectedNodeKind.value = 'text'
      selectedNodeFill.value = strColor(node.fill(), '#ffffff')
      selectedNodeFontFamily.value = node.fontFamily() || 'DM Sans'
      selectedNodeFontSize.value = node.fontSize()
      const style = node.fontStyle()
      selectedNodeBold.value = style.includes('bold')
      selectedNodeItalic.value = style.includes('italic')
      editorStore.showTextPanel = true
    } else if (node instanceof Konva.Line) {
      selectedNodeKind.value = 'line'
      selectedNodeStrokeColor.value = strColor(node.stroke(), '#000000')
      selectedNodeStrokeWidth.value = node.strokeWidth() || 2
    } else if (node instanceof Konva.Image) {
      selectedNodeKind.value = 'image'
    } else {
      selectedNodeKind.value = null
      selectedNodeShapeType.value = null
    }
  }

  function createSelectionOutline() {
    return new Konva.Rect({
      listening: false,
      visible: false,
      stroke: '#f5a623',
      strokeWidth: 2,
      dash: [],
      cornerRadius: 0,
    })
  }

  function attachSelectionChrome(layer: Konva.Layer | null | undefined) {
    if (!layer || !ks.transformer || !ks.selectionOutline) return
    if (ks.transformer.getLayer() === layer) return
    ks.transformer.remove()
    ks.selectionOutline.remove()
    layer.add(ks.selectionOutline)
    layer.add(ks.transformer)
  }

  function updateSelectionOutline() {
    if (!ks.selectionOutline || !ks.selectionTarget) return
    attachSelectionChrome(ks.selectionTarget.getLayer() as Konva.Layer | null)
    ks.transformer?.forceUpdate()
    const box = ks.selectionTarget.getClientRect({ skipShadow: true, skipStroke: false })
    const pad = 4
    ks.selectionOutline.position({ x: box.x - pad, y: box.y - pad })
    ks.selectionOutline.size({ width: box.width + pad * 2, height: box.height + pad * 2 })
    ks.selectionOutline.visible(true)
    ks.selectionOutline.moveToTop()
    ks.transformer?.moveToTop()
    ks.transformer?.visible(true)
    ks.selectionTarget.getLayer()?.batchDraw()
    ks.selectionOutline.getLayer()?.batchDraw()
    ks.animationLayer?.batchDraw()
  }

  function configureTransformerForNode(node: Konva.Node) {
    if (!ks.transformer) return
    if (node instanceof Konva.Text) {
      ks.transformer.keepRatio(true)
      ks.transformer.resizeEnabled(true)
      ks.transformer.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
      return
    }
    if (node instanceof Konva.Image || node instanceof Konva.Circle) {
      ks.transformer.keepRatio(true)
      ks.transformer.resizeEnabled(true)
      ks.transformer.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
      return
    }
    if (node instanceof Konva.Rect) {
      ks.transformer.keepRatio(false)
      ks.transformer.resizeEnabled(true)
      ks.transformer.enabledAnchors([
        'top-left', 'top-center', 'top-right', 'middle-right',
        'bottom-right', 'bottom-center', 'bottom-left', 'middle-left',
      ])
      return
    }
    if (node instanceof Konva.Line) {
      ks.transformer.keepRatio(false)
      ks.transformer.resizeEnabled(true)
      ks.transformer.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
      return
    }
    ks.transformer.keepRatio(false)
    ks.transformer.resizeEnabled(false)
    ks.transformer.enabledAnchors([])
  }

  function normalizeNodeTransform(node: Konva.Node) {
    if (node instanceof Konva.Text) {
      const scale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()), 0.1)
      node.fontSize(Math.max(1, Math.round(node.fontSize() * scale)))
      node.scale({ x: 1, y: 1 })
      return
    }
    if (node instanceof Konva.Image) {
      node.size({
        width: Math.max(8, node.width() * Math.abs(node.scaleX())),
        height: Math.max(8, node.height() * Math.abs(node.scaleY())),
      })
      node.scale({ x: 1, y: 1 })
      return
    }
    if (node instanceof Konva.Circle) {
      const scale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()), 0.1)
      node.radius(Math.max(4, node.radius() * scale))
      node.scale({ x: 1, y: 1 })
      return
    }
    if (node instanceof Konva.Rect) {
      node.size({
        width: Math.max(8, node.width() * Math.abs(node.scaleX())),
        height: Math.max(8, node.height() * Math.abs(node.scaleY())),
      })
      node.scale({ x: 1, y: 1 })
    }
  }

  function hideSelectionOutline() {
    const layer = ks.selectionTarget?.getLayer()
    ks.selectionTarget = null
    ks.transformer?.nodes([])
    ks.selectionOutline?.visible(false)
    layer?.batchDraw()
    ks.selectionOutline?.getLayer()?.batchDraw()
    ks.animationLayer?.batchDraw()
    isSelectionGlobal.value = false
    clearSelectedNodeState()
  }

  function pushCanvasSnapshot() {
    flush()
    if (gifStore.project) historyStore.pushSnapshot(gifStore.project, gifStore.textAnimations)
  }

  function bindEditableNodeEvents(node: Konva.Node) {
    node.on('click tap', () => selectNode(node))
    node.on('dragstart transformstart', pushCanvasSnapshot)
    node.on('dragmove transform', updateSelectionOutline)
    node.on('dragend', schedule)
    node.on('transformend', () => {
      normalizeNodeTransform(node)
      populateSelectedNodeState(node)
      updateSelectionOutline()
      schedule()
    })
  }

  function selectNode(node: Konva.Node) {
    const tool = editorStore.activeTool
    if (tool === 'draw' || tool === 'erase' || tool === 'fill') return
    if (editorStore.selectedFrameIds.length > 1) {
      const activeId = gifStore.project?.activeFrameId
      if (activeId) editorStore.selectSingleFrame(activeId)
      else editorStore.clearFrameSelection()
    }
    attachSelectionChrome(node.getLayer() as Konva.Layer | null)
    configureTransformerForNode(node)
    ks.transformer?.nodes([node])
    ks.transformer?.visible(true)
    ks.transformer?.forceUpdate()
    ks.selectionTarget = node
    isSelectionGlobal.value = !!node.getAttr('allFrames')
    updateSelectionOutline()
    ks.transformer?.moveToTop()
    hasSelection.value = true
    populateSelectedNodeState(node)
    node.getLayer()?.draw()
    ks.selectionOutline?.getLayer()?.draw()
    ks.animationLayer?.draw()
  }

  function restoreShape(config: Record<string, unknown>) {
    if (!ks.drawLayer) return
    const type = config.className as string
    if (type === 'Line') {
      const line = new Konva.Line(config.attrs as Konva.LineConfig)
      if (line.globalCompositeOperation() === 'source-over') {
        line.draggable(true)
        bindEditableNodeEvents(line)
      }
      ks.drawLayer.add(line)
    } else if (type === 'Text') {
      const attrs = { ...(config.attrs as Konva.TextConfig & { id?: string }) }
      attrs.id ??= nanoid()
      const text = new Konva.Text(attrs)
      text.draggable(true)
      bindEditableNodeEvents(text)
      ks.drawLayer.add(text)
    } else if (type === 'Rect') {
      const rect = new Konva.Rect(config.attrs as Konva.RectConfig)
      rect.draggable(true)
      bindEditableNodeEvents(rect)
      ks.drawLayer.add(rect)
    } else if (type === 'Circle') {
      const circle = new Konva.Circle(config.attrs as Konva.CircleConfig)
      circle.draggable(true)
      bindEditableNodeEvents(circle)
      ks.drawLayer.add(circle)
    } else if (type === 'Image') {
      const attrs = config.attrs as Record<string, unknown>
      const img = new Image()
      img.onload = () => {
        const kImg = new Konva.Image({ ...attrs, image: img } as Konva.ImageConfig)
        kImg.setAttr('src', attrs.src)
        kImg.draggable(true)
        bindEditableNodeEvents(kImg)
        ks.drawLayer!.add(kImg)
        ks.drawLayer!.draw()
      }
      img.src = attrs.src as string
    }
  }

  function setSelectionGlobal(value: boolean) {
    if (!ks.selectionTarget) return
    ks.selectionTarget.setAttr('allFrames', value || undefined)
    isSelectionGlobal.value = value
    schedule()
  }

  // ── Property update functions ────────────────────────────────────────────

  function updateSelectedFill(color: string) {
    selectedNodeFill.value = color
    if (!ks.selectionTarget) return
    if (
      ks.selectionTarget instanceof Konva.Rect ||
      ks.selectionTarget instanceof Konva.Circle ||
      ks.selectionTarget instanceof Konva.Text
    ) {
      ks.selectionTarget.fill(color)
      ks.selectionTarget.getLayer()?.batchDraw()
      schedule()
    }
  }

  function updateSelectedStroke(enabled: boolean) {
    selectedNodeStroke.value = enabled
    if (!ks.selectionTarget) return
    if (ks.selectionTarget instanceof Konva.Rect || ks.selectionTarget instanceof Konva.Circle) {
      ks.selectionTarget.stroke(enabled ? selectedNodeStrokeColor.value : '')
      ks.selectionTarget.strokeWidth(enabled ? selectedNodeStrokeWidth.value : 0)
      ks.selectionTarget.getLayer()?.batchDraw()
      schedule()
    }
  }

  function updateSelectedStrokeColor(color: string) {
    selectedNodeStrokeColor.value = color
    if (!ks.selectionTarget) return
    if (ks.selectionTarget instanceof Konva.Line) {
      ks.selectionTarget.stroke(color)
      ks.selectionTarget.getLayer()?.batchDraw()
      schedule()
      return
    }
    if (!selectedNodeStroke.value) return
    if (ks.selectionTarget instanceof Konva.Rect || ks.selectionTarget instanceof Konva.Circle) {
      ks.selectionTarget.stroke(color)
      ks.selectionTarget.getLayer()?.batchDraw()
      schedule()
    }
  }

  function updateSelectedStrokeWidth(width: number) {
    selectedNodeStrokeWidth.value = width
    if (!ks.selectionTarget) return
    if (ks.selectionTarget instanceof Konva.Line) {
      ks.selectionTarget.strokeWidth(width)
      ks.selectionTarget.getLayer()?.batchDraw()
      schedule()
      return
    }
    if (!selectedNodeStroke.value) return
    if (ks.selectionTarget instanceof Konva.Rect || ks.selectionTarget instanceof Konva.Circle) {
      ks.selectionTarget.strokeWidth(width)
      ks.selectionTarget.getLayer()?.batchDraw()
      schedule()
    }
  }

  function updateSelectedCornerRadius(radius: number) {
    selectedNodeCornerRadius.value = radius
    if (!ks.selectionTarget || !(ks.selectionTarget instanceof Konva.Rect)) return
    ks.selectionTarget.cornerRadius(radius)
    ks.selectionTarget.getLayer()?.batchDraw()
    schedule()
  }

  function updateSelectedFontFamily(family: string) {
    selectedNodeFontFamily.value = family
    if (!ks.selectionTarget || !(ks.selectionTarget instanceof Konva.Text)) return
    ks.selectionTarget.fontFamily(family)
    ks.selectionTarget.getLayer()?.batchDraw()
    updateSelectionOutline()
    schedule()
  }

  function updateSelectedFontSize(size: number) {
    selectedNodeFontSize.value = size
    if (!ks.selectionTarget || !(ks.selectionTarget instanceof Konva.Text)) return
    ks.selectionTarget.fontSize(size)
    ks.selectionTarget.getLayer()?.batchDraw()
    updateSelectionOutline()
    schedule()
  }

  function updateSelectedBold(bold: boolean) {
    selectedNodeBold.value = bold
    if (!ks.selectionTarget || !(ks.selectionTarget instanceof Konva.Text)) return
    ks.selectionTarget.fontStyle(
      `${bold ? 'bold ' : ''}${selectedNodeItalic.value ? 'italic' : ''}`.trim() || 'normal',
    )
    ks.selectionTarget.getLayer()?.batchDraw()
    schedule()
  }

  function updateSelectedItalic(italic: boolean) {
    selectedNodeItalic.value = italic
    if (!ks.selectionTarget || !(ks.selectionTarget instanceof Konva.Text)) return
    ks.selectionTarget.fontStyle(
      `${selectedNodeBold.value ? 'bold ' : ''}${italic ? 'italic' : ''}`.trim() || 'normal',
    )
    ks.selectionTarget.getLayer()?.batchDraw()
    schedule()
  }

  return {
    createSelectionOutline,
    attachSelectionChrome,
    updateSelectionOutline,
    configureTransformerForNode,
    bindEditableNodeEvents,
    hideSelectionOutline,
    pushCanvasSnapshot,
    selectNode,
    restoreShape,
    setSelectionGlobal,
    populateSelectedNodeState,
    clearSelectedNodeState,
    updateSelectedFill,
    updateSelectedStroke,
    updateSelectedStrokeColor,
    updateSelectedStrokeWidth,
    updateSelectedCornerRadius,
    updateSelectedFontFamily,
    updateSelectedFontSize,
    updateSelectedBold,
    updateSelectedItalic,
  }
}
