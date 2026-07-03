import { spotifyConfig } from '../config/spotify'
import type { SpotifyAuthService } from '../auth/spotifyAuthService'
import type { PlaybackState } from './audioSource'
import {
  loadSpotifyPlaybackSdk,
  type SpotifyPlayerInstance,
  type SpotifyPlayerState,
  type SpotifyTrack,
} from '../spotify/spotifySdk'

export class SpotifyPlaybackPlayer {
  readonly kind = 'spotify' as const
  readonly audioContext: AudioContext
  readonly analyser: AnalyserNode | null = null
  readonly sourceNode: AudioNode | null = null
  readonly supportsSpectrum = false

  private readonly auth: SpotifyAuthService
  private player: SpotifyPlayerInstance | null = null
  private activeDeviceId: string | null = null
  private state: PlaybackState = 'idle'
  private currentTrack: SpotifyTrack | null = null
  private positionMs = 0
  private durationMs = 0
  private paused = true

  constructor(auth: SpotifyAuthService) {
    this.auth = auth
    this.audioContext = new AudioContext()
  }

  get playbackState(): PlaybackState {
    return this.state
  }

  get currentLabel(): string {
    if (!this.currentTrack) {
      return 'Spotify — no track playing'
    }

    const artists = this.currentTrack.artists.map((artist) => artist.name).join(', ')
    return `${this.currentTrack.name} — ${artists}`
  }

  get trackId(): string | null {
    return this.currentTrack?.id ?? null
  }

  get deviceId(): string | null {
    return this.activeDeviceId
  }

  async initialize(): Promise<void> {
    await loadSpotifyPlaybackSdk()

    if (!window.Spotify?.Player) {
      throw new Error('Spotify Web Playback SDK is unavailable')
    }

    if (this.player) {
      return
    }

    this.player = new window.Spotify.Player({
      name: 'Audio Viz',
      volume: 0.8,
      getOAuthToken: (callback) => {
        void this.auth.getAccessToken().then(callback).catch(() => {
          this.state = 'idle'
        })
      },
    })

    this.player.addListener('ready', ({ device_id }) => {
      this.activeDeviceId = device_id
      this.state = 'ready'
    })

    this.player.addListener('not_ready', () => {
      this.activeDeviceId = null
      this.state = 'idle'
    })

    this.player.addListener('player_state_changed', (playerState) => {
      this.applyPlayerState(playerState)
    })

    this.player.addListener('authentication_error', ({ message }) => {
      throw new Error(message)
    })

    this.player.addListener('account_error', ({ message }) => {
      throw new Error(message)
    })

    const connected = await this.player.connect()

    if (!connected) {
      throw new Error('Failed to connect Spotify player')
    }
  }

  async play(): Promise<void> {
    if (!this.player) {
      throw new Error('Spotify player is not initialized')
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    await this.player.resume()
    this.state = 'playing'
    this.paused = false
  }

  pause(): void {
    if (!this.player) {
      return
    }

    void this.player.pause()
    this.state = 'paused'
    this.paused = true
  }

  async togglePlayback(): Promise<void> {
    if (!this.player) {
      throw new Error('Spotify player is not initialized')
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    await this.player.togglePlay()
    this.paused = !this.paused
    this.state = this.paused ? 'paused' : 'playing'
  }

  seek(ratio: number): void {
    if (!this.player || this.durationMs <= 0) {
      return
    }

    const position = Math.round(Math.min(1, Math.max(0, ratio)) * this.durationMs)

    void this.auth.getAccessToken().then(async (token) => {
      await fetch(`${spotifyConfig.apiBaseUrl}/me/player/seek?position_ms=${position}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })
    })
  }

  getCurrentTime(): number {
    return this.positionMs / 1000
  }

  getDuration(): number {
    return this.durationMs / 1000
  }

  async startDemoPlayback(): Promise<void> {
    if (!this.activeDeviceId) {
      throw new Error('Spotify player is not ready yet')
    }

    const token = await this.auth.getAccessToken()
    const response = await fetch(`${spotifyConfig.apiBaseUrl}/me/player/play?device_id=${this.activeDeviceId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
      }),
    })

    if (!response.ok && response.status !== 204) {
      throw new Error('Failed to start Spotify playback — open Spotify on another device or try again')
    }

    this.state = 'playing'
    this.paused = false
  }

  dispose(): void {
    this.player?.disconnect()
    this.player = null
    void this.audioContext.close()
  }

  private applyPlayerState(playerState: SpotifyPlayerState | null): void {
    if (!playerState) {
      this.currentTrack = null
      this.positionMs = 0
      this.durationMs = 0
      this.state = 'ready'
      return
    }

    this.currentTrack = playerState.track_window.current_track
    this.positionMs = playerState.position
    this.durationMs = playerState.duration
    this.paused = playerState.paused
    this.state = playerState.paused ? 'paused' : 'playing'
  }
}
