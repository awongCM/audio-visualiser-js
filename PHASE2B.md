# Phase 2b worktree — Audio Analysis API sync

This directory is a **git worktree** on branch `cursor/phase2-audio-analysis-ca3d`.

## Setup

```bash
cd worktrees/phase2-analysis
cp .env.example .env
# Add Spotify client ID (same app as Phase 2a is fine)
npm install
npm run dev
```

## How to try analysis sync

1. **Connect Spotify** (needed to call the Audio Analysis API)
2. Load the **demo track** or any local file for playback timing
3. Enter a **Spotify track ID** (demo pre-fills `0VjIjW4GlUZAMYd2vXMi3b`) and click **Load analysis**
4. Enable **Analysis sync** — Butterchurn uses beat/section-driven synthetic levels
5. Presets auto-advance on each new **section**; manual Prev/Next disables auto mode

The timeline strip at the bottom shows section boundaries and the playhead.

## Merge note

Merge after `cursor/phase2-spotify-playback-ca3d` so Spotify playback can supply track IDs automatically instead of manual entry.
