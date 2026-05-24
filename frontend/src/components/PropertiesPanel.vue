<script setup lang="ts">
import { useEditorStore } from '@/stores/editorStore'
import { useGifStore } from '@/stores/gifStore'
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useFrameOps } from '@/composables/useFrameOps'
import { useKonvaEditor } from '@/composables/useKonvaEditor'
import ColorPicker from '@/components/ColorPicker.vue'
import { GIF_RELIABLE_MIN_DELAY_MS, GIF_DELAY_STEP_MS } from '@/utils/gifTiming'

const editorStore = useEditorStore()
const { fillTolerance } = storeToRefs(editorStore)
const gifStore = useGifStore()
const frameOps = useFrameOps()
const konva = useKonvaEditor()

const tool = computed(() => editorStore.activeTool)
const selectedFrames = computed(() => {
  const selected = gifStore.frames.filter((frame) => editorStore.selectedFrameIds.includes(frame.id))
  if (selected.length > 0) return selected
  return gifStore.activeFrame ? [gifStore.activeFrame] : []
})
const selectedFrameCount = computed(() => selectedFrames.value.length)
const selectedDurationValue = computed(() => {
  if (!selectedFrames.value.length) return ''
  const [firstFrame] = selectedFrames.value
  const allSame = selectedFrames.value.every((frame) => frame.duration === firstFrame.duration)
  return allSame ? String(firstFrame.duration) : ''
})

function updateSelectedFrameDuration(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  if (Number.isNaN(value) || !selectedFrames.value.length) return

  if (selectedFrames.value.length > 1) {
    frameOps.setBulkDuration(value)
    return
  }

  gifStore.updateFrameDuration(selectedFrames.value[0].id, value)
}
</script>

