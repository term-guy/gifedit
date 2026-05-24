import { ks, THUMBNAIL_MAX_WIDTH, thumbnailImageCache } from './konvaState'
import { useGifStore } from '@/stores/gifStore'
import type { GifFrame } from '@/types'

export function parseSerializedChildren(json: string | null | undefined): Record<string, unknown>[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json) as { children?: Record<string, unknown>[] }
    return Array.isArray(parsed.children) ? parsed.children : []
  } catch {
    return []
  }
}

export function createThumbnailDataUrl(source: HTMLCanvasElement, maxWidth = THUMBNAIL_MAX_WIDTH): string {
  const scale = Math.min(1, maxWidth / source.width)
  const w = Math.max(1, Math.round(source.width * scale))
  const h = Math.max(1, Math.round(source.height * scale))
  const dst = document.createElement('canvas')
  dst.width = w
  dst.height = h
  dst.getContext('2d')!.drawImage(source, 0, 0, w, h)
  return dst.toDataURL('image/png')
}

export function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  const cached = thumbnailImageCache.get(src)
  if (cached) return cached

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  }).catch((error) => {
    thumbnailImageCache.delete(src)
    throw error
  })

  thumbnailImageCache.set(src, promise)
  return promise
}

function traceRoundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const clamped = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  if (clamped === 0) {
    ctx.rect(x, y, width, height)
    return
  }
  ctx.moveTo(x + clamped, y)
  ctx.lineTo(x + width - clamped, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + clamped)
  ctx.lineTo(x + width, y + height - clamped)
  ctx.quadraticCurveTo(x + width, y + height, x + width - clamped, y + height)
  ctx.lineTo(x + clamped, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - clamped)
  ctx.lineTo(x, y + clamped)
  ctx.quadraticCurveTo(x, y, x + clamped, y)
  ctx.closePath()
}

