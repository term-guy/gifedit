import { ref } from 'vue'
import Konva from 'konva'
import type { ShapeType } from '@/types'

// Single mutable object so any module can assign ks.stage = ... without
// fighting ES-module live-binding restrictions.
export const ks = {
  stage: null as Konva.Stage | null,
  baseLayer: null as Konva.Layer | null,
  drawLayer: null as Konva.Layer | null,
  animationLayer: null as Konva.Layer | null,
  transformer: null as Konva.Transformer | null,
  selectionOutline: null as Konva.Rect | null,
  selectionTarget: null as Konva.Node | null,
  currentLine: null as Konva.Line | null,
  isDrawing: false,
  isDrawingShape: false,
  shapeStartPos: null as { x: number; y: number } | null,
  currentShapePreview: null as Konva.Rect | Konva.Circle | null,
  lastFrameId: null as string | null,
  thumbnailRefreshGeneration: 0,
}

export const THUMBNAIL_MAX_WIDTH = 80
export const thumbnailImageCache = new Map<string, Promise<HTMLImageElement>>()

export const serializeTimer = ref<ReturnType<typeof setTimeout> | null>(null)
export const filling = ref(false)
export const hasSelection = ref(false)
export const isSelectionGlobal = ref(false)
export const eyedropPointerPos = ref<{ x: number; y: number } | null>(null)
export const textPlacementPos = ref<{ x: number; y: number } | null>(null)

export const selectedNodeKind = ref<'rect' | 'circle' | 'text' | 'line' | 'image' | null>(null)
export const selectedNodeShapeType = ref<ShapeType | null>(null)
export const selectedNodeFill = ref('#000000')
export const selectedNodeStroke = ref(false)
export const selectedNodeStrokeColor = ref('#000000')
export const selectedNodeStrokeWidth = ref(2)
export const selectedNodeCornerRadius = ref(0)
export const selectedNodeFontFamily = ref('DM Sans')
export const selectedNodeFontSize = ref(28)
export const selectedNodeBold = ref(false)
export const selectedNodeItalic = ref(false)
