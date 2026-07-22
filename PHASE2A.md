# Phase 2a worktree — Spotify OAuth + Web Playback SDK

This directory is a **git worktree** on branch `cursor/phase2-spotify-playback-ca3d`.

## Setup

```bash
cd worktrees/phase2-spotify
cp .env.example .env
# Add your Spotify app client ID from https://developer.spotify.com/dashboard
npm install
npm run dev
```

In the Spotify Developer Dashboard, add redirect URIs:

- `http://localhost:5173/` (local dev)
- `https://<user>.github.io/audio-visualiser-js/` (GitHub Pages, if deployed)

## Features

- Authorization Code + PKCE login (no client secret in the browser)
- Spotify Web Playback SDK device
- Local file mode still works (Phase 1)
- Play Today's Top Hits demo playlist on your web player device
- Spectrum mode remains local-only (SDK does not expose raw audio)

## Merge note

This branch touches `src/app.ts`. Merge with `cursor/phase2-audio-analysis-ca3d` after both PRs are reviewed — the analysis worktree adds beat/section sync on top of Spotify playback.
