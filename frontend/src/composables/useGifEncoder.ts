import { ref } from 'vue'
import { useGifStore } from '@/stores/gifStore'
import { useTextAnimations } from '@/composables/useTextAnimations'
import { useKonvaEditor } from '@/composables/useKonvaEditor'
import { flattenCanvasToImageData } from '@/utils/imageData'
import GifEncodeWorker from '@/workers/gif-encode.worker.js?worker'

const encoding = ref(false)
const progress = ref(0)
const estimatedSize = ref(0)
const error = ref<string | null>(null)
const phase = ref('Preparing frames…')

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

interface EncodedPatchFrame {
  left: number
  top: number
  width: number
  height: number
  delay: number
  rgba: ArrayBuffer
}

function appendFullFrame(imageData: ImageData, delay: number): EncodedPatchFrame {
  const rgba = new Uint8Array(imageData.data)
  return {
    left: 0,
    top: 0,
    width: imageData.width,
    height: imageData.height,
    delay,
    rgba: rgba.buffer,
  }
}

function diffToPatch(previous: ImageData, current: ImageData, delay: number): EncodedPatchFrame | null {
  const prev = previous.data
  const next = current.data
  const width = current.width
  const height = current.height
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = ((y * width) + x) * 4
      if (
        prev[idx] !== next[idx] ||
        prev[idx + 1] !== next[idx + 1] ||
        prev[idx + 2] !== next[idx + 2] ||
        prev[idx + 3] !== next[idx + 3]
      ) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX === -1) return null

  const patchWidth = maxX - minX + 1
  const patchHeight = maxY - minY + 1
  const patch = new Uint8Array(patchWidth * patchHeight * 4)

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const srcIdx = ((y * width) + x) * 4
      const dstIdx = (((y - minY) * patchWidth) + (x - minX)) * 4
      if (
        prev[srcIdx] === next[srcIdx] &&
        prev[srcIdx + 1] === next[srcIdx + 1] &&
        prev[srcIdx + 2] === next[srcIdx + 2] &&
        prev[srcIdx + 3] === next[srcIdx + 3]
      ) {
        patch[dstIdx + 3] = 0
        continue
      }
      patch[dstIdx] = next[srcIdx]
      patch[dstIdx + 1] = next[srcIdx + 1]
      patch[dstIdx + 2] = next[srcIdx + 2]
      patch[dstIdx + 3] = next[srcIdx + 3]
    }
  }

  return {
    left: minX,
    top: minY,
    width: patchWidth,
    height: patchHeight,
    delay,
    rgba: patch.buffer,
  }
}

function buildPatchFrames(flattenedFrames: ImageData[], durations: number[]): EncodedPatchFrame[] {
  const output: EncodedPatchFrame[] = []

  for (let i = 0; i < flattenedFrames.length; i++) {
    const current = flattenedFrames[i]
    if (i === 0) {
      output.push(appendFullFrame(current, durations[i]))
      continue
    }

    const patch = diffToPatch(flattenedFrames[i - 1], current, durations[i])
    if (!patch) {
      output[output.length - 1].delay += durations[i]
      continue
    }
    output.push(patch)
  }

  return output
}

export function useGifEncoder() {
  const gifStore = useGifStore()
  const { bakeAnimations } = useTextAnimations()
  const konva = useKonvaEditor()

  async function encode() {
    if (!gifStore.project) return
    konva.flushSerialize()
    const { frames, width, height, filename, repeat } = gifStore.project
    if (frames.length === 0) return

    encoding.value = true
    progress.value = 0
    estimatedSize.value = 0
    error.value = null
    phase.value = 'Preparing frames…'

    const bakeWeight = frames.length
    const flattenWeight = frames.length
    const encodeWeight = frames.length
    const totalWeight = bakeWeight + flattenWeight + encodeWeight

    let bakedCompleted = 0
    let flattenedCompleted = 0
    let encodeFraction = 0

    function setWeightedProgress() {
      const completedWeight =
        bakedCompleted +
        flattenedCompleted +
        Math.max(0, Math.min(1, encodeFraction)) * encodeWeight
      progress.value = clampProgress((completedWeight / totalWeight) * 100)
    }

    const bakedDataUrls = await bakeAnimations(
      frames,
      width,
      height,
      (completed) => {
        bakedCompleted = completed
        phase.value = `Preparing frames ${completed}/${frames.length}…`
        setWeightedProgress()
      },
    )
    const flattenedFrames: ImageData[] = []

    for (let i = 0; i < frames.length; i++) {
      const flatImageData = await flattenCanvasToImageData(
        bakedDataUrls[i],
        null,
        width,
        height,
      )
      flattenedFrames.push(flatImageData)

      flattenedCompleted = i + 1
      phase.value = `Queueing frames ${flattenedCompleted}/${frames.length}…`
      setWeightedProgress()
    }

    const patchFrames = buildPatchFrames(flattenedFrames, frames.map((frame) => frame.duration))
    const worker = new GifEncodeWorker()

    return new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data
        if (msg.type === 'progress') {
          encodeFraction = msg.progress
          phase.value = `Encoding GIF ${Math.max(1, Math.round(msg.progress * patchFrames.length))}/${patchFrames.length}…`
          setWeightedProgress()
          return
        }

        if (msg.type === 'finished') {
          const blob = new Blob([msg.buffer], { type: 'image/gif' })
          worker.terminate()
          encoding.value = false
          progress.value = 100
          phase.value = 'Finalizing download…'
          encodeFraction = 1
          setWeightedProgress()
          estimatedSize.value = blob.size
          downloadBlob(blob, `edited-${filename}`)
          resolve()
          return
        }

        if (msg.type === 'error') {
          worker.terminate()
          error.value = msg.message
          phase.value = 'Export failed'
          encoding.value = false
          reject(new Error(msg.message))
        }
      }

      worker.onerror = (event) => {
        worker.terminate()
        error.value = event.message
        phase.value = 'Export failed'
        encoding.value = false
        reject(event)
      }

      worker.postMessage({
        width,
        height,
        repeat,
        frames: patchFrames,
      }, patchFrames.map((frame) => frame.rgba))
    })
  }

  return { encode, encoding, progress, estimatedSize, error, phase }
}