<template>
  <div class="props-panel">
    <!-- Draw properties -->
    <template v-if="tool === 'draw'">
      <div class="prop-group">
        <label>Color</label>
        <ColorPicker v-model="editorStore.brushColor" />
      </div>
      <div class="prop-group">
        <label>Brush size <span class="mono">{{ editorStore.brushSize }}px</span></label>
        <input type="range" min="1" max="80" v-model.number="editorStore.brushSize" class="range" />
      </div>
    </template>

    <!-- Erase properties -->
    <template v-else-if="tool === 'erase'">
      <div class="prop-group">
        <label>Eraser size <span class="mono">{{ editorStore.eraserSize }}px</span></label>
        <input type="range" min="2" max="120" v-model.number="editorStore.eraserSize" class="range" />
      </div>
    </template>

    <!-- Fill properties -->
    <template v-else-if="tool === 'fill'">
      <div class="prop-group">
        <label>Fill color</label>
        <ColorPicker v-model="editorStore.fillColor" />
      </div>
      <div class="prop-group">
        <label>Tolerance <span class="mono">{{ fillTolerance ?? 15 }}</span></label>
        <input type="range" min="0" max="128" v-model.number="fillTolerance" class="range" />
      </div>
    </template>

    <template v-else-if="tool === 'shape'">
      <div class="prop-group">
        <label>Shape</label>
        <select v-model="editorStore.shapeType" class="select">
          <option value="square">Square</option>
          <option value="rectangle">Rectangle</option>
          <option value="circle">Circle</option>
        </select>
      </div>
      <div class="prop-group">
        <label>Fill color</label>
        <ColorPicker v-model="editorStore.fillColor" />
      </div>
      <div v-if="editorStore.shapeType === 'square'" class="prop-group">
        <label>Roundness <span class="mono">{{ editorStore.shapeCornerRadius }}px</span></label>
        <input type="range" min="0" max="40" v-model.number="editorStore.shapeCornerRadius" class="range" />
      </div>
      <div class="prop-group">
        <label class="checkbox-label">
          <input type="checkbox" v-model="editorStore.shapeStroke" />
          <span>Stroke</span>
        </label>
      </div>
      <template v-if="editorStore.shapeStroke">
        <div class="prop-group">
          <label>Stroke color</label>
          <ColorPicker v-model="editorStore.shapeStrokeColor" />
        </div>
        <div class="prop-group">
          <label>Stroke width <span class="mono">{{ editorStore.shapeStrokeWidth }}px</span></label>
          <input type="range" min="1" max="20" v-model.number="editorStore.shapeStrokeWidth" class="range" />
        </div>
      </template>
    </template>

    <!-- Text properties -->
    <template v-else-if="tool === 'text'">
      <div class="prop-group">
        <label>Font</label>
        <select v-model="editorStore.textConfig.fontFamily" class="select">
          <option>DM Sans</option>
          <option>Sora</option>
          <option>Georgia</option>
          <option>Impact</option>
          <option>Arial</option>
          <option>Courier New</option>
          <option>JetBrains Mono</option>
          <option>Comic Sans MS</option>
        </select>
      </div>
      <div class="prop-group">
        <label>Size <span class="mono">{{ editorStore.textConfig.fontSize }}px</span></label>
        <input type="range" min="8" max="200" v-model.number="editorStore.textConfig.fontSize" class="range" />
      </div>
      <div class="prop-group">
        <label>Color</label>
        <ColorPicker v-model="editorStore.textConfig.color" />
      </div>
      <div class="prop-group row">
        <label class="checkbox-label">
          <input type="checkbox" v-model="editorStore.textConfig.bold" />
          <span><strong>B</strong></span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="editorStore.textConfig.italic" />
          <span><em>I</em></span>
        </label>
      </div>
    </template>

    <!-- Select / default -->
    <template v-else>
      <!-- Selected rect/circle properties -->
      <template v-if="konva.hasSelection.value && (konva.selectedNodeKind.value === 'rect' || konva.selectedNodeKind.value === 'circle')">
        <div class="prop-group">
          <label>Fill</label>
          <ColorPicker :modelValue="konva.selectedNodeFill.value" @update:modelValue="konva.updateSelectedFill" />
        </div>
        <div v-if="konva.selectedNodeKind.value === 'rect' && konva.selectedNodeShapeType.value === 'square'" class="prop-group">
          <label>Roundness <span class="mono">{{ konva.selectedNodeCornerRadius.value }}px</span></label>
          <input type="range" min="0" max="40" :value="konva.selectedNodeCornerRadius.value" @input="konva.updateSelectedCornerRadius(+($event.target as HTMLInputElement).value)" class="range" />
        </div>
        <div class="prop-group">
          <label class="checkbox-label">
            <input type="checkbox" :checked="konva.selectedNodeStroke.value" @change="konva.updateSelectedStroke(($event.target as HTMLInputElement).checked)" />
            <span>Stroke</span>
          </label>
        </div>
        <template v-if="konva.selectedNodeStroke.value">
          <div class="prop-group">
            <label>Stroke color</label>
            <ColorPicker :modelValue="konva.selectedNodeStrokeColor.value" @update:modelValue="konva.updateSelectedStrokeColor" />
          </div>
          <div class="prop-group">
            <label>Stroke width <span class="mono">{{ konva.selectedNodeStrokeWidth.value }}px</span></label>
            <input type="range" min="1" max="20" :value="konva.selectedNodeStrokeWidth.value" @input="konva.updateSelectedStrokeWidth(+($event.target as HTMLInputElement).value)" class="range" />
          </div>
        </template>
      </template>

      <!-- Selected text properties -->
      <template v-else-if="konva.hasSelection.value && konva.selectedNodeKind.value === 'text'">
        <div class="prop-group">
          <label>Font</label>
          <select :value="konva.selectedNodeFontFamily.value" @change="konva.updateSelectedFontFamily(($event.target as HTMLSelectElement).value)" class="select">
            <option>DM Sans</option>
            <option>Sora</option>
            <option>Georgia</option>
            <option>Impact</option>
            <option>Arial</option>
            <option>Courier New</option>
            <option>JetBrains Mono</option>
            <option>Comic Sans MS</option>
          </select>
        </div>
        <div class="prop-group">
          <label>Size <span class="mono">{{ konva.selectedNodeFontSize.value }}px</span></label>
          <input type="range" min="8" max="200" :value="konva.selectedNodeFontSize.value" @input="konva.updateSelectedFontSize(+($event.target as HTMLInputElement).value)" class="range" />
        </div>
        <div class="prop-group">
          <label>Color</label>
          <ColorPicker :modelValue="konva.selectedNodeFill.value" @update:modelValue="konva.updateSelectedFill" />
        </div>
        <div class="prop-group row">
          <label class="checkbox-label">
            <input type="checkbox" :checked="konva.selectedNodeBold.value" @change="konva.updateSelectedBold(($event.target as HTMLInputElement).checked)" />
            <span><strong>B</strong></span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" :checked="konva.selectedNodeItalic.value" @change="konva.updateSelectedItalic(($event.target as HTMLInputElement).checked)" />
            <span><em>I</em></span>
          </label>
        </div>
      </template>

      <!-- Selected line properties -->
      <template v-else-if="konva.hasSelection.value && konva.selectedNodeKind.value === 'line'">
        <div class="prop-group">
          <label>Color</label>
          <ColorPicker :modelValue="konva.selectedNodeStrokeColor.value" @update:modelValue="konva.updateSelectedStrokeColor" />
        </div>
        <div class="prop-group">
          <label>Width <span class="mono">{{ konva.selectedNodeStrokeWidth.value }}px</span></label>
          <input type="range" min="1" max="80" :value="konva.selectedNodeStrokeWidth.value" @input="konva.updateSelectedStrokeWidth(+($event.target as HTMLInputElement).value)" class="range" />
        </div>
      </template>


      <div v-if="selectedFrameCount" class="prop-group">
        <label>Frame delay</label>
        <div class="row">
          <input
            type="number"
            :value="selectedDurationValue"
            min="0"
            :step="GIF_DELAY_STEP_MS"
            class="num-input"
            :placeholder="selectedFrameCount > 1 ? 'Mixed' : String(GIF_RELIABLE_MIN_DELAY_MS)"
            @change="updateSelectedFrameDuration"
            @keydown.enter.prevent="updateSelectedFrameDuration"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <span class="unit">ms</span>
        </div>
        <span class="selection-meta">
          GIF playback below {{ GIF_RELIABLE_MIN_DELAY_MS }} ms is often slowed by viewers.
        </span>
        <span v-if="selectedFrameCount > 1" class="selection-meta">
          {{ selectedFrameCount }} frames selected
        </span>
      </div>
    </template>

    <!-- All-frames toggle — shown whenever a canvas node is selected -->
    <div v-if="konva.hasSelection.value" class="prop-group prop-group--allframes">
      <label>On all frames</label>
      <label class="checkbox-label all-frames-label">
        <input
          type="checkbox"
          :checked="konva.isSelectionGlobal.value"
          @change="konva.setSelectionGlobal(($event.target as HTMLInputElement).checked)"
        />
        <span>{{ konva.isSelectionGlobal.value ? 'Enabled' : 'Off' }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.props-panel {
  height: 90px;
  background: var(--panel);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 20px;
  overflow-x: auto;
  flex-shrink: 0;
}

.prop-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 120px;
}

.prop-group.row {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.mono {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}

.selection-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.range {
  -webkit-appearance: none;
  width: 120px;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  border: none;
  padding: 0;
}

.range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

.select {
  width: 140px;
  padding: 5px 8px;
  font-size: 12px;
}

.num-input {
  width: 70px;
  font-family: var(--font-mono);
  font-size: 13px;
  text-align: right;
}

.unit {
  font-size: 12px;
  color: var(--text-muted);
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  flex-direction: row;
  text-transform: none;
  letter-spacing: 0;
  font-size: 14px;
  color: var(--text-dim);
}

.checkbox-label input { cursor: pointer; }

.prop-group--allframes {
  border-left: 1px solid var(--border);
  padding-left: 20px;
  min-width: unset;
}

.all-frames-label {
  font-size: 12px;
  color: var(--text-dim);
  gap: 6px;
  text-transform: none;
  letter-spacing: 0;
  cursor: pointer;
}

.all-frames-label input { cursor: pointer; }
</style>
