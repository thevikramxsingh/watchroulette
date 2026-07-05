import { useEffect, useRef, useState } from 'react'
import { fetchMovies, setSpotlighted } from '../repo/repoApi'
import { fetchLobby, isSpinInProgress, startSpin, useVeto } from '../../shared/lobbyApi'
import { usePolling } from '../../shared/usePolling'
import { deriveGenres } from '../../shared/deriveGenres'
import { spinWheel } from './weighting'
import SpinWheel from './SpinWheel'
import MovieCard from '../../shared/MovieCard'

// Module 2 — Decision Engine. Genre filter, Spotlight toggles, the spin
// itself, and veto re-spins. Behavior specified in spec.md's "Decision
// engine — spin wheel detail" plus ADR 0001 (weighting) and ADR 0002
// (synced reveal without Realtime); edge cases covered in
// DecisionEngine.test.jsx.
export default function DecisionEngine({ addedBy, pollIntervalMs = 4000, animationMs = 2500 }) {
  const { data: movies, refetch: refetchMovies } = usePolling(fetchMovies, pollIntervalMs)
  const { data: lobby } = usePolling(fetchLobby, pollIntervalMs)

  const [genreFilter, setGenreFilter] = useState('all')
  const [spinning, setSpinning] = useState(false)
  // Renamed from revealedMovieId (design-review fix): the winner is knowable
  // the instant a spin starts, not just once it ends — SpinWheel needs that
  // id up front to compute where to stop rotating, not only for the
  // post-spin text. Set immediately below, in both the self-initiated and
  // catch-up-to-a-friend's-spin paths, instead of staying null until the
  // animation timer fires.
  const [targetMovieId, setTargetMovieId] = useState(null)

  // Tracks the last spin_started_at this component has already reacted to
  // — either because it just wrote it itself (see runSpin) or because a
  // previous poll already animated it. Without this, every 4s poll tick
  // would re-trigger the effect below for the same, already-shown spin.
  //
  // Stored as a parsed epoch ms number, not the raw string — bug fix (see
  // "why is it spinning twice?"): the client writes
  // `new Date().toISOString()` (millisecond precision, "Z" suffix), but
  // Postgres/PostgREST can echo the same instant back in a different
  // string form (e.g. a "+00:00" offset). Same instant, different string —
  // raw string equality treated an already-seen spin as brand new the
  // moment a poll landed after the animation had already finished
  // (isSpinInProgress's 4s window outlives animationMs, so there's a real
  // gap where this could fire), replaying the whole spin a second time.
  // Comparing by parsed value is immune to serialization differences.
  const lastSeenSpinStartedAt = useRef(null)

  const unwatched = (movies ?? []).filter((movie) => !movie.watched)
  // Shared with the Repo panel's genre filter (Module 6) — one derivation,
  // not two copies of the same reduce-and-sort.
  const genres = deriveGenres(unwatched)
  const pool =
    genreFilter === 'all'
      ? unwatched
      : unwatched.filter((movie) => movie.genres?.includes(genreFilter))

  // Reacts to any spin_started_at this component hasn't seen yet — whether
  // that's this device's own spin (pre-marked as seen in runSpin, so this
  // won't double-animate it) or a friend's, discovered on the next poll.
  // See ADR 0002.
  useEffect(() => {
    if (!lobby?.spin_started_at) return
    const spinStartedAtMs = new Date(lobby.spin_started_at).getTime()
    if (spinStartedAtMs === lastSeenSpinStartedAt.current) return

    lastSeenSpinStartedAt.current = spinStartedAtMs

    if (isSpinInProgress(lobby)) {
      // chosen_movie_id is already the final winner at this point — the
      // spinning client wrote it before its own animation even started
      // (ADR 0002) — so a catching-up client can set the target immediately
      // too, letting its own wheel animate to the correct stop angle rather
      // than spinning blind until the reveal.
      setSpinning(true)
      setTargetMovieId(lobby.chosen_movie_id)
      const timer = setTimeout(() => {
        setSpinning(false)
      }, animationMs)
      return () => clearTimeout(timer)
    }

    // Already resolved before we noticed (e.g. the page just loaded) —
    // show the result straight away, there's nothing left to animate.
    setSpinning(false)
    setTargetMovieId(lobby.chosen_movie_id)
  }, [lobby, animationMs])

  function runSpin(candidatePool, writeResult) {
    const winner = spinWheel(candidatePool)
    if (!winner) return

    // Decided locally, right now — not by whatever the next poll happens
    // to say. Written to game_lobby immediately, before this device's own
    // animation even finishes (ADR 0002).
    const spinStartedAt = new Date().toISOString()
    lastSeenSpinStartedAt.current = new Date(spinStartedAt).getTime()
    setSpinning(true)
    setTargetMovieId(winner.id)

    writeResult(winner.id, spinStartedAt).catch((err) => {
      console.error('Failed to write spin result', err)
    })

    setTimeout(() => {
      setSpinning(false)
    }, animationMs)
  }

  function handleSpin() {
    if (pool.length === 0 || isSpinInProgress(lobby)) return
    runSpin(pool, startSpin)
  }

  function handleVeto() {
    if (!lobby || lobby.active_veto_user !== addedBy || lobby.veto_used) return
    // A veto that could re-land on the same movie would feel broken — the
    // genre filter itself is left untouched, since the veto-holder may
    // have deliberately changed it first (spec's Veto re-spin bullet).
    const poolExcludingPrevious = pool.filter((movie) => movie.id !== lobby.chosen_movie_id)
    runSpin(poolExcludingPrevious, useVeto)
  }

  async function handleToggleSpotlight(movie) {
    await setSpotlighted(movie.id, !movie.spotlighted)
    refetchMovies()
  }

  const targetMovie = unwatched.find((movie) => movie.id === targetMovieId) ?? null
  const spinDisabled = pool.length === 0 || isSpinInProgress(lobby)
  const showVeto = Boolean(
    lobby && lobby.active_veto_user === addedBy && !lobby.veto_used && lobby.chosen_movie_id
  )

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-cream">Decision Engine</h2>

      <SpinWheel pool={pool} spinning={spinning} targetMovie={targetMovie} animationMs={animationMs} />

      <div className="flex items-center gap-2">
        <label htmlFor="genre-filter" className="text-xs text-warmgray">
          Filter by genre
        </label>
        <select
          id="genre-filter"
          aria-label="Filter by genre"
          value={genreFilter}
          onChange={(event) => setGenreFilter(event.target.value)}
          className="rounded-md bg-card px-2 py-1 text-sm text-cream outline-none ring-1 ring-gold/20 transition duration-150 ease-out focus:ring-2 focus:ring-gold"
        >
          <option value="all">All genres</option>
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>

      {pool.length === 0 ? (
        <p className="text-sm text-warmgray">Nothing showing in this genre tonight</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pool.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              variant="spotlight"
              onToggleSpotlight={handleToggleSpotlight}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSpin}
        disabled={spinDisabled}
        className="rounded-md bg-gold px-3 py-2 text-sm font-medium text-gold-ink transition duration-150 ease-out hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        Spin
      </button>

      {showVeto && (
        <button
          type="button"
          onClick={handleVeto}
          className="rounded-md bg-card px-3 py-2 text-sm font-medium text-cream ring-1 ring-gold/20 transition duration-150 ease-out hover:bg-card/70"
        >
          Veto — re-spin
        </button>
      )}
    </div>
  )
}
