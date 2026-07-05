// Weighted-random selection for the spin wheel. Split from the component so
// the actual probability math is unit-testable without mocking Math.random()
// or rendering anything — see weighting.test.js.

// Per ADR 0001: spotlighted movies as a group always get a fixed 70%
// combined chance, split evenly among however many are spotlighted;
// non-spotlighted movies split the remaining 30%. This keeps the effect's
// strength independent of how many movies get starred, unlike a flat
// per-movie multiplier (which dilutes as more get spotlighted).
export function computeWeights(movies) {
  const spotlighted = movies.filter((movie) => movie.spotlighted)
  const rest = movies.filter((movie) => !movie.spotlighted)

  if (spotlighted.length === 0 || rest.length === 0) {
    // Nothing spotlighted -> plain equal odds (the default, costs nothing
    // when unused). Everything spotlighted -> there's no "rest" group left
    // to hand the remaining 30% to, so it collapses to equal odds too — a
    // pool where every movie is boosted is functionally the same as one
    // where none are.
    const equalWeight = 1 / movies.length
    return movies.map((movie) => ({ movie, weight: equalWeight }))
  }

  const spotlightWeight = 0.7 / spotlighted.length
  const restWeight = 0.3 / rest.length

  return [
    ...spotlighted.map((movie) => ({ movie, weight: spotlightWeight })),
    ...rest.map((movie) => ({ movie, weight: restWeight })),
  ]
}

// Deterministic given `randomValue` (expected 0..1) — the caller supplies
// the randomness so this stays a pure function.
export function pickFromWeights(weights, randomValue) {
  let cumulative = 0
  for (const { movie, weight } of weights) {
    cumulative += weight
    if (randomValue < cumulative) return movie
  }
  // Floating-point safety net: only reached if randomValue is ~1 and
  // rounding left a sliver of range uncovered. The last movie gets it.
  return weights[weights.length - 1]?.movie ?? null
}

// The one non-pure line in this file — everything it calls is pure and
// already covered by its own tests.
export function spinWheel(movies) {
  if (movies.length === 0) return null
  return pickFromWeights(computeWeights(movies), Math.random())
}

// Fixes a design-review-flagged bug: the wheel used to spin indefinitely and
// then just swap to a text reveal, never actually rotating to point at the
// winning slice. The winner is already decided the instant spinWheel() runs
// (that's the whole premise of ADR 0002's synced reveal), so the exact stop
// angle is knowable up front rather than left to an open-ended animation.
//
// Slice angles here mirror SpinWheel.jsx's own cursor accumulation exactly
// (same order as computeWeights, weight * 360 per slice) — this has to stay
// in lockstep with how the wheel is actually drawn, or the computed landing
// angle would point at the wrong slice on screen.
//
// The wheel's fixed pointer is at the top (angle 0). Rotating the wheel
// clockwise by R degrees moves whatever was at angle A to (A + R) mod 360.
// To land the winning slice's midpoint on the pointer, solve for R:
// (midpoint + R) mod 360 = 0 -> R = (360 - midpoint) mod 360. `fullSpins`
// extra full rotations are added purely for the visual "it's spinning"
// effect — they don't change where it stops.
export function computeSpinRotation(movies, winnerId, fullSpins = 4) {
  const weights = computeWeights(movies)
  let cursor = 0
  let midpoint = 0

  for (const { movie, weight } of weights) {
    const start = cursor * 360
    cursor += weight
    const end = cursor * 360
    if (movie.id === winnerId) {
      midpoint = (start + end) / 2
      break
    }
  }

  const offset = (360 - midpoint) % 360
  return fullSpins * 360 + offset
}
