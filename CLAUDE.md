# CLAUDE.md

A browser-based GIF editor SPA. **All GIF processing happens entirely in the browser** — no server-side image logic. The Go backend only serves `frontend/dist/` and responds to `GET /health`.

---

## Commands

### Frontend (`frontend/`)

```sh
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build → dist/
npm run type-check   # vue-tsc --noEmit (strict)
npm run lint         # ESLint
npm run test:run     # vitest single run (CI)
```

### Backend (`backend/`)

```sh
make dev    # air hot-reload
make run    # go run . serve
make test   # go test ./...
```

---

## Architecture

### Data flow

```
File drop/upload
  → useGifDecoder (gif-decode.worker.js, gifuct-js)
    → composites full-frame ImageData per frame (disposal-type-2 handling)
      → gifStore.addFrame(...)
        → CanvasEditor loads active frame into Konva

Export
  → useGifEncoder
    → useTextAnimations.bakeAnimations() renders text overlays per frame
      → gif-encode.worker.js (custom LZW + NeuQuant, delta-patch frames)
        → Blob download
```

### Konva editor — critical constraints

The editor is split into focused modules that all share state via a single exported object `ks` from `konvaState.ts`:

| File | Responsibility |
|---|---|
| `konvaState.ts` | `ks` singleton object (stage, layers, transformer, etc.) + module-level reactive refs |
| `useKonvaSelection.ts` | Selection management, transformer config, node property state + update functions |
| `useKonvaThumbnails.ts` | Off-screen canvas rendering helpers, thumbnail generation |
| `useKonvaSerializer.ts` | Serialize draw layer to JSON, schedule/flush saves, history snapshots |
| `useKonvaAnimations.ts` | Text animation node rendering and sync |
| `useKonvaDrawTools.ts` | Brush, erase, fill, shapes, text, sticker placement |
| `useKonvaEditor.ts` | Orchestrator: init, destroy, loadFrame, stage events, public API |

Multiple components call `useKonvaEditor()` and share the same Konva instance via the module-level `ks` object.

**Three layers:**
- `baseLayer` — GIF frame ImageData (non-interactive)
- `drawLayer` — user-drawn shapes, text, stickers, brush strokes
- `animationLayer` — Transformer, selection outline, animated text nodes

**Zoom uses CSS `transform: scale()` on `.stage-scaler`**, not `stage.scale()`. Using `stage.scale()` causes Vue's VDOM reconciler to throw `Cannot set properties of null (setting '__vnode')`.

`loadFrame` rebuilds the base image from `frame.imageData` every time (not serialized). `frame.canvasJson` stores per-frame draw layer objects; `project.globalCanvasJson` stores objects visible on all frames.

### Stores

- `gifStore` — `GifProject` (frames, activeFrameId, dimensions, globalCanvasJson) + `TextAnimation[]`
- `editorStore` — active tool, brush/eraser/fill/shape settings, zoom, multi-selected frame IDs, `pendingColorPick` callback
- `historyStore` — 50-step undo/redo via deep `ImageData` clones

### Persistence

`useProjectPersistence` saves/restores the full session to **IndexedDB** (`gif_editor_db`). It watches `gifStore.project` deeply and debounces writes by 800 ms. Restore is chunked (yields every 8 frames via `requestAnimationFrame`) to keep the first frame visible immediately.

### Encode worker

`gif-encode.worker.js` is the entry point for a self-contained custom GIF encoder split across four modules:

| File | Responsibility |
|---|---|
| `gif-lzw.js` | `ByteArray` (paged output buffer) + `LZWEncoder` |
| `gif-neuquant.js` | `NeuQuant` neural-network color quantizer |
| `gif-format.js` | `GIFEncoder` — writes GIF89a headers, palette, pixel blocks |
| `gif-palette.js` | `rgbaToIndexed` — exact palette (≤256 colors) or NeuQuant fallback |
| `gif-encode.worker.js` | Worker entry: receives delta-patch frames, drives encoder, posts progress/done |

It receives **delta-patch frames** from the main thread (only the bounding box of changed pixels), writes progress events, and transfers the final buffer back. No external encoder library.

### Decode worker

`src/workers/gif-decode.worker.js` uses **gifuct-js** `decompressFrames` and manually composites full-frame `ImageData` (disposal type 2 clear). Imported via Vite `?worker` syntax:
```ts
import GifDecodeWorker from '@/workers/gif-decode.worker.js?worker'
```

### Frame timeline

`FrameTimeline.vue` handles playback controls, drag-and-drop reorder (native HTML5), and the frame strip. The selection speed/retime controls live in `SelectionTimingBar.vue` — a self-contained child component that owns its own `speedPercent` and `retimeResult` state.

Uses **native HTML5 drag-and-drop** (`dragstart` / `dragover` / `drop`). `vuedraggable` v4 has a known slot API bug with Vue 3.

### TypeScript strictness

`tsconfig.json` enables `noUnusedLocals` and `noUnusedParameters`. Prefix unused parameters with `_`. Always run `npm run type-check` before committing.
