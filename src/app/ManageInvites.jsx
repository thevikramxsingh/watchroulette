import { useEffect, useState } from 'react'
import { fetchAllProfiles, inviteMember, revokeMember, inviteStatus } from '../shared/authApi'

const STATUS_LABELS = {
  owner: 'Owner',
  revoked: 'Revoked',
  invited: 'Invited — hasn’t logged in yet',
  active: 'Active',
}

// Module 7 — owner-only (App.jsx only renders this when profile.is_owner is
// true; nobody else ever sees the nav item that leads here). accessToken is
// the caller's own current session token, forwarded as-is to
// api/admin-invite.js/api/admin-revoke.js, which independently re-verify
// it's actually an owner's token server-side — this screen hiding itself
// from non-owners is a UI nicety, not the real enforcement.
export default function ManageInvites({ accessToken }) {
  const [profiles, setProfiles] = useState([])
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | inviting | error
  const [errorMessage, setErrorMessage] = useState('')

  async function refetch() {
    setProfiles(await fetchAllProfiles())
  }

  useEffect(() => {
    refetch()
  }, [])

  async function handleInvite(event) {
    event.preventDefault()
    setStatus('inviting')

    try {
      await inviteMember(accessToken, email.trim())
      setEmail('')
      setStatus('idle')
      await refetch()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error.message)
    }
  }

  async function handleRevoke(profile) {
    await revokeMember(accessToken, profile.id)
    await refetch()
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="font-display text-lg font-semibold text-cream">Manage Invites</h2>

      <form onSubmit={handleInvite} className="flex items-center gap-2">
        <label htmlFor="invite-email" className="sr-only">
          Email to invite
        </label>
        <input
          id="invite-email"
          type="email"
          aria-label="Email to invite"
          placeholder="friend@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-64 rounded-lg bg-card px-3 py-2 text-sm text-cream placeholder:text-warmgray/60 outline-none ring-1 ring-gold/20 transition duration-150 ease-out focus:ring-2 focus:ring-gold"
        />
        <button
          type="submit"
          disabled={status === 'inviting' || !email.trim()}
          className="rounded-md bg-gold px-3 py-2 text-sm font-medium text-gold-ink transition duration-150 ease-out hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'inviting' ? 'Inviting…' : 'Add'}
        </button>
      </form>

      {status === 'error' && <p className="text-sm text-red-500">{errorMessage}</p>}

      <ul className="flex flex-col gap-2">
        {profiles.map((profile) => {
          const label = STATUS_LABELS[inviteStatus(profile)]
          const canRevoke = inviteStatus(profile) === 'active' || inviteStatus(profile) === 'invited'

          return (
            <li
              key={profile.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2"
            >
              <span className="text-sm text-cream">{profile.email}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-warmgray">{label}</span>
                {canRevoke && (
                  <button
                    type="button"
                    aria-label={`Revoke ${profile.email}`}
                    onClick={() => handleRevoke(profile)}
                    className="text-xs font-medium text-warmgray/60 transition duration-150 ease-out hover:text-theater-red"
                  >
                    Revoke
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
