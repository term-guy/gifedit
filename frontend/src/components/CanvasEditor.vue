<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'
import { useKonvaEditor } from '@/composables/useKonvaEditor'
import { useGifPlayer } from '@/composables/useGifPlayer'
import { stickers, stickerToDataUrl } from '@/assets/stickers/index'

const gifStore = useGifStore()
const editorStore = useEditorStore()
const konva = useKonvaEditor()
const player = useGifPlayer()

const canvasAreaRef = ref<HTMLDivElement | null>(null)
const konvaHostRef = ref<HTMLDivElement | null>(null)
const initialized = ref(false)

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const textInputValue = ref('')

function autoResizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.width = '1px'
  el.style.width = el.scrollWidth + 'px'
}

watch(
  () => konva.textPlacementPos.value,
  (pos) => {
    if (pos) nextTick(() => {
      textareaRef.value?.focus()
      autoResizeTextarea()
    })
  },
)

function commitText() {
  const pos = konva.textPlacementPos.value
  if (!pos) return
  const text = textInputValue.value.trim()
  textInputValue.value = ''
  if (text) konva.addText(text, pos.x, pos.y)
  else konva.cancelTextPlacement()
}

function cancelText() {
  textInputValue.value = ''
  konva.cancelTextPlacement()
}

function onTextBlur() {
  if (!konva.textPlacementPos.value) return
  commitText()
}

const magnifierCanvasRef = ref<HTMLCanvasElement | null>(null)
const cursorScreenPos = ref({ x: 0, y: 0 })
const isOverCanvas = ref(false)
const eyedropColor = ref('#000000')

const MAGNIFIER_REGION = 15  // canvas pixels shown in magnifier
const MAGNIFIER_DISPLAY = 120  // display size in px
const MAGNIFIER_ZOOM = MAGNIFIER_DISPLAY / MAGNIFIER_REGION

const showMagnifier = computed(() =>
  !!editorStore.pendingColorPick && !!project.value && isOverCanvas.value,
)

const magnifierStyle = computed(() => {
  const x = cursorScreenPos.value.x
  const y = cursorScreenPos.value.y
  const W = MAGNIFIER_DISPLAY + 4   // box width  (border 2px each side)
  const H = MAGNIFIER_DISPLAY + 28  // box height (canvas + swatch + padding)
  const areaEl = canvasAreaRef.value
  const areaW = areaEl ? areaEl.clientWidth : 9999
  const areaH = areaEl ? areaEl.clientHeight : 9999
  const offsetX = x + 20 + W > areaW ? x - W - 20 : x + 20
  const offsetY = y + 20 + H > areaH ? y - H - 20 : y + 20
  return { left: `${offsetX}px`, top: `${offsetY}px` }
})

