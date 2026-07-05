import { useEffect, useRef, useState } from 'react'
import { clearAllSpotlights } from '../repo/repoApi'
import { fetchLobby, resetRound, submitScoreIfHighest } from '../../shared/lobbyApi'
import { usePolling } from '../../shared/usePolling'
import { useLocalStorageState } from '../../shared/useLocalStorageState'
import {
  BONUS_CHANCE,
  BONUS_SCORE,
  BURST_COUNT,
  BURST_DURATION_MS,
  BURST_TICK_MS,
  GRID_SIZE,
  isBonusWindow,
  isDuringBurst,
  pickBurstStartTimes,
  pickNextCell,
} from './game'
import { playHitSound } from './playHitSound'

// Module 3 — Arena. Whack-a-mole reaction game: one attempt per person per
// round, winning it unlocks the veto (Module 2 already knows how to spend
// one). Base behavior specified in spec.md's "Arena — detail"; the bonus
// cell / speed burst / streak tweak is in spec.md's "Arena tweak" section
// (brainstormed after the base game shipped). Edge cases covered in
// ArenaGame.test.jsx.
export default function ArenaGame({
  addedBy,
  pollIntervalMs = 4000,
  tickMs = 700,
  roundDurationMs = 30_000,
  bonusChance = BONUS_CHANCE,
  burstCount = BURST_COUNT,
  burstDurationMs = BURST_DURATION_MS,
  burstTickMs = BURST_TICK_MS,
}) {
  const { data: lobby, refetch: refetchLobby } = usePolling(fetchLobby, pollIntervalMs)

  const [phase, setPhase] = useState('idle') // idle | playing | finished
  const [activeCell, setActiveCell] = useState(null)
  const [isBonusActive, setIsBonusActive] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [finalScore, setFinalScore] = useState(null)

  // "One attempt per person per round, locked in once played" (spec) — no
  // new table for this, per spec's explicit call. What a new table WOULD
  // have given us for free is a signal for "a new round started, your old
  // flag doesn't count anymore" — that's what game_lobby.round_number is
  // for (see schema.sql's comment on it).
  const [lastPlayedRound, setLastPlayedRound] = useLocalStorageState(
    'watchroulette:arena:lastPlayedRound',
    null
  )

  // Mirrors `score`/`streak` so closures captured at round-start (the tick
  // scheduler, the round-end timeout) can read the true current value
  // instead of a stale one from whenever the closure was created.
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const hitThisWindowRef = useRef(false)
  const tickTimerRef = useRef(null)
  const endTimerRef = useRef(null)
  const roundStartRef = useRef(0)
  const burstStartTimesRef = useRef([])

  useEffect(() => {
    return () => {
      clearTimeout(tickTimerRef.current)
      clearTimeout(endTimerRef.current)
    }
  }, [])

  const alreadyPlayedThisRound = Boolean(lobby) && lastPlayedRound === lobby.round_number

  async function finishRound(roundNumberAtStart) {
    const finished = scoreRef.current
    setPhase('finished')
    setFinalScore(finished)
    setActiveCell(null)
    setLastPlayedRound(roundNumberAtStart)

    if (lobby && finished > lobby.round_high_score) {
      try {
        await submitScoreIfHighest(addedBy, finished)
        refetchLobby()
      } catch (err) {
        console.error('Failed to submit Arena score', err)
      }
    }
  }

  // Recursive setTimeout rather than setInterval — the delay itself needs
  // to vary (BURST_TICK_MS during a burst, tickMs otherwise), which a
  // single setInterval can't do without being torn down and recreated
  // every time a burst starts or ends anyway. Timing is measured from
  // roundStartRef (real wall-clock elapsed time), not accumulated delays,
  // so burst windows land at consistent points regardless of any event
  // loop jitter.
  function scheduleNextTick() {
    const elapsed = Date.now() - roundStartRef.current
    const inBurst = isDuringBurst(elapsed, burstStartTimesRef.current, burstDurationMs)
    const delay = inBurst ? burstTickMs : tickMs

    tickTimerRef.current = setTimeout(() => {
      // A window that elapsed with zero hits breaks the streak. Checked
      // before resetting hitThisWindowRef for the *new* window.
      if (!hitThisWindowRef.current) {
        streakRef.current = 0
        setStreak(0)
      }
      hitThisWindowRef.current = false

      setActiveCell((current) => pickNextCell(current, Math.random()))
      setIsBonusActive(isBonusWindow(Math.random(), bonusChance))
      scheduleNextTick()
    }, delay)
  }

  function handlePlay() {
    if (alreadyPlayedThisRound || phase === 'playing' || !lobby) return

    setPhase('playing')
    setScore(0)
    setStreak(0)
    setFinalScore(null)
    scoreRef.current = 0
    streakRef.current = 0
    hitThisWindowRef.current = false

    roundStartRef.current = Date.now()
    burstStartTimesRef.current = pickBurstStartTimes(
      roundDurationMs,
      burstDurationMs,
      burstCount,
      Array.from({ length: burstCount }, () => Math.random())
    )

    setActiveCell(pickNextCell(-1, Math.random()))
    setIsBonusActive(isBonusWindow(Math.random(), bonusChance))
    scheduleNextTick()

    endTimerRef.current = setTimeout(() => {
      clearTimeout(tickTimerRef.current)
      finishRound(lobby.round_number)
    }, roundDurationMs)
  }

  function handleCellClick(index) {
    if (phase !== 'playing' || index !== activeCell || hitThisWindowRef.current) return
    hitThisWindowRef.current = true

    const points = isBonusActive ? BONUS_SCORE : 1
    scoreRef.current += points
    setScore(scoreRef.current)

    streakRef.current += 1
    setStreak(streakRef.current)

    playHitSound()
  }

  async function handleNewRound() {
    if (!lobby) return
    try {
      // resetRound now takes the whole lobby row, not just round_number —
      // it logs the round that just ended to round_history (Module 5c)
      // before clearing game_lobby for the next one.
      await Promise.all([resetRound(lobby), clearAllSpotlights()])
      refetchLobby()
    } catch (err) {
      console.error('Failed to start a new round', err)
    }
  }

  const isNewHighScore =
    phase === 'finished' &&
    lobby?.active_veto_user === addedBy &&
    lobby?.round_high_score === finalScore &&
    finalScore > 0

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-cream">The Arena</h2>

      <p className="text-xs text-warmgray">
        High score: <span className="font-mono text-cream">{lobby?.round_high_score ?? 0}</span>
        {lobby?.active_veto_user ? ` — held by ${lobby.active_veto_user}` : ''}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: GRID_SIZE }, (_, index) => {
          const isActive = activeCell === index
          const isBonusCell = isActive && isBonusActive
          return (
            <button
              key={index}
              type="button"
              aria-label={`Cell ${index + 1}${isBonusCell ? ' (bonus)' : ''}`}
              aria-pressed={isActive}
              disabled={phase !== 'playing'}
              onClick={() => handleCellClick(index)}
              className={`aspect-square rounded-lg transition duration-150 ease-out ${
                isBonusCell
                  ? 'animate-pulse bg-gold ring-2 ring-gold-hover'
                  : isActive
                    ? 'bg-gold'
                    : 'bg-card ring-1 ring-gold/15 hover:bg-card/70'
              }`}
            >
              {isBonusCell ? '★' : ''}
            </button>
          )
        })}
      </div>

      {phase === 'playing' && (
        <p role="status" className="text-sm text-warmgray">
          Score: {score}
          {streak > 0 ? ` · 🔥 ${streak}` : ''}
        </p>
      )}

      {phase === 'finished' && finalScore !== null && (
        <p role="status" className="text-sm text-cream">
          Final score: {finalScore}
          {isNewHighScore ? ' — new high score, you have the veto' : ''}
        </p>
      )}

      {phase !== 'playing' && (
        <button
          type="button"
          onClick={handlePlay}
          disabled={alreadyPlayedThisRound}
          className="rounded-md bg-gold px-3 py-2 text-sm font-medium text-gold-ink transition duration-150 ease-out hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {alreadyPlayedThisRound ? 'Already played this round' : 'Play'}
        </button>
      )}

      <button
        type="button"
        onClick={handleNewRound}
        className="rounded-md bg-card px-3 py-2 text-sm font-medium text-cream ring-1 ring-gold/20 transition duration-150 ease-out hover:bg-card/70"
      >
        New round
      </button>
    </div>
  )
}
