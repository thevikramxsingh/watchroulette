import { describe, it, expect } from 'vitest'
import { minAngularGapDeg, computeBadgeSize } from './badgeSize'

describe('minAngularGapDeg', () => {
  it('returns a full circle when there is nothing to be crowded by', () => {
    expect(minAngularGapDeg([])).toBe(360)
    expect(minAngularGapDeg([42])).toBe(360)
  })

  it('finds the tightest gap among evenly spaced angles', () => {
    expect(minAngularGapDeg([0, 90, 180, 270])).toBe(90)
  })

  it('finds the tightest gap regardless of input order, including the wrap-around gap', () => {
    // Sorted: 10, 170, 350 — gaps are 160, 180, and the wrap from 350 back
    // to 10 (20) — the tightest of the three.
    expect(minAngularGapDeg([350, 10, 170])).toBe(20)
  })
})

describe('computeBadgeSize', () => {
  const BADGE_RADIUS = 58
  const RANGE = { min: 15, max: 22 }

  it('uses the ceiling when there is only one slice to place (nothing to crowd it)', () => {
    expect(computeBadgeSize([0], BADGE_RADIUS, RANGE)).toBe(22)
  })

  it('uses the ceiling for a small, well-spaced pool', () => {
    // 4 slices, 90° apart — plenty of room, so it hits the cap rather than
    // scaling all the way up to whatever the raw math would allow.
    expect(computeBadgeSize([0, 90, 180, 270], BADGE_RADIUS, RANGE)).toBe(22)
  })

  it('scales down smoothly for a mid-sized pool that does not need the full ceiling', () => {
    // 8 evenly spaced slices (45° apart) lands the safe radius between the
    // floor and ceiling — this is the "actually computed, not clamped"
    // case, so it's checked against the real geometry rather than snapped
    // to one of the two bounds.
    const midAngles = [0, 45, 90, 135, 180, 225, 270, 315]
    const result = computeBadgeSize(midAngles, BADGE_RADIUS, RANGE)
    expect(result).toBeGreaterThan(RANGE.min)
    expect(result).toBeLessThan(RANGE.max)
    expect(result).toBeCloseTo(18.87, 1)
  })

  it('never drops below the floor even for a crowded pool, matching the old fixed size', () => {
    // 12 evenly spaced slices (30° apart) — tight enough that the raw
    // no-overlap math would ask for something smaller than the floor. The
    // floor wins: this is never worse than the fixed size every pool used
    // to get regardless of count, only ever better when there's room.
    const midAngles = Array.from({ length: 12 }, (_, i) => i * 30)
    expect(computeBadgeSize(midAngles, BADGE_RADIUS, RANGE)).toBe(15)
  })
})
