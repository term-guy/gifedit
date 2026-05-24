export interface GifFrame {
  id: string
  imageData: ImageData
  dataUrl: string
  thumbnailUrl: string
  duration: number
  canvasJson: string
}

export interface GifProject {
  filename: string
  width: number
  height: number
  repeat: number
  frames: GifFrame[]
  activeFrameId: string | null
  globalCanvasJson: string
  sourceFile: File | null
}

export type ToolType = 'select' | 'draw' | 'erase' | 'fill' | 'shape' | 'text' | 'sticker'
export type ShapeType = 'square' | 'rectangle' | 'circle'

export interface TextConfig {
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
}

export type AnimationType = 'static' | 'typing' | 'pan' | 'fade'
export type PanDirection = 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top'
export type FadeDirection = 'in' | 'out'

export interface TextAnimation {
  id: string
  sourceNodeId?: string
  text: string
  fontFamily: string
  fontSize: number
  color: string
  x: number
  y: number
  startFrame: number
  endFrame: number
  type: AnimationType
  panDirection?: PanDirection
  panStartX?: number
  panEndX?: number
  panStartY?: number
  panEndY?: number
  fadeDirection?: FadeDirection
}
