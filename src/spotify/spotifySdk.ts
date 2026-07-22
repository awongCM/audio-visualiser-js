export interface SpotifyImage {
  url: string
  height: number | null
  width: number | null
}

export interface SpotifyTrack {
  id: string
  name: string
  uri: string
  duration_ms: number
  artists: Array<{ name: string }>
  album: {
    name: string
    images: SpotifyImage[]
  }
}

export interface SpotifyPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: SpotifyTrack
  }
}

export interface SpotifyPlayerError {
  message: string
}

export interface SpotifyPlayerInstance {
  connect(): Promise<boolean>
  disconnect(): void
  togglePlay(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  getCurrentState(): Promise<SpotifyPlayerState | null>
  addListener(event: 'ready', callback: (data: { device_id: string }) => void): void
  addListener(event: 'not_ready', callback: (data: { device_id: string }) => void): void
  addListener(
    event: 'player_state_changed',
    callback: (state: SpotifyPlayerState | null) => void,
  ): void
  addListener(event: 'initialization_error', callback: (error: SpotifyPlayerError) => void): void
  addListener(event: 'authentication_error', callback: (error: SpotifyPlayerError) => void): void
  addListener(event: 'account_error', callback: (error: SpotifyPlayerError) => void): void
  removeListener(event: string, callback?: (...args: unknown[]) => void): void
}

export interface SpotifyPlayerConstructor {
  new (options: {
    name: string
    volume: number
    getOAuthToken: (callback: (token: string) => void) => void
  }): SpotifyPlayerInstance
}

declare global {
  interface Window {
    Spotify?: {
      Player: SpotifyPlayerConstructor
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

const SDK_LOAD_TIMEOUT_MS = 15_000

let sdkPromise: Promise<void> | null = null

export function loadSpotifyPlaybackSdk(): Promise<void> {
  if (window.Spotify?.Player) {
    return Promise.resolve()
  }

  if (sdkPromise) {
    return sdkPromise
  }

  sdkPromise = new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      sdkPromise = null
      reject(new Error('Timed out loading Spotify Web Playback SDK'))
    }, SDK_LOAD_TIMEOUT_MS)

    const finish = () => {
      window.clearTimeout(timeoutId)
      resolve()
    }

    const fail = (message: string) => {
      window.clearTimeout(timeoutId)
      sdkPromise = null
      reject(new Error(message))
    }

    if (window.Spotify?.Player) {
      finish()
      return
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-spotify-sdk]')

    if (existing) {
      window.onSpotifyWebPlaybackSDKReady = () => {
        if (window.Spotify?.Player) {
          finish()
        } else {
          fail('Spotify Web Playback SDK loaded but Player is unavailable')
        }
      }
      return
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.dataset.spotifySdk = 'true'

    script.onerror = () => {
      fail('Failed to load Spotify Web Playback SDK')
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (window.Spotify?.Player) {
        finish()
      } else {
        fail('Spotify Web Playback SDK loaded but Player is unavailable')
      }
    }

    document.head.appendChild(script)
  })

  return sdkPromise
}
