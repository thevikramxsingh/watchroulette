import { supabase } from '../../shared/supabaseClient'

// A duplicate would silently double a title's odds in the spin wheel (see
// spec's "Repo — detail"). This client-side check is a UX nicety that stops
// most duplicates before they ever hit the network — the DB's `unique`
// constraint on tmdb_id (schema.sql) is the real backstop for the race
// where two people add the same movie at the same moment.
export function isDuplicate(movies, tmdbId) {
  return movies.some((movie) => movie.tmdb_id === tmdbId)
}

export async function fetchMovies() {
  const { data, error } = await supabase
    .from('movie_repo')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

// Talks to our own serverless proxy (api/tmdb-videos.js), same reasoning as
// searchTmdb below — TMDB's key never reaches this file or the browser
// bundle. A failure here (network blip, TMDB down) shouldn't block adding
// the movie itself, so this quietly falls back to null (same "no trailer
// found" outcome as a genuinely trailer-less movie) rather than throwing.
async function fetchTrailerKey(tmdbId) {
  try {
    const res = await fetch(`/api/tmdb-videos?id=${tmdbId}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.trailerKey ?? null
  } catch {
    return null
  }
}

// `candidate` is exactly the shape searchTmdb() below returns (camelCase,
// TMDB's own field names) — mapped here to the DB's snake_case columns so
// that seam lives in one place instead of leaking into RepoPanel.
//
// Fetches the trailer once, here, at add-time — not per search keystroke,
// not per render (spec.md's Module 5a) — so it's one extra request per
// movie actually added, not one per candidate shown in the search list.
export async function addMovie(candidate, addedBy) {
  const trailerKey = await fetchTrailerKey(candidate.tmdbId)

  const { error } = await supabase.from('movie_repo').insert({
    title: candidate.title,
    genres: candidate.genres,
    poster_path: candidate.posterPath,
    summary: candidate.summary,
    tmdb_id: candidate.tmdbId,
    watch_page_url: candidate.watchPageUrl,
    trailer_key: trailerKey,
    added_by: addedBy,
  })

  if (error) throw error
}

// No hard delete — watched movies stay visible as shared history (spec's
// Repo detail), so this only ever flips the flag, never removes a row.
export async function setWatched(id, watched) {
  const { error } = await supabase
    .from('movie_repo')
    .update({ watched, watched_at: watched ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) throw error
}

// A real delete, not a hidden flag (Module 6) — a mis-added movie (wrong
// TMDB match, duplicate title, joke entry) isn't "shared history" the way
// a watched movie is, so there's no reason to keep it around softly
// hidden. `RepoPanel`'s "Removed — Undo" toast is the actual safety net
// here, not a blocking confirm dialog.
export async function removeMovie(id) {
  const { error } = await supabase.from('movie_repo').delete().eq('id', id)
  if (error) throw error
}

// The undo half of removeMovie — re-inserts using the row's own
// already-DB-shaped fields (snake_case, not the TMDB candidate shape
// addMovie takes), since this restores an existing repo entry rather than
// adding a fresh search result. Gets a new id; this is "put it back for a
// mis-tap," not a true undo-by-identity restore.
export async function restoreMovie(movie) {
  const { error } = await supabase.from('movie_repo').insert({
    title: movie.title,
    genres: movie.genres,
    poster_path: movie.poster_path,
    summary: movie.summary,
    tmdb_id: movie.tmdb_id,
    watch_page_url: movie.watch_page_url,
    trailer_key: movie.trailer_key,
    added_by: movie.added_by,
    watched: movie.watched,
    watched_at: movie.watched_at,
    spotlighted: movie.spotlighted,
  })
  if (error) throw error
}

// Talks to our own serverless proxy (api/tmdb-search.js), never TMDB
// directly — the API key never reaches this file or the browser bundle.
export async function searchTmdb(query) {
  const res = await fetch(`/api/tmdb-search?query=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Search failed')
  const data = await res.json()
  return data.results
}

// Module 2's Spotlight feature (ADR 0001) — lives here, not in
// decision-engine, because it's a movie_repo column: one API file per
// table, same seam already used for watched.
export async function setSpotlighted(id, spotlighted) {
  const { error } = await supabase.from('movie_repo').update({ spotlighted }).eq('id', id)
  if (error) throw error
}

// Spec's "Reset" bullet: spotlights clear automatically when a new round
// starts. Paired with lobbyApi.resetRound() for the game_lobby half of the
// same action.
export async function clearAllSpotlights() {
  const { error } = await supabase
    .from('movie_repo')
    .update({ spotlighted: false })
    .eq('spotlighted', true)
  if (error) throw error
}
