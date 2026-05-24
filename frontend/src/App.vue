<script setup lang="ts">
import { computed, onMounted, onUnmounted, nextTick, ref } from 'vue'
import AppTopBar from '@/components/AppTopBar.vue'
import LeftToolPanel from '@/components/LeftToolPanel.vue'
import CanvasEditor from '@/components/CanvasEditor.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import FrameTimeline from '@/components/FrameTimeline.vue'
import StickerPicker from '@/components/StickerPicker.vue'
import TextAnimationPanel from '@/components/TextAnimationPanel.vue'
import ExportModal from '@/components/ExportModal.vue'
import { useEditorStore } from '@/stores/editorStore'
import { useGifStore } from '@/stores/gifStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useKonvaEditor } from '@/composables/useKonvaEditor'
import { useGifDecoder } from '@/composables/useGifDecoder'
import { useFrameOps } from '@/composables/useFrameOps'
import { useProjectPersistence, restoring } from '@/composables/useProjectPersistence'

const editorStore = useEditorStore()
const gifStore = useGifStore()
const historyStore = useHistoryStore()
const konva = useKonvaEditor()
const { decode } = useGifDecoder()
const frameOps = useFrameOps()
const persistence = useProjectPersistence()
const isDraggingFile = ref(false)
const dragDepth = ref(0)
const showDeleteFramesModal = ref(false)
const selectedFrameCount = computed(() => editorStore.selectedFrameIds.length)

async function handleFile(file: File) {
  if (!file.type.includes('gif') && !file.name.toLowerCase().endsWith('.gif')) {
    alert('Please upload a GIF file.')
    return
  }
  await decode(file)
  await persistence.saveNow()
}

async function undo() {
  if (!gifStore.project) return
  konva.flushSerialize()
  const snapshot = historyStore.undo(gifStore.project, gifStore.textAnimations)
  if (!snapshot) return
  gifStore.restoreSnapshot(snapshot)
  await nextTick()
  konva.forceReloadFrame()
}

async function redo() {
  if (!gifStore.project) return
  konva.flushSerialize()
  const snapshot = historyStore.redo(gifStore.project, gifStore.textAnimations)
  if (!snapshot) return
  gifStore.restoreSnapshot(snapshot)
  await nextTick()
  konva.forceReloadFrame()
}

function onKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
  if (e.key === 'Escape' && showDeleteFramesModal.value) {
    e.preventDefault()
    showDeleteFramesModal.value = false
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFrameCount.value > 1) {
    e.preventDefault()
    showDeleteFramesModal.value = true
    return
  }
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !konva.hasSelection.value && !e.ctrlKey && !e.metaKey) {
    const frames = gifStore.frames
    if (!frames.length) return
    const idx = gifStore.activeFrameIndex
    const next = e.key === 'ArrowLeft' ? idx - 1 : idx + 1
    if (next >= 0 && next < frames.length) {
      e.preventDefault()
      gifStore.setActiveFrame(frames[next].id)
      editorStore.selectSingleFrame(frames[next].id)
    }
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
  }
}

function confirmDeleteSelectedFrames() {
  frameOps.deleteSelected()
  showDeleteFramesModal.value = false
}

function onDragEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  dragDepth.value += 1
  isDraggingFile.value = true
}

function onDragOver(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  isDraggingFile.value = true
}

function onDragLeave(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (dragDepth.value === 0) isDraggingFile.value = false
}

function onDrop(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  e.preventDefault()
  dragDepth.value = 0
  isDraggingFile.value = false
  const file = e.dataTransfer.files?.[0]
  if (file) void handleFile(file)
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  await persistence.restore()
  persistence.startWatching()
})
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div
    class="app-shell"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <AppTopBar />
    <div class="workspace">
      <LeftToolPanel />
      <div class="center-col">
        <div class="canvas-wrap">
          <CanvasEditor />
          <TextAnimationPanel v-if="editorStore.showTextPanel" />
        </div>
        <PropertiesPanel />
      </div>
      <StickerPicker v-if="editorStore.showStickerPicker" />
    </div>
    <FrameTimeline v-if="gifStore.project" />
    <div v-if="(!gifStore.project && !restoring) || isDraggingFile" class="drop-hint" :class="{ active: isDraggingFile }">
      <div class="drop-hint-inner">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#f5a623" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V15M17 8L12 3M12 3L7 8M12 3V15"/>
        </svg>
        <p v-if="isDraggingFile">Drop GIF to open</p>
        <p v-else>Drop a GIF here or click <strong>Upload</strong> to get started</p>
      </div>
    </div>
    <div
      v-if="showDeleteFramesModal"
      class="modal-backdrop"
      @click.self="showDeleteFramesModal = false"
    >
      <div class="confirm-modal">
        <h3>Delete selected frames?</h3>
        <p>
          This will remove {{ selectedFrameCount }} selected frames from the GIF.
        </p>
        <div class="modal-actions">
          <button class="btn-ghost modal-btn" @click="showDeleteFramesModal = false">Cancel</button>
          <button class="btn-danger modal-btn" @click="confirmDeleteSelectedFrames">Delete frames</button>
        </div>
      </div>
    </div>
    <ExportModal />
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&family=Sora:wght@400;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0f0f0f;
  --panel: #1a1a1a;
  --panel-alt: #212121;
  --border: #2a2a2a;
  --border-light: #333;
  --accent: #336699;
  --accent-dim: rgba(51, 102, 153, 0.15);
  --text: #e8e8e8;
  --text-dim: #888;
  --text-muted: #555;
  --danger: #e05252;
  --success: #52d68a;
  --font-mono: 'JetBrains Mono', monospace;
  --font-ui: 'DM Sans', 'Sora', sans-serif;
  --radius: 6px;
  --radius-lg: 10px;
}

html, body { height: 100%; overflow: hidden; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

#app { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
  min-height: 0;
}

.center-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.canvas-wrap {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.drop-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 1;
}

.drop-hint.active {
  background: rgba(245, 166, 35, 0.08);
}

.drop-hint-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text-dim);
  font-size: 15px;
}

.drop-hint.active .drop-hint-inner {
  color: var(--accent);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.confirm-modal {
  width: min(420px, 100%);
  background: var(--panel);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.confirm-modal h3 {
  font-size: 18px;
  color: var(--text);
}

.confirm-modal p {
  margin-top: 8px;
  color: var(--text-dim);
  line-height: 1.4;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.modal-btn {
  padding: 8px 14px;
  border-radius: var(--radius);
  font-size: 13px;
}

.btn-ghost {
  background: transparent;
  color: var(--text-dim);
  border: 1px solid var(--border);
}

.btn-danger {
  background: var(--danger);
  color: #fff;
}

.drop-hint-inner strong { color: var(--accent); }

button {
  font-family: var(--font-ui);
  cursor: pointer;
  border: none;
  outline: none;
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

input, select, textarea {
  font-family: var(--font-ui);
  background: var(--panel-alt);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 10px;
  font-size: 13px;
}

input:focus, select:focus { outline: 1px solid var(--accent); border-color: var(--accent); }
</style>
