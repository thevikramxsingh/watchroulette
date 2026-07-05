import { useEffect, useRef, useState } from 'react'
import { computeSpinRotation, computeWeights } from './weighting'
import { computeBadgeSize } from './badgeSize'
import { playTickSound } from './playTickSound'
import { playRevealChime } from './playRevealChime'
import { fireRevealConfetti } from './fireRevealConfetti'
import Curtain from '../../shared/Curtain'

const RADIUS = 90
const CENTER = 100
const BADGE_RADIUS = 58 // distance from center to each slice's poster badge
// Badge radius is no longer a single fixed number — see badgeSize.js for
// why: the pool has no size cap, so a fixed value is either too small for
// a short pool or crowds badges together once a group's repo grows. MIN is
// exactly the old fixed value (never worse than before this existed); MAX
// is the biggest a badge is allowed to get even when there's plenty of
// room, so a 2-3 movie pool doesn't blow up into oversized circles.
const BADGE_SIZE_MIN = 15
const BADGE_SIZE_MAX = 22
const HUB_RADIUS = 17
const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w92'
const REVEAL_POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w154' // bigger than a wheel badge — this is the reveal itself, not a label

// Extra full rotations added purely for the visual "it's spinning" effect —
// doesn't change where the wheel actually stops (see weighting.js's
// computeSpinRotation). Kept as a named constant here since the same value
// has to be used both when computing the stop angle and when advancing the
// rotation baseline for the next spin (see the effect below).
const FULL_SPINS = 4

// Module 5b, beat 2 — canned fractions of animationMs at which a
// deceleration tick fires, not physically derived from the exact CSS
// bezier's instantaneous velocity (good enough to feel like it's losing
// momentum, without the engineering cost of deriving it from the curve).
// Gaps between consecutive fractions widen (.10, .12, .14, .16) — ticks
// spread further apart as the wheel appears to slow.
const TICK_FRACTIONS = [0.35, 0.45, 0.57, 0.71, 0.87]

// Module 5b, beat 3 — the "held breath" pause between the wheel actually
// stopping and the curtains starting to move. Spec's own number.
const MICRO_PAUSE_MS = 400

// Module 5b, beat 4 — how long the curtain panels take to finish parting.
// Not pinned by spec to an exact value (only the wheel's own animationMs
// is); chosen to read as a deliberate, unhurried motion rather than a snap.
const CURTAIN_DURATION_MS = 650

function polarToCartesian(angleDeg, radius = RADIUS) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  }
}

