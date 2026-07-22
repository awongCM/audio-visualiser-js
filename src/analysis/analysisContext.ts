export type SourceMode = 'local' | 'spotify'

export function shouldUseAnalysisSync(options: {
  userSyncEnabled: boolean
  analysisLoaded: boolean
  activeTrackId: string | null
  sourceMode: SourceMode
  spotifyTrackId: string | null
}): boolean {
  const { userSyncEnabled, analysisLoaded, activeTrackId, sourceMode, spotifyTrackId } = options

  if (!userSyncEnabled || !analysisLoaded || !activeTrackId) {
    return false
  }

  if (sourceMode === 'spotify') {
    return spotifyTrackId === activeTrackId
  }

  return true
}

export function timelineDuration(options: {
  analysisLoaded: boolean
  analysisDuration: number
  playerDuration: number
}): number {
  const { analysisLoaded, analysisDuration, playerDuration } = options

  if (!analysisLoaded || analysisDuration <= 0) {
    return playerDuration
  }

  if (playerDuration <= 0) {
    return analysisDuration
  }

  return Math.min(analysisDuration, playerDuration)
}

export class AnalysisLoadCoordinator {
  private generation = 0
  private pending: Promise<void> | null = null

  startRequest(): number {
    this.generation += 1
    return this.generation
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation
  }

  async run(
    trackId: string,
    generation: number,
    load: (trackId: string) => Promise<void>,
  ): Promise<'applied' | 'stale' | 'failed'> {
    if (this.pending) {
      await this.pending.catch(() => {})
      if (!this.isCurrent(generation)) {
        return 'stale'
      }
    }

    if (!this.isCurrent(generation)) {
      return 'stale'
    }

    let result: 'applied' | 'stale' | 'failed' = 'failed'

    const task = (async () => {
      try {
        await load(trackId)
        result = this.isCurrent(generation) ? 'applied' : 'stale'
      } catch {
        result = this.isCurrent(generation) ? 'failed' : 'stale'
      }
    })()

    this.pending = task.then(() => {})
    await task
    this.pending = null
    return result
  }
}
