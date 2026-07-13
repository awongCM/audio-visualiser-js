// Interim visualization driver for Spotify mode (SDK does not expose an AudioNode).
export function createSpotifyPulseLevels(
  positionSeconds: number,
  durationSeconds: number,
  playing: boolean,
): number[] {
  const levels = new Array(32).fill(0)

  if (!playing || durationSeconds <= 0) {
    return levels
  }

  const phase = (positionSeconds / Math.max(durationSeconds, 1)) * Math.PI * 8
  const pulse = 0.35 + Math.sin(phase * 3) * 0.15 + Math.sin(phase * 7) * 0.1

  for (let index = 0; index < levels.length; index += 1) {
    const band = index / levels.length
    const ripple = Math.sin(phase + band * 6) * 0.12
    levels[index] = Math.min(1, Math.max(0, pulse * (0.5 + band * 0.8) + ripple))
  }

  return levels
}
