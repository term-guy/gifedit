export function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export function imageDataToThumbnail(imageData: ImageData, maxWidth = 80): string {
  const scale = Math.min(1, maxWidth / imageData.width)
  const w = Math.round(imageData.width * scale)
  const h = Math.round(imageData.height * scale)
  const src = document.createElement('canvas')
  src.width = imageData.width
  src.height = imageData.height
  src.getContext('2d')!.putImageData(imageData, 0, 0)
  const dst = document.createElement('canvas')
  dst.width = w
  dst.height = h
  dst.getContext('2d')!.drawImage(src, 0, 0, w, h)
  return dst.toDataURL('image/png')
}

export function dataUrlToImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, img.width, img.height))
    }
    img.src = dataUrl
  })
}

export function flattenCanvasToImageData(
  baseDataUrl: string,
  konvaDataUrl: string | null,
  width: number,
  height: number,
): Promise<ImageData> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const baseImg = new Image()
    baseImg.onload = () => {
      ctx.drawImage(baseImg, 0, 0)
      if (!konvaDataUrl) {
        resolve(ctx.getImageData(0, 0, width, height))
        return
      }
      const overlayImg = new Image()
      overlayImg.onload = () => {
        ctx.drawImage(overlayImg, 0, 0)
        resolve(ctx.getImageData(0, 0, width, height))
      }
      overlayImg.src = konvaDataUrl
    }
    baseImg.src = baseDataUrl
  })
}
