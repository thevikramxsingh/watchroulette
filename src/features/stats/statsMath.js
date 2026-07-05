// Pure stats math for Module 5c's stats page — every stat is computed
// client-side from data already fetched elsewhere in the app (movie_repo,
// game_lobby, round_history); there's no new analytics backend. Split out
// from StatsPage.jsx so this reasoning has its own unit tests, same "pure
// logic gets tested, thin network wrappers don't" boundary as
// weighting.js/game.js.

export function mostWatchedGenre(movies) {
  const counts = {}
  for (const movie of movies) {
    if (!movie.watched) continue
    for (const genre of movie.genres ?? []) {
      counts[genre] = (counts[genre] ?? 0) + 1
    }
  }

  const entries = Object.entries(counts)
  if (entries.length === 0) return null

  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

export function totalWatchedCount(movies) {
  return movies.filter((movie) => movie.watched).length
}

// Ties broken alphabetically by name — arbitrary, but deterministic (not
// "whoever's row the database happened to return first").
export function mostRoundsWonBy(roundHistory) {
  const counts = {}
  for (const round of roundHistory) {
    if (!round.high_score_holder) continue
    counts[round.high_score_holder] = (counts[round.high_score_holder] ?? 0) + 1
  }

  const entries = Object.entries(counts)
  if (entries.length === 0) return null

  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const [name, count] = entries[0]
  return { name, count }
}

// "Highest score ever" has to include the round still in progress right
// now, not just rounds already logged to round_history — otherwise the
// current record holder would vanish from this stat until someone actually
// clicks New Round.
export function highestScoreEver(roundHistory, currentHighScore = 0) {
  const historicalScores = roundHistory.map((round) => round.high_score)
  return Math.max(currentHighScore, 0, ...historicalScores)
}
