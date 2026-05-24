<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGifDecoder } from '@/composables/useGifDecoder'
import { useGifEncoder } from '@/composables/useGifEncoder'
import { useGifStore } from '@/stores/gifStore'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useProjectPersistence, restoring, restoreProgress, restoreTotal, saving } from '@/composables/useProjectPersistence'

const gifStore = useGifStore()
const editorStore = useEditorStore()
const historyStore = useHistoryStore()
const { decode, decoding, progress, progressTotal, phase } = useGifDecoder()
const { encode, encoding } = useGifEncoder()
const persistence = useProjectPersistence()

const fileInput = ref<HTMLInputElement | null>(null)
const showStartOverModal = ref(false)

const restorePercent = computed(() =>
  restoreTotal.value > 0 ? (restoreProgress.value / restoreTotal.value) * 100 : 0,
)

async function handleFile(file: File) {
  if (!file.type.includes('gif') && !file.name.toLowerCase().endsWith('.gif')) {
    alert('Please upload a GIF file.')
    return
  }
  await decode(file)
  await persistence.saveNow()
}

function onFileInput(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) handleFile(f)
}

async function confirmStartOver() {
  historyStore.clear()
  gifStore.reset()
  editorStore.reset()
  await persistence.clear()
  showStartOverModal.value = false
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <div class="logo">
        <img src="/logo.png" alt="GIFEdit" class="logo-img" />
        <span class="logo-text">GIF<strong>Edit</strong></span>
      </div>
    </div>

    <div class="topbar-center">
      <span v-if="gifStore.project" class="filename">{{ gifStore.project.filename }}</span>
      <span v-if="gifStore.project" class="dim">
        {{ gifStore.project.width }}×{{ gifStore.project.height }}px · {{ gifStore.frames.length }} frames
      </span>
    </div>

    <div class="topbar-right">
      <button
        v-if="gifStore.project"
        class="btn-danger"
        @click="showStartOverModal = true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Start Over
      </button>

      <button class="btn-ghost" @click="fileInput?.click()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V15M17 8L12 3M12 3L7 8M12 3V15"/>
        </svg>
        Upload GIF
      </button>

      <button
        class="btn-accent"
        :disabled="!gifStore.project || encoding"
        @click="encode"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M7 11C6.07003 11 5.60504 11 5.22354 11.1022C4.18827 11.3796 3.37962 12.1883 3.10222 13.2235C3 13.605 3 14.07 3 15V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V15C21 14.07 21 13.605 20.8978 13.2235C20.6204 12.1883 19.8117 11.3796 18.7765 11.1022C18.395 11 17.93 11 17 11M16 7L12 3M12 3L8 7M12 3V15"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {{ encoding ? 'Exporting…' : 'Export GIF' }}
      </button>
    </div>

    <input ref="fileInput" type="file" accept=".gif,image/gif" style="display:none" @change="onFileInput" />

    <Teleport to="body">
      <div v-if="showStartOverModal" class="modal-backdrop" @click.self="showStartOverModal = false">
        <div class="modal">
          <div class="modal-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01" stroke="#f5a623" stroke-width="2" stroke-linecap="round"/>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f5a623" stroke-width="2" stroke-linejoin="round"/>
            </svg>
          </div>
          <h2 class="modal-title">Start over?</h2>
          <p class="modal-body">This will clear your imported GIF and all edits including shapes, stickers, and text. This cannot be undone.</p>
          <div class="modal-actions">
            <button class="modal-btn-cancel" @click="showStartOverModal = false">Cancel</button>
            <button class="modal-btn-confirm" @click="confirmStartOver">Start Over</button>
          </div>
        </div>
      </div>
    </Teleport>

    <div v-if="decoding" class="decode-progress" :class="{ 'decode-progress--busy': phase !== 'processing' }">
      <div
        class="decode-bar"
        :style="{ width: phase === 'processing' ? `${(progress / progressTotal) * 100}%` : '0%' }"
      ></div>
      <span>
        {{ phase === 'reading' ? 'Reading file…'
         : phase === 'decompressing' ? `Decompressing ${progressTotal} frames…`
         : `Decoding ${progress}/${progressTotal} frames…` }}
      </span>
    </div>

    <div v-else-if="restoring" class="decode-progress" :class="{ 'decode-progress--busy': restoreTotal === 0 }">
      <div class="decode-bar" :style="{ width: `${restorePercent}%` }"></div>
      <span>
        {{ restoreTotal === 0 ? 'Opening session…' : `Restoring ${restoreProgress}/${restoreTotal} frames…` }}
      </span>
    </div>

    <div v-else-if="saving" class="decode-progress decode-progress--busy">
      <span>Saving session…</span>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  height: 48px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.topbar-left { display: flex; align-items: center; }

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.logo-img {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  object-fit: contain;
}

.logo-text {
  font-size: 16px;
  font-weight: 500;
  letter-spacing: -0.3px;
  color: var(--text);
}

.logo-text strong { color: var(--accent); }

.topbar-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.filename { color: var(--text); font-size: 13px; }
.dim { color: var(--text-muted); }

.topbar-right { display: flex; align-items: center; gap: 8px; }

.btn-ghost {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: transparent;
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
  transition: all 0.15s;
}

.btn-ghost:hover { background: var(--panel-alt); color: var(--text); border-color: var(--border-light); }

.btn-accent {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: var(--accent);
  color: #0f0f0f;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}

.btn-accent:hover:not(:disabled) { filter: brightness(1.1); }
.btn-accent:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  background: transparent;
  color: #e05555;
  border: 1px solid #e05555;
  border-radius: var(--radius);
  font-size: 13px;
  transition: all 0.15s;
}

.btn-danger:hover { background: rgba(224, 85, 85, 0.12); }

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 28px 28px 24px;
  width: 340px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.modal-icon { display: flex; align-items: center; justify-content: center; }

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.modal-body {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  width: 100%;
}

.modal-btn-cancel {
  flex: 1;
  padding: 8px 0;
  background: transparent;
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
  transition: all 0.15s;
}

.modal-btn-cancel:hover { background: var(--panel-alt); color: var(--text); }

.modal-btn-confirm {
  flex: 1;
  padding: 8px 0;
  background: #e05555;
  color: #fff;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}

.modal-btn-confirm:hover { filter: brightness(1.1); }

.decode-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--border);
  display: flex;
  align-items: center;
  overflow: hidden;
}

@keyframes decode-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.decode-progress--busy {
  background: linear-gradient(
    90deg,
    var(--border) 0%,
    var(--border) 30%,
    var(--accent) 50%,
    var(--border) 70%,
    var(--border) 100%
  );
  background-size: 200% 100%;
  animation: decode-shimmer 1.4s ease-in-out infinite;
}

.decode-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.1s;
}

.decode-progress span {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 6px;
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
}

</style>