function onMouseMoveArea(e: MouseEvent) {
  if (!editorStore.pendingColorPick) return
  isOverCanvas.value = true
  const rect = canvasAreaRef.value!.getBoundingClientRect()
  cursorScreenPos.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function onMouseLeaveArea() {
  isOverCanvas.value = false
}

function onScrollAreaMouseDown(e: MouseEvent) {
  if (!konvaHostRef.value?.contains(e.target as Node)) {
    konva.clearSelection()
  }
}

watch(konva.eyedropPointerPos, (pos) => {
  if (!pos || !magnifierCanvasRef.value) return
  const composited = konva.getCompositedCanvas()
  if (!composited) return

  const D = MAGNIFIER_DISPLAY
  const R = MAGNIFIER_REGION
  const Z = MAGNIFIER_ZOOM

  const canvas = magnifierCanvasRef.value
  if (canvas.width !== D) canvas.width = D
  if (canvas.height !== D) canvas.height = D
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  ctx.drawImage(
    composited,
    Math.floor(pos.x) - Math.floor(R / 2),
    Math.floor(pos.y) - Math.floor(R / 2),
    R, R,
    0, 0,
    D, D,
  )

  // Center cell highlight — exact pixel being sampled
  const cellOrigin = Math.floor((D - Z) / 2)
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'
  ctx.lineWidth = 2
  ctx.strokeRect(cellOrigin - 1, cellOrigin - 1, Z + 2, Z + 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 1
  ctx.strokeRect(cellOrigin, cellOrigin, Z, Z)

  // Thin crosshair lines from center cell to edges
  const mid = D / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.lineWidth = 0.75
  ctx.beginPath()
  ctx.moveTo(mid, 0);          ctx.lineTo(mid, cellOrigin)
  ctx.moveTo(mid, cellOrigin + Z); ctx.lineTo(mid, D)
  ctx.moveTo(0, mid);          ctx.lineTo(cellOrigin, mid)
  ctx.moveTo(cellOrigin + Z, mid); ctx.lineTo(D, mid)
  ctx.stroke()

  // Update color swatch
  const px = composited.getContext('2d')!.getImageData(Math.floor(pos.x), Math.floor(pos.y), 1, 1).data
  eyedropColor.value = `#${px[0].toString(16).padStart(2, '0')}${px[1].toString(16).padStart(2, '0')}${px[2].toString(16).padStart(2, '0')}`
})

const project = computed(() => gifStore.project)

watch(
  [() => gifStore.activeFrameIndex, () => gifStore.textAnimations],
  () => {
    const frameIndex = gifStore.activeFrameIndex
    if (frameIndex < 0) return
    konva.syncAnimatedTextVisibility(frameIndex, gifStore.textAnimations)
    konva.renderAnimationNodes(frameIndex)
  },
  { deep: true, immediate: true },
)

function initKonva() {
  if (!project.value || initialized.value || !konvaHostRef.value) return
  const { width, height } = project.value
  konva.init('konva-stage', width, height)
  initialized.value = true
}

watch(
  () => gifStore.activeFrame?.id,
  (frameId) => {
    if (!frameId) return
    if (!initialized.value) {
      setTimeout(() => {
        initKonva()
        konva.loadFrame(frameId)
        if (gifStore.activeFrameIndex >= 0) {
          konva.syncAnimatedTextVisibility(gifStore.activeFrameIndex, gifStore.textAnimations)
          konva.renderAnimationNodes(gifStore.activeFrameIndex)
        }
      }, 20)
    } else {
      konva.loadFrame(frameId)
      if (gifStore.activeFrameIndex >= 0) {
        konva.syncAnimatedTextVisibility(gifStore.activeFrameIndex, gifStore.textAnimations)
        konva.renderAnimationNodes(gifStore.activeFrameIndex)
      }
    }
  },
  { immediate: true },
)

watch(
  () => editorStore.zoom,
  (z) => konva.setZoom(z),
)

watch(
  () => project.value,
  (p) => {
    if (!p) {
      konva.destroy()
      initialized.value = false
    }
  },
)

function onWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  editorStore.setZoom(editorStore.zoom + delta)
}

function handleKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement).tagName
  if (e.key === ' ' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
    e.preventDefault()
    player.toggle()
    return
  }
  if (tag === 'TEXTAREA') return
  if (editorStore.selectedFrameIds.length > 1 && (e.key === 'Delete' || e.key === 'Backspace')) {
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    konva.deleteSelected()
  }
}

const zoomPercent = computed(() => Math.round(editorStore.zoom * 100))

const fillCursor = computed(() => {
  const color = encodeURIComponent(editorStore.fillColor)
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C9 6 5 11 5 15a7 7 0 0 0 14 0C19 11 15 6 12 2z' fill='${color}' stroke='%23111' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E") 12 2, crosshair`
})

// Dynamic canvas wrapper style — computed separately so we never put reactive bindings
// on the same element that Konva owns
const wrapperStyle = computed(() => {
  if (!project.value) return {}
  const tool = editorStore.activeTool
  let cursor = 'default'
  if (editorStore.pendingColorPick) cursor = 'crosshair'
  else if (tool === 'text') cursor = 'text'
  else if (tool === 'fill') cursor = fillCursor.value
  else if (['shape', 'draw', 'erase'].includes(tool)) cursor = 'crosshair'
  return {
    width: project.value.width + 'px',
    height: project.value.height + 'px',
    cursor,
  }
})

function onStickerDrop(e: DragEvent) {
  if (!gifStore.project || !konvaHostRef.value) return
  const stickerId = e.dataTransfer?.getData('application/x-gif-sticker')
  if (!stickerId) return
  const sticker = stickers.find((s) => s.id === stickerId)
  if (!sticker) return

  const rect = konvaHostRef.value.getBoundingClientRect()
  const zoom = editorStore.zoom
  const canvasX = (e.clientX - rect.left) / zoom
  const canvasY = (e.clientY - rect.top) / zoom

  const url = stickerToDataUrl(sticker.svg)
  konva.addSticker(url, canvasX, canvasY)
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  konva.destroy()
  initialized.value = false
})
</script>

