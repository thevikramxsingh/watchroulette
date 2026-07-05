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
// Mobile tab labels — plain, matching the app's existing "verb-first and
// plain" naming convention (Play/Spin/Watch, Stats, Manage Invites), not
// cute or cinema-voiced. "Wheel" rather than "Decision Engine" since that's
// this app's own internal/spec name, not something a user should ever see.
const MOBILE_TABS = [
  { id: 'repo', label: 'Repo' },
  { id: 'wheel', label: 'Wheel' },
  { id: 'arena', label: 'Arena' },
]

function AppShell({ profile, session }) {
  const [view, setView] = useState('game') // game | stats | invites
  // Mobile-only: below the lg breakpoint, one of the three panels shows at a
  // time instead of a long vertical scroll through all three (the original
  // layout, which is still exactly what lg+ screens show — this state has
  // no effect there at all). Defaults to Repo, matching its position as the
  // first panel in the existing lg+ grid.
  const [mobileTab, setMobileTab] = useState('repo')

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
          <main className="flex-1 p-6">
            {/* lg:hidden — at lg+ all three panels already show at once in
                the grid below, so there's nothing to switch between. Below
                lg, this replaces the old "scroll past two panels to reach
                the one you want" layout. */}
            <div role="tablist" className="mb-4 flex gap-2 lg:hidden">
              {MOBILE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === tab.id}
                  onClick={() => setMobileTab(tab.id)}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition duration-150 ease-out ${
                    mobileTab === tab.id
                      ? 'bg-gold text-gold-ink'
                      : 'bg-card text-warmgray ring-1 ring-gold/20 hover:text-cream'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* All three panels stay mounted at every screen size (same as
                  before this change) — visibility below lg is Tailwind's own
                  `hidden`/`block` classes (not the native `hidden`
                  attribute), with `lg:block` unconditionally restoring
                  visibility at lg+. A first version of this mixed the native
                  attribute with a `lg:block` class override, reasoning that
                  Tailwind's author-origin CSS should beat the browser's own
                  `[hidden]{display:none}` default — that held up in every
                  test (this project's test setup doesn't load real CSS into
                  jsdom at all, so nothing here was ever actually verified
                  against a real stylesheet) but did not hold up in the real
                  deployed build: confirmed live, at a wide desktop window,
                  only the tab-selected panel showed, with the other two grid
                  tracks empty. Using only Tailwind's own classes for both
                  directions avoids that cross-origin cascade question
                  entirely — the same mechanism already correctly used by the
                  tab bar's `lg:hidden` and this very grid's `lg:grid-cols-3`.
                  `aria-hidden` (not the native `hidden` attribute) carries
                  the accessibility signal instead, since it doesn't carry
                  any UA-stylesheet display rule of its own to conflict with. */}
              <section
                role="tabpanel"
                aria-hidden={mobileTab !== 'repo'}
                className={`bg-card rounded-xl p-4 ring-1 ring-gold/15 min-w-0 lg:block ${
                  mobileTab === 'repo' ? 'block' : 'hidden'
                }`}
              >
                <RepoPanel addedBy={profile.display_name} />
              </section>
              <section
                role="tabpanel"
                aria-hidden={mobileTab !== 'wheel'}
                className={`bg-card rounded-xl p-4 ring-1 ring-gold/15 min-w-0 lg:block ${
                  mobileTab === 'wheel' ? 'block' : 'hidden'
                }`}
              >
                <DecisionEngine addedBy={profile.display_name} />
              </section>
              <section
                role="tabpanel"
                aria-hidden={mobileTab !== 'arena'}
                className={`bg-card rounded-xl p-4 ring-1 ring-gold/15 min-w-0 lg:block ${
                  mobileTab === 'arena' ? 'block' : 'hidden'
                }`}
              >
                <ArenaGame addedBy={profile.display_name} />
              </section>
            </div>
          </main>
        )}
      </div>
    </Entrance>
  )
}
