/**
 * Canvas interaction tests — verify each tool actually produces the correct result
 * on the Konva canvas, not just that it activates.
 *
 * The test GIF is 200×200, frame 1 = solid red (#ff0000), frame 2 = solid green.
 * Default fill color (#f5a623 orange) and brush color (#f5a623) differ clearly from
 * the frame pixels, making color-change assertions reliable.
 *
 * Canvas layout (Konva adds scene + hit canvas per layer, hit has display:none):
 *   sceneCanvases[0] = baseLayer   (GIF frame pixels)
 *   sceneCanvases[1] = drawLayer   (brush strokes, shapes, text, stickers)
 *   sceneCanvases[2] = animLayer   (transformer, selection outline)
 */
import { test, expect, type Page, type BoundingBox } from '@playwright/test'
import { fileURLToPath } from 'url'

const FIXTURE = fileURLToPath(new URL('./fixtures/test.gif', import.meta.url))

// ─── page helpers ───────────────────────────────────────────────────────────

async function freshPage(page: Page) {
  await page.goto('/')
  await page.evaluate(() =>
    new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('gif_editor_db')
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    }),
  )
  await page.reload()
  await expect(page.locator('.drop-hint')).toBeVisible({ timeout: 10_000 })
}

async function uploadAndWaitForCanvas(page: Page) {
  await page.locator('input[type="file"][accept*="gif"]').setInputFiles(FIXTURE)
  await expect(page.locator('.timeline')).toBeVisible({ timeout: 15_000 })
  // CanvasEditor delays Konva init by 20 ms; wait for canvas elements to appear
  await page.waitForSelector('#konva-stage canvas', { timeout: 5_000 })
  await page.waitForTimeout(80)
}

/** Bounding box of the Konva host (matches GIF dimensions at zoom=1). */
async function canvasBox(page: Page): Promise<BoundingBox> {
  const box = await page.locator('.konva-host').boundingBox()
  if (!box) throw new Error('.konva-host not found')
  return box
}

// ─── canvas pixel helpers ────────────────────────────────────────────────────

/** Konva appends [scene, hit] canvas pairs per layer; hit canvases have display:none. */
const SCENE_CANVAS_JS = `
  Array.from(document.querySelectorAll('#konva-stage canvas'))
    .filter(c => c.style.display !== 'none')
`

/** True if the draw layer (sceneCanvases[1]) has any non-transparent pixel. */
async function drawLayerHasContent(page: Page): Promise<boolean> {
  return page.evaluate((sel) => {
    const canvases = eval(sel) as HTMLCanvasElement[]
    const draw = canvases[1]
    if (!draw) return false
    const ctx = draw.getContext('2d')!
    const d = ctx.getImageData(0, 0, draw.width, draw.height).data
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
    return false
  }, SCENE_CANVAS_JS)
}

/** Center pixel of the base layer (sceneCanvases[0]). */
async function baseLayerCenter(page: Page) {
  return page.evaluate((sel) => {
    const canvases = eval(sel) as HTMLCanvasElement[]
    const base = canvases[0]
    if (!base) return null
    const ctx = base.getContext('2d')!
    const d = ctx.getImageData(Math.floor(base.width / 2), Math.floor(base.height / 2), 1, 1).data
    return { r: d[0], g: d[1], b: d[2], a: d[3] }
  }, SCENE_CANVAS_JS)
}

/** Wait (with timeout) until the draw layer has any non-transparent pixel. */
async function waitForDrawContent(page: Page) {
  await page.waitForFunction((sel) => {
    const canvases = eval(sel) as HTMLCanvasElement[]
    const draw = canvases[1]
    if (!draw) return false
    const ctx = draw.getContext('2d')!
    const d = ctx.getImageData(0, 0, draw.width, draw.height).data
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true
    return false
  }, SCENE_CANVAS_JS, { timeout: 5_000 })
}

// ─── toolbar / props helpers ─────────────────────────────────────────────────

const toolBtn = (page: Page, label: string) =>
  page.locator('.left-panel .tool-btn', { hasText: label })

const props = (page: Page) => page.locator('.props-panel')

