export type PlaybackState = 'idle' | 'ready' | 'playing' | 'paused'

export class LocalAudioPlayer {
  readonly audioContext: AudioContext
  readonly analyser: AnalyserNode

  private audio: HTMLAudioElement
  private source: MediaElementAudioSourceNode | null = null
  private objectUrl: string | null = null
  private fileName = ''
  private state: PlaybackState = 'idle'

  constructor() {
    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.8
    this.audio = this.createAudioElement()
  }

  get playbackState(): PlaybackState {
    return this.state
  }

  get currentFileName(): string {
    return this.fileName
  }

  get element(): HTMLAudioElement {
    return this.audio
  }

  get sourceNode(): MediaElementAudioSourceNode | null {
    return this.source
  }

  async loadFile(file: File): Promise<void> {
    this.teardownSource()

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
    }

    this.fileName = file.name
    this.objectUrl = URL.createObjectURL(file)
    this.audio = this.createAudioElement()
    this.audio.src = this.objectUrl

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup()
        this.connectSource()
        this.state = 'ready'
        resolve()
      }

      const onError = () => {
        cleanup()
        this.state = 'idle'
        reject(new Error(`Failed to load "${file.name}"`))
      }

      const cleanup = () => {
        this.audio.removeEventListener('loadedmetadata', onReady)
        this.audio.removeEventListener('error', onError)
      }

      this.audio.addEventListener('loadedmetadata', onReady)
      this.audio.addEventListener('error', onError)
    })
  }

  async play(): Promise<void> {
    if (this.state === 'idle') {
      return
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume()
    }

    await this.audio.play()
    this.state = 'playing'
  }

  pause(): void {
    if (this.state !== 'playing') {
      return
    }

    this.audio.pause()
    this.state = 'paused'
  }

  togglePlayback(): Promise<void> {
    if (this.state === 'playing') {
      this.pause()
      return Promise.resolve()
    }

    return this.play()
  }

  seek(ratio: number): void {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) {
      return
    }

    const clamped = Math.min(1, Math.max(0, ratio))
    this.audio.currentTime = clamped * this.audio.duration
  }

  getCurrentTime(): number {
    return this.audio.currentTime
  }

  getDuration(): number {
    return Number.isFinite(this.audio.duration) ? this.audio.duration : 0
  }

  dispose(): void {
    this.audio.pause()
    this.teardownSource()

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }

    void this.audioContext.close()
  }

  private createAudioElement(): HTMLAudioElement {
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    return audio
  }

  private connectSource(): void {
    const source = this.audioContext.createMediaElementSource(this.audio)
    source.connect(this.analyser)
    this.analyser.connect(this.audioContext.destination)
    this.source = source
  }

  private teardownSource(): void {
    if (!this.source) {
      return
    }

    this.source.disconnect()
    this.analyser.disconnect()
    this.source = null
    this.state = 'idle'
  }
}
