import type { SyncSnapshot } from './types'

// Butterchurn expects waveform-style levels; we synthesize them from analysis timing.
export function createSyntheticAudioLevels(snapshot: SyncSnapshot): number[] {
  const levels = new Array(32).fill(0)
  const beatPulse = snapshot.beat ? 1 - snapshot.beat.progress : 0
  const barPulse = snapshot.bar ? 1 - snapshot.bar.progress : 0
  const sectionEnergy = snapshot.section
    ? Math.min(1, Math.max(0, (snapshot.section.item.loudness + 20) / 20))
    : 0.35
  const segmentBrightness = snapshot.segment
    ? snapshot.segment.item.pitches.reduce((sum, value) => sum + value, 0) / snapshot.segment.item.pitches.length
    : 0.25

  const base = sectionEnergy * 0.55 + segmentBrightness * 0.25 + barPulse * 0.15 + beatPulse * 0.35

  for (let index = 0; index < levels.length; index += 1) {
    const band = index / levels.length
    const ripple = Math.sin((snapshot.time * 6 + index) * 0.7) * 0.08
    levels[index] = Math.min(1, Math.max(0, base * (0.65 + band * 0.7) + ripple))
  }

  return levels
}
