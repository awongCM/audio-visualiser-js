import { buildAuthorizeUrl } from './auth/spotifyPkce'
import { SpotifyAuthService } from './auth/spotifyAuthService'
import { AnalysisSyncController } from './analysis/analysisSyncController'
import { createSyntheticAudioLevels } from './analysis/syntheticLevels'
import { createSpotifyPulseLevels } from './audio/spotifyPulseLevels'
import { LocalAudioSourceAdapter } from './audio/localAudioSource'
import { LocalAudioPlayer } from './audio/localAudioPlayer'
import { SpotifyPlaybackPlayer } from './audio/spotifyPlaybackPlayer'
import { isSpotifyConfigured, spotifyConfig } from './config/spotify'
import { ButterchurnVisualizer } from './visualizers/butterchurnVisualizer'
import { SpectrumVisualizer } from './visualizers/spectrumVisualizer'

type VizMode = 'butterchurn' | 'spectrum'
type SourceMode = 'local' | 'spotify'

export interface AppOptions {
  auth?: SpotifyAuthService
  analysis?: AnalysisSyncController
  justAuthenticated?: boolean
}

export function createApp(root: HTMLElement, options: AppOptions = {}): () => void {
  const auth = options.auth ?? new SpotifyAuthService()
  const analysis = options.analysis ?? new AnalysisSyncController(auth)
  const localPlayer = new LocalAudioPlayer()
  const localSource = new LocalAudioSourceAdapter(localPlayer)
  let spotifyPlayer = new SpotifyPlaybackPlayer(auth)

  let sourceMode: SourceMode = 'local'
  let spotifyReady = false
  let analysisSyncEnabled = false
  let autoPresetOnSection = true
  let lastAutoLoadedTrackId: string | null = null
  let analysisRequest: Promise<void> | null = null

  root.innerHTML = `
    <div class="app">
      <header class="toolbar">
        <div class="brand">
          <h1>Audio Viz</h1>
          <p>Phase 2 — Spotify playback + analysis sync</p>
        </div>
        <div class="controls">
          <div class="source-toggle" role="group" aria-label="Audio source">
            <button id="source-local" type="button" class="active">Local</button>
            <button id="source-spotify" type="button" ${isSpotifyConfigured() ? '' : 'disabled'}>Spotify</button>
          </div>
          <div id="local-controls" class="source-panel">
            <button id="demo-button" type="button">Try demo</button>
            <label class="file-button">
              <span>Choose file</span>
              <input id="file-input" type="file" accept="audio/*" hidden />
            </label>
          </div>
          <div id="spotify-controls" class="source-panel hidden">
            <button id="spotify-login" type="button">Connect Spotify</button>
            <button id="spotify-demo" type="button" disabled>Play Today's Top Hits</button>
            <button id="spotify-logout" type="button" class="ghost hidden">Disconnect</button>
          </div>
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
          <input id="track-id-input" class="track-input" type="text" placeholder="Spotify track ID (local mode)" />
          <button id="fetch-analysis" type="button" disabled>Load analysis</button>
          <p id="spotify-track-id" class="spotify-track-id hidden"></p>
        </div>
      </header>

      <main class="stage">
        <canvas id="butterchurn-canvas" class="viz-layer active" aria-label="Butterchurn visualizer"></canvas>
        <canvas id="spectrum-canvas" class="viz-layer" aria-hidden="true"></canvas>
        <canvas id="timeline-canvas" class="timeline-layer" aria-hidden="true"></canvas>
        <div class="overlay">
          <p id="track-name">No track loaded</p>
          <p id="preset-name"></p>
          <p id="sync-status" class="sync-status">Analysis sync off</p>
          <p id="source-note" class="source-note"></p>
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
  const sourceLocalButton = root.querySelector<HTMLButtonElement>('#source-local')!
  const sourceSpotifyButton = root.querySelector<HTMLButtonElement>('#source-spotify')!
  const localControls = root.querySelector<HTMLDivElement>('#local-controls')!
  const spotifyControls = root.querySelector<HTMLDivElement>('#spotify-controls')!
  const spotifyLoginButton = root.querySelector<HTMLButtonElement>('#spotify-login')!
  const spotifyDemoButton = root.querySelector<HTMLButtonElement>('#spotify-demo')!
  const spotifyLogoutButton = root.querySelector<HTMLButtonElement>('#spotify-logout')!
  const syncEnabledInput = root.querySelector<HTMLInputElement>('#sync-enabled')!
  const trackIdInput = root.querySelector<HTMLInputElement>('#track-id-input')!
  const fetchAnalysisButton = root.querySelector<HTMLButtonElement>('#fetch-analysis')!
  const spotifyTrackIdLabel = root.querySelector<HTMLParagraphElement>('#spotify-track-id')!
  const modeButterchurnButton = root.querySelector<HTMLButtonElement>('#mode-butterchurn')!
  const modeSpectrumButton = root.querySelector<HTMLButtonElement>('#mode-spectrum')!
  const prevPresetButton = root.querySelector<HTMLButtonElement>('#prev-preset')!
  const nextPresetButton = root.querySelector<HTMLButtonElement>('#next-preset')!
  const butterchurnCanvas = root.querySelector<HTMLCanvasElement>('#butterchurn-canvas')!
  const spectrumCanvas = root.querySelector<HTMLCanvasElement>('#spectrum-canvas')!
  const timelineCanvas = root.querySelector<HTMLCanvasElement>('#timeline-canvas')!
  const trackName = root.querySelector<HTMLParagraphElement>('#track-name')!
  const presetName = root.querySelector<HTMLParagraphElement>('#preset-name')!
  const syncStatus = root.querySelector<HTMLParagraphElement>('#sync-status')!
  const sourceNote = root.querySelector<HTMLParagraphElement>('#source-note')!
  const currentTimeLabel = root.querySelector<HTMLSpanElement>('#current-time')!
  const durationLabel = root.querySelector<HTMLSpanElement>('#duration')!
  const seekBar = root.querySelector<HTMLInputElement>('#seek-bar')!
  const status = root.querySelector<HTMLParagraphElement>('#status')!

  const butterchurnViz = new ButterchurnVisualizer(localPlayer.audioContext, butterchurnCanvas)
  const spectrumViz = new SpectrumVisualizer(spectrumCanvas, localPlayer.analyser)
  const timelineCtx = timelineCanvas.getContext('2d')

  let mode: VizMode = 'butterchurn'
  let animationFrame = 0
  let isSeeking = false

  const activeSource = () => (sourceMode === 'local' ? localSource : spotifyPlayer)

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
    spotifyDemoButton.disabled = !authenticated || !spotifyReady
    fetchAnalysisButton.disabled = !authenticated || sourceMode !== 'local'
  }

  const updateSyncUi = () => {
    const loaded = analysis.analysisLoaded
    const isSpotify = sourceMode === 'spotify'

    trackIdInput.classList.toggle('hidden', isSpotify)
    fetchAnalysisButton.classList.toggle('hidden', isSpotify)
    spotifyTrackIdLabel.classList.toggle('hidden', !isSpotify || !spotifyPlayer.trackId)

    if (isSpotify && spotifyPlayer.trackId) {
      spotifyTrackIdLabel.textContent = `Spotify track: ${spotifyPlayer.trackId}`
    }

    syncStatus.textContent = analysisSyncEnabled
      ? loaded
        ? `Analysis sync on — ${analysis.engine.sections.length} sections`
        : 'Analysis sync on — waiting for track analysis'
      : 'Analysis sync off'

    sourceNote.textContent = isSpotify
      ? 'Spotify tracks auto-load analysis. Spectrum stays local-only.'
      : ''
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
    const source = activeSource()
    const duration = source.getDuration()
    const currentTime = source.getCurrentTime()

    currentTimeLabel.textContent = formatTime(currentTime)
    durationLabel.textContent = formatTime(duration)
    trackName.textContent = source.currentLabel

    if (!isSeeking && duration > 0) {
      seekBar.value = String(Math.round((currentTime / duration) * 1000))
    }

    seekBar.disabled = duration <= 0
    drawTimeline(currentTime, duration)
  }

  const updateSourceUi = () => {
    const isLocal = sourceMode === 'local'
    sourceLocalButton.classList.toggle('active', isLocal)
    sourceSpotifyButton.classList.toggle('active', !isLocal)
    localControls.classList.toggle('hidden', !isLocal)
    spotifyControls.classList.toggle('hidden', isLocal)

    modeSpectrumButton.disabled = !isLocal
    if (!isLocal && mode === 'spectrum') {
      mode = 'butterchurn'
    }

    playButton.disabled = isLocal
      ? localSource.playbackState === 'idle'
      : !auth.tokens.isAuthenticated() || !spotifyReady

    const playbackState = activeSource().playbackState
    playButton.textContent = playbackState === 'playing' ? 'Pause' : 'Play'

    updateAuthUi()
    updateModeUi()
    updateSyncUi()
    updateTransport()
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

  const connectVisualizer = () => {
    if (sourceMode !== 'local') {
      return
    }

    const source = localSource.sourceNode
    if (!source) {
      return
    }

    butterchurnViz.connectAudio(source)
  }

  const enableAnalysisSync = () => {
    analysisSyncEnabled = true
    syncEnabledInput.checked = true
    autoPresetOnSection = true
    updateSyncUi()
  }

  const loadAnalysisForTrack = async (trackId: string, label: string) => {
    if (!auth.tokens.isAuthenticated() || trackId === lastAutoLoadedTrackId) {
      return
    }

    if (analysisRequest) {
      await analysisRequest
      if (trackId === lastAutoLoadedTrackId) {
        return
      }
    }

    const request = (async () => {
      try {
        setStatus(`Loading analysis for ${label}...`)
        await analysis.loadForTrackId(trackId)
        lastAutoLoadedTrackId = trackId
        trackIdInput.value = trackId
        enableAnalysisSync()
        setStatus(`Analysis sync ready for ${label}`)
        updateSyncUi()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load analysis'
        setStatus(message)
      } finally {
        analysisRequest = null
      }
    })()

    analysisRequest = request
    await request
  }

  const renderFrame = () => {
    if (mode === 'butterchurn') {
      const source = activeSource()
      const currentTime = source.getCurrentTime()
      const duration = source.getDuration()
      const playing = source.playbackState === 'playing'

      if (analysisSyncEnabled && analysis.analysisLoaded) {
        const snapshot = analysis.engine.update(currentTime)
        butterchurnViz.setSyntheticLevels(createSyntheticAudioLevels(snapshot))
      } else if (sourceMode === 'spotify') {
        butterchurnViz.setSyntheticLevels(
          createSpotifyPulseLevels(currentTime, duration, playing),
        )
      } else {
        butterchurnViz.setSyntheticLevels(null)
      }

      butterchurnViz.render()
    } else if (sourceMode === 'local') {
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

  const wireSpotifyPlayer = (player: SpotifyPlaybackPlayer) => {
    player.setErrorHandler((message) => setStatus(message))
    player.setTrackChangeHandler((trackId) => {
      if (sourceMode !== 'spotify') {
        return
      }

      void loadAnalysisForTrack(trackId, player.currentLabel)
    })
  }

  wireSpotifyPlayer(spotifyPlayer)

  const initializeSpotify = async () => {
    try {
      setStatus('Connecting Spotify player...')
      await spotifyPlayer.initialize()
      spotifyReady = true
      updateSourceUi()

      const trackId = spotifyPlayer.trackId
      if (trackId) {
        void loadAnalysisForTrack(trackId, spotifyPlayer.currentLabel)
      }

      setStatus('Spotify connected — start playback or try Today\'s Top Hits')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Spotify connection failed'
      setStatus(message)
    }
  }

  resizeCanvas()
  updateSourceUi()
  animationFrame = window.requestAnimationFrame(renderFrame)

  if (options.justAuthenticated && auth.tokens.isAuthenticated()) {
    sourceMode = 'spotify'
    updateSourceUi()
    void initializeSpotify()
  }

  if (!isSpotifyConfigured()) {
    sourceSpotifyButton.title = 'Set VITE_SPOTIFY_CLIENT_ID in .env'
  }

  const loadLocalTrack = async (load: () => Promise<void>, label: string) => {
    try {
      setStatus(`Loading ${label}...`)
      await load()
      connectVisualizer()
      playButton.disabled = false
      playButton.textContent = 'Play'
      updateSourceUi()
      setStatus('Ready — paste a matching Spotify track ID for analysis sync')
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

    lastAutoLoadedTrackId = null
    await loadLocalTrack(() => localSource.loadFile(file), file.name)
  })

  demoButton.addEventListener('click', async () => {
    lastAutoLoadedTrackId = null
    await loadLocalTrack(
      () => localSource.loadUrl('/demo/demo-track.mp3', 'demo-track.mp3'),
      'demo track',
    )
  })

  playButton.addEventListener('click', async () => {
    try {
      await activeSource().togglePlayback()
      updateSourceUi()
      const playbackState = activeSource().playbackState
      setStatus(playbackState === 'playing' ? 'Playing' : 'Paused')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Playback failed'
      setStatus(message)
    }
  })

  sourceLocalButton.addEventListener('click', () => {
    sourceMode = 'local'
    updateSourceUi()
  })

  sourceSpotifyButton.addEventListener('click', () => {
    if (!isSpotifyConfigured()) {
      setStatus('Add VITE_SPOTIFY_CLIENT_ID to .env and restart the dev server')
      return
    }

    sourceMode = 'spotify'
    updateSourceUi()

    if (auth.tokens.isAuthenticated() && !spotifyReady) {
      void initializeSpotify()
    } else if (spotifyReady && spotifyPlayer.trackId) {
      void loadAnalysisForTrack(spotifyPlayer.trackId, spotifyPlayer.currentLabel)
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
    lastAutoLoadedTrackId = null
    spotifyPlayer.disconnect()
    spotifyPlayer = new SpotifyPlaybackPlayer(auth)
    wireSpotifyPlayer(spotifyPlayer)
    spotifyReady = false
    sourceMode = 'local'
    updateSourceUi()
    setStatus('Disconnected from Spotify')
  })

  spotifyDemoButton.addEventListener('click', async () => {
    try {
      await spotifyPlayer.startDemoPlayback()
      playButton.disabled = false
      updateSourceUi()
      setStatus('Playing Today\'s Top Hits on your Audio Viz device')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start Spotify playback'
      setStatus(message)
    }
  })

  modeButterchurnButton.addEventListener('click', () => {
    mode = 'butterchurn'
    updateModeUi()
  })

  modeSpectrumButton.addEventListener('click', () => {
    if (sourceMode !== 'local') {
      return
    }

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
      lastAutoLoadedTrackId = analysis.activeTrackId
      enableAnalysisSync()
      setStatus(`Analysis loaded for track ${analysis.activeTrackId}`)
      updateSyncUi()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load analysis'
      setStatus(message)
    }
  })

  seekBar.addEventListener('pointerdown', () => {
    isSeeking = true
  })

  seekBar.addEventListener('pointerup', () => {
    isSeeking = false
  })

  seekBar.addEventListener('input', () => {
    const ratio = Number(seekBar.value) / 1000
    activeSource().seek(ratio)
    analysis.engine.resetEventIndices()
    updateTransport()
  })

  localPlayer.element.addEventListener('ended', () => {
    if (sourceMode !== 'local') {
      return
    }

    playButton.textContent = 'Play'
    setStatus('Playback finished')
  })

  window.addEventListener('resize', resizeCanvas)

  return () => {
    window.cancelAnimationFrame(animationFrame)
    window.removeEventListener('resize', resizeCanvas)
    localSource.dispose()
    spotifyPlayer.dispose()
  }
}
