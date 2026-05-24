import { GIFEncoder } from './gif-format.js'
import { rgbaToIndexed } from './gif-palette.js'

function encodeFrames({ width, height, frames, repeat }) {
  const encoder = new GIFEncoder(width, height)
  encoder.repeat = repeat ?? -1
  encoder.writeHeader()
  encoder.writeLSD()
  if (encoder.repeat >= 0) encoder.writeNetscapeExt()

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const rgba = new Uint8Array(frame.rgba)
    const { indexedPixels, colorTab, transparentIndex } = rgbaToIndexed(rgba)
    encoder.writeGraphicCtrlExt(frame.delay, transparentIndex, 1)
    encoder.writeImageDesc(frame.left, frame.top, frame.width, frame.height, 7)
    encoder.writePalette(colorTab)
    encoder.writePixels(indexedPixels, frame.width, frame.height)
    self.postMessage({ type: 'progress', progress: (i + 1) / frames.length })
  }

  encoder.finish()
  const bytes = encoder.out.toUint8Array()
  self.postMessage({ type: 'finished', buffer: bytes.buffer }, [bytes.buffer])
}

self.onmessage = (event) => {
  try {
    encodeFrames(event.data)
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export { rgbaToIndexed }
