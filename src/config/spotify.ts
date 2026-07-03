const SCOPES = ['user-read-email', 'user-read-private'] as const

export const spotifyConfig = {
  clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '',
  redirectUri:
    import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.replace(/\/$/, '') ||
    `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`,
  scopes: SCOPES.join(' '),
  authorizeUrl: 'https://accounts.spotify.com/authorize',
  tokenUrl: 'https://accounts.spotify.com/api/token',
  apiBaseUrl: 'https://api.spotify.com/v1',
} as const

export function isSpotifyConfigured(): boolean {
  return spotifyConfig.clientId.length > 0
}

// Demo track used when analysis sync is enabled with the built-in demo MP3
export const DEMO_TRACK_ID = '0VjIjW4GlUZAMYd2vXMi3b'
