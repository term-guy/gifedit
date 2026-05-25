import { ref } from 'vue'
import Konva from 'konva'
import { nanoid } from 'nanoid'
import { ks, hasSelection, textPlacementPos } from './konvaState'
import { scheduleSerialize, flushSerialize } from './useKonvaSerializer'
import { useKonvaSelection } from './useKonvaSelection'
import { useEditorStore } from '@/stores/editorStore'
import { useGifStore } from '@/stores/gifStore'
import { floodFill } from '@/utils/floodFill'
import { imageDataToDataUrl, imageDataToThumbnail } from '@/utils/imageData'

export function useKonvaDrawTools() {
  const editorStore = useEditorStore()
  const gifStore = useGifStore()
  const filling = ref(false)

  const {
    bindEditableNodeEvents,
    selectNode,
    configureTransformerForNode,
    updateSelectionOutline,
    pushCanvasSnapshot,
    populateSelectedNodeState,
  } = useKonvaSelection()

  function schedule() { scheduleSerialize(gifStore, ks.selectionOutline) }
  function flush() { flushSerialize(gifStore, ks.selectionOutline) }

  function startDrawing(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!ks.stage || !ks.drawLayer) return
    pushCanvasSnapshot()
    ks.isDrawing = true
    const pos = ks.stage.getPointerPosition()!
    const tool = editorStore.activeTool

    const lineConfig: Konva.LineConfig = {
      stroke: tool === 'erase' ? '#000000' : editorStore.brushColor,
      strokeWidth: tool === 'erase' ? editorStore.eraserSize : editorStore.brushSize,
      lineCap: 'round',
      lineJoin: 'round',
      tension: 0,
      points: [pos.x, pos.y, pos.x, pos.y],
      globalCompositeOperation: tool === 'erase' ? 'destination-out' : 'source-over',
    }

    ks.currentLine = new Konva.Line(lineConfig)
    ks.drawLayer.add(ks.currentLine)
    ks.drawLayer.draw()
    e.evt.preventDefault()
  }

  function continueDrawing() {
    if (!ks.stage || !ks.currentLine || !ks.drawLayer) return
    const pos = ks.stage.getPointerPosition()!
    const points = ks.currentLine.points()
    ks.currentLine.points([...points, pos.x, pos.y])
    ks.drawLayer.draw()
  }

  function bakeErase(eraseLine: Konva.Line) {
    if (!ks.stage || !ks.drawLayer || !ks.lastFrameId) return

    ks.selectionOutline?.visible(false)
    ks.transformer?.visible(false)
    ks.drawLayer.draw()

    const srcCanvas = (ks.drawLayer.getCanvas() as unknown as { _canvas: HTMLCanvasElement })._canvas
    const snapshot = document.createElement('canvas')
    snapshot.width = srcCanvas.width
    snapshot.height = srcCanvas.height
    snapshot.getContext('2d')!.drawImage(srcCanvas, 0, 0)

    eraseLine.destroy()
    const selectionWasLine = ks.selectionTarget instanceof Konva.Line
    ks.drawLayer.getChildren().filter((n) => n instanceof Konva.Line).forEach((n) => n.destroy())
    if (selectionWasLine) {
      ks.selectionTarget = null
      ks.transformer?.nodes([])
      hasSelection.value = false
    }

    const snapshotData = snapshot.getContext('2d')!.getImageData(0, 0, snapshot.width, snapshot.height)
    const { data, width: sw, height: sh } = snapshotData
    let minX = sw, minY = sh, maxX = 0, maxY = 0
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (data[(y * sw + x) * 4 + 3] > 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (minX <= maxX && minY <= maxY) {
      const cropW = maxX - minX + 1
      const cropH = maxY - minY + 1
      const cropped = document.createElement('canvas')
      cropped.width = cropW
      cropped.height = cropH
      cropped.getContext('2d')!.drawImage(snapshot, minX, minY, cropW, cropH, 0, 0, cropW, cropH)

      const konvaImg = new Konva.Image({
        image: cropped,
        x: minX,
        y: minY,
        width: cropW,
        height: cropH,
        draggable: true,
      })
      konvaImg.setAttr('src', cropped.toDataURL())
      bindEditableNodeEvents(konvaImg)
      ks.drawLayer.add(konvaImg)
      ks.drawLayer.draw()
      editorStore.setTool('select')
      selectNode(konvaImg)
    } else {
      if (hasSelection.value && ks.selectionTarget) {
        ks.selectionOutline?.visible(true)
        ks.transformer?.visible(true)
      }
      ks.drawLayer.draw()
    }
  }

  function finishDrawing() {
    if (!ks.isDrawing) return
    ks.isDrawing = false
    const finishedLine = ks.currentLine
    ks.currentLine = null
    if (finishedLine) {
      if (finishedLine.globalCompositeOperation() === 'destination-out') {
        bakeErase(finishedLine)
      } else {
        finishedLine.draggable(true)
        bindEditableNodeEvents(finishedLine)
      }
    }
    schedule()
  }

  function startDrawingShape(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!ks.stage || !ks.drawLayer) return
    pushCanvasSnapshot()
    const pos = ks.stage.getPointerPosition()!
    ks.shapeStartPos = { x: pos.x, y: pos.y }
    ks.isDrawingShape = true

    const shapeType = editorStore.shapeType
    const shapeAttrs = {
      fill: editorStore.fillColor,
      stroke: editorStore.shapeStroke ? editorStore.shapeStrokeColor : '',
      strokeWidth: editorStore.shapeStroke ? editorStore.shapeStrokeWidth : 0,
      listening: false,
    }

    if (shapeType === 'circle') {
      ks.currentShapePreview = new Konva.Circle({ ...shapeAttrs, x: pos.x, y: pos.y, radius: 1 })
    } else {
      ks.currentShapePreview = new Konva.Rect({
        ...shapeAttrs,
        x: pos.x,
        y: pos.y,
        width: 1,
        height: 1,
        cornerRadius: shapeType === 'square' ? editorStore.shapeCornerRadius : 0,
      })
    }

    ;(ks.currentShapePreview as Konva.Node).setAttr('shapeType', shapeType)
    ks.drawLayer.add(ks.currentShapePreview)
    ks.drawLayer.draw()
    e.evt.preventDefault()
  }

  function continueDrawingShape() {
    if (!ks.stage || !ks.currentShapePreview || !ks.shapeStartPos) return
    const pos = ks.stage.getPointerPosition()!
    const dx = pos.x - ks.shapeStartPos.x
    const dy = pos.y - ks.shapeStartPos.y
    const shapeType = (ks.currentShapePreview as Konva.Node).getAttr('shapeType') as string

    if (shapeType === 'circle') {
      const circle = ks.currentShapePreview as Konva.Circle
      const radius = Math.max(1, Math.sqrt(dx * dx + dy * dy) / 2)
      circle.position({ x: (ks.shapeStartPos.x + pos.x) / 2, y: (ks.shapeStartPos.y + pos.y) / 2 })
      circle.radius(radius)
    } else if (shapeType === 'square') {
      const side = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)))
      ks.currentShapePreview.position({
        x: dx >= 0 ? ks.shapeStartPos.x : ks.shapeStartPos.x - side,
        y: dy >= 0 ? ks.shapeStartPos.y : ks.shapeStartPos.y - side,
      })
      ;(ks.currentShapePreview as Konva.Rect).size({ width: side, height: side })
    } else {
      ks.currentShapePreview.position({
        x: dx >= 0 ? ks.shapeStartPos.x : pos.x,
        y: dy >= 0 ? ks.shapeStartPos.y : pos.y,
      })
      ;(ks.currentShapePreview as Konva.Rect).size({
        width: Math.max(1, Math.abs(dx)),
        height: Math.max(1, Math.abs(dy)),
      })
    }

    ks.drawLayer?.draw()
  }

  function finishDrawingShape() {
    if (!ks.currentShapePreview || !ks.isDrawingShape) return
    ks.isDrawingShape = false
    ks.shapeStartPos = null

    const shape = ks.currentShapePreview
    ks.currentShapePreview = null

    const tooSmall =
      shape instanceof Konva.Circle
        ? (shape as Konva.Circle).radius() < 3
        : (shape as Konva.Rect).width() < 3 || (shape as Konva.Rect).height() < 3

    if (tooSmall) {
      shape.destroy()
      ks.drawLayer?.draw()
      return
    }

    shape.listening(true)
    shape.draggable(true)
    bindEditableNodeEvents(shape)
    selectNode(shape)
    editorStore.setTool('select')
    flush()
  }

  async function doFill(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!ks.stage || !ks.baseLayer || !gifStore.activeFrame) return
    pushCanvasSnapshot()
    const pos = ks.stage.getPointerPosition()!
    const x = Math.floor(pos.x)
    const y = Math.floor(pos.y)

    const frame = gifStore.activeFrame
    filling.value = true

    await new Promise((resolve) => setTimeout(resolve, 10))
    const filled = floodFill(frame.imageData, x, y, editorStore.fillColor, editorStore.fillTolerance)

    const newDataUrl = imageDataToDataUrl(filled)
    const newThumb = imageDataToThumbnail(filled)

    gifStore.updateFrameDataUrl(frame.id, newDataUrl)
    frame.imageData = filled
    frame.thumbnailUrl = newThumb

    const canvas = document.createElement('canvas')
    canvas.width = filled.width
    canvas.height = filled.height
    canvas.getContext('2d')!.putImageData(filled, 0, 0)

    const imgNode = ks.baseLayer.findOne('Image') as Konva.Image | null
    if (imgNode) {
      imgNode.image(canvas)
      ks.baseLayer.draw()
    }

    filling.value = false
    e.evt.preventDefault()
  }

  function addText(text: string, x?: number, y?: number) {
    if (!ks.drawLayer || !ks.stage) return
    pushCanvasSnapshot()
    const { textConfig } = editorStore
    const textNode = new Konva.Text({
      id: nanoid(),
      x: x ?? (ks.stage.width() - 200) / 2,
      y: y ?? (ks.stage.height() - 40) / 2,
      text,
      fontSize: textConfig.fontSize,
      fontFamily: textConfig.fontFamily,
      fill: textConfig.color,
      fontStyle: `${textConfig.bold ? 'bold ' : ''}${textConfig.italic ? 'italic' : ''}`.trim() || 'normal',
      draggable: true,
    })
    bindEditableNodeEvents(textNode)
    ks.drawLayer.add(textNode)
    configureTransformerForNode(textNode)
    ks.transformer?.nodes([textNode])
    ks.selectionTarget = textNode
    updateSelectionOutline()
    ks.transformer?.moveToTop()
    hasSelection.value = true
    ks.drawLayer.draw()
    textPlacementPos.value = null
    populateSelectedNodeState(textNode)
    editorStore.setTool('select')
    flush()
  }

  function cancelTextPlacement() {
    textPlacementPos.value = null
  }

  function addSticker(src: string, dropX?: number, dropY?: number) {
    if (!ks.drawLayer || !ks.stage) return
    pushCanvasSnapshot()
    const img = new Image()
    img.onload = () => {
      const size = 80
      const x = dropX !== undefined ? dropX - size / 2 : (ks.stage!.width() - size) / 2
      const y = dropY !== undefined ? dropY - size / 2 : (ks.stage!.height() - size) / 2
      const stickerImg = new Konva.Image({
        image: img,
        x,
        y,
        width: size,
        height: size,
        draggable: true,
      })
      stickerImg.setAttr('src', src)
      bindEditableNodeEvents(stickerImg)
      ks.drawLayer!.add(stickerImg)
      configureTransformerForNode(stickerImg)
      ks.transformer?.nodes([stickerImg])
      ks.selectionTarget = stickerImg
      updateSelectionOutline()
      ks.transformer?.moveToTop()
      hasSelection.value = true
      ks.drawLayer!.draw()
      flush()
    }
    img.src = src
  }

  function addShape(shapeType: import('@/types').ShapeType) {
    if (!ks.drawLayer || !ks.stage) return
    pushCanvasSnapshot()

    const commonAttrs = {
      x: ks.stage.width() / 2 - 40,
      y: ks.stage.height() / 2 - 40,
      fill: editorStore.fillColor,
      stroke: editorStore.shapeStroke ? editorStore.shapeStrokeColor : '',
      strokeWidth: editorStore.shapeStroke ? editorStore.shapeStrokeWidth : 0,
      draggable: true,
    }

    const shape =
      shapeType === 'circle'
        ? new Konva.Circle({
            ...commonAttrs,
            x: ks.stage.width() / 2,
            y: ks.stage.height() / 2,
            radius: 40,
          })
        : new Konva.Rect({
            ...commonAttrs,
            width: shapeType === 'rectangle' ? 120 : 80,
            height: 80,
            cornerRadius: shapeType === 'rectangle' ? 10 : editorStore.shapeCornerRadius,
          })

    ;(shape as Konva.Node).setAttr('shapeType', shapeType)
    bindEditableNodeEvents(shape)
    ks.drawLayer.add(shape)
    configureTransformerForNode(shape)
    ks.transformer?.nodes([shape])
    ks.selectionTarget = shape
    updateSelectionOutline()
    ks.transformer?.moveToTop()
    hasSelection.value = true
    ks.drawLayer.draw()
    flush()
  }

  return {
    filling,
    startDrawing,
    continueDrawing,
    finishDrawing,
    startDrawingShape,
    continueDrawingShape,
    finishDrawingShape,
    doFill,
    addText,
    cancelTextPlacement,
    addSticker,
    addShape,
  }
}
