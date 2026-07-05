import { useState } from 'react'
import RepoPanel from '../features/repo/RepoPanel'
import DecisionEngine from '../features/decision-engine/DecisionEngine'
import ArenaGame from '../features/arena/ArenaGame'
import StatsPage from '../features/stats/StatsPage'
import { useLocalStorageState } from '../shared/useLocalStorageState'
import Entrance from './Entrance'

// Module 1 needs a real name for `movie_repo.added_by` — this is the "typed
// once, stored in localStorage" identity the spec's Architecture section
// describes ("Not real auth — stated explicitly, not implied to be more").
// Lives here, not inside RepoPanel, because Module 3's veto attribution
// will need the same name later.
export default function App() {
  const [name, setName] = useLocalStorageState('watchroulette:name', '')
  // Module 5c's stats page: a plain in-page toggle, not a route — see
  // StatsPage.jsx's own comment on why. "Prominence" was explicitly
  // decided during that module's design (a normal header nav item, not a
  // hidden/buried toggle), not left open the way it originally was.
  const [view, setView] = useState('game')

  return (
    <Entrance>
      <div className="min-h-screen flex flex-col bg-page">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gold/25">
          <h1 className="font-display text-xl font-semibold text-cream">WatchRoulette</h1>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setView((current) => (current === 'stats' ? 'game' : 'stats'))}
              aria-pressed={view === 'stats'}
              className={`text-sm font-medium transition duration-150 ease-out ${
                view === 'stats' ? 'text-gold' : 'text-warmgray hover:text-gold'
              }`}
            >
              Stats
            </button>
            <input
              type="text"
              aria-label="Your name"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-lg bg-card px-3 py-1.5 text-sm text-cream placeholder:text-warmgray/60 outline-none ring-1 ring-gold/20 transition duration-150 ease-out focus:ring-2 focus:ring-gold"
            />
          </div>
        </header>

        {view === 'stats' ? (
          <StatsPage />
        ) : (
          <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            <section className="bg-card rounded-xl p-4 ring-1 ring-gold/15">
              <RepoPanel addedBy={name || 'Someone'} />
            </section>
            <section className="bg-card rounded-xl p-4 ring-1 ring-gold/15">
              <DecisionEngine addedBy={name || 'Someone'} />
            </section>
            <section className="bg-card rounded-xl p-4 ring-1 ring-gold/15">
              <ArenaGame addedBy={name || 'Someone'} />
            </section>
          </main>
        )}
      </div>
    </Entrance>
  )
}
