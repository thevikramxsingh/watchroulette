// "Last watched" line (Module 6) — a cheap taste of shared history ahead
// of Module 5c's full stats page, not a replacement for it. Computed from
// data already being fetched (watched/watched_at), no new column. Pure so
// it's unit-testable without a network call.
export function mostRecentlyWatched(movies) {
  const watched = movies.filter((movie) => movie.watched && movie.watched_at)
  if (watched.length === 0) return null

  return watched.reduce((latest, movie) =>
    new Date(movie.watched_at) > new Date(latest.watched_at) ? movie : latest
  )
}

// `timeZone: 'UTC'` pins this to a fixed reading of the stored timestamp
// regardless of the browser's (or test runner's) local timezone — the
// spec's own example ("Last watched: Fight Club, July 2") is illustrative,
// not tied to a particular viewer's clock.
export function formatShortDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
