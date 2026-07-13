export interface SpotifyTokenPayload {
  access_token: string
  expires_in: number
  refresh_token?: string
}

export function parseSpotifyTokenPayload(payload: unknown): SpotifyTokenPayload {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid Spotify token response')
  }

  const record = payload as Record<string, unknown>

  if (typeof record.error === 'string') {
    throw new Error(`Spotify token error: ${record.error}`)
  }

  if (typeof record.access_token !== 'string' || record.access_token.length === 0) {
    throw new Error('Spotify token response missing access_token')
  }

  if (typeof record.expires_in !== 'number' || !Number.isFinite(record.expires_in)) {
    throw new Error('Spotify token response missing expires_in')
  }

  return {
    access_token: record.access_token,
    expires_in: record.expires_in,
    refresh_token: typeof record.refresh_token === 'string' ? record.refresh_token : undefined,
  }
}
