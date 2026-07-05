// Owner-only endpoint (Module 7) — the server-side half of Manage Invites'
// "Add" button. Real enforcement lives here, not in the UI: this is what
// actually creates the invited person's Supabase account (so the login
// screen's shouldCreateUser:false check has an account to find) and sends
// their first magic link in the same step (inviteUserByEmail does both).
// See spec.md's "Real accounts & access control (Module 7)" for the full
// reasoning, especially why this can't just be a plain allowed-emails table
// checked client-side.
import {
  createAdminClient,
  looksLikeEmail,
  readJsonBody,
  requireOwner,
  resolveExistingInvite,
} from './_shared/adminAuth.js'

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

export default async function handler(req, res) {
  const admin = createAdminClient()

  const ownerId = await requireOwner(req, admin)
  if (!ownerId) {
    sendJson(res, 403, { error: 'Owner only' })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    sendJson(res, 400, { error: 'Invalid request body' })
    return
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!looksLikeEmail(email)) {
    sendJson(res, 400, { error: 'A valid email is required' })
    return
  }

  // Check our own profiles table BEFORE calling Supabase at all — the
  // earlier version called inviteUserByEmail first and only checked
  // afterward, which meant a real Supabase auth call fired even for
  // outcomes (blocked-active) that were always going to be rejected.
  // Looking up by email (lowercased on write below, and matched
  // lowercased here) works before we have a user id, unlike the old
  // by-id lookup which needed inviteUserByEmail's response first.
  const { data: existingProfile, error: lookupError } = await admin
    .from('profiles')
    .select('id, revoked, display_name')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) {
    sendJson(res, 502, { error: 'Could not check invite status. Try again.' })
    return
  }

  const outcome = resolveExistingInvite(existingProfile)

  if (outcome === 'blocked-active') {
    sendJson(res, 409, { error: 'This person already has an account.' })
    return
  }

  if (outcome === 'restore') {
    // Revoke is "paused," not deleted — restoring means the same account,
    // same history, un-banned. See resolveExistingInvite's comment and
    // spec.md's Module 7 amendment for why this is never a fresh account.
    const { error: unbanError } = await admin.auth.admin.updateUserById(existingProfile.id, {
      ban_duration: 'none',
    })
    if (unbanError) {
      sendJson(res, 502, { error: 'Could not restore access. Try again.' })
      return
    }

    const { error: restoreError } = await admin
      .from('profiles')
      .update({ revoked: false })
      .eq('id', existingProfile.id)

    if (restoreError) {
      sendJson(res, 502, { error: 'Could not restore access. Try again.' })
      return
    }

    // If they were revoked before ever completing their one-time naming
    // step, their original invite link may be long stale — send a fresh
    // one. If they'd already been active, no email is needed at all: they
    // just log in normally next time, same as anyone else.
    if (!existingProfile.display_name) {
      const { error: resendError } = await admin.auth.admin.inviteUserByEmail(email)
      if (resendError) {
        sendJson(res, 200, {
          invited: true,
          restored: true,
          resent: false,
          warning: 'Access restored, but the login link could not be resent — try Add again.',
        })
        return
      }
    }

    sendJson(res, 200, { invited: true, restored: true, resent: !existingProfile.display_name })
    return
  }

  if (outcome === 'resend') {
    // inviteUserByEmail is idempotent for an unconfirmed user — resends the
    // link rather than erroring.
    const { error } = await admin.auth.admin.inviteUserByEmail(email)
    if (error) {
      sendJson(res, 502, { error: 'Could not resend the invite. Try again.' })
      return
    }
    sendJson(res, 200, { invited: true, resent: true })
    return
  }

  // outcome === 'invite' — no profiles row yet, so this is a genuinely new
  // invite.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error || !data?.user) {
    // Supabase returns a real error (e.g. "already registered") rather
    // than a generic failure for most invite problems — passed through
    // as-is so Manage Invites can show something meaningful, not a bare
    // "something went wrong."
    sendJson(res, 502, { error: error?.message || 'Invite failed' })
    return
  }

  // Created here, at invite time, not left for the client to create on
  // first login — see spec.md's self-review note on why: Manage Invites
  // needs "invited, never logged in" to be a real, queryable status, which
  // means the row has to exist before that first login ever happens.
  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: data.user.id, email, display_name: null, is_owner: false, revoked: false })

  if (profileError) {
    // Roll back the just-created auth user rather than leaving an orphan
    // that can log in but has no profile row (which previously left
    // AuthGate stuck on an infinite loading spinner with no way out).
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {})
    // Never leak raw Postgres text (e.g. constraint names) to the client —
    // it reveals schema details and isn't something an owner clicking
    // "Add" can act on.
    sendJson(res, 502, { error: 'Could not save the invite. Try again.' })
    return
  }

  sendJson(res, 200, { invited: true, resent: false, userId: data.user.id })
}
