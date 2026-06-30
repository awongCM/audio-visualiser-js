import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const demoAudioPath = path.join(rootDir, 'public/demo/demo-track.mp3')
const outputDir = process.env.DEMO_OUTPUT_DIR ?? '/opt/cursor/artifacts/screenshots'
const baseUrl = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:4173'

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
})

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})

const page = await context.newPage()

console.log(`Opening ${baseUrl}`)
await page.goto(baseUrl, { waitUntil: 'networkidle' })
await page.waitForSelector('#butterchurn-canvas')

await page.screenshot({
  path: path.join(outputDir, '01-idle.png'),
  fullPage: false,
})
console.log('Captured idle state')

const fileInput = page.locator('#file-input')
await fileInput.setInputFiles(demoAudioPath)
await page.waitForFunction(() => {
  const button = document.querySelector('#play-button')
  return button instanceof HTMLButtonElement && !button.disabled
})
await page.waitForTimeout(500)

await page.screenshot({
  path: path.join(outputDir, '02-track-loaded.png'),
  fullPage: false,
})
console.log('Captured track loaded state')

await page.click('#play-button')
await page.waitForFunction(() => {
  const button = document.querySelector('#play-button')
  return button instanceof HTMLButtonElement && button.textContent === 'Pause'
})
await page.waitForTimeout(2500)

await page.screenshot({
  path: path.join(outputDir, '03-butterchurn-playing.png'),
  fullPage: false,
})
console.log('Captured Butterchurn playing')

await page.click('#next-preset')
await page.waitForTimeout(2000)

await page.screenshot({
  path: path.join(outputDir, '04-butterchurn-preset.png'),
  fullPage: false,
})
console.log('Captured Butterchurn preset change')

await page.evaluate(() => {
  const seekBar = document.querySelector('#seek-bar')
  if (seekBar instanceof HTMLInputElement) {
    seekBar.value = '400'
    seekBar.dispatchEvent(new Event('input', { bubbles: true }))
  }
})

const playLabel = await page.locator('#play-button').textContent()
if (playLabel?.trim() === 'Play') {
  await page.click('#play-button')
}

await page.waitForFunction(() => {
  const button = document.querySelector('#play-button')
  return button instanceof HTMLButtonElement && button.textContent === 'Pause'
})

await page.click('#mode-spectrum')
await page.waitForTimeout(2000)

await page.screenshot({
  path: path.join(outputDir, '05-spectrum-playing.png'),
  fullPage: false,
})
console.log('Captured spectrum mode')

await browser.close()
console.log(`Screenshots saved to ${outputDir}`)
