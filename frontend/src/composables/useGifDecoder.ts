import { ref } from 'vue'
import { nanoid } from 'nanoid'
import { useGifStore } from '@/stores/gifStore'
import { useHistoryStore } from '@/stores/historyStore'
import { imageDataToDataUrl, imageDataToThumbnail } from '@/utils/imageData'
import type { GifFrame } from '@/types'
import GifDecodeWorker from '@/workers/gif-decode.worker.js?worker'

const decoding = ref(false)
const progress = ref(0)
const progressTotal = ref(0)
const phase = ref<'idle' | 'reading' | 'decompressing' | 'processing'>('idle')
const error = ref<string | null>(null)

export function useGifDecoder() {
  const gifStore = useGifStore()
  const historyStore = useHistoryStore()

  function decode(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      decoding.value = true
      progress.value = 0
      progressTotal.value = 0
      phase.value = 'reading'
      error.value = null

      const worker = new GifDecodeWorker()

      const reader = new FileReader()
      reader.onload = (e) => {
        const buffer = e.target!.result as ArrayBuffer
        worker.postMessage({ buffer, filename: file.name }, [buffer])
      }

      worker.onmessage = (e) => {
        const msg = e.data

        if (msg.type === 'total') {
          progressTotal.value = msg.total
          phase.value = 'decompressing'
          historyStore.clear()
          gifStore.reset()
          gifStore.initProject(msg.filename, msg.width, msg.height, file, msg.repeat ?? -1)
        } else if (msg.type === 'frame') {
          if (phase.value !== 'processing') phase.value = 'processing'
          progress.value = msg.index + 1

          const imageData = new ImageData(
            new Uint8ClampedArray(msg.imageDataArray),
            msg.width,
            msg.height,
          )
          const frame: GifFrame = {
            id: nanoid(),
            imageData,
            dataUrl: imageDataToDataUrl(imageData),
            thumbnailUrl: imageDataToThumbnail(imageData),
            duration: msg.duration,
            canvasJson: '',
          }
          gifStore.addFrame(frame)
        } else if (msg.type === 'done') {
          worker.terminate()
          decoding.value = false
          phase.value = 'idle'
          resolve()
        } else if (msg.type === 'error') {
          error.value = msg.message
          worker.terminate()
          decoding.value = false
          phase.value = 'idle'
          reject(new Error(msg.message))
        }
      }

      worker.onerror = (e) => {
        error.value = e.message
        worker.terminate()
        decoding.value = false
        phase.value = 'idle'
        reject(e)
      }

      reader.readAsArrayBuffer(file)
    })
  }

  return { decode, decoding, progress, progressTotal, phase, error }
}
