import { buildAuthorizeUrl } from './auth/spotifyPkce'
import { SpotifyAuthService } from './auth/spotifyAuthService'
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
  justAuthenticated?: boolean
}

export function createApp(root: HTMLElement, options: AppOptions = {}): () => void {
  const auth = options.auth ?? new SpotifyAuthService()
  const localPlayer = new LocalAudioPlayer()
  const localSource = new LocalAudioSourceAdapter(localPlayer)
  let spotifyPlayer = new SpotifyPlaybackPlayer(auth)

  let sourceMode: SourceMode = 'local'
  let spotifyReady = false

  root.innerHTML = `
    <div class="app">
      <header class="toolbar">
        <div class="brand">
          <h1>Audio Viz</h1>
          <p>Phase 2a — Spotify OAuth + Web Playback SDK</p>
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
      </header>

      <main class="stage">
        <canvas id="butterchurn-canvas" class="viz-layer active" aria-label="Butterchurn visualizer"></canvas>
        <canvas id="spectrum-canvas" class="viz-layer" aria-hidden="true"></canvas>
        <div class="overlay">
          <p id="track-name">No track loaded</p>
          <p id="preset-name"></p>
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
  const modeButterchurnButton = root.querySelector<HTMLButtonElement>('#mode-butterchurn')!
  const modeSpectrumButton = root.querySelector<HTMLButtonElement>('#mode-spectrum')!
  const prevPresetButton = root.querySelector<HTMLButtonElement>('#prev-preset')!
  const nextPresetButton = root.querySelector<HTMLButtonElement>('#next-preset')!
  const butterchurnCanvas = root.querySelector<HTMLCanvasElement>('#butterchurn-canvas')!
  const spectrumCanvas = root.querySelector<HTMLCanvasElement>('#spectrum-canvas')!
  const trackName = root.querySelector<HTMLParagraphElement>('#track-name')!
  const presetName = root.querySelector<HTMLParagraphElement>('#preset-name')!
  const sourceNote = root.querySelector<HTMLParagraphElement>('#source-note')!
  const currentTimeLabel = root.querySelector<HTMLSpanElement>('#current-time')!
  const durationLabel = root.querySelector<HTMLSpanElement>('#duration')!
  const seekBar = root.querySelector<HTMLInputElement>('#seek-bar')!
  const status = root.querySelector<HTMLParagraphElement>('#status')!

  const butterchurnViz = new ButterchurnVisualizer(localPlayer.audioContext, butterchurnCanvas)
  const spectrumViz = new SpectrumVisualizer(spectrumCanvas, localPlayer.analyser)

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
  }

  const updateSourceUi = () => {
    const isLocal = sourceMode === 'local'
    sourceLocalButton.classList.toggle('active', isLocal)
    sourceSpotifyButton.classList.toggle('active', !isLocal)
    localControls.classList.toggle('hidden', !isLocal)
    spotifyControls.classList.toggle('hidden', isLocal)

    const spectrumAvailable = isLocal
    modeSpectrumButton.disabled = !spectrumAvailable

    if (!spectrumAvailable && mode === 'spectrum') {
      mode = 'butterchurn'
    }

    sourceNote.textContent = isLocal
      ? ''
      : 'Spotify uses timed pulse visuals until analysis sync (Phase 2b) merges. Spectrum stays local-only.'

    const authenticated = auth.tokens.isAuthenticated()
    spotifyLoginButton.classList.toggle('hidden', authenticated)
    spotifyLogoutButton.classList.toggle('hidden', !authenticated)
    spotifyDemoButton.disabled = !authenticated || !spotifyReady

    playButton.disabled = isLocal
      ? localSource.playbackState === 'idle'
      : !authenticated || !spotifyReady

    const playbackState = activeSource().playbackState
    playButton.textContent = playbackState === 'playing' ? 'Pause' : 'Play'

    updateModeUi()
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

  const renderFrame = () => {
    if (mode === 'butterchurn') {
      if (sourceMode === 'spotify') {
        const playing = spotifyPlayer.playbackState === 'playing'
        butterchurnViz.setSyntheticLevels(
          createSpotifyPulseLevels(
            spotifyPlayer.getCurrentTime(),
            spotifyPlayer.getDuration(),
            playing,
          ),
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

  const loadLocalTrack = async (load: () => Promise<void>, label: string) => {
    try {
      setStatus(`Loading ${label}...`)
      await load()
      connectVisualizer()
      playButton.disabled = false
      playButton.textContent = 'Play'
      updateSourceUi()
      setStatus('Ready — tap Play')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load audio'
      setStatus(message)
      playButton.disabled = true
    }
  }

  const initializeSpotify = async () => {
    try {
      setStatus('Connecting Spotify player...')
      spotifyPlayer.setErrorHandler((message) => setStatus(message))
      await spotifyPlayer.initialize()
      spotifyReady = true
      updateSourceUi()
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

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) {
      return
    }

    await loadLocalTrack(() => localSource.loadFile(file), file.name)
  })

  demoButton.addEventListener('click', async () => {
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
    spotifyPlayer.disconnect()
    spotifyPlayer = new SpotifyPlaybackPlayer(auth)
    spotifyReady = false
    sourceMode = 'local'
    updateSourceUi()
    setStatus('Disconnected from Spotify')
  })

  spotifyDemoButton.addEventListener('click', async () => {
    try {
      await spotifyPlayer.startDemoPlayback()
      playButton.disabled = false
      playButton.textContent = 'Pause'
      setStatus('Playing Today\'s Top Hits on your Audio Viz device')
      updateSourceUi()
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
    activeSource().seek(ratio)
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