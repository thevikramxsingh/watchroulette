import { describe, it, expect } from 'vitest'
import { computeSpinRotation, computeWeights, pickFromWeights, spinWheel } from './weighting'

// Unit tests for the wheel's weighted-random pick, per ADR 0001: spotlighted
// movies as a group always get a fixed 70% combined chance, split evenly;
// non-spotlighted split the remaining 30%. pickFromWeights takes the random
// value as a plain argument (not Math.random()) specifically so these tests
// don't need to mock randomness — they just assert the boundaries directly.
describe('computeWeights', () => {
  it('gives every movie equal odds when nothing is spotlighted', () => {
    const movies = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
    const weights = computeWeights(movies)
    expect(weights.every((w) => w.weight === 0.25)).toBe(true)
  })

  it('splits 70% evenly across spotlighted movies and 30% across the rest', () => {
    const movies = [
      { id: 1, spotlighted: true },
      { id: 2, spotlighted: true },
      { id: 3 },
      { id: 4 },
    ]
    const weights = computeWeights(movies)
    const spotlightWeights = weights.filter((w) => w.movie.spotlighted)
    const restWeights = weights.filter((w) => !w.movie.spotlighted)

    expect(spotlightWeights.every((w) => w.weight === 0.35)).toBe(true) // 0.7 / 2
    expect(restWeights.every((w) => w.weight === 0.15)).toBe(true) // 0.3 / 2
  })

  it('holds the 70% group total regardless of how many are spotlighted (no dilution)', () => {
    const twoSpotlighted = computeWeights([
      { id: 1, spotlighted: true },
      { id: 2, spotlighted: true },
      { id: 3 },
    ])
    const fourSpotlighted = computeWeights([
      { id: 1, spotlighted: true },
      { id: 2, spotlighted: true },
      { id: 3, spotlighted: true },
      { id: 4, spotlighted: true },
      { id: 5 },
    ])

    const sumSpotlight = (weights) =>
      weights.filter((w) => w.movie.spotlighted).reduce((sum, w) => sum + w.weight, 0)

    expect(sumSpotlight(twoSpotlighted)).toBeCloseTo(0.7)
    expect(sumSpotlight(fourSpotlighted)).toBeCloseTo(0.7)
  })

  it('falls back to equal odds when every movie is spotlighted (no "rest" to give 30% to)', () => {
    const movies = [
      { id: 1, spotlighted: true },
      { id: 2, spotlighted: true },
    ]
    const weights = computeWeights(movies)
    expect(weights.every((w) => w.weight === 0.5)).toBe(true)
  })
})

describe('pickFromWeights', () => {
  const weights = [
    { movie: { id: 1 }, weight: 0.5 },
    { movie: { id: 2 }, weight: 0.3 },
    { movie: { id: 3 }, weight: 0.2 },
  ]

  it('picks the first movie for a random value inside its range', () => {
    expect(pickFromWeights(weights, 0)).toEqual({ id: 1 })
    expect(pickFromWeights(weights, 0.49)).toEqual({ id: 1 })
  })

  it('picks the second movie right at the first boundary', () => {
    expect(pickFromWeights(weights, 0.5)).toEqual({ id: 2 })
    expect(pickFromWeights(weights, 0.79)).toEqual({ id: 2 })
  })

  it('picks the third movie for the remaining range', () => {
    expect(pickFromWeights(weights, 0.8)).toEqual({ id: 3 })
    expect(pickFromWeights(weights, 0.99)).toEqual({ id: 3 })
  })
})

describe('spinWheel', () => {
  it('returns null for an empty pool', () => {
    expect(spinWheel([])).toBeNull()
  })

  it('returns the only movie when the pool has exactly one', () => {
    const movie = { id: 1 }
    expect(spinWheel([movie])).toEqual(movie)
  })
})

// Fixes the wheel-landing bug flagged in a design review: the wheel used to
// spin indefinitely and then just swap to a text reveal, never actually
// rotating to point at the winning slice. The winner is already decided
// before the animation starts (ADR 0002), so the exact stop angle is
// knowable up front — this is that calculation, kept pure/testable the same
// way the rest of this file is: caller supplies data, no DOM, no randomness.
describe('computeSpinRotation', () => {
  it('lands past several full spins, offset so the single slice sits at the pointer', () => {
    // One movie -> one slice covering the whole circle (0-360, midpoint 180).
    // Any offset technically lands inside it, but the midpoint calculation
    // should still be exact and deterministic.
    const movies = [{ id: 1 }]
    expect(computeSpinRotation(movies, 1)).toBe(4 * 360 + 180)
  })

  it('lands on the correct slice for a 50/50 split, picking the winner by id', () => {
    // Two equal movies -> slice 1 is 0-180 (midpoint 90), slice 2 is 180-360
    // (midpoint 270). Rotating clockwise by (360 - midpoint) brings that
    // slice's midpoint to the fixed pointer at the top (angle 0).
    const movies = [{ id: 1 }, { id: 2 }]
    expect(computeSpinRotation(movies, 1)).toBe(4 * 360 + 270)
    expect(computeSpinRotation(movies, 2)).toBe(4 * 360 + 90)
  })

  it('respects a custom fullSpins count', () => {
    const movies = [{ id: 1 }, { id: 2 }]
    expect(computeSpinRotation(movies, 2, 1)).toBe(1 * 360 + 90)
    expect(computeSpinRotation(movies, 2, 6)).toBe(6 * 360 + 90)
  })

  it("lands on a spotlighted movie's larger slice correctly, not just equal-odds math", () => {
    // Spotlighted movie gets 0.7 of the circle (0-252, midpoint 126); the
    // non-spotlighted one gets the remaining 0.3 (252-360, midpoint 306).
    const movies = [{ id: 1, spotlighted: true }, { id: 2 }]
    expect(computeSpinRotation(movies, 1)).toBe(4 * 360 + (360 - 126))
    expect(computeSpinRotation(movies, 2)).toBe(4 * 360 + (360 - 306))
  })

  it('falls back to zero offset if the winner id is not in the pool (defensive, should not happen)', () => {
    const movies = [{ id: 1 }, { id: 2 }]
    expect(computeSpinRotation(movies, 999)).toBe(4 * 360)
  })
})
