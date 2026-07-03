export interface TimedInterval {
  start: number
  duration: number
  confidence: number
}

export interface AnalysisSection extends TimedInterval {
  loudness: number
  tempo: number
  key: number
  mode: number
}

export interface AnalysisSegment extends TimedInterval {
  loudness_start: number
  loudness_max: number
  loudness_max_time: number
  pitches: number[]
  timbre: number[]
}

export interface TrackAnalysis {
  track: {
    duration: number
    tempo: number
  }
  bars: TimedInterval[]
  beats: TimedInterval[]
  sections: AnalysisSection[]
  segments: AnalysisSegment[]
  tatums: TimedInterval[]
}

export interface ActiveInterval<T extends TimedInterval> {
  item: T
  index: number
  progress: number
}

export interface SyncSnapshot {
  time: number
  beat: ActiveInterval<TimedInterval> | null
  bar: ActiveInterval<TimedInterval> | null
  section: ActiveInterval<AnalysisSection> | null
  segment: ActiveInterval<AnalysisSegment> | null
}

export type SyncEvent = 'beat' | 'bar' | 'section'
