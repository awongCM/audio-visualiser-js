import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTrackId } from '../src/analysis/parseTrackId.ts'
import { AnalysisSyncEngine } from '../src/analysis/syncEngine.ts'
import { parseSpotifyTokenPayload } from '../src/auth/spotifyTokenPayload.ts'
import { createSpotifyPulseLevels } from '../src/audio/spotifyPulseLevels.ts'

test('parseTrackId accepts Spotify URLs', () => {
  assert.equal(
    parseTrackId('https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b'),
    '0VjIjW4GlUZAMYd2vXMi3b',
  )
})

test('parseSpotifyTokenPayload rejects error payloads', () => {
  assert.throws(
    () => parseSpotifyTokenPayload({ error: 'invalid_grant' }),
    /Spotify token error/,
  )
})

test('AnalysisSyncEngine resets indices for seek', () => {
  const engine = new AnalysisSyncEngine()
  engine.setAnalysis({
    track: { duration: 10, tempo: 120 },
    bars: [],
    beats: [],
    tatums: [],
    segments: [],
    sections: [
      { start: 0, duration: 5, confidence: 1, loudness: -10, tempo: 120, key: 0, mode: 1 },
      { start: 5, duration: 5, confidence: 1, loudness: -8, tempo: 120, key: 0, mode: 1 },
    ],
  })

  let sections = 0
  engine.on('section', () => {
    sections += 1
  })

  engine.update(1)
  engine.update(6)
  engine.resetEventIndices()
  engine.update(1)
  assert.equal(sections, 3)
})

test('createSpotifyPulseLevels is active while playing', () => {
  const levels = createSpotifyPulseLevels(10, 200, true)
  assert.equal(levels.some((value) => value > 0), true)
})
