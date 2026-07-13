import { parseSpotifyTokenPayload } from './spotifyTokenPayload'

export interface SpotifyTokenSet {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
}

const STORAGE_KEY = 'spotify_tokens'

export class SpotifyTokenManager {
  private tokens: SpotifyTokenSet | null = null

  constructor() {
    this.tokens = this.readStoredTokens()
  }

  get accessToken(): string | null {
    return this.tokens?.accessToken ?? null
  }

  isAuthenticated(): boolean {
    return this.tokens !== null
  }

  isExpired(): boolean {
    if (!this.tokens) {
      return true
    }

    return Date.now() >= this.tokens.expiresAt - 30_000
  }

  setTokens(payload: {
    access_token: string
    refresh_token?: string
    expires_in: number
  }): void {
    this.tokens = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? this.tokens?.refreshToken ?? null,
      expiresAt: Date.now() + payload.expires_in * 1000,
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.tokens))
  }

  clear(): void {
    this.tokens = null
    sessionStorage.removeItem(STORAGE_KEY)
  }

  async ensureAccessToken(clientId: string, tokenUrl: string): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not authenticated with Spotify')
    }

    if (!this.isExpired()) {
      return this.tokens.accessToken
    }

    if (!this.tokens.refreshToken) {
      this.clear()
      throw new Error('Spotify session expired — please log in again')
    }

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refreshToken,
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!response.ok) {
      this.clear()
      throw new Error('Failed to refresh Spotify token')
    }

    const payload = parseSpotifyTokenPayload(await response.json())
    this.setTokens(payload)
    return this.tokens.accessToken
  }

  private readStoredTokens(): SpotifyTokenSet | null {
    const raw = sessionStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    try {
      return JSON.parse(raw) as SpotifyTokenSet
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
  }
}
