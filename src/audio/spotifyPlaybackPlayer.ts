import { spotifyConfig } from '../config/spotify'
import type { SpotifyAuthService } from '../auth/spotifyAuthService'
import type { AudioSource } from './audioSource'
import type { PlaybackState } from './audioSource'
import {
  loadSpotifyPlaybackSdk,
  type SpotifyPlayerInstance,
  type SpotifyPlayerState,
  type SpotifyTrack,
} from '../spotify/spotifySdk'

export type SpotifyPlayerErrorHandler = (message: string) => void

export class SpotifyPlaybackPlayer implements AudioSource {
  readonly kind = 'spotify' as const
  readonly analyser: AnalyserNode | null = null
  readonly sourceNode: AudioNode | null = null
  readonly supportsSpectrum = false

  private readonly auth: SpotifyAuthService
  private audioContextValue: AudioContext
  private player: SpotifyPlayerInstance | null = null
  private activeDeviceId: string | null = null
  private state: PlaybackState = 'idle'
  private currentTrack: SpotifyTrack | null = null
  private positionMs = 0
  private durationMs = 0
  private paused = true
  private positionUpdatedAt = 0
  private onError: SpotifyPlayerErrorHandler | null = null
  private onTrackChange: ((trackId: string) => void) | null = null

  constructor(auth: SpotifyAuthService) {
    this.auth = auth
    this.audioContextValue = new AudioContext()
  }

  get audioContext(): AudioContext {
    return this.audioContextValue
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

  setErrorHandler(handler: SpotifyPlayerErrorHandler | null): void {
    this.onError = handler
  }

  setTrackChangeHandler(handler: ((trackId: string) => void) | null): void {
    this.onTrackChange = handler
  }

  async initialize(): Promise<void> {
    if (this.audioContextValue.state === 'closed') {
      this.audioContextValue = new AudioContext()
    }

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
        void this.auth
          .getAccessToken()
          .then(callback)
          .catch((error: unknown) => {
            this.state = 'idle'
            const message =
              error instanceof Error ? error.message : 'Spotify authentication failed'
            this.reportError(message)
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

    this.player.addListener('initialization_error', ({ message }) => {
      this.reportError(message)
    })

    this.player.addListener('authentication_error', ({ message }) => {
      this.reportError(message)
    })

    this.player.addListener('account_error', ({ message }) => {
      this.reportError(message)
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

    await this.resumeAudioContext()
    await this.player.resume()
  }

  pause(): void {
    if (!this.player) {
      return
    }

    void this.player.pause()
  }

  async togglePlayback(): Promise<void> {
    if (!this.player) {
      throw new Error('Spotify player is not initialized')
    }

    await this.resumeAudioContext()
    await this.player.togglePlay()
  }

  seek(ratio: number): void {
    if (!this.player || this.durationMs <= 0) {
      return
    }

    const position = Math.round(Math.min(1, Math.max(0, ratio)) * this.durationMs)

    void this.auth.getAccessToken().then(async (token) => {
      const response = await fetch(`${spotifyConfig.apiBaseUrl}/me/player/seek?position_ms=${position}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok && response.status !== 204) {
        this.reportError('Spotify seek failed — is playback active on this device?')
      }
    })
  }

  getCurrentTime(): number {
    if (this.paused || this.positionUpdatedAt === 0) {
      return this.positionMs / 1000
    }

    const elapsed = performance.now() - this.positionUpdatedAt
    return (this.positionMs + elapsed) / 1000
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
  }

  disconnect(): void {
    this.player?.disconnect()
    this.player = null
    this.activeDeviceId = null
    this.currentTrack = null
    this.positionMs = 0
    this.durationMs = 0
    this.positionUpdatedAt = 0
    this.paused = true
    this.state = 'idle'
  }

  dispose(): void {
    this.disconnect()

    if (this.audioContextValue.state !== 'closed') {
      void this.audioContextValue.close()
    }
  }

  private async resumeAudioContext(): Promise<void> {
    if (this.audioContextValue.state === 'suspended') {
      await this.audioContextValue.resume()
    }
  }

  private reportError(message: string): void {
    this.onError?.(message)
  }

  private applyPlayerState(playerState: SpotifyPlayerState | null): void {
    if (!playerState) {
      this.currentTrack = null
      this.positionMs = 0
      this.durationMs = 0
      this.positionUpdatedAt = 0
      this.state = 'ready'
      this.paused = true
      return
    }

    const previousTrackId = this.currentTrack?.id ?? null
    this.currentTrack = playerState.track_window.current_track
    this.positionMs = playerState.position
    this.durationMs = playerState.duration
    this.paused = playerState.paused
    this.positionUpdatedAt = performance.now()
    this.state = playerState.paused ? 'paused' : 'playing'

    const nextTrackId = this.currentTrack.id
    if (nextTrackId && nextTrackId !== previousTrackId) {
      this.onTrackChange?.(nextTrackId)
    }
  }
}
