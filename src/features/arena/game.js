// Arena's mini-game constants and pure target-cell logic. Whack-a-mole
// pattern, researched rather than invented (spec's Arena detail cites
// Smashing Magazine's React tutorial + GitHub reference implementations).

export const GRID_SIZE = 9 // 3x3
export const TICK_MS = 700 // how often the target relocates — fixed, not scaling
export const ROUND_DURATION_MS = 30_000

// Theoretical ceiling a player could ever reach under the *base* rules (no
// bonus cells, no speed bursts): one hit per relocation window, for as many
// windows as fit in the round. Once the tweak below is in play, the DB's
// score cap moves to a flat, generous 200 instead of a value derived from
// this constant — see schema.sql's comment on why.
export const MAX_SCORE = Math.ceil(ROUND_DURATION_MS / TICK_MS)

// --- Arena tweak (post-launch addition): bonus cell + speed bursts ---
// See spec.md's "Arena tweak — bonus cell, speed bursts, feedback" for the
// full reasoning; this is just the constants + pure logic.

export const BONUS_CHANCE = 0.15 // ~15% of windows are a bonus window
export const BONUS_SCORE = 3 // points for a bonus-window hit (vs. 1 normally)

export const BURST_COUNT = 2
export const BURST_DURATION_MS = 3_000
export const BURST_TICK_MS = 300 // relocation speed during a burst

// Whether a given relocation window is a bonus window. Deterministic given
// `randomValue`, same pattern as pickNextCell above. `chance` is a param
// (not hardcoded to BONUS_CHANCE) so tests can force it to 0 or 1 for
// deterministic scoring assertions — production always uses the default.
export function isBonusWindow(randomValue, chance = BONUS_CHANCE) {
  return randomValue < chance
}

// Picks BURST_COUNT non-overlapping start times (ms from round start).
// Splits the round into `burstCount` equal segments and places one burst
// randomly within each segment — guarantees no overlap by construction,
// rather than needing collision-detection logic for randomly-placed
// intervals.
export function pickBurstStartTimes(roundDurationMs, burstDurationMs, burstCount, randomValues) {
  const segmentLength = roundDurationMs / burstCount
  const slack = segmentLength - burstDurationMs
  return randomValues.map((randomValue, index) => index * segmentLength + randomValue * slack)
}

// True if `elapsedMs` (time since the round started) falls inside any of
// the given burst windows.
export function isDuringBurst(elapsedMs, burstStartTimes, burstDurationMs) {
  return burstStartTimes.some(
    (start) => elapsedMs >= start && elapsedMs < start + burstDurationMs
  )
}

// Deterministic given `randomValue` (expected 0..1), same reasoning as
// weighting.js's pickFromWeights — the caller supplies the randomness so
// this stays pure and testable. Never repeats `current`: landing back on
// the same cell would look like the target froze for a whole 0.7s window,
// which reads as broken rather than as a rare shrug-worthy repeat.
export function pickNextCell(current, randomValue) {
  const candidate = Math.floor(randomValue * GRID_SIZE)
  if (candidate !== current) return candidate
  return (candidate + 1) % GRID_SIZE
}
