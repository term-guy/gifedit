<script setup lang="ts">
import { ref, computed } from 'vue'
import ColorPicker from '@/components/ColorPicker.vue'
import { nanoid } from 'nanoid'
import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'
import type { TextAnimation, AnimationType, PanDirection } from '@/types'

const gifStore = useGifStore()
const editorStore = useEditorStore()

const showModal = ref(false)
const editingId = ref<string | null>(null)
const selectedNodeIdx = ref(-1)

const totalFrames = computed(() => gifStore.frames.length)

type KonvaTextNode = { attrs: Record<string, unknown> }

const canvasTextNodes = computed<KonvaTextNode[]>(() => {
  const frame = gifStore.activeFrame
  if (!frame?.canvasJson) return []
  try {
    const data = JSON.parse(frame.canvasJson) as { children?: { className: string; attrs: Record<string, unknown> }[] }
    return (data.children ?? []).filter((c) => c.className === 'Text')
  } catch {
    return []
  }
})

const hasTextNodes = computed(() => canvasTextNodes.value.length > 0)

// form holds 1-based frame numbers for display; converted to 0-based on save
const blank = (): TextAnimation => ({
  id: nanoid(),
  sourceNodeId: undefined,
  text: '',
  fontFamily: 'DM Sans',
  fontSize: 32,
  color: '#ffffff',
  x: 0.1,
  y: 0.1,
  startFrame: 1,
  endFrame: totalFrames.value,
  type: 'static',
  panDirection: 'left-to-right',
  panStartX: 0,
  panEndX: 1,
  fadeDirection: 'in',
})

const form = ref<TextAnimation>(blank())
const keepUntilEnd = ref(false)

const fonts = ['DM Sans', 'Sora', 'JetBrains Mono', 'Georgia', 'Impact', 'Arial', 'Comic Sans MS', 'Courier New']
const animTypes: AnimationType[] = ['static', 'typing', 'pan', 'fade']
const panDirs: PanDirection[] = ['left-to-right', 'right-to-left', 'top-to-bottom', 'bottom-to-top']

function applyNode(idx: number) {
  const node = canvasTextNodes.value[idx]
  if (!node) return
  const attrs = node.attrs
  const w = gifStore.project?.width ?? 1
  const h = gifStore.project?.height ?? 1
  form.value.sourceNodeId = (attrs.id as string | undefined) ?? undefined
  form.value.text = (attrs.text as string) ?? ''
  form.value.fontFamily = (attrs.fontFamily as string) ?? 'DM Sans'
  form.value.fontSize = (attrs.fontSize as number) ?? 32
  form.value.color = (attrs.fill as string) ?? '#ffffff'
  form.value.x = Math.round(((attrs.x as number) ?? 0) / w * 100) / 100
  form.value.y = Math.round(((attrs.y as number) ?? 0) / h * 100) / 100
}

function openAdd() {
  form.value = blank()
  keepUntilEnd.value = true
  selectedNodeIdx.value = -1
  editingId.value = null
  showModal.value = true
}

function openEdit(anim: TextAnimation) {
  form.value = { ...anim, startFrame: anim.startFrame + 1, endFrame: anim.endFrame + 1 }
  keepUntilEnd.value = anim.endFrame === totalFrames.value - 1
  selectedNodeIdx.value = canvasTextNodes.value.findIndex((node) => node.attrs.id === anim.sourceNodeId)
  editingId.value = anim.id
  showModal.value = true
}

function save() {
  const endFrame1Based = keepUntilEnd.value ? totalFrames.value : form.value.endFrame
  const stored = { ...form.value, startFrame: form.value.startFrame - 1, endFrame: endFrame1Based - 1 }
  if (editingId.value) {
    gifStore.updateTextAnimation(editingId.value, stored)
  } else {
    gifStore.addTextAnimation({ ...stored, id: nanoid() })
  }
  showModal.value = false
}

function remove(id: string) {
  gifStore.deleteTextAnimation(id)
}
</script>

