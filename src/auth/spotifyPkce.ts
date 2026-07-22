const VERIFIER_KEY = 'spotify_pkce_verifier'
const STATE_KEY = 'spotify_oauth_state'

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(length: number): string {
  const values = crypto.getRandomValues(new Uint8Array(length))
  return base64UrlEncode(values.buffer).slice(0, length)
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

export function storeVerifier(verifier: string): void {
  sessionStorage.setItem(VERIFIER_KEY, verifier)
}

export function consumeVerifier(): string | null {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  return verifier
}

export function storeOAuthState(state: string): void {
  sessionStorage.setItem(STATE_KEY, state)
}

export function consumeOAuthState(): string | null {
  const state = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  return state
}

export async function buildAuthorizeUrl(clientId: string, redirectUri: string, scopes: string): Promise<string> {
  const verifier = randomString(64)
  const challenge = await createCodeChallenge(verifier)
  const state = randomString(16)

  storeVerifier(verifier)
  storeOAuthState(state)

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scopes,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })

  return `${'https://accounts.spotify.com/authorize'}?${params.toString()}`
}
