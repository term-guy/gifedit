import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'url'

const FIXTURE = fileURLToPath(new URL('./fixtures/test.gif', import.meta.url))

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

async function uploadGif(page: Page) {
  await page.locator('input[type="file"][accept*="gif"]').setInputFiles(FIXTURE)
  await expect(page.locator('.timeline')).toBeVisible({ timeout: 15_000 })
}

// Helpers to locate tool buttons and the props panel
const toolBtn = (page: Page, label: string) =>
  page.locator('.left-panel .tool-btn', { hasText: label })

const props = (page: Page) => page.locator('.props-panel')

test.describe('Tools', () => {
  test.beforeEach(async ({ page }) => {
    await freshPage(page)
    await uploadGif(page)
  })

  test('Select — activates and shows frame delay controls', async ({ page }) => {
    const btn = toolBtn(page, 'Select')
    await btn.click()
    await expect(btn).toHaveClass(/active/)

    // Frame delay input always visible in Select/default mode
    await expect(props(page).getByText('Frame delay', { exact: false })).toBeVisible()
    await expect(props(page).locator('input[type="number"]')).toBeVisible()
  })

  test('Draw — activates and shows brush size + color', async ({ page }) => {
    const btn = toolBtn(page, 'Draw')
    await btn.click()
    await expect(btn).toHaveClass(/active/)

    await expect(props(page).getByText('Brush size', { exact: false })).toBeVisible()
    // Brush size slider
    await expect(props(page).locator('input[type="range"]').first()).toBeVisible()
    // Color label
    await expect(props(page).getByText('Color', { exact: true })).toBeVisible()
  })

  test('Draw — brush size slider changes value', async ({ page }) => {
    await toolBtn(page, 'Draw').click()
    const slider = props(page).locator('input[type="range"]').first()
    // Drag slider to max to verify reactivity
    await slider.evaluate((el: HTMLInputElement) => {
      el.value = String(el.max)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // The label updates to show the new size
    await expect(props(page).locator('.mono').first()).not.toHaveText('1px')
  })

  test('Erase — activates and shows eraser size', async ({ page }) => {
    const btn = toolBtn(page, 'Erase')
    await btn.click()
    await expect(btn).toHaveClass(/active/)

    await expect(props(page).getByText('Eraser size', { exact: false })).toBeVisible()
    await expect(props(page).locator('input[type="range"]')).toBeVisible()
  })

  test('Fill — activates and shows fill color + tolerance', async ({ page }) => {
    const btn = toolBtn(page, 'Fill')
    await btn.click()
    await expect(btn).toHaveClass(/active/)

    await expect(props(page).getByText('Fill color', { exact: true })).toBeVisible()
    await expect(props(page).getByText('Tolerance', { exact: false })).toBeVisible()
    // Two sliders: tolerance range
    await expect(props(page).locator('input[type="range"]')).toBeVisible()
  })

  test('Shape — activates and shows shape type selector', async ({ page }) => {
    const btn = toolBtn(page, 'Shape')
    await btn.click()
    await expect(btn).toHaveClass(/active/)

    await expect(props(page).getByText('Shape', { exact: true })).toBeVisible()
    const shapeSelect = props(page).locator('select').first()
    await expect(shapeSelect).toBeVisible()
    // Default is square — all three options must exist
    await expect(shapeSelect.locator('option[value="square"]')).toHaveCount(1)
    await expect(shapeSelect.locator('option[value="rectangle"]')).toHaveCount(1)
    await expect(shapeSelect.locator('option[value="circle"]')).toHaveCount(1)
  })

  test('Shape — square shows Roundness slider, circle does not', async ({ page }) => {
    await toolBtn(page, 'Shape').click()
    const shapeSelect = props(page).locator('select').first()

    // Default is rectangle — no Roundness
    await expect(props(page).getByText('Roundness', { exact: false })).not.toBeVisible()

    await shapeSelect.selectOption('square')
    await expect(props(page).getByText('Roundness', { exact: false })).toBeVisible()

    await shapeSelect.selectOption('circle')
    await expect(props(page).getByText('Roundness', { exact: false })).not.toBeVisible()
  })

  test('Shape — stroke is on by default; unchecking hides stroke controls', async ({ page }) => {
    await toolBtn(page, 'Shape').click()

    // shapeStroke defaults to true
    await expect(props(page).getByText('Stroke color')).toBeVisible()
    await expect(props(page).getByText('Stroke width', { exact: false })).toBeVisible()

    await props(page).locator('input[type="checkbox"]').click()
    await expect(props(page).getByText('Stroke color')).not.toBeVisible()
    await expect(props(page).getByText('Stroke width', { exact: false })).not.toBeVisible()
  })

  test('Text — activates, shows font/size/color and opens animation panel', async ({ page }) => {
    const btn = toolBtn(page, 'Text')
    await btn.click()
    await expect(btn).toHaveClass(/active/)

    await expect(props(page).getByText('Font', { exact: true })).toBeVisible()
    await expect(props(page).getByText('Size', { exact: false })).toBeVisible()
    await expect(props(page).getByText('Color', { exact: true })).toBeVisible()
    // Bold / Italic checkboxes
    await expect(props(page).locator('input[type="checkbox"]')).toHaveCount(2)

    // Text animation panel slides in
    await expect(page.locator('.anim-panel')).toBeVisible()
  })

  test('Text — closing animation panel with ✕ hides it', async ({ page }) => {
    await toolBtn(page, 'Text').click()
    await expect(page.locator('.anim-panel')).toBeVisible()

    await page.locator('.anim-panel .close-btn').click()
    await expect(page.locator('.anim-panel')).not.toBeVisible()
  })

  test('Text — font selector has expected options', async ({ page }) => {
    await toolBtn(page, 'Text').click()
    const fontSelect = props(page).locator('select').first()
    for (const font of ['DM Sans', 'Impact', 'Arial', 'JetBrains Mono']) {
      await expect(fontSelect.locator(`option`, { hasText: font })).toHaveCount(1)
    }
  })

  test('Sticker — activates and opens sticker picker', async ({ page }) => {
    const btn = toolBtn(page, 'Sticker')
    await btn.click()
    await expect(btn).toHaveClass(/active/)

    await expect(page.locator('.sticker-panel')).toBeVisible()
  })

  test('Sticker — closing picker with ✕ hides it', async ({ page }) => {
    await toolBtn(page, 'Sticker').click()
    await expect(page.locator('.sticker-panel')).toBeVisible()

    await page.locator('.sticker-panel .close-btn').click()
    await expect(page.locator('.sticker-panel')).not.toBeVisible()
  })

  test('switching tools deactivates the previous tool', async ({ page }) => {
    await toolBtn(page, 'Draw').click()
    await expect(toolBtn(page, 'Draw')).toHaveClass(/active/)

    await toolBtn(page, 'Erase').click()
    await expect(toolBtn(page, 'Erase')).toHaveClass(/active/)
    await expect(toolBtn(page, 'Draw')).not.toHaveClass(/active/)

    // Draw props gone, Erase props shown
    await expect(props(page).getByText('Brush size', { exact: false })).not.toBeVisible()
    await expect(props(page).getByText('Eraser size', { exact: false })).toBeVisible()
  })

  test('switching away from Text closes the animation panel', async ({ page }) => {
    await toolBtn(page, 'Text').click()
    await expect(page.locator('.anim-panel')).toBeVisible()

    await toolBtn(page, 'Draw').click()
    await expect(page.locator('.anim-panel')).not.toBeVisible()
  })

  test('switching away from Sticker closes the sticker picker', async ({ page }) => {
    await toolBtn(page, 'Sticker').click()
    await expect(page.locator('.sticker-panel')).toBeVisible()

    await toolBtn(page, 'Select').click()
    await expect(page.locator('.sticker-panel')).not.toBeVisible()
  })
})
