# GIF Editor

A browser-based GIF editor SPA. Open a GIF, draw on frames, add animated text overlays, reorder/duplicate/delete frames, adjust timing, and export — all without uploading anything to a server.

**All GIF processing happens entirely in the browser.** The Go backend only serves the compiled frontend and responds to `GET /health`.

---

## Features

- **Frame-by-frame editing** — draw, erase, fill, add shapes, place stickers, and drop text on individual frames or across all frames via a global layer
- **Animated text overlays** — static, typing, pan (4 directions), and fade (in/out) animations baked into the exported GIF
- **Custom GIF encoder** — LZW + NeuQuant color quantizer written from scratch; delta-patch frames minimize file size
- **Non-destructive draw layer** — Konva canvas objects are serialized per frame as JSON and composited at export time
- **50-step undo/redo** — deep `ImageData` clones, no canvas mutation until export
- **Session persistence** — full project auto-saved to IndexedDB; survives page refresh
- **Frame timeline** — playback preview, drag-and-drop reorder, multi-select, per-frame and bulk timing controls, duplicate detection and merge
- **Zoom** — 10% to 800% via CSS `transform: scale()` on the stage wrapper

---

## Getting Started

### Requirements

- Node.js 22+
- Go 1.25+

### Development

```sh
# Frontend (Vite dev server on port 5173)
cd frontend
npm install
npm run dev
```

```sh
# Backend (serves frontend/dist + /health)
cd backend
cp .env.example .env
make run
```

The frontend dev server proxies `/health` to the backend. In dev you only need the backend if you're testing the health endpoint or the production static-file serving path.

### Production build

```sh
cd frontend && npm run build   # outputs to frontend/dist/
cd backend && go build -o server .
./backend/server               # serves dist/ on :8080
```

### Docker

```sh
docker build -t gif-editor .
docker run -p 8080:8080 gif-editor
```

Or with the included Compose file (expects an external `traefik` network):

```sh
docker compose up -d
```

---

## Frontend Commands

```sh
npm run dev          # Vite dev server (port 5173)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run type-check   # vue-tsc --noEmit (strict)
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run format       # Prettier
npm run test         # Vitest watch
npm run test:run     # Vitest single run (CI)
```

## Backend Commands

```sh
make dev    # air hot-reload
make run    # go run . serve
make test   # go test ./...
make fmt    # gofmt -w .
make lint   # golangci-lint run
```

---

## Architecture

### Data flow

```
File drop/upload
  → useGifDecoder  (gif-decode.worker.js, gifuct-js)
    → composites full-frame ImageData per frame (disposal-type-2 handling)
      → gifStore.addFrame(...)
        → CanvasEditor loads active frame into Konva

Export
  → useGifEncoder
    → useTextAnimations.bakeAnimations()  (renders text overlays per frame)
      → gif-encode.worker.js  (LZW + NeuQuant, delta-patch frames)
        → Blob download
```

### Frontend stack

| Concern | Library |
|---|---|
| UI framework | Vue 3 + Vite |
| State | Pinia |
| Routing | Vue Router |
| Canvas / drawing | Konva + vue-konva |
| GIF decode | gifuct-js (in a Web Worker) |
| GIF encode | Custom LZW encoder (in a Web Worker) |
| Color picker | vanilla-colorful |
| Styling | Tailwind CSS v4 |
| Utilities | @vueuse/core, nanoid, axios |
| Tests | Vitest + @vue/test-utils + happy-dom |

### Stores

| Store | Responsibility |
|---|---|
| `gifStore` | `GifProject` (frames, activeFrameId, dimensions, globalCanvasJson) + `TextAnimation[]` |
| `editorStore` | Active tool, brush/eraser/fill/shape settings, zoom, multi-selected frame IDs, `pendingColorPick` callback |
| `historyStore` | 50-step undo/redo via deep `ImageData` clones |

### Konva editor modules

The editor is split into focused composables that all share state via the `ks` singleton from `konvaState.ts`:

| File | Responsibility |
|---|---|
| `konvaState.ts` | `ks` object (stage, layers, transformer, refs) |
| `useKonvaEditor.ts` | Orchestrator: init, destroy, loadFrame, stage events, public API |
| `useKonvaDrawTools.ts` | Brush, erase, fill, shapes, text, sticker placement |
| `useKonvaSelection.ts` | Selection management, transformer config, node property state |
| `useKonvaThumbnails.ts` | Off-screen canvas rendering, thumbnail generation |
| `useKonvaSerializer.ts` | Serialize draw layer to JSON, debounced saves, history snapshots |
| `useKonvaAnimations.ts` | Text animation node rendering and sync |

**Three Konva layers:**
- `baseLayer` — GIF frame `ImageData` (non-interactive, rebuilt on every `loadFrame`)
- `drawLayer` — user-drawn shapes, text, stickers, brush strokes (serialized as `frame.canvasJson`)
- `animationLayer` — Transformer, selection outline, animated text nodes

### Encode worker (`gif-encode.worker.js`)

| File | Responsibility |
|---|---|
| `gif-lzw.js` | `ByteArray` paged output buffer + `LZWEncoder` |
| `gif-neuquant.js` | `NeuQuant` neural-network color quantizer |
| `gif-format.js` | `GIFEncoder` — GIF89a headers, palette, pixel blocks |
| `gif-palette.js` | `rgbaToIndexed` — exact palette (≤ 256 colors) or NeuQuant fallback |
| `gif-encode.worker.js` | Worker entry: receives delta-patch frames, drives encoder, posts progress/done |

The main thread sends only the bounding box of changed pixels (delta patches) to minimize data transfer. The final buffer is transferred (zero-copy) back to the main thread.

### Decode worker

`src/workers/gif-decode.worker.js` uses **gifuct-js** `decompressFrames` and manually composites full-frame `ImageData` with correct disposal-type-2 (clear-to-transparent) handling.

### Persistence

`useProjectPersistence` watches `gifStore.project` deeply and debounces writes to **IndexedDB** (`gif_editor_db`) by 800 ms. Restore is chunked (yields every 8 frames via `requestAnimationFrame`) so the first frame appears immediately.

### Backend

`backend/server.go` is a minimal stdlib HTTP server:
- `GET /health` — returns `{"status":"ok"}`
- Everything else — serves `frontend/dist/` as static files

Middleware: security headers (`X-Content-Type-Options`, `X-Frame-Options`) and optional CORS (`CORS_ORIGIN` env var).

### Backend environment

```sh
PORT=8080          # listen port (default 8080)
CORS_ORIGIN=       # allowed CORS origin (empty = no CORS headers)
```

---

## Project structure

```
gif_editor/
├── Dockerfile
├── docker-compose.yml
├── backend/
│   ├── server.go          # HTTP server + static file serving
│   ├── Makefile
│   ├── .env.example
│   └── go.mod
└── frontend/
    ├── src/
    │   ├── components/    # Vue UI components
    │   ├── composables/   # Konva editor, GIF codec, persistence
    │   ├── stores/        # Pinia: gif, editor, history
    │   ├── workers/       # gif-encode.worker.js, gif-decode.worker.js
    │   ├── utils/         # floodFill, interpolate, gifTiming, imageData
    │   └── types/         # TypeScript interfaces (GifFrame, TextAnimation, …)
    ├── vite.config.ts
    └── tsconfig.json      # strict, noUnusedLocals, noUnusedParameters
```
