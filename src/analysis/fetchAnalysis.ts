import { spotifyConfig } from '../config/spotify'
import type { TrackAnalysis } from './types'

export function parseTrackId(input: string): string | null {
  const trimmed = input.trim()

  if (!trimmed) {
    return null
  }

  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
    return trimmed
  }

  const uriMatch = trimmed.match(/spotify:track:([a-zA-Z0-9]{22})/)
  if (uriMatch) {
    return uriMatch[1]
  }

  const urlMatch = trimmed.match(/track\/([a-zA-Z0-9]{22})/)
  if (urlMatch) {
    return urlMatch[1]
  }

  return null
}

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
