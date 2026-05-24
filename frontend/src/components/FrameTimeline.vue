<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import FrameThumbnail from '@/components/FrameThumbnail.vue'
import SelectionTimingBar from '@/components/SelectionTimingBar.vue'
import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'
import { useFrameOps } from '@/composables/useFrameOps'
import { useGifPlayer } from '@/composables/useGifPlayer'

const gifStore = useGifStore()
const editorStore = useEditorStore()
const frameOps = useFrameOps()
const player = useGifPlayer()

const allSelected = computed(() =>
  editorStore.selectedFrameIds.length === gifStore.frames.length && gifStore.frames.length > 0,
)

function selectAll() {
  editorStore.setFrameSelection(gifStore.frames.map((f) => f.id))
  editorStore.setTool('select')
}

function deselectAll() {
  editorStore.clearFrameSelection()
}

const dragSrcIndex = ref<number | null>(null)

function onDragStart(index: number, e: DragEvent) {
  dragSrcIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onDragOver(_index: number, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(index: number) {
  const src = dragSrcIndex.value
  if (src === null || src === index) return
  const newOrder = [...gifStore.frames]
  const [moved] = newOrder.splice(src, 1)
  newOrder.splice(index, 0, moved)
  frameOps.reorderFrames(newOrder)
  dragSrcIndex.value = null
}

function onDragEnd() {
  dragSrcIndex.value = null
}

const dedupeResult = ref<{ removed: number; total: number } | null>(null)
let dedupeTimer: ReturnType<typeof setTimeout> | null = null

function runDeduplicate() {
  const removed = frameOps.deduplicateFrames()
  if (dedupeTimer) clearTimeout(dedupeTimer)
  dedupeResult.value = { removed, total: gifStore.frames.length }
  dedupeTimer = setTimeout(() => { dedupeResult.value = null }, 3000)
}

onUnmounted(() => { if (dedupeTimer) clearTimeout(dedupeTimer) })

const timelineInnerRef = ref<HTMLElement | null>(null)

watch(
  () => gifStore.activeFrameIndex,
  async (index) => {
    await nextTick()
    const el = timelineInnerRef.value?.children[index] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  },
)
</script>

<template>
  <div class="timeline">
    <div class="playback-bar">
      <div class="playback-controls">
        <button
          class="play-btn"
          :disabled="gifStore.frames.length < 2 || player.isPlaying.value"
          title="Play"
          @click="player.play()"
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
            <path d="M0 0L12 7L0 14V0Z"/>
          </svg>
        </button>
        <button
          class="pause-btn"
          :disabled="!player.isPlaying.value"
          title="Pause"
          @click="player.pause()"
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
            <rect x="0" y="0" width="4" height="14" rx="1"/>
            <rect x="8" y="0" width="4" height="14" rx="1"/>
          </svg>
        </button>
        <button
          class="stop-btn"
          :disabled="gifStore.frames.length < 2"
          title="Stop (return to beginning)"
          @click="player.stop()"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect width="10" height="10" rx="1"/>
          </svg>
        </button>
        <span class="frame-counter">
          {{ gifStore.activeFrameIndex + 1 }} / {{ gifStore.frames.length }}
        </span>
      </div>
      <div class="selection-controls">
        <Transition name="dedupe-fade">
          <span
            v-if="dedupeResult"
            class="dedupe-result"
            :class="dedupeResult.removed > 0 ? 'dedupe-result--merged' : 'dedupe-result--none'"
          >
            {{ dedupeResult.removed > 0
              ? `${dedupeResult.removed} duplicate${dedupeResult.removed === 1 ? '' : 's'} merged → ${dedupeResult.total} frame${dedupeResult.total === 1 ? '' : 's'}`
              : 'No consecutive duplicates found' }}
          </span>
        </Transition>
        <button
          class="dedupe-btn"
          :disabled="gifStore.frames.length < 2"
          title="Merge consecutive identical frames, summing their durations"
          @click="runDeduplicate"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <rect x="1" y="1" width="4" height="11" rx="1" stroke="currentColor" stroke-width="1.3"/>
            <rect x="8" y="1" width="4" height="11" rx="1" stroke="currentColor" stroke-width="1.3" opacity="0.4"/>
            <path d="M5.5 6.5H7.5M7.5 6.5L6.5 5.5M7.5 6.5L6.5 7.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Deduplicate
        </button>
        <button class="sel-all-btn" title="Select all frames (Cmd+A)" @click="allSelected ? deselectAll() : selectAll()">
          {{ allSelected ? 'Deselect all' : 'Select all' }}
        </button>
      </div>
    </div>

    <div ref="timelineInnerRef" class="timeline-inner">
      <div
        v-for="(frame, index) in gifStore.frames"
        :key="frame.id"
        class="drag-wrapper"
        :class="{ dragging: dragSrcIndex === index }"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover="onDragOver(index, $event)"
        @drop="onDrop(index)"
        @dragend="onDragEnd"
      >
        <FrameThumbnail :frame="frame" :index="index" />
      </div>

      <button class="add-frame-btn" title="Add blank frame" @click="frameOps.addBlankFrame">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <SelectionTimingBar />
  </div>
</template>

<style scoped>
.timeline {
  background: var(--panel);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.playback-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-alt);
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.selection-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sel-all-btn {
  padding: 3px 8px;
  font-size: 11px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all 0.12s;
}

.sel-all-btn:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }

.dedupe-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all 0.12s;
}

.dedupe-btn:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); background: var(--accent-dim); }
.dedupe-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.dedupe-result {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 7px;
  border-radius: var(--radius);
}

.dedupe-result--merged { color: var(--accent); background: var(--accent-dim); border: 1px solid rgba(245, 166, 35, 0.3); }
.dedupe-result--none { color: var(--text-muted); background: var(--panel-alt); border: 1px solid var(--border); }

.dedupe-fade-enter-active, .dedupe-fade-leave-active { transition: opacity 0.25s; }
.dedupe-fade-enter-from, .dedupe-fade-leave-to { opacity: 0; }

.play-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-dim);
  border: 1px solid rgba(245, 166, 35, 0.3);
  border-radius: var(--radius);
  color: var(--accent);
  transition: all 0.12s;
}

.play-btn:hover:not(:disabled) { background: var(--accent); color: #0f0f0f; }
.play-btn.active { background: var(--accent); color: #0f0f0f; }
.play-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.pause-btn, .stop-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  transition: all 0.12s;
}

.pause-btn:hover:not(:disabled), .stop-btn:hover:not(:disabled) { background: var(--border); color: var(--text-dim); }
.pause-btn:disabled, .stop-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.frame-counter {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  min-width: 40px;
}

.timeline-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  overflow-x: auto;
  overflow-y: hidden;
  height: 117px;
}

.drag-wrapper { flex-shrink: 0; transition: opacity 0.15s; }
.drag-wrapper.dragging { opacity: 0.4; }

.add-frame-btn {
  width: 88px;
  height: 97px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 2px dashed var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  transition: all 0.12s;
}

.add-frame-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
</style>
