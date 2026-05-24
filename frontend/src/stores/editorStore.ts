import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ShapeType, ToolType, TextConfig } from '@/types'

type ColorPickCallback = (color: string) => void

export const useEditorStore = defineStore('editor', () => {
  const activeTool = ref<ToolType>('select')
  // Set by ColorPicker when the user clicks the eyedropper button.
  // The canvas mousedown handler intercepts the next click and calls this.
  // We never change activeTool for canvas-pick so the ColorPicker stays mounted.
  const pendingColorPick = ref<ColorPickCallback | null>(null)
  const brushSize = ref(8)
  const brushColor = ref('#f5a623')
  const eraserSize = ref(20)
  const fillColor = ref('#f5a623')
  const fillTolerance = ref(15)
  const shapeType = ref<ShapeType>('rectangle')
  const shapeStroke = ref(true)
  const shapeStrokeColor = ref('#0f0f0f')
  const shapeStrokeWidth = ref(2)
  const shapeCornerRadius = ref(6)
  const zoom = ref(1)
  const selectedFrameIds = ref<string[]>([])
  const frameSelectionAnchorId = ref<string | null>(null)
  const showStickerPicker = ref(false)
  const showTextPanel = ref(false)

  const textConfig = ref<TextConfig>({
    fontFamily: 'DM Sans',
    fontSize: 28,
    color: '#ffffff',
    bold: false,
    italic: false,
  })

  function setTool(tool: ToolType) {
    activeTool.value = tool
    if (tool !== 'sticker') showStickerPicker.value = false
    if (tool !== 'text') showTextPanel.value = false
    if (tool === 'sticker') showStickerPicker.value = true
    if (tool === 'text') showTextPanel.value = true
  }

  function requestCanvasPick(cb: ColorPickCallback) {
    pendingColorPick.value = cb
    // Do NOT change activeTool — the ColorPicker that called this must stay mounted.
  }

  function cancelCanvasPick() {
    pendingColorPick.value = null
  }

  function setZoom(z: number) {
    zoom.value = Math.min(8, Math.max(0.1, z))
  }

  function setFrameSelection(ids: string[], anchorId?: string | null) {
    selectedFrameIds.value = ids
    frameSelectionAnchorId.value = anchorId ?? ids[ids.length - 1] ?? null
  }

  function selectSingleFrame(id: string) {
    setFrameSelection([id], id)
  }

  function toggleFrameSelection(id: string) {
    const idx = selectedFrameIds.value.indexOf(id)
    if (idx === -1) selectedFrameIds.value.push(id)
    else selectedFrameIds.value.splice(idx, 1)
    frameSelectionAnchorId.value = id
  }

  function clearFrameSelection() {
    selectedFrameIds.value = []
    frameSelectionAnchorId.value = null
  }

  function reset() {
    activeTool.value = 'select'
    zoom.value = 1
    selectedFrameIds.value = []
    frameSelectionAnchorId.value = null
    showStickerPicker.value = false
    showTextPanel.value = false
    pendingColorPick.value = null
  }

  return {
    activeTool,
    pendingColorPick,
    requestCanvasPick,
    cancelCanvasPick,
    brushSize,
    brushColor,
    eraserSize,
    fillColor,
    fillTolerance,
    shapeType,
    shapeStroke,
    shapeStrokeColor,
    shapeStrokeWidth,
    shapeCornerRadius,
    zoom,
    selectedFrameIds,
    frameSelectionAnchorId,
    showStickerPicker,
    showTextPanel,
    textConfig,
    setTool,
    setZoom,
    setFrameSelection,
    selectSingleFrame,
    toggleFrameSelection,
    clearFrameSelection,
    reset,
  }
})
