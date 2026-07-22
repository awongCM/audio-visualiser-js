# Git worktrees — Phase 2

Phase 2 is split across two parallel worktrees so each feature can be developed and reviewed independently.

| Worktree | Branch | Focus |
|----------|--------|-------|
| `worktrees/phase2-spotify` | `cursor/phase2-spotify-playback-ca3d` | Spotify OAuth + Web Playback SDK |
| `worktrees/phase2-analysis` | `cursor/phase2-audio-analysis-ca3d` | Audio Analysis API full-track sync |
| *(integrated)* | `cursor/phase2-integration-ca3d` | Both features merged — auto analysis on Spotify tracks |

## Commands

```bash
# List worktrees
git worktree list

# Work on Spotify playback
cd worktrees/phase2-spotify
cp .env.example .env   # set VITE_SPOTIFY_CLIENT_ID
npm install && npm run dev

# Work on analysis sync (separate terminal)
cd worktrees/phase2-analysis
cp .env.example .env
npm install && npm run dev
```

Use different dev server ports if running both at once (`npm run dev -- --port 5174`).

## Merge order

1. Merge **Phase 2a** (Spotify playback) first
2. Merge **Phase 2b** (analysis sync) — resolve `src/app.ts` conflicts by combining source toggle + analysis controls

Both branches need the same Spotify app redirect URIs in the [Developer Dashboard](https://developer.spotify.com/dashboard).