// Slice *sizes* are still real, not decorative — computed from the same
// weighting.js the actual pick uses, so a spotlighted movie's slice is
// visibly wider — but slices no longer carry their own fill color or text.
// Redesigned after the amber-era version read as "a black box": tried
// recoloring slices and tried labeling them with (truncated) titles, and
// both failed for the same reason a wheel this size can't hold a movie
// title. Researched how real wheels solve this instead — roulette wheels
// never put labels on the wheel at all (meaning lives in a separate table);
// gamified reward-wheel apps (Zepto/Blinkit-style) use one calm wheel body
// with a small badge per slice carrying the actual content. Landed here:
// one uniform wheel face, thin gold divider lines, and a poster-thumbnail
// badge per slice — the poster carries recognition, no text needed.
//
// `targetMovie` is the winner — known from the moment a spin starts (ADR
// 0002 decides it up front), not just once `spinning` goes false, so the
// exact stop angle can be computed at spin-start rather than guessed.
export default function SpinWheel({ pool, spinning, targetMovie, animationMs = 2500 }) {
  const [rotation, setRotation] = useState(0)
  // Tracks which winner's rotation has already been applied, so a re-render
  // mid-spin (e.g. the parent re-rendering for an unrelated reason) doesn't
  // recompute and restart the CSS transition. Cleared once spinning ends so
  // the next spin (a fresh pick, possibly the same movie again after a
  // veto-excluded re-spin) is free to trigger again.
  const appliedWinnerIdRef = useRef(null)
  // Always kept as a multiple of 360 *before* each spin's own rotation is
  // added — see the comment below on why this matters for correctness.
  const baselineRef = useRef(0)

  // Module 5b's reveal choreography — a small state machine, not just
  // `!spinning`. 'idle' (nothing to show yet) -> 'paused' (wheel stopped,
  // curtains still closed — the held-breath beat) -> 'curtain' (panels
  // parting) -> 'revealed' (chime + confetti already fired). Tracked
  // separately from `spinning` because a page that loads mid-round to an
  // *already*-resolved pick (see DecisionEngine's "already resolved"
  // effect branch) should show the result immediately, with none of this
  // — replaying the full fanfare on every page load/refresh would cheapen
  // the one time it's supposed to actually mean something.
  const [revealPhase, setRevealPhase] = useState('idle')
  // True only when *this* SpinWheel instance actually watched `spinning`
  // go true -> false for the current targetMovie — the signal that
  // distinguishes "just finished animating" from "arrived already decided".
  const justAnimatedRef = useRef(false)

  useEffect(() => {
    if (!spinning || !targetMovie) {
      appliedWinnerIdRef.current = null
      return
    }
    if (appliedWinnerIdRef.current === targetMovie.id) return

    appliedWinnerIdRef.current = targetMovie.id
    // Rotation is a CSS transform, so only the angle *mod 360* is ever
    // visible — adding raw offsets on top of an arbitrary running total
    // would drift the visible landing spot after the first spin. Adding
    // this spin's rotation on top of a baseline that's always a clean
    // multiple of 360 keeps every spin's landing correct regardless of how
    // many spins came before it on this device.
    setRotation(baselineRef.current + computeSpinRotation(pool, targetMovie.id, FULL_SPINS))
    baselineRef.current += FULL_SPINS * 360

    // Module 5b, beat 2 — deceleration ticks, timed relative to this same
    // spin's own animationMs so they always land within the rotation
    // that's actually happening, whatever animationMs is set to.
    const tickTimers = TICK_FRACTIONS.map((fraction) =>
      setTimeout(() => playTickSound(), animationMs * fraction)
    )
    return () => tickTimers.forEach(clearTimeout)
  }, [spinning, targetMovie, pool, animationMs])

  // Drives revealPhase off spinning/targetMovie — see the state machine
  // comment above.
  useEffect(() => {
    if (spinning) {
      justAnimatedRef.current = true
      setRevealPhase('idle')
      return
    }
    if (!targetMovie) return

    if (justAnimatedRef.current) {
      justAnimatedRef.current = false
      setRevealPhase('paused')
    } else {
      setRevealPhase((current) => (current === 'idle' ? 'revealed' : current))
    }
  }, [spinning, targetMovie])

  // Module 5b, beat 3 — the micro-pause, then the curtain starts parting.
  useEffect(() => {
    if (revealPhase !== 'paused') return
    const timer = setTimeout(() => setRevealPhase('curtain'), MICRO_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [revealPhase])

  // Module 5b, beat 5 — once the curtain finishes parting, the chime and
  // confetti fire together, once, right as the reveal actually lands.
  useEffect(() => {
    if (revealPhase !== 'curtain') return
    const timer = setTimeout(() => {
      playRevealChime()
      fireRevealConfetti()
      setRevealPhase('revealed')
    }, CURTAIN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [revealPhase])

  const weights = pool.length > 0 ? computeWeights(pool) : []
  let cursor = 0
  const slices = weights.map(({ movie, weight }) => {
    const startAngle = cursor * 360
    cursor += weight
    const endAngle = cursor * 360
    const midAngle = (startAngle + endAngle) / 2
    return { movie, startAngle, endAngle, midAngle }
  })
  // Recomputed every render off the pool actually on the wheel right now —
  // cheap (a handful of trig calls), and it's exactly this render's slice
  // layout that determines how much room badges have, not some cached
  // value from a previous pool size.
  const badgeSize = computeBadgeSize(
    slices.map((slice) => slice.midAngle),
    BADGE_RADIUS,
    { min: BADGE_SIZE_MIN, max: BADGE_SIZE_MAX }
  )

  const curtainOpen = revealPhase === 'curtain' || revealPhase === 'revealed'
  const contentVisible = revealPhase !== 'paused'

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 200 200" aria-hidden="true" className="h-36 w-36">
        {/* Only the wheel face rotates — the pointer below is a sibling, not
            nested inside this group, specifically so it stays fixed in
            place while the wheel spins under it. Without a fixed marker,
            "lands on the winning slice" has no visible reference point: the
            math can be perfectly correct and still look like nothing
            happened, which is exactly what got flagged. */}
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: `${CENTER}px ${CENTER}px`,
            transition: spinning
              ? `transform ${animationMs}ms cubic-bezier(0.15, 0.7, 0.2, 1)`
              : 'none',
          }}
        >
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="var(--color-card)" />

          {/* Divider lines between slices — the only per-slice geometry
              left; no per-slice fill color, no text. */}
          {slices.map(({ movie, startAngle }) => {
            const point = polarToCartesian(startAngle)
            return (
              <line
                key={`divider-${movie.id}`}
                x1={CENTER}
                y1={CENTER}
                x2={point.x}
                y2={point.y}
                stroke="var(--color-gold)"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
            )
          })}

          {/* Tick marks just outside the rim, at the same boundary angles —
              a cheap detail that reads as a physical wheel's pegs rather
              than a flat pie chart. */}
          {slices.map(({ movie, startAngle }) => {
            const inner = polarToCartesian(startAngle, RADIUS)
            const outer = polarToCartesian(startAngle, RADIUS + 7)
            return (
              <line
                key={`tick-${movie.id}`}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="var(--color-gold)"
                strokeWidth="2"
              />
            )
          })}

          {/* Poster badges — one per slice, at its angular midpoint. The
              poster is the label; nothing else identifies a slice. */}
          {slices.map(({ movie, midAngle }) => {
            const pos = polarToCartesian(midAngle, BADGE_RADIUS)
            const clipId = `wheel-badge-clip-${movie.id}`
            return (
              <g key={`badge-${movie.id}`}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={badgeSize + (movie.spotlighted ? 3 : 2)}
                  fill="none"
                  stroke={movie.spotlighted ? 'var(--color-gold)' : 'var(--color-warmgray)'}
                  strokeOpacity={movie.spotlighted ? '1' : '0.6'}
                  strokeWidth={movie.spotlighted ? '3' : '2'}
                />
                {movie.poster_path ? (
                  <>
                    <clipPath id={clipId}>
                      <circle cx={pos.x} cy={pos.y} r={badgeSize} />
                    </clipPath>
                    <image
                      href={`${POSTER_BASE_URL}${movie.poster_path}`}
                      x={pos.x - badgeSize}
                      y={pos.y - badgeSize}
                      width={badgeSize * 2}
                      height={badgeSize * 2}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#${clipId})`}
                    />
                  </>
                ) : (
                  <circle cx={pos.x} cy={pos.y} r={badgeSize} fill="var(--color-page)" />
                )}
                {movie.spotlighted && (
                  <text
                    x={pos.x}
                    y={pos.y - badgeSize + 2}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--color-gold)"
                  >
                    ★
                  </text>
                )}
              </g>
            )
          })}

          {/* Center hub — spins with the wheel, purely decorative. */}
          <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS} fill="var(--color-gold)" />
          <text x={CENTER} y={CENTER + 5} textAnchor="middle" fontSize="16">
            🎬
          </text>
        </g>

        {/* Fixed pointer — marks the one spot slices are judged against.
            Drawn last so it renders on top of the wheel. */}
        <path d="M 100 2 L 88 20 L 112 20 Z" fill="var(--color-gold)" stroke="var(--color-page)" strokeWidth="1" />
      </svg>

      {spinning && <p className="text-sm text-warmgray">Spinning…</p>}

      {/* Module 5b, beats 3-5 — the reveal stage. Always mounted once
          revealPhase leaves 'idle' (Curtain is chrome, not a gate — see its
          own comment), so role="status" is reachable as soon as there's a
          result at all, even while the curtain is still visually closed
          during the micro-pause. The curtain and the opacity/delay pair
          below are what actually control when a person *sees* it. */}
      {revealPhase !== 'idle' && targetMovie && (
        <div className="relative w-full max-w-[220px] overflow-hidden rounded-lg">
          <div className="flex flex-col items-center gap-2 bg-card px-4 py-5 ring-1 ring-gold/20">
            <p
              className={`text-[10px] font-medium uppercase tracking-widest text-gold transition-opacity duration-300 ${
                contentVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              Tonight&apos;s pick
            </p>

            {targetMovie.poster_path && (
              <img
                src={`${REVEAL_POSTER_BASE_URL}${targetMovie.poster_path}`}
                alt={`${targetMovie.title} poster`}
                className="h-28 w-auto rounded-md object-cover ring-1 ring-gold/30"
              />
            )}

            <p
              role="status"
              className={`text-center font-display text-base font-semibold text-cream transition-opacity delay-150 duration-300 ${
                contentVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {targetMovie.title}
            </p>
          </div>

          <Curtain open={curtainOpen} durationMs={CURTAIN_DURATION_MS} />
        </div>
      )}
    </div>
  )
}
