import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'

const FIXTURE = fileURLToPath(new URL('./fixtures/test.gif', import.meta.url))

test.beforeEach(async ({ page }) => {
  // Clear IndexedDB state between tests so each starts fresh
  await page.goto('/')
  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('gif_editor_db')
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
      req.onblocked = () => resolve() // proceed even if blocked
    }),
  )
  await page.reload()
  // Wait for the app shell to be ready (not restoring)
  await expect(page.locator('.drop-hint')).toBeVisible({ timeout: 10_000 })
})

test('shows empty state on load', async ({ page }) => {
  await expect(page.locator('.drop-hint')).toBeVisible()
  await expect(page.getByText('Drop a GIF here or click')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload GIF' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Export GIF' })).toBeDisabled()
})

test('uploads a GIF and shows the editor', async ({ page }) => {
  const fileInput = page.locator('input[type="file"][accept*="gif"]')
  await fileInput.setInputFiles(FIXTURE)

  // Timeline appears once decode finishes
  await expect(page.locator('.timeline')).toBeVisible({ timeout: 15_000 })

  // Topbar shows filename and frame count
  await expect(page.locator('.topbar-center .filename')).toContainText('test.gif')
  await expect(page.locator('.topbar-center .dim')).toContainText('2 frames')

  // Export becomes enabled
  await expect(page.getByRole('button', { name: 'Export GIF' })).toBeEnabled()

  // Drop hint is gone
  await expect(page.locator('.drop-hint')).not.toBeVisible()
})

test('playback controls work after upload', async ({ page }) => {
  const fileInput = page.locator('input[type="file"][accept*="gif"]')
  await fileInput.setInputFiles(FIXTURE)
  await expect(page.locator('.timeline')).toBeVisible({ timeout: 15_000 })

  const playBtn = page.locator('.play-btn')
  const pauseBtn = page.locator('.pause-btn')

  await expect(playBtn).toBeEnabled()
  await expect(pauseBtn).toBeDisabled()

  await playBtn.click()
  await expect(pauseBtn).toBeEnabled({ timeout: 2_000 })

  await pauseBtn.click()
  await expect(playBtn).toBeEnabled({ timeout: 2_000 })
})

test('Start Over modal: cancel keeps the project', async ({ page }) => {
  const fileInput = page.locator('input[type="file"][accept*="gif"]')
  await fileInput.setInputFiles(FIXTURE)
  await expect(page.locator('.timeline')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Start Over' }).click()
  await expect(page.getByText('Start over?')).toBeVisible()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('Start over?')).not.toBeVisible()
  // Timeline still there
  await expect(page.locator('.timeline')).toBeVisible()
})

test('Start Over modal: confirm clears the project', async ({ page }) => {
  const fileInput = page.locator('input[type="file"][accept*="gif"]')
  await fileInput.setInputFiles(FIXTURE)
  await expect(page.locator('.timeline')).toBeVisible({ timeout: 15_000 })

  await page.getByRole('button', { name: 'Start Over' }).click()
  await expect(page.getByText('Start over?')).toBeVisible()

  // The confirm button text is also "Start Over" — use last() to pick the modal one
  await page.getByRole('button', { name: 'Start Over' }).last().click()

  // Back to empty state
  await expect(page.locator('.drop-hint')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('.timeline')).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Export GIF' })).toBeDisabled()
})

test('tool panel is visible and tools are selectable', async ({ page }) => {
  const fileInput = page.locator('input[type="file"][accept*="gif"]')
  await fileInput.setInputFiles(FIXTURE)
  await expect(page.locator('.timeline')).toBeVisible({ timeout: 15_000 })

  const panel = page.locator('.left-panel')
  await expect(panel).toBeVisible()

  // Click the Draw tool and verify it becomes active
  const drawBtn = panel.locator('.tool-btn', { hasText: 'Draw' })
  await drawBtn.click()
  await expect(drawBtn).toHaveClass(/active/)
})