<template>
  <div class="anim-panel">
    <div class="anim-header">
      <span>Text Animations</span>
      <div class="row-gap">
        <button
          class="btn-sm accent"
          :disabled="!hasTextNodes"
          :title="!hasTextNodes ? 'Add text to canvas first' : undefined"
          @click="openAdd"
        >+ Add</button>
        <button class="close-btn" @click="editorStore.showTextPanel = false">✕</button>
      </div>
    </div>

    <div class="anim-list">
      <div v-if="!gifStore.textAnimations.length" class="empty-hint">
        No animations yet. Click Add to create one.
      </div>
      <div
        v-for="anim in gifStore.textAnimations"
        :key="anim.id"
        class="anim-item"
      >
        <div class="anim-info">
          <span class="anim-text">{{ anim.text }}</span>
          <span class="anim-meta">{{ anim.type }} · f{{ anim.startFrame + 1 }}–{{ anim.endFrame + 1 }}</span>
        </div>
        <div class="anim-actions">
          <button class="icon-btn" title="Edit" @click="openEdit(anim)">✏</button>
          <button class="icon-btn danger" title="Delete" @click="remove(anim.id)">✕</button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-header">
            <span>{{ editingId ? 'Edit' : 'Add' }} Text Animation</span>
            <button class="close-btn" @click="showModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label>Source text node</label>
              <select
                v-model="selectedNodeIdx"
                @change="applyNode(selectedNodeIdx)"
              >
                <option :value="-1" disabled>— pick a text node —</option>
                <option v-for="(node, i) in canvasTextNodes" :key="i" :value="i">
                  {{ node.attrs.text }}
                </option>
              </select>
              <span class="field-hint">Text, font, size, color, and position are copied from the selected node.</span>
            </div>
            <div class="field">
              <label>Text</label>
              <input v-model="form.text" placeholder="Pre-filled from node…" :disabled="selectedNodeIdx < 0 && !editingId" />
            </div>
            <div class="field-row">
              <div class="field">
                <label>Font</label>
                <select v-model="form.fontFamily">
                  <option v-for="f in fonts" :key="f">{{ f }}</option>
                </select>
              </div>
              <div class="field">
                <label>Size</label>
                <input v-model.number="form.fontSize" type="number" min="8" max="200" />
              </div>
              <div class="field">
                <label>Color</label>
                <ColorPicker v-model="form.color" />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>X pos (0–1)</label>
                <input v-model.number="form.x" type="number" min="0" max="1" step="0.05" />
              </div>
              <div class="field">
                <label>Y pos (0–1)</label>
                <input v-model.number="form.y" type="number" min="0" max="1" step="0.05" />
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Start frame</label>
                <input v-model.number="form.startFrame" type="number" min="1" :max="totalFrames" />
              </div>
              <div class="field">
                <label>End frame</label>
                <input
                  v-model.number="form.endFrame"
                  type="number"
                  :min="form.startFrame"
                  :max="totalFrames"
                  :disabled="keepUntilEnd"
                  :placeholder="keepUntilEnd ? String(totalFrames) : undefined"
                />
                <label class="keep-until-end-label">
                  <input v-model="keepUntilEnd" type="checkbox" />
                  Keep until final frame
                </label>
              </div>
            </div>
            <div class="field">
              <label>Animation type</label>
              <div class="type-pills">
                <button
                  v-for="t in animTypes"
                  :key="t"
                  class="pill"
                  :class="{ active: form.type === t }"
                  @click="form.type = t"
                >{{ t }}</button>
              </div>
            </div>

            <template v-if="form.type === 'pan'">
              <div class="field">
                <label>Direction</label>
                <select v-model="form.panDirection">
                  <option v-for="d in panDirs" :key="d">{{ d }}</option>
                </select>
              </div>
              <div class="field-row">
                <div class="field">
                  <label>Start X/Y (0–1)</label>
                  <input v-model.number="form.panStartX" type="number" min="0" max="2" step="0.05" />
                </div>
                <div class="field">
                  <label>End X/Y (0–1)</label>
                  <input v-model.number="form.panEndX" type="number" min="0" max="2" step="0.05" />
                </div>
              </div>
            </template>

            <template v-if="form.type === 'fade'">
              <div class="field">
                <label>Fade direction</label>
                <div class="type-pills">
                  <button class="pill" :class="{ active: form.fadeDirection === 'in' }" @click="form.fadeDirection = 'in'">Fade In</button>
                  <button class="pill" :class="{ active: form.fadeDirection === 'out' }" @click="form.fadeDirection = 'out'">Fade Out</button>
                </div>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button class="btn-sm" @click="showModal = false">Cancel</button>
            <button
              class="btn-sm accent"
              :disabled="!editingId && selectedNodeIdx < 0"
              @click="save"
            >{{ editingId ? 'Update' : 'Add' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.anim-panel {
  width: 240px;
  background: var(--panel);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.anim-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
}

.row-gap { display: flex; gap: 8px; align-items: center; }

.close-btn {
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  padding: 2px 5px;
  border-radius: 3px;
}

.close-btn:hover { background: var(--panel-alt); color: var(--text); }

.anim-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-hint { color: var(--text-muted); font-size: 12px; padding: 16px 8px; text-align: center; }

.anim-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.anim-info { display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.anim-text { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.anim-meta { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }

.anim-actions { display: flex; gap: 4px; }

.icon-btn {
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  padding: 4px 6px;
  border-radius: 4px;
}

.icon-btn:hover { background: var(--border); color: var(--text); }
.icon-btn.danger:hover { color: var(--danger); }

.btn-sm {
  padding: 6px 12px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: var(--radius);
  font-size: 12px;
  transition: all 0.12s;
}

.btn-sm:hover { background: var(--border); color: var(--text); }

.btn-sm.accent {
  background: var(--accent);
  color: #0f0f0f;
  border-color: var(--accent);
  font-weight: 600;
}

.btn-sm.accent:hover { filter: brightness(1.1); }
.btn-sm:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: auto; }
.field-hint { font-size: 11px; color: var(--text-muted); }

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--panel);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 14px;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.field label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field input, .field select {
  width: 100%;
}

.field-row {
  display: flex;
  gap: 12px;
}

.type-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pill {
  padding: 5px 12px;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  color: var(--text-dim);
  border-radius: 20px;
  font-size: 12px;
  transition: all 0.12s;
}

.pill:hover { border-color: var(--border-light); color: var(--text); }
.pill.active { background: var(--accent-dim); border-color: var(--accent); color: var(--accent); }

.keep-until-end-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: 0;
  cursor: pointer;
  user-select: none;
}

.keep-until-end-label input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}
</style>
