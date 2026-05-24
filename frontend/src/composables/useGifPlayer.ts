import { ref } from 'vue'
import { useGifStore } from '@/stores/gifStore'

const isPlaying = ref(false)
let timeoutId: ReturnType<typeof setTimeout> | null = null

export function useGifPlayer() {
  const gifStore = useGifStore()

  function tick() {
    if (!isPlaying.value) return
    const frames = gifStore.frames
    if (frames.length < 2) {
      isPlaying.value = false
      return
    }
    const currentIdx = gifStore.activeFrameIndex
    const delay = frames[currentIdx]?.duration ?? 100
    const nextIdx = (currentIdx + 1) % frames.length
    timeoutId = setTimeout(() => {
      if (!isPlaying.value) return
      gifStore.setActiveFrame(frames[nextIdx].id)
      tick()
    }, delay)
  }

  function play() {
    if (isPlaying.value || gifStore.frames.length < 2) return
    isPlaying.value = true
    tick()
  }

  function pause() {
    isPlaying.value = false
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  function stop() {
    pause()
    const first = gifStore.frames[0]
    if (first) gifStore.setActiveFrame(first.id)
  }

  function toggle() {
    if (isPlaying.value) pause()
    else play()
  }

  return { isPlaying, play, pause, stop, toggle }
}
