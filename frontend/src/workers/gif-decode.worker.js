import { parseGIF, decompressFrames } from 'gifuct-js'

function readLoopCount(gif) {
  const app = gif.frames.find((frame) => frame.application?.id === 'NETSCAPE2.0')
  const blocks = app?.application?.blocks
  if (!blocks || blocks.length < 3 || blocks[0] !== 1) return -1
  return blocks[1] | (blocks[2] << 8)
}

self.onmessage = async (e) => {
  const { buffer, filename } = e.data

  try {
    // Validate GIF magic bytes (GIF87a or GIF89a)
    const header = new Uint8Array(buffer, 0, 6)
    const sig = String.fromCharCode(header[0], header[1], header[2])
    const ver = String.fromCharCode(header[3], header[4], header[5])
    if (sig !== 'GIF' || (ver !== '87a' && ver !== '89a')) {
      self.postMessage({ type: 'error', message: 'Not a valid GIF file' })
      return
    }

    const gif = parseGIF(buffer)
    const width = gif.lsd.width
    const height = gif.lsd.height
    const repeat = readLoopCount(gif)

    // Send total before decompressFrames so UI can show the count during the slow sync phase
    self.postMessage({ type: 'total', total: gif.frames.length, width, height, filename, repeat })

    const frames = decompressFrames(gif, true)
    const composed = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      const { dims, patch, disposalType, delay } = frame

      for (let y = 0; y < dims.height; y++) {
        const dstY = dims.top + y
        if (dstY < 0 || dstY >= height) continue
        for (let x = 0; x < dims.width; x++) {
          const dstX = dims.left + x
          if (dstX < 0 || dstX >= width) continue
          const srcIdx = (y * dims.width + x) * 4
          const dstIdx = (dstY * width + dstX) * 4
          const a = patch[srcIdx + 3]
          if (a > 0) {
            composed[dstIdx] = patch[srcIdx]
            composed[dstIdx + 1] = patch[srcIdx + 1]
            composed[dstIdx + 2] = patch[srcIdx + 2]
            composed[dstIdx + 3] = a
          }
        }
      }

      const snapshot = new Uint8ClampedArray(composed)

      if (disposalType === 2) {
        for (let y = 0; y < dims.height; y++) {
          const dstY = dims.top + y
          if (dstY < 0 || dstY >= height) continue
          for (let x = 0; x < dims.width; x++) {
            const dstX = dims.left + x
            if (dstX < 0 || dstX >= width) continue
            const dstIdx = (dstY * width + dstX) * 4
            composed[dstIdx] = 0
            composed[dstIdx + 1] = 0
            composed[dstIdx + 2] = 0
            composed[dstIdx + 3] = 0
          }
        }
      }

      // Stream each frame immediately; transfer the buffer to avoid copying
      self.postMessage(
        { type: 'frame', imageDataArray: snapshot.buffer, width, height, duration: delay || 100, index: i },
        [snapshot.buffer],
      )
    }

    self.postMessage({ type: 'done' })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message })
  }
}

export { readLoopCount }
