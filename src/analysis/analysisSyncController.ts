import type { SpotifyAuthService } from '../auth/spotifyAuthService'
import { fetchTrackAnalysis, parseTrackId } from './fetchAnalysis'
import { AnalysisSyncEngine } from './syncEngine'
import type { TrackAnalysis } from './types'

export class AnalysisSyncController {
  readonly engine = new AnalysisSyncEngine()
  private trackId: string | null = null
  private readonly auth: SpotifyAuthService

  constructor(auth: SpotifyAuthService) {
    this.auth = auth
  }

  get activeTrackId(): string | null {
    return this.trackId
  }

  get analysisLoaded(): boolean {
    return this.engine.duration > 0
  }

  async loadForTrackInput(input: string): Promise<TrackAnalysis> {
    const trackId = parseTrackId(input)

    if (!trackId) {
      throw new Error('Enter a valid Spotify track ID or URL')
    }

    const token = await this.auth.getAccessToken()
    const analysis = await fetchTrackAnalysis(trackId, token)
    this.trackId = trackId
    this.engine.setAnalysis(analysis)
    return analysis
  }

  clear(): void {
    this.trackId = null
    this.engine.setAnalysis(null)
  }
}
