export class SpectrumVisualizer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly frequencyData: Uint8Array<ArrayBuffer>
  private readonly waveformData: Uint8Array<ArrayBuffer>
  private readonly analyser: AnalyserNode

  constructor(canvas: HTMLCanvasElement, analyser: AnalyserNode) {
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Could not create 2D canvas context for spectrum visualizer')
    }

    this.canvas = canvas
    this.ctx = context
    this.analyser = analyser
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
    this.waveformData = new Uint8Array(this.analyser.fftSize)
  }

  resize(width: number, height: number): void {
    const ratio = window.devicePixelRatio || 1
    this.canvas.width = Math.floor(width * ratio)
    this.canvas.height = Math.floor(height * ratio)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  render(): void {
    this.analyser.getByteFrequencyData(this.frequencyData)
    this.analyser.getByteTimeDomainData(this.waveformData)

    const { width, height } = this.canvas
    const displayWidth = width / (window.devicePixelRatio || 1)
    const displayHeight = height / (window.devicePixelRatio || 1)

    this.ctx.clearRect(0, 0, displayWidth, displayHeight)
    this.drawBackground(displayWidth, displayHeight)
    this.drawFrequencyBars(displayWidth, displayHeight)
    this.drawWaveform(displayWidth, displayHeight)
  }

  private drawBackground(width: number, height: number): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, '#090b16')
    gradient.addColorStop(1, '#120a1f')
    this.ctx.fillStyle = gradient
    this.ctx.fillRect(0, 0, width, height)
  }

  private drawFrequencyBars(width: number, height: number): void {
    const barCount = 96
    const gap = 2
    const barWidth = width / barCount - gap
    const bottom = height * 0.92
    const maxBarHeight = height * 0.72
    const step = Math.floor(this.frequencyData.length / barCount)

    for (let index = 0; index < barCount; index += 1) {
      const value = this.frequencyData[index * step] / 255
      const barHeight = value * maxBarHeight
      const x = index * (barWidth + gap)
      const y = bottom - barHeight

      const gradient = this.ctx.createLinearGradient(0, y, 0, bottom)
      gradient.addColorStop(0, '#7cf7ff')
      gradient.addColorStop(0.55, '#6d5bff')
      gradient.addColorStop(1, '#ff4fd8')

      this.ctx.fillStyle = gradient
      this.ctx.fillRect(x, y, barWidth, barHeight)
    }
  }

  private drawWaveform(width: number, height: number): void {
    this.ctx.lineWidth = 2
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    this.ctx.beginPath()

    const sliceWidth = width / this.waveformData.length
    const midY = height * 0.9
    const amplitude = height * 0.08

    for (let index = 0; index < this.waveformData.length; index += 1) {
      const normalized = (this.waveformData[index] - 128) / 128
      const x = index * sliceWidth
      const y = midY + normalized * amplitude

      if (index === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
    }

    this.ctx.stroke()
  }
}