// "On all frames" toggle appears in the props panel whenever a Konva node is selected
const onAllFrames = (page: Page) => props(page).getByText('On all frames')

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe('Tools — canvas interaction', () => {
  test.beforeEach(async ({ page }) => {
    await freshPage(page)
    await uploadAndWaitForCanvas(page)
  })

  // ── Draw ──────────────────────────────────────────────────────────────────

  test('Draw — stroke appears on the draw layer', async ({ page }) => {
    await toolBtn(page, 'Draw').click()
    const box = await canvasBox(page)

    expect(await drawLayerHasContent(page)).toBe(false)

    // Horizontal stroke across the canvas center
    await page.mouse.move(box.x + 20, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2)
    await page.mouse.up()

    expect(await drawLayerHasContent(page)).toBe(true)
    // Tool stays as Draw after a stroke
    await expect(toolBtn(page, 'Draw')).toHaveClass(/active/)
  })

  test('Draw — switching to Select and clicking the stroke selects it', async ({ page }) => {
    await toolBtn(page, 'Draw').click()
    const box = await canvasBox(page)
    const cy = box.y + box.height / 2

    await page.mouse.move(box.x + 20, cy)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 20, cy)
    await page.mouse.up()
    expect(await drawLayerHasContent(page)).toBe(true)

    // Switch to Select — batchDraw() re-populates the hit canvas so clicks register
    await toolBtn(page, 'Select').click()
    await page.waitForTimeout(50)

    await page.mouse.click(box.x + box.width / 2, cy)
    await expect(onAllFrames(page)).toBeVisible({ timeout: 2_000 })
  })

  test('Draw — stroke persists across frame navigation', async ({ page }) => {
    await toolBtn(page, 'Draw').click()
    const box = await canvasBox(page)
    const cy = box.y + box.height / 2

    await page.mouse.move(box.x + 20, cy)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 20, cy)
    await page.mouse.up()

    expect(await drawLayerHasContent(page)).toBe(true)

    // Navigate to frame 2 and back — stroke should still be on frame 1
    await page.locator('.timeline-inner .drag-wrapper').nth(1).click()
    expect(await drawLayerHasContent(page)).toBe(false)  // frame 2 has no draw content

    await page.locator('.timeline-inner .drag-wrapper').nth(0).click()
    expect(await drawLayerHasContent(page)).toBe(true)   // frame 1 stroke is restored
  })

  // ── Erase ─────────────────────────────────────────────────────────────────

  test('Erase — partial erase bakes remainder into a selected node', async ({ page }) => {
    const box = await canvasBox(page)
    const cy = box.y + box.height / 2

    // Draw a full-width stroke first
    await toolBtn(page, 'Draw').click()
    await page.mouse.move(box.x + 10, cy)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 10, cy)
    await page.mouse.up()
    expect(await drawLayerHasContent(page)).toBe(true)

    // Erase the left half; the right half remains
    await toolBtn(page, 'Erase').click()
    await page.mouse.move(box.x + 10, cy)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, cy)
    await page.mouse.up()

    // bakeErase: remaining pixels → Konva.Image → auto-select → tool → 'select'
    await expect(toolBtn(page, 'Select')).toHaveClass(/active/, { timeout: 2_000 })
    await expect(onAllFrames(page)).toBeVisible()
    // Draw layer still has content (the baked Konva.Image)
    expect(await drawLayerHasContent(page)).toBe(true)
  })

  // ── Fill ──────────────────────────────────────────────────────────────────

  test('Fill — flood-fills the base layer with the active color', async ({ page }) => {
    await toolBtn(page, 'Fill').click()
    const box = await canvasBox(page)

    // Frame 1 is solid red: center pixel r≈255, g≈0
    const before = await baseLayerCenter(page)
    expect(before?.r).toBeGreaterThan(200)
    expect(before?.g).toBeLessThan(50)

    // Fill default color is #f5a623 (r=245, g=166, b=35)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    // Poll until the base layer center pixel turns orange
    await page.waitForFunction(
      (sel) => {
        const canvases = eval(sel) as HTMLCanvasElement[]
        const base = canvases[0]
        if (!base) return false
        const d = base.getContext('2d')!.getImageData(
          Math.floor(base.width / 2), Math.floor(base.height / 2), 1, 1,
        ).data
        return d[1] > 100  // green channel jumps from ~0 (red) to ~166 (orange)
      },
      SCENE_CANVAS_JS,
      { timeout: 5_000 },
    )

    const after = await baseLayerCenter(page)
    // #f5a623 = r:245 g:166 b:35
    expect(after?.r).toBeGreaterThan(200)
    expect(after?.g).toBeGreaterThan(100)
    expect(after?.b).toBeLessThan(100)
  })

  // ── Shape ─────────────────────────────────────────────────────────────────

  test('Shape — drag places a shape, auto-selects it, switches to Select tool', async ({ page }) => {
    await toolBtn(page, 'Shape').click()
    const box = await canvasBox(page)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    expect(await drawLayerHasContent(page)).toBe(false)

    await page.mouse.move(cx - 50, cy - 40)
    await page.mouse.down()
    await page.mouse.move(cx + 50, cy + 40)
    await page.mouse.up()

    // finishDrawingShape → setTool('select') + selectNode()
    await expect(toolBtn(page, 'Select')).toHaveClass(/active/, { timeout: 2_000 })
    await expect(onAllFrames(page)).toBeVisible()
    expect(await drawLayerHasContent(page)).toBe(true)
  })

  test('Shape — placed shape shows fill color props when selected', async ({ page }) => {
    await toolBtn(page, 'Shape').click()
    const box = await canvasBox(page)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.move(cx - 50, cy - 40)
    await page.mouse.down()
    await page.mouse.move(cx + 50, cy + 40)
    await page.mouse.up()

    await expect(toolBtn(page, 'Select')).toHaveClass(/active/, { timeout: 2_000 })
    // Selected rect/circle shows Fill + Stroke controls
    await expect(props(page).getByText('Fill', { exact: true })).toBeVisible()
    // "Stroke" is the checkbox label; use exact to avoid matching "Stroke color" / "Stroke width"
    await expect(props(page).getByText('Stroke', { exact: true })).toBeVisible()
  })

  // ── Text ──────────────────────────────────────────────────────────────────

  test('Text — click opens textarea; Enter commits the node', async ({ page }) => {
    await toolBtn(page, 'Text').click()
    const box = await canvasBox(page)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.click(cx, cy)
    await expect(page.locator('.canvas-text-input')).toBeVisible({ timeout: 2_000 })

    await page.keyboard.type('Hello')
    await page.keyboard.press('Enter')

    await expect(page.locator('.canvas-text-input')).not.toBeVisible()
    await expect(toolBtn(page, 'Select')).toHaveClass(/active/, { timeout: 2_000 })
    await expect(onAllFrames(page)).toBeVisible()
    await waitForDrawContent(page)
  })

  test('Text — Escape discards input without placing a node', async ({ page }) => {
    await toolBtn(page, 'Text').click()
    const box = await canvasBox(page)

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.canvas-text-input')).toBeVisible({ timeout: 2_000 })

    await page.keyboard.type('Discard me')
    await page.keyboard.press('Escape')

    await expect(page.locator('.canvas-text-input')).not.toBeVisible()
    // Nothing placed → draw layer still empty
    expect(await drawLayerHasContent(page)).toBe(false)
  })

  test('Text — committed node is selected and shows text props', async ({ page }) => {
    await toolBtn(page, 'Text').click()
    const box = await canvasBox(page)

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.canvas-text-input')).toBeVisible({ timeout: 2_000 })
    await page.keyboard.type('Test')
    await page.keyboard.press('Enter')

    await expect(toolBtn(page, 'Select')).toHaveClass(/active/, { timeout: 2_000 })
    await expect(onAllFrames(page)).toBeVisible()
    // populateSelectedNodeState is called by addText → text props appear immediately
    await expect(props(page).getByText('Font', { exact: true })).toBeVisible()
    await expect(props(page).getByText('Size', { exact: false })).toBeVisible()
    await expect(props(page).getByText('Color', { exact: true })).toBeVisible()
    // Text animation panel is closed (setTool('select') hides it)
    await expect(page.locator('.anim-panel')).not.toBeVisible()
  })

  // ── Sticker ───────────────────────────────────────────────────────────────

  test('Sticker — clicking a sticker places and selects it', async ({ page }) => {
    await toolBtn(page, 'Sticker').click()
    await expect(page.locator('.sticker-panel')).toBeVisible()

    await page.locator('.sticker-btn').first().click()

    // addSticker is async (img.onload); wait for selection to appear
    await expect(onAllFrames(page)).toBeVisible({ timeout: 5_000 })
    await waitForDrawContent(page)
  })

  // ── Select ────────────────────────────────────────────────────────────────

  test('Select — Delete key removes the selected node', async ({ page }) => {
    // Place a shape to have something to delete
    await toolBtn(page, 'Shape').click()
    const box = await canvasBox(page)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.move(cx - 50, cy - 40)
    await page.mouse.down()
    await page.mouse.move(cx + 50, cy + 40)
    await page.mouse.up()

    await expect(onAllFrames(page)).toBeVisible({ timeout: 2_000 })
    expect(await drawLayerHasContent(page)).toBe(true)

    await page.keyboard.press('Delete')

    await expect(onAllFrames(page)).not.toBeVisible()
    expect(await drawLayerHasContent(page)).toBe(false)
  })

  test('Select — clicking away deselects; clicking the node re-selects it', async ({ page }) => {
    // Place a rectangle at canvas center (approx 60,60 → 140,140 in canvas coords)
    await toolBtn(page, 'Shape').click()
    const box = await canvasBox(page)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.move(cx - 40, cy - 40)
    await page.mouse.down()
    await page.mouse.move(cx + 40, cy + 40)
    await page.mouse.up()

    await expect(onAllFrames(page)).toBeVisible({ timeout: 2_000 })

    // Click empty corner to deselect
    await page.mouse.click(box.x + 5, box.y + 5)
    await expect(onAllFrames(page)).not.toBeVisible()

    // Click the shape center to re-select
    await page.mouse.click(cx, cy)
    await expect(onAllFrames(page)).toBeVisible({ timeout: 2_000 })
  })

  test('Select — Undo (Ctrl+Z) restores deleted node', async ({ page }) => {
    await toolBtn(page, 'Shape').click()
    const box = await canvasBox(page)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.move(cx - 50, cy - 40)
    await page.mouse.down()
    await page.mouse.move(cx + 50, cy + 40)
    await page.mouse.up()
    await expect(onAllFrames(page)).toBeVisible({ timeout: 2_000 })

    // Delete the shape
    await page.keyboard.press('Delete')
    expect(await drawLayerHasContent(page)).toBe(false)

    // Undo
    await page.keyboard.press('Control+z')
    await waitForDrawContent(page)
  })
})
