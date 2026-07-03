import { consumeOAuthState, consumeVerifier } from './spotifyPkce'
import { SpotifyTokenManager } from './spotifyTokenManager'
import { spotifyConfig } from '../config/spotify'

export class SpotifyAuthService {
  readonly tokens = new SpotifyTokenManager()

  async handleRedirectCallback(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (error) {
      throw new Error(`Spotify authorization failed: ${error}`)
    }

    if (!code) {
      return false
    }

    const expectedState = consumeOAuthState()

    if (!expectedState || state !== expectedState) {
      throw new Error('Spotify authorization state mismatch')
    }

    const verifier = consumeVerifier()

    if (!verifier) {
      throw new Error('Missing Spotify PKCE verifier')
    }

    const body = new URLSearchParams({
      client_id: spotifyConfig.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotifyConfig.redirectUri,
      code_verifier: verifier,
    })

    const response = await fetch(spotifyConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!response.ok) {
      throw new Error('Failed to exchange Spotify authorization code')
    }

    const payload = await response.json()
    this.tokens.setTokens(payload)
    this.clearAuthParams()
    return true
  }

  async getAccessToken(): Promise<string> {
    return this.tokens.ensureAccessToken(
      spotifyConfig.clientId,
      spotifyConfig.tokenUrl,
    )
  }

  clearAuthParams(): void {
    const url = new URL(window.location.href)
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    url.searchParams.delete('error')
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
  }
}
