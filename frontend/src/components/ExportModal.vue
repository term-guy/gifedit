<script setup lang="ts">
import { useGifEncoder } from '@/composables/useGifEncoder'

const { encoding, progress, estimatedSize, phase } = useGifEncoder()

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}
</script>

<template>
  <Teleport to="body">
    <div v-if="encoding" class="export-backdrop">
      <div class="export-modal">
        <div class="export-spinner"></div>
        <h3>Encoding GIF…</h3>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <div class="progress-info">
          <span>{{ progress }}%</span>
          <span v-if="estimatedSize > 0">~{{ formatSize(estimatedSize) }}</span>
        </div>
        <p class="progress-phase">{{ phase }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.export-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.export-modal {
  background: var(--panel);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 32px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 300px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}

h3 { font-size: 16px; font-weight: 600; color: var(--text); }

.export-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.progress-track {
  width: 220px;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.2s;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  width: 220px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
}

.progress-phase {
  width: 220px;
  margin: 0;
  min-height: 18px;
  font-size: 12px;
  color: var(--text-dim);
  text-align: left;
}
</style>
