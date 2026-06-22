declare module 'butterchurn' {
  export interface VisualizerOptions {
    width?: number
    height?: number
    pixelRatio?: number
    textureRatio?: number
  }

  export interface ButterchurnVisualizer {
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
      opts?: VisualizerOptions,
    ): ButterchurnVisualizer
  }

  const butterchurn: ButterchurnStatic
  export default butterchurn
}

declare module 'butterchurn-presets' {
  export interface ButterchurnPresetsStatic {
    getPresets(): Record<string, unknown>
  }

  const butterchurnPresets: ButterchurnPresetsStatic
  export default butterchurnPresets
}
