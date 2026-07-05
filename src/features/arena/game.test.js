import { describe, it, expect } from 'vitest'
import {
  BONUS_CHANCE,
  GRID_SIZE,
  MAX_SCORE,
  isBonusWindow,
  isDuringBurst,
  pickBurstStartTimes,
  pickNextCell,
} from './game'

// Unit tests for the Arena's one piece of pure logic: which cell the
// target moves to next. Deterministic given `randomValue` (0..1), same
// pattern as weighting.js — the caller supplies the randomness so this
// stays testable without mocking Math.random.
describe('pickNextCell', () => {
  it('picks a cell within the grid based on the random value', () => {
    expect(pickNextCell(-1, 0)).toBe(0)
    expect(pickNextCell(-1, 0.99)).toBe(GRID_SIZE - 1)
  })

  it('never returns the same cell twice in a row, even if the random value would land on it', () => {
    // Cell 4 is the current target; a random value that would naturally
    // land on 4 again should be nudged to a different cell instead —
    // otherwise the target could visually "not move" for a whole 0.7s
    // window, which reads as a bug, not a rare shrug-worthy repeat.
    const current = 4
    const randomValueThatWouldHitCurrent = 0.5 // floor(0.5 * 9) === 4
    const next = pickNextCell(current, randomValueThatWouldHitCurrent)
    expect(next).not.toBe(current)
  })

  it('is deterministic for a given (current, randomValue) pair', () => {
    expect(pickNextCell(2, 0.5)).toBe(pickNextCell(2, 0.5))
  })
})

describe('MAX_SCORE', () => {
  it('matches the spec’s documented ceiling (~43 hits: ceil(30s / 0.7s))', () => {
    expect(MAX_SCORE).toBe(43)
  })
})

// Arena tweak (post-launch addition): bonus cell + speed bursts.
describe('isBonusWindow', () => {
  it('is a bonus window when the random value is below BONUS_CHANCE', () => {
    expect(isBonusWindow(0)).toBe(true)
    expect(isBonusWindow(BONUS_CHANCE - 0.001)).toBe(true)
  })

  it('is not a bonus window at or above BONUS_CHANCE', () => {
    expect(isBonusWindow(BONUS_CHANCE)).toBe(false)
    expect(isBonusWindow(0.99)).toBe(false)
  })
})

describe('pickBurstStartTimes', () => {
  it('places each burst inside its own equal segment of the round, never overlapping', () => {
    // 30s round, 2 bursts of 3s each -> two 15s segments, one burst per
    // segment. randomValues of 0 puts each burst at the start of its
    // segment — the simplest case to reason about.
    const starts = pickBurstStartTimes(30_000, 3_000, 2, [0, 0])
    expect(starts).toEqual([0, 15_000])
  })

  it('keeps a burst fully inside its segment even at the random value’s upper edge', () => {
    const starts = pickBurstStartTimes(30_000, 3_000, 2, [1, 1])
    // Segment 1 is [0, 15000): latest a 3000ms burst can start and still
    // fit is 12000. Segment 2 is [15000, 30000): latest start is 27000.
    expect(starts[0]).toBeLessThanOrEqual(12_000)
    expect(starts[1]).toBeLessThanOrEqual(27_000)
    expect(starts[1]).toBeGreaterThanOrEqual(15_000)
  })
})

describe('isDuringBurst', () => {
  const burstStartTimes = [0, 15_000]
  const burstDurationMs = 3_000

  it('is true right at a burst’s start and false right at its end', () => {
    expect(isDuringBurst(0, burstStartTimes, burstDurationMs)).toBe(true)
    expect(isDuringBurst(2_999, burstStartTimes, burstDurationMs)).toBe(true)
    expect(isDuringBurst(3_000, burstStartTimes, burstDurationMs)).toBe(false)
  })

  it('is false between bursts and true again inside the second one', () => {
    expect(isDuringBurst(10_000, burstStartTimes, burstDurationMs)).toBe(false)
    expect(isDuringBurst(16_000, burstStartTimes, burstDurationMs)).toBe(true)
  })
})
