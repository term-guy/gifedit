<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'
import { useFrameOps } from '@/composables/useFrameOps'
import type { GifFrame } from '@/types'
import { GIF_RELIABLE_MIN_DELAY_MS, GIF_DELAY_STEP_MS } from '@/utils/gifTiming'

const props = defineProps<{ frame: GifFrame; index: number }>()

const gifStore = useGifStore()
const editorStore = useEditorStore()
const frameOps = useFrameOps()

const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuRef = ref<HTMLElement | null>(null)

const isActive = computed(() => gifStore.project?.activeFrameId === props.frame.id)
const isSelected = computed(() => editorStore.selectedFrameIds.includes(props.frame.id))
const isMultiSelect = computed(() => editorStore.selectedFrameIds.length > 1)

function select(e: MouseEvent) {
  gifStore.setActiveFrame(props.frame.id)

  if (e.shiftKey) {
    const anchorId = editorStore.frameSelectionAnchorId ?? gifStore.project?.activeFrameId ?? props.frame.id
    const startIndex = gifStore.frames.findIndex((frame) => frame.id === anchorId)
    const endIndex = gifStore.frames.findIndex((frame) => frame.id === props.frame.id)

    if (startIndex === -1 || endIndex === -1) {
      editorStore.selectSingleFrame(props.frame.id)
      return
    }

    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    const rangeIds = gifStore.frames.slice(from, to + 1).map((frame) => frame.id)
    editorStore.setFrameSelection(rangeIds, anchorId)
    if (rangeIds.length > 1) editorStore.setTool('select')
    return
  }

  if (e.metaKey || e.ctrlKey) {
    editorStore.toggleFrameSelection(props.frame.id)
    if (editorStore.selectedFrameIds.length > 1) editorStore.setTool('select')
    return
  }

  editorStore.selectSingleFrame(props.frame.id)
}

function openMenu(e: MouseEvent) {
  e.preventDefault()
  menuX.value = e.clientX
  menuY.value = e.clientY
  showMenu.value = true
  nextTick(() => {
    if (!menuRef.value) return
    const { offsetHeight: h, offsetWidth: w } = menuRef.value
    if (menuY.value + h > window.innerHeight) menuY.value -= h
    if (menuX.value + w > window.innerWidth) menuX.value -= w
  })
}

function duplicate() {
  gifStore.duplicateFrame(props.frame.id)
  showMenu.value = false
}

function remove() {
  if (gifStore.frames.length <= 1) {
    alert('Cannot delete the last frame.')
    return
  }
  gifStore.deleteFrame(props.frame.id)
  showMenu.value = false
}

function selectAll() {
  editorStore.setFrameSelection(gifStore.frames.map((f) => f.id))
  editorStore.setTool('select')
}

function onDurationChange(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value)
  if (isNaN(val)) return

  if (isSelected.value && isMultiSelect.value) {
    frameOps.setBulkDuration(val)
    return
  }

  gifStore.updateFrameDuration(props.frame.id, val)
}
</script>

<template>
  <div
    class="thumb-card"
    :class="{ active: isActive, selected: isSelected }"
    @click="select"
    @contextmenu.prevent="openMenu"
  >
    <div class="thumb-header">
      <span class="frame-num">#{{ index + 1 }}</span>
    </div>

    <div class="thumb-img-wrap">
      <img :src="frame.thumbnailUrl" class="thumb-img" alt="" loading="lazy" />
    </div>

    <div class="thumb-footer">
      <input
        type="number"
        :value="frame.duration"
        min="0"
        :placeholder="String(GIF_RELIABLE_MIN_DELAY_MS)"
        :step="GIF_DELAY_STEP_MS"
        class="dur-input"
        @change="onDurationChange"
        @click.stop
      />
      <span class="dur-unit">ms</span>
    </div>

    <!-- Selection box indicator -->
    <div v-if="isSelected" class="sel-box">
      <svg class="sel-check" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="6" fill="var(--accent)"/>
        <path d="M3 6l2 2 4-4" stroke="#0f0f0f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="showMenu"
        ref="menuRef"
        class="ctx-menu"
        :style="{ left: menuX + 'px', top: menuY + 'px' }"
        @click.stop
      >
        <template v-if="isSelected && isMultiSelect">
          <button @click="frameOps.duplicateSelected(); showMenu = false">Duplicate selected</button>
          <button class="danger" @click="frameOps.deleteSelected(); showMenu = false">Delete selected</button>
          <button @click="editorStore.clearFrameSelection(); showMenu = false">Deselect all</button>
        </template>
        <template v-else>
          <button @click="duplicate">Duplicate</button>
          <button class="danger" @click="remove">Delete</button>
          <button @click="selectAll(); showMenu = false">Select all</button>
        </template>
        <button @click="showMenu = false">Cancel</button>
      </div>
      <div v-if="showMenu" class="ctx-backdrop" @click="showMenu = false" />
    </Teleport>
  </div>
</template>

<style scoped>
.thumb-card {
  display: flex;
  flex-direction: column;
  width: 88px;
  flex-shrink: 0;
  border: 2px solid transparent;
  border-radius: var(--radius);
  overflow: visible;
  cursor: pointer;
  transition: border-color 0.12s;
  position: relative;
  background: var(--panel-alt);
}

.thumb-card:hover { border-color: var(--border-light); }
.thumb-card.active { border-color: var(--accent); }
.thumb-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), inset 0 0 0 1px rgba(245, 166, 35, 0.2);
}

.thumb-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px 6px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px) calc(var(--radius) - 2px) 0 0;
}

.frame-num {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1;
}

.thumb-img-wrap {
  width: 100%;
  height: 52px;
  background: repeating-conic-gradient(#222 0% 25%, #1a1a1a 0% 50%) 0 0 / 8px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.thumb-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}

.thumb-footer {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px 5px;
  background: var(--panel);
  border-top: 1px solid var(--border);
}

.dur-input {
  flex: 1;
  min-width: 0;
  padding: 2px 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  text-align: right;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text);
}

.dur-unit {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-muted);
}

.sel-box {
  position: absolute;
  inset: -2px;
  border: 2px solid var(--accent);
  border-radius: var(--radius);
  pointer-events: none;
  z-index: 10;
}

.sel-check {
  position: absolute;
  top: -6px;
  right: -6px;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
}

.ctx-menu {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100;
  background: var(--panel);
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  min-width: 120px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  overflow: hidden;
}

.ctx-menu button {
  padding: 9px 14px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  text-align: left;
  border-radius: 0;
  border-bottom: 1px solid var(--border);
}

.ctx-menu button:last-child { border-bottom: none; }
.ctx-menu button:hover { background: var(--panel-alt); }
.ctx-menu button.danger { color: var(--danger); }

.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}
</style>
