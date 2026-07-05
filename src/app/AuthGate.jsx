import { useEffect, useState } from 'react'
import { getSession, onAuthStateChange, fetchProfile, signOut } from '../shared/authApi'
import LoginScreen from './LoginScreen'
import DisplayNamePrompt from './DisplayNamePrompt'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <p className="text-sm text-warmgray">Loading…</p>
    </div>
  )
}

// Module 7 — the outermost gate. Nothing under this ever mounts without a
// real session AND a display name already set (see spec.md's "login
// required for everything" rule) — this replaces the old typed-name model
// entirely, not just the header input that used to hold it.
//
// children is a render function, not plain JSX — the rest of the app needs
// the resolved profile (for addedBy, for is_owner) and session (for
// attaching a token to admin/TMDB requests), and there's no "ready" value
// to hand them until this component's own async checks finish.
export default function AuthGate({ children }) {
  // undefined = "haven't checked yet" (distinct from null = "checked, no
  // session") — this is what lets the loading state below only show once,
  // on the very first check, rather than flashing every time auth state
  // changes.
  const [session, setSession] = useState(undefined)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  // Distinct from "no profile yet" — this is what used to be missing
  // entirely: a fetchProfile failure (network blip, or a profile row that
  // genuinely doesn't exist, e.g. an orphaned auth user with no matching
  // profiles row) had no .catch at all, so profile stayed null and
  // profileLoading became false with nothing left to trigger a re-render —
  // the user got stuck on the loading screen forever, no error, no retry,
  // no way out short of reloading and hoping.
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    getSession().then(setSession)
    const subscription = onAuthStateChange(setSession)
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setProfileError(null)
      return
    }
    // Keyed on the user id, not the session object itself — Supabase fires
    // onAuthStateChange for background events too (a proactive token
    // refresh, or a tab regaining focus/visibility after being backgrounded,
    // both routine on a phone), each handing back a *new* session object for
    // the exact same signed-in user. Reacting to every one of those the same
    // way as a real sign-in would re-run loadProfile, which flips
    // profileLoading back to true and makes AuthGate render <LoadingScreen/>
    // instead of `children` for a moment — unmounting the entire app under
    // it, silently resetting whatever view/tab state it held (e.g. Manage
    // Invites), with no user action involved at all. A real user id change
    // (sign in, sign out, switch account) still reloads normally.
    if (profile && profile.id === session.user.id) return
    loadProfile(session.user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  function loadProfile(userId) {
    setProfileLoading(true)
    setProfileError(null)
    fetchProfile(userId)
      .then(setProfile)
      .catch(setProfileError)
      .finally(() => setProfileLoading(false))
  }

  if (session === undefined) {
    return <LoadingScreen />
  }

  if (!session) {
    return <LoginScreen />
  }

  if (profileError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page px-6 text-center">
        <p className="text-sm text-cream">Couldn’t load your account.</p>
        <p className="text-sm text-warmgray">
          If this keeps happening, ask the owner to check your invite.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => loadProfile(session.user.id)}
            className="rounded-md bg-gold px-3 py-2 text-sm font-medium text-gold-ink transition duration-150 ease-out hover:bg-gold-hover"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-md bg-card px-3 py-2 text-sm font-medium text-cream ring-1 ring-gold/20 transition duration-150 ease-out hover:bg-card/70"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (profileLoading || !profile) {
    return <LoadingScreen />
  }

  if (!profile.display_name) {
    return (
      <DisplayNamePrompt
        userId={session.user.id}
        onSaved={(name) => setProfile((current) => ({ ...current, display_name: name }))}
      />
    )
  }

  return children({ profile, session })
}
