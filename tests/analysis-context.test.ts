import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AnalysisLoadCoordinator,
  shouldUseAnalysisSync,
  timelineDuration,
} from '../src/analysis/analysisContext.ts'

test('shouldUseAnalysisSync requires matching Spotify track ID', () => {
  assert.equal(
    shouldUseAnalysisSync({
      userSyncEnabled: true,
      analysisLoaded: true,
      activeTrackId: 'abc123',
      sourceMode: 'spotify',
      spotifyTrackId: 'abc123',
    }),
    true,
  )

  assert.equal(
    shouldUseAnalysisSync({
      userSyncEnabled: true,
      analysisLoaded: true,
      activeTrackId: 'abc123',
      sourceMode: 'spotify',
      spotifyTrackId: 'other',
    }),
    false,
  )
})

test('shouldUseAnalysisSync respects user toggle', () => {
  assert.equal(
    shouldUseAnalysisSync({
      userSyncEnabled: false,
      analysisLoaded: true,
      activeTrackId: 'abc123',
      sourceMode: 'spotify',
      spotifyTrackId: 'abc123',
    }),
    false,
  )
})

test('timelineDuration prefers shared bounds between analysis and player', () => {
  assert.equal(
    timelineDuration({ analysisLoaded: true, analysisDuration: 200, playerDuration: 180 }),
    180,
  )

  assert.equal(
    timelineDuration({ analysisLoaded: false, analysisDuration: 200, playerDuration: 180 }),
    180,
  )
})

test('AnalysisLoadCoordinator drops stale responses', async () => {
  const coordinator = new AnalysisLoadCoordinator()
  let resolveFirst: (() => void) | null = null

  const firstGeneration = coordinator.startRequest()
  const first = coordinator.run(
    'track-a',
    firstGeneration,
    () =>
      new Promise<void>((resolve) => {
        resolveFirst = resolve
      }),
  )

  const secondGeneration = coordinator.startRequest()
  const second = coordinator.run('track-b', secondGeneration, async () => {})

  resolveFirst?.()
  assert.equal(await first, 'stale')
  assert.equal(await second, 'applied')
})
