import { useState } from 'react'
import RepoPanel from '../features/repo/RepoPanel'
import DecisionEngine from '../features/decision-engine/DecisionEngine'
import ArenaGame from '../features/arena/ArenaGame'
import StatsPage from '../features/stats/StatsPage'
import { signOut } from '../shared/authApi'
import AuthGate from './AuthGate'
import ManageInvites from './ManageInvites'
import Entrance from './Entrance'

// Module 7 — replaces the old "type a name once, store it in localStorage"
// identity entirely. AuthGate is the outermost gate now: nothing below
// mounts without a real, invited-and-not-revoked session with a display
// name already set. addedBy comes from profile.display_name, not a typed
// string — see spec.md's "Real accounts & access control (Module 7)".
export default function App() {
  return <AuthGate>{({ profile, session }) => <AppShell profile={profile} session={session} />}</AuthGate>
}

// A plain in-page toggle between three views, not routes — same reasoning
// as Module 5c's stats page (see StatsPage.jsx's own comment): this app has
// deliberately never needed routing infrastructure for one or two extra
// views.
function AppShell({ profile, session }) {
  const [view, setView] = useState('game') // game | stats | invites

  return (
    <Entrance>
      <div className="min-h-screen flex flex-col bg-page">
        <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gold/25">
          <h1 className="font-display text-xl font-semibold text-cream">WatchRoulette</h1>
          <div className="flex flex-wrap items-center gap-4">
            {profile.is_owner && (
              <button
                type="button"
                onClick={() => setView((current) => (current === 'invites' ? 'game' : 'invites'))}
                aria-pressed={view === 'invites'}
                className={`text-sm font-medium transition duration-150 ease-out ${
                  view === 'invites' ? 'text-gold' : 'text-warmgray hover:text-gold'
                }`}
              >
                Manage Invites
              </button>
            )}
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
            <span className="text-sm text-cream">{profile.display_name}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-sm font-medium text-warmgray transition duration-150 ease-out hover:text-gold"
            >
              Sign out
            </button>
          </div>
        </header>

        {view === 'invites' ? (
          <ManageInvites accessToken={session.access_token} />
        ) : view === 'stats' ? (
          <StatsPage />
        ) : (
          <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            <section className="bg-card rounded-xl p-4 ring-1 ring-gold/15 min-w-0">
              <RepoPanel addedBy={profile.display_name} />
            </section>
            <section className="bg-card rounded-xl p-4 ring-1 ring-gold/15 min-w-0">
              <DecisionEngine addedBy={profile.display_name} />
            </section>
            <section className="bg-card rounded-xl p-4 ring-1 ring-gold/15 min-w-0">
              <ArenaGame addedBy={profile.display_name} />
            </section>
          </main>
        )}
      </div>
    </Entrance>
  )
}
