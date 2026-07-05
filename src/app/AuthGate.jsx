import { useEffect, useState } from 'react'
import { getSession, onAuthStateChange, fetchProfile } from '../shared/authApi'
import LoginScreen from './LoginScreen'
import DisplayNamePrompt from './DisplayNamePrompt'

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

  useEffect(() => {
    getSession().then(setSession)
    const subscription = onAuthStateChange(setSession)
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }

    setProfileLoading(true)
    fetchProfile(session.user.id)
      .then(setProfile)
      .finally(() => setProfileLoading(false))
  }, [session])

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <p className="text-sm text-warmgray">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <LoginScreen />
  }

  if (profileLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <p className="text-sm text-warmgray">Loading…</p>
      </div>
    )
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
