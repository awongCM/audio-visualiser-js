import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSpotifyTokenPayload } from '../src/auth/spotifyTokenPayload.ts'
import { createSpotifyPulseLevels } from '../src/audio/spotifyPulseLevels.ts'

test('parseSpotifyTokenPayload accepts valid token response', () => {
  const payload = parseSpotifyTokenPayload({
    access_token: 'abc',
    expires_in: 3600,
    refresh_token: 'refresh',
  })

  assert.equal(payload.access_token, 'abc')
  assert.equal(payload.expires_in, 3600)
  assert.equal(payload.refresh_token, 'refresh')
})

test('parseSpotifyTokenPayload rejects error payloads', () => {
  assert.throws(
    () => parseSpotifyTokenPayload({ error: 'invalid_grant' }),
    /Spotify token error/,
  )
})

test('createSpotifyPulseLevels returns zeros when paused', () => {
  const levels = createSpotifyPulseLevels(12, 180, false)
  assert.equal(levels.every((value) => value === 0), true)
})

test('createSpotifyPulseLevels returns active bands while playing', () => {
  const levels = createSpotifyPulseLevels(12, 180, true)
  assert.equal(levels.length, 32)
  assert.equal(levels.some((value) => value > 0), true)
})