function numberAttr(attrs: Record<string, unknown>, key: string, fallback = 0): number {
  const value = attrs[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringAttr(attrs: Record<string, unknown>, key: string, fallback = ''): string {
  const value = attrs[key]
  return typeof value === 'string' ? value : fallback
}

function applyNodeStyle(ctx: CanvasRenderingContext2D, attrs: Record<string, unknown>) {
  ctx.globalAlpha = numberAttr(attrs, 'opacity', 1)
  ctx.globalCompositeOperation = stringAttr(attrs, 'globalCompositeOperation', 'source-over') as GlobalCompositeOperation
}

export async function drawSerializedNode(
  ctx: CanvasRenderingContext2D,
  config: Record<string, unknown>,
): Promise<void> {
  const className = typeof config.className === 'string' ? config.className : ''
  const attrsValue = config.attrs
  if (!attrsValue || typeof attrsValue !== 'object') return
  const attrs = attrsValue as Record<string, unknown>

  ctx.save()
  applyNodeStyle(ctx, attrs)

  const x = numberAttr(attrs, 'x')
  const y = numberAttr(attrs, 'y')
  const rotation = (numberAttr(attrs, 'rotation') * Math.PI) / 180
  ctx.translate(x, y)
  if (rotation) ctx.rotate(rotation)

  if (className === 'Rect') {
    const width = numberAttr(attrs, 'width')
    const height = numberAttr(attrs, 'height')
    const radius = numberAttr(attrs, 'cornerRadius')
    traceRoundRectPath(ctx, 0, 0, width, height, radius)
    const fill = stringAttr(attrs, 'fill')
    if (fill) { ctx.fillStyle = fill; ctx.fill() }
    const stroke = stringAttr(attrs, 'stroke')
    const strokeWidth = numberAttr(attrs, 'strokeWidth')
    if (stroke && strokeWidth > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.stroke() }
    ctx.restore()
    return
  }

  if (className === 'Circle') {
    const radius = numberAttr(attrs, 'radius')
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    const fill = stringAttr(attrs, 'fill')
    if (fill) { ctx.fillStyle = fill; ctx.fill() }
    const stroke = stringAttr(attrs, 'stroke')
    const strokeWidth = numberAttr(attrs, 'strokeWidth')
    if (stroke && strokeWidth > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.stroke() }
    ctx.restore()
    return
  }

  if (className === 'Line') {
    const points = Array.isArray(attrs.points) ? attrs.points : []
    if (points.length >= 4) {
      ctx.beginPath()
      ctx.moveTo(typeof points[0] === 'number' ? points[0] : 0, typeof points[1] === 'number' ? points[1] : 0)
      for (let i = 2; i < points.length; i += 2) {
        const px = typeof points[i] === 'number' ? points[i] : 0
        const py = typeof points[i + 1] === 'number' ? points[i + 1] : 0
        ctx.lineTo(px, py)
      }
      ctx.strokeStyle = stringAttr(attrs, 'stroke', '#000000')
      ctx.lineWidth = numberAttr(attrs, 'strokeWidth', 1)
      ctx.lineCap = stringAttr(attrs, 'lineCap', 'butt') as CanvasLineCap
      ctx.lineJoin = stringAttr(attrs, 'lineJoin', 'miter') as CanvasLineJoin
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  if (className === 'Text') {
    ctx.font = `${stringAttr(attrs, 'fontStyle', 'normal')} ${numberAttr(attrs, 'fontSize', 16)}px ${stringAttr(attrs, 'fontFamily', 'sans-serif')}`.trim()
    ctx.textBaseline = 'top'
    ctx.fillStyle = stringAttr(attrs, 'fill', '#000000')
    ctx.fillText(stringAttr(attrs, 'text'), 0, 0)
    ctx.restore()
    return
  }

  if (className === 'Image') {
    const src = stringAttr(attrs, 'src')
    if (src) {
      try {
        const img = await loadHtmlImage(src)
        ctx.drawImage(
          img,
          0,
          0,
          Math.max(1, numberAttr(attrs, 'width', img.width)),
          Math.max(1, numberAttr(attrs, 'height', img.height)),
        )
      } catch {}
    }
    ctx.restore()
    return
  }

  ctx.restore()
}

export async function renderThumbnailForFrame(
  gifStore: ReturnType<typeof useGifStore>,
  frame: GifFrame,
  globalCanvasJson: string,
  generation: number,
): Promise<void> {
  const base = document.createElement('canvas')
  base.width = frame.imageData.width
  base.height = frame.imageData.height
  const ctx = base.getContext('2d')!
  ctx.putImageData(frame.imageData, 0, 0)

  const serializedNodes = [
    ...parseSerializedChildren(frame.canvasJson),
    ...parseSerializedChildren(globalCanvasJson),
  ]

  for (const node of serializedNodes) {
    await drawSerializedNode(ctx, node)
    if (generation !== ks.thumbnailRefreshGeneration) return
  }

  if (generation !== ks.thumbnailRefreshGeneration) return

  const targetFrame = gifStore.frames.find((candidate) => candidate.id === frame.id)
  if (targetFrame) {
    targetFrame.thumbnailUrl = createThumbnailDataUrl(base)
  }
}

export function refreshAllFrameThumbnails(gifStore: ReturnType<typeof useGifStore>, globalCanvasJson: string) {
  const generation = ++ks.thumbnailRefreshGeneration
  for (const frame of gifStore.frames) {
    void renderThumbnailForFrame(gifStore, frame, globalCanvasJson, generation)
  }
}

export function updateStageThumbnail(gifStore: ReturnType<typeof useGifStore>, frameId: string) {
  if (!ks.stage) return
  const dataUrl = ks.stage.toDataURL()
  const maxWidth = 80
  const img = new Image()
  img.onload = () => {
    const scale = Math.min(1, maxWidth / img.width)
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const dst = document.createElement('canvas')
    dst.width = w
    dst.height = h
    dst.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const frame = gifStore.frames.find((f) => f.id === frameId)
    if (frame) frame.thumbnailUrl = dst.toDataURL('image/png')
  }
  img.src = dataUrl
}
