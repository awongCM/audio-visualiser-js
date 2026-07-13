import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTrackId } from '../src/analysis/parseTrackId.ts'
import { AnalysisSyncEngine } from '../src/analysis/syncEngine.ts'
import type { TrackAnalysis } from '../src/analysis/types.ts'
import { parseSpotifyTokenPayload } from '../src/auth/spotifyTokenPayload.ts'

test('parseTrackId accepts raw IDs and Spotify URLs', () => {
  assert.equal(parseTrackId('0VjIjW4GlUZAMYd2vXMi3b'), '0VjIjW4GlUZAMYd2vXMi3b')
  assert.equal(
    parseTrackId('https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b'),
    '0VjIjW4GlUZAMYd2vXMi3b',
  )
  assert.equal(parseTrackId('spotify:track:0VjIjW4GlUZAMYd2vXMi3b'), '0VjIjW4GlUZAMYd2vXMi3b')
})

test('parseTrackId rejects invalid input', () => {
  assert.equal(parseTrackId(''), null)
  assert.equal(parseTrackId('not-a-track'), null)
})

test('AnalysisSyncEngine resets section events after seek', () => {
  const engine = new AnalysisSyncEngine()
  const analysis: TrackAnalysis = {
    track: { duration: 10, tempo: 120 },
    bars: [],
    beats: [],
    tatums: [],
    segments: [],
    sections: [
      { start: 0, duration: 5, confidence: 1, loudness: -10, tempo: 120, key: 0, mode: 1 },
      { start: 5, duration: 5, confidence: 1, loudness: -8, tempo: 120, key: 0, mode: 1 },
    ],
  }

  engine.setAnalysis(analysis)

  let sectionEvents = 0
  engine.on('section', () => {
    sectionEvents += 1
  })

  engine.update(1)
  assert.equal(sectionEvents, 1)

  engine.update(6)
  assert.equal(sectionEvents, 2)

  engine.resetEventIndices()
  engine.update(1)
  assert.equal(sectionEvents, 3)
})

test('parseSpotifyTokenPayload rejects malformed responses', () => {
  assert.throws(() => parseSpotifyTokenPayload({}), /missing access_token/)
})
