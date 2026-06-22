import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

import type { ButterchurnVisualizer as ButterchurnVisualizerInstance } from 'butterchurn'

export class ButterchurnVisualizer {
  private visualizer: ButterchurnVisualizerInstance
  private presetNames: string[] = []
  private presetIndex = 0

  constructor(audioContext: AudioContext, canvas: HTMLCanvasElement) {
    const { clientWidth, clientHeight } = canvas

    this.visualizer = butterchurn.createVisualizer(audioContext, canvas, {
      width: clientWidth,
      height: clientHeight,
      pixelRatio: window.devicePixelRatio || 1,
    })

    const presets = butterchurnPresets.getPresets()
    this.presetNames = Object.keys(presets).sort((a, b) => a.localeCompare(b))

    if (this.presetNames.length > 0) {
      this.loadPresetByIndex(0)
    }
  }

  get currentPresetName(): string {
    return this.presetNames[this.presetIndex] ?? 'No preset loaded'
  }

  connectAudio(source: AudioNode): void {
    this.visualizer.connectAudio(source)
  }

  resize(width: number, height: number): void {
    this.visualizer.setRendererSize(width, height)
  }

  render(): void {
    this.visualizer.render()
  }

  nextPreset(): void {
    if (this.presetNames.length === 0) {
      return
    }

    this.presetIndex = (this.presetIndex + 1) % this.presetNames.length
    this.loadPresetByIndex(this.presetIndex)
  }

  previousPreset(): void {
    if (this.presetNames.length === 0) {
      return
    }

    this.presetIndex =
      (this.presetIndex - 1 + this.presetNames.length) % this.presetNames.length
    this.loadPresetByIndex(this.presetIndex)
  }

  private loadPresetByIndex(index: number): void {
    const presets = butterchurnPresets.getPresets()
    const presetName = this.presetNames[index]
    const preset = presets[presetName]

    if (!preset) {
      return
    }

    this.visualizer.loadPreset(preset, 2.0)
  }
}
