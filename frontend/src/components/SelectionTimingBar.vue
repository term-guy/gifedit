<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'
import { useFrameOps } from '@/composables/useFrameOps'
import { GIF_RELIABLE_MIN_DELAY_MS, retimeGifSelection } from '@/utils/gifTiming'

const gifStore = useGifStore()
const editorStore = useEditorStore()
const frameOps = useFrameOps()

const selectedFrames = computed(() =>
  gifStore.frames.filter((frame) => editorStore.selectedFrameIds.includes(frame.id)),
)
const selectedTotalDuration = computed(() =>
  selectedFrames.value.reduce((sum, frame) => sum + frame.duration, 0),
)
const hasMultiFrameSelection = computed(() => selectedFrames.value.length > 1)
const speedPercent = ref(100)
const targetSelectedDuration = computed(() => {
  if (!selectedFrames.value.length) return 0
  return selectedTotalDuration.value * (100 / speedPercent.value)
})
const selectedTimingPreview = computed(() =>
  retimeGifSelection(
    selectedFrames.value.map((frame) => frame.duration),
    targetSelectedDuration.value,
  ),
)
const retimeResult = ref<{ removed: number; totalDuration: number; keptCount: number } | null>(null)
let retimeTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => editorStore.selectedFrameIds.slice(),
  () => {
    speedPercent.value = 100
    retimeResult.value = null
  },
)

onUnmounted(() => { if (retimeTimer) clearTimeout(retimeTimer) })

function applySelectionSpeed() {
  if (!hasMultiFrameSelection.value) return
  const result = frameOps.retimeSelectedFrames(targetSelectedDuration.value)
  speedPercent.value = 100
  if (retimeTimer) clearTimeout(retimeTimer)
  retimeResult.value = result
  retimeTimer = setTimeout(() => { retimeResult.value = null }, 3500)
}
</script>

<template>
  <div v-if="hasMultiFrameSelection" class="selection-timing-bar">
    <div class="selection-timing-copy">
      <span class="selection-timing-title">Selected timing</span>
      <span class="selection-timing-meta">
        {{ selectedFrames.length }} frames · {{ selectedTotalDuration }} ms total
      </span>
      <span class="selection-timing-meta">
        {{ speedPercent }}% speed → {{ selectedTimingPreview.actualTotalDuration }} ms
      </span>
      <span
        v-if="selectedTimingPreview.droppedIndices.length > 0"
        class="selection-timing-warning"
      >
        {{ selectedTimingPreview.droppedIndices.length }} selected frame{{ selectedTimingPreview.droppedIndices.length === 1 ? '' : 's' }}
        will be removed to stay at or above {{ GIF_RELIABLE_MIN_DELAY_MS }} ms per frame.
      </span>
    </div>

    <div class="selection-timing-controls">
      <div class="speed-slider-wrap">
        <span class="speed-slider-label">Slower</span>
        <div class="speed-slider-track-wrap">
          <input
            v-model.number="speedPercent"
            class="speed-slider"
            type="range"
            min="25"
            max="400"
            step="5"
          />
          <div class="speed-slider-notch" :style="{ left: `${((100 - 25) / (400 - 25)) * 100}%` }" />
        </div>
        <span class="speed-slider-label">Faster</span>
        <span class="speed-slider-value" :class="{ 'is-default': speedPercent === 100 }">
          {{ speedPercent }}%
        </span>
      </div>

      <button class="reset-speed-btn" :disabled="speedPercent === 100" @click="speedPercent = 100">
        Reset
      </button>
      <button class="apply-speed-btn" @click="applySelectionSpeed">
        Apply
      </button>
    </div>
  </div>

  <Transition name="dedupe-fade">
    <div v-if="retimeResult" class="retime-result">
      Retimed selection to {{ retimeResult.totalDuration }} ms
      <span v-if="retimeResult.removed > 0">
        · removed {{ retimeResult.removed }} frame{{ retimeResult.removed === 1 ? '' : 's' }}
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.selection-timing-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px 0;
}

.selection-timing-copy {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.selection-timing-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.selection-timing-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.selection-timing-warning {
  font-size: 11px;
  color: var(--accent);
}

.selection-timing-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.speed-slider-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-slider-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.speed-slider-track-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 180px;
}

.speed-slider {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
  height: 4px;
}

.speed-slider-notch {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 10px;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 1px;
  pointer-events: none;
}

.speed-slider-value {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  min-width: 36px;
  text-align: right;
  transition: color 0.15s;
}

.speed-slider-value.is-default { color: var(--text-muted); }

.reset-speed-btn {
  padding: 5px 10px;
  font-size: 11px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius);
  transition: all 0.12s;
}

.reset-speed-btn:hover:not(:disabled) { color: var(--text); border-color: rgba(255, 255, 255, 0.25); }
.reset-speed-btn:disabled { opacity: 0.35; cursor: not-allowed; }

.apply-speed-btn {
  padding: 5px 10px;
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-dim);
  border: 1px solid rgba(245, 166, 35, 0.3);
  border-radius: var(--radius);
  transition: all 0.12s;
}

.apply-speed-btn:hover { background: var(--accent); color: #0f0f0f; }

.retime-result {
  padding: 8px 16px 0;
  font-size: 11px;
  color: var(--accent);
  font-family: var(--font-mono);
}

.dedupe-fade-enter-active, .dedupe-fade-leave-active { transition: opacity 0.25s; }
.dedupe-fade-enter-from, .dedupe-fade-leave-to { opacity: 0; }
</style>
