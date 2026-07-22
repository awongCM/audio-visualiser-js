import type { PlaybackState } from './audioSource'
import type { LocalAudioPlayer } from './localAudioPlayer'

export class LocalAudioSourceAdapter {
  readonly kind = 'local' as const
  readonly supportsSpectrum = true
  private readonly player: LocalAudioPlayer

  constructor(player: LocalAudioPlayer) {
    this.player = player
  }

  get audioContext(): AudioContext {
    return this.player.audioContext
  }

  get analyser(): AnalyserNode {
    return this.player.analyser
  }

  get sourceNode(): AudioNode | null {
    return this.player.sourceNode
  }

  get playbackState(): PlaybackState {
    return this.player.playbackState
  }

  get currentLabel(): string {
    return this.player.currentFileName || 'No track loaded'
  }

  get element(): HTMLAudioElement {
    return this.player.element
  }

  async loadFile(file: File): Promise<void> {
    await this.player.loadFile(file)
  }

  async loadUrl(url: string, name: string): Promise<void> {
    await this.player.loadUrl(url, name)
  }

  play(): Promise<void> {
    return this.player.play()
  }

  pause(): void {
    this.player.pause()
  }

  togglePlayback(): Promise<void> {
    return this.player.togglePlayback()
  }

  seek(ratio: number): void {
    this.player.seek(ratio)
  }

  getCurrentTime(): number {
    return this.player.getCurrentTime()
  }

  getDuration(): number {
    return this.player.getDuration()
  }

  dispose(): void {
    this.player.dispose()
  }
}
