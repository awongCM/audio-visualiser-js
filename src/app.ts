import { LocalAudioPlayer } from './audio/localAudioPlayer'
import { ButterchurnVisualizer } from './visualizers/butterchurnVisualizer'
import { SpectrumVisualizer } from './visualizers/spectrumVisualizer'

type VizMode = 'butterchurn' | 'spectrum'

export function createApp(root: HTMLElement): () => void {
  const player = new LocalAudioPlayer()

  root.innerHTML = `
    <div class="app">
      <header class="toolbar">
        <div class="brand">
          <h1>Audio Viz</h1>
          <p>Phase 1 — local files + Butterchurn / spectrum</p>
        </div>
        <div class="controls">
          <button id="demo-button" type="button">Try demo</button>
          <label class="file-button">
            <span>Choose file</span>
            <input id="file-input" type="file" accept="audio/*" hidden />
          </label>
          <button id="play-button" type="button" disabled>Play</button>
          <div class="mode-toggle" role="group" aria-label="Visualizer mode">
            <button id="mode-butterchurn" type="button" class="active">Butterchurn</button>
            <button id="mode-spectrum" type="button">Spectrum</button>
          </div>
          <button id="prev-preset" type="button" title="Previous preset">Prev</button>
          <button id="next-preset" type="button" title="Next preset">Next</button>
        </div>
      </header>

      <main class="stage">
        <canvas id="butterchurn-canvas" class="viz-layer active" aria-label="Butterchurn visualizer"></canvas>
        <canvas id="spectrum-canvas" class="viz-layer" aria-hidden="true"></canvas>
        <div class="overlay">
          <p id="track-name">No track loaded</p>
          <p id="preset-name"></p>
        </div>
      </main>

      <footer class="transport">
        <span id="current-time">0:00</span>
        <input id="seek-bar" type="range" min="0" max="1000" value="0" disabled />
        <span id="duration">0:00</span>
      </footer>

      <p id="status" class="status" role="status"></p>
    </div>
  `

  const fileInput = root.querySelector<HTMLInputElement>('#file-input')!
  const demoButton = root.querySelector<HTMLButtonElement>('#demo-button')!
  const playButton = root.querySelector<HTMLButtonElement>('#play-button')!
  const modeButterchurnButton = root.querySelector<HTMLButtonElement>('#mode-butterchurn')!
  const modeSpectrumButton = root.querySelector<HTMLButtonElement>('#mode-spectrum')!
  const prevPresetButton = root.querySelector<HTMLButtonElement>('#prev-preset')!
  const nextPresetButton = root.querySelector<HTMLButtonElement>('#next-preset')!
  const butterchurnCanvas = root.querySelector<HTMLCanvasElement>('#butterchurn-canvas')!
  const spectrumCanvas = root.querySelector<HTMLCanvasElement>('#spectrum-canvas')!
  const trackName = root.querySelector<HTMLParagraphElement>('#track-name')!
  const presetName = root.querySelector<HTMLParagraphElement>('#preset-name')!
  const currentTimeLabel = root.querySelector<HTMLSpanElement>('#current-time')!
  const durationLabel = root.querySelector<HTMLSpanElement>('#duration')!
  const seekBar = root.querySelector<HTMLInputElement>('#seek-bar')!
  const status = root.querySelector<HTMLParagraphElement>('#status')!

  const butterchurnViz = new ButterchurnVisualizer(player.audioContext, butterchurnCanvas)
  const spectrumViz = new SpectrumVisualizer(spectrumCanvas, player.analyser)

  let mode: VizMode = 'butterchurn'
  let animationFrame = 0
  let isSeeking = false

  const setStatus = (message: string) => {
    status.textContent = message
  }

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0:00'
    }

    const wholeSeconds = Math.floor(seconds)
    const minutes = Math.floor(wholeSeconds / 60)
    const remainder = wholeSeconds % 60
    return `${minutes}:${remainder.toString().padStart(2, '0')}`
  }

  const resizeCanvas = () => {
    const stage = root.querySelector<HTMLElement>('.stage')
    if (!stage) {
      return
    }

    const width = stage.clientWidth
    const height = stage.clientHeight
    const ratio = window.devicePixelRatio || 1

    for (const canvas of [butterchurnCanvas, spectrumCanvas]) {
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    butterchurnViz.resize(width, height)
    spectrumViz.resize(width, height)
  }

  const updateTransport = () => {
    const duration = player.getDuration()
    const currentTime = player.getCurrentTime()

    currentTimeLabel.textContent = formatTime(currentTime)
    durationLabel.textContent = formatTime(duration)

    if (!isSeeking && duration > 0) {
      seekBar.value = String(Math.round((currentTime / duration) * 1000))
    }

    seekBar.disabled = duration <= 0
  }

  const updateModeUi = () => {
    const isButterchurn = mode === 'butterchurn'
    modeButterchurnButton.classList.toggle('active', isButterchurn)
    modeSpectrumButton.classList.toggle('active', !isButterchurn)
    prevPresetButton.disabled = !isButterchurn
    nextPresetButton.disabled = !isButterchurn
    butterchurnCanvas.classList.toggle('active', isButterchurn)
    spectrumCanvas.classList.toggle('active', !isButterchurn)
    butterchurnCanvas.setAttribute('aria-hidden', String(!isButterchurn))
    spectrumCanvas.setAttribute('aria-hidden', String(isButterchurn))
    presetName.textContent = isButterchurn ? butterchurnViz.currentPresetName : 'Canvas frequency bars + waveform'
  }

  const renderFrame = () => {
    if (mode === 'butterchurn') {
      butterchurnViz.render()
    } else {
      spectrumViz.render()
    }

    updateTransport()
    animationFrame = window.requestAnimationFrame(renderFrame)
  }

  const connectVisualizer = () => {
    const source = player.sourceNode
    if (!source) {
      return
    }

    butterchurnViz.connectAudio(source)
  }

  resizeCanvas()
  updateModeUi()
  animationFrame = window.requestAnimationFrame(renderFrame)

  const loadTrack = async (load: () => Promise<void>, label: string) => {
    try {
      setStatus(`Loading ${label}...`)
      await load()
      connectVisualizer()
      trackName.textContent = player.currentFileName
      playButton.disabled = false
      playButton.textContent = 'Play'
      updateTransport()
      setStatus('Ready — tap Play')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load audio'
      setStatus(message)
      playButton.disabled = true
    }
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) {
      return
    }

    await loadTrack(() => player.loadFile(file), file.name)
  })

  demoButton.addEventListener('click', async () => {
    await loadTrack(
      () => player.loadUrl('/demo/demo-track.mp3', 'demo-track.mp3'),
      'demo track',
    )
  })

  playButton.addEventListener('click', async () => {
    try {
      await player.togglePlayback()
      playButton.textContent = player.playbackState === 'playing' ? 'Pause' : 'Play'
      setStatus(player.playbackState === 'playing' ? 'Playing' : 'Paused')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Playback failed'
      setStatus(message)
    }
  })

  modeButterchurnButton.addEventListener('click', () => {
    mode = 'butterchurn'
    updateModeUi()
  })

  modeSpectrumButton.addEventListener('click', () => {
    mode = 'spectrum'
    updateModeUi()
  })

  prevPresetButton.addEventListener('click', () => {
    butterchurnViz.previousPreset()
    updateModeUi()
  })

  nextPresetButton.addEventListener('click', () => {
    butterchurnViz.nextPreset()
    updateModeUi()
  })

  seekBar.addEventListener('pointerdown', () => {
    isSeeking = true
  })

  seekBar.addEventListener('pointerup', () => {
    isSeeking = false
  })

  seekBar.addEventListener('input', () => {
    const ratio = Number(seekBar.value) / 1000
    player.seek(ratio)
    updateTransport()
  })

  player.element.addEventListener('ended', () => {
    playButton.textContent = 'Play'
    setStatus('Playback finished')
  })

  window.addEventListener('resize', resizeCanvas)

  return () => {
    window.cancelAnimationFrame(animationFrame)
    window.removeEventListener('resize', resizeCanvas)
    player.dispose()
  }
}
