<script setup lang="ts">
import { useEditorStore } from '@/stores/editorStore'
import { useKonvaEditor } from '@/composables/useKonvaEditor'
import { stickers, stickerToDataUrl } from '@/assets/stickers/index'
import { useGifStore } from '@/stores/gifStore'

const editorStore = useEditorStore()
const konva = useKonvaEditor()
const gifStore = useGifStore()

function addSticker(svg: string) {
  if (!gifStore.project) return
  const url = stickerToDataUrl(svg)
  konva.addSticker(url)
}

function onDragStart(e: DragEvent, s: typeof stickers[number]) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('application/x-gif-sticker', s.id)
  // Ghost image: a temporary span rendered off-screen
  const ghost = document.createElement('span')
  ghost.textContent = s.emoji
  ghost.style.cssText = 'position:fixed;top:-100px;font-size:40px'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, 20, 20)
  requestAnimationFrame(() => document.body.removeChild(ghost))
}
</script>

<template>
  <div class="sticker-panel">
    <div class="sticker-header">
      <span>Stickers</span>
      <button class="close-btn" @click="editorStore.showStickerPicker = false">✕</button>
    </div>
    <div class="sticker-grid">
      <button
        v-for="s in stickers"
        :key="s.id"
        class="sticker-btn"
        :title="s.id"
        draggable="true"
        @click="addSticker(s.svg)"
        @dragstart="onDragStart($event, s)"
      >
        {{ s.emoji }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sticker-panel {
  width: 200px;
  background: var(--panel);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
}

.sticker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
}

.close-btn {
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 3px;
}

.close-btn:hover { background: var(--panel-alt); color: var(--text); }

.sticker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
  align-content: start;
  gap: 4px;
  padding: 10px;
  overflow-x: hidden;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.sticker-btn {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: transparent;
  border-radius: var(--radius);
  transition: all 0.12s;
  border: 1px solid transparent;
}

.sticker-btn:hover {
  background: var(--panel-alt);
  border-color: var(--border);
  transform: scale(1.1);
}
</style>
