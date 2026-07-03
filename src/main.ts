import './style.css'
import { SpotifyAuthService } from './auth/spotifyAuthService'
import { AnalysisSyncController } from './analysis/analysisSyncController'
import { createApp } from './app'

const root = document.querySelector<HTMLDivElement>('#app')

async function bootstrap(): Promise<void> {
  if (!root) {
    throw new Error('Root element #app not found')
  }

  const auth = new SpotifyAuthService()
  const analysis = new AnalysisSyncController(auth)

  try {
    await auth.handleRedirectCallback()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Spotify login failed'
    root.innerHTML = `<p class="status">${message}</p>`
    return
  }

  createApp(root, { auth, analysis })
}

void bootstrap()
