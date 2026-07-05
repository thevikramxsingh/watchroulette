import { fetchMovies } from '../repo/repoApi'
import { fetchLobby, fetchRoundHistory } from '../../shared/lobbyApi'
import { usePolling } from '../../shared/usePolling'
import { mostWatchedGenre, totalWatchedCount, mostRoundsWonBy, highestScoreEver } from './statsMath'

// Module 5c — a plain in-page view, not a new route (the existing
// single-page architecture holds; a real route would add routing
// infrastructure this app has never otherwise needed, just for one view).
// Every stat here is computed client-side from data already fetched by
// other features — no new "analytics" backend. See statsMath.js for the
// actual computation (unit-tested there); this file is just data-fetching
// and layout.
//
// Access: no change from the rest of the app — already fully open, no
// auth boundary, so a stats page doesn't introduce new exposure.
export default function StatsPage() {
  const { data: movies } = usePolling(fetchMovies)
  const { data: lobby } = usePolling(fetchLobby)
  const { data: roundHistory } = usePolling(fetchRoundHistory)

  const movieList = movies ?? []
  const historyList = roundHistory ?? []

  const genre = mostWatchedGenre(movieList)
  const watchedCount = totalWatchedCount(movieList)
  const champion = lobby?.round_high_score_holder ?? null
  const mostWins = mostRoundsWonBy(historyList)
  const highScore = highestScoreEver(historyList, lobby?.round_high_score ?? 0)

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h2 className="font-display text-lg font-semibold text-cream">Stats</h2>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total watched" value={watchedCount} />
        <StatCard label="Most-watched genre" value={genre ?? 'Nobody has watched anything yet'} />
        <StatCard label="Reigning Arena champion" value={champion ?? 'Nobody yet'} />
        <StatCard
          label="Most rounds won"
          value={mostWins ? `${mostWins.name} (${mostWins.count})` : 'Nobody yet'}
        />
        <StatCard label="Highest score ever" value={highScore} />
      </dl>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg bg-card px-4 py-3 ring-1 ring-gold/15">
      <dt className="text-xs uppercase tracking-wider text-warmgray">{label}</dt>
      <dd className="mt-1 font-display text-xl font-semibold text-cream">{value}</dd>
    </div>
  )
}
