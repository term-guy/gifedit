import Konva from 'konva'
import { useGifStore } from '@/stores/gifStore'
import { lerp } from '@/utils/interpolate'
import type { GifFrame, TextAnimation } from '@/types'

export interface RenderedTextAnimationState {
  text: string
  x: number
  y: number
  alpha: number
}

export function getRenderedTextAnimationState(
  anim: TextAnimation,
  frameIndex: number,
  width: number,
  height: number,
): RenderedTextAnimationState {
  const { startFrame, endFrame, type } = anim
  const range = endFrame - startFrame
  const t = range > 0 ? (frameIndex - startFrame) / range : 0

  const x = anim.x * width
  const y = anim.y * height

  if (type === 'static') {
    return { text: anim.text, x, y, alpha: 1 }
  }

  if (type === 'typing') {
    const charCount = Math.min(
      anim.text.length,
      frameIndex - startFrame + 1,
    )
    return {
      text: anim.text.substring(0, charCount),
      x,
      y,
      alpha: 1,
    }
  }

  if (type === 'pan') {
    let drawX = x
    let drawY = y
    if (anim.panDirection === 'left-to-right' || anim.panDirection === 'right-to-left') {
      const startX = (anim.panStartX ?? 0) * width
      const endX = (anim.panEndX ?? 1) * width
      drawX = lerp(startX, endX, t)
    } else {
      const startY = (anim.panStartY ?? 0) * height
      const endY = (anim.panEndY ?? 1) * height
      drawY = lerp(startY, endY, t)
    }
    return { text: anim.text, x: drawX, y: drawY, alpha: 1 }
  }

  const alpha = anim.fadeDirection === 'out' ? lerp(1, 0, t) : lerp(0, 1, t)
  return { text: anim.text, x, y, alpha }
}

export function useTextAnimations() {
  const gifStore = useGifStore()

  function renderTextOnCanvas(
    ctx: CanvasRenderingContext2D,
    anim: TextAnimation,
    frameIndex: number,
    width: number,
    height: number,
  ) {
    const state = getRenderedTextAnimationState(anim, frameIndex, width, height)

    ctx.save()
    ctx.font = `${anim.fontSize}px "${anim.fontFamily}", sans-serif`
    ctx.fillStyle = anim.color
    ctx.textBaseline = 'top'
    ctx.globalAlpha = state.alpha
    ctx.fillText(state.text, state.x, state.y)

    ctx.restore()
  }

  async function bakeAnimations(
    frames: GifFrame[],
    width: number,
    height: number,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<string[]> {
    const animations = gifStore.textAnimations
    const results: string[] = []
    const total = frames.length

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!

      // Draw base frame
      const img = await loadImage(frame.dataUrl)
      ctx.drawImage(img, 0, 0)

      // Draw konva overlay if present, excluding source text nodes while their animation is active.
      if (frame.canvasJson) {
        try {
          const canvasData = JSON.parse(frame.canvasJson)
          await drawCanvasChildren(ctx, canvasData.children ?? [], i, animations, width, height)
        } catch {}
      }

      // Draw global objects (appear on all frames)
      const globalJson = gifStore.project?.globalCanvasJson
      if (globalJson) {
        try {
          const globalData = JSON.parse(globalJson)
          await drawCanvasChildren(ctx, globalData.children ?? [], i, animations, width, height)
        } catch {}
      }

      // Bake animations for this frame
      for (const anim of animations) {
        if (i >= anim.startFrame && i <= anim.endFrame) {
          renderTextOnCanvas(ctx, anim, i, width, height)
        }
      }

      results.push(canvas.toDataURL('image/png'))
      onProgress?.(i + 1, total)
    }

    return results
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  }

  async function drawCanvasChildren(
    ctx: CanvasRenderingContext2D,
    children: Array<{ className?: string; attrs?: Record<string, unknown> }>,
    frameIndex: number,
    animations: TextAnimation[],
    width: number,
    height: number,
  ) {
    const activeSourceNodeIds = new Set(
      animations
        .filter((anim) =>
          anim.sourceNodeId &&
          frameIndex >= anim.startFrame &&
          frameIndex <= anim.endFrame,
        )
        .map((anim) => anim.sourceNodeId as string),
    )

    for (const child of children) {
      const className = child.className
      const attrs = child.attrs ?? {}

      if (className === 'Text') {
        const nodeId = attrs.id
        if (typeof nodeId === 'string' && activeSourceNodeIds.has(nodeId)) continue
      }

      await drawChild(ctx, className, attrs, width, height)
    }
  }

  async function drawChild(
    ctx: CanvasRenderingContext2D,
    className: string | undefined,
    attrs: Record<string, unknown>,
    width: number,
    height: number,
  ) {
    if (!className) return

    let node: Konva.Group | Konva.Shape | null = null

    if (className === 'Text') {
      node = new Konva.Text(attrs as Konva.TextConfig)
    } else if (className === 'Line') {
      node = new Konva.Line(attrs as Konva.LineConfig)
    } else if (className === 'Rect') {
      node = new Konva.Rect(attrs as Konva.RectConfig)
    } else if (className === 'Circle') {
      node = new Konva.Circle(attrs as Konva.CircleConfig)
    } else if (className === 'Image') {
      const src = attrs.src
      if (typeof src !== 'string') return
      const img = await loadImage(src)
      node = new Konva.Image({ ...attrs, image: img } as Konva.ImageConfig)
    }

    if (!node) return

    const container = document.createElement('div')
    const stage = new Konva.Stage({ container, width, height })
    const layer = new Konva.Layer()
    stage.add(layer)
    layer.add(node)
    layer.draw()
    ctx.drawImage(stage.toCanvas(), 0, 0)
    stage.destroy()
  }

  return { bakeAnimations, renderTextOnCanvas }
}
