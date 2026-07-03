import type {
  ActiveInterval,
  AnalysisSection,
  SyncEvent,
  SyncSnapshot,
  TimedInterval,
  TrackAnalysis,
} from './types'

function findActive<T extends TimedInterval>(
  items: T[],
  time: number,
): ActiveInterval<T> | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const end = item.start + item.duration

    if (time >= item.start && time < end) {
      const progress = item.duration > 0 ? (time - item.start) / item.duration : 0
      return { item, index, progress }
    }
  }

  return null
}

export class AnalysisSyncEngine {
  private analysis: TrackAnalysis | null = null
  private lastBeatIndex = -1
  private lastBarIndex = -1
  private lastSectionIndex = -1
  private listeners = new Map<SyncEvent, Set<(index: number) => void>>()

  setAnalysis(analysis: TrackAnalysis | null): void {
    this.analysis = analysis
    this.lastBeatIndex = -1
    this.lastBarIndex = -1
    this.lastSectionIndex = -1
  }

  get duration(): number {
    return this.analysis?.track.duration ?? 0
  }

  get sections(): AnalysisSection[] {
    return this.analysis?.sections ?? []
  }

  on(event: SyncEvent, handler: (index: number) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }

    this.listeners.get(event)!.add(handler)
    return () => this.listeners.get(event)?.delete(handler)
  }

  update(timeSeconds: number): SyncSnapshot {
    if (!this.analysis) {
      return {
        time: timeSeconds,
        beat: null,
        bar: null,
        section: null,
        segment: null,
      }
    }

    const beat = findActive(this.analysis.beats, timeSeconds)
    const bar = findActive(this.analysis.bars, timeSeconds)
    const section = findActive(this.analysis.sections, timeSeconds)
    const segment = findActive(this.analysis.segments, timeSeconds)

    if (beat && beat.index !== this.lastBeatIndex) {
      this.lastBeatIndex = beat.index
      this.emit('beat', beat.index)
    }

    if (bar && bar.index !== this.lastBarIndex) {
      this.lastBarIndex = bar.index
      this.emit('bar', bar.index)
    }

    if (section && section.index !== this.lastSectionIndex) {
      this.lastSectionIndex = section.index
      this.emit('section', section.index)
    }

    return { time: timeSeconds, beat, bar, section, segment }
  }

  private emit(event: SyncEvent, index: number): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler(index)
    }
  }
}
