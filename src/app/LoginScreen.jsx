import { useState } from 'react'
import { requestMagicLink, friendlyLoginError } from '../shared/authApi'

// Module 7 — the very first thing anyone sees now, logged out. No
// password field anywhere: submitting sends a magic link via Supabase Auth
// (shouldCreateUser: false, so an uninvited email is rejected here, not
// silently allowed through — see spec.md's "Real accounts & access
// control"). Deliberately its own small file rather than folded into
// AuthGate.jsx — same "smaller, well-bounded units" reasoning as every
// other shared component in this codebase.
export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus('sending')

    // requestMagicLink normally resolves with { error } for Supabase-level
    // failures (handled below via friendlyLoginError), but a genuine network
    // failure — offline, DNS, the request never reaching Supabase at all —
    // throws instead of resolving. Previously unhandled: the button stayed
    // on "Sending…" forever with no way to recover short of a page reload.
    try {
      const { error } = await requestMagicLink(email.trim())

      if (error) {
        setStatus('error')
        setErrorMessage(friendlyLoginError(error))
        return
      }

      setStatus('sent')
    } catch {
      setStatus('error')
      setErrorMessage('Could not reach the server — check your connection and try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-page p-6">
        <div role="status" className="max-w-sm rounded-xl bg-card p-6 text-center ring-1 ring-gold/20">
          <p className="font-display text-lg font-semibold text-cream">Check your email</p>
          <p className="mt-2 text-sm text-warmgray">
            We sent a login link to {email.trim()} — click it to get in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-gold/20"
      >
        <h1 className="font-display text-lg font-semibold text-cream">WatchRoulette</h1>
        <label htmlFor="login-email" className="text-xs text-warmgray">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          aria-label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg bg-page px-3 py-2 text-sm text-cream placeholder:text-warmgray/60 outline-none ring-1 ring-gold/20 transition duration-150 ease-out focus:ring-2 focus:ring-gold"
        />

        {status === 'error' && <p className="text-sm text-red-500">{errorMessage}</p>}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-md bg-gold px-3 py-2 text-sm font-medium text-gold-ink transition duration-150 ease-out hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'sending' ? 'Sending…' : 'Send me a link'}
        </button>
      </form>
    </div>
  )
}
