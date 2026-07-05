import { useEffect, useState } from 'react'
import {
  addMovie,
  fetchMovies,
  isDuplicate,
  removeMovie,
  restoreMovie,
  searchTmdb,
  setWatched,
} from './repoApi'
import { mostRecentlyWatched, formatShortDate } from './lastWatched'
import { usePolling } from '../../shared/usePolling'
import { deriveGenres } from '../../shared/deriveGenres'
import { useUndoToast } from '../../shared/useUndoToast'
import MovieCard from '../../shared/MovieCard'
import Toast from '../../shared/Toast'

// Module 1 — Repo. Live TMDB search (debounced), add to the shared repo,
// duplicate prevention, watched toggle. Behavior specified in spec.md's
// "Repo — detail (Module 1)"; edge cases covered in RepoPanel.test.jsx.
// Module 6 layered nine small enhancements on top: remove+undo, added-by
// credit + sort/group by contributor, a named duplicate warning, a genre
// filter (shared derivation with Decision Engine), a "New" tag, a "Last
// watched" line, a copy-link button, and an undo toast on the watched
// toggle.
//
// debounceMs/pollIntervalMs are overridable props purely for test speed —
// production always uses the spec's real values (400ms / 4s) via the
// defaults below.
export default function RepoPanel({ addedBy, debounceMs = 400, pollIntervalMs = 4000 }) {
  const { data: movies, refetch } = usePolling(fetchMovies, pollIntervalMs)
  const [query, setQuery] = useState('')
  const [searchStatus, setSearchStatus] = useState('idle') // idle | loading | success | error
  const [results, setResults] = useState([])
  const [duplicateIds, setDuplicateIds] = useState(() => new Set())
  const [sortMode, setSortMode] = useState('date') // date | contributor
  const [genreFilter, setGenreFilter] = useState('all')
  const { toast, showUndoToast, handleUndo } = useUndoToast()

  const movieList = movies ?? []
  const genres = deriveGenres(movieList)

  const genreFiltered =
    genreFilter === 'all'
      ? movieList
      : movieList.filter((movie) => movie.genres?.includes(genreFilter))

  // "Group by who added it" (Module 6) — a stable sort by added_by. Array
  // sort is stable in modern JS engines, so the existing add-date order
  // (movieList already comes back ascending by created_at) is preserved
  // *within* each contributor's group, which is exactly "grouped by
  // contributor, still date-ordered inside that" per spec.
  const visibleMovies =
    sortMode === 'contributor'
      ? [...genreFiltered].sort((a, b) => (a.added_by ?? '').localeCompare(b.added_by ?? ''))
      : genreFiltered

  const lastWatched = mostRecentlyWatched(movieList)

  useEffect(() => {
    if (!query.trim()) {
      setSearchStatus('idle')
      setResults([])
      return
    }

    setSearchStatus('loading')
    setDuplicateIds(new Set())

    const timer = setTimeout(async () => {
      try {
        const found = await searchTmdb(query)
        setResults(found)
        setSearchStatus('success')
      } catch {
        setSearchStatus('error')
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, debounceMs])

  async function handleAdd(candidate) {
    // Client-side nicety, not the real backstop — see repoApi.isDuplicate's
    // comment. Checked at click time (not proactively hidden) so the
    // result list doesn't shift around while someone's still typing.
    if (isDuplicate(movieList, candidate.tmdbId)) {
      setDuplicateIds((prev) => new Set(prev).add(candidate.tmdbId))
      return
    }

    await addMovie(candidate, addedBy)
    refetch()
  }

  async function handleToggleWatched(movie) {
    const nextWatched = !movie.watched
    await setWatched(movie.id, nextWatched)
    refetch()

    // Undo toast (Module 6) — the watched checkbox is instant, shared, and
    // had no correction path for a mis-tap before this. Reuses the same
    // toast mechanism removeMovie's undo below uses.
    showUndoToast(
      nextWatched ? `Marked ${movie.title} watched` : `Marked ${movie.title} unwatched`,
      async () => {
        await setWatched(movie.id, movie.watched)
        refetch()
      }
    )
  }

  async function handleRemove(movie) {
    await removeMovie(movie.id)
    refetch()

    // Undo re-inserts the row (a new id, not a true restore-by-identity —
    // see repoApi.restoreMovie's own comment) — good enough as the actual
    // safety net for a mis-tap, in place of a blocking confirm dialog.
    showUndoToast(`Removed ${movie.title}`, async () => {
      await restoreMovie(movie)
      refetch()
    })
  }

  function findDuplicateHolder(tmdbId) {
    return movieList.find((movie) => movie.tmdb_id === tmdbId)?.added_by
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold text-cream">The Repo</h2>

      {lastWatched && (
        <p className="text-xs text-warmgray">
          Last watched: {lastWatched.title}, {formatShortDate(lastWatched.watched_at)}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <input
          type="text"
          aria-label="Search for a movie"
          placeholder="Search tonight's lineup…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-lg bg-card px-3 py-2 text-sm text-cream placeholder:text-warmgray/60 outline-none ring-1 ring-gold/20 transition duration-150 ease-out focus:ring-2 focus:ring-gold"
        />

        {searchStatus === 'loading' && (
          <p className="text-sm text-warmgray">Searching…</p>
        )}

        {searchStatus === 'error' && (
          <p className="text-sm text-red-500">
            Couldn&apos;t reach movie search — try again
          </p>
        )}

        {searchStatus === 'success' && results.length === 0 && (
          <p className="text-sm text-warmgray">No matches — try a different title.</p>
        )}

        {searchStatus === 'success' && results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((candidate) => (
              <li
                key={candidate.tmdbId}
                className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2 transition duration-150 ease-out hover:bg-card/70"
              >
                <span className="text-sm text-cream">{candidate.title}</span>
                <div className="flex items-center gap-2">
                  {duplicateIds.has(candidate.tmdbId) && (
                    <span className="text-xs text-warmgray">
                      Already added by {findDuplicateHolder(candidate.tmdbId) || 'someone'}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Add ${candidate.title}`}
                    onClick={() => handleAdd(candidate)}
                    className="rounded-md bg-gold px-2 py-1 text-xs font-medium text-gold-ink transition duration-150 ease-out hover:bg-gold-hover"
                  >
                    Add
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {movieList.length > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor="repo-sort" className="text-xs text-warmgray">
            Sort
          </label>
          <select
            id="repo-sort"
            aria-label="Sort by"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="rounded-md bg-card px-2 py-1 text-sm text-cream outline-none ring-1 ring-gold/20 transition duration-150 ease-out focus:ring-2 focus:ring-gold"
          >
            <option value="date">Recently added</option>
            <option value="contributor">Group by who added it</option>
          </select>

          <label htmlFor="repo-genre-filter" className="text-xs text-warmgray">
            Filter by genre
          </label>
          <select
            id="repo-genre-filter"
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
      )}

      {movieList.length === 0 ? (
        <p className="text-sm text-warmgray">
          Nothing&apos;s playing yet — search to add tonight&apos;s lineup.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleMovies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              variant="watched"
              onToggleWatched={handleToggleWatched}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      <Toast toast={toast} onUndo={handleUndo} />
    </div>
  )
}
