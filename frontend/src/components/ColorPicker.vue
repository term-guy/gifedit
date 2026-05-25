<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useEditorStore } from '@/stores/editorStore'
import 'vanilla-colorful'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const editorStore = useEditorStore()
const open = ref(false)
const swatchRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const hexInput = ref(props.modelValue)
const popoverPos = ref({ top: '0px', left: '0px' })

watch(() => props.modelValue, (v) => {
  hexInput.value = v
})

onClickOutside(popoverRef, (e) => {
  if (swatchRef.value?.contains(e.target as Node)) return
  editorStore.cancelCanvasPick()
  open.value = false
})

function toggleOpen() {
  if (!open.value) {
    const rect = swatchRef.value!.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const popoverHeight = 240
    if (spaceBelow >= popoverHeight) {
      popoverPos.value = { top: `${rect.bottom + 6}px`, left: `${rect.left}px` }
    } else {
      popoverPos.value = { top: `${rect.top - popoverHeight - 6}px`, left: `${rect.left}px` }
    }
  }
  open.value = !open.value
}

function onPickerChange(e: Event) {
  const color = (e as CustomEvent<{ value: string }>).detail.value
  emit('update:modelValue', color)
  hexInput.value = color
}

function onHexInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  hexInput.value = val
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    emit('update:modelValue', val)
  }
}

function onHexBlur() {
  if (!/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) {
    hexInput.value = props.modelValue
  }
}

async function pickFromScreen() {
  open.value = false
  if ('EyeDropper' in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dropper = new (window as any).EyeDropper()
      const result = await dropper.open()
      const hex = result.sRGBHex as string
      emit('update:modelValue', hex)
      hexInput.value = hex
    } catch {
      // user cancelled
    }
  } else {
    editorStore.requestCanvasPick((color) => {
      emit('update:modelValue', color)
      hexInput.value = color
    })
  }
}

onUnmounted(() => { open.value = false })
</script>

<template>
  <div class="cp-wrap">
    <button
      ref="swatchRef"
      class="cp-swatch"
      :style="{ background: modelValue }"
      type="button"
      @click="toggleOpen"
    />
    <span class="cp-hex">{{ modelValue }}</span>

    <Teleport to="body">
      <div
        v-if="open"
        ref="popoverRef"
        class="cp-popover"
        :style="popoverPos"
      >
        <hex-color-picker
          :color="modelValue"
          @color-changed="onPickerChange"
        />
        <div class="cp-bottom-row">
          <input
            class="cp-hex-input"
            type="text"
            :value="hexInput"
            maxlength="7"
            spellcheck="false"
            @input="onHexInput"
            @blur="onHexBlur"
          />
          <button
            class="cp-eyedrop-btn"
            type="button"
            title="Pick color from screen"
            @click="pickFromScreen"
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <path d="M14 2.5a2.5 2.5 0 013.5 3.5L9 14.5l-4 1 1-4L14 2.5z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
              <path d="M4 16.5l-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.cp-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-swatch {
  width: 36px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--border);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: border-color 0.1s;
}

.cp-swatch:hover {
  border-color: var(--border-light);
}

.cp-hex {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
}
</style>

<style>
.cp-popover {
  position: fixed;
  z-index: 9999;
  background: var(--panel);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.cp-bottom-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.cp-hex-input {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  text-align: center;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 8px;
  color: var(--text);
  box-sizing: border-box;
}

.cp-hex-input:focus {
  outline: none;
  border-color: var(--accent);
}

.cp-eyedrop-btn {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.1s;
  padding: 0;
}

.cp-eyedrop-btn:hover {
  border-color: var(--border-light);
  color: var(--text);
  background: var(--border);
}

hex-color-picker {
  width: 200px;
  height: 180px;
}
</style>
