import './style.css'
import { SpotifyAuthService } from './auth/spotifyAuthService'
import { createApp } from './app'

const root = document.querySelector<HTMLDivElement>('#app')

async function bootstrap(): Promise<void> {
  if (!root) {
    throw new Error('Root element #app not found')
  }

  const auth = new SpotifyAuthService()
  let justAuthenticated = false

  try {
    justAuthenticated = await auth.handleRedirectCallback()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spotify login failed'
    const status = document.createElement('p')
    status.className = 'status'
    status.textContent = message
    root.replaceChildren(status)
    return
  }

  createApp(root, { auth, justAuthenticated })
}

void bootstrap()
