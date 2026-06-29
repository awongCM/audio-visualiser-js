export interface ButterchurnVisualizerInstance {
  connectAudio(audioNode: AudioNode): void
  disconnectAudio(audioNode: AudioNode): void
  loadPreset(preset: unknown, blendTime?: number): void
  setRendererSize(width: number, height: number): void
  render(opts?: { audioLevels?: unknown }): void
}

export interface ButterchurnStatic {
  createVisualizer(
    context: AudioContext,
    canvas: HTMLCanvasElement,
    opts?: {
      width?: number
      height?: number
      pixelRatio?: number
      textureRatio?: number
    },
  ): ButterchurnVisualizerInstance
}

export interface ButterchurnPresetsStatic {
  getPresets(): Record<string, unknown>
}

declare global {
  interface Window {
    butterchurn: { default: ButterchurnStatic }
    butterchurnPresets: ButterchurnPresetsStatic
  }
}

export function getButterchurn(): ButterchurnStatic {
  const api = window.butterchurn?.default

  if (!api?.createVisualizer) {
    throw new Error('Butterchurn failed to load. Check /vendor/butterchurn.min.js.')
  }

  return api
}

export function getButterchurnPresets(): ButterchurnPresetsStatic {
  const api = window.butterchurnPresets

  if (!api?.getPresets) {
    throw new Error('Butterchurn presets failed to load. Check /vendor/butterchurnPresets.min.js.')
  }

  return api
}