<template>
  <div class="canvas-area" ref="canvasAreaRef" @wheel.prevent="onWheel" @mousemove="onMouseMoveArea" @mouseleave="onMouseLeaveArea">
    <div class="canvas-scroll-area" @mousedown="onScrollAreaMouseDown">
      <div
        v-if="project"
        class="stage-scaler"
        :style="{ transform: `scale(${editorStore.zoom})`, transformOrigin: 'top left' }"
      >
        <!-- Konva host: never re-rendered after mount by using a stable wrapper -->
        <div
          class="konva-host"
          :style="wrapperStyle"
          ref="konvaHostRef"
          @dragover.prevent
          @drop.prevent="onStickerDrop"
        >
          <div id="konva-stage" style="width:100%;height:100%" />
        </div>
        <textarea
          v-if="konva.textPlacementPos.value"
          ref="textareaRef"
          v-model="textInputValue"
          class="canvas-text-input"
          rows="1"
          :style="{
            left: konva.textPlacementPos.value.x + 'px',
            top: konva.textPlacementPos.value.y + 'px',
            fontSize: editorStore.textConfig.fontSize + 'px',
            fontFamily: editorStore.textConfig.fontFamily,
            color: editorStore.textConfig.color,
            fontWeight: editorStore.textConfig.bold ? 'bold' : 'normal',
            fontStyle: editorStore.textConfig.italic ? 'italic' : 'normal',
          }"
          @keydown.enter.exact.prevent="commitText"
          @keydown.escape="cancelText"
          @blur="onTextBlur"
          @input="autoResizeTextarea"
        />
      </div>

      <div v-if="!project" class="no-project" />
    </div>

    <div v-if="konva.filling.value" class="filling-overlay">Filling…</div>

    <div v-if="showMagnifier" class="eyedrop-magnifier" :style="magnifierStyle">
      <canvas ref="magnifierCanvasRef" :width="120" :height="120" class="magnifier-canvas" />
      <div class="magnifier-swatch">
        <span class="swatch-color" :style="{ background: eyedropColor }" />
        <span class="swatch-hex">{{ eyedropColor }}</span>
      </div>
    </div>

    <div class="canvas-controls">
      <button class="zoom-btn" @click="editorStore.setZoom(editorStore.zoom - 0.1)">−</button>
      <span class="zoom-label">{{ zoomPercent }}%</span>
      <button class="zoom-btn" @click="editorStore.setZoom(editorStore.zoom + 0.1)">+</button>
      <button class="zoom-btn" @click="editorStore.setZoom(1)" title="Reset zoom">↺</button>
    </div>


  </div>
</template>

<style scoped>
.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background: var(--bg);
}

.canvas-scroll-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  background-image:
    linear-gradient(45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(-45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1c1c1c 75%),
    linear-gradient(-45deg, transparent 75%, #1c1c1c 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  padding: 40px;
}

.stage-scaler {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  position: relative;
}

.konva-host {
  box-shadow: 0 0 0 1px var(--border), 0 8px 32px rgba(0,0,0,0.5);
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
}

.filling-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 15, 15, 0.75);
  color: var(--accent);
  padding: 10px 20px;
  border-radius: var(--radius);
  font-size: 13px;
  pointer-events: none;
}

.no-project {
  width: 1px;
  height: 1px;
}

.canvas-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px 8px;
}

.zoom-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--text-dim);
  border-radius: 4px;
  font-size: 16px;
  transition: all 0.12s;
}

.zoom-btn:hover { background: var(--border); color: var(--text); }

.zoom-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  min-width: 38px;
  text-align: center;
}

.canvas-text-input {
  position: absolute;
  background: transparent;
  border: 1px dashed rgba(245, 166, 35, 0.7);
  outline: none;
  resize: none;
  overflow: hidden;
  padding: 0;
  margin: 0;
  width: 1px;
  line-height: 1.2;
  white-space: pre;
  word-break: keep-all;
  z-index: 10;
  border-radius: 2px;
}

.eyedrop-magnifier {
  position: absolute;
  pointer-events: none;
  z-index: 200;
  background: var(--panel);
  border: 2px solid var(--border-light);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.magnifier-canvas {
  display: block;
  image-rendering: pixelated;
  width: 120px;
  height: 120px;
}

.magnifier-swatch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}

.swatch-color {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.swatch-hex {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text);
  letter-spacing: 0.03em;
}

</style>
