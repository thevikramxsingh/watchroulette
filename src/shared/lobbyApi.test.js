import { describe, it, expect } from 'vitest'
import { isSpinInProgress } from './lobbyApi'

// Unit test for the one pure piece of lobbyApi.js. Per spec: "in progress =
// within the last 4 seconds, no new schema" — this derives the Spin
// button's app-wide disabled state from spin_started_at alone.
describe('isSpinInProgress', () => {
  it('is false when no spin has ever happened', () => {
    expect(isSpinInProgress({ spin_started_at: null })).toBe(false)
  })

  it('is true when the last spin started less than 4 seconds ago', () => {
    const now = Date.now()
    const lobby = { spin_started_at: new Date(now - 2000).toISOString() }
    expect(isSpinInProgress(lobby, now)).toBe(true)
  })

  it('is false once 4 seconds have passed since the last spin', () => {
    const now = Date.now()
    const lobby = { spin_started_at: new Date(now - 4001).toISOString() }
    expect(isSpinInProgress(lobby, now)).toBe(false)
  })
})
