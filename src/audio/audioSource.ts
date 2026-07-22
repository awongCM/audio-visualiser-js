export type PlaybackState = 'idle' | 'ready' | 'playing' | 'paused'

export type AudioSourceKind = 'local' | 'spotify'

export interface AudioSource {
  readonly kind: AudioSourceKind
  readonly audioContext: AudioContext
  readonly analyser: AnalyserNode | null
  readonly sourceNode: AudioNode | null
  readonly playbackState: PlaybackState
  readonly currentLabel: string
  readonly supportsSpectrum: boolean
  play(): Promise<void>
  pause(): void
  togglePlayback(): Promise<void>
  seek(ratio: number): void
  getCurrentTime(): number
  getDuration(): number
  dispose(): void
}
