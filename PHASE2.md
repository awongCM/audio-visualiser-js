# Phase 2 — integrated Spotify + analysis sync

Branch `cursor/phase2-integration-ca3d` merges:

- **Phase 2a** — Spotify OAuth + Web Playback SDK
- **Phase 2b** — Audio Analysis API sync

## Auto analysis for Spotify

When a Spotify track starts playing, the app automatically:

1. Detects the track ID from the Web Playback SDK
2. Fetches Spotify Audio Analysis for that track
3. Enables analysis sync and drives Butterchurn from beats/sections

Local mode still supports manual track ID entry via **Load analysis**.

## Setup

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Requires Spotify Premium for playback. Add `http://localhost:5173/` to your Spotify app redirect URIs.
