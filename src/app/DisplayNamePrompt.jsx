import { useState } from 'react'
import { setDisplayName, isDuplicateNameError } from '../shared/authApi'

// Module 7 — shown exactly once, the first time a session exists but
// profile.display_name is still null (set at invite time, see
// api/admin-invite.js). Saving is a one-way action for now, not editable
// later — that's a deliberate scope cut (see spec.md), not an oversight.
export default function DisplayNamePrompt({ userId, onSaved }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState('idle') // idle | saving | error
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setStatus('saving')
    const { error } = await setDisplayName(userId, trimmed)

    if (error) {
      setStatus('error')
      setErrorMessage(
        isDuplicateNameError(error)
          ? "That name's already in use — try another."
          : 'Something went wrong saving that — try again.'
      )
      return
    }

    onSaved(trimmed)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-card p-6 text-center ring-1 ring-gold/20"
      >
        <p className="font-display text-lg font-semibold text-cream">
          What should we call you?
        </p>
        <label htmlFor="display-name" className="sr-only">
          Your name
        </label>
        <input
          id="display-name"
          type="text"
          aria-label="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-lg bg-page px-3 py-2 text-center text-sm text-cream outline-none ring-1 ring-gold/20 transition duration-150 ease-out focus:ring-2 focus:ring-gold"
        />

        {status === 'error' && <p className="text-sm text-red-500">{errorMessage}</p>}

        <button
          type="submit"
          disabled={status === 'saving' || !name.trim()}
          className="rounded-md bg-gold px-3 py-2 text-sm font-medium text-gold-ink transition duration-150 ease-out hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
