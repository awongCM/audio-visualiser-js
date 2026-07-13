import { spotifyConfig } from '../config/spotify'
import { parseTrackId } from './parseTrackId'
import type { TrackAnalysis } from './types'

export { parseTrackId }

export async function fetchTrackAnalysis(trackId: string, accessToken: string): Promise<TrackAnalysis> {
  const response = await fetch(`${spotifyConfig.apiBaseUrl}/audio-analysis/${trackId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (response.status === 404) {
    throw new Error('No analysis available for this track')
  }

  if (!response.ok) {
    throw new Error('Failed to fetch Spotify audio analysis')
  }

  return response.json() as Promise<TrackAnalysis>
}
