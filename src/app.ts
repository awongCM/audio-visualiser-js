import { buildAuthorizeUrl } from './auth/spotifyPkce'
import { SpotifyAuthService } from './auth/spotifyAuthService'
import { AnalysisSyncController } from './analysis/analysisSyncController'
import { createSyntheticAudioLevels } from './analysis/syntheticLevels'
import { LocalAudioPlayer } from './audio/localAudioPlayer'
import { isSpotifyConfigured, spotifyConfig } from './config/spotify'
import { ButterchurnVisualizer } from './visualizers/butterchurnVisualizer'
import { SpectrumVisualizer } from './visualizers/spectrumVisualizer'

type VizMode = 'butterchurn' | 'spectrum'

export interface AppOptions {
  auth?: SpotifyAuthService
  analysis?: AnalysisSyncController
}

export function createApp(root: HTMLElement, options: AppOptions = {}): () => void {
  const auth = options.auth ?? new SpotifyAuthService()
  const analysis = options.analysis ?? new AnalysisSyncController(auth)
  const player = new LocalAudioPlayer()

  root.innerHTML = `
    <div class="app">
      <header class="toolbar">
        <div class="brand">
          <h1>Audio Viz</h1>
          <p>Phase 2b — Audio Analysis sync</p>
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
        <div class="analysis-controls">
          <label class="sync-toggle">
            <input id="sync-enabled" type="checkbox" />
            <span>Analysis sync</span>
          </label>
          <input id="track-id-input" class="track-input" type="text" placeholder="Spotify track ID for the audio you're playing" />
          <button id="fetch-analysis" type="button" disabled>Load analysis</button>
          <button id="spotify-login" type="button">Connect Spotify</button>
          <button id="spotify-logout" type="button" class="ghost hidden">Disconnect</button>
        </div>
      </header>

      <main class="stage">
        <canvas id="butterchurn-canvas" class="viz-layer active" aria-label="Butterchurn visualizer"></canvas>
        <canvas id="spectrum-canvas" class="viz-layer" aria-hidden="true"></canvas>
        <canvas id="timeline-canvas" class="timeline-layer" aria-hidden="true"></canvas>
        <div class="overlay">
          <p id="track-name">No track loaded</p>
          <p id="preset-name"></p>
          <p id="sync-status" class="sync-status">Analysis sync off — live Web Audio analyser</p>
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
  const syncEnabledInput = root.querySelector<HTMLInputElement>('#sync-enabled')!
  const trackIdInput = root.querySelector<HTMLInputElement>('#track-id-input')!
  const fetchAnalysisButton = root.querySelector<HTMLButtonElement>('#fetch-analysis')!
  const spotifyLoginButton = root.querySelector<HTMLButtonElement>('#spotify-login')!
  const spotifyLogoutButton = root.querySelector<HTMLButtonElement>('#spotify-logout')!
  const butterchurnCanvas = root.querySelector<HTMLCanvasElement>('#butterchurn-canvas')!
  const spectrumCanvas = root.querySelector<HTMLCanvasElement>('#spectrum-canvas')!
  const timelineCanvas = root.querySelector<HTMLCanvasElement>('#timeline-canvas')!
  const trackName = root.querySelector<HTMLParagraphElement>('#track-name')!
  const presetName = root.querySelector<HTMLParagraphElement>('#preset-name')!
  const syncStatus = root.querySelector<HTMLParagraphElement>('#sync-status')!
  const currentTimeLabel = root.querySelector<HTMLSpanElement>('#current-time')!
  const durationLabel = root.querySelector<HTMLSpanElement>('#duration')!
  const seekBar = root.querySelector<HTMLInputElement>('#seek-bar')!
  const status = root.querySelector<HTMLParagraphElement>('#status')!

  const butterchurnViz = new ButterchurnVisualizer(player.audioContext, butterchurnCanvas)
  const spectrumViz = new SpectrumVisualizer(spectrumCanvas, player.analyser)
  const timelineCtx = timelineCanvas.getContext('2d')

  let mode: VizMode = 'butterchurn'
  let animationFrame = 0
  let isSeeking = false
  let analysisSyncEnabled = false
  let autoPresetOnSection = true

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

  const updateAuthUi = () => {
    const authenticated = auth.tokens.isAuthenticated()
    spotifyLoginButton.classList.toggle('hidden', authenticated)
    spotifyLogoutButton.classList.toggle('hidden', !authenticated)
    fetchAnalysisButton.disabled = !authenticated
  }

  const updateSyncUi = () => {
    const loaded = analysis.analysisLoaded
    syncStatus.textContent = analysisSyncEnabled
      ? loaded
        ? `Analysis sync on — section ${analysis.engine.sections.length} markers, beat-driven levels`
        : 'Analysis sync on — load a Spotify track analysis first'
      : 'Analysis sync off — live Web Audio analyser'

    if (analysisSyncEnabled && loaded && mode === 'butterchurn') {
      // Levels are applied each frame in renderFrame()
    } else if (!analysisSyncEnabled) {
      butterchurnViz.setSyntheticLevels(null)
    }
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

    timelineCanvas.width = Math.floor(width * ratio)
    timelineCanvas.height = Math.floor(28 * ratio)
    timelineCanvas.style.width = `${width}px`
    timelineCanvas.style.height = '28px'

    butterchurnViz.resize(width, height)
    spectrumViz.resize(width, height)
  }

  const drawTimeline = (currentTime: number, duration: number) => {
    if (!timelineCtx || !analysis.analysisLoaded || duration <= 0) {
      timelineCanvas.style.opacity = '0'
      return
    }

    timelineCanvas.style.opacity = '1'
    const ratio = window.devicePixelRatio || 1
    const width = timelineCanvas.width / ratio
    const height = 28

    timelineCtx.setTransform(ratio, 0, 0, ratio, 0, 0)
    timelineCtx.clearRect(0, 0, width, height)
    timelineCtx.fillStyle = 'rgba(5, 6, 13, 0.75)'
    timelineCtx.fillRect(0, 0, width, height)

    for (const section of analysis.engine.sections) {
      const x = (section.start / duration) * width
      const w = (section.duration / duration) * width
      timelineCtx.fillStyle = 'rgba(109, 91, 255, 0.35)'
      timelineCtx.fillRect(x, 4, Math.max(1, w), height - 8)
    }

    const playhead = (currentTime / duration) * width
    timelineCtx.fillStyle = '#7cf7ff'
    timelineCtx.fillRect(playhead, 0, 2, height)
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
    drawTimeline(currentTime, duration)
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
    updateSyncUi()
  }

  const connectVisualizer = () => {
    const source = player.sourceNode
    if (!source) {
      return
    }

    butterchurnViz.connectAudio(source)
  }

  const renderFrame = () => {
    const currentTime = player.getCurrentTime()

    if (analysisSyncEnabled && analysis.analysisLoaded && mode === 'butterchurn') {
      const snapshot = analysis.engine.update(currentTime)
      butterchurnViz.setSyntheticLevels(createSyntheticAudioLevels(snapshot))
      butterchurnViz.render()
    } else if (mode === 'butterchurn') {
      butterchurnViz.setSyntheticLevels(null)
      butterchurnViz.render()
    } else {
      spectrumViz.render()
    }

    updateTransport()
    animationFrame = window.requestAnimationFrame(renderFrame)
  }

  analysis.engine.on('section', () => {
    if (!analysisSyncEnabled || !autoPresetOnSection) {
      return
    }

    butterchurnViz.nextPreset()
    updateModeUi()
  })

  resizeCanvas()
  updateModeUi()
  updateAuthUi()
  animationFrame = window.requestAnimationFrame(renderFrame)

  if (!isSpotifyConfigured()) {
    spotifyLoginButton.title = 'Set VITE_SPOTIFY_CLIENT_ID in .env'
  }

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
    setStatus('Demo loaded — paste the matching Spotify track ID, then Load analysis')
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
    autoPresetOnSection = false
    butterchurnViz.previousPreset()
    updateModeUi()
  })

  nextPresetButton.addEventListener('click', () => {
    autoPresetOnSection = false
    butterchurnViz.nextPreset()
    updateModeUi()
  })

  syncEnabledInput.addEventListener('change', () => {
    analysisSyncEnabled = syncEnabledInput.checked
    updateSyncUi()
  })

  fetchAnalysisButton.addEventListener('click', async () => {
    try {
      setStatus('Fetching audio analysis...')
      await analysis.loadForTrackInput(trackIdInput.value)
      analysisSyncEnabled = true
      syncEnabledInput.checked = true
      autoPresetOnSection = true
      updateSyncUi()
      setStatus(`Analysis loaded for track ${analysis.activeTrackId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load analysis'
      setStatus(message)
    }
  })

  spotifyLoginButton.addEventListener('click', async () => {
    if (!isSpotifyConfigured()) {
      setStatus('Add VITE_SPOTIFY_CLIENT_ID to .env and restart the dev server')
      return
    }

    const url = await buildAuthorizeUrl(
      spotifyConfig.clientId,
      spotifyConfig.redirectUri,
      spotifyConfig.scopes,
    )
    window.location.assign(url)
  })

  spotifyLogoutButton.addEventListener('click', () => {
    auth.tokens.clear()
    analysis.clear()
    analysisSyncEnabled = false
    syncEnabledInput.checked = false
    updateAuthUi()
    updateSyncUi()
    setStatus('Disconnected from Spotify')
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
    analysis.engine.resetEventIndices()
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
