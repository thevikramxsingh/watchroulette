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
  const [successMessage, setSuccessMessage] = useState('')
  const [revokingId, setRevokingId] = useState(null)

  async function refetch() {
    try {
      setProfiles(await fetchAllProfiles())
    } catch {
      setStatus('error')
      setErrorMessage('Could not refresh the list — try reloading the page.')
    }
  }

  useEffect(() => {
    refetch()
  }, [])

  async function handleInvite(event) {
    event.preventDefault()
    setStatus('inviting')
    setSuccessMessage('')

    const invitedEmail = email.trim()
    try {
      const result = await inviteMember(accessToken, invitedEmail)
      setEmail('')
      setStatus('idle')
      // Adding an email that's already invited-but-pending resends their
      // link rather than erroring (see admin-invite.js); adding a revoked
      // person's email restores their same account instead of blocking —
      // both are surfaced here so "Add" reads as a deliberate, understood
      // action, not a no-op or a silent failure.
      if (result.restored) {
        setSuccessMessage(
          result.resent
            ? `Access restored for ${invitedEmail} — a fresh login link was sent`
            : `Access restored for ${invitedEmail}`
        )
      } else {
        setSuccessMessage(result.resent ? `Invite resent to ${invitedEmail}` : `Invite sent to ${invitedEmail}`)
      }
      await refetch()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error.message)
    }
  }

  async function handleRevoke(profile) {
    setRevokingId(profile.id)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      await revokeMember(accessToken, profile.id)
      setStatus('idle')
      setSuccessMessage(`Revoked ${profile.email}`)
      await refetch()
    } catch (error) {
      setStatus('error')
      setErrorMessage(error.message)
    } finally {
      setRevokingId(null)
    }
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
      {status !== 'error' && successMessage && (
        <p className="text-sm text-warmgray">{successMessage}</p>
      )}

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
                    disabled={revokingId === profile.id}
                    className="text-xs font-medium text-warmgray/60 transition duration-150 ease-out hover:text-theater-red disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {revokingId === profile.id ? 'Revoking…' : 'Revoke'}
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
