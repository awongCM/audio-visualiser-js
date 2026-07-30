# AGENTS.md

Guidance for AI agents working in this repository.

## Project overview

Audio Viz is a Vite + TypeScript web app that visualizes audio with Butterchurn presets and a spectrum mode. Phase 2 adds optional Spotify playback and Audio Analysis API sync.

## Common commands

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies and copy Butterchurn vendor assets (`postinstall`) |
| `npm test` | Run Node test suite (16 tests) |
| `npm run build` | Type-check and build production assets to `dist/` |
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run preview` | Serve the production build on port 4173 |
| `npm run demo:capture` | Capture demo screenshots with Playwright (requires preview server) |

## Cursor Cloud specific instructions

### Startup

The cloud environment runs `npm install && npx playwright install chromium` on boot, then starts two shared terminals:

- **dev** — `npm run dev` on port 5173
- **preview** — `npm run build && npm run preview` on port 4173

Wait for the preview terminal to finish building before running demo capture.

### Verify changes

1. Run `npm test` for unit/integration coverage.
2. Run `npm run build` to confirm TypeScript and Vite production build succeed.
3. For UI or visualizer changes, use the **Try demo** button in the app (loads `/demo/demo-track.mp3`) — no Spotify credentials required.

### Demo screenshots

To regenerate demo screenshots for PRs or docs:

```bash
npm run demo:capture
```

Screenshots are written to `/opt/cursor/artifacts/screenshots/` by default. Override with `DEMO_OUTPUT_DIR` or `DEMO_BASE_URL` if needed.

Playwright Chromium must be installed (`npx playwright install chromium`); the cloud `install` script handles this automatically.

### Spotify (optional)

Spotify features require a client ID. Copy `.env.example` to `.env` locally, or add `VITE_SPOTIFY_CLIENT_ID` as a Cursor Cloud secret. Demo playback and local file visualization work without Spotify.

### Constraints

- Do not commit `.env` or real API keys.
- The `postinstall` script copies Butterchurn assets into `public/vendor/`; do not edit those generated files directly.
- GitHub Pages deploy uses `GITHUB_PAGES=true` for the `/audio-visualiser-js/` base path; local dev uses `/`.
