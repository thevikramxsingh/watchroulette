// Split from SpinWheel.jsx so the actual geometry math is unit-testable
// without rendering an SVG — same "pure logic gets its own tests" boundary
// as weighting.js.
//
// Why this exists: a fixed badge size is wrong for this wheel specifically,
// because there's no cap anywhere on how many movies can be in a lobby's
// unwatched pool. A size chosen to look good with 6 movies overlaps once a
// group's repo grows to 20; a size chosen to be safe at 20 looks needlessly
// small at 6. Instead, every render computes the tightest angular gap
// between two neighboring badges and sizes ALL badges (uniformly — a
// wheel with mismatched badge sizes would look like a bug, not a feature)
// to fit that gap, clamped between a floor (never smaller than looked fine
// before this existed) and a ceiling (never so large that a 2-3 movie pool
// looks like a magnifying glass).

// Leaves a visible gap between two adjacent badges at their tightest
// spacing, rather than letting them sit edge-to-edge with no breathing
// room — 0.85 chosen by eye, not derived from anything.
const NEIGHBOR_GAP_FACTOR = 0.85

// Smallest angular gap (in degrees) between any two adjacent badges,
// measured around the full circle (including the wrap from the last slice
// back to the first). Pure — takes plain angle numbers, not slice objects,
// so it has no dependency on this file's caller's own data shapes.
export function minAngularGapDeg(midAnglesDeg) {
  if (midAnglesDeg.length <= 1) return 360
  const sorted = [...midAnglesDeg].sort((a, b) => a - b)
  let minGap = Infinity
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    const next = sorted[(i + 1) % sorted.length]
    const gap = i === sorted.length - 1 ? next + 360 - current : next - current
    minGap = Math.min(minGap, gap)
  }
  return minGap
}

// badgeRadius: distance from wheel center to each badge's own center
// (BADGE_RADIUS in SpinWheel.jsx) — the radius of the circle the badges sit
// on, not a badge's own size.
export function computeBadgeSize(midAnglesDeg, badgeRadius, { min, max }) {
  // A single slice has no neighbor at all, so nothing geometric constrains
  // it — the 360°-gap the chord formula would otherwise use actually means
  // "two points diametrically opposite" (sin(180°) = 0), the opposite of
  // what's true here. Short-circuit straight to the ceiling instead.
  if (midAnglesDeg.length <= 1) return max

  const gapDeg = minAngularGapDeg(midAnglesDeg)
  const gapRad = (gapDeg * Math.PI) / 180
  // Chord length between two badge centers separated by gapDeg, on a circle
  // of radius badgeRadius — the straight-line distance their two badges'
  // centers actually sit apart, which is what limits how big both can be
  // before they touch.
  const chord = 2 * badgeRadius * Math.sin(gapRad / 2)
  const safeRadius = (chord / 2) * NEIGHBOR_GAP_FACTOR
  return Math.min(max, Math.max(min, safeRadius))
}
